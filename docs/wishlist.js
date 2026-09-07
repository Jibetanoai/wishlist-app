function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function lowestPrice(item) {
  const prices = (item.priceHistory || []).map((h) => h.price).filter((p) => p != null);
  if (item.price != null) prices.push(item.price);
  return prices.length ? Math.min(...prices) : null;
}

// 最初に記録された価格から現在価格までの変化率(値下がりならマイナス)。
// 履歴がなければ0(変化なし扱い)にして、値下がり順ソートで自然に末尾に来るようにする。
function priceChangePct(item) {
  const history = item.priceHistory || [];
  if (!history.length || item.price == null) return 0;
  const first = history[0].price;
  if (!first) return 0;
  return ((item.price - first) / first) * 100;
}

let currentWishSort = 'newest';

// priceHistory(過去の価格)+ 現在価格をまとめて時系列の折れ線グラフ(SVG)にする。
// 値上がりは赤、値下がりは緑で、最初から最新までの変化率も表示する。
function renderPriceHistoryChart(points) {
  if (points.length < 2) return '<p class="pl-row-empty">価格の変化がまだ記録されてないよ。</p>';
  const width = 320;
  const height = 140;
  const padding = 28;
  const prices = points.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const coords = points.map((p, i) => ({
    x: padding + (points.length === 1 ? 0 : (i / (points.length - 1)) * (width - padding * 2)),
    y: height - padding - ((p.price - minP) / range) * (height - padding * 2),
    ...p,
  }));
  const first = points[0].price;
  const last = points[points.length - 1].price;
  const changePct = first ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const changeColor = changePct > 0 ? 'var(--danger)' : changePct < 0 ? 'var(--ok)' : 'var(--text-muted)';
  const changeSign = changePct > 0 ? '+' : '';
  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const dots = coords.map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="${changeColor}"><title>${escapeHtml(c.date)}: ${Number(c.price).toLocaleString()}円</title></circle>`).join('');

  return `
    <div class="price-chart-change" style="color:${changeColor};">${changeSign}${changePct}%(${escapeHtml(points[0].date)}→${escapeHtml(points[points.length - 1].date)})</div>
    <svg viewBox="0 0 ${width} ${height}" class="price-chart-svg" preserveAspectRatio="none">
      <path d="${pathD}" fill="none" stroke="${changeColor}" stroke-width="2"></path>
      ${dots}
    </svg>
  `;
}

const SOURCE_LABELS = { rakuten: '楽天市場', yahoo: 'Yahoo!ショッピング', amazon: 'Amazon', other: 'その他' };

function renderWishlist() {
  const grid = document.getElementById('wishGrid');
  const emptyState = document.getElementById('wishEmptyState');
  const totalEl = document.getElementById('wishTotal');
  const list = appData.wishlist || [];
  emptyState.hidden = list.length !== 0;
  grid.innerHTML = '';

  const activeItems = list.filter((item) => !item.purchased);
  const pricedItems = activeItems.filter((item) => item.price != null);
  const unpricedCount = activeItems.length - pricedItems.length;
  const purchasedCount = list.length - activeItems.length;
  if (list.length > 0) {
    const total = pricedItems.reduce((sum, item) => sum + Number(item.price), 0);
    totalEl.innerHTML = `<span>合計金額(${pricedItems.length}件)${unpricedCount ? ` <span class="card-detail" style="display:inline;">・価格未登録${unpricedCount}件</span>` : ''}${purchasedCount ? ` <span class="card-detail" style="display:inline;">・購入済み${purchasedCount}件</span>` : ''}</span><strong>${total.toLocaleString()}円</strong>`;
    totalEl.hidden = false;
  } else {
    totalEl.hidden = true;
  }
  document.getElementById('wishSortBar').hidden = list.length === 0;

  const addCard = document.createElement('button');
  addCard.type = 'button';
  addCard.className = 'wish-card wish-card-add edit-only';
  addCard.hidden = !editUnlocked;
  addCard.textContent = '＋ ほしい物を追加';
  addCard.addEventListener('click', openAddWishModal);
  grid.appendChild(addCard);

  const sorted = list.slice().sort((a, b) => {
    if (!!a.purchased !== !!b.purchased) return a.purchased ? 1 : -1;
    if (currentWishSort === 'price_asc') return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (currentWishSort === 'price_desc') return (b.price ?? -Infinity) - (a.price ?? -Infinity);
    if (currentWishSort === 'discount') return priceChangePct(a) - priceChangePct(b);
    return (b.addedAt || '').localeCompare(a.addedAt || '');
  });

  sorted.forEach((item) => {
    const low = lowestPrice(item);
    const isLowest = item.price != null && low != null && item.price <= low;
    const buyUrl = decorateLink(item.url);
    // ソースが"amazon"タブ経由かどうかに関わらず、URLからASINが取れる
    // Amazon商品ならKeepaリンクを出す(共有追加やその他タブ経由でも同じ)。
    const keepaUrl = buildKeepaUrl(item.url);

    const card = document.createElement('div');
    card.className = `wish-card${item.purchased ? ' purchased' : ''}`;
    card.innerHTML = `
      <label class="wish-purchased-check" onclick="event.stopPropagation()">
        <input type="checkbox" ${item.purchased ? 'checked' : ''} ${editUnlocked ? '' : 'disabled'}> 購入済み
      </label>
      ${item.image ? `<img class="wish-image" src="${escapeHtml(item.image)}" alt="">` : '<div class="wish-image wish-image-placeholder">🎁</div>'}
      <div class="wish-body">
        <div class="wish-source-badge">${escapeHtml(SOURCE_LABELS[item.source] || 'その他')}</div>
        <div class="wish-title">${escapeHtml(item.title)}</div>
        <div class="wish-price">${item.price != null ? Number(item.price).toLocaleString() + '円' : '価格未登録'}${isLowest && item.priceHistory && item.priceHistory.length ? ' <span class="wish-lowest-badge">最安値</span>' : ''}</div>
        ${item.memo ? `<div class="card-detail">${escapeHtml(item.memo)}</div>` : ''}
        <div class="wish-links">
          ${buyUrl ? `<a href="${escapeHtml(buyUrl)}" target="_blank" rel="noopener" class="btn btn-primary wish-link-btn" onclick="event.stopPropagation()">🛒 見る・買う</a>` : ''}
          ${keepaUrl ? `<a href="${escapeHtml(keepaUrl)}" target="_blank" rel="noopener" class="btn wish-link-btn" onclick="event.stopPropagation()">📈 価格推移(Keepa)</a>` : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => { if (editUnlocked) openWishModal(item); });
    card.querySelector('.wish-purchased-check input').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!editUnlocked) { e.preventDefault(); return; }
      item.purchased = e.target.checked;
      try {
        await saveData();
        renderWishlist();
      } catch (err) {
        alert(err.message);
      }
    });
    grid.appendChild(card);
  });
}

