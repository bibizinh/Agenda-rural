const DB_NAME = 'agenda-rural';
const DB_VERSION = 1;
const STORE_NAMES = ['activities', 'stock', 'harvests'];
let db;
let installPrompt;
let toastTimer;

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const name of STORE_NAMES) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveRecord(store, record) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(store, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Sem data' : new Intl.DateTimeFormat('pt-BR').format(date);
}

function setPage(pageId) {
  document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page.id === pageId));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === pageId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function emptyState(message) { return `<div class="empty-state">${escapeHTML(message)}</div>`; }

function activityCard(item) {
  return `<article class="record-card ${item.done ? 'is-done' : ''}"><div class="record-icon">${item.done ? '✅' : '📋'}</div><div class="record-content"><div class="record-title-row"><h3>${escapeHTML(item.title)}</h3><span class="status-pill ${item.done ? 'done' : 'pending'}">${item.done ? 'Concluída' : 'Pendente'}</span></div><p>${escapeHTML(item.category || 'Atividade')}${item.area ? ` · ${escapeHTML(item.area)}` : ''}</p><small>📅 ${formatDate(item.date)}</small>${item.notes ? `<p class="record-notes">${escapeHTML(item.notes)}</p>` : ''}</div><div class="record-actions">${!item.done ? `<button class="small-action complete-action" data-action="complete" data-store="activities" data-id="${escapeHTML(item.id)}" aria-label="Concluir ${escapeHTML(item.title)}">✓</button>` : ''}<button class="small-action delete-action" data-action="delete" data-store="activities" data-id="${escapeHTML(item.id)}" aria-label="Excluir ${escapeHTML(item.title)}">×</button></div></article>`;
}

function stockCard(item) {
  const low = Number(item.quantity) <= Number(item.minimum || 0);
  return `<article class="record-card"><div class="record-icon">🧺</div><div class="record-content"><div class="record-title-row"><h3>${escapeHTML(item.name)}</h3>${low ? '<span class="status-pill low">Estoque baixo</span>' : ''}</div><p>${escapeHTML(item.category || 'Insumo')}${item.location ? ` · ${escapeHTML(item.location)}` : ''}</p><div class="stock-quantity"><strong>${escapeHTML(item.quantity)}</strong> ${escapeHTML(item.unit)} <span>· mínimo ${escapeHTML(item.minimum || '0')}</span></div></div><button class="small-action delete-action" data-action="delete" data-store="stock" data-id="${escapeHTML(item.id)}" aria-label="Excluir ${escapeHTML(item.name)}">×</button></article>`;
}

function harvestCard(item) {
  return `<article class="record-card"><div class="record-icon">🌿</div><div class="record-content"><div class="record-title-row"><h3>${escapeHTML(item.crop)}</h3><span class="status-pill ${item.status === 'Colhida' ? 'done' : 'pending'}">${escapeHTML(item.status)}</span></div><p>${item.area ? `📍 ${escapeHTML(item.area)}` : 'Área não informada'}${item.variety ? ` · ${escapeHTML(item.variety)}` : ''}</p><small>Plantio: ${formatDate(item.plantingDate)}${item.expectedDate ? ` · Previsão: ${formatDate(item.expectedDate)}` : ''}</small>${item.notes ? `<p class="record-notes">${escapeHTML(item.notes)}</p>` : ''}</div><button class="small-action delete-action" data-action="delete" data-store="harvests" data-id="${escapeHTML(item.id)}" aria-label="Excluir safra de ${escapeHTML(item.crop)}">×</button></article>`;
}

