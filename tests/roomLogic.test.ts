import { describe, expect, it } from 'vitest';

import {
  allBriefed, assignSeats, canStart, deriveScreen, isMember, isStale, nextHost,
  onlineUids, puzzleKey, restrictionIndex, ROOM_TTL_MS, seatedUids,
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
  it('rotates restrictions with the round', () => {
    expect(restrictionIndex(0, 1)).not.toBe(restrictionIndex(0, 2));
    for (let seat = 0; seat < 8; seat++) {
      for (let round = 1; round < 10; round++) {
        const i = restrictionIndex(seat, round);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(3);
      }
    }
  });
  it('reseeds the deal per round', () => {
    expect(puzzleKey('RAVEN', 1)).not.toBe(puzzleKey('RAVEN', 2));
  });
});
