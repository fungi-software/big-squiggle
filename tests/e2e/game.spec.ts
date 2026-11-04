import { gunzipSync } from 'node:zlib';

import { expect, test, type Browser, type Page, type Request } from '@playwright/test';

import { buildPuzzle } from '../../src/puzzle';
import { puzzleKey } from '../../src/roomLogic';

/** Every PostHog request is answered here, so nothing leaves the browser. */
const POSTHOG = 'https://posthog.e2e.test/**';

interface Captured {
  event: string;
  properties: Record<string, unknown>;
}

interface Player {
  page: Page;
  events: Captured[];
  named: (event: string) => Captured[];
}

/** The SDK gzips its batches; a form body is its fallback when it cannot. */
function decode(req: Request): Captured[] {
  const buf = req.postDataBuffer();
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
    .map((e) => ({ event: e.event, properties: e.properties ?? {} }));
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
    if (req.method() === 'POST') events.push(...decode(req));
    const json = req.method() === 'POST' || req.url().endsWith('/config');
    // flags and remote config get an empty answer, which leaves every SDK default in place
    return route.fulfill({
      status: 200,
      contentType: json ? 'application/json' : 'application/javascript',
      body: json ? '{}' : '',
    });
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#connecting')).toBeHidden();
  await page.fill('#nameInput', name);
  return { page, events, named: (event) => events.filter((e) => e.event === event) };
}

async function leave(page: Page): Promise<void> {
  await page.click('#doorBtn');
  await page.click('#leaveYes');
  await expect(page.locator('#homeView')).toBeVisible();
}

test('a table of two solves a board and reports every step', async ({ browser }) => {
  const host = await player(browser, 'Host');
  await host.page.click('#createBtn');
  await expect(host.page.locator('#lobbyView')).toBeVisible();
  const code = (await host.page.locator('#roomCode').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]+$/);

  const guest = await player(browser, 'Guest');
  await guest.page.fill('#joinCode', code);
  await guest.page.click('#joinBtn');
  await expect(guest.page.locator('#lobbyView')).toBeVisible();

  await host.page.click('#readyBtn');
  await guest.page.click('#readyBtn');
  await expect(host.page.locator('#startBtn')).toBeEnabled();
  await host.page.click('#startBtn');

  for (const p of [host, guest]) {
    await expect(p.page.locator('#briefView')).toBeVisible();
    await p.page.click('#briefReadyBtn');
  }
  for (const p of [host, guest]) await expect(p.page.locator('#playView')).toBeVisible();

  // seats are dealt in join order, so the host holds seat 0 and the guest seat 1
  const puzzle = buildPuzzle(puzzleKey(code, 1), 2);
  const placed: number[] = [];
  for (const [seat, p] of [host, guest].entries()) {
    let count = 0;
    for (let i = 0; i < puzzle.slots; i++) {
      if (puzzle.owners[i] === seat) continue;
      await p.page.click(`[data-glyph="${puzzle.answer[i]}"]`);
      count++;
    }
    placed.push(count);
  }

  // both press and keep pressing past HOLD_MS; the verdict arrives from the shared clock
  for (const p of [host, guest]) {
    const box = (await p.page.locator('#holdBtn').boundingBox())!;
    await p.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.page.mouse.down();
  }
  await expect(host.page.locator('.verdict.win')).toBeVisible({ timeout: 15_000 });
  await expect(guest.page.locator('.verdict.win')).toBeVisible({ timeout: 15_000 });
  for (const p of [host, guest]) await p.page.mouse.up();

  await leave(guest.page);
  await leave(host.page);

  // the SDK batches on a timer, so wait for the last event of the game to be sent
  for (const p of [host, guest]) {
    await expect.poll(() => p.named('room_left').length, { timeout: 15_000 }).toBe(1);
  }

  expect(host.named('room_created')).toMatchObject([{ properties: { room_code: code, attempts: 0 } }]);
  expect(guest.named('room_joined')).toMatchObject([
    { properties: { room_code: code, via: 'code', already_in: false } },
  ]);

  const screens = (p: Player) => p.named('$pageview').map((e) => e.properties.screen);
  expect(screens(host)).toEqual(['home', 'lobby', 'brief', 'play', 'home']);
  expect(screens(guest)).toEqual(['home', 'lobby', 'brief', 'play', 'home']);

  expect(host.named('round_started')).toMatchObject([
    { properties: { player_count: 2, round_id: 1, mode: 'call' } },
  ]);
  for (const [i, p] of [host, guest].entries()) {
    expect(p.named('$identify')).toHaveLength(1);
    expect(p.named('player_ready')).toMatchObject([{ properties: { ready: true } }]);
    expect(p.named('restriction_dealt')).toMatchObject([{ properties: { seat: i } }]);
    expect(p.named('brief_acknowledged')).toHaveLength(1);
    expect(p.named('play_began')).toMatchObject([{ properties: { round_id: 1 } }]);
    expect(p.named('shape_placed')).toHaveLength(placed[i]!);
    expect(p.named('shape_placed').at(-1)).toMatchObject({ properties: { method: 'tap', fills_board: true } });
    expect(p.named('hold_started')).toHaveLength(1);
    expect(p.named('hold_released')).toMatchObject([{ properties: { released_by: 'pointer' } }]);
    expect(p.named('attempt_resolved')).toMatchObject([{ properties: { won: true, round_id: 1 } }]);
    expect(p.named('round_won')).toMatchObject([
      { properties: { round_id: 1, player_count: 2, is_new_best: true, room_code: code, is_host: i === 0 } },
    ]);
    expect(p.named('room_left')).toMatchObject([{ properties: { screen: 'play', rounds_played: 1 } }]);

    // the name is a person property, never on an event; the uid is the identity
    for (const e of p.events) expect(e.properties.name).toBeUndefined();
    const names = p.named('$set').map((e) => (e.properties.$set as { name?: string } | undefined)?.name);
    expect(names).toContain(i === 0 ? 'Host' : 'Guest');
  }
});
