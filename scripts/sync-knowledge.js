/**
 * Sovereign Investor — Knowledge Base Sync
 *
 * Crawls the Fund OS Knowledge Base Notion page and all its descendants,
 * chunks the content, embeds with Voyage AI (voyage-3), and upserts into
 * the Supabase pgvector knowledge_chunks table.
 *
 * Run:    node scripts/sync-knowledge.js
 * Re-run: any time you update your Notion knowledge base — safe to re-run,
 *         old chunks for each page are deleted before new ones are inserted.
 *
 * Requirements: .env must contain NOTION_API_KEY, EXPO_PUBLIC_VOYAGE_API_KEY,
 *               EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

require('dotenv').config();

const { Client } = require('@notionhq/client');
const { createClient } = require('@supabase/supabase-js');

// ─── Clients ──────────────────────────────────────────────────────────────────

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  timeoutMs: 120_000,   // 2 minutes — default 60s is too short for large workspaces
});
// Use the service role key — this script runs server-side only and needs to
// bypass RLS to write to knowledge_chunks (which has no public INSERT policy).
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ─── Config ───────────────────────────────────────────────────────────────────

const VOYAGE_API_KEY    = process.env.EXPO_PUBLIC_VOYAGE_API_KEY;
const VOYAGE_MODEL      = 'voyage-3';
const CHUNK_WORDS       = 200;  // words per chunk
const OVERLAP_WORDS     = 30;   // overlap between consecutive chunks
const EMBED_BATCH_SIZE  = 20;   // texts per Voyage API call (stay well under limits)
const MIN_CHUNK_CHARS   = 80;   // discard chunks shorter than this

// Root page of the Fund OS Knowledge Base in Notion
const KNOWLEDGE_ROOT_ID = '334fd400-6cb3-80aa-9399-c39cf6d01c7c';

// ─── Utilities ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Notion helpers ───────────────────────────────────────────────────────────

async function fetchAllBlocks(blockId, retries = 3) {
  const blocks = [];
  let cursor;
  do {
    let attempt = 0;
    let res;
    while (true) {
      try {
        res = await notion.blocks.children.list({
          block_id: blockId,
          start_cursor: cursor,
          page_size: 100,
        });
        break;
      } catch (err) {
        attempt++;
        if (attempt > retries) throw err;
        const wait = attempt * 5_000; // 5s, 10s, 15s back-off
        process.stdout.write(`\n  ⚠ Notion timeout (attempt ${attempt}/${retries}), retrying in ${wait / 1000}s…`);
        await sleep(wait);
      }
    }
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function richTextToPlain(richText = []) {
  return richText.map((r) => r.plain_text).join('');
}

/**
 * Extract the title from a Notion page object.
 * Works for both regular pages (properties.title) and child_page blocks.
 */
function getPageTitle(pageOrBlock) {
  // child_page block style
  if (pageOrBlock.child_page?.title) return pageOrBlock.child_page.title;

  // Retrieved page style — properties.title.title is rich text
  const props = pageOrBlock.properties ?? {};
  const titleProp = props.title ?? props.Name ?? Object.values(props).find((p) => p.type === 'title');
  if (titleProp?.title?.length) return richTextToPlain(titleProp.title);

  return 'Untitled';
}

/**
 * Convert a single Notion block to plain text.
 * Does NOT recurse — that happens in extractPageText.
 */
function blockToText(block) {
  const t = block.type;
  if (!block[t]) return '';
  const rich = richTextToPlain(block[t].rich_text ?? []);
  if (!rich.trim()) return '';

  if (t === 'heading_1') return `\n\n# ${rich}\n`;
  if (t === 'heading_2') return `\n\n## ${rich}\n`;
  if (t === 'heading_3') return `\n\n### ${rich}\n`;
  if (t === 'paragraph') return rich;
  if (t === 'bulleted_list_item') return `• ${rich}`;
  if (t === 'numbered_list_item') return rich;
  if (t === 'quote') return `"${rich}"`;
  if (t === 'callout') return rich;
  if (t === 'toggle') return rich;
  if (t === 'divider') return '\n---\n';
  return rich;
}

/**
 * Recursively extract all text from a page, following nested blocks.
 * Stops at child_page boundaries — those are handled separately.
 */
