import { describe, expect, it } from 'vitest';

import {
  allBriefed, assignSeats, canStart, deriveScreen, elapsedMs, formatDuration, isMember,
  isNewBest, isStale, nextHost, roundGap, solveBadge,
  onlineUids, puzzleKey, restrictionsForRound, ROOM_TTL_MS, seatedUids, startBlocker,
  type RoomSnapshot,
} from '../src/roomLogic';

function room(over: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'RAVEN',
    meta: { hostUid: 'a', status: 'lobby', roundId: 1, playerCount: 0, createdAt: 0, lastActive: 1_000_000 },
    players: {
      a: { name: 'Ana', joinedAt: 10, ready: 1 },
      b: { name: 'Bo', joinedAt: 20, ready: 1 },
      c: { name: 'Cy', joinedAt: 30, ready: 1 },
    },
    seats: {},
    online: { a: true, b: true, c: true },
    live: {},
    ...over,
  };
}

describe('membership and presence', () => {
  it('treats a missing room or uid as not a member', () => {
    expect(isMember(null, 'a')).toBe(false);
    expect(isMember(room(), null)).toBe(false);
    expect(isMember(room(), 'zz')).toBe(false);
    expect(isMember(room(), 'a')).toBe(true);
  });

  it('orders present players by join time, then uid for ties', () => {
    expect(onlineUids(room())).toEqual(['a', 'b', 'c']);
    expect(onlineUids(room({ online: { a: true, c: true } }))).toEqual(['a', 'c']);
    const tied = room({
      players: { y: { name: 'Y', joinedAt: 5 }, x: { name: 'X', joinedAt: 5 } },
      online: { x: true, y: true },
    });
    expect(onlineUids(tied)).toEqual(['x', 'y']);
  });
});

describe('starting a round', () => {
  it('needs the host, a lobby, and everyone present ready', () => {
    expect(canStart(room(), 'a')).toBe(true);
    expect(canStart(room(), 'b')).toBe(false);
    expect(canStart(room({ meta: { ...room().meta, status: 'playing' } }), 'a')).toBe(false);
  });

  it('refuses below two players and above eight', () => {
    const solo = room({ players: { a: { name: 'Ana', joinedAt: 10, ready: 1 } }, online: { a: true } });
    expect(canStart(solo, 'a')).toBe(false);

    const players: RoomSnapshot['players'] = {};
    const online: RoomSnapshot['online'] = {};
    for (let i = 0; i < 9; i++) {
      players['p' + i] = { name: 'P' + i, joinedAt: i, ready: 1 };
      online['p' + i] = true;
    }
    expect(canStart(room({ meta: { ...room().meta, hostUid: 'p0' }, players, online }), 'p0')).toBe(false);
  });

  it('ignores a ready flag left over from an earlier round', () => {
    const stale = room({ meta: { ...room().meta, roundId: 2 } });
    expect(canStart(stale, 'a')).toBe(false);
  });

  it('does not wait on players who are offline', () => {
    const r = room({
      players: { ...room().players, d: { name: 'Dee', joinedAt: 40 } },
      online: { a: true, b: true, c: true },
    });
    expect(canStart(r, 'a')).toBe(true);
  });
});

