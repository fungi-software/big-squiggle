import type { GameMode } from './restrictions';

const WRAP = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const CAMERA_OFF =
  '<path d="M2.5 7.5A1.5 1.5 0 0 1 4 6h8a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 12 18H4a1.5 1.5 0 0 1-1.5-1.5z"/>' +
  '<path d="M13.5 10.5 21 7v10l-7.5-3.5"/><path d="M3 3l18 18"/>';

const MIC_OFF =
  '<rect x="9" y="2.5" width="6" height="10" rx="3"/>' +
  '<path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M3 3l18 18"/>';

const SOUND_OFF =
  '<path d="M4 9.5h3.5L12.5 5v14L7.5 14.5H4z"/>' +
  '<path d="M17 9.5l4.5 5"/><path d="M21.5 9.5l-4.5 5"/>';

const NO_TALKING =
  '<path d="M20.5 11.5a7.5 7.5 0 0 1-7.5 7.5H9l-4.5 2.5 1-3.4A7.5 7.5 0 0 1 13 4a7.5 7.5 0 0 1 7.5 7.5z"/>' +
  '<path d="M3 3l18 18"/>';

const NO_GESTURES =
  '<path d="M8.6 12.2V6a1.5 1.5 0 0 1 3 0v5"/>' +
  '<path d="M11.6 11V4.8a1.5 1.5 0 0 1 3 0V11"/>' +
  '<path d="M14.6 11.4V7a1.5 1.5 0 0 1 3 0v7a6.5 6.5 0 0 1-6.5 6.5A6.6 6.6 0 0 1 4.5 14v-3a1.5 1.5 0 0 1 3 0v1.4"/>' +
  '<path d="M3 3l18 18"/>';

const NO_LOOKING =
  '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/>' +
  '<circle cx="12" cy="12" r="3.1"/><path d="M3 3l18 18"/>';

/** Index matches the restriction set for the mode. */
export const CALL_ICONS = [CAMERA_OFF, MIC_OFF, SOUND_OFF];
export const TABLE_ICONS = [NO_TALKING, NO_GESTURES, NO_LOOKING];

export function restrictionIcon(mode: GameMode, index: number): string {
  const set = mode === 'table' ? TABLE_ICONS : CALL_ICONS;
  return `<svg ${WRAP} aria-hidden="true">${set[index] ?? ''}</svg>`;
}
