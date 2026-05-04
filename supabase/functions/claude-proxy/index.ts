/**
 * Supabase Edge Function: claude-proxy
 *
 * Proxies requests to Anthropic's API so that the API key never leaves the server.
 * The client authenticates using a Supabase session token (or anon key).
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, anthropic-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Require Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const isStreaming = body.stream === true;

  // Forward anthropic-version from client or use default
  const anthropicVersion = req.headers.get('anthropic-version') ?? API_VERSION;

  // Optional beta header from env
  const betaHeader = Deno.env.get('ANTHROPIC_BETA');

  const anthropicHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': anthropicVersion,
  };
  if (betaHeader) {
    anthropicHeaders['anthropic-beta'] = betaHeader;
  }

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(body),
    });

    if (isStreaming) {
      // SSE passthrough — pipe the response body directly back to the client
      return new Response(upstream.body, {
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
});
