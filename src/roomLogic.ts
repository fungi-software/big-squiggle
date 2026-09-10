/**
 * Everything about a room that is a pure function of its snapshot.
 *
 * The Firebase calls in `room.ts` are deliberately thin wrappers over these, so the
 * rules that actually decide a game — who is seated, who may start, when the table has
 * finished briefing — are testable without a database.
 */
import type { LiveRow } from './live';
import { RESTRICTIONS } from './restrictions';

export type RoomStatus = 'lobby' | 'briefing' | 'playing' | 'won';
export type Screen = 'home' | 'lobby' | 'brief' | 'play';

export interface RoomMeta {
  hostUid: string;
  status: RoomStatus;
  roundId: number;
  playerCount: number;
  createdAt: number;
  lastActive: number;
  /** Server time the board went live; the clock counts from here. */
  playStartedAt?: number;
  /** Server time the table solved it. Derived from the hold, not from a round trip. */
  solvedAt?: number;
  /** Fastest solve this room has managed. */
  bestMs?: number;
}

export interface PlayerRow {
  name: string;
  joinedAt: number;
  /** The round this player declared ready for; round-scoped so nothing needs resetting. */
  ready?: number;
  /** The round this player acknowledged their restriction for. */
  briefed?: number;
}

export interface RoomSnapshot {
  code: string;
  meta: RoomMeta;
  players: Record<string, PlayerRow>;
  seats: Record<string, number>;
  online: Record<string, boolean>;
  live: Record<string, LiveRow>;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function isMember(room: RoomSnapshot | null, uid: string | null): boolean {
  return !!room && !!uid && !!room.players[uid];
}

export function isOnline(room: RoomSnapshot, uid: string): boolean {
  return !!room.online[uid];
}

/** Members present right now, oldest join first — the order seats are handed out in. */
export function onlineUids(room: RoomSnapshot): string[] {
  return Object.keys(room.players)
    .filter((uid) => room.online[uid])
    .sort((a, b) => {
      const d = (room.players[a]!.joinedAt ?? 0) - (room.players[b]!.joinedAt ?? 0);
      return d !== 0 ? d : a < b ? -1 : 1;
    });
}

/** Uids holding a seat this round, in seat order. */
export function seatedUids(room: RoomSnapshot): string[] {
  return Object.keys(room.seats)
    .filter((uid) => !!room.players[uid])
    .sort((a, b) => room.seats[a]! - room.seats[b]!);
}

export function isReady(room: RoomSnapshot, uid: string): boolean {
  return room.players[uid]?.ready === room.meta.roundId;
}

export function isBriefed(room: RoomSnapshot, uid: string): boolean {
  return room.players[uid]?.briefed === room.meta.roundId;
}

export function isHost(room: RoomSnapshot | null, uid: string | null): boolean {
  return !!room && !!uid && room.meta.hostUid === uid;
}

export function canStart(room: RoomSnapshot, uid: string): boolean {
  if (!isHost(room, uid) || room.meta.status !== 'lobby') return false;
  const present = onlineUids(room);
  if (present.length < MIN_PLAYERS || present.length > MAX_PLAYERS) return false;
  return present.every((u) => isReady(room, u));
}

/** Why the host cannot start yet — so a dead button can say what it is waiting for. */
export type StartBlock =
  | { kind: 'too-few' }
  | { kind: 'too-many' }
  | { kind: 'offline'; count: number }
  | { kind: 'not-ready'; count: number }
  | null;

export function startBlocker(room: RoomSnapshot): StartBlock {
  const present = onlineUids(room);
  if (present.length > MAX_PLAYERS) return { kind: 'too-many' };

  if (present.length < MIN_PLAYERS) {
    // a player who readied and then dropped still sits in the roster, so "2 players
    // minimum" reads as a broken button. Name what actually happened.
    const away = Object.keys(room.players).filter((u) => !isOnline(room, u)).length;
    return away ? { kind: 'offline', count: away } : { kind: 'too-few' };
  }

  const notReady = present.filter((u) => !isReady(room, u)).length;
  return notReady ? { kind: 'not-ready', count: notReady } : null;
}

/** Seats are handed out in join order, all at once, so two players cannot claim one. */
export function assignSeats(room: RoomSnapshot): Record<string, number> {
  const seats: Record<string, number> = {};
  onlineUids(room).forEach((uid, i) => {
    seats[uid] = i;
  });
  return seats;
}

export function allBriefed(room: RoomSnapshot): boolean {
  const seated = seatedUids(room);
  return seated.length > 0 && seated.every((uid) => isBriefed(room, uid));
}

export function deriveScreen(room: RoomSnapshot | null, uid: string | null): Screen {
  if (!isMember(room, uid)) return 'home';
  const r = room!;
  if (r.meta.status === 'lobby') return 'lobby';
  if (r.meta.status === 'briefing') return 'brief';
  // a member with no seat sat out this round; park them in the lobby rather than a board
  return r.seats[uid!] === undefined ? 'lobby' : 'play';
}

export function isStale(meta: Pick<RoomMeta, 'lastActive'> | null, serverNow: number): boolean {
  if (!meta) return true;
  return !meta.lastActive || meta.lastActive < serverNow - ROOM_TTL_MS;
}

/** Who takes over when the host drops: the longest-present player still online. */
export function nextHost(room: RoomSnapshot): string | null {
  if (isOnline(room, room.meta.hostUid)) return room.meta.hostUid;
  return onlineUids(room)[0] ?? null;
}

/**
 * Seats cycle through the restrictions in a fixed order — seat 1 camera, seat 2
 * microphone, seat 3 sound, seat 4 camera again. Predictable on purpose: the table can
 * see how the constraints are distributed without anyone having to say.
 */
export function restrictionIndex(seat: number): number {
  return seat % RESTRICTIONS.length;
}

/** The deal is seeded by room and round together, so a rematch is a fresh puzzle. */
export function puzzleKey(code: string, roundId: number): string {
  return code + '#' + roundId;
}

/**
 * How long the round has been running, or how long it took. Null before the board goes
 * live, so a lobby shows no clock.
 */
export function elapsedMs(meta: RoomMeta, serverNow: number, localSolvedAt?: number): number | null {
  if (!meta.playStartedAt) return null;
  const end = meta.solvedAt ?? localSolvedAt ?? serverNow;
  return Math.max(0, end - meta.playStartedAt);
}

export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const mins = Math.floor(total / 60);
  return mins + ':' + String(total % 60).padStart(2, '0');
}

export function isNewBest(elapsed: number, best: number | undefined): boolean {
  return elapsed > 0 && (!best || elapsed < best);
}

export interface SolveBadge {
  /** Show the time at all. */
  time: number | null;
  /** Mark it as a record. */
  beat: boolean;
  /** The mark it beat, or the mark still to beat. */
  compareTo?: number;
}

/**
 * What the win panel says about the clock.
 *
 * `prevBest` must be the room's record as it stood *before* this solve was written —
 * reading it back off the room compares the time against itself and no solve is ever a
 * record. And only a device that watched the solve happen can claim one: after a
 * refresh there is nothing to compare against, so it shows the time plainly.
 */
export function solveBadge(
  time: number | null,
  watchedItHappen: boolean,
  prevBest: number | undefined,
  roomBest: number | undefined,
): SolveBadge {
  if (time == null) return { time: null, beat: false };

  const beat = watchedItHappen && isNewBest(time, prevBest);
  if (beat) return { time, beat: true, compareTo: prevBest };
  return { time, beat: false, compareTo: roomBest && roomBest < time ? roomBest : undefined };
}
