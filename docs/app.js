function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Amazonのアソシエイトタグ。公開情報(URLのパラメータ)なのでクライアント側に置いてOK。
const AMAZON_ASSOCIATE_TAG = 'kwishlist-22';

function extractAsin(url) {
  if (!url) return null;
  const m = String(url).match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return m ? m[1] : null;
}

// Amazonのリンクにアソシエイトタグを付ける。ASINが取れなければ元のURLをそのまま返す。
function buildAmazonAffiliateUrl(url) {
  if (!url) return url;
  if (!AMAZON_ASSOCIATE_TAG) return url;
  const asin = extractAsin(url);
  if (!asin) return url;
  return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(AMAZON_ASSOCIATE_TAG)}`;
}

// Keepa(価格推移を見れる無料の外部サービス)の商品ページへのリンクを作る。
// 5 = amazon.co.jp を表すKeepaのドメイン番号。
function buildKeepaUrl(url) {
  const asin = extractAsin(url);
  return asin ? `https://keepa.com/#!product/5-${asin}` : null;
}

// 楽天のアフィリエイトID。楽天市場の商品検索(サーバー側)だけでなく、行きたい場所・
// ホテルなどのリストに貼った楽天トラベル/楽天GORA等のリンクにも使う「どこでもリンク」用。
// アソシエイトタグと同じくURLに載る公開情報なのでクライアント側に置いてOK。
const RAKUTEN_AFFILIATE_ID = '57416495.7c2d7ecb.57416496.07b01883';

// 楽天グループの任意のURL(楽天トラベル・楽天GORA・楽天ブックス等)を、楽天の
// 「どこでもリンク」形式でアフィリエイトリンク化する。すでに変換済みのリンクはそのまま。
function buildRakutenAffiliateUrl(url) {
  if (!url || !RAKUTEN_AFFILIATE_ID) return url;
  if (/hb\.afl\.rakuten\.co\.jp/i.test(url)) return url;
  const encoded = encodeURIComponent(url);
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encoded}&m=${encoded}`;
}

// バリューコマース(食べログ・ホットペッパーグルメ・一休.com・じゃらん等の窓口ASP)の
// MyLink。サイトIDは全プログラム共通で、プログラム(広告主)ごとにpidが決まっている。
// 新しく提携したら、対応するドメインとpidをここに追加していく。
const VALUECOMMERCE_SID = '3780809';
const VALUECOMMERCE_PIDS = {
  'tabelog.com': '892693484', // 食べログ 飲食店ネット予約プログラム
  'jalan.net': '892693488', // じゃらんnet(ホテル・宿予約)
  'hotpepper.jp': '892693490', // ホットペッパー グルメ
  'restaurant.ikyu.com': '892693491', // 一休.com レストラン(ホテル予約のikyu.comとは別プログラムなのでサブドメイン限定)
  'asoview.com': '892693493', // アソビュー!(レジャー・体験チケット予約)
  'www.ikyu.com': '892693499', // 一休.com(ホテル予約本体、レストラン版とは別プログラム)
  'jtb.co.jp': '892693501', // JTB(国内宿泊予約)
  'travel.yahoo.co.jp': '892693515', // Yahoo!トラベル
  'his-j.com': '892693516', // HIS(海外旅行)
  'rlx.jp': '892693517', // Relux(高級ホテル・旅館予約)
  'jal.co.jp': '892693518', // ジャルパック(JALの国内・海外ツアー)
  'furusato.asahi.co.jp': '892693520', // ふるさと納税ニッポン!(朝日新聞運営)
  'satofull.jp': '892693524', // さとふる
  'furusato-tax.jp': '892693527', // ふるさとチョイス
  'furunavi.jp': '892693530', // ふるなび
};

// バリューコマース経由のリンクをMyLink形式に変換する。対応してないドメインはそのまま。
function buildValueCommerceUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
  if (/valuecommerce\.com$/i.test(host)) return url; // 変換済み
  const domain = Object.keys(VALUECOMMERCE_PIDS).find((d) => host === d || host.endsWith(`.${d}`));
  if (!domain) return url;
  const pid = VALUECOMMERCE_PIDS[domain];
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VALUECOMMERCE_SID}&pid=${pid}&vc_url=${encodeURIComponent(url)}`;
}

