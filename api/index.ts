import { z } from "zod";

type NoteColor = "green" | "blue" | "lilac" | "gray" | "pink";

interface Participant {
  id: string;
  name: string;
  isLeader: boolean;
}

interface Card {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  color: NoteColor;
}

interface Column {
  id: string;
  title: string;
  color: NoteColor;
}

type TimerStatus = "idle" | "running" | "paused" | "ended";

interface TimerState {
  duration: number;
  remaining: number;
  status: TimerStatus;
  endsAt: number | null;
}

interface RoomState {
  id: string;
  name: string;
  leaderId: string;
  participants: Participant[];
  columns: Column[];
  cards: Record<string, Card[]>;
  timer: TimerState;
  finished: boolean;
}

type RoomMutation =
  | { type: "addColumn"; title: string }
  | { type: "removeColumn"; columnId: string }
  | { type: "renameColumn"; columnId: string; title: string }
  | { type: "reorderColumn"; columnId: string; dir: -1 | 1 }
  | { type: "addCard"; columnId: string; text: string }
  | { type: "editCard"; columnId: string; cardId: string; text: string }
  | { type: "removeCard"; columnId: string; cardId: string }
  | { type: "setTimer"; duration: number }
  | { type: "timerAction"; action: "play" | "pause" | "reset" }
  | { type: "finish" };

const COLORS: NoteColor[] = ["green", "blue", "lilac", "pink", "gray"];
const table = "retro_rooms";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function createDefaultRoom(
  id: string,
  name: string,
  leader: Participant,
  duration = 15 * 60,
): RoomState {
  return {
    id,
    name,
    leaderId: leader.id,
    participants: [leader],
    columns: [
      { id: "c1", title: "O que funcionou bem?", color: "green" },
      { id: "c2", title: "O que não funcionou?", color: "pink" },
      { id: "c3", title: "O que podemos melhorar?", color: "blue" },
    ],
    cards: { c1: [], c2: [], c3: [] },
    timer: { duration, remaining: duration, status: "idle", endsAt: null },
    finished: false,
  };
}

function nextColumnColor(index: number): NoteColor {
  return COLORS[index % COLORS.length];
}

function normalizeRoom(room: RoomState, now = Date.now()): RoomState {
  if (room.finished) return room;

  const timer = normalizeTimer(room.timer, now);
  if (timer === room.timer) return room;
  return { ...room, timer };
}

function normalizeTimer(timer: TimerState, now = Date.now()): TimerState {
  if (timer.status !== "running" || timer.endsAt == null) return timer;

  const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  if (remaining <= 0) {
    return { duration: timer.duration, remaining: 0, status: "ended", endsAt: null };
  }

  return { ...timer, remaining };
}

function applyMutation(
  room: RoomState,
  actor: Participant,
  mutation: RoomMutation,
  now = Date.now(),
): RoomState {
  const current = normalizeRoom(room, now);
  const isLeader = current.leaderId === actor.id;

  if (current.finished) {
    throw new Error("A retro já foi finalizada");
  }

  switch (mutation.type) {
    case "addColumn": {
      requireLeader(isLeader);
      const column = {
        id: genId(),
        title: mutation.title,
        color: nextColumnColor(current.columns.length),
      };
      return {
        ...current,
        columns: [...current.columns, column],
        cards: { ...current.cards, [column.id]: [] },
      };
    }
    case "removeColumn":
      requireLeader(isLeader);
      return removeColumn(current, mutation.columnId);
    case "renameColumn":
      requireLeader(isLeader);
      return {
        ...current,
        columns: current.columns.map((column) =>
          column.id === mutation.columnId ? { ...column, title: mutation.title } : column,
        ),
      };
    case "reorderColumn":
      requireLeader(isLeader);
      return reorderColumn(current, mutation.columnId, mutation.dir);
    case "addCard":
      return ensureOpen(addCard(current, actor, mutation.columnId, mutation.text, now));
    case "editCard":
      return ensureOpen(
        editCard(current, actor, mutation.columnId, mutation.cardId, mutation.text),
      );
    case "removeCard":
      return ensureOpen(removeCard(current, actor, mutation.columnId, mutation.cardId));
    case "setTimer":
      requireLeader(isLeader);
      return {
        ...current,
        timer: {
          duration: mutation.duration,
          remaining: mutation.duration,
          status: "idle",
          endsAt: null,
        },
      };
    case "timerAction":
      requireLeader(isLeader);
      return applyTimerAction(current, mutation.action, now);
    case "finish":
      requireLeader(isLeader);
      return { ...current, finished: true };
    default:
      return current;
  }
}

