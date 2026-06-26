import { z } from "zod";
import {
  applyMutation,
  createDefaultRoom,
  genId,
  normalizeRoom,
  type Participant,
  type RoomMutation,
} from "../domain.js";
import { readRoom, upsertRoom } from "../supabase.js";

const createRoomSchema = z.object({
  roomName: z.string().trim().min(1),
  leaderName: z.string().trim().min(1),
  leaderId: z.string().trim().min(1),
  duration: z
    .number()
    .int()
    .min(60)
    .max(60 * 120),
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
    duration: z
      .number()
      .int()
      .min(60)
      .max(60 * 120),
  }),
  z.object({
    type: z.literal("timerAction"),
    action: z.union([z.literal("play"), z.literal("pause"), z.literal("reset")]),
  }),
  z.object({ type: z.literal("finish") }),
]);

export async function handleRoomsRequest(request: Request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/rooms\/([^/]+)(?:\/(join|mutations))?$/);

  if (url.pathname === "/rooms" && request.method === "POST") {
    return createRoom(request);
  }

  if (!match) return null;

  const roomId = decodeURIComponent(match[1]);
  const action = match[2];

  if (!action && request.method === "GET") {
    return readRoomSnapshot(roomId);
  }

  if (action === "join" && request.method === "POST") {
    return joinRoom(roomId, request);
  }

  if (action === "mutations" && request.method === "POST") {
    return mutateRoom(roomId, request);
  }

  return jsonError(404, "Not found");
}

async function createRoom(request: Request) {
  const body = createRoomSchema.parse(await request.json());
  const leader: Participant = { id: body.leaderId, name: body.leaderName, isLeader: true };
  const room = createDefaultRoom(genId(), body.roomName, leader, body.duration);
  const persisted = normalizeRoom(room);
  await upsertRoom(persisted);
  return json({
    room: persisted,
    me: leader,
  });
}

async function readRoomSnapshot(roomId: string) {
  const row = await readRoom(roomId);
  if (!row) return jsonError(404, "Room not found");
  return json({ room: normalizeRoom(row.state) });
}

async function joinRoom(roomId: string, request: Request) {
  const body = joinSchema.parse(await request.json());
  const row = await readRoom(roomId);
  if (!row) return jsonError(404, "Room not found");

  const room = normalizeRoom(row.state);
  const me: Participant = { id: body.participantId, name: body.name, isLeader: false };
  const participants = room.participants.some((participant) => participant.id === me.id)
    ? room.participants.map((participant) => (participant.id === me.id ? me : participant))
    : [...room.participants, me];

  const nextRoom = { ...room, participants };
  await upsertRoom(nextRoom);

  return json({
    room: nextRoom,
    me,
  });
}

async function mutateRoom(roomId: string, request: Request) {
  const body = z
    .object({ participantId: z.string().trim().min(1), mutation: mutationSchema })
    .parse(await request.json());
  const row = await readRoom(roomId);
  if (!row) return jsonError(404, "Room not found");

  const room = normalizeRoom(row.state);
  const actor = room.participants.find((participant) => participant.id === body.participantId);
  if (!actor) return jsonError(403, "Participant not part of this room");

  try {
    const nextRoom = applyMutation(room, actor, body.mutation);
    await upsertRoom(nextRoom);
    return json({ room: nextRoom });
  } catch (error) {
    return jsonError(400, error instanceof Error ? error.message : "Failed to apply mutation");
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

function jsonError(status: number, error: string) {
  return json({ error }, status);
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