// URLの種類を判定して、Amazon・楽天グループ・バリューコマース対応サイトのリンクには
// アフィリエイトを自動で付ける。
function decorateLink(url) {
  if (!url) return null;
  if (/amazon\.co\.jp/i.test(url)) return buildAmazonAffiliateUrl(url);
  if (/(^|\.)rakuten\.co\.jp/i.test(url)) return buildRakutenAffiliateUrl(url);
  return buildValueCommerceUrl(url);
}

const EMPTY_APP_DATA = { wishlist: [], bucketlist: [], travellist: [], restaurantlist: [], hotellist: [], cafelist: [], furusatolist: [] };
let appData = { ...EMPTY_APP_DATA };
let currentSection = 'wishlist';
let editUnlocked = false;

const EDIT_PASSCODE_KEY = 'wishlist_edit_passcode';

function getSavedPasscode() {
  try {
    return sessionStorage.getItem(EDIT_PASSCODE_KEY) || '';
  } catch {
    return '';
  }
}

function setSavedPasscode(v) {
  try {
    sessionStorage.setItem(EDIT_PASSCODE_KEY, v);
  } catch { /* noop */ }
}

async function fetchData() {
  const res = await fetch('/.netlify/functions/data-get');
  if (!res.ok) throw new Error('データの読み込みに失敗したよ');
  return res.json();
}

async function saveData() {
  const res = await fetch('/.netlify/functions/data-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: getSavedPasscode(), data: appData }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error === 'Wrong passcode' ? 'パスコードが違うみたいで保存できなかったよ' : '保存に失敗したよ');
  }
}

function updateEditUi() {
  document.querySelectorAll('.edit-only').forEach((el) => { el.hidden = !editUnlocked; });
  document.getElementById('editModeBtn').textContent = editUnlocked ? '🔓 編集中' : '🔒 編集';
}

function switchSection(name) {
  currentSection = name;
  document.querySelectorAll('.app-section').forEach((sec) => {
    sec.hidden = sec.id !== `section-${name}`;
  });
  document.querySelectorAll('.section-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  if (name === 'wishlist') renderWishlist();
  else if (SIMPLE_LISTS[name]) renderSimpleList(name);
}

document.getElementById('sectionNav').addEventListener('click', (e) => {
  const btn = e.target.closest('.section-tab');
  if (!btn) return;
  switchSection(btn.dataset.section);
});

const editUnlockModalOverlay = document.getElementById('editUnlockModalOverlay');
document.getElementById('editModeBtn').addEventListener('click', () => {
  if (editUnlocked) {
    editUnlocked = false;
    setSavedPasscode('');
    updateEditUi();
    return;
  }
  document.getElementById('editPasscodeInput').value = '';
  document.getElementById('editUnlockError').hidden = true;
  editUnlockModalOverlay.hidden = false;
});
document.querySelectorAll('.js-close-unlock').forEach((btn) => btn.addEventListener('click', () => {
  editUnlockModalOverlay.hidden = true;
}));
editUnlockModalOverlay.addEventListener('click', (e) => {
  if (e.target === editUnlockModalOverlay) editUnlockModalOverlay.hidden = true;
});
document.getElementById('editUnlockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const passcode = document.getElementById('editPasscodeInput').value;
  const errorEl = document.getElementById('editUnlockError');
  try {
    const res = await fetch('/.netlify/functions/verify-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      errorEl.textContent = body.error === 'Wrong passcode' ? 'パスコードが違うみたい。' : '確認に失敗したよ。ネット接続を確認してね。';
      errorEl.hidden = false;
      return;
    }
    setSavedPasscode(passcode);
    editUnlocked = true;
    editUnlockModalOverlay.hidden = true;
    updateEditUi();
  } catch {
    errorEl.textContent = '確認に失敗したよ。ネット接続を確認してね。';
    errorEl.hidden = false;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    if (!overlay.hidden) overlay.hidden = true;
  });
});

async function init() {
  try {
    appData = await fetchData();
  } catch {
    appData = { ...EMPTY_APP_DATA };
    alert('データの読み込みに失敗したよ。ネット接続を確認して再読み込みしてね。');
  }
  document.getElementById('loadingState').hidden = true;
  updateEditUi();
  switchSection('wishlist');
}

init();
