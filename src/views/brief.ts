import { byId } from '../dom';
import { restrictionIcon } from '../icons';
import { RESTRICTIONS } from '../restrictions';
import { setBriefed } from '../room';
import { isBriefed, restrictionIndex, seatedUids, type RoomSnapshot } from '../roomLogic';
import { getRoom, getUid } from '../store';

export function mountBrief(): void {
  byId('briefReadyBtn').addEventListener('click', () => {
    const room = getRoom();
    const uid = getUid();
    if (room && uid && !isBriefed(room, uid)) void setBriefed(room.code, uid, room.meta.roundId);
  });
}

export function renderBrief(room: RoomSnapshot, uid: string): void {
  const seat = room.seats[uid] ?? 0;
  const restriction = RESTRICTIONS[restrictionIndex(seat, room.meta.roundId)]!;

  byId('briefIcon').innerHTML = restrictionIcon(restrictionIndex(seat, room.meta.roundId));
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
