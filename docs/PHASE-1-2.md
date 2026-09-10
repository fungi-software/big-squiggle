# Phases 1 & 2 — rooms, and validation the whole table has to agree on

Concrete build plan for the two phases that turn Big Squiggle from a token everyone
types into a real shared room. Phase 3 (the in-app call) is unchanged and still lives
in [PLAN.md](PLAN.md).

## The four decisions this is built on

| Decision | Consequence |
| --- | --- |
| **Puzzle stays client-derived.** No Cloud Functions, no Blaze plan, no card on file. | Everything runs on the Spark free tier forever. The answer remains in the page — cheating is possible and we accept it, the same way the no-chat rule is accepted. |
| **A miss tells the table nothing.** No attribution, no counts. | Every attempt is expensive, which is the point. Also means a miss needs *zero* writes — it is derived identically on each device and never recorded. |
| **Hold ~2s, everyone down together.** Any release resets the charge. | Coordinating the press is a second puzzle layered on the first, and it is hardest for exactly the player whose restriction bites most. |
| **Anonymous indicator — a count, never identities.** | Keeps the press/release channel low-bandwidth. It is still a channel; see [Known holes](#known-holes). |

## Stack: Spark tier only

**Firebase Auth** (anonymous) · **Realtime Database** · **Hosting**. That is the whole
list, and all three are free with no payment method.

The plan previously split Firestore (structured state) and RTDB (presence, signalling).
Dropping Cloud Functions removes the reason for that split:

- Nothing needs querying. A room is fetched by its code, which is a key.
- Nothing needs indexes, collection groups, or transactions across documents.
- The one hard requirement — **a player who closes their laptop mid-hold must not leave
  `holding: true` stuck forever** — is `onDisconnect()`, which only RTDB has.

So: one database, one rules language, one listener per room. Firestore comes back only
if Phase 4 wants real history and leaderboards.

The Firebase web config (apiKey and friends) is public by design and gets committed.
Security comes from the rules below, never from hiding that key.

## Data model

```
/rooms/{CODE}
  meta/
    hostUid, createdAt, lastActive
    status:      lobby | briefing | playing | won
    roundId:     1, 2, 3 …       ← re-seeds the deal, rotates restrictions
    playerCount: frozen when the round starts
  players/{uid}/    { name, joinedAt, ready, briefed }     ← self-write
  seats/{uid}:      <seat number>                          ← host-write, one atomic update
  online/{uid}:     true                                   ← self-write + onDisconnect remove
  live/{uid}/       { holding, correct, heldSince }        ← self-write + onDisconnect remove
```

Two deliberate splits:

**`seats` is separate from `players`** because RTDB rules cascade — a rule granting a
player write access to their own `players/{uid}` node cannot then carve out a child they
may not touch. Seats live in their own node, written as one atomic map rather than
per-player, so a round is dealt in a single indivisible move.

Any member may deal a round, not just the host: waiting on one person to notice the
rematch button is a poor way to end a game. That does mean a determined player could
write themselves a chosen seat — but the answer already sits in their page, so this
guards nothing that was not already open. If grading ever moves into a Function, seat
assignment goes back behind it.

**`live` is separate from `players`** because it churns and `players` does not. It is
also the only node wired to `onDisconnect`, so a dropped connection clears a hold and a
presence flag without touching anyone's name or ready state.

`{CODE}` is the room id. No `/codes → roomId` indirection: the code is the human handle
and the key, and re-use is handled by the stale-claim transaction below.

The deal is unchanged code — `buildPuzzle(CODE + '#' + roundId, playerCount)` — so a new
round is a new deal for free. Restrictions follow the seats in a fixed cycle —
`seat % 3`, so seat 1 is camera-off, seat 2 microphone-off, seat 3 sound-off, seat 4
camera-off again — and stay put between rounds, because a predictable spread is
something the table can reason about without discussing it.

## Security rules

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$code": {
        ".read": "auth != null && data.child('players').child(auth.uid).exists()",

        "meta": {
          ".read": "auth != null",
          ".write": "auth != null && (!data.exists()
                     || data.child('hostUid').val() === auth.uid
                     || data.child('lastActive').val() < now - 86400000)",
          ".validate": "newData.hasChildren(['hostUid','status','roundId','lastActive'])",
          "status": { ".validate": "newData.val().matches(/^(lobby|briefing|playing|won)$/)" },
          "roundId": { ".validate": "newData.isNumber() && newData.val() > 0" }
        },
        "players": {
          ".read": "auth != null && data.child(auth.uid).exists()",
          "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "newData.hasChildren(['name','joinedAt'])",
            "name": { ".validate": "newData.isString() && newData.val().length <= 24" }
          }
        },
        "seats": {
          ".read": "auth != null && root.child('rooms/'+$code+'/players/'+auth.uid).exists()",
          ".write": "auth != null && root.child('rooms/'+$code+'/meta/hostUid').val() === auth.uid"
        },
        "online":  { ".read": "auth != null",
                     "$uid": { ".write": "auth != null && auth.uid === $uid" } },
        "live": {
          ".read": "auth != null && root.child('rooms/'+$code+'/players/'+auth.uid).exists()",
          "$uid": {
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "newData.hasChildren(['holding'])"
          }
        }
      }
    }
  }
}
```

`meta` is world-readable to signed-in users on purpose: you have to be able to look a
room up before you are a member of it. Everything with a player's name or state in it
requires membership.

The `.read` on `$code` itself is not redundant with the child rules. **RTDB read
permission does not cascade upward**: the app subscribes to the whole room node, and
granting reads only on `meta`, `players` and the rest denies that listener outright — the
screen simply never fills, with no error anywhere. The matching `.read` on `players/$uid`
is what lets someone check whether they are already in a room they have not joined.

**Rules cannot count children**, so the 2–8 player cap is client-side only. A person who
knows your code can flood the room. Accepted for a party game; a `playerCount`
transaction would close it if it ever matters.

## Lifecycle

```
        create ─┐
  join ─────────▶ lobby ──(host starts, all ready)──▶ briefing
                    ▲                                    │
                    │                            (all marked briefed)
                    │                                    ▼
                    └──(host: next round)──── won ◀── playing
                                                  (all hold 2s, all correct)
