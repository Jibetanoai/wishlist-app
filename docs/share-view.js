// 公開共有ページ本体。ログイン不要。URLの?t=トークンで指定された人の
// 「ほしい物」だけを読み取り専用で表示する。app.jsのアフィリエイト変換ロジックを
// ログイン必須のapp.js本体に依存せずに使えるよう、必要な関数だけここに複製している。

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const AMAZON_ASSOCIATE_TAG = 'kwishlist-22';

function extractAsin(url) {
  if (!url) return null;
  const m = String(url).match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return m ? m[1] : null;
}

function buildAmazonAffiliateUrl(url) {
  if (!url || !AMAZON_ASSOCIATE_TAG) return url;
  const asin = extractAsin(url);
  if (asin) {
    return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(AMAZON_ASSOCIATE_TAG)}`;
  }
  try {
    const u = new URL(url);
    u.searchParams.set('tag', AMAZON_ASSOCIATE_TAG);
    return u.toString();
  } catch {
    return url;
  }
}

function buildKeepaUrl(url) {
  const asin = extractAsin(url);
  return asin ? `https://keepa.com/#!product/5-${asin}` : null;
}

const RAKUTEN_AFFILIATE_ID = '57416495.7c2d7ecb.57416496.07b01883';

function buildRakutenAffiliateUrl(url) {
  if (!url || !RAKUTEN_AFFILIATE_ID) return url;
  if (/hb\.afl\.rakuten\.co\.jp/i.test(url)) return url;
  const encoded = encodeURIComponent(url);
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encoded}&m=${encoded}`;
}

const VALUECOMMERCE_SID = '3780809';
const VALUECOMMERCE_PIDS = {
  'tabelog.com': '892693484',
  'jalan.net': '892693488',
  'hotpepper.jp': '892693490',
  'restaurant.ikyu.com': '892693491',
  'asoview.com': '892693493',
  'www.ikyu.com': '892693499',
  'jtb.co.jp': '892693501',
  'travel.yahoo.co.jp': '892693515',
  'his-j.com': '892693516',
  'rlx.jp': '892693517',
  'jal.co.jp': '892693518',
  'furusato.asahi.co.jp': '892693520',
  'satofull.jp': '892693524',
  'furusato-tax.jp': '892693527',
  'furunavi.jp': '892693530',
  'shopping.yahoo.co.jp': '892693719',
  'ozmall.co.jp': '892693809',
};

function buildValueCommerceUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
  if (/valuecommerce\.com$/i.test(host)) return url;
  const domain = Object.keys(VALUECOMMERCE_PIDS).find((d) => host === d || host.endsWith(`.${d}`));
  if (!domain) return url;
  const pid = VALUECOMMERCE_PIDS[domain];
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VALUECOMMERCE_SID}&pid=${pid}&vc_url=${encodeURIComponent(url)}`;
}

function decorateLink(url) {
  if (!url) return null;
  if (/amazon\.co\.jp|amzn\.asia|amzn\.to/i.test(url)) return buildAmazonAffiliateUrl(url);
  if (/(^|\.)rakuten\.co\.jp/i.test(url)) return buildRakutenAffiliateUrl(url);
  return buildValueCommerceUrl(url);
}

const SOURCE_LABELS = { rakuten: '楽天市場', yahoo: 'Yahoo!ショッピング', amazon: 'Amazon', other: 'その他' };

function renderWishSection(section) {
  if (section.items.length === 0) return '<p class="pl-row-empty">まだ何も登録されてないよ。</p>';
  return `<div class="card-grid">${section.items.map((item) => {
    const buyUrl = decorateLink(item.url);
    const keepaUrl = buildKeepaUrl(item.url);
    return `
      <div class="wish-card${item.purchased ? ' purchased-note' : ''}">
        ${item.image ? `<img class="wish-image" src="${escapeHtml(item.image)}" alt="">` : '<div class="wish-image wish-image-placeholder">🎁</div>'}
        <div class="wish-body">
          ${item.purchased ? '<div class="wish-source-badge">🎁 購入済み(誰かが贈ったかも)</div>' : ''}
          <div class="wish-title">${escapeHtml(item.title)}</div>
          <div class="wish-price">${item.price != null ? Number(item.price).toLocaleString() + '円' : '価格未登録'}</div>
          <div class="wish-links">
            ${buyUrl ? `<a href="${escapeHtml(buyUrl)}" target="_blank" rel="noopener sponsored" class="btn btn-primary wish-link-btn">🛒 見る・買う</a>` : ''}
            ${keepaUrl ? `<a href="${escapeHtml(keepaUrl)}" target="_blank" rel="noopener" class="btn wish-link-btn">📈 価格推移(Keepa)</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

function renderSimpleSection(section) {
  if (section.items.length === 0) return '<p class="pl-row-empty">まだ何も登録されてないよ。</p>';
  return `<div class="simple-list">${section.items.map((item) => {
    const link = decorateLink(item.link);
    return `
      <div class="simple-row${item.done ? ' done' : ''}">
        ${item.image ? `<img class="simple-thumb" src="${escapeHtml(item.image)}" alt="">` : ''}
        <div class="simple-body">
          <div class="simple-title">${escapeHtml(item.title)}</div>
          ${item.amount != null ? `<div class="card-detail">寄付金額: ${Number(item.amount).toLocaleString()}円</div>` : ''}
          ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener sponsored" class="simple-link">🔗 見る・予約する</a>` : ''}
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

(async function init() {
  const token = new URLSearchParams(window.location.search).get('t');
  const introEl = document.getElementById('shareIntro');
  const loadingEl = document.getElementById('shareLoading');
  const errorEl = document.getElementById('shareError');
  const sectionsEl = document.getElementById('shareSections');

  if (!token) {
    loadingEl.hidden = true;
    introEl.textContent = '';
    errorEl.textContent = 'リンクが正しくないみたい。共有された元のURLをそのまま開いてね。';
    errorEl.hidden = false;
    return;
  }

  let result;
  try {
    const res = await fetch('/.netlify/functions/share-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareToken: token }),
    });
    result = await res.json();
    if (!res.ok) throw new Error(result.error || '読み込みに失敗したよ');
  } catch (err) {
    loadingEl.hidden = true;
    introEl.textContent = '';
    errorEl.textContent = err.message || 'このリストは見つからなかったよ。公開が停止されたか、リンクが間違っているかも。';
    errorEl.hidden = false;
    return;
  }

  loadingEl.hidden = true;
  introEl.textContent = result.label || 'プレゼント選びやお出かけの参考にどうぞ。';
  document.title = (result.label ? `${result.label} - ` : '') + '公開リスト';

  const sections = result.sections || [];
  if (sections.length === 0) {
    errorEl.textContent = 'まだ何も公開されてないみたい。';
    errorEl.hidden = false;
    return;
  }

  sectionsEl.hidden = false;
  sectionsEl.innerHTML = sections.map((section) => `
    <section class="share-section">
      <h2>${escapeHtml(section.label)}</h2>
      ${section.type === 'wish' ? renderWishSection(section) : renderSimpleSection(section)}
    </section>
  `).join('');
})();
