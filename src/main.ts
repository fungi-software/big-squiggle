import './styles.css';

import { signIn } from './firebase';
import { bindServerTime } from './presence';
import { render } from './render';
import { normalizeCode } from './room';
import { rememberedName, rememberedRoom } from './session';
import { enterRoom, onChange, setUid } from './store';
import { mountBoard } from './events';
import { mountBrief } from './views/brief';
import { joinInvite, mountHome, setInvite } from './views/home';
import { mountLobby } from './views/lobby';
import { mountClock } from './views/clock';
import { mountTopbar } from './views/topbar';

/** `/r/RAVEN` is the whole invite. */
function codeFromUrl(): string {
  const m = /^\/r\/([A-Za-z]+)/.exec(location.pathname);
  return m ? normalizeCode(m[1]!) : '';
}

onChange(render);
mountHome(render);
mountLobby();
mountBrief();
mountTopbar(render);
mountClock();
mountBoard(render);
render();

bindServerTime();

void signIn()
  .then(async (uid) => {
    setUid(uid);
    render();

    const invited = codeFromUrl();
    const remembered = rememberedRoom();
    if (invited) {
      // an invite link offers only that room; with a name already known it just joins
      setInvite(invited);
      if (rememberedName()) await joinInvite();
    } else if (remembered) {
      enterRoom(remembered);
    }
    render();
  })
  .catch(() => {
    render();
  });
