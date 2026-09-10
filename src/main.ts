import './styles.css';

import { signIn } from './firebase';
import { bindServerTime } from './presence';
import { render } from './render';
import { joinRoom, normalizeCode } from './room';
import { rememberedName, rememberedRoom } from './session';
import { enterRoom, onChange, setUid } from './store';
import { mountBoard } from './events';
import { mountBrief } from './views/brief';
import { mountHome } from './views/home';
import { mountLobby } from './views/lobby';
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
      const name = rememberedName();
      // an invite link with no name yet drops you on the home screen with the code filled
      if (name) {
        await joinRoom(invited, uid, name).then(() => enterRoom(invited)).catch(() => {});
      } else {
        (document.getElementById('joinCode') as HTMLInputElement).value = invited;
      }
    } else if (remembered) {
      enterRoom(remembered);
    }
    render();
  })
  .catch(() => {
    render();
  });