function ensureOpen(room: RoomState) {
  if (room.timer.status === "ended") {
    throw new Error("O tempo da retro já acabou");
  }
  return room;
}

function requireLeader(isLeader: boolean) {
  if (!isLeader) {
    throw new Error("Apenas o líder pode fazer esta ação");
  }
}

function removeColumn(room: RoomState, columnId: string): RoomState {
  const { [columnId]: _, ...cards } = room.cards;
  return {
    ...room,
    columns: room.columns.filter((column) => column.id !== columnId),
    cards,
  };
}

function reorderColumn(room: RoomState, columnId: string, dir: -1 | 1): RoomState {
  const index = room.columns.findIndex((column) => column.id === columnId);
  const nextIndex = index + dir;
  if (index < 0 || nextIndex < 0 || nextIndex >= room.columns.length) return room;

  const columns = [...room.columns];
  [columns[index], columns[nextIndex]] = [columns[nextIndex], columns[index]];
  return { ...room, columns };
}

function addCard(
  room: RoomState,
  actor: Participant,
  columnId: string,
  text: string,
  now: number,
): RoomState {
  const column = room.columns.find((item) => item.id === columnId);
  if (!column) {
    throw new Error("Coluna não encontrada");
  }

  const card: Card = {
    id: genId(),
    text,
    authorId: actor.id,
    authorName: actor.name,
    createdAt: now,
    color: column.color,
  };

  return {
    ...room,
    cards: {
      ...room.cards,
      [columnId]: [...(room.cards[columnId] ?? []), card],
    },
  };
}

function editCard(
  room: RoomState,
  actor: Participant,
  columnId: string,
  cardId: string,
  text: string,
): RoomState {
  return updateCard(room, actor, columnId, cardId, (card) => ({ ...card, text }));
}

function removeCard(room: RoomState, actor: Participant, columnId: string, cardId: string) {
  return updateCard(room, actor, columnId, cardId, () => null);
}

function updateCard(
  room: RoomState,
  actor: Participant,
  columnId: string,
  cardId: string,
  updater: (card: Card) => Card | null,
): RoomState {
  const cards = room.cards[columnId];
  if (!cards) {
    throw new Error("Coluna não encontrada");
  }

  const nextCards = cards.map((card) => {
    if (card.id !== cardId) return card;
    if (card.authorId !== actor.id && room.leaderId !== actor.id) {
      throw new Error("Você só pode editar seus próprios cards");
    }
    return updater(card);
  });

  return {
    ...room,
    cards: {
      ...room.cards,
      [columnId]: nextCards.filter((card): card is Card => card != null),
    },
  };
}

function applyTimerAction(room: RoomState, action: "play" | "pause" | "reset", now: number): RoomState {
  switch (action) {
    case "play":
      if (room.timer.status === "running") return room;
      return {
        ...room,
        timer: {
          ...room.timer,
          status: "running",
          endsAt: now + room.timer.remaining * 1000,
        },
      };
    case "pause":
      if (room.timer.status !== "running" || room.timer.endsAt == null) return room;
      return {
        ...room,
        timer: {
          ...room.timer,
          status: "paused",
          remaining: Math.max(0, Math.ceil((room.timer.endsAt - now) / 1000)),
          endsAt: null,
        },
      };
    case "reset":
      return {
        ...room,
        timer: {
          duration: room.timer.duration,
          remaining: room.timer.duration,
          status: "idle",
          endsAt: null,
        },
      };
  }
}