async function extractPageText(pageId) {
  const blocks = await fetchAllBlocks(pageId);
  const lines = [];

  for (const block of blocks) {
    // child_page is a separate page — don't inline its content here
    if (block.type === 'child_page') continue;

    const text = blockToText(block);
    if (text.trim()) lines.push(text);

    // Recurse into nested blocks (toggles, columns, etc.)
    if (block.has_children) {
      const childText = await extractPageText(block.id);
      if (childText.trim()) lines.push(childText);
    }
  }

  return lines.join('\n');
}

/**
 * Recursively discover all descendant page IDs under rootId.
 * Returns an array of { id, title } objects for all discovered pages,
 * including section pages (which contain the bulk of the content).
 */
async function collectDescendantPages(rootId, depth = 0) {
  const results = [];
  const blocks  = await fetchAllBlocks(rootId);

  for (const block of blocks) {
    if (block.type !== 'child_page') continue;

    const pageId = block.id;
    const title  = block.child_page?.title ?? 'Untitled';

    results.push({ id: pageId, title });

    // Recurse into this sub-page
    const children = await collectDescendantPages(pageId, depth + 1);
    results.push(...children);
  }

  return results;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text) {
  const words  = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS).join(' ');
    if (slice.trim().length >= MIN_CHUNK_CHARS) {
      chunks.push({ content: slice, chunkIndex: chunks.length });
    }
    if (i + CHUNK_WORDS >= words.length) break;
    i += CHUNK_WORDS - OVERLAP_WORDS;
  }

  return chunks;
}

// ─── Voyage AI embedding ──────────────────────────────────────────────────────

// Track rate limiting — Voyage free tier: 3 RPM, 10K tokens/min
// We space requests by at least 22s to stay under 3 RPM safely.
let lastEmbedAt = 0;
const MIN_EMBED_GAP_MS = 22_000;

async function embedBatch(texts) {
  const wait = MIN_EMBED_GAP_MS - (Date.now() - lastEmbedAt);
  if (wait > 0) {
    process.stdout.write(`  ⏳ waiting ${Math.ceil(wait / 1000)}s (rate limit)…\n`);
    await sleep(wait);
  }
  lastEmbedAt = Date.now();

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

// ─── Sync a single page ───────────────────────────────────────────────────────

async function syncPage(pageId, title) {
  process.stdout.write(`  • "${title}" … `);

  const text = await extractPageText(pageId);
  if (!text.trim()) {
    console.log('empty, skipped');
    return 0;
  }

  const chunks = chunkText(text);
  if (!chunks.length) {
    console.log('no chunks, skipped');
    return 0;
  }

  // Remove old chunks for this page so re-runs stay clean
  const { error: delErr } = await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('notion_page_id', pageId);
  if (delErr) throw new Error(`Supabase delete error: ${delErr.message}`);

  // Embed and insert in batches
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch      = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((c) => c.content));

    const rows = batch.map((c, j) => ({
      notion_page_id: pageId,
      page_title:     title,
      chunk_index:    c.chunkIndex,
      content:        c.content,
      embedding:      embeddings[j],
    }));

    const { error: insErr } = await supabase.from('knowledge_chunks').insert(rows);
    if (insErr) throw new Error(`Supabase insert error: ${insErr.message}`);
  }

  console.log(`${chunks.length} chunks ✓`);
  return chunks.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Sovereign Investor — Knowledge Base Sync');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!VOYAGE_API_KEY)                         throw new Error('EXPO_PUBLIC_VOYAGE_API_KEY missing from .env');
  if (!process.env.NOTION_API_KEY)             throw new Error('NOTION_API_KEY missing from .env');
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL)   throw new Error('EXPO_PUBLIC_SUPABASE_URL missing from .env');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env — find it in Supabase → Project Settings → API');

  // ── Discover all pages under the knowledge base root ─────────────────────
  console.log('Discovering pages under Fund OS Knowledge Base…');
  const pages = await collectDescendantPages(KNOWLEDGE_ROOT_ID);

  // Also include the six top-level section pages themselves — they hold most content inline
  // (collectDescendantPages already includes them because they're child_page blocks)
  console.log(`Found ${pages.length} pages to sync.\n`);

  // ── Sync each page ────────────────────────────────────────────────────────
  let totalChunks = 0;
  let errors = 0;

  for (const { id, title } of pages) {
    try {
      totalChunks += await syncPage(id, title);
    } catch (err) {
      console.error(`  ✗ Error syncing "${title}": ${err.message}`);
      errors++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Done — ${totalChunks} chunks stored in Supabase.`);
  if (errors) console.log(`  ⚠ ${errors} page(s) failed — check errors above.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\n✗ Fatal error:', err.message);
  process.exit(1);
});
