# Big Squiggle — Firebase + WebRTC build-out

## Where the game is today

`index.html` is one self-contained page. Every device derives the same puzzle from a
shared token (`RAVEN-5`) through a seeded PRNG, so no server is needed and no traffic
leaves the browser. That is what made the prototype possible in a single file, and it
is also the source of all three problems we want to fix.

| Friction today | Root cause |
| --- | --- |
| Setup is a ritual: everyone types the same token, picks a player count that must match, and hopes no two people grabbed seat 3. | There is no shared room. "Same game" is an agreement between humans, not a fact the app knows. |
| Nobody knows when the table has won. Each player only sees their own verdict and has to say so out loud — which, under the restrictions, is the hard part. | The win condition is evaluated per-device against a locally computed answer. |
| The restrictions are honour-system, and the call is somewhere else (Zoom, Meet). | The app does not own the media, so it can neither apply a restriction nor prove it is being held. |
| The answer is in the page. Anyone who opens devtools wins. | The deal and the grading both run client-side. |

The build-out is the same game with the room, the grading, and the call moved into
the app.

## Target architecture

> **Superseded for Phases 1 and 2.** Choosing a client-derived puzzle over Cloud
> Functions removed the reason to run Firestore alongside RTDB, so those phases are
> Spark-tier only: anonymous Auth, Realtime Database, Hosting. The concrete build is in
> [PHASE-1-2.md](PHASE-1-2.md); the sketch below is what we would build instead if
> cheat-resistance ever outranks the zero-dollar constraint.

The server-authoritative version splits the game's state three ways: **Firestore** for
rooms, players, rounds and per-player deals; **Realtime Database** for presence and
WebRTC signalling; **Cloud Functions** for anything a cheating client must not be able to
do — dealing the puzzle, holding the answer, deciding a win.

The trick that makes it work is splitting `rounds/{id}/deals/{uid}`, readable only by
that player and carrying just the positions they are given, from `answers/{roomId}_{roundId}`,
which no client rule grants read on at all. A player subscribes to exactly the fragment
they are supposed to hold, and the full sequence exists only where a Function can see it.

That upgrade costs a Blaze plan (a card on file, though the 2M free invocations/month
means a game like this bills nothing) and closes both holes at once: the answer leaves
the browser, and per-player correctness stops being public.

## Fixing the three frictions

### 1. Setup becomes a link

Host taps **Create room** → anonymous auth → a Function mints a room with a code and
returns `/r/RAVEN`. That link is the whole invite. Joiners land in the lobby, get a seat
assigned by transaction (no collisions, no player-count agreement), and see a live
roster with presence dots. The host presses **Start** when the roster looks right, and
`seatCount` is simply however many people are in the room — the `countInput` field
disappears from the UI entirely.

Restrictions are dealt server-side at round start and delivered per player, so nobody
can see anyone else's, and they can be reshuffled between rounds for free.

### 2. "Everyone has won" becomes a fact

Each client calls `submitSequence(roomId, roundId, sequence)`. The Function compares it
to `answers/*` and writes only a boolean into `progress[uid]`. Two consequences:

- The lobby shows **"4 of 5 locked in"** live — real tension, zero information leak.
- When the last player locks in correctly, the Function flips `rounds/{id}.status = won`
  and every board fires the confetti in the same second. That moment is currently the
  weakest part of the game and it becomes the best part.

Misses stay private to the player who made them, exactly as they are today. The five
second grading delay can stay as UI texture, but the verdict now arrives from the room.

### 3. The call moves in-app, and the restrictions become real

Mesh WebRTC, full peer-to-peer, signalling over RTDB at
`signals/{roomId}/{toUid}/{fromUid}` (offer / answer / ICE candidates, deleted on
consume). At the table sizes this game is built for (2–8) a mesh is the right call:
no media server, no per-minute cost, lowest latency.

The restrictions stop being instructions and become the media pipeline:

| Restriction | Enforcement |
| --- | --- |
| Camera off | Never add a video track to the outbound stream. Others literally cannot see you. |
| Microphone off | Never add an audio track. |
| Sound off | Do not attach remote audio to any sink. You can be seen and heard; you hear nothing. |

