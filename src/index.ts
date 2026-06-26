import { handleRequest } from "./app";

const port = Number(Bun.env.PORT ?? 8787);

Bun.serve({
  port,
  fetch(request) {
    return handleRequest(request);
  },
});

console.log(`Backend listening on http://localhost:${port}`);
