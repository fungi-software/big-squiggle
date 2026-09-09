import './styles.css';
import { formatToken, randomCode } from './codes';
import { byId } from './dom';
import { mount } from './events';
import { prefillFromUrl } from './share';
import { restore, S } from './state';
import { render } from './ui';

restore();
prefillFromUrl();
if (!S.code) S.code = randomCode();

byId<HTMLInputElement>('codeInput').value = formatToken(S.code, S.count);
byId<HTMLInputElement>('countInput').value = String(S.count);

mount();
render();
