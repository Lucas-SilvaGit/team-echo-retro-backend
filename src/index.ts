import { handleRequest } from "./app";
import { env } from "./env";

const port = Number(env.PORT ?? 8787);

Bun.serve({
  port,
  fetch(request) {
    return handleRequest(request);
  },
});

console.log(`Backend listening on http://localhost:${port}`);
