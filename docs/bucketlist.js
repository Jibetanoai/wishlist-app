function renderBucketlist() {
  const list = document.getElementById('bucketList');
  const emptyState = document.getElementById('bucketEmptyState');
  const items = appData.bucketlist || [];
  emptyState.hidden = items.length !== 0;
  list.innerHTML = '';

  items.slice().sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)).forEach((item) => {
    const link = decorateLink(item.link);
    const row = document.createElement('div');
    row.className = `simple-row${item.done ? ' done' : ''}`;
    row.innerHTML = `
      <label class="task-check">
        <input type="checkbox" ${item.done ? 'checked' : ''} ${editUnlocked ? '' : 'disabled'}>
      </label>
      <div class="simple-body">
        <div class="simple-title">${escapeHtml(item.title)}</div>
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
        renderBucketlist();
      } catch (err) {
        alert(err.message);
      }
    });
    row.querySelector('.simple-body').addEventListener('click', () => { if (editUnlocked) openBucketModal(item); });
    list.appendChild(row);
  });
}

const bucketModalOverlay = document.getElementById('bucketModalOverlay');
const bucketForm = document.getElementById('bucketForm');
const deleteBucketBtn = document.getElementById('deleteBucketBtn');

function openAddBucketModal() {
  bucketForm.reset();
  document.getElementById('bucketId').value = '';
  document.getElementById('bucketModalTitle').textContent = 'やりたいことを追加';
  deleteBucketBtn.hidden = true;
  bucketModalOverlay.hidden = false;
}

function openBucketModal(item) {
  document.getElementById('bucketId').value = item.id;
  document.getElementById('bucket_title').value = item.title || '';
  document.getElementById('bucket_memo').value = item.memo || '';
  document.getElementById('bucket_link').value = item.link || '';
  document.getElementById('bucketModalTitle').textContent = 'やりたいことを編集';
  deleteBucketBtn.hidden = false;
  bucketModalOverlay.hidden = false;
}

function closeBucketModal() {
  bucketModalOverlay.hidden = true;
}

document.getElementById('addBucketBtn').addEventListener('click', openAddBucketModal);
document.querySelectorAll('.js-close-bucket').forEach((btn) => btn.addEventListener('click', closeBucketModal));
bucketModalOverlay.addEventListener('click', (e) => { if (e.target === bucketModalOverlay) closeBucketModal(); });

bucketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('bucketId').value;
  const body = {
    title: document.getElementById('bucket_title').value,
    memo: document.getElementById('bucket_memo').value || null,
    link: document.getElementById('bucket_link').value || null,
  };
  appData.bucketlist = appData.bucketlist || [];
  if (id) {
    const existing = appData.bucketlist.find((b) => b.id === id);
    if (existing) Object.assign(existing, body);
  } else {
    appData.bucketlist.push({ id: newId(), done: false, ...body, addedAt: new Date().toISOString() });
  }
  try {
    await saveData();
    closeBucketModal();
    renderBucketlist();
  } catch (err) {
    alert(err.message);
  }
});

deleteBucketBtn.addEventListener('click', async () => {
  const id = document.getElementById('bucketId').value;
  if (!id) return;
  if (!confirm('これを削除する?元には戻せないよ。')) return;
  appData.bucketlist = (appData.bucketlist || []).filter((b) => b.id !== id);
  try {
    await saveData();
    closeBucketModal();
    renderBucketlist();
  } catch (err) {
    alert(err.message);
  }
});
