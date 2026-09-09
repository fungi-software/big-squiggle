import {
  assertFails, assertSucceeds, initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { get, ref, set, update } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Runs only under `npm run test:rules`, which starts the emulator first. The plain
 * `npm test` skips this file so the suite stays runnable without a JVM.
 */
const EMULATOR = process.env.FIREBASE_DATABASE_EMULATOR_HOST;

describe.skipIf(!EMULATOR)('database rules', () => {
  let env: RulesTestEnvironment;

  const HOST = 'host-uid';
  const GUEST = 'guest-uid';
  const OUTSIDER = 'outsider-uid';

  beforeAll(async () => {
    const [host, port] = (EMULATOR ?? '127.0.0.1:9000').split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-big-squiggle',
      database: {
        rules: readFileSync('database.rules.json', 'utf8'),
        host: host!,
        port: Number(port),
      },
    });
  });

  afterAll(async () => env?.cleanup());

  beforeEach(async () => {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await set(ref(ctx.database(), 'rooms/RAVEN'), {
        meta: {
          hostUid: HOST, status: 'lobby', roundId: 1, playerCount: 0,
          createdAt: 1000, lastActive: Date.now(),
        },
        players: {
          [HOST]: { name: 'Host', joinedAt: 10, ready: 0, briefed: 0 },
          [GUEST]: { name: 'Guest', joinedAt: 20, ready: 0, briefed: 0 },
        },
        online: { [HOST]: true, [GUEST]: true },
      });
    });
  });

  const as = (uid: string | null) =>
    (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();

  describe('lookup and membership', () => {
    it('lets a member read the whole room node, which is what the app subscribes to', async () => {
      // read permission does not cascade upward: without a rule here the listener is
      // denied and the app hangs with no error at all
      await assertSucceeds(get(ref(as(GUEST), 'rooms/RAVEN')));
      await assertFails(get(ref(as(OUTSIDER), 'rooms/RAVEN')));
    });

    it('lets anyone read their own player row, so a joiner can tell if they are already in', async () => {
      await assertSucceeds(get(ref(as(OUTSIDER), `rooms/RAVEN/players/${OUTSIDER}`)));
      await assertFails(get(ref(as(OUTSIDER), `rooms/RAVEN/players/${GUEST}`)));
    });

    it('lets any signed-in user read meta, so a room can be found before joining', async () => {
      await assertSucceeds(get(ref(as(OUTSIDER), 'rooms/RAVEN/meta')));
    });

    it('refuses meta to a signed-out visitor', async () => {
      await assertFails(get(ref(as(null), 'rooms/RAVEN/meta')));
    });

    it('hides the roster from a non-member', async () => {
      await assertFails(get(ref(as(OUTSIDER), 'rooms/RAVEN/players')));
      await assertSucceeds(get(ref(as(GUEST), 'rooms/RAVEN/players')));
    });
  });

  describe('player rows', () => {
    it('lets a player write only their own row', async () => {
      await assertSucceeds(update(ref(as(GUEST), `rooms/RAVEN/players/${GUEST}`), { ready: 1 }));
      await assertFails(update(ref(as(GUEST), `rooms/RAVEN/players/${HOST}`), { ready: 1 }));
    });

    it('rejects an empty or oversized name', async () => {
      const row = ref(as(OUTSIDER), `rooms/RAVEN/players/${OUTSIDER}`);
      await assertFails(set(row, { name: '', joinedAt: 1 }));
      await assertFails(set(row, { name: 'x'.repeat(25), joinedAt: 1 }));
      await assertSucceeds(set(row, { name: 'Ok', joinedAt: 1 }));
    });

    it('rejects fields the game does not define', async () => {
      await assertFails(
        update(ref(as(GUEST), `rooms/RAVEN/players/${GUEST}`), { isWinner: true }),
      );
    });
  });

  describe('seats', () => {
    it('is the host who deals them', async () => {
      await assertSucceeds(set(ref(as(HOST), 'rooms/RAVEN/seats'), { [HOST]: 0, [GUEST]: 1 }));
    });

    it('stops a player choosing their own', async () => {
      await assertFails(set(ref(as(GUEST), `rooms/RAVEN/seats/${GUEST}`), 0));
    });

    it('keeps a seat inside the playable range', async () => {
      await assertFails(set(ref(as(HOST), 'rooms/RAVEN/seats'), { [HOST]: 9 }));
    });
  });

  describe('room state', () => {
    it('lets the host move the room through the lifecycle', async () => {
      await assertSucceeds(update(ref(as(HOST), 'rooms/RAVEN/meta'), { status: 'briefing' }));
    });

    it('stops a guest starting the game', async () => {
      await assertFails(update(ref(as(GUEST), 'rooms/RAVEN/meta'), { status: 'briefing' }));
    });

    it('rejects a status the game does not have', async () => {
      await assertFails(update(ref(as(HOST), 'rooms/RAVEN/meta'), { status: 'chaos' }));
    });

    it('lets any member declare a win, but only out of play', async () => {
      await assertFails(update(ref(as(GUEST), 'rooms/RAVEN/meta'), { status: 'won' }));

      await env.withSecurityRulesDisabled(async (ctx) => {
        await set(ref(ctx.database(), 'rooms/RAVEN/meta/status'), 'playing');
      });
      await assertSucceeds(set(ref(as(GUEST), 'rooms/RAVEN/meta/status'), 'won'));
    });

    it('lets a member keep the room alive', async () => {
      await assertSucceeds(set(ref(as(GUEST), 'rooms/RAVEN/meta/lastActive'), Date.now()));
      await assertFails(set(ref(as(OUTSIDER), 'rooms/RAVEN/meta/lastActive'), Date.now()));
    });
  });

  describe('host migration', () => {
    it('refuses while the host is still online', async () => {
      await assertFails(set(ref(as(GUEST), 'rooms/RAVEN/meta/hostUid'), GUEST));
    });

    it('allows a member to take over once the host has dropped', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await set(ref(ctx.database(), `rooms/RAVEN/online/${HOST}`), null);
      });
      await assertSucceeds(set(ref(as(GUEST), 'rooms/RAVEN/meta/hostUid'), GUEST));
    });

    it('never lets someone install a different player as host', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await set(ref(ctx.database(), `rooms/RAVEN/online/${HOST}`), null);
      });
      await assertFails(set(ref(as(GUEST), 'rooms/RAVEN/meta/hostUid'), OUTSIDER));
    });
  });

  describe('reclaiming a stale room', () => {
    it('refuses to overwrite a room that is still alive', async () => {
      await assertFails(
        set(ref(as(OUTSIDER), 'rooms/RAVEN/meta'), {
          hostUid: OUTSIDER, status: 'lobby', roundId: 1, lastActive: Date.now(),
        }),
      );
    });

    it('hands over a room idle for more than a day', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await set(ref(ctx.database(), 'rooms/RAVEN/meta/lastActive'), Date.now() - 25 * 3600 * 1000);
      });
      await assertSucceeds(
        set(ref(as(OUTSIDER), 'rooms/RAVEN/meta'), {
          hostUid: OUTSIDER, status: 'lobby', roundId: 1, lastActive: Date.now(),
        }),
      );
    });

    it('lets the new host clear the old table but not rewrite it', async () => {
      await assertSucceeds(set(ref(as(HOST), 'rooms/RAVEN/players'), null));
      await assertFails(
        set(ref(as(HOST), 'rooms/RAVEN/players'), { [OUTSIDER]: { name: 'Puppet', joinedAt: 1 } }),
      );
    });
  });

  describe('live hold state', () => {
    it('is written only by its owner, and only in the shape the game reads', async () => {
      const mine = ref(as(GUEST), `rooms/RAVEN/live/${GUEST}`);
      await assertSucceeds(set(mine, { holding: true, correct: false, heldSince: 123 }));
      await assertFails(set(mine, { holding: 'yes' }));
      await assertFails(set(ref(as(GUEST), `rooms/RAVEN/live/${HOST}`), { holding: true }));
    });

    it('is readable by the table but not by outsiders', async () => {
      await assertSucceeds(get(ref(as(GUEST), 'rooms/RAVEN/live')));
      await assertFails(get(ref(as(OUTSIDER), 'rooms/RAVEN/live')));
    });
  });
});

describe('rules test harness', () => {
  it('reports whether it ran', () => {
    expect(EMULATOR ? 'ran against the emulator' : 'skipped — no emulator').toBeTruthy();
  });
});
