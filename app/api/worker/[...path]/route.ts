import { NextRequest } from "next/server";

const TARGET = process.env.NEXT_PUBLIC_WORKER_API_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, pathSegments: string[]) {
  const url = new URL(req.url);
  const target = `${TARGET}/${pathSegments.join("/")}${url.search}`;

  const skip = new Set(["host", "connection", "transfer-encoding", "keep-alive"]);
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!skip.has(k.toLowerCase())) headers[k] = v;
  });

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      // @ts-expect-error — duplex is a valid Node.js fetch option not yet in TS types
      duplex: "half",
    });

    const ct = upstream.headers.get("Content-Type") ?? "application/json";
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": ct },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Worker unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}