document.getElementById('wishSortSelect').addEventListener('change', (e) => {
  currentWishSort = e.target.value;
  renderWishlist();
});

document.getElementById('inviteBtn').addEventListener('click', async () => {
  const url = window.location.origin + '/';
  const shareData = { title: 'ウィッシュリスト', text: 'このアプリで自分だけのほしい物リストを作れるよ!', url };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch { /* キャンセルされても何もしない */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    alert('リンクをコピーしたよ。友達に貼って送ってね。');
  } catch {
    alert(url);
  }
});

const wishModalOverlay = document.getElementById('wishModalOverlay');
const wishForm = document.getElementById('wishForm');
const deleteWishBtn = document.getElementById('deleteWishBtn');
const rakutenSearchPanel = document.getElementById('rakutenSearchPanel');

function setWishSourceTab(source) {
  document.querySelectorAll('#wishSourceTabs .tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });
  document.getElementById('wishSource').value = source;
  if (source === 'rakuten') {
    rakutenSearchPanel.hidden = false;
    wishForm.hidden = true;
  } else {
    rakutenSearchPanel.hidden = true;
    wishForm.hidden = false;
  }
}

document.getElementById('wishSourceTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  setWishSourceTab(btn.dataset.source);
});

let currentEditingWishItem = null;

