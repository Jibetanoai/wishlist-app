// LINEログインで「誰のリストか」を区別する。データそのものはNetlify Blobsに
// ユーザーごとに分けて保存され、ログインしたLINEアカウントの分だけが見える。
// channel secretは絶対にここに書かない。トークン交換はNetlify Functions
// (netlify/functions/line-token-exchange.js)側でchannel secretを使って行う。
const LINE_LOGIN_CONFIG = {
  // LINE Developersコンソールで発行される「チャネルID」。公開情報なのでここに書いてOK。
  channelId: '2011476818',
  // アクセス方法によってpathnameがブレるとコールバックURL不一致で400になるため、
  // 常にオリジン直下の固定パスを使う。
  redirectUri: window.location.origin + '/',
};

const AUTH_STORAGE_KEY = 'wishlist_line_auth_v1';

let currentUser = null; // { userId, name, picture, sessionToken }

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(auth) {
  currentUser = auth;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch { /* noop */ }
}

function clearAuth() {
  currentUser = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function randomHex(byteLength) {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(buffer) {
  let str = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Buffer(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function showLoginScreen() {
  document.getElementById('bootLoading').hidden = true;
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('appRoot').hidden = true;
}

function showApp() {
  document.getElementById('bootLoading').hidden = true;
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('appRoot').hidden = false;
  const nameEl = document.getElementById('loggedInName');
  if (nameEl) nameEl.textContent = (currentUser && currentUser.name) || '';
  const avatarEl = document.getElementById('loggedInAvatar');
  if (avatarEl) {
    if (currentUser && currentUser.picture) {
      avatarEl.src = currentUser.picture;
      avatarEl.hidden = false;
    } else {
      avatarEl.hidden = true;
    }
  }
  if (typeof onAuthReady === 'function') onAuthReady();
}

async function startLineLogin() {
  const codeVerifier = randomHex(32);
  const codeChallenge = base64UrlEncode(await sha256Buffer(codeVerifier));
  const state = randomHex(16);
  // iPhoneではLINEアプリに切り替わってからSafariに戻ってくると別タブ扱いになることがあり、
  // sessionStorageだと消えてしまうことがあるためlocalStorageに保存する。
  localStorage.setItem('line_code_verifier', codeVerifier);
  localStorage.setItem('line_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_LOGIN_CONFIG.channelId,
    redirect_uri: LINE_LOGIN_CONFIG.redirectUri,
    state,
    scope: 'profile openid',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

// LINEからのリダイレクト(?code=...&state=...)を検出して処理する。
// 該当パラメータがない通常アクセス時は何もせずfalseを返す。
async function handleLineCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (!code && !error) return false;

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  window.history.replaceState({}, '', url.toString());

  if (error) {
    showLoginError('LINEログインがキャンセルされたか、失敗したよ。もう一度試してね。');
    return true;
  }

  const expectedState = localStorage.getItem('line_state');
  const codeVerifier = localStorage.getItem('line_code_verifier');
  localStorage.removeItem('line_state');
  localStorage.removeItem('line_code_verifier');

  if (!state || state !== expectedState || !codeVerifier) {
    showLoginError('ログイン情報の確認に失敗したよ。もう一度試してね。');
    return true;
  }

  try {
    const res = await fetch('/.netlify/functions/line-token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: LINE_LOGIN_CONFIG.redirectUri, code_verifier: codeVerifier }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      saveAuth({ name: data.name, picture: data.picture, sessionToken: data.sessionToken });
    } else {
      showLoginError('ログインに失敗したよ。もう一度試してね。');
    }
  } catch {
    showLoginError('通信エラーが発生したよ。もう一度試してね。');
  }
  return true;
}

// auth.js自身の読み込み時にすぐ実行してしまうと、LINEからのリダイレクト処理
// (非同期)が終わるタイミングによっては、まだ読み込まれていないapp.js側の
// onAuthReady関数を呼べずに終わってしまうことがある。そのためinitAuth()は
// index.html側で、全スクリプトの読み込みが終わった後に明示的に呼び出す。
async function initAuth() {
  await handleLineCallback();
  currentUser = loadStoredAuth();
  if (currentUser && currentUser.sessionToken) {
    showApp();
  } else {
    showLoginScreen();
  }
}

document.getElementById('lineLoginBtn').addEventListener('click', startLineLogin);
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (!confirm('ログアウトする?')) return;
  clearAuth();
  if (typeof EMPTY_APP_DATA !== 'undefined') appData = { ...EMPTY_APP_DATA };
  editUnlocked = false;
  document.getElementById('loggedInAvatar').hidden = true;
  showLoginScreen();
});
