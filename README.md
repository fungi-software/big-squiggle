# Big Squiggle

A party game for a video call. Everyone holds part of a sequence of shapes that
nobody can easily describe, and the whole table has to enter that same sequence.

## How it plays

1. Someone rolls a **game code** (`RAVEN-5` — the word and the player count together)
   and shares it with the table. Everyone types the same token.
2. Each player takes a **seat**, which decides which positions in the sequence they
   already know. Each round also deals everyone a **restriction**. Over a video call
   that is camera off, microphone off or sound off; in the same room it is no talking,
   no gestures, or no looking at anyone. A table of two never draws the third of
   either set — with one other person, someone who cannot receive has no way back in.
3. Nobody may use chat or any channel outside the call. You have to get your shapes
   across the table through a medium you are partly cut off from.
4. Fill all the positions, then everyone holds the button at the same time. It only
   grades while the whole table is pressing, and a miss tells nobody anything.
5. The clock runs from the moment the board goes live until the table solves it, and
   the room remembers its fastest.

The puzzle is derived from the game code on each device — a matching code and player
count produces the identical deal everywhere, with no server involved.

## Running it

```
npm install
npm run dev        # http://localhost:5173
```

With no `.env.local` the app points at the Firebase emulator suite (`npm run emulators`,
which needs a JVM). To run against the real project instead, copy `.env.example` to
`.env.local` and fill it from the Firebase console — those values are not secrets, and
`database.rules.json` is what actually protects the data.

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`, `npm test`,
and `npm run test:rules` (security rules, against the emulator).

Deploying rules: `npx firebase deploy --only database`.

## Layout

```
index.html          markup only; the page shell
src/
  main.ts           boot: sign in, rejoin, wire events, first render
  firebase.ts       app init, anonymous auth, emulator wiring
  room.ts           create / join / start / leave / hold — thin wrappers over the logic
  live.ts           the hold predicate every device evaluates identically
  roomLogic.ts      pure room rules: seating, readiness, host succession, routing
  presence.ts       onDisconnect presence and the server clock offset
  store.ts          the live room snapshot and the transitions nobody presses
  render.ts         picks a screen from room status
  views/            home, lobby, brief, play, plus the topbar and the round clock
  glyphs.ts         the 120 marks and their SVG
  puzzle.ts         the seeded deal — answer, plate, seat ownership
  random.ts         mulberry32 and friends
  codes.ts          game-code words, "RAVEN-5" token parsing
  restrictions.ts   the two condition sets, for a call and for a table
  state.ts          the game state, persistence, and the grading timer
  session.ts        the name and last room, remembered in localStorage
  events.ts         input and drag-and-drop wiring
  dom.ts            element lookup and escaping helpers
  icons.ts          the restriction icons as inline SVG
  confetti.ts       the fanfare
  styles.css
tests/
  puzzle.test.ts    invariants, plus golden fixtures captured from the
  golden.json       pre-refactor build so the deal can never silently drift
  roomLogic.test.ts the room rules, without needing a database
  live.test.ts      the hold-to-validate predicate
  rules.test.ts     security rules; runs under `npm run test:rules`
```

CI typechecks, tests, and builds every push and pull request. With the
`FIREBASE_SERVICE_ACCOUNT_BIG_SQUIGGLE` secret set, a push to `main` also deploys to
Firebase Hosting and a pull request from this repo gets a preview channel.

## Where this is going

Today the game is honour-system: every device computes the puzzle locally, players
coordinate seats verbally, and "everyone won" is something the table confirms out loud.
[`docs/PLAN.md`](docs/PLAN.md) lays out the move to Firebase-backed rooms and an
in-app WebRTC call, so that setup, seat assignment, the restrictions themselves,
and the moment the whole table wins are all handled by the app.
[`docs/PHASE-1-2.md`](docs/PHASE-1-2.md) specifies the next two phases in full:
rooms on the Firebase free tier, and a validation that only resolves while every
player is holding it down.

## License

[MIT](LICENSE).