function openAddWishModal() {
  currentEditingWishItem = null;
  wishForm.reset();
  document.getElementById('wishId').value = '';
  document.getElementById('rakutenKeyword').value = '';
  document.getElementById('rakutenResults').innerHTML = '';
  document.getElementById('rakutenSearchStatus').hidden = true;
  document.getElementById('wishImageResults').innerHTML = '';
  document.getElementById('wishPriceCommentLabel').hidden = true;
  document.getElementById('wishPriceHistoryBtn').hidden = true;
  document.getElementById('wishModalTitle').textContent = 'ほしい物を追加';
  deleteWishBtn.hidden = true;
  setWishSourceTab('rakuten');
  wishModalOverlay.hidden = false;
}

function openWishModal(item) {
  currentEditingWishItem = item;
  document.getElementById('wishId').value = item.id;
  document.getElementById('wish_title').value = item.title || '';
  document.getElementById('wish_price').value = item.price ?? '';
  document.getElementById('wish_image').value = item.image || '';
  document.getElementById('wish_url').value = item.url || '';
  document.getElementById('wish_memo').value = item.memo || '';
  document.getElementById('wish_price_comment').value = '';
  document.getElementById('wishImageResults').innerHTML = '';
  document.getElementById('wishPriceCommentLabel').hidden = false;
  document.getElementById('wishPriceHistoryBtn').hidden = !(item.priceHistory && item.priceHistory.length);
  document.getElementById('wishModalTitle').textContent = 'ほしい物を編集';
  deleteWishBtn.hidden = false;
  setWishSourceTab(item.source || 'other');
  document.querySelectorAll('#wishSourceTabs .tab').forEach((btn) => { btn.hidden = true; });
  rakutenSearchPanel.hidden = true;
  wishForm.hidden = false;
  wishModalOverlay.hidden = false;
}

function closeWishModal() {
  wishModalOverlay.hidden = true;
  document.querySelectorAll('#wishSourceTabs .tab').forEach((btn) => { btn.hidden = false; });
}

document.querySelectorAll('.js-close-wish').forEach((btn) => btn.addEventListener('click', closeWishModal));
wishModalOverlay.addEventListener('click', (e) => { if (e.target === wishModalOverlay) closeWishModal(); });

document.getElementById('rakutenKeyword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('rakutenSearchBtn').click();
  }
});

// 楽天市場とYahoo!ショッピングを同時に検索して、価格の安い順にまとめて表示する。
// 片方のAPIが未設定/エラーでも、もう片方の結果だけは出せるようにしておく。
async function searchOneSource(url, keyword, sourceLabel) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    });
    const body = await res.json();
    if (!res.ok) return { items: [], error: body.error || `${sourceLabel}の検索に失敗したよ` };
    return { items: body.items || [] };
  } catch {
    return { items: [], error: `${sourceLabel}への通信に失敗したよ` };
  }
}

