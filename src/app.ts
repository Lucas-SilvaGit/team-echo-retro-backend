import { handleRoomsRequest } from "./routes/rooms";

export async function handleRequest(request: Request) {
  try {
    if (request.method === "OPTIONS") {
      return emptyResponse();
    }

    if (new URL(request.url).pathname === "/health") {
      return json({ ok: true });
    }

    const handled = await handleRoomsRequest(request);
    if (handled) return handled;

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error(error);
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function emptyResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
