import { byId } from './dom';
import { releaseHold } from './room';
import { deriveScreen, type Screen } from './roomLogic';
import { getRoom, getUid } from './store';
import { renderBrief } from './views/brief';
import { renderHome } from './views/home';
import { renderLobby } from './views/lobby';
import { renderPlay } from './views/play';
import { renderTopbar } from './views/topbar';

const VIEWS: Record<Screen, string> = {
  home: 'homeView',
  lobby: 'lobbyView',
  brief: 'briefView',
  play: 'playView',
};

export function render(): void {
  const room = getRoom();
  const uid = getUid();
  const screen = deriveScreen(room, uid);

  for (const [name, id] of Object.entries(VIEWS)) {
    byId(id).hidden = name !== screen;
  }
  byId('roomTag').hidden = screen !== 'play';
  renderTopbar(screen !== 'home');

  // leaving the board must drop the hold; otherwise a stale press blocks the next round
  if (screen !== 'play' && room && uid && room.live[uid]?.holding) {
    void releaseHold(room.code, uid);
  }

  if (screen === 'home') renderHome(!!uid);
  else if (screen === 'lobby') renderLobby(room!, uid!);
  else if (screen === 'brief') renderBrief(room!, uid!);
  else renderPlay(room!, uid!, render);
}