```

- **lobby** — anyone may join. Each player sets a name and toggles ready. The host's
  start control unlocks at ≥2 players, all ready.
- **briefing** — the host writes every seat in one atomic multi-path update, so seat
  collisions are structurally impossible rather than merely unlikely. Each player sees
  only their own restriction and marks themselves briefed; the last one to do so tips
  the room into playing. No host action here — matching the flow you described.
- **playing** — boards are live, hold-to-validate is armed.
- **won** — celebration; host can deal the next round (`roundId + 1`, back to briefing).

## Hold-to-validate, precisely

On `pointerdown`, a player writes `live/{uid} = { holding: true, correct: <local check>,
heldSince: serverTimestamp }`. On `pointerup`, `pointercancel`, or window blur, `holding`
goes false. `onDisconnect` clears it too, so a closed laptop cannot hold the button.

`correct` is computed locally by comparing the player's own draft to the derived answer.

Every client then evaluates the identical predicate against the identical data:

```ts
const HOLD_MS = 2000;

function attempt(seated: string[], live: Record<string, LiveRow>, serverNow: number) {
  const rows = seated.map((uid) => live[uid]);
  const down = rows.filter((r) => r?.holding);

  if (down.length !== seated.length) {
    return { phase: 'idle', down: down.length, progress: 0 };
  }
  // the last person to press sets the clock for everyone
  const newest = Math.max(...down.map((r) => r!.heldSince));
  const progress = Math.min(1, (serverNow - newest) / HOLD_MS);

  return progress < 1
    ? { phase: 'charging', down: down.length, progress }
    : { phase: 'resolved', down: down.length, progress: 1, won: down.every((r) => r!.correct) };
}
```

**Clock skew is the trap here.** `heldSince` is a server timestamp and `Date.now()` is
not, so the two are minutes apart on a badly-set laptop and the meter either fills
instantly or never. RTDB publishes the correction at `/.info/serverTimeOffset`; every
client uses `Date.now() + offset` and they all agree to within a round trip.

**A miss costs nothing.** Every client reaches `resolved / won: false` from the same
snapshot at the same moment, flashes the control, and forgets. Nothing is written, so
there is no record for anyone to inspect afterwards and no attribution to leak.

**A win is latched once.** Whichever client sees it first runs a transaction setting
`meta.status = 'won'`, guarded on the current value still being `playing` — idempotent,
so the race between five clients doing it simultaneously is harmless. Each client also
latches locally and celebrates immediately rather than waiting for the round trip.

Cost per attempt: two writes per player, of a three-field object. A twenty-attempt game
for five players is ~200 tiny writes.

## Minimal text

The current build explains itself in prose. It shouldn't. Target inventory:

| Screen | Content |
| --- | --- |
| **Home** | Wordmark. Name field. **Create**, or a code field and **Join**. Nothing else. |
| **Lobby** | The code, large and copyable. A chip per player — name, dimmed when offline, filled when ready. Your ready toggle. Host's start control. One quiet line for the no-chat rule, because that rule is the actual game. |
| **Briefing** | A single large icon — camera, mic, or speaker, struck through. Two-word label. **Ready**. Pips showing how many have acknowledged. |
| **Play** | Board and plate as they are today. Restriction reduced to a small struck-through icon in the corner — you already know what it means, you just accepted it. A wide hold pill at the bottom that fills while held, with a row of pips above it. |
| **Miss** | The pill shakes and returns to neutral. No words. |
| **Win** | Confetti, the answer row, and the host's next-round control. |

The pips are the whole indicator: one per player, lit when that player is down. Count
without identity, legible without a label.

## Phase 1 — rooms _(shipped)_

1. Firebase project, anonymous auth, RTDB, and the rules above; emulator wired into
   `npm run dev` so nothing during development touches the real project.
2. `src/firebase.ts` — app init, anon sign-in, db handle. `src/session.ts` — the local
   identity (uid persists in localStorage via the Auth SDK) and remembered name.
3. `src/room.ts` — create (stale-claim transaction on `meta`), join, leave, host
   migration when the host goes offline, `lastActive` touch.
4. `src/presence.ts` — `online/{uid}` with `onDisconnect`, plus the `serverTimeOffset`
   subscription Phase 2 needs.
5. Views: `home`, `lobby`, `brief`. The existing single-render switch grows a `screen`
   derived from membership and `meta.status`.
6. Seat assignment on start — one multi-path update. Restrictions derived, never stored.
7. `/r/{CODE}` routing via the History API; the Hosting rewrite is already in
   `firebase.json`.
8. Rules tests with `@firebase/rules-unit-testing` against the emulator: a non-member
   cannot read `players`, a player cannot write another's node or any seat, a stale room
   can be claimed and a live one cannot.

Ships: nobody types a matching token again. Grading is still the local five-second check.

## Phase 2 — shared validation _(shipped)_

1. `src/live.ts` — hold read/write, `onDisconnect`, and the `attempt()` predicate above.
2. Replace the five-second auto-check in `state.ts` with the hold control. `CHECK_MS`,
   the countdown ring and the per-device verdict all come out.
3. The hold pill, its fill, and the pips.
4. Win latch, the `status: won` transaction, and the miss flash.
5. Next round: `roundId + 1`, status back to briefing, drafts cleared, restrictions
   rotated.
6. Extend the golden tests to the new seeding (`CODE#roundId`) so a room's deal is
   still pinned, and unit-test `attempt()` hard — it is pure, and it is the only piece
   of logic where five devices must agree exactly.

