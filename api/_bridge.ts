type NodeRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export function handleOptions(req: NodeRequest, res: any) {
  if ((req.method ?? "GET") !== "OPTIONS") return false;

  for (const [key, value] of Object.entries(corsHeaders())) {
    res.setHeader(key, value);
  }

  res.statusCode = 204;
  res.end();
  return true;
}

export async function toRequest(req: NodeRequest) {
  const url = new URL(req.url, `http://${req.headers?.host ?? "localhost"}`);
  const method = req.method ?? "GET";
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    }
  }

  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
  return new Request(url, { method, headers, body });
}

export async function writeResponse(res: any, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}

export function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

async function readBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}
