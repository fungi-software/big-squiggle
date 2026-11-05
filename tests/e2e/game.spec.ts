import { gunzipSync } from 'node:zlib';

import { expect, test, type Browser, type Page, type Request } from '@playwright/test';

import { buildPuzzle, type Puzzle } from '../../src/puzzle';
import { puzzleKey } from '../../src/roomLogic';

/** Every PostHog request is answered here, so nothing leaves the browser. */
const POSTHOG = 'https://posthog.e2e.test/**';

interface Captured {
  event: string;
  properties: Record<string, unknown>;
  /** Chromium reports a beacon as `ping`, which is how the unload path shows up. */
  transport: string;
}

interface Player {
  page: Page;
  events: Captured[];
  named: (event: string) => Captured[];
}

/** What each page and the SDK did, printed only when the test fails. */
const diagnostics: string[] = [];

test.afterEach(({}, testInfo) => {
  if (testInfo.status !== 'passed') console.log(diagnostics.join('\n'));
  diagnostics.length = 0;
});

/** The SDK gzips its batches; a form body is its fallback when it cannot. */
function decode(req: Request): Captured[] {
  const buf = req.postDataBuffer() ?? (req.postData() ? Buffer.from(req.postData()!) : null);
  if (!buf) return [];
  const raw = buf.toString('utf8');
  let text = raw;
  if (new URL(req.url()).searchParams.get('compression') === 'gzip-js') {
    text = gunzipSync(buf).toString('utf8');
  } else if (raw.startsWith('data=')) {
    text = Buffer.from(decodeURIComponent(raw.slice(5)), 'base64').toString('utf8');
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return [];
  }
  const list: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { batch?: unknown[] }).batch)
      ? (body as { batch: unknown[] }).batch
      : [body];
  return list
    .filter((e): e is { event: string; properties?: Record<string, unknown> } =>
      typeof (e as { event?: unknown }).event === 'string',
    )
    .map((e) => ({ event: e.event, properties: e.properties ?? {}, transport: req.resourceType() }));
}

/** The SDK drops every event from a likely bot: a headless UA string or brand, or `navigator.webdriver`. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function player(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
  });
  const events: Captured[] = [];
  await context.route(POSTHOG, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const got = decode(req);
      events.push(...got);
      const path = new URL(req.url()).pathname + new URL(req.url()).search;
      const type = req.headers()['content-type'] ?? '';
      const bytes = req.postDataBuffer()?.length ?? -1;
      diagnostics.push(`${name} ${path} ${type} bytes=${bytes} events=${got.map((e) => e.event).join(',')}`);
    }
    const json = req.method() === 'POST' || req.url().endsWith('/config');
    // flags and remote config get an empty answer, which leaves every SDK default in place
    return route.fulfill({
      status: 200,
      contentType: json ? 'application/json' : 'application/javascript',
      body: json ? '{}' : '',
    });
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (/posthog/i.test(m.text())) diagnostics.push(`${name} console.${m.type()} ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => diagnostics.push(`${name} pageerror ${String(e).slice(0, 200)}`));
  await page.goto('/?__posthog_debug=true');
  // anonymous sign-in is a round trip to Firebase and can take a few seconds cold
  await expect(page.locator('#connecting')).toBeHidden({ timeout: 20_000 });
  await page.fill('#nameInput', name);
  return { page, events, named: (event) => events.filter((e) => e.event === event) };
}

async function sent(p: Player, event: string, count: number): Promise<void> {
  // the SDK batches on a timer, so an event is only certain once its request is seen
  await expect.poll(() => p.named(event).length, { timeout: 15_000 }).toBe(count);
}

/**
 * Requests sent during a real unload never reach the route, so the batch is awaited and
 * the unload leave fired by hand before the page goes.
 */
async function reload(p: Player, lastEvent: string, lastCount: number, view: string): Promise<void> {
  await sent(p, lastEvent, lastCount);
  const leaves = p.named('$pageleave').length;
  await p.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await sent(p, '$pageleave', leaves + 1);
  await p.page.reload();
  await expect(p.page.locator(view)).toBeVisible();
}

