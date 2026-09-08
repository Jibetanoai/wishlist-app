// 「🌐 公開ページ」モーダル。リストをカテゴリごとに選んで、ログインなしで見られる
// 公開URLとして出せるかどうかをここで切り替える。トークン自体はuserIdから決定的に
// 導出されるので、発行し直しても同じURLになる(=リンクを作り直して無効化する
// ことはできない。漏れた場合はチェックを全部外せば即座に見れなくなる、という設計)。
const shareModalOverlay = document.getElementById('shareSettingsModalOverlay');
const shareToggleList = document.getElementById('shareToggleList');
const shareLabelInput = document.getElementById('shareLabelInput');
const shareLinkRow = document.getElementById('shareLinkRow');
const shareLinkInput = document.getElementById('shareLinkInput');
const shareStatusEl = document.getElementById('shareStatus');
const shareCopyBtn = document.getElementById('shareCopyBtn');

function isAnyShareEnabled() {
  return Object.values(appData.shareSettings || {}).some(Boolean);
}

async function fetchShareToken() {
  const res = await fetch('/.netlify/functions/share-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: currentUser.sessionToken }),
  });
  if (!res.ok) throw new Error('公開リンクの発行に失敗したよ');
  const { shareToken } = await res.json();
  return shareToken;
}

async function updateShareLinkVisibility() {
  if (!isAnyShareEnabled()) {
    shareLinkRow.hidden = true;
    return;
  }
  try {
    const token = await fetchShareToken();
    const url = `${window.location.origin}/share-view.html?t=${encodeURIComponent(token)}`;
    shareLinkInput.value = url;
    shareLinkRow.hidden = false;
  } catch (err) {
    shareStatusEl.textContent = err.message;
    shareStatusEl.hidden = false;
  }
}

document.getElementById('shareSettingsBtn').addEventListener('click', () => {
  shareStatusEl.hidden = true;
  const settings = appData.shareSettings || {};
  shareToggleList.querySelectorAll('input[data-share-key]').forEach((cb) => {
    cb.checked = !!settings[cb.dataset.shareKey];
  });
  shareLabelInput.value = appData.shareLabel || '';
  updateShareLinkVisibility();
  shareModalOverlay.hidden = false;
});

document.querySelectorAll('.js-close-share-settings').forEach((btn) => btn.addEventListener('click', () => {
  shareModalOverlay.hidden = true;
}));
shareModalOverlay.addEventListener('click', (e) => { if (e.target === shareModalOverlay) shareModalOverlay.hidden = true; });

async function persistShareSettings() {
  shareStatusEl.hidden = true;
  const settings = {};
  shareToggleList.querySelectorAll('input[data-share-key]').forEach((cb) => {
    settings[cb.dataset.shareKey] = cb.checked;
  });
  appData.shareSettings = settings;
  appData.shareLabel = shareLabelInput.value.trim() || null;
  try {
    await saveData();
    await updateShareLinkVisibility();
  } catch (err) {
    shareStatusEl.textContent = err.message;
    shareStatusEl.hidden = false;
  }
}

shareToggleList.addEventListener('change', (e) => {
  if (e.target.matches('input[data-share-key]')) persistShareSettings();
});
shareLabelInput.addEventListener('change', persistShareSettings);

shareCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    shareCopyBtn.textContent = 'コピーしたよ';
    setTimeout(() => { shareCopyBtn.textContent = 'コピー'; }, 1500);
  } catch {
    shareLinkInput.select();
  }
});
