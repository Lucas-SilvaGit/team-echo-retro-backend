import { handleRequest } from "../src/app";

export default async function handler(req: any, res: any) {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
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
  const request = new Request(url, { method, headers, body });
  const response = await handleRequest(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const responseBody = await response.arrayBuffer();
  res.end(Buffer.from(responseBody));
}

async function readBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
