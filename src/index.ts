import { handleRequest } from "./app.js";
import { env } from "./env.js";

const port = Number(env.PORT ?? 8787);

Bun.serve({
  port,
  fetch(request) {
    return handleRequest(request);
  },
});

console.log(`Backend listening on http://localhost:${port}`);