describe('seats', () => {
  it('hands out one seat per present player, in join order', () => {
    expect(assignSeats(room())).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('skips absent players entirely', () => {
    expect(assignSeats(room({ online: { a: true, c: true } }))).toEqual({ a: 0, c: 1 });
  });

  it('never gives two players the same seat', () => {
    const seats = Object.values(assignSeats(room()));
    expect(new Set(seats).size).toBe(seats.length);
  });

  it('reads back in seat order and drops seats whose player has gone', () => {
    const r = room({ seats: { c: 2, a: 0, b: 1 } });
    expect(seatedUids(r)).toEqual(['a', 'b', 'c']);
    expect(seatedUids(room({ seats: { a: 0, ghost: 1 } }))).toEqual(['a']);
  });
});

describe('briefing gate', () => {
  it('opens only once every seated player has acknowledged this round', () => {
    const seats = { a: 0, b: 1 };
    expect(allBriefed(room({ seats }))).toBe(false);
    expect(allBriefed(room({
      seats,
      players: { ...room().players, a: { name: 'Ana', joinedAt: 10, briefed: 1 } },
    }))).toBe(false);
    expect(allBriefed(room({
      seats,
      players: {
        a: { name: 'Ana', joinedAt: 10, briefed: 1 },
        b: { name: 'Bo', joinedAt: 20, briefed: 1 },
        c: { name: 'Cy', joinedAt: 30 },
      },
    }))).toBe(true);
  });

  it('is never satisfied by an empty table', () => {
    expect(allBriefed(room({ seats: {} }))).toBe(false);
  });

  it('ignores an acknowledgement from a previous round', () => {
    const r = room({
      meta: { ...room().meta, roundId: 2 },
      seats: { a: 0, b: 1 },
      players: {
        a: { name: 'Ana', joinedAt: 10, briefed: 1 },
        b: { name: 'Bo', joinedAt: 20, briefed: 2 },
      },
    });
    expect(allBriefed(r)).toBe(false);
  });
});

describe('screen routing', () => {
  it('sends non-members home', () => {
    expect(deriveScreen(null, 'a')).toBe('home');
    expect(deriveScreen(room(), 'zz')).toBe('home');
  });

  it('follows room status', () => {
    expect(deriveScreen(room(), 'a')).toBe('lobby');
    expect(deriveScreen(room({ meta: { ...room().meta, status: 'briefing' } }), 'a')).toBe('brief');
  });

  it('puts a seated player on the board and an unseated one in the lobby', () => {
    const playing = { ...room().meta, status: 'playing' as const };
    expect(deriveScreen(room({ meta: playing, seats: { a: 0 } }), 'a')).toBe('play');
    expect(deriveScreen(room({ meta: playing, seats: { a: 0 } }), 'b')).toBe('lobby');
  });

  it('keeps a winner on the board so they can see the result', () => {
    const won = { ...room().meta, status: 'won' as const };
    expect(deriveScreen(room({ meta: won, seats: { a: 0 } }), 'a')).toBe('play');
  });
});

describe('room reclamation', () => {
  const now = 1_000_000_000;
  it('treats a missing room as claimable', () => {
    expect(isStale(null, now)).toBe(true);
  });
  it('protects a room touched within the day', () => {
    expect(isStale({ lastActive: now - 60_000 }, now)).toBe(false);
    expect(isStale({ lastActive: now - ROOM_TTL_MS + 1000 }, now)).toBe(false);
  });
  it('releases a room idle for longer', () => {
    expect(isStale({ lastActive: now - ROOM_TTL_MS - 1 }, now)).toBe(true);
    expect(isStale({ lastActive: 0 }, now)).toBe(true);
  });
});

describe('host migration', () => {
  it('leaves an online host alone', () => {
    expect(nextHost(room())).toBe('a');
  });
  it('promotes the longest-present player when the host drops', () => {
    expect(nextHost(room({ online: { b: true, c: true } }))).toBe('b');
  });
  it('returns nobody when the room has emptied', () => {
    expect(nextHost(room({ online: {} }))).toBe(null);
  });
});

describe('round derivation', () => {
  it('never deals sound-off to a table of two', () => {
    // with one other person on the call, a player who cannot hear has no way back in
    for (let round = 1; round <= 40; round++) {
      const hand = restrictionsForRound('RAVEN', round, 2);
      expect(hand).toHaveLength(2);
      expect(hand).not.toContain(2);
      expect([...hand].sort()).toEqual([0, 1]);
    }
  });

  it('swaps which of the two carries which handicap', () => {
    const hands = new Set<string>();
    for (let round = 1; round <= 40; round++) hands.add(restrictionsForRound('RAVEN', round, 2).join(''));
    expect(hands).toEqual(new Set(['01', '10']));
  });

  it('spreads all three as evenly as the headcount allows', () => {
    for (let players = 3; players <= 8; players++) {
      const hand = restrictionsForRound('RAVEN', 1, players);
      expect(hand).toHaveLength(players);

      const counts = [0, 1, 2].map((k) => hand.filter((r) => r === k).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(counts.every((c) => c >= 1)).toBe(true);
    }
  });

  it('deals the same hand on every device', () => {
    expect(restrictionsForRound('RAVEN', 3, 5)).toEqual(restrictionsForRound('RAVEN', 3, 5));
  });

  it('reshuffles between rounds rather than pinning a seat to a restriction', () => {
    const hands = new Set<string>();
    for (let round = 1; round <= 20; round++) hands.add(restrictionsForRound('RAVEN', round, 4).join(''));
    expect(hands.size).toBeGreaterThan(1);
  });

  it('deals differently in different rooms', () => {
    const hands = new Set(
      ['RAVEN', 'EMBER', 'COMET', 'SABLE', 'HARBOR'].map((code) => restrictionsForRound(code, 1, 4).join('')),
    );
    expect(hands.size).toBeGreaterThan(1);
  });

  it('keeps every seat inside the restriction set', () => {
    for (let players = 2; players <= 8; players++) {
      for (const r of restrictionsForRound('RAVEN', 1, players)) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(players < 3 ? 2 : 3);
      }
    }
  });

  it('reseeds the deal per round', () => {
    expect(puzzleKey('RAVEN', 1)).not.toBe(puzzleKey('RAVEN', 2));
  });
});

describe('why start is locked', () => {
  it('says nothing when the table is good to go', () => {
    expect(startBlocker(room({ seats: {} }))).toBe(null);
  });

  it('names a disconnected player rather than blaming the headcount', () => {
    // the reported bug: two players, both showing ready, one silently not present
    const r = room({
      players: {
        a: { name: 'Ana', joinedAt: 10, ready: 1 },
        b: { name: 'Bo', joinedAt: 20, ready: 1 },
      },
      online: { a: true },
    });
    expect(startBlocker(r)).toEqual({ kind: 'offline', count: 1 });
  });

  it('lets the rest start without someone who dropped, once enough remain', () => {
    const r = room({ online: { a: true, b: true } });
    expect(startBlocker(r)).toBe(null);
    expect(canStart(r, 'a')).toBe(true);
  });

  it('reports too few only when nobody is missing', () => {
    const solo = room({
      players: { a: { name: 'Ana', joinedAt: 10, ready: 1 } },
      online: { a: true },
    });
    expect(startBlocker(solo)).toEqual({ kind: 'too-few' });
  });

  it('counts who has not readied', () => {
    const r = room({
      players: {
        a: { name: 'Ana', joinedAt: 10, ready: 1 },
        b: { name: 'Bo', joinedAt: 20 },
        c: { name: 'Cy', joinedAt: 30 },
      },
    });
    expect(startBlocker(r)).toEqual({ kind: 'not-ready', count: 2 });
  });

  it('flags an oversized table first', () => {
    const players: RoomSnapshot['players'] = {};
    const online: RoomSnapshot['online'] = {};
    for (let i = 0; i < 9; i++) {
      players['p' + i] = { name: 'P' + i, joinedAt: i, ready: 1 };
      online['p' + i] = true;
    }
    expect(startBlocker(room({ players, online }))).toEqual({ kind: 'too-many' });
  });

  it('agrees with canStart in every case', () => {
    const good = room({ seats: {} });
    expect(startBlocker(good)).toBe(null);
    expect(canStart(good, 'a')).toBe(true);

    const dropped = room({
      players: {
        a: { name: 'Ana', joinedAt: 10, ready: 1 },
        b: { name: 'Bo', joinedAt: 20, ready: 1 },
      },
      online: { a: true },
    });
    expect(startBlocker(dropped)).not.toBe(null);
    expect(canStart(dropped, 'a')).toBe(false);
  });
});

describe('the clock', () => {
  const meta = (over: Partial<RoomSnapshot['meta']> = {}) => ({ ...room().meta, ...over });

  it('shows nothing before the board goes live', () => {
    expect(elapsedMs(meta(), 5000)).toBe(null);
  });

  it('counts from the moment play started', () => {
    expect(elapsedMs(meta({ playStartedAt: 1000 }), 4500)).toBe(3500);
  });

  it('freezes at the solve, so every device reports the same time', () => {
    const m = meta({ playStartedAt: 1000, solvedAt: 61_000 });
    expect(elapsedMs(m, 999_999)).toBe(60_000);
  });

  it('uses the local solve moment until the write lands', () => {
    expect(elapsedMs(meta({ playStartedAt: 1000 }), 999_999, 4000)).toBe(3000);
    // once recorded, the shared value wins over the local guess
    expect(elapsedMs(meta({ playStartedAt: 1000, solvedAt: 5000 }), 999_999, 9999)).toBe(4000);
  });

  it('never runs backwards on a clock correction', () => {
    expect(elapsedMs(meta({ playStartedAt: 9000 }), 1000)).toBe(0);
  });

  it('formats as minutes and padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(600_000)).toBe('10:00');
    expect(formatDuration(-50)).toBe('0:00');
  });

  it('treats any time as a best when there is none yet', () => {
    expect(isNewBest(4000, undefined)).toBe(true);
    expect(isNewBest(4000, 5000)).toBe(true);
    expect(isNewBest(5000, 4000)).toBe(false);
    expect(isNewBest(4000, 4000)).toBe(false);
  });
});

describe('what the win panel says about the clock', () => {
  it('calls a first solve a record', () => {
    // the bug this exists for: reading the room's best back after the solve was written
    // compares the time against itself, and nothing is ever a record
    expect(solveBadge(39_000, true, undefined, 39_000)).toEqual({ time: 39_000, beat: true, compareTo: undefined });
  });

  it('names the mark it beat', () => {
    expect(solveBadge(30_000, true, 45_000, 30_000)).toEqual({ time: 30_000, beat: true, compareTo: 45_000 });
  });

  it('shows the mark still to beat when the round was slower', () => {
    expect(solveBadge(50_000, true, 30_000, 30_000)).toEqual({ time: 50_000, beat: false, compareTo: 30_000 });
  });

  it('claims nothing on a device that did not watch the solve', () => {
    // after a refresh there is no before-picture, so it shows the time plainly
    expect(solveBadge(39_000, false, undefined, 39_000)).toEqual({ time: 39_000, beat: false, compareTo: undefined });
  });

  it('does not offer a comparison against a slower record', () => {
    expect(solveBadge(20_000, false, undefined, 45_000).compareTo).toBe(undefined);
  });

  it('says nothing at all before the board has run', () => {
    expect(solveBadge(null, true, 1000, 1000)).toEqual({ time: null, beat: false });
  });
});

describe('spotting a hole in the round', () => {
  const playing = (over: Partial<RoomSnapshot> = {}) =>
    room({ meta: { ...room().meta, status: 'playing', playerCount: 3 }, seats: { a: 0, b: 1, c: 2 }, ...over });

  it('says nothing while the table is whole', () => {
    expect(roundGap(playing())).toBe(null);
  });

  it('says nothing in the lobby, where leaving is normal', () => {
    expect(roundGap(room({ seats: { a: 0, b: 1, c: 2 }, online: { a: true } }))).toBe(null);
  });

  it('counts someone who left the room outright', () => {
    const r = playing({
      players: { a: { name: 'Ana', joinedAt: 10 }, b: { name: 'Bo', joinedAt: 20 } },
      online: { a: true, b: true },
    });
    expect(roundGap(r)).toEqual({ missing: 1, left: 1, away: 0 });
  });

  it('counts someone who merely dropped off, separately', () => {
    expect(roundGap(playing({ online: { a: true, b: true } }))).toEqual({ missing: 1, left: 0, away: 1 });
  });

  it('adds both kinds of absence together', () => {
    const r = playing({
      players: { a: { name: 'Ana', joinedAt: 10 }, b: { name: 'Bo', joinedAt: 20 } },
      online: { a: true },
    });
    expect(roundGap(r)).toEqual({ missing: 2, left: 1, away: 1 });
  });

  it('clears itself once they reconnect', () => {
    const away = playing({ online: { a: true, b: true } });
    expect(roundGap(away)).not.toBe(null);
    expect(roundGap(playing())).toBe(null);
  });

  it('watches the briefing too, where the gate would never open', () => {
    const r = playing({ meta: { ...room().meta, status: 'briefing', playerCount: 3 }, online: { a: true, b: true } });
    expect(roundGap(r)?.away).toBe(1);
  });
});