function assertConfig() {
  const supabaseUrl = Bun.env.SUPABASE_URL;
  const serviceRoleKey = Bun.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return { supabaseUrl, serviceRoleKey };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
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

interface RoomRow {
  id: string;
  state: RoomState;
}

async function readRoom(roomId: string) {
  const rows = await rest<RoomRow[]>(`${table}?id=eq.${encodeURIComponent(roomId)}&select=id,state`, {
    method: "GET",
    headers: headers(),
  });
  return rows[0] ?? null;
}

async function upsertRoom(room: RoomState) {
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

function headers() {
  const { serviceRoleKey } = assertConfig();
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

const createRoomSchema = z.object({
  roomName: z.string().trim().min(1),
  leaderName: z.string().trim().min(1),
  leaderId: z.string().trim().min(1),
  duration: z.number().int().min(60).max(60 * 120),
});

const joinSchema = z.object({
  name: z.string().trim().min(1),
  participantId: z.string().trim().min(1),
});

const mutationSchema: z.ZodType<RoomMutation> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addColumn"), title: z.string().trim().min(1) }),
  z.object({ type: z.literal("removeColumn"), columnId: z.string().trim().min(1) }),
  z.object({
    type: z.literal("renameColumn"),
    columnId: z.string().trim().min(1),
    title: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("reorderColumn"),
    columnId: z.string().trim().min(1),
    dir: z.union([z.literal(-1), z.literal(1)]),
  }),
  z.object({
    type: z.literal("addCard"),
    columnId: z.string().trim().min(1),
    text: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("editCard"),
    columnId: z.string().trim().min(1),
    cardId: z.string().trim().min(1),
    text: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("removeCard"),
    columnId: z.string().trim().min(1),
    cardId: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("setTimer"),
    duration: z.number().int().min(60).max(60 * 120),
  }),
  z.object({
    type: z.literal("timerAction"),
    action: z.union([z.literal("play"), z.literal("pause"), z.literal("reset")]),
  }),
  z.object({ type: z.literal("finish") }),
]);

function parseJsonBody(req: any) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readBody(req: any) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return "";
  return parseJsonBody(req);
}

export default async function handler(req: any, res: any) {
  if ((req.method ?? "GET") === "OPTIONS") {
    for (const [key, value] of Object.entries(corsHeaders())) {
      res.setHeader(key, value);
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers?.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      for (const [key, value] of Object.entries(corsHeaders())) {
        res.setHeader(key, value);
      }
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const match = url.pathname.match(/^\/rooms\/([^/]+)(?:\/(join|mutations))?$/);

    if (url.pathname === "/rooms" && req.method === "POST") {
      const body = createRoomSchema.parse(JSON.parse(await readBody(req)));
      const leader: Participant = { id: body.leaderId, name: body.leaderName, isLeader: true };
      const room = createDefaultRoom(genId(), body.roomName, leader, body.duration);
      const persisted = normalizeRoom(room);
      await upsertRoom(persisted);
      return sendJson(res, { room: persisted, me: leader });
    }

    if (!match) {
      return sendJson(res, { error: "Not found" }, 404);
    }

    const roomId = decodeURIComponent(match[1]);
    const action = match[2];

    if (!action && req.method === "GET") {
      const row = await readRoom(roomId);
      if (!row) return sendJson(res, { error: "Room not found" }, 404);
      return sendJson(res, { room: normalizeRoom(row.state) });
    }

    if (action === "join" && req.method === "POST") {
      const body = joinSchema.parse(JSON.parse(await readBody(req)));
      const row = await readRoom(roomId);
      if (!row) return sendJson(res, { error: "Room not found" }, 404);

      const room = normalizeRoom(row.state);
      const me: Participant = { id: body.participantId, name: body.name, isLeader: false };
      const participants = room.participants.some((participant) => participant.id === me.id)
        ? room.participants.map((participant) => (participant.id === me.id ? me : participant))
        : [...room.participants, me];

      const nextRoom = { ...room, participants };
      await upsertRoom(nextRoom);
      return sendJson(res, { room: nextRoom, me });
    }

    if (action === "mutations" && req.method === "POST") {
      const body = z
        .object({ participantId: z.string().trim().min(1), mutation: mutationSchema })
        .parse(JSON.parse(await readBody(req)));
      const row = await readRoom(roomId);
      if (!row) return sendJson(res, { error: "Room not found" }, 404);

      const room = normalizeRoom(row.state);
      const actor = room.participants.find((participant) => participant.id === body.participantId);
      if (!actor) return sendJson(res, { error: "Participant not part of this room" }, 403);

      try {
        const nextRoom = applyMutation(room, actor, body.mutation);
        await upsertRoom(nextRoom);
        return sendJson(res, { room: nextRoom });
      } catch (error) {
        return sendJson(
          res,
          { error: error instanceof Error ? error.message : "Failed to apply mutation" },
          400,
        );
      }
    }

    return sendJson(res, { error: "Not found" }, 404);
  } catch (error) {
    console.error(error);
    return sendJson(
      res,
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      500,
    );
  }
}

function sendJson(res: any, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(corsHeaders())) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}
