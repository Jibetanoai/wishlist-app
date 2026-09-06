function renderTravellist() {
  const list = document.getElementById('travelList');
  const emptyState = document.getElementById('travelEmptyState');
  const items = appData.travellist || [];
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
        <div class="simple-title">✈️ ${escapeHtml(item.title)}</div>
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
        renderTravellist();
      } catch (err) {
        alert(err.message);
      }
    });
    row.querySelector('.simple-body').addEventListener('click', () => { if (editUnlocked) openTravelModal(item); });
    list.appendChild(row);
  });
}

const travelModalOverlay = document.getElementById('travelModalOverlay');
const travelForm = document.getElementById('travelForm');
const deleteTravelBtn = document.getElementById('deleteTravelBtn');

function openAddTravelModal() {
  travelForm.reset();
  document.getElementById('travelId').value = '';
  document.getElementById('travelModalTitle').textContent = '行きたい場所を追加';
  deleteTravelBtn.hidden = true;
  travelModalOverlay.hidden = false;
}

function openTravelModal(item) {
  document.getElementById('travelId').value = item.id;
  document.getElementById('travel_title').value = item.title || '';
  document.getElementById('travel_memo').value = item.memo || '';
  document.getElementById('travel_link').value = item.link || '';
  document.getElementById('travelModalTitle').textContent = '行きたい場所を編集';
  deleteTravelBtn.hidden = false;
  travelModalOverlay.hidden = false;
}

function closeTravelModal() {
  travelModalOverlay.hidden = true;
}

document.getElementById('addTravelBtn').addEventListener('click', openAddTravelModal);
document.querySelectorAll('.js-close-travel').forEach((btn) => btn.addEventListener('click', closeTravelModal));
travelModalOverlay.addEventListener('click', (e) => { if (e.target === travelModalOverlay) closeTravelModal(); });

travelForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('travelId').value;
  const body = {
    title: document.getElementById('travel_title').value,
    memo: document.getElementById('travel_memo').value || null,
    link: document.getElementById('travel_link').value || null,
  };
  appData.travellist = appData.travellist || [];
  if (id) {
    const existing = appData.travellist.find((t) => t.id === id);
    if (existing) Object.assign(existing, body);
  } else {
    appData.travellist.push({ id: newId(), done: false, ...body, addedAt: new Date().toISOString() });
  }
  try {
    await saveData();
    closeTravelModal();
    renderTravellist();
  } catch (err) {
    alert(err.message);
  }
});

deleteTravelBtn.addEventListener('click', async () => {
  const id = document.getElementById('travelId').value;
  if (!id) return;
  if (!confirm('これを削除する?元には戻せないよ。')) return;
  appData.travellist = (appData.travellist || []).filter((t) => t.id !== id);
  try {
    await saveData();
    closeTravelModal();
    renderTravellist();
  } catch (err) {
    alert(err.message);
  }
});
