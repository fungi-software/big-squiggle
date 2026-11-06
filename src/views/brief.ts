import { track } from '../analytics';
import { byId } from '../dom';
import { restrictionIcon } from '../icons';
import { restrictionsFor } from '../restrictions';
import { setBriefed } from '../room';
import { gameMode, isBriefed, restrictionForSeat, seatedUids, type RoomSnapshot } from '../roomLogic';
import { getRoom, getUid } from '../store';

/** The deal on screen, so a re-render does not report it dealt again. */
let dealt = '';
let dealtAt = 0;

export function mountBrief(): void {
  byId('briefReadyBtn').addEventListener('click', () => {
    const room = getRoom();
    const uid = getUid();
    if (room && uid && !isBriefed(room, uid)) {
      void setBriefed(room.code, uid, room.meta.roundId, Date.now() - dealtAt);
    }
  });
}

export function renderBrief(room: RoomSnapshot, uid: string): void {
  const seat = room.seats[uid] ?? 0;
  const mode = gameMode(room);
  const index = restrictionForSeat(room, seat);
  const restriction = restrictionsFor(mode)[index]!;

  const deal = `${room.code}#${room.meta.roundId}:${seat}`;
  if (deal !== dealt) {
    dealt = deal;
    dealtAt = Date.now();
    track('restriction_dealt', { restriction: restriction.t, seat });
  }

  byId('briefIcon').innerHTML = restrictionIcon(mode, index);
  byId('briefTitle').textContent = restriction.t;
  byId('briefDesc').textContent = restriction.d;

  const mine = isBriefed(room, uid);
  const btn = byId<HTMLButtonElement>('briefReadyBtn');
  btn.disabled = mine;
  btn.textContent = mine ? 'Waiting' : 'Ready';

  const seated = seatedUids(room);
  byId('briefPips').innerHTML = seated
    .map((u) => `<i class="pip${isBriefed(room, u) ? ' on' : ''}"></i>`)
    .join('');
}
