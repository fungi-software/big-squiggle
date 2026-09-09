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

/** Index matches RESTRICTIONS: camera, microphone, sound. */
export const RESTRICTION_ICONS = [CAMERA_OFF, MIC_OFF, SOUND_OFF];

export function restrictionIcon(index: number): string {
  return `<svg ${WRAP} aria-hidden="true">${RESTRICTION_ICONS[index] ?? ''}</svg>`;
}
