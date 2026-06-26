import { handleRoomsRequest } from "./routes/rooms";

const port = Number(Bun.env.PORT ?? 8787);

Bun.serve({
  port,
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return emptyResponse();
    }

    if (new URL(request.url).pathname === "/health") {
      return json({ ok: true });
    }

    const handled = await handleRoomsRequest(request);
    if (handled) return handled;

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Backend listening on http://localhost:${port}`);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function emptyResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
