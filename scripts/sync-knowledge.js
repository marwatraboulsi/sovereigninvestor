/**
 * Sovereign Investor — Knowledge Base Sync
 *
 * Fetches all Notion pages the integration can access,
 * chunks them, embeds with Voyage AI, and upserts into Supabase pgvector.
 *
 * Run:  node scripts/sync-knowledge.js
 * Re-run any time you update your Notion knowledge base.
 */

require('dotenv').config();

const { Client } = require('@notionhq/client');
const { createClient } = require('@supabase/supabase-js');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

const VOYAGE_API_KEY = process.env.EXPO_PUBLIC_VOYAGE_API_KEY;
const VOYAGE_MODEL   = 'voyage-3';
const CHUNK_WORDS    = 150;  // smaller chunks to stay under 10K TPM
const OVERLAP_WORDS  = 20;   // overlap between chunks

// ─── Notion: extract plain text from all blocks ───────────────────────────────

async function fetchAllBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function richTextToPlain(richText = []) {
  return richText.map((r) => r.plain_text).join('');
}

async function blockToText(block) {
  const t = block.type;
  const data = block[t] ?? {};
  const rich = richTextToPlain(data.rich_text ?? []);

  if (t === 'heading_1') return `\n# ${rich}\n`;
  if (t === 'heading_2') return `\n## ${rich}\n`;
  if (t === 'heading_3') return `\n### ${rich}\n`;
  if (t === 'paragraph') return rich;
  if (t === 'bulleted_list_item') return `• ${rich}`;
  if (t === 'numbered_list_item') return rich;
  if (t === 'quote') return `"${rich}"`;
  if (t === 'callout') return rich;
  if (t === 'toggle') return rich;
  if (t === 'divider') return '---';
  return '';
}

async function extractPageText(pageId) {
  const blocks = await fetchAllBlocks(pageId);
  const lines = [];

  for (const block of blocks) {
    const text = await blockToText(block);
    if (text.trim()) lines.push(text);

    // Recurse into children (toggles, nested lists, etc.)
    if (block.has_children) {
      const childText = await extractPageText(block.id);
      if (childText.trim()) lines.push(childText);
    }
  }

  return lines.join('\n');
}

function getPageTitle(page) {
  // Database pages store title as a property
  const titleProp = Object.values(page.properties ?? {}).find((p) => p.type === 'title');
  if (titleProp?.title?.length) {
    return richTextToPlain(titleProp.title);
  }
  return 'Untitled';
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS).join(' ');
    if (slice.trim().length > 80) {
      chunks.push({ content: slice, chunkIndex: chunks.length });
    }
    if (i + CHUNK_WORDS >= words.length) break;
    i += CHUNK_WORDS - OVERLAP_WORDS;
  }

  return chunks;
}

// ─── Voyage AI: embed texts ───────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Free tier: 3 RPM. We wait 22s between each embed call to stay safely under.
let lastEmbedAt = 0;
const MIN_EMBED_GAP_MS = 25_000;

async function embedBatch(texts) {
  const now = Date.now();
  const wait = MIN_EMBED_GAP_MS - (now - lastEmbedAt);
  if (wait > 0) {
    process.stdout.write(`(waiting ${Math.ceil(wait / 1000)}s for rate limit) `);
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
    throw new Error(`Voyage AI error: ${err}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

// ─── Supabase: upsert chunks ──────────────────────────────────────────────────

async function syncPage(page) {
  const pageId = page.id;
  const title  = getPageTitle(page);

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

  // Delete old chunks for this page before re-inserting
  await supabase.from('knowledge_chunks').delete().eq('notion_page_id', pageId);

  // Embed in batches of 50 (Voyage rate limit)
  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch      = chunks.slice(i, i + BATCH);
    const embeddings = await embedBatch(batch.map((c) => c.content));

    const rows = batch.map((c, j) => ({
      notion_page_id: pageId,
      page_title:     title,
      chunk_index:    c.chunkIndex,
      content:        c.content,
      embedding:      embeddings[j],
    }));

    const { error } = await supabase.from('knowledge_chunks').insert(rows);
    if (error) throw new Error(`Supabase insert error: ${error.message}`);
  }

  console.log(`${chunks.length} chunks`);
  return chunks.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nSovereign Investor — Knowledge sync\n');

  if (!VOYAGE_API_KEY) throw new Error('EXPO_PUBLIC_VOYAGE_API_KEY missing from .env');
  if (!process.env.NOTION_API_KEY) throw new Error('NOTION_API_KEY missing from .env');

  // Fetch all pages the integration can access
  const pages = [];
  let cursor;
  do {
    const res = await notion.search({
      filter: { value: 'page', property: 'object' },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  // Filter out pages with no properties (Notion sometimes returns workspace-level results)
  const validPages = pages.filter((p) => p.object === 'page');
  console.log(`Found ${validPages.length} pages\n`);

  let total = 0;
  for (const page of validPages) {
    try {
      total += await syncPage(page);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  console.log(`\nDone — ${total} chunks stored in Supabase.\n`);
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
