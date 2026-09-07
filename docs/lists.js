// やりたいこと・行きたいところ・行きたい飲食店・泊まりたいホテル・行きたいカフェは
// どれも「チェックできる・メモとリンクを持てるシンプルなリスト」という同じ形なので、
// 1つの仕組みを使い回す(設定を変えるだけで新しいリストを追加できるようにする)。
const SIMPLE_LISTS = {
  bucketlist: { icon: '✅', label: 'やりたいこと', listEl: 'bucketList', emptyEl: 'bucketEmptyState', placeholder: '例: 富士山に登る' },
  travellist: { icon: '✈️', label: '行きたい場所', listEl: 'travelList', emptyEl: 'travelEmptyState', placeholder: '例: 沖縄' },
  restaurantlist: { icon: '🍴', label: '飲食店', listEl: 'restaurantList', emptyEl: 'restaurantEmptyState', placeholder: '例: 〇〇焼肉店' },
  hotellist: { icon: '🏨', label: 'ホテル', listEl: 'hotelList', emptyEl: 'hotelEmptyState', placeholder: '例: 〇〇リゾート' },
  cafelist: { icon: '☕', label: 'カフェ', listEl: 'cafeList', emptyEl: 'cafeEmptyState', placeholder: '例: 〇〇珈琲' },
  furusatolist: { icon: '🎁', label: 'ふるさと納税', listEl: 'furusatoList', emptyEl: 'furusatoEmptyState', placeholder: '例: 宮崎県都城市 黒毛和牛', hasAmount: true },
};

function renderSimpleList(key) {
  const cfg = SIMPLE_LISTS[key];
  const list = document.getElementById(cfg.listEl);
  const emptyState = document.getElementById(cfg.emptyEl);
  const items = appData[key] || [];
  emptyState.hidden = items.length !== 0;
  list.innerHTML = '';

  const addRow = document.createElement('button');
  addRow.type = 'button';
  addRow.className = 'simple-row simple-row-add edit-only';
  addRow.hidden = !editUnlocked;
  addRow.textContent = `＋ ${cfg.label}を追加`;
  addRow.addEventListener('click', () => openAddSimpleModal(key));
  list.appendChild(addRow);

  items.slice().sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)).forEach((item) => {
    const link = decorateLink(item.link);
    const row = document.createElement('div');
    row.className = `simple-row${item.done ? ' done' : ''}`;
    row.innerHTML = `
      <label class="task-check">
        <input type="checkbox" ${item.done ? 'checked' : ''} ${editUnlocked ? '' : 'disabled'}>
      </label>
      <div class="simple-body">
        <div class="simple-title">${cfg.icon} ${escapeHtml(item.title)}</div>
        ${cfg.hasAmount && item.amount != null ? `<div class="card-detail">寄付金額: ${Number(item.amount).toLocaleString()}円</div>` : ''}
        ${item.memo ? `<div class="card-detail">${escapeHtml(item.memo)}</div>` : ''}
        ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="simple-link" onclick="event.stopPropagation()">🔗 関連リンク</a>` : ''}
      </div>
    `;
    row.querySelector('input[type="checkbox"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!editUnlocked) { e.preventDefault(); return; }
      item.done = e.target.checked;
      try {
        await saveData();
        renderSimpleList(key);
      } catch (err) {
        alert(err.message);
      }
    });
    row.querySelector('.simple-body').addEventListener('click', () => { if (editUnlocked) openSimpleModal(key, item); });
    list.appendChild(row);
  });
}

let currentSimpleListKey = null;
const simpleModalOverlay = document.getElementById('simpleModalOverlay');
const simpleForm = document.getElementById('simpleForm');
const deleteSimpleBtn = document.getElementById('deleteSimpleBtn');

function openAddSimpleModal(key) {
  currentSimpleListKey = key;
  simpleForm.reset();
  document.getElementById('simpleId').value = '';
  document.getElementById('simple_title').placeholder = SIMPLE_LISTS[key].placeholder || '';
  document.getElementById('simpleModalTitle').textContent = `${SIMPLE_LISTS[key].label}を追加`;
  document.getElementById('simpleAmountLabel').hidden = !SIMPLE_LISTS[key].hasAmount;
  deleteSimpleBtn.hidden = true;
  simpleModalOverlay.hidden = false;
}

function openSimpleModal(key, item) {
  currentSimpleListKey = key;
  document.getElementById('simpleId').value = item.id;
  document.getElementById('simple_title').value = item.title || '';
  document.getElementById('simple_amount').value = item.amount ?? '';
  document.getElementById('simple_memo').value = item.memo || '';
  document.getElementById('simple_link').value = item.link || '';
  document.getElementById('simpleModalTitle').textContent = `${SIMPLE_LISTS[key].label}を編集`;
  document.getElementById('simpleAmountLabel').hidden = !SIMPLE_LISTS[key].hasAmount;
  deleteSimpleBtn.hidden = false;
  simpleModalOverlay.hidden = false;
}

function closeSimpleModal() {
  simpleModalOverlay.hidden = true;
}

document.querySelectorAll('.js-close-simple').forEach((btn) => btn.addEventListener('click', closeSimpleModal));
simpleModalOverlay.addEventListener('click', (e) => { if (e.target === simpleModalOverlay) closeSimpleModal(); });

simpleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = currentSimpleListKey;
  const id = document.getElementById('simpleId').value;
  const amountVal = document.getElementById('simple_amount').value;
  const body = {
    title: document.getElementById('simple_title').value,
    amount: SIMPLE_LISTS[key].hasAmount && amountVal !== '' ? Number(amountVal) : null,
    memo: document.getElementById('simple_memo').value || null,
    link: document.getElementById('simple_link').value || null,
  };
  appData[key] = appData[key] || [];
  if (id) {
    const existing = appData[key].find((x) => x.id === id);
    if (existing) Object.assign(existing, body);
  } else {
    appData[key].push({ id: newId(), done: false, ...body, addedAt: new Date().toISOString() });
  }
  try {
    await saveData();
    closeSimpleModal();
    renderSimpleList(key);
  } catch (err) {
    alert(err.message);
  }
});

deleteSimpleBtn.addEventListener('click', async () => {
  const key = currentSimpleListKey;
  const id = document.getElementById('simpleId').value;
  if (!id) return;
  if (!confirm('これを削除する?元には戻せないよ。')) return;
  appData[key] = (appData[key] || []).filter((x) => x.id !== id);
  try {
    await saveData();
    closeSimpleModal();
    renderSimpleList(key);
  } catch (err) {
    alert(err.message);
  }
});
