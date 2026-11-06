import { setPlayerName, track } from '../analytics';
import { byId } from '../dom';
import { createRoom, joinRoom, normalizeCode, RoomError } from '../room';
import { rememberedName, rememberName } from '../session';
import { enterRoom, getRoom, getUid } from '../store';

const MESSAGES: Record<string, string> = {
  'not-found': 'No room with that code.',
  'in-progress': 'That game has already started.',
  full: 'That room is full.',
  'no-code': 'Could not find a free code. Try again.',
};

let busy = false;
/** The code an invite link carried. While set, joining it is the only offer. */
let invite = '';

export function setInvite(code: string): void {
  invite = code;
}

/** Back to the full choice, with the address no longer pointing at the room. */
export function clearInvite(): void {
  if (!invite) return;
  invite = '';
  history.replaceState(null, '', '/');
}

function setError(message: string): void {
  const el = byId('homeErr');
  el.textContent = message;
  el.hidden = !message;
}

async function attempt(
  run: (uid: string, name: string) => Promise<string>,
  via: 'invite' | 'code' | 'create',
  code?: string,
): Promise<void> {
  // a second create while already seated would strand the first room without its host
  const uid = getUid();
  if (!uid || busy || getRoom()) return;

  const field = byId<HTMLInputElement>('nameInput');
  const name = field.value.trim();
  if (!name) {
    field.focus();
    return;
  }
  rememberName(name);

  busy = true;
  setError('');
  try {
    enterRoom(await run(uid, name));
    setPlayerName(name);
  } catch (err) {
    track('join_failed', { room_code: code, via, kind: err instanceof RoomError ? err.kind : 'network' });
    // a dead invite would leave only a button that cannot work, so offer everything again
    if (err instanceof RoomError) clearInvite();
    setError(err instanceof RoomError ? (MESSAGES[err.kind] ?? 'Could not join.') : 'Could not reach the game.');
  } finally {
    busy = false;
  }
}

export function joinInvite(): Promise<void> {
  const code = invite;
  return attempt(async (uid, name) => {
    await joinRoom(code, uid, name, 'invite');
    return code;
  }, 'invite', code);
}

export function mountHome(rerender: () => void): void {
  const nameField = byId<HTMLInputElement>('nameInput');
  nameField.value = rememberedName();
  // step two lights up the moment there is a name, which is the whole explanation
  nameField.addEventListener('input', renderHome);

  byId('createBtn').addEventListener('click', () => {
    void attempt((uid, name) => createRoom(uid, name), 'create').then(rerender);
  });

  const codeField = byId<HTMLInputElement>('joinCode');
  codeField.addEventListener('input', function () {
    this.value = normalizeCode(this.value);
    setError('');
  });

  const join = () => {
    const code = normalizeCode(codeField.value);
    if (!code) {
      codeField.focus();
      return;
    }
    void attempt(async (uid, name) => {
      await joinRoom(code, uid, name, 'code');
      return code;
    }, 'code', code).then(rerender);
  };

  byId('joinBtn').addEventListener('click', join);
  byId('inviteBtn').addEventListener('click', () => {
    void joinInvite().then(rerender);
  });
  nameField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && invite) void joinInvite().then(rerender);
  });
  codeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}

export function renderHome(): void {
  const signedIn = !!getUid();
  const named = byId<HTMLInputElement>('nameInput').value.trim().length > 0;
  const ready = signedIn && named;

  byId<HTMLButtonElement>('createBtn').disabled = !ready;
  byId<HTMLButtonElement>('joinBtn').disabled = !ready;
  byId<HTMLButtonElement>('inviteBtn').disabled = !ready;

  byId('inviteBtn').hidden = !invite;
  byId('inviteCode').textContent = invite;
  for (const id of ['createBtn', 'orRule', 'codeRow']) byId(id).hidden = !!invite;
  byId('connecting').hidden = signedIn;

  byId('stepName').classList.toggle('on', named);
  byId('stepRoom').classList.toggle('waiting', !named);
}
