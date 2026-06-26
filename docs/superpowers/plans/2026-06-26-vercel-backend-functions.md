# Vercel Backend Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the Bun backend so it can run on Vercel Functions without changing the room business rules or Supabase persistence model.

**Architecture:** Extract the HTTP request handling into a shared module, keep Bun-based local development as a thin wrapper, and add a Vercel `api/` entrypoint that reuses the same handler. Keep CORS and error handling centralized so the frontend can keep calling the backend over HTTP with one backend URL.

**Tech Stack:** Bun, TypeScript, Vercel Functions, Supabase REST API, Zod.

---

### Task 1: Extract the shared HTTP handler

**Files:**
- Create: `src/app.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Move the request logic into a shared handler**

```ts
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
```

- [ ] **Step 2: Keep local development by starting Bun only in the local entry file**

```ts
import { handleRequest } from "./app";

const port = Number(Bun.env.PORT ?? 8787);

Bun.serve({
  port,
  fetch: handleRequest,
});

console.log(`Backend listening on http://localhost:${port}`);
```

- [ ] **Step 3: Verify the TypeScript split is consistent**

Run: `bunx tsc -p tsconfig.json --noEmit`
Expected: no TypeScript errors.

### Task 2: Add the Vercel Function entrypoint

**Files:**
- Create: `api/index.ts`
- Create: `vercel.json`

- [ ] **Step 1: Add the function wrapper that delegates to the shared handler**

```ts
import { handleRequest } from "../src/app";

export default async function handler(request: Request) {
  return handleRequest(request);
}
```

- [ ] **Step 2: Add Vercel runtime configuration**

```json
{
  "functions": {
    "api/index.ts": {
      "runtime": "bunjs"
    }
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.ts"
    }
  ]
}
```

- [ ] **Step 3: Verify the entrypoint remains minimal**

Run: `sed -n '1,80p' api/index.ts`
Expected: only the import and default export.

### Task 3: Document production configuration

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Add production deployment notes**

```md
## Vercel deploy

- Frontend: deploy the frontend repo as a Vite project.
- Backend: deploy this repo as Vercel Functions.
- Set these environment variables in Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Update the frontend `VITE_BACKEND_URL` to the deployed backend URL.
```

- [ ] **Step 2: Keep the local example env aligned**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=8787
```

- [ ] **Step 3: Verify the README explains both local and production setup**

Run: `sed -n '1,220p' README.md`
Expected: local setup plus Vercel deploy notes are both present and consistent.

### Task 4: Validate the deploy shape

**Files:**
- Modify: none

- [ ] **Step 1: Run the type check**

Run: `bunx tsc -p tsconfig.json --noEmit`
Expected: pass.

- [ ] **Step 2: Run the local server**

Run: `bun run dev`
Expected: backend starts on `http://localhost:8787` as before.

- [ ] **Step 3: Smoke test the health endpoint**

Run: `curl -i http://localhost:8787/health`
Expected: `HTTP/1.1 200` with `{"ok":true}`.

