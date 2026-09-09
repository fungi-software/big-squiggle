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

`index.html` is a single self-contained page with no build step and no dependencies
beyond a Google Fonts stylesheet.

```
open index.html
# or
npx serve .
```

## Where this is going

Today the game is honour-system: every device computes the puzzle locally, players
coordinate seats verbally, and "everyone won" is something the table confirms out loud.
[`docs/PLAN.md`](docs/PLAN.md) lays out the move to Firebase-backed rooms and an
in-app WebRTC call, so that setup, seat assignment, the restrictions themselves,
and the moment the whole table wins are all handled by the app.