async function render() {
  const [activities, stock, harvests] = await Promise.all(STORE_NAMES.map(getAll));
  activities.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  $('#stat-activities').textContent = activities.filter((item) => !item.done).length;
  $('#stat-stock').textContent = stock.length;
  $('#stat-harvests').textContent = harvests.filter((item) => item.status !== 'Colhida').length;

  const upcoming = activities.filter((item) => !item.done).slice(0, 3);
  $('#upcoming-list').innerHTML = upcoming.length ? upcoming.map(activityCard).join('') : emptyState('Nenhuma atividade cadastrada. Adicione uma tarefa para começar.');

  const activityQuery = ($('#activity-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const filter = $('#activity-filter')?.value || 'all';
  const filteredActivities = activities.filter((item) => {
    const matchesText = `${item.title} ${item.category} ${item.area}`.toLocaleLowerCase('pt-BR').includes(activityQuery);
    return matchesText && (filter === 'all' || (filter === 'done' ? item.done : !item.done));
  });
  $('#activities-list').innerHTML = filteredActivities.length ? filteredActivities.map(activityCard).join('') : emptyState('Nenhuma atividade encontrada.');

  const stockQuery = ($('#stock-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const filteredStock = stock.filter((item) => `${item.name} ${item.category}`.toLocaleLowerCase('pt-BR').includes(stockQuery));
  $('#stock-list').innerHTML = filteredStock.length ? filteredStock.map(stockCard).join('') : emptyState('Seu estoque está vazio. Cadastre o primeiro insumo.');
  harvests.sort((a, b) => (b.plantingDate || '').localeCompare(a.plantingDate || ''));
  $('#harvests-list').innerHTML = harvests.length ? harvests.map(harvestCard).join('') : emptyState('Nenhuma safra registrada. Cadastre seu primeiro plantio.');
}

const field = (name, label, type = 'text', options = {}) => {
  const required = options.required ? 'required' : '';
  const placeholder = options.placeholder ? `placeholder="${escapeHTML(options.placeholder)}"` : '';
  if (type === 'select') return `<label class="form-field">${label}<select name="${name}" ${required}>${options.options.map((option) => `<option value="${escapeHTML(option)}">${escapeHTML(option)}</option>`).join('')}</select></label>`;
  if (type === 'textarea') return `<label class="form-field">${label}<textarea name="${name}" rows="3" ${placeholder}></textarea></label>`;
  return `<label class="form-field">${label}<input name="${name}" type="${type}" ${required} ${placeholder} ${options.min !== undefined ? `min="${options.min}"` : ''} ${options.step ? `step="${options.step}"` : ''}></label>`;
};

const formConfig = {
  activity: { store: 'activities', title: 'Nova atividade', eyebrow: 'PLANEJE SUA ROTINA', fields: () => field('title', 'Nome da atividade', 'text', { required: true, placeholder: 'Ex.: Adubar talhão norte' }) + `<div class="field-row">${field('category', 'Tipo', 'select', { options: ['Plantio', 'Irrigação', 'Adubação', 'Controle de pragas', 'Colheita', 'Manutenção', 'Outro'] })}${field('date', 'Data', 'date', { required: true })}</div>` + field('area', 'Talhão / área', 'text', { placeholder: 'Ex.: Talhão 2' }) + field('notes', 'Observações', 'textarea', { placeholder: 'Detalhes importantes...' }) },
  stock: { store: 'stock', title: 'Novo insumo', eyebrow: 'CONTROLE DE ESTOQUE', fields: () => field('name', 'Nome do insumo', 'text', { required: true, placeholder: 'Ex.: Semente de milho' }) + `<div class="field-row">${field('category', 'Categoria', 'select', { options: ['Sementes', 'Fertilizantes', 'Defensivos', 'Combustível', 'Ração', 'Ferramentas', 'Outro'] })}${field('unit', 'Unidade', 'select', { options: ['kg', 'g', 'L', 'mL', 'unidade', 'saca', 'tonelada'] })}</div>` + `<div class="field-row">${field('quantity', 'Quantidade atual', 'number', { required: true, min: 0, step: 'any' })}${field('minimum', 'Estoque mínimo', 'number', { min: 0, step: 'any' })}</div>` + field('location', 'Local de armazenamento', 'text', { placeholder: 'Ex.: Galpão principal' }) },
  harvest: { store: 'harvests', title: 'Nova safra', eyebrow: 'REGISTRO DE PLANTIO', fields: () => field('crop', 'Cultura', 'text', { required: true, placeholder: 'Ex.: Milho' }) + `<div class="field-row">${field('variety', 'Variedade', 'text', { placeholder: 'Ex.: Híbrido 123' })}${field('area', 'Área plantada', 'text', { placeholder: 'Ex.: 2 hectares' })}</div>` + `<div class="field-row">${field('plantingDate', 'Data do plantio', 'date', { required: true })}${field('expectedDate', 'Previsão de colheita', 'date')}</div>` + field('status', 'Situação', 'select', { options: ['Em andamento', 'Colhida'] }) + field('notes', 'Observações', 'textarea', { placeholder: 'Detalhes do cultivo...' }) }
};

function openForm(kind) {
  const config = formConfig[kind];
  $('#form-title').textContent = config.title;
  $('#form-eyebrow').textContent = config.eyebrow;
  $('#form-fields').innerHTML = config.fields();
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = $('#form-fields input[type="date"]');
  if (dateInput && !dateInput.value) dateInput.value = today;
  $('#record-form').dataset.kind = kind;
  $('#record-dialog').showModal();
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const kind = form.dataset.kind;
  const data = Object.fromEntries(new FormData(form).entries());
  if (kind === 'stock') {
    data.quantity = Number(data.quantity);
    data.minimum = Number(data.minimum || 0);
  }
  await saveRecord(formConfig[kind].store, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...data, ...(kind === 'activity' ? { done: false } : {}) });
  $('#record-dialog').close();
  form.reset();
  await render();
  showToast('Registro salvo neste aparelho.');
}

async function handleRecordAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, store, id } = button.dataset;
  if (action === 'delete') {
    if (!window.confirm('Deseja excluir este registro?')) return;
    await deleteRecord(store, id);
    showToast('Registro excluído.');
  }
  if (action === 'complete') {
    const items = await getAll(store);
    const item = items.find((entry) => entry.id === id);
    if (item) await saveRecord(store, { ...item, done: true });
    showToast('Atividade concluída!');
  }
  await render();
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  const status = $('#connection-status');
  status.classList.toggle('offline', !online);
  status.querySelector('span').textContent = online ? 'Conectado' : 'Offline';
}

async function init() {
  try {
    db = await openDatabase();
    await render();
  } catch (error) {
    console.error('Não foi possível abrir o armazenamento local:', error);
    showToast('Erro ao abrir o armazenamento local. Verifique se o navegador permite dados do site.');
  }

  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.page)));
  document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.open)));
  document.querySelectorAll('[data-form]').forEach((button) => button.addEventListener('click', () => openForm(button.dataset.form)));
  $('#record-form').addEventListener('submit', handleSubmit);
  $('#close-dialog').addEventListener('click', () => $('#record-dialog').close());
  $('#cancel-dialog').addEventListener('click', () => $('#record-dialog').close());
  document.addEventListener('click', handleRecordAction);
  $('#activity-search').addEventListener('input', render);
  $('#activity-filter').addEventListener('change', render);
  $('#stock-search').addEventListener('input', render);
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    $('#install-button').hidden = false;
  });
  $('#install-button').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    $('#install-button').hidden = true;
  });
  window.addEventListener('appinstalled', () => showToast('Agenda Rural instalado com sucesso!'));

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.error('Falha ao registrar o Service Worker:', error));
  }
}

document.addEventListener('DOMContentLoaded', init);