Because the app owns the peer connection, the restriction is a property of the
connection rather than a promise. It also lets us do things the honour system cannot:
a restriction that starts mid-round, one that rotates every 60 seconds, or an
asymmetric one ("you can hear seat 2 only").

**The one thing Firebase does not give us is TURN.** Roughly 10–15% of participants sit
behind NATs that need a relay, and without one those players silently fail to connect —
no error, no message, just a black tile. It is not optional, but it is free:

1. **Cloudflare Realtime TURN** — 1,000 GB of free allowance before any charge, then
   $0.05/GB, and only relayed connections consume it. A twenty-minute five-player round
   with one relayed player is well under a gigabyte. Credentials are short-lived tokens
   minted server-side.
2. **Self-hosted coturn on Oracle Always Free** — 10 TB/month egress at genuinely zero
   cost. Real $0 with real ops burden, and Oracle has been trimming the tier. The escape
   hatch, not the starting point.
3. **An SFU** (Cloudflare Realtime, LiveKit, Daily) bundles TURN — with every peer
   connecting to the media server anyway, the NAT problem disappears as a side effect.

Cloudflare's TURN is free of charge when paired with their SFU, and traffic between the
two is not billed at all. That collapses the mesh-vs-SFU decision from architectural to a
config flag: same vendor, same allowance, so build mesh first and switch if table sizes
grow. Cheapest on the allowance is mesh (only the ~10–15% who relay consume it); kindest
to a laptop is the SFU (one upstream instead of seven).

Mesh above 6 players is where this gets uncomfortable — 7 outbound video encodes on a
laptop. If we want 8-player tables to feel good, plan on the SFU from the start of
Phase 3 rather than retrofitting.

## Phasing

**Phase 0 — Make it a project. _(done)_** The single file is now ES modules under
`src/`, built by Vite, typechecked under `strict`, and tested by Vitest. CI typechecks,
tests and builds on every push, and deploys to Firebase Hosting from `main` as soon as
the project secrets exist. No behaviour changed: `tests/golden.json` pins the deal,
the plate order and the rendered SVG against fixtures captured from the pre-refactor
build, so a future refactor cannot silently change what a game code deals.

**Phase 1 — Rooms.** Anonymous auth, create/join by code, presence, live roster, named
players, host-controlled start, and server-assigned seats. The puzzle stays client-derived.
Ship this alone and setup friction is already gone.

**Phase 2 — Shared validation.** The five-second per-device check is replaced by a
hold-to-validate that only resolves while every player is holding, with an anonymous
indicator of how many are down. This is the phase that fixes the actual game.

Both are specified in full in [PHASE-1-2.md](PHASE-1-2.md).

**Phase 3 — The call.** Mesh WebRTC with RTDB signalling, TURN credentials from a
Function, restrictions applied at the track level, a video strip in the play view,
reconnect handling. Decide mesh vs. SFU at the top of this phase based on the table
size we actually care about.

**Phase 4 — The things that only become possible now.** Round history, rematch with the
same table, rotating restrictions, spectators, a per-room leaderboard, and analytics on
which glyph pairs actually fool people — the last one is how the glyph set gets better.

Each phase leaves a game that is strictly better than the one before it, and Phase 1
alone is worth shipping on its own.

## Costs and risks

Free tier covers this comfortably: a 5-player 20-minute session is a few hundred
Firestore reads, a few dozen writes, and maybe 200 RTDB messages. The only real spend is
TURN relay, and only for the connections that need it.

Risks worth naming now:

- **TURN is not optional**, though it is free at this scale. Wire it in Phase 3 or a
  fraction of players get a black screen with no explanation.
- **Mesh scaling.** See above — 8-player mesh video is rough.
- **Anonymous auth and reconnects.** A refresh must return you to your seat, not spawn a
  ghost player. Persist the anon uid and make `joinRoom` idempotent on it.
- **Abandoned rooms.** A scheduled Function should reap rooms idle for 24h, or the code
  space fills with dead games.
- **Keeping the game playable offline.** The deterministic local mode is genuinely nice
  for testing and for a table that just wants to play without accounts. Keep it behind
  a flag rather than deleting it.
