const NAME_KEY = 'bs_name';
const ROOM_KEY = 'bs_room';

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private browsing, so the session just will not survive a refresh */
  }
}

export function rememberedName(): string {
  return read(NAME_KEY);
}

export function rememberName(name: string): void {
  write(NAME_KEY, name.slice(0, 24));
}

/** The room to rejoin on a refresh. */
export function rememberedRoom(): string {
  return read(ROOM_KEY);
}

export function rememberRoom(code: string): void {
  write(ROOM_KEY, code);
}
