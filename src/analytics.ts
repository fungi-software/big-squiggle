/**
 * The one module that knows PostHog exists; everything else calls the typed helpers here.
 * With no key configured (the emulator path, every unit test) posthog-js is never loaded
 * and each helper is a no-op. Nothing read from PostHog may feed `puzzle.ts`, `live.ts`
 * or `roomLogic.ts`: every device must compute the same deal and verdict from the room.
 */
import type { PostHog } from 'posthog-js';

import type { GameMode } from './restrictions';
import type { Screen } from './roomLogic';

export type JoinVia = 'invite' | 'code' | 'rejoin';
export type HoldRelease = 'pointer' | 'leave' | 'blur' | 'cancel' | 'screen';
export type PresenceTrigger = 'visibility' | 'focus' | 'online' | 'snapshot';

/** Every event the game sends, with the properties each one carries. */
export type Events = {
  room_created: { room_code: string; attempts: number };
  room_joined: { room_code: string; via: JoinVia; already_in: boolean };
  join_failed: {
    room_code?: string;
    kind: 'not-found' | 'in-progress' | 'full' | 'no-code' | 'network';
    via: 'invite' | 'code' | 'create';
  };
  mode_changed: { mode: GameMode };
  player_ready: { ready: boolean };
  round_started: { player_count: number; mode: GameMode; round_id: number };
  restriction_dealt: { restriction: string; seat: number };
  brief_acknowledged: { ms_on_brief: number };
  play_began: { round_id: number };
  shape_placed: { method: 'tap' | 'drag'; slot: number; replaced: boolean; fills_board: boolean };
  hold_started: { others_down: number };
  hold_released: { held_ms: number; others_down: number; released_by: HoldRelease };
  attempt_resolved: { won: boolean; round_id: number; player_count: number };
  round_won: {
    elapsed_ms: number;
    is_new_best: boolean;
    prev_best_ms?: number;
    round_id: number;
    player_count: number;
    mode: GameMode;
  };
  new_round: { rounds_so_far: number };
  round_abandoned: { round_id: number; seated: number; player_count: number };
  room_left: { screen: Screen; rounds_played: number };
  host_claimed: { grace_ms: number };
  presence_reasserted: { trigger: PresenceTrigger };
};

/** What every funnel breaks down by; registered as super properties while in a room. */
export interface RoomContext {
  room_code: string;
  mode: GameMode;
  player_count: number;
  round_id: number;
  is_host: boolean;
  seat: number | null;
}

/** The room as a PostHog group, so a table can be analysed as one unit. */
export interface RoomGroup {
  mode: GameMode;
  player_count: number;
  created_at: string;
  rounds_played: number;
  best_ms?: number;
}

const env = import.meta.env;
const KEY: string = env.VITE_POSTHOG_KEY ?? '';
const HOST: string = env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;
/** Calls made while the SDK chunk is still downloading; replayed in order once it lands. */
let queued: Array<(ph: PostHog) => void> = [];
let shown: Screen | null = null;

function withClient(fn: (ph: PostHog) => void): void {
  if (client) fn(client);
  else if (KEY) queued.push(fn);
}

/** Set as a super property so one project can tell its three deploys apart. */
export function environmentFor(mode: string, hostname: string): 'local' | 'preview' | 'production' {
  if (mode !== 'production') return 'local';
  // a Firebase preview channel is served from `<site>--<channel>-<hash>.web.app`
  return hostname.includes('--') ? 'preview' : 'production';
}

/** Loads the SDK as its own chunk. Pageviews are captured by hand: there is no router. */
export function initAnalytics(): void {
  if (!KEY) return;
  const params = new URLSearchParams(location.search);
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      defaults: '2026-08-30',
      capture_pageview: false,
      capture_pageleave: false,
      person_profiles: 'identified_only',
      persistence: 'localStorage+cookie',
      autocapture: true,
      capture_heatmaps: true,
      capture_dead_clicks: true,
      capture_performance: { web_vitals: true, network_timing: true },
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: true,
      },
      // canvas recording for the confetti is a project replay setting, not an SDK option
      session_recording: {
        // the name field is the only input holding personal data
        maskAllInputs: true,
      },
    });
    // no consent banner; `?no-track` is the documented escape hatch
    if (params.has('no-track')) posthog.opt_out_capturing();
    else if (params.has('track')) posthog.opt_in_capturing();
    posthog.register({ environment: environmentFor(env.MODE, location.hostname) });

    client = posthog;
    const pending = queued;
    queued = [];
    for (const fn of pending) fn(posthog);
  });

  addEventListener('pagehide', () => {
    if (client && shown) client.capture('$pageleave', { screen: shown }, { transport: 'sendBeacon' });
  });
}

export function track<E extends keyof Events>(event: E, props: Events[E]): void {
  withClient((ph) => ph.capture(event, props));
}

/** The anonymous Firebase uid is the identity: stable per browser, never a name. */
export function identify(uid: string): void {
  withClient((ph) => ph.identify(uid));
}

/** A person property only, set where the player chose it; never an event property. */
export function setPlayerName(name: string): void {
  withClient((ph) => ph.setPersonProperties({ name }));
}

export function noteFirstMode(mode: GameMode): void {
  withClient((ph) => ph.setPersonProperties(undefined, { first_seen_mode: mode }));
}

/** Registered before the first snapshot arrives, so no event in the room lacks its code. */
export function enterRoomContext(code: string): void {
  withClient((ph) => ph.register({ room_code: code }));
}

export function setRoomContext(ctx: RoomContext): void {
  withClient((ph) => ph.register({ ...ctx }));
}

const ROOM_KEYS: (keyof RoomContext)[] = ['room_code', 'mode', 'player_count', 'round_id', 'is_host', 'seat'];

export function leaveRoomContext(): void {
  withClient((ph) => {
    for (const key of ROOM_KEYS) ph.unregister(key);
  });
}

export function describeRoom(code: string, group: RoomGroup): void {
  withClient((ph) => ph.group('room', code, { ...group }));
}

/** Pageviews by hand: one per screen change, with the matching leave for the last one. */
export function screenShown(screen: Screen): void {
  if (screen === shown) return;
  const prev = shown;
  shown = screen;
  withClient((ph) => {
    if (prev) ph.capture('$pageleave', { screen: prev });
    ph.capture('$pageview', { screen });
  });
}

/** Undefined until flags are evaluated, and always with no key. Presentation only, never the deal. */
export function flag(key: string): string | boolean | undefined {
  return client?.getFeatureFlag(key) ?? undefined;
}
