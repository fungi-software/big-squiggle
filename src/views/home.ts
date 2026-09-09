import { byId } from '../dom';
import { createRoom, joinRoom, normalizeCode, RoomError } from '../room';
import { rememberedName, rememberName } from '../session';
import { enterRoom, getUid } from '../store';

const MESSAGES: Record<string, string> = {
  'not-found': 'No room with that code.',
  'in-progress': 'That game has already started.',
  full: 'That room is full.',
  'no-code': 'Could not find a free code. Try again.',
};

let busy = false;

function setError(message: string): void {
  const el = byId('homeErr');
  el.textContent = message;
  el.hidden = !message;
}

async function attempt(run: (uid: string, name: string) => Promise<string>): Promise<void> {
  const uid = getUid();
  if (!uid || busy) return;

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
  } catch (err) {
    setError(err instanceof RoomError ? (MESSAGES[err.kind] ?? 'Could not join.') : 'Could not reach the game.');
  } finally {
    busy = false;
  }
}

export function mountHome(rerender: () => void): void {
  byId<HTMLInputElement>('nameInput').value = rememberedName();

  byId('createBtn').addEventListener('click', () => {
    void attempt((uid, name) => createRoom(uid, name)).then(rerender);
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
      await joinRoom(code, uid, name);
      return code;
    }).then(rerender);
  };

  byId('joinBtn').addEventListener('click', join);
  codeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}

export function renderHome(signedIn: boolean): void {
  byId<HTMLButtonElement>('createBtn').disabled = !signedIn;
  byId<HTMLButtonElement>('joinBtn').disabled = !signedIn;
  byId('connecting').hidden = signedIn;
}
