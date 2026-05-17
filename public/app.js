/* ============================================================
   TaskFlow — Frontend Application
   ============================================================ */

const API = '/api';

// --- State ---
let columns = [];
let archivedTasks = [];
let editingTaskId = null;
let confirmCallback = null;

// --- DOM References ---
const boardEl = document.getElementById('board');
const modalOverlay = document.getElementById('modal-overlay');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const modalSubmitText = document.getElementById('modal-submit-text');
const taskIdInput = document.getElementById('task-id');
const taskColumnIdInput = document.getElementById('task-column-id');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const prioritySelector = document.getElementById('priority-selector');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarEl = document.getElementById('sidebar-archived');
const archivedListEl = document.getElementById('archived-list');
const archivedCountEl = document.getElementById('archived-count');
const confirmOverlay = document.getElementById('confirm-overlay');
const toastContainer = document.getElementById('toast-container');

// --- Icons (SVG templates) ---
const icons = {
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  archive: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  restore: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  empty: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  emptyArchive: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
};

const columnDotClasses = ['column__dot--todo', 'column__dot--progress', 'column__dot--done'];

// ============================================================
// API HELPERS
// ============================================================
async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function loadBoard() {
  try {
    columns = await fetchJSON(`${API}/columns`);
    renderBoard();
  } catch (err) {
    showToast('Erro ao carregar o quadro. Verifique a conexão com o servidor.', 'error');
  }
}

async function loadArchived() {
  try {
    archivedTasks = await fetchJSON(`${API}/tasks/archived`);
    renderArchived();
    updateArchivedCount();
  } catch (err) {
    showToast('Erro ao carregar tarefas arquivadas.', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================
function renderBoard() {
  boardEl.innerHTML = '';
  columns.forEach((col, idx) => {
    boardEl.appendChild(createColumnElement(col, idx));
  });
}

function createColumnElement(col, idx) {
  const colEl = document.createElement('div');
  colEl.className = 'column';
  colEl.dataset.columnId = col.id;

  const dotClass = columnDotClasses[idx] || columnDotClasses[0];
  const tasks = col.tasks || [];

  colEl.innerHTML = `
    <div class="column__header">
      <div class="column__header-left">
        <span class="column__dot ${dotClass}"></span>
        <span class="column__name">${escapeHtml(col.name)}</span>
      </div>
      <span class="column__count">${tasks.length}</span>
    </div>
    <div class="column__body ${tasks.length === 0 ? 'empty-state' : ''}" data-column-id="${col.id}">
      ${tasks.length === 0
        ? `<div class="column__empty">${icons.empty}<span>Nenhuma tarefa</span></div>`
        : tasks.map((t) => createTaskCardHTML(t)).join('')
      }
    </div>
    <button class="column__add-btn" data-column-id="${col.id}">
      ${icons.plus} Adicionar tarefa
    </button>
  `;

  // Drag & Drop events on column body
  const body = colEl.querySelector('.column__body');
  body.addEventListener('dragover', handleDragOver);
  body.addEventListener('dragenter', handleDragEnter);
  body.addEventListener('dragleave', handleDragLeave);
  body.addEventListener('drop', handleDrop);

  // Add task button
  colEl.querySelector('.column__add-btn').addEventListener('click', () => openModal(col.id));

  // Bind card events
  colEl.querySelectorAll('.task-card').forEach(bindCardEvents);

  return colEl;
}

function createTaskCardHTML(task) {
  const priority = task.priority || 'medium';
  const dateStr = formatDate(task.created_at);

  return `
    <div class="task-card" draggable="true" data-task-id="${task.id}" data-column-id="${task.column_id}">
      <div class="task-card__priority-bar task-card__priority-bar--${priority}"></div>
      <div class="task-card__title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="task-card__description">${escapeHtml(task.description)}</div>` : ''}
      <div class="task-card__footer">
        <span class="task-card__date">${dateStr}</span>
        <div class="task-card__actions">
          <button class="task-card__action-btn" data-action="edit" title="Editar">
            ${icons.edit}
          </button>
          <button class="task-card__action-btn task-card__action-btn--archive" data-action="archive" title="Arquivar">
            ${icons.archive}
          </button>
          <button class="task-card__action-btn task-card__action-btn--danger" data-action="delete" title="Excluir">
            ${icons.trash}
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindCardEvents(card) {
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);

  card.querySelectorAll('.task-card__action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const taskId = card.dataset.taskId;
      const task = findTaskById(parseInt(taskId));
      if (!task) return;

      if (action === 'edit') openModal(task.column_id, task);
      else if (action === 'archive') archiveTask(task.id);
      else if (action === 'delete') confirmDelete(task.id, task.title);
    });
  });
}

