export type NoteColor = "green" | "blue" | "lilac" | "gray" | "pink";

export interface Participant {
  id: string;
  name: string;
  isLeader: boolean;
}

export interface Card {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  color: NoteColor;
}

export interface Column {
  id: string;
  title: string;
  color: NoteColor;
}

export type TimerStatus = "idle" | "running" | "paused" | "ended";

export interface TimerState {
  duration: number;
  remaining: number;
  status: TimerStatus;
  endsAt: number | null;
}

export interface RoomState {
  id: string;
  name: string;
  leaderId: string;
  participants: Participant[];
  columns: Column[];
  cards: Record<string, Card[]>;
  timer: TimerState;
  finished: boolean;
}

export type RoomMutation =
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

export function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultRoom(
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

export function nextColumnColor(index: number): NoteColor {
  return COLORS[index % COLORS.length];
}

export function normalizeRoom(room: RoomState, now = Date.now()): RoomState {
  if (room.finished) return room;

  const timer = normalizeTimer(room.timer, now);
  if (timer === room.timer) return room;
  return { ...room, timer };
}

export function normalizeTimer(timer: TimerState, now = Date.now()): TimerState {
  if (timer.status !== "running" || timer.endsAt == null) return timer;

  const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  if (remaining <= 0) {
    return { duration: timer.duration, remaining: 0, status: "ended", endsAt: null };
  }

  return { ...timer, remaining };
}

export function applyMutation(
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
    cards: { ...room.cards, [columnId]: [...(room.cards[columnId] ?? []), card] },
  };
}

function editCard(
  room: RoomState,
  actor: Participant,
  columnId: string,
  cardId: string,
  text: string,
): RoomState {
  const cards = room.cards[columnId] ?? [];
  const target = cards.find((card) => card.id === cardId);
  if (!target) return room;
  if (target.authorId !== actor.id) {
    throw new Error("Você só pode editar seus próprios cards");
  }

  return {
    ...room,
    cards: {
      ...room.cards,
      [columnId]: cards.map((card) => (card.id === cardId ? { ...card, text } : card)),
    },
  };
}

function removeCard(
  room: RoomState,
  actor: Participant,
  columnId: string,
  cardId: string,
): RoomState {
  const cards = room.cards[columnId] ?? [];
  const target = cards.find((card) => card.id === cardId);
  if (!target) return room;
  if (target.authorId !== actor.id) {
    throw new Error("Você só pode remover seus próprios cards");
  }

  return {
    ...room,
    cards: {
      ...room.cards,
      [columnId]: cards.filter((card) => card.id !== cardId),
    },
  };
}

function applyTimerAction(
  room: RoomState,
  action: "play" | "pause" | "reset",
  now: number,
): RoomState {
  if (action === "play") {
    const remaining = room.timer.remaining || room.timer.duration;
    return {
      ...room,
      timer: { ...room.timer, status: "running", remaining, endsAt: now + remaining * 1000 },
    };
  }

  if (action === "pause") {
    const normalized = normalizeTimer(room.timer, now);
    if (normalized.status !== "running") return { ...room, timer: normalized };
    return { ...room, timer: { ...normalized, status: "paused", endsAt: null } };
  }

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

export function roomJoinUrl(origin: string, roomId: string) {
  return `${origin.replace(/\/$/, "")}/join/${roomId}`;
}