Ships: the moment the plan set out to buy. Everyone learns together, at the same instant.

## Known holes

- **`correct` is readable by other players.** It has to be published for anyone to know
  the table agrees, and on Spark there is no trusted place to put it. A determined
  player can watch their neighbours' correctness in devtools. Moving grading into a
  Function is the only real fix, and it is the same upgrade that hides the answer.
- **The hold is still a channel.** Anonymous pips are low-bandwidth, but a table that
  wants to cheat can agree that one long pulse means something. Nothing short of hiding
  the indicator closes it, and hiding it costs more than it saves.
- **A permanent drop kills the round.** The absent player's given slots are unrecoverable,
  so the host needs an abandon control that returns everyone to the lobby. A player who
  drops and comes back keeps their seat, because the anonymous uid persists.
- **No scheduled cleanup without Functions.** Rooms are reaped opportunistically: creating
  a room whose code exists but has been idle over 24h claims it. Dead rooms cost bytes
  until someone rolls their code again.
- **The 2–8 cap is client-side.** See the rules section.

## Quotas

Spark gives RTDB 100 simultaneous connections, 1 GB stored, and 10 GB/month down. One
listener per player on a room object measured in kilobytes; a room's entire lifetime is
a rounding error against 10 GB. The binding limit is 100 concurrent players across all
games at once, which is a good problem.

## What building it actually taught

Three things the design above did not anticipate, all found by running two real players
against the real database rather than by testing the logic:

- **RTDB read permission does not cascade upward.** Granting reads on every child of a
  room still denies a listener on the room node itself, and a denied `onValue` with no
  error callback is indistinguishable from a room that never loads. Both the rule and the
  error callback were missing.
- **Never re-render from inside a render.** The winning attempt called `rerender()` from
  within the render pass that detected it; the re-entrant pass painted the pre-win state
  over the top, and the celebration only appeared after the next snapshot. The resolution
  now updates its own frame and the win latches locally, so it does not wait on the
  round trip that records it.
- **Host succession needs a grace period.** A refresh drops presence for a second, which
  was long enough for the other player to take the room. Succession now waits six
  seconds and cancels if the host comes back.
