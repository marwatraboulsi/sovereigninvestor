/**
 * Cloudflare Worker: sovereign-claude-proxy
 *
 * Proxies requests to Anthropic's API so that the API key never leaves the server.
 * Validates requests using the Supabase JWT secret (HS256) before forwarding.
 *
 * For streaming responses, we pipe chunks through a TransformStream and inject
 * SSE comment heartbeats every 25 seconds. This prevents iOS from dropping the
 * TCP connection during silent periods (e.g. while Anthropic executes a
 * server-side web search, which produces no bytes for 60-120+ seconds).
 *
 * Unlike the Supabase Edge Function this replaces, there is no wall-clock
 * timeout on streaming responses — analyses run as long as they need to.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const HEARTBEAT_INTERVAL_MS = 25_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, anthropic-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── JWT validation (HS256) ───────────────────────────────────────────────────

async function validateSupabaseJWT(authHeader, jwtSecret) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return false;

    // Check token expiry
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Validate auth
    const authHeader = request.headers.get('Authorization');
    const isValid = await validateSupabaseJWT(authHeader, env.SUPABASE_JWT_SECRET);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const isStreaming = body.stream === true;
    const anthropicVersion = request.headers.get('anthropic-version') ?? API_VERSION;

    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': anthropicVersion,
    };

    try {
      const upstream = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify(body),
      });

      if (isStreaming) {
        // ── Streaming: pipe with heartbeats ───────────────────────────────
        // Inject SSE comment heartbeats every 25 seconds to keep the iOS
        // TCP connection alive during silent web search tool execution.
        const encoder = new TextEncoder();
        const heartbeat = encoder.encode(': heartbeat\n\n');

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        let done = false;
        const heartbeatTimer = setInterval(async () => {
          if (!done) {
            try { await writer.write(heartbeat); } catch { /* writer closed */ }
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Pipe upstream → writable in the background
        (async () => {
          try {
            const reader = upstream.body.getReader();
            while (true) {
              const { value, done: streamDone } = await reader.read();
              if (streamDone) break;
              await writer.write(value);
            }
          } catch {
            // Upstream closed unexpectedly
          } finally {
            done = true;
            clearInterval(heartbeatTimer);
            writer.close().catch(() => {});
          }
        })();

        return new Response(readable, {
          status: upstream.status,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      } else {
        // Non-streaming: return the JSON response
        const data = await upstream.json();
        return new Response(JSON.stringify(data), {
          status: upstream.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(JSON.stringify({ error: `Upstream request failed: ${message}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
