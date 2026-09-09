import { parseToken } from './codes';
import { S } from './state';

/**
 * claude.ai does not forward its own query string into the artifact frame, so this
 * only fires where the page is opened directly. Costs nothing and makes a real link
 * work where one exists.
 */
export function prefillFromUrl(): void {
  let q = '';
  try {
    q = location.search || (location.hash.indexOf('=') > 0 ? location.hash.replace('#', '?') : '');
  } catch {
    return;
  }
  if (!q) return;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(q);
  } catch {
    return;
  }

  const code = params.get('code') || params.get('game');
  const n = parseInt(params.get('players') || params.get('n') || '', 10);
  if (code) {
    const t = parseToken(code);
    if (t.word) {
      S.code = t.word;
      if (t.count) S.count = t.count;
    }
  }
  if (n >= 2 && n <= 8) S.count = n;
}

export function shareUrl(): string {
  try {
    const r = document.referrer || '';
    return /^https:\/\/claude\.ai\//.test(r) ? r.split('?')[0]!.split('#')[0]! : '';
  } catch {
    return '';
  }
}