function renderArchived() {
  if (archivedTasks.length === 0) {
    archivedListEl.innerHTML = `
      <div class="sidebar__empty">
        ${icons.emptyArchive}
        <span class="sidebar__empty-text">Nenhuma tarefa arquivada</span>
      </div>
    `;
    return;
  }

  archivedListEl.innerHTML = archivedTasks
    .map(
      (task) => `
      <div class="archived-card" data-task-id="${task.id}">
        <div class="archived-card__title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="archived-card__description">${escapeHtml(task.description)}</div>` : ''}
        <div class="archived-card__meta">Arquivada em ${formatDate(task.archived_at)}</div>
        <div class="archived-card__actions">
          <button class="btn btn--secondary btn--sm" data-action="restore" data-task-id="${task.id}">
            ${icons.restore} Restaurar
          </button>
          <button class="btn btn--danger btn--sm" data-action="delete-permanent" data-task-id="${task.id}">
            ${icons.trash} Excluir
          </button>
        </div>
      </div>
    `
    )
    .join('');

  // Bind archived card actions
  archivedListEl.querySelectorAll('[data-action="restore"]').forEach((btn) => {
    btn.addEventListener('click', () => restoreTask(parseInt(btn.dataset.taskId)));
  });

  archivedListEl.querySelectorAll('[data-action="delete-permanent"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = archivedTasks.find((t) => t.id === parseInt(btn.dataset.taskId));
      confirmDeletePermanent(parseInt(btn.dataset.taskId), task?.title || 'esta tarefa');
    });
  });
}

function updateArchivedCount() {
  if (archivedTasks.length > 0) {
    archivedCountEl.textContent = archivedTasks.length;
    archivedCountEl.style.display = 'inline-flex';
  } else {
    archivedCountEl.style.display = 'none';
  }
}

// ============================================================
// MODAL (Create / Edit)
// ============================================================
function openModal(columnId, task = null) {
  editingTaskId = task ? task.id : null;

  modalTitle.textContent = task ? 'Editar Tarefa' : 'Nova Tarefa';
  modalSubmitText.textContent = task ? 'Salvar' : 'Criar Tarefa';

  taskIdInput.value = task ? task.id : '';
  taskColumnIdInput.value = columnId;
  taskTitleInput.value = task ? task.title : '';
  taskDescriptionInput.value = task ? task.description || '' : '';

  // Set priority
  const priority = task ? task.priority || 'medium' : 'medium';
  prioritySelector.querySelectorAll('.priority-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.priority === priority);
  });

  modalOverlay.classList.add('active');
  setTimeout(() => taskTitleInput.focus(), 200);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  editingTaskId = null;
  taskForm.reset();
}

// ============================================================
// CRUD OPERATIONS
// ============================================================
async function createTask(data) {
  try {
    await fetchJSON(`${API}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    showToast('Tarefa criada com sucesso!', 'success');
    await loadBoard();
  } catch (err) {
    showToast('Erro ao criar tarefa.', 'error');
  }
}

