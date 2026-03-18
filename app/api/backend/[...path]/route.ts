import { NextRequest } from "next/server";

const TARGET = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? "http://localhost:8000";

// Never cache — most responses are SSE streams or live data
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, pathSegments: string[]) {
  const url = new URL(req.url);
  const target = `${TARGET}/${pathSegments.join("/")}${url.search}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      // Forward relevant headers but drop hop-by-hop ones
      headers: forwardHeaders(req),
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      // Required for streaming request bodies in Node.js fetch
      // @ts-expect-error — duplex is a valid Node.js fetch option not yet in TS types
      duplex: "half",
    });

    const ct = upstream.headers.get("Content-Type") ?? "application/json";
    const isSSE = ct.includes("text/event-stream");

    const headers: Record<string, string> = { "Content-Type": ct };
    if (isSSE) {
      headers["Cache-Control"] = "no-cache";
      headers["Connection"] = "keep-alive";
      headers["X-Accel-Buffering"] = "no";
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Backend unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const skip = new Set(["host", "connection", "transfer-encoding", "keep-alive"]);
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!skip.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}
