# Backend

Small Bun + TypeScript API that stores retro rooms in Supabase.

## Environment

Copy `.env.example` to `.env` and fill the values:

```bash
cp .env.example .env
```

Use these variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional, defaults to `8787`)

Important: `SUPABASE_SERVICE_ROLE_KEY` stays only in the backend. Do not put it in the frontend.

The front-end reads:

- `VITE_BACKEND_URL` (defaults to `http://localhost:8787`)

## Run

```bash
cd ../team-echo-retro-backend
bun install
bun run dev
```

If you keep the dependencies installed at the repo root, `bun install` in the backend folder is not required for local editing, but it is the safest way to make the package self-contained.