async function updateTask(id, data) {
  try {
    await fetchJSON(`${API}/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    showToast('Tarefa atualizada!', 'success');
    await loadBoard();
  } catch (err) {
    showToast('Erro ao atualizar tarefa.', 'error');
  }
}

async function archiveTask(id) {
  try {
    await fetchJSON(`${API}/tasks/${id}/archive`, { method: 'PUT' });
    showToast('Tarefa arquivada.', 'info');
    await loadBoard();
    await loadArchived();
  } catch (err) {
    showToast('Erro ao arquivar tarefa.', 'error');
  }
}

async function restoreTask(id) {
  try {
    await fetchJSON(`${API}/tasks/${id}/restore`, { method: 'PUT' });
    showToast('Tarefa restaurada ao quadro!', 'success');
    await loadBoard();
    await loadArchived();
  } catch (err) {
    showToast('Erro ao restaurar tarefa.', 'error');
  }
}

async function deleteTask(id) {
  try {
    await fetchJSON(`${API}/tasks/${id}`, { method: 'DELETE' });
    showToast('Tarefa excluída.', 'success');
    await loadBoard();
    await loadArchived();
  } catch (err) {
    showToast('Erro ao excluir tarefa.', 'error');
  }
}

async function moveTask(taskId, columnId) {
  try {
    await fetchJSON(`${API}/tasks/${taskId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ column_id: columnId }),
    });
    await loadBoard();
  } catch (err) {
    showToast('Erro ao mover tarefa.', 'error');
    await loadBoard();
  }
}

// ============================================================
// DRAG & DROP
// ============================================================
let draggedTaskId = null;

function handleDragStart(e) {
  draggedTaskId = parseInt(this.dataset.taskId);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedTaskId);
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.column').forEach((col) => col.classList.remove('drag-over'));
  draggedTaskId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  this.closest('.column').classList.add('drag-over');
}

function handleDragLeave(e) {
  const column = this.closest('.column');
  if (!column.contains(e.relatedTarget)) {
    column.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const column = this.closest('.column');
  column.classList.remove('drag-over');

  const columnId = parseInt(this.dataset.columnId);
  const taskId = parseInt(e.dataTransfer.getData('text/plain'));

  if (taskId && columnId) {
    moveTask(taskId, columnId);
  }
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function showConfirm(title, message, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = callback;
  confirmOverlay.classList.add('active');
}

function hideConfirm() {
  confirmOverlay.classList.remove('active');
  confirmCallback = null;
}

function confirmDelete(taskId, taskTitle) {
  showConfirm(
    'Excluir tarefa?',
    `"${taskTitle}" será removida permanentemente.`,
    () => deleteTask(taskId)
  );
}

function confirmDeletePermanent(taskId, taskTitle) {
  showConfirm(
    'Excluir permanentemente?',
    `"${taskTitle}" será removida para sempre. Esta ação não pode ser desfeita.`,
    () => deleteTask(taskId)
  );
}

// ============================================================
// SIDEBAR (Archived)
// ============================================================
function openSidebar() {
  loadArchived();
  sidebarOverlay.classList.add('active');
  sidebarEl.classList.add('active');
}

function closeSidebar() {
  sidebarOverlay.classList.remove('active');
  sidebarEl.classList.remove('active');
}

// ============================================================
// TOASTS
// ============================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const iconMap = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  toast.innerHTML = `${iconMap[type] || iconMap.info}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function findTaskById(id) {
  for (const col of columns) {
    const task = (col.tasks || []).find((t) => t.id === id);
    if (task) return task;
  }
  return null;
}

function getSelectedPriority() {
  const active = prioritySelector.querySelector('.priority-btn.active');
  return active ? active.dataset.priority : 'medium';
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Form submit
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    title: taskTitleInput.value.trim(),
    description: taskDescriptionInput.value.trim(),
    column_id: parseInt(taskColumnIdInput.value),
    priority: getSelectedPriority(),
  };

  if (!data.title) return;

  if (editingTaskId) {
    await updateTask(editingTaskId, data);
  } else {
    await createTask(data);
  }

  closeModal();
});

// Priority buttons
prioritySelector.querySelectorAll('.priority-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    prioritySelector.querySelectorAll('.priority-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Modal close
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Sidebar
document.getElementById('btn-archived').addEventListener('click', openSidebar);
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Confirm dialog
document.getElementById('confirm-ok').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  hideConfirm();
});
document.getElementById('confirm-cancel').addEventListener('click', hideConfirm);
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) hideConfirm();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (confirmOverlay.classList.contains('active')) hideConfirm();
    else if (modalOverlay.classList.contains('active')) closeModal();
    else if (sidebarEl.classList.contains('active')) closeSidebar();
  }
});

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadBoard();
  loadArchived();
});
