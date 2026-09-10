import { byId, esc } from '../dom';
import { abandonRound, setReady, shareLink, startRound } from '../room';
import {
  canStart, isHost, isOnline, isReady, MAX_PLAYERS, MIN_PLAYERS, startBlocker,
  type RoomSnapshot,
} from '../roomLogic';
import { getRoom, getUid } from '../store';

export function mountLobby(): void {
  byId('readyBtn').addEventListener('click', () => {
    const room = getRoom();
    const uid = getUid();
    if (!room || !uid) return;
    void setReady(room.code, uid, room.meta.roundId, !isReady(room, uid));
  });

  byId('startBtn').addEventListener('click', () => {
    const room = getRoom();
    const uid = getUid();
    if (room && uid && canStart(room, uid)) void startRound(room, room.meta.roundId);
  });

  byId('resumeBtn').addEventListener('click', () => {
    const room = getRoom();
    if (room) void abandonRound(room);
  });

  byId('roomCode').addEventListener('click', function () {
    const room = getRoom();
    if (!room) return;
    void navigator.clipboard.writeText(shareLink(room.code)).then(() => {
      this.classList.add('copied');
      setTimeout(() => this.classList.remove('copied'), 1200);
    });
  });
}

export function renderLobby(room: RoomSnapshot, uid: string): void {
  byId('roomCode').textContent = room.code;

  const roster = Object.keys(room.players).sort(
    (a, b) => (room.players[a]!.joinedAt ?? 0) - (room.players[b]!.joinedAt ?? 0),
  );

  byId('roster').innerHTML = roster
    .map((u) => {
      const p = room.players[u]!;
      const here = isOnline(room, u);
      const cls =
        'chip' +
        (here ? '' : ' away') +
        (here && isReady(room, u) ? ' ready' : '') +
        (u === uid ? ' me' : '');
      const host = room.meta.hostUid === u ? '<span class="host" aria-label="Host">◆</span>' : '';
      return `<div class="${cls}">${host}<span class="who">${esc(p.name)}</span></div>`;
    })
    .join('');

  const ready = isReady(room, uid);
  const readyBtn = byId<HTMLButtonElement>('readyBtn');
  readyBtn.textContent = ready ? 'Ready' : 'Ready?';
  readyBtn.classList.toggle('on', ready);

  const host = isHost(room, uid);
  const startBtn = byId<HTMLButtonElement>('startBtn');
  startBtn.hidden = !host;
  startBtn.disabled = !canStart(room, uid);

  // a member with no seat while a round runs is waiting it out; the host can cut it short
  const midRound = room.meta.status !== 'lobby';
  byId('resumeBtn').hidden = !(host && midRound);
  byId('waiting').hidden = !midRound;
  byId('lobbyControls').hidden = midRound;

  const block = startBlocker(room);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  let hintText = '';
  if (block?.kind === 'too-many') hintText = `${MAX_PLAYERS} players max`;
  else if (block?.kind === 'too-few') hintText = `${MIN_PLAYERS} players minimum`;
  else if (block?.kind === 'offline')
    hintText = plural(block.count, '1 player disconnected', `${block.count} players disconnected`);
  else if (block?.kind === 'not-ready' && host)
    hintText = plural(block.count, 'waiting on 1 player', `waiting on ${block.count} players`);

  const hint = byId('lobbyHint');
  hint.hidden = !hintText || midRound;
  hint.textContent = hintText;
}
