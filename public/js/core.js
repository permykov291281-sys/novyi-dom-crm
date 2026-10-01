/* «Новый дом · CRM» — каркас интерфейса: данные, роутер, меню, окна, утилиты (без фреймворков). */
(() => {
'use strict';
const App = (window.App = { pages: {}, S: null, cache: {} });

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
App.ROLE = { admin: 'Администратор', manager: 'Менеджер', master: 'Мастер', client: 'Клиент' };
App.TASK = { assigned: 'Назначена', accepted: 'Принята', in_progress: 'В работе', done: 'Выполнена', declined: 'Отклонена' };
App.TASK_COLOR = { assigned: 'amber', accepted: 'blue', in_progress: 'violet', done: 'green', declined: 'red' };
App.STAGE_COLOR = { new: 'blue', qualified: 'cyan', measure: 'violet', estimate: 'amber', work: 'orange', done: 'green', lost: 'grey' };
App.TAG_COLOR = { VIP: 'amber', 'проблемный': 'red', 'повторный': 'green' };

// ---------- иконки ----------
const I = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
App.ICON = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  funnel: I('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.5 3.5 5.5"/>'),
  tool: I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  team: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  log: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  bell: I('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 2.4),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>', 2.2),
  phone: I('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  pin: I('<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  file: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  camera: I('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  download: I('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  menu: I('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  check: I('<path d="M5 12l5 5L20 7"/>', 2.4),
  chev: I('<path d="M9 6l6 6-6 6"/>'),
  left: I('<path d="M15 6l-6 6 6 6"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  ruble: I('<path d="M8 21V3h6a4.5 4.5 0 0 1 0 9H6M6 16h9"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  excel: I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>'),
  alert: I('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
};
App.LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#E0673A"/><path d="M9 21 20 11l11 10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 19v10h14V19" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><rect x="18" y="22" width="4" height="7" fill="#fff"/></svg>`;

// ---------- утилиты ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
Object.assign(App, { $, $$ });
App.esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.money = (n) => (Math.round(n || 0)).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
App.moneyShort = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' млн ₽' : n >= 1000 ? Math.round(n / 1000) + ' тыс. ₽' : App.money(n));
App.localDate = (iso) => new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(0, 10); // время студии — Екатеринбург
App.addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
App.fmtDate = (d, withWd) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const wd = WD[new Date(d + 'T12:00:00Z').getUTCDay()];
  return `${day} ${MONTHS[m - 1]}${y !== Number(App.S.today.slice(0, 4)) ? ' ' + y : ''}${withWd ? ', ' + wd : ''}`;
};
App.relDate = (d) => {
  const t = App.S.today;
  if (d === t) return 'сегодня';
  if (d === App.addDays(t, 1)) return 'завтра';
  if (d === App.addDays(t, -1)) return 'вчера';
  return App.fmtDate(d, true);
};
App.fmtDT = (iso) => { const d = App.localDate(iso); const t = new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().slice(11, 16); return `${App.relDate(d)}, ${t}`; };
App.short = (d) => d.split('-').reverse().join('.');
App.initials = (name) => String(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
App.avatar = (name, cls = '') => `<span class="ava ${cls}" title="${App.esc(name)}" style="--h:${[...String(name)].reduce((s, c) => s + c.charCodeAt(0), 0) % 360}">${App.esc(App.initials(name))}</span>`;
App.badge = (text, color) => `<span class="badge ${color || ''}">${App.esc(text)}</span>`;
App.stageBadge = (key) => App.badge(App.stageName(key), App.STAGE_COLOR[key]);
App.taskBadge = (s) => App.badge(App.TASK[s], App.TASK_COLOR[s]);
App.tagBadges = (tags) => (tags || []).map((t) => App.badge(t, App.TAG_COLOR[t] || 'grey')).join(' ');
App.stageName = (key) => App.S.stages.find((s) => s.key === key)?.name || key;
App.staffName = (id) => App.S.staff.find((u) => u.id === id)?.name || '—';
App.opts = (list, cur, empty) => (empty !== undefined ? `<option value="">${App.esc(empty)}</option>` : '') + list.map(([v, l]) => `<option value="${App.esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${App.esc(l)}</option>`).join('');
App.isStaff = () => ['admin', 'manager'].includes(App.S.me.role);
App.isAdmin = () => App.S.me.role === 'admin';
App.plural = (n, one, few, many) => { const a = Math.abs(n) % 100; const b = a % 10; return `${n} ${a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many}`; };
App.mapLink = (addr) => `https://yandex.ru/maps/?text=${encodeURIComponent(addr)}`;
App.tel = (p) => `tel:${String(p).replace(/[^\d+]/g, '')}`;
App.empty = (text, sub = '') => `<div class="empty"><b>${App.esc(text)}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;

App.toast = (msg, err) => {
  const el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(App.toast.t); App.toast.t = setTimeout(() => (el.className = 'toast'), 3200);
};
App.api = async (method, url, body) => {
  const r = await fetch('/api' + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  // сессия истекла посреди работы — показываем вход (сам /bootstrap при входе не зацикливает отрисовку)
  if (r.status === 401 && url !== '/login' && url !== '/bootstrap') { App.S = null; render(); throw new Error(data.error || 'Нужно войти'); }
  if (!r.ok) throw Object.assign(new Error(data.error || 'Ошибка ' + r.status), { status: r.status });
  return data;
};
// действие с сообщением об ошибке: App.act(() => api(...), 'Сохранено')
App.act = async (fn, okMsg) => {
  try { const r = await fn(); if (okMsg) App.toast(okMsg); return r ?? true; } catch (e) { App.toast(e.message, true); return null; }
};
App.readFile = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
// уменьшаем фото с телефона перед загрузкой (до 1600 px), чтобы не гонять 8 МБ по мобильному интернету
App.shrinkImage = async (file) => {
  if (!/^image\/(jpeg|png|webp)/.test(file.type)) return App.readFile(file);
  const url = await App.readFile(file);
  const img = new Image(); img.src = url; await img.decode().catch(() => {});
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  if (k >= 1 && file.size < 1.5e6) return url;
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
};

// ---------- модальные окна ----------
App.modal = (title, html, { wide, onOpen } = {}) => {
  App.closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap'; wrap.id = 'modal';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${App.esc(title)}">
    <div class="modal-head"><h3>${App.esc(title)}</h3><button class="icon-btn" data-close aria-label="Закрыть">${App.ICON.x}</button></div>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) App.closeModal(); });
  $$('[data-close]', wrap).forEach((b) => (b.onclick = App.closeModal));
  const first = $('input:not([type=hidden]),select,textarea', wrap); if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 30);
  if (onOpen) onOpen(wrap);
  return wrap;
};
App.closeModal = () => { const m = $('#modal'); if (m) m.remove(); document.body.classList.remove('no-scroll'); };
App.confirm = (title, text, okText = 'Да', danger) => new Promise((resolve) => {
  const w = App.modal(title, `<p class="muted">${text}</p><div class="form-actions"><button class="btn" data-close>Отмена</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${App.esc(okText)}</button></div>`);
  $('#cf-ok', w).onclick = () => { App.closeModal(); resolve(true); };
  $$('[data-close]', w).forEach((b) => b.addEventListener('click', () => resolve(false)));
});
// запрос строки текста (причина отказа и т. п.)
App.prompt = (title, label, { placeholder = '', okText = 'Сохранить', type = 'text', value = '' } = {}) => new Promise((resolve) => {
  const w = App.modal(title, `<form id="pf"><label class="field"><span>${App.esc(label)}</span>${type === 'textarea' ? `<textarea name="v" rows="3" placeholder="${App.esc(placeholder)}" required>${App.esc(value)}</textarea>` : `<input name="v" type="${type}" value="${App.esc(value)}" placeholder="${App.esc(placeholder)}" required>`}</label>
    <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">${App.esc(okText)}</button></div></form>`);
  $('#pf', w).onsubmit = (e) => { e.preventDefault(); const v = e.target.v.value.trim(); App.closeModal(); resolve(v); };
  $$('[data-close]', w).forEach((b) => b.addEventListener('click', () => resolve(null)));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { App.closeModal(); closeNotif(); } });

// ---------- меню ----------
function navItems() {
  const r = App.S.me.role;
  if (r === 'master') return [['my', 'Мои задачи', 'tool'], ['profile', 'Профиль', 'user']];
  if (r === 'client') return [['my', 'Мой ремонт', 'home'], ['profile', 'Профиль', 'user']];
  const items = [['', 'Главная', 'home'], ['funnel', 'Воронка', 'funnel'], ['leads', 'Заявки и сделки', 'list'], ['clients', 'Клиенты', 'users'],
    ['tasks', 'Задачи мастеров', 'tool'], ['calendar', 'Календарь мастеров', 'cal'], ['reports', 'Отчёты', 'chart']];
  if (r === 'admin') items.push(['users', 'Сотрудники', 'team'], ['settings', 'Настройки', 'gear'], ['log', 'Журнал действий', 'log']);
  return items;
}
function layout(content) {
  const cur = App.route.page;
  const me = App.S.me;
  const nav = navItems().map(([k, label, ic]) => `<a href="#/${k}" class="${cur === (k || 'home') || (k === 'leads' && cur === 'lead') || (k === 'clients' && cur === 'client') ? 'active' : ''}">${App.ICON[ic]}<span>${label}</span></a>`).join('');
  return `<aside class="side" id="side">
      <a class="brand" href="#/">${App.LOGO}<span><b>Новый дом</b><small>CRM студии ремонта</small></span></a>
      <nav>${nav}</nav>
      <div class="side-me"><a href="#/profile">${App.avatar(me.name)}<span><b>${App.esc(me.name)}</b><small>${App.ROLE[me.role]}</small></span></a>
      <button class="icon-btn" id="logout" title="Выйти" aria-label="Выйти">${App.ICON.logout}</button></div>
    </aside>
    <div class="side-shade" id="shade"></div>
    <div class="main">
      <header class="top">
        <button class="icon-btn burger" id="burger" aria-label="Меню">${App.ICON.menu}</button>
        <a class="brand-mini" href="#/">${App.LOGO}<b>Новый дом</b></a>
        ${App.isStaff() ? `<form class="top-search" id="topSearch"><span>${App.ICON.search}</span><input name="q" placeholder="Поиск: клиент, телефон, адрес, номер заявки" autocomplete="off"></form>` : '<div class="grow"></div>'}
        <button class="icon-btn bell" id="bell" aria-label="Уведомления">${App.ICON.bell}${App.S.unread ? `<i class="dot">${App.S.unread > 9 ? '9+' : App.S.unread}</i>` : ''}</button>
      </header>
      <main class="content" id="content">${content}</main>
    </div>`;
}
function bindLayout() {
  $('#logout').onclick = async () => { await App.api('POST', '/logout').catch(() => {}); App.S = null; location.hash = '#/'; render(); };
  $('#burger').onclick = () => document.body.classList.toggle('menu-open');
  $('#shade').onclick = () => document.body.classList.remove('menu-open');
  $('#bell').onclick = toggleNotif;
  const ts = $('#topSearch');
  if (ts) ts.onsubmit = (e) => { e.preventDefault(); const q = ts.q.value.trim(); if (q) location.hash = '#/leads?q=' + encodeURIComponent(q); };
}

// ---------- уведомления ----------
function closeNotif() { const p = $('#notif'); if (p) p.remove(); }
async function toggleNotif(e) {
  e.stopPropagation();
  if ($('#notif')) return closeNotif();
  const list = await App.api('GET', '/notifications').catch(() => []);
  const p = document.createElement('div');
  p.className = 'notif'; p.id = 'notif';
  p.innerHTML = `<div class="notif-head"><b>Уведомления</b>${list.some((n) => !n.read) ? '<button class="link" id="readAll">Прочитать все</button>' : ''}</div>
    ${list.length ? list.slice(0, 30).map((n) => `<a href="${App.esc(n.link || '#/')}" class="${n.read ? '' : 'unread'}"><span>${App.esc(n.text)}</span><small>${App.fmtDT(n.at)}</small></a>`).join('') : App.empty('Пока пусто')}`;
  document.body.appendChild(p);
  const rb = $('#readAll', p);
  const markRead = async () => { await App.api('POST', '/notifications/read').catch(() => {}); App.S.unread = 0; const d = $('#bell .dot'); if (d) d.remove(); };
  if (rb) rb.onclick = async () => { await markRead(); $$('.unread', p).forEach((a) => a.classList.remove('unread')); rb.remove(); };
  $$('a', p).forEach((a) => a.addEventListener('click', () => { markRead(); closeNotif(); }));
}
document.addEventListener('click', (e) => { const p = $('#notif'); if (p && !p.contains(e.target)) closeNotif(); });

// ---------- вход ----------
function loginView() {
  return `<div class="login">
    <div class="login-art"><div class="login-art-in">${App.LOGO}<h1>Новый дом</h1><p>CRM студии ремонта квартир: заявки, сделки, мастера и клиенты — в одном месте.</p>
      <ul><li>${App.ICON.funnel}Воронка от заявки до закрытия</li><li>${App.ICON.cal}Календарь загрузки мастеров</li><li>${App.ICON.phone}Задачи мастерам в Telegram</li><li>${App.ICON.chart}Выручка и конверсия по менеджерам</li></ul></div></div>
    <form class="login-form" id="loginForm">
      <h2>Вход</h2>
      <label class="field"><span>Логин</span><input name="login" autocomplete="username" required></label>
      <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
      <div class="err" id="loginErr" role="alert"></div>
      <button class="btn primary big">Войти</button>
      <div class="demo"><b>Демо-доступы</b> (пароль у всех: <code>remont</code>)
        <div class="demo-grid">${[['admin', 'Администратор'], ['manager', 'Менеджер'], ['master', 'Мастер'], ['client', 'Клиент']].map(([l, r]) => `<button type="button" class="chip" data-login="${l}"><b>${l}</b><small>${r}</small></button>`).join('')}</div></div>
    </form></div>`;
}
function bindLogin() {
  const f = $('#loginForm');
  $$('[data-login]', f).forEach((b) => (b.onclick = () => { f.login.value = b.dataset.login; f.password.value = 'remont'; f.requestSubmit(); }));
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await App.api('POST', '/login', { login: f.login.value.trim(), password: f.password.value });
      await loadBoot();
      const role = App.S.me.role;
      location.hash = role === 'master' || role === 'client' ? '#/my' : '#/';
      render();
    } catch (err) { $('#loginErr').textContent = err.message; }
  };
}

// ---------- роутер ----------
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, qs] = h.split('?');
  const parts = p.split('/').filter(Boolean);
  return { page: parts[0] || 'home', id: parts[1], q: new URLSearchParams(qs || '') };
}
async function loadBoot() { App.S = await App.api('GET', '/bootstrap'); }
App.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  closeNotif();
  App.closeModal();
  document.body.classList.remove('menu-open');
  const root = $('#app');
  if (!App.S) {
    try { await loadBoot(); } catch { App.S = null; }
  }
  if (!App.S) { root.innerHTML = loginView(); bindLogin(); document.title = 'Вход — Новый дом CRM'; return; }
  App.route = parseRoute();
  const role = App.S.me.role;
  let page = App.route.page;
  if ((role === 'master' || role === 'client') && !['my', 'profile'].includes(page)) page = App.route.page = 'my';
  const P = App.pages[page] || App.pages.home;
  root.innerHTML = layout('<div class="loading">Загрузка…</div>');
  bindLayout();
  try {
    const html = await P.render(App.route);
    if (seq !== renderSeq) return;
    $('#content').innerHTML = html;
    document.title = (P.title ? (typeof P.title === 'function' ? P.title() : P.title) + ' — ' : '') + 'Новый дом CRM';
    if (P.bind) P.bind($('#content'), App.route);
    $('#content').scrollTop = 0;
  } catch (e) {
    if (seq !== renderSeq) return;
    $('#content').innerHTML = App.empty(e.status === 404 ? 'Не найдено или нет доступа' : 'Ошибка загрузки', App.esc(e.message));
  }
}
App.render = render;
// перерисовать только текущую страницу (после изменения данных), без мигания меню
App.refresh = async () => {
  const P = App.pages[App.route.page] || App.pages.home;
  const sc = window.scrollY;
  try {
    const html = await P.render(App.route);
    $('#content').innerHTML = html;
    if (P.bind) P.bind($('#content'), App.route);
    window.scrollTo(0, sc);
  } catch (e) { App.toast(e.message, true); }
};
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
document.addEventListener('DOMContentLoaded', render);
})();
