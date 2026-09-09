# Big Squiggle

A party game for a video call. Everyone holds part of a sequence of shapes that
nobody can easily describe, and the whole table has to enter that same sequence.

## How it plays

1. Someone rolls a **game code** (`RAVEN-5` — the word and the player count together)
   and shares it with the table. Everyone types the same token.
2. Each player takes a **seat**. The seat decides two things: which positions in the
   sequence you already know, and which **restriction** you play under —
   camera off, microphone off, or sound off.
3. Nobody may use chat or any channel outside the call. You have to get your shapes
   across the table through a medium you are partly cut off from.
4. Fill all the positions. Five seconds after the last one is placed the board grades
   itself. When every player sees the win, the table has it.

The puzzle is derived from the game code on each device — a matching code and player
count produces the identical deal everywhere, with no server involved.

## Running it

```
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build` (production bundle into `dist/`), `npm run preview`,
`npm run typecheck`, `npm test`.

## Layout

```
index.html          markup only; the page shell
src/
  main.ts           boot: restore state, wire events, first render
  glyphs.ts         the 50 marks and their SVG
  puzzle.ts         the seeded deal — answer, plate, seat ownership
  random.ts         mulberry32 and friends
  codes.ts          game-code words, "RAVEN-5" token parsing
  restrictions.ts   camera / mic / sound off
  state.ts          the game state, persistence, and the grading timer
  ui.ts             rendering
  events.ts         input and drag-and-drop wiring
  confetti.ts       the fanfare
  styles.css
tests/
  puzzle.test.ts    invariants, plus golden fixtures captured from the
  golden.json       pre-refactor build so the deal can never silently drift
```

Deploys to Firebase Hosting from `main` once `FIREBASE_SERVICE_ACCOUNT` and
`FIREBASE_PROJECT_ID` are set; until then CI just typechecks, tests, and builds.

## Where this is going

Today the game is honour-system: every device computes the puzzle locally, players
coordinate seats verbally, and "everyone won" is something the table confirms out loud.
[`docs/PLAN.md`](docs/PLAN.md) lays out the move to Firebase-backed rooms and an
in-app WebRTC call, so that setup, seat assignment, the restrictions themselves,
and the moment the whole table wins are all handled by the app.
