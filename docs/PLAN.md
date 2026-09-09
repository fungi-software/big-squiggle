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

```
┌─────────────── browser ───────────────┐
│  UI (unchanged game surface)          │
│  ├─ room store   ← Firestore listener │
│  ├─ private deal ← Firestore listener │
│  ├─ presence     ↔ RTDB + onDisconnect│
│  └─ call         ↔ RTCPeerConnection  │
│                     signaling ↔ RTDB  │
└───────────────────────────────────────┘
              │ callable fns
┌─────────────▼─────────────────────────┐
│ Cloud Functions                        │
│  createRoom · joinRoom · startRound    │
│  submitSequence (the only grader)      │
│  (answers live in a collection no      │
│   client rule ever grants read on)     │
└────────────────────────────────────────┘
```

**Firestore** for the durable, structured state a listener should reflect: rooms,
players, rounds, per-player private deals, submissions.
**Realtime Database** for the two things it is strictly better at: presence
(`onDisconnect` is native and instant) and WebRTC signalling (high-churn, disposable,
sub-100ms).
**Cloud Functions** for anything a cheating client must not be able to do: dealing the
puzzle, holding the answer, deciding a win.

### Data model

```
rooms/{roomId}
  code: "RAVEN"            // human-shareable, indexed, recycled after 24h idle
  hostUid, createdAt, status: lobby|briefing|playing|won
  seatCount, roundId

rooms/{roomId}/players/{uid}
  displayName, seat, restriction: camera|mic|sound
  ready: bool, joinedAt, lastSeen

rooms/{roomId}/rounds/{roundId}
  status, slots, plate: [glyphId]      // public: the shared tile plate
  startedAt, solvedAt
  progress: { uid: "locked"|"open" }   // count only — never the sequences

rooms/{roomId}/rounds/{roundId}/deals/{uid}      // rules: read only if uid == auth.uid
  pinned: { slotIndex: glyphId }       // the positions this player is given
  plateOrder: [glyphId]

answers/{roomId}_{roundId}             // rules: no client read, no client write
  answer: [glyphId]
```

Splitting `deals/{uid}` from `answers/*` is the whole trick: a player can subscribe to
exactly the fragment they are supposed to hold, and the full sequence exists only where
a Function can see it.

### Security rules, in one line each

- A player reads a room only while they hold a `players/{uid}` doc in it.
- A player reads only their own `deals/{uid}`.
- Nobody reads `answers/*`. Ever. Functions use the Admin SDK.
- Clients never write `rounds/*` or `progress` — only Functions do, via `submitSequence`.
- Seat claims go through `joinRoom`, so a transaction — not two clients racing on a write.

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
behind NATs that need a relay, and without one those players silently fail to connect.
Options, in the order I would try them:

1. **Cloudflare Calls / Twilio Network Traversal** — managed TURN credentials fetched
   from a Function that keeps the secret server-side. ~$0.40–0.60/GB relayed, and only
   the minority of connections relay.
2. **Self-hosted coturn** on a small VM — a few dollars a month, more ops.
3. **Skip mesh entirely for larger tables** — an SFU (LiveKit Cloud, Daily) includes
   TURN, drops the upstream cost from N-1 streams to 1, and gives per-track server-side
   mute that makes restrictions tamper-proof rather than merely app-enforced. Worth it
   above ~6 players; overkill below.

Mesh above 6 players is where this gets uncomfortable — 7 outbound video encodes on a
laptop. If we want 8-player tables to feel good, plan on the SFU from the start of
Phase 3 rather than retrofitting.

## Phasing

**Phase 0 — Make it a project.** Split the single file into ES modules (`glyphs.js`,
`puzzle.js`, `ui.js`, `state.js`), add Vite, TypeScript, and Firebase Hosting with a
GitHub Action on `main`. No behaviour change; the game still runs fully local. This is
the phase that makes every later phase cheap, and it is worth doing before anything else.

**Phase 1 — Rooms.** Anonymous auth, `createRoom` / `joinRoom`, presence, live roster,
share link, host-controlled start. The puzzle is still derived client-side from the room
id, so nothing about grading changes yet. Ship this alone and setup friction is already
gone.

**Phase 2 — Server-authoritative rounds.** Move the deal into `startRound`, add
`deals/{uid}` and `answers/*`, replace local grading with `submitSequence`, add the
live lock-in counter and the synchronized win. This is the phase that fixes the actual
game.

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

- **TURN is not optional.** Budget for it in Phase 3 or a fraction of players get a
  black screen with no explanation.
- **Mesh scaling.** See above — 8-player mesh video is rough.
- **Anonymous auth and reconnects.** A refresh must return you to your seat, not spawn a
  ghost player. Persist the anon uid and make `joinRoom` idempotent on it.
- **Abandoned rooms.** A scheduled Function should reap rooms idle for 24h, or the code
  space fills with dead games.
- **Keeping the game playable offline.** The deterministic local mode is genuinely nice
  for testing and for a table that just wants to play without accounts. Keep it behind
  a flag rather than deleting it.
