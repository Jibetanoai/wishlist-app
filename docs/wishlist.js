function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function lowestPrice(item) {
  const prices = (item.priceHistory || []).map((h) => h.price).filter((p) => p != null);
  if (item.price != null) prices.push(item.price);
  return prices.length ? Math.min(...prices) : null;
}

const SOURCE_LABELS = { rakuten: '楽天市場', yahoo: 'Yahoo!ショッピング', amazon: 'Amazon', other: 'その他' };

function renderWishlist() {
  const grid = document.getElementById('wishGrid');
  const emptyState = document.getElementById('wishEmptyState');
  const totalEl = document.getElementById('wishTotal');
  const list = appData.wishlist || [];
  emptyState.hidden = list.length !== 0;
  grid.innerHTML = '';

  const pricedItems = list.filter((item) => item.price != null);
  const unpricedCount = list.length - pricedItems.length;
  if (list.length > 0) {
    const total = pricedItems.reduce((sum, item) => sum + Number(item.price), 0);
    totalEl.innerHTML = `<span>合計金額(${pricedItems.length}件)${unpricedCount ? ` <span class="card-detail" style="display:inline;">・価格未登録${unpricedCount}件</span>` : ''}</span><strong>${total.toLocaleString()}円</strong>`;
    totalEl.hidden = false;
  } else {
    totalEl.hidden = true;
  }

  const addCard = document.createElement('button');
  addCard.type = 'button';
  addCard.className = 'wish-card wish-card-add edit-only';
  addCard.hidden = !editUnlocked;
  addCard.textContent = '＋ ほしい物を追加';
  addCard.addEventListener('click', openAddWishModal);
  grid.appendChild(addCard);

  list.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')).forEach((item) => {
    const low = lowestPrice(item);
    const isLowest = item.price != null && low != null && item.price <= low;
    const buyUrl = decorateLink(item.url);
    // ソースが"amazon"タブ経由かどうかに関わらず、URLからASINが取れる
    // Amazon商品ならKeepaリンクを出す(共有追加やその他タブ経由でも同じ)。
    const keepaUrl = buildKeepaUrl(item.url);

    const card = document.createElement('div');
    card.className = 'wish-card';
    card.innerHTML = `
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
    grid.appendChild(card);
  });
}

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

function openAddWishModal() {
  wishForm.reset();
  document.getElementById('wishId').value = '';
  document.getElementById('rakutenKeyword').value = '';
  document.getElementById('rakutenResults').innerHTML = '';
  document.getElementById('rakutenSearchStatus').hidden = true;
  document.getElementById('wishImageResults').innerHTML = '';
  document.getElementById('wishModalTitle').textContent = 'ほしい物を追加';
  deleteWishBtn.hidden = true;
  setWishSourceTab('rakuten');
  wishModalOverlay.hidden = false;
}

function openWishModal(item) {
  document.getElementById('wishId').value = item.id;
  document.getElementById('wish_title').value = item.title || '';
  document.getElementById('wish_price').value = item.price ?? '';
  document.getElementById('wish_image').value = item.image || '';
  document.getElementById('wish_url').value = item.url || '';
  document.getElementById('wish_memo').value = item.memo || '';
  document.getElementById('wishImageResults').innerHTML = '';
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

  appData.wishlist = appData.wishlist || [];
  if (id) {
    const existing = appData.wishlist.find((w) => w.id === id);
    if (existing) {
      const priceHistory = existing.priceHistory || [];
      if (existing.price != null && existing.price !== newPrice) {
        priceHistory.push({ date: localDateStr(), price: existing.price });
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
