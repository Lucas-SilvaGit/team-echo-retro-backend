import type { RoomState } from "./domain";
import { env } from "./env";

const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const table = "retro_rooms";

function assertConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Create a .env file in team-echo-retro-backend.",
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

function headers() {
  const { serviceRoleKey } = assertConfig();
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { supabaseUrl, serviceRoleKey } = assertConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

export interface RoomRow {
  id: string;
  state: RoomState;
}

export async function readRoom(roomId: string) {
  const rows = await rest<RoomRow[]>(
    `${table}?id=eq.${encodeURIComponent(roomId)}&select=id,state`,
    {
      method: "GET",
      headers: headers(),
    },
  );
  return rows[0] ?? null;
}

export async function upsertRoom(room: RoomState) {
  const rows = await rest<RoomRow[]>(`${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...headers(),
      prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ id: room.id, state: room }),
  });
  return rows[0] ?? { id: room.id, state: room };
}
