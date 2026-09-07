// スマホの共有ボタン(Android)やiOSショートカットから、URLを直接リストに
// 追加するためのページ。index.htmlのアプリ本体とは別の、単独の軽いページ。
// ログイン状態はauth.jsと同じlocalStorageのキーを見て判定する(このページ単体では
// LINEログインはできない仕様。先にアプリ本体でログインしておいてもらう前提)。
const AUTH_STORAGE_KEY = 'wishlist_line_auth_v1';

const SIMPLE_LIST_KEYS = ['bucketlist', 'travellist', 'restaurantlist', 'hotellist', 'cafelist', 'furusatolist'];
const EMPTY_APP_DATA = { wishlist: [], bucketlist: [], travellist: [], restaurantlist: [], hotellist: [], cafelist: [], furusatolist: [] };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromUrl(url) {
  try {
    return `${new URL(url).hostname.replace(/^www\./, '')}の商品`;
  } catch {
    return 'リンクから追加した項目';
  }
}

function getSharedParams() {
  const params = new URLSearchParams(window.location.search);
  // Web Share Target/ショートカットのどちらから来ても拾えるように複数の
  // パラメータ名を見る。urlが無い場合はtext欄にURLが入っていることもある。
  const rawUrl = params.get('url') || '';
  const text = params.get('text') || '';
  const title = params.get('title') || '';
  const urlMatch = (rawUrl || text).match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : '';
  return { url, title: title || (url ? '' : text) };
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchData(sessionToken) {
  const res = await fetch('/.netlify/functions/data-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken }),
  });
  if (!res.ok) throw new Error('読み込みに失敗したよ');
  return res.json();
}

async function saveData(sessionToken, data) {
  const res = await fetch('/.netlify/functions/data-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, data }),
  });
  if (!res.ok) throw new Error('保存に失敗したよ');
}

async function fetchLinkPreview(url) {
  try {
    const res = await fetch('/.netlify/functions/link-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return { title: null, image: null };
    return res.json();
  } catch {
    return { title: null, image: null };
  }
}

(async function init() {
  const auth = loadAuth();
  const { url, title } = getSharedParams();

  if (!auth || !auth.sessionToken) {
    document.getElementById('shareNotLoggedIn').hidden = false;
    return;
  }
  if (!url) {
    document.getElementById('shareNoUrl').hidden = false;
    return;
  }

  const previewEl = document.getElementById('shareUrlPreview');
  previewEl.href = url;
  previewEl.textContent = '🔗 内容を確認する(別タブで開く)';
  const titleInput = document.getElementById('shareTitleInput');
  const imagePreviewEl = document.getElementById('shareImagePreview');
  titleInput.value = title;
  const form = document.getElementById('shareForm');
  form.hidden = false;
  titleInput.focus();

  // ページのog:title/og:imageを軽く見に行って、分かりやすい名前と画像を自動で埋める
  // (すでにOS側からタイトルが渡ってきてる場合はそれを優先し、上書きしない)。
  let previewImage = null;
  const statusEl = document.getElementById('shareStatus');
  statusEl.hidden = false;
  statusEl.textContent = '商品情報を確認中…';
  const preview = await fetchLinkPreview(url);
  statusEl.hidden = true;
  if (preview.title && !titleInput.value) titleInput.value = preview.title;
  if (preview.image) {
    previewImage = preview.image;
    imagePreviewEl.src = preview.image;
    imagePreviewEl.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('shareSaveBtn');
    const category = document.getElementById('shareCategorySelect').value;
    const enteredTitle = document.getElementById('shareTitleInput').value.trim();
    saveBtn.disabled = true;
    statusEl.hidden = true;

    try {
      const data = await fetchData(auth.sessionToken);
      const merged = { ...EMPTY_APP_DATA, ...data };

      if (category === 'wishlist') {
        merged.wishlist = merged.wishlist || [];
        merged.wishlist.push({
          id: newId(), source: 'other', title: enteredTitle || titleFromUrl(url),
          price: null, image: previewImage, url, memo: null, priceHistory: [], addedAt: new Date().toISOString(),
        });
      } else if (SIMPLE_LIST_KEYS.includes(category)) {
        merged[category] = merged[category] || [];
        merged[category].push({
          id: newId(), done: false, title: enteredTitle || titleFromUrl(url),
          amount: null, memo: null, link: url, addedAt: new Date().toISOString(),
        });
      }

      await saveData(auth.sessionToken, merged);
      form.hidden = true;
      document.getElementById('shareDone').hidden = false;
    } catch (err) {
      statusEl.textContent = err.message || '追加に失敗したよ';
      statusEl.hidden = false;
      saveBtn.disabled = false;
    }
  });
})();