async function press(page: Page): Promise<void> {
  const box = (await page.locator('#holdBtn').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

/** Host first, and the guest only once it can see the host's press, so `others_down` is settled. */
async function holdTogether(host: Player, guest: Player): Promise<void> {
  await press(host.page);
  await expect(guest.page.locator('#holdPips .pip.on')).toHaveCount(1);
  await press(guest.page);
}

/** Taps every gap, including a replace and a same-shape re-tap; returns the expected `shape_placed` events. */
async function fillBoard(p: Player, seat: number, puzzle: Puzzle): Promise<Record<string, unknown>[]> {
  const wrong = puzzle.pool.find((g) => !puzzle.answer.includes(g))!;
  const gaps = Array.from({ length: puzzle.slots }, (_, i) => i).filter((i) => puzzle.owners[i] !== seat);
  const first = gaps[0]!;
  const last = gaps.at(-1)!;
  const expected: Record<string, unknown>[] = [];

  await p.page.click(`[data-glyph="${wrong}"]`);
  expected.push({ method: 'tap', slot: first, replaced: false, fills_board: false });
  await p.page.click(`[data-slot="${first}"]`);
  for (const i of gaps) {
    await p.page.click(`[data-glyph="${puzzle.answer[i]}"]`);
    expected.push({ method: 'tap', slot: i, replaced: i === first, fills_board: i === last });
  }
  await p.page.click(`[data-slot="${last}"]`);
  await p.page.click(`[data-glyph="${puzzle.answer[last]}"]`);
  expected.push({ method: 'tap', slot: last, replaced: false, fills_board: true });
  return expected;
}

async function brief(players: Player[]): Promise<void> {
  for (const p of players) {
    await expect(p.page.locator('#briefView')).toBeVisible();
    await p.page.click('#briefReadyBtn');
  }
  for (const p of players) await expect(p.page.locator('#playView')).toBeVisible();
}

async function winTogether(host: Player, guest: Player): Promise<void> {
  // both press and keep pressing past HOLD_MS; the verdict arrives from the shared clock
  await holdTogether(host, guest);
  for (const p of [host, guest]) await expect(p.page.locator('.verdict.win')).toBeVisible({ timeout: 15_000 });
  await host.page.mouse.up();
  await guest.page.mouse.up();
}

async function leave(page: Page): Promise<void> {
  await page.click('#doorBtn');
  await page.click('#leaveYes');
  await expect(page.locator('#homeView')).toBeVisible();
}

const screens = (p: Player, event: string) => p.named(event).map((e) => e.properties.screen);

test('a table of two plays three rounds and reports every step', async ({ browser }) => {
  const started = Date.now();
  const host = await player(browser, 'Host');
  await host.page.click('#createBtn');
  await expect(host.page.locator('#lobbyView')).toBeVisible();
  const code = (await host.page.locator('#roomCode').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]+$/);

  const guest = await player(browser, 'Guest');
  await guest.page.fill('#joinCode', code);
  await guest.page.click('#joinBtn');
  await expect(guest.page.locator('#lobbyView')).toBeVisible();
  // a refresh comes back into the same room as the same player
  await reload(guest, 'room_joined', 1, '#lobbyView');

  await host.page.click('#readyBtn');
  await guest.page.click('#readyBtn');
  await expect(host.page.locator('#startBtn')).toBeEnabled();
  await host.page.click('#startBtn');
  await brief([host, guest]);

  // a hold on unfinished boards resolves as a miss; releasing in turn settles `others_down`
  await holdTogether(host, guest);
  await expect(host.page.locator('#holdBtn')).toHaveClass(/miss/, { timeout: 10_000 });
  await host.page.mouse.up();
  await expect(guest.page.locator('#holdPips .pip.on')).toHaveCount(1);
  await guest.page.mouse.up();

  // seats are dealt in join order, so the host holds seat 0 and the guest seat 1
  const puzzle1 = buildPuzzle(puzzleKey(code, 1), 2);
  const shapes1 = [await fillBoard(host, 0, puzzle1), await fillBoard(guest, 1, puzzle1)];
  await winTogether(host, guest);

  // a rematch, solved more slowly than the first so the record stands; the guest comes
  // back into the round mid-play, which is not a second start of it
  await sent(host, 'round_won', 1);
  const firstMs = host.named('round_won')[0]!.properties.elapsed_ms as number;
  await host.page.click('[data-act="newround"]');
  await brief([host, guest]);
  await reload(guest, 'play_began', 2, '#playView');
  const puzzle2 = buildPuzzle(puzzleKey(code, 2), 2);
  const shapes2 = [await fillBoard(host, 0, puzzle2), await fillBoard(guest, 1, puzzle2)];
  await host.page.waitForTimeout(firstMs + 1000);
  await winTogether(host, guest);

  // a third round that the table walks out of
  await host.page.click('[data-act="newround"]');
  await brief([host, guest]);
  await leave(guest.page);
  await leave(host.page);
  for (const p of [host, guest]) await sent(p, 'room_left', 1);

  // the backend is shared, so a code can collide with a room an earlier run left behind
  expect(host.named('room_created')).toMatchObject([{ properties: { room_code: code } }]);
  expect(host.named('room_created')[0]!.properties.attempts).toBeGreaterThanOrEqual(0);
  expect(guest.named('room_joined')).toMatchObject([
    { properties: { room_code: code, via: 'code', already_in: false } },
    { properties: { room_code: code, via: 'rejoin', already_in: true } },
    { properties: { room_code: code, via: 'rejoin', already_in: true } },
  ]);

  const hostScreens = ['home', 'lobby', 'brief', 'play', 'brief', 'play', 'brief', 'play', 'home'];
  const guestScreens = [
    'home', 'lobby', 'home', 'lobby', 'brief', 'play', 'brief', 'play', 'home', 'play', 'brief', 'play', 'home',
  ];
  expect(screens(host, '$pageview')).toEqual(hostScreens);
  expect(screens(guest, '$pageview')).toEqual(guestScreens);
  // every screen but the last one shown is left, and a leave on unload goes as a beacon
  expect(screens(host, '$pageleave')).toEqual(hostScreens.slice(0, -1));
  expect(screens(guest, '$pageleave')).toEqual(guestScreens.slice(0, -1));
  const beacons = guest.named('$pageleave').map((e) => e.transport === 'ping');
  expect(beacons).toEqual(guestScreens.slice(0, -1).map((_, i) => i === 1 || i === 7));

  expect(host.named('round_started')).toMatchObject([
    { properties: { player_count: 2, round_id: 1, mode: 'call' } },
    { properties: { player_count: 2, round_id: 2, mode: 'call' } },
    { properties: { player_count: 2, round_id: 3, mode: 'call' } },
  ]);
  expect(host.named('new_round')).toMatchObject([
    { properties: { rounds_so_far: 1 } },
    { properties: { rounds_so_far: 2 } },
  ]);
  expect(guest.named('round_started')).toHaveLength(0);

  for (const [i, p] of [host, guest].entries()) {
    // once per browser: a reload finds the same uid already identified
    expect(p.named('$identify')).toHaveLength(1);
    expect(p.named('player_ready')).toMatchObject([{ properties: { ready: true } }]);
    expect(p.named('restriction_dealt')).toMatchObject([
      { properties: { seat: i } },
      { properties: { seat: i } },
      { properties: { seat: i } },
    ]);
    const briefed = p.named('brief_acknowledged').map((e) => e.properties.ms_on_brief as number);
    expect(briefed).toHaveLength(3);
    for (const ms of briefed) {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(60_000);
    }
    expect(p.named('play_began')).toMatchObject([
      { properties: { round_id: 1 } },
      { properties: { round_id: 2 } },
      { properties: { round_id: 3 } },
    ]);

    const shapes = p.named('shape_placed').map((e) => e.properties);
    expect(shapes).toMatchObject([...shapes1[i]!, ...shapes2[i]!]);

    const context = {
      environment: 'local',
      room_code: code,
      mode: 'call',
      player_count: 2,
      is_host: i === 0,
      seat: i,
    };
    expect(p.named('hold_started')).toMatchObject([
      { properties: { ...context, round_id: 1, others_down: i } },
      { properties: { ...context, round_id: 1, others_down: i } },
      { properties: { ...context, round_id: 2, others_down: i } },
    ]);
    const released = p.named('hold_released').map((e) => e.properties);
    expect(released).toMatchObject([
      { released_by: 'pointer', others_down: i === 0 ? 1 : 0 },
      { released_by: 'pointer' },
      { released_by: 'pointer' },
    ]);
    for (const r of released) {
      expect(r.held_ms as number).toBeGreaterThan(1500);
      expect(r.held_ms as number).toBeLessThan(15_000);
    }
    expect(p.named('attempt_resolved')).toMatchObject([
      { properties: { won: false, round_id: 1, player_count: 2 } },
      { properties: { won: true, round_id: 1, player_count: 2 } },
      { properties: { won: true, round_id: 2, player_count: 2 } },
    ]);

    const won = p.named('round_won').map((e) => e.properties);
    expect(won).toMatchObject([
      { ...context, round_id: 1, player_count: 2, is_new_best: true },
      { ...context, round_id: 2, player_count: 2, is_new_best: false },
    ]);
    expect(won[0]!.elapsed_ms as number).toBeGreaterThan(0);
    expect(won[0]).not.toHaveProperty('prev_best_ms');
    expect(won[1]!.prev_best_ms).toBe(won[0]!.elapsed_ms);
    expect(won[1]!.elapsed_ms as number).toBeGreaterThan(won[0]!.elapsed_ms as number);

    // one per change to the room's record (a win sets status, then the time); each of
    // the guest's reloads resets the store's dedupe, so one more apiece
    const groups = p.named('$groupidentify').map((e) => e.properties);
    expect(groups).toHaveLength(i === 0 ? 5 : 7);
    expect(groups[0]).toMatchObject({
      $group_type: 'room',
      $group_key: code,
      $group_set: { mode: 'call', player_count: 0, rounds_played: 0 },
    });
    expect(groups[0]!.$group_set).not.toHaveProperty('best_ms');
    const record = groups.at(-1)!.$group_set as Record<string, unknown>;
    expect(record).toMatchObject({ player_count: 2, rounds_played: 2, best_ms: won[0]!.elapsed_ms });
    expect(Date.parse(record.created_at as string)).toBeGreaterThan(started - 60_000);

    // the third round was dealt but never finished, so it does not count
    expect(p.named('room_left')).toMatchObject([
      { properties: { room_code: code, screen: 'play', rounds_played: 2 } },
    ]);
    const afterLeave = p.named('$pageview').at(-1)!.properties;
    for (const key of Object.keys(context)) {
      if (key !== 'environment') expect(afterLeave).not.toHaveProperty(key);
    }
    expect((afterLeave.$groups as Record<string, unknown> | undefined)?.room).toBeUndefined();

    for (const e of p.events) expect(e.properties.name).toBeUndefined();
    const names = p.named('$set').map((e) => (e.properties.$set as { name?: string } | undefined)?.name);
    expect(names).toContain(i === 0 ? 'Host' : 'Guest');
  }
});