document.getElementById('rakutenSearchBtn').addEventListener('click', async (e) => {
  const keyword = document.getElementById('rakutenKeyword').value.trim();
  if (!keyword) return;
  const btn = e.currentTarget;
  const statusEl = document.getElementById('rakutenSearchStatus');
  const resultsEl = document.getElementById('rakutenResults');
  btn.disabled = true;
  statusEl.hidden = false;
  statusEl.textContent = '検索中…';
  resultsEl.innerHTML = '';

  const [rakuten, yahoo] = await Promise.all([
    searchOneSource('/.netlify/functions/rakuten-search', keyword, '楽天'),
    searchOneSource('/.netlify/functions/yahoo-search', keyword, 'Yahoo!ショッピング'),
  ]);
  btn.disabled = false;

  const items = [
    ...rakuten.items.map((item) => ({ ...item, source: 'rakuten', sourceLabel: '楽天市場' })),
    ...yahoo.items.map((item) => ({ ...item, source: 'yahoo', sourceLabel: 'Yahoo!ショッピング' })),
  ].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const errors = [rakuten.error, yahoo.error].filter(Boolean);
  statusEl.textContent = errors.join(' / ');
  statusEl.hidden = errors.length === 0;

  if (items.length === 0) {
    resultsEl.innerHTML = '<p class="pl-row-empty">見つからなかったよ。別のキーワードで試してみて。</p>';
    return;
  }
  resultsEl.innerHTML = items.map((item, idx) => `
    <div class="rakuten-result-row" data-idx="${idx}">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : '<div class="rakuten-result-noimg">🎁</div>'}
      <div class="rakuten-result-body">
        <div class="rakuten-result-name">${escapeHtml(item.name)}</div>
        <div class="rakuten-result-price">${Number(item.price).toLocaleString()}円<span class="rakuten-result-shop">${escapeHtml(item.sourceLabel)}${item.shopName ? ' ・ ' + escapeHtml(item.shopName) : ''}</span></div>
      </div>
      <button type="button" class="btn btn-primary rakuten-add-btn" data-idx="${idx}">追加</button>
    </div>
  `).join('');
  resultsEl.querySelectorAll('.rakuten-add-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = items[Number(btn.dataset.idx)];
      const record = {
        id: newId(), source: item.source, title: item.name, price: item.price,
        image: item.image, url: item.url, memo: null, priceHistory: [], addedAt: new Date().toISOString(),
      };
      appData.wishlist = appData.wishlist || [];
      appData.wishlist.push(record);
      try {
        await saveData();
        closeWishModal();
        renderWishlist();
      } catch (err) {
        alert(err.message);
      }
    });
  });
});

document.getElementById('wishImageSearchBtn').addEventListener('click', async (e) => {
  const keyword = document.getElementById('wish_title').value.trim();
  if (!keyword) { alert('先に商品名を入力してね。'); return; }
  const btn = e.currentTarget;
  const resultsEl = document.getElementById('wishImageResults');
  btn.disabled = true;
  btn.textContent = '検索中…';
  resultsEl.innerHTML = '';

  const [rakuten, yahoo] = await Promise.all([
    searchOneSource('/.netlify/functions/rakuten-search', keyword, '楽天'),
    searchOneSource('/.netlify/functions/yahoo-search', keyword, 'Yahoo!ショッピング'),
  ]);
  btn.disabled = false;
  btn.textContent = '🔍 商品名で画像を検索';

  const items = [
    ...rakuten.items.map((item) => ({ ...item, sourceLabel: '楽天市場' })),
    ...yahoo.items.map((item) => ({ ...item, sourceLabel: 'Yahoo!ショッピング' })),
  ].filter((item) => item.image).slice(0, 12);

  if (items.length === 0) {
    resultsEl.innerHTML = '<p class="pl-row-empty">画像付きの候補が見つからなかったよ。</p>';
    return;
  }
  resultsEl.innerHTML = items.map((item, idx) => `
    <div class="rakuten-result-row" data-idx="${idx}">
      <img src="${escapeHtml(item.image)}" alt="">
      <div class="rakuten-result-body">
        <div class="rakuten-result-name">${escapeHtml(item.name)}</div>
        <div class="rakuten-result-price">${Number(item.price).toLocaleString()}円<span class="rakuten-result-shop">${escapeHtml(item.sourceLabel)}</span></div>
      </div>
      <button type="button" class="btn btn-primary rakuten-add-btn" data-idx="${idx}">これ</button>
    </div>
  `).join('');
  resultsEl.querySelectorAll('.rakuten-add-btn').forEach((pickBtn) => {
    pickBtn.addEventListener('click', () => {
      const item = items[Number(pickBtn.dataset.idx)];
      document.getElementById('wish_image').value = item.image;
      resultsEl.innerHTML = '';
    });
  });
});

wishForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('wishId').value;
  const source = document.getElementById('wishSource').value;
  const newPrice = document.getElementById('wish_price').value !== '' ? Number(document.getElementById('wish_price').value) : null;
  const url = document.getElementById('wish_url').value || null;
  const enteredTitle = document.getElementById('wish_title').value.trim();
  if (!enteredTitle && !url) {
    alert('商品名かURLのどちらかは入れてね。');
    return;
  }
  const body = {
    source,
    title: enteredTitle || titleFromUrl(url),
    price: newPrice,
    image: document.getElementById('wish_image').value || null,
    url,
    memo: document.getElementById('wish_memo').value || null,
  };

  const priceComment = document.getElementById('wish_price_comment').value.trim() || null;

  appData.wishlist = appData.wishlist || [];
  if (id) {
    const existing = appData.wishlist.find((w) => w.id === id);
    if (existing) {
      const priceHistory = existing.priceHistory || [];
      if (existing.price != null && existing.price !== newPrice) {
        priceHistory.push({ date: localDateStr(), price: existing.price, comment: priceComment });
      }
      Object.assign(existing, body, { priceHistory });
    }
  } else {
    appData.wishlist.push({ id: newId(), ...body, priceHistory: [], addedAt: new Date().toISOString() });
  }

  try {
    await saveData();
    closeWishModal();
    renderWishlist();
  } catch (err) {
    alert(err.message);
  }
});

deleteWishBtn.addEventListener('click', async () => {
  const id = document.getElementById('wishId').value;
  if (!id) return;
  if (!confirm('これを削除する?元には戻せないよ。')) return;
  appData.wishlist = (appData.wishlist || []).filter((w) => w.id !== id);
  try {
    await saveData();
    closeWishModal();
    renderWishlist();
  } catch (err) {
    alert(err.message);
  }
});

const priceHistoryModalOverlay = document.getElementById('priceHistoryModalOverlay');

function openPriceHistoryModal(item) {
  const history = item.priceHistory || [];
  const points = history.slice();
  if (item.price != null) {
    points.push({ date: localDateStr(), price: item.price, comment: item.priceComment || null, isCurrent: true });
  }

  const contentEl = document.getElementById('priceHistoryContent');
  contentEl.innerHTML = `
    ${renderPriceHistoryChart(points)}
    <div class="price-history-list">
      ${points.map((p, idx) => `
        <div class="price-history-row">
          <div class="price-history-date">${escapeHtml(p.date)}${p.isCurrent ? '(現在)' : ''}</div>
          <div class="price-history-price">${Number(p.price).toLocaleString()}円</div>
          <input type="text" class="price-history-comment" data-idx="${idx}" placeholder="メモ" value="${escapeHtml(p.comment || '')}">
        </div>
      `).join('')}
    </div>
  `;

  contentEl.querySelectorAll('.price-history-comment').forEach((input) => {
    input.addEventListener('change', async () => {
      const idx = Number(input.dataset.idx);
      const comment = input.value.trim() || null;
      if (points[idx].isCurrent) {
        item.priceComment = comment;
      } else {
        // historyの何番目かは、現在価格分(末尾に足した1件)を除いたインデックスに対応する。
        const historyIdx = idx;
        if (item.priceHistory && item.priceHistory[historyIdx]) {
          item.priceHistory[historyIdx].comment = comment;
        }
      }
      try {
        await saveData();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  priceHistoryModalOverlay.hidden = false;
}

document.getElementById('wishPriceHistoryBtn').addEventListener('click', () => {
  if (currentEditingWishItem) openPriceHistoryModal(currentEditingWishItem);
});

document.querySelectorAll('.js-close-price-history').forEach((btn) => btn.addEventListener('click', () => {
  priceHistoryModalOverlay.hidden = true;
  renderWishlist();
}));
priceHistoryModalOverlay.addEventListener('click', (e) => {
  if (e.target === priceHistoryModalOverlay) { priceHistoryModalOverlay.hidden = true; renderWishlist(); }
});
