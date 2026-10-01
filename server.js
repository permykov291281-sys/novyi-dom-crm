// «Новый дом · CRM» — CRM студии ремонта: заявки → сделки → задачи мастеров. Node.js 18+, без внешних зависимостей.
// Данные: DATA_DIR/db.json, файлы: DATA_DIR/files, резервные копии: DATA_DIR/backups (20 последних).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { seed, STAGES, STAGE_RU, SOURCES } = require('./seed');
const { xlsx } = require('./xlsx');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FILES_DIR = path.join(DATA_DIR, 'files');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PUBLIC_DIR = path.join(__dirname, 'public');
for (const d of [FILES_DIR, BACKUP_DIR]) fs.mkdirSync(d, { recursive: true });

// ---------- время (Екатеринбург, UTC+5) ----------
const TZ_OFFSET = Number(process.env.TZ_OFFSET_HOURS || 5);
const localNow = () => new Date(Date.now() + TZ_OFFSET * 3600000);
const todayStr = () => localNow().toISOString().slice(0, 10);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const localDate = (iso) => new Date(new Date(iso).getTime() + TZ_OFFSET * 3600000).toISOString().slice(0, 10);
const ruDate = (d) => (d ? d.split('-').reverse().join('.') : '');

// ---------- хранилище ----------
let db;
const newId = () => crypto.randomBytes(5).toString('hex');
const now = () => new Date().toISOString();
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 32).toString('hex') };
}
function checkPassword(u, password) {
  const { hash } = hashPassword(password, u.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'));
}
function load() {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  else { db = seed(hashPassword, todayStr()); saveNow(); }
}
let timer = null;
function saveNow() {
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
function save() { clearTimeout(timer); timer = setTimeout(saveNow, 150); }

// журнал действий: кто, что, когда (видит админ)
function audit(me, text, ref = '') {
  db.log.unshift({ id: newId(), at: now(), userId: me ? me.id : null, text, ref });
  if (db.log.length > 3000) db.log.length = 3000;
}
const userById = (id) => db.users.find((u) => u.id === id);
const nameOf = (id) => userById(id)?.name || 'система';
const clientById = (id) => db.clients.find((c) => c.id === id);
const leadById = (id) => db.leads.find((l) => l.id === id);
const money = (n) => Math.round(n || 0).toLocaleString('ru-RU') + ' ₽';

// ---------- права ----------
// админ — всё; менеджер — свои заявки/сделки и их клиенты; мастер — только свои задачи; клиент — только свои заказы
function canLead(me, l) {
  if (me.role === 'admin') return true;
  if (me.role === 'manager') return l.managerId === me.id;
  if (me.role === 'master') return db.tasks.some((t) => t.leadId === l.id && t.masterId === me.id);
  if (me.role === 'client') return l.clientId === me.clientId;
  return false;
}
function canClient(me, c) {
  if (me.role === 'admin') return true;
  if (me.role === 'manager') return c.managerId === me.id || db.leads.some((l) => l.clientId === c.id && l.managerId === me.id);
  return false;
}
function canTask(me, t) {
  if (me.role === 'admin') return true;
  if (me.role === 'master') return t.masterId === me.id;
  if (me.role === 'manager') { const l = leadById(t.leadId); return !!l && l.managerId === me.id; }
  return false;
}
const staff = (me) => me.role === 'admin' || me.role === 'manager';

// ---------- вычисляемые поля ----------
function paidOf(l) { return l.payments.reduce((s, p) => s + p.sum, 0); }
function payStatus(l) {
  if (!l.isDeal || !l.amount) return '—';
  const paid = paidOf(l);
  return paid <= 0 ? 'Не оплачено' : paid >= l.amount ? 'Оплачено' : 'Частично';
}
function leadView(l, me) {
  const c = clientById(l.clientId);
  const paid = paidOf(l);
  const base = {
    ...l, clientName: c?.name || '', clientPhone: c?.phone || '', clientTags: c?.tags || [], managerName: nameOf(l.managerId),
    paid, prepaid: l.payments.filter((p) => p.kind === 'prepay').reduce((s, p) => s + p.sum, 0), rest: Math.max(0, (l.amount || 0) - paid), payStatus: payStatus(l),
    openTasks: db.tasks.filter((t) => t.leadId === l.id && !['done', 'declined'].includes(t.status)).length,
  };
  if (me.role === 'master') { // мастеру — только то, что нужно для выезда
    return { id: l.id, num: l.num, address: l.address, workType: l.workType, clientName: base.clientName, clientPhone: base.clientPhone, stage: l.stage };
  }
  if (me.role === 'client') { // клиенту — статус без внутренних комментариев, истории и чужих данных
    return {
      id: l.id, num: l.num, dealNum: l.dealNum, isDeal: l.isDeal, address: l.address, workType: l.workType, stage: l.stage, amount: l.amount, paid, rest: base.rest,
      payStatus: base.payStatus, payments: l.payments, managerName: base.managerName, managerPhone: userById(l.managerId)?.phone || '', createdAt: l.createdAt,
      files: l.files.filter((f) => f.kind === 'estimate' || f.kind === 'contract'),
    };
  }
  return base;
}
function taskView(t) {
  const l = leadById(t.leadId); const c = l && clientById(l.clientId); const m = userById(t.masterId);
  return { ...t, leadNum: l?.num || '', dealNum: l?.dealNum || '', clientName: c?.name || '', clientPhone: c?.phone || '', masterName: m?.name || '', workType: l?.workType || '' };
}
const TASK_RU = { assigned: 'Назначена', accepted: 'Принята', in_progress: 'В работе', done: 'Выполнена', declined: 'Отклонена' };

// ---------- уведомления: в приложении + Telegram ----------
function notify(userId, text, link = '', tg = true) {
  const u = userById(userId);
  if (!u || !u.active) return;
  db.notifications.unshift({ id: newId(), userId, at: now(), text, link, read: false });
  if (db.notifications.length > 2000) db.notifications.length = 2000;
  if (tg && u.tgChatId) tgQueue.push({ chatId: u.tgChatId, text });
}
const tgQueue = [];
const tgLog = []; // последние отправки для экрана настроек
async function tgCall(method, payload) {
  const token = db.settings.telegramToken;
  if (!token) return { ok: false, description: 'Не указан токен бота' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(method === 'getUpdates' ? 35000 : 10000),
    });
    return await r.json().catch(() => ({ ok: false, description: 'HTTP ' + r.status }));
  } catch (e) { return { ok: false, description: e.message }; }
}
// очередь отправки: уведомления не тормозят ответы API
async function tgWorker() {
  while (tgQueue.length) {
    const m = tgQueue.shift();
    const res = await tgCall('sendMessage', { chat_id: m.chatId, text: m.text, ...(m.markup ? { reply_markup: m.markup } : {}) });
    tgLog.unshift({ at: now(), chatId: m.chatId, ok: !!res.ok, error: res.ok ? '' : res.description, text: m.text.slice(0, 120) });
    if (tgLog.length > 30) tgLog.length = 30;
  }
}
// Мастер получает задачу с кнопками «Принять / Отклонить». Ответы забираем long polling'ом (getUpdates), без внешнего вебхука.
function tgTaskMessage(t) {
  const m = userById(t.masterId);
  if (!m?.tgChatId || !db.settings.telegramToken) return;
  const tv = taskView(t);
  tgQueue.push({
    chatId: m.tgChatId,
    text: `🛠 Новая задача ${t.num}: ${t.title}\n📅 ${ruDate(t.date)}, ${t.from}–${t.to}\n📍 ${t.address}\n👤 ${tv.clientName}, ${tv.clientPhone}${t.note ? '\n📝 ' + t.note : ''}`,
    markup: { inline_keyboard: [[{ text: '✅ Принять', callback_data: `task:${t.id}:accept` }, { text: '✖️ Отклонить', callback_data: `task:${t.id}:decline` }]] },
  });
}
// обработка одного обновления Telegram (вынесено отдельно — проверяется тестами без настоящего бота)
function handleTgUpdate(u) {
  if (u.message && /^\/start/.test(u.message.text || '')) {
    const chatId = String(u.message.chat.id);
    const linked = db.users.find((x) => x.tgChatId === chatId);
    return { chatId, text: linked ? `Вы подключены как ${linked.name}. Сюда будут приходить задачи и уведомления.` : `Ваш Telegram ID: ${chatId}\nПередайте его администратору — он укажет его в вашем профиле CRM.` };
  }
  const cb = u.callback_query;
  if (cb && /^task:[0-9a-f]+:(accept|decline)$/.test(cb.data || '')) {
    const [, taskId, act] = cb.data.split(':');
    const t = db.tasks.find((x) => x.id === taskId);
    const me = db.users.find((x) => x.tgChatId === String(cb.from.id));
    if (!t || !me || t.masterId !== me.id) return { callbackId: cb.id, answer: 'Задача не найдена или назначена не вам' };
    const r = setTaskStatus(t, me, act === 'accept' ? 'accepted' : 'declined', act === 'decline' ? 'Отклонено в Telegram' : '');
    if (r.error) return { callbackId: cb.id, answer: r.error };
    save();
    return { callbackId: cb.id, answer: act === 'accept' ? 'Задача принята' : 'Задача отклонена', chatId: String(cb.from.id), text: `${t.num}: ${TASK_RU[t.status]}` };
  }
  return null;
}
let polling = false;
async function tgPoll() {
  if (polling || !db.settings.telegramToken) return;
  polling = true;
  try {
    const r = await tgCall('getUpdates', { offset: db.settings.tgOffset || 0, timeout: 25, allowed_updates: ['message', 'callback_query'] });
    if (r.ok) for (const upd of r.result) {
      db.settings.tgOffset = upd.update_id + 1;
      const out = handleTgUpdate(upd);
      if (out?.callbackId) await tgCall('answerCallbackQuery', { callback_query_id: out.callbackId, text: out.answer });
      if (out?.chatId && out.text) tgQueue.push({ chatId: out.chatId, text: out.text });
      save();
    }
  } finally { polling = false; }
}

// ---------- предметная логика ----------
function addHistory(obj, me, text) { obj.history.push({ at: now(), userId: me ? me.id : null, text }); obj.updatedAt = now(); }
function setStage(l, me, stage, lostReason) {
  if (!STAGES.includes(stage)) return { error: 'Неизвестный этап' };
  if (stage === l.stage) return {};
  if (['work', 'done'].includes(stage) && !l.isDeal) return { error: 'Сначала переведите заявку в сделку (кнопка «В сделку»)' };
  if (stage === 'lost' && !String(lostReason || '').trim()) return { error: 'Укажите причину отказа' };
  if (stage === 'done' && l.amount && paidOf(l) < l.amount) {
    // завершить можно и с долгом, но фиксируем это в истории
    addHistory(l, me, `внимание: закрыто с остатком ${money(l.amount - paidOf(l))}`);
  }
  const from = l.stage;
  l.stage = stage;
  l.lostReason = stage === 'lost' ? String(lostReason).trim().slice(0, 300) : '';
  l.closedAt = ['done', 'lost'].includes(stage) ? now() : null;
  addHistory(l, me, `этап: ${STAGE_RU[from]} → ${STAGE_RU[stage]}${stage === 'lost' ? ' (' + l.lostReason + ')' : ''}`);
  audit(me, `${l.num}: этап ${STAGE_RU[from]} → ${STAGE_RU[stage]}`, l.id);
  if (me.id !== l.managerId) notify(l.managerId, `${l.num}: этап изменён на «${STAGE_RU[stage]}»`, `#/lead/${l.id}`);
  const cu = db.users.find((u) => u.role === 'client' && u.clientId === l.clientId);
  if (cu) notify(cu.id, `Статус заказа ${l.dealNum || l.num}: ${STAGE_RU[stage]}`, '#/my');
  return {};
}
function toDeal(l, me, amount) {
  if (l.isDeal) return { error: 'Заявка уже переведена в сделку' };
  if (l.stage === 'lost') return { error: 'Нельзя: заявка в отказе' };
  l.isDeal = true;
  l.dealNum = 'С-' + (++db.counters.deal);
  l.dealAt = now();
  l.amount = Math.max(0, Math.round(Number(amount) || l.budget || 0));
  if (STAGES.indexOf(l.stage) < STAGES.indexOf('estimate')) l.stage = 'estimate';
  addHistory(l, me, `заявка переведена в сделку ${l.dealNum}, сумма ${money(l.amount)}`);
  audit(me, `${l.num} → сделка ${l.dealNum} (${money(l.amount)})`, l.id);
  return {};
}
// мастер: принять / отклонить / начать / выполнить; менеджер может вернуть отклонённую задачу, назначив другого мастера
const TASK_FLOW = { assigned: ['accepted', 'declined'], accepted: ['in_progress', 'declined'], in_progress: ['done'], done: [], declined: [] };
function setTaskStatus(t, me, status, reason) {
  if (!TASK_RU[status]) return { error: 'Неизвестный статус' };
  if (me.role === 'master' && t.masterId !== me.id) return { error: 'Это не ваша задача' };
  if (me.role === 'master' && !TASK_FLOW[t.status].includes(status)) return { error: `Нельзя перевести задачу из «${TASK_RU[t.status]}» в «${TASK_RU[status]}»` };
  if (status === 'declined' && !String(reason || '').trim()) return { error: 'Укажите причину отказа' };
  const from = t.status;
  t.status = status;
  t.declineReason = status === 'declined' ? String(reason).trim().slice(0, 300) : '';
  addHistory(t, me, `статус: ${TASK_RU[from]} → ${TASK_RU[status]}${t.declineReason ? ' (' + t.declineReason + ')' : ''}`);
  audit(me, `${t.num}: ${TASK_RU[from]} → ${TASK_RU[status]}`, t.id);
  const l = leadById(t.leadId);
  if (l && me.id !== l.managerId) notify(l.managerId, `${t.num} «${t.title}» (${nameOf(t.masterId)}): ${TASK_RU[status]}${t.declineReason ? ' — ' + t.declineReason : ''}`, `#/lead/${l.id}`);
  return {};
}
// пересечение задач мастера по времени в один день
function overlaps(t, exceptId) {
  return db.tasks.filter((x) => x.id !== exceptId && x.masterId === t.masterId && x.date === t.date && x.status !== 'declined' && x.from < t.to && t.from < x.to);
}
function findOrCreateClient(me, b) {
  const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^8/, '7');
  const phone = str(b.phone, 30);
  let c = phone && db.clients.find((x) => digits(x.phone) === digits(phone));
  if (c) return c;
  const name = str(b.name || b.clientName, 100);
  if (!name) return null;
  c = { id: newId(), name, phone, email: str(b.email, 100), address: str(b.address, 300), tags: [], note: '', managerId: b.managerId || null, createdAt: now(), calls: [] };
  db.clients.push(c);
  audit(me, `новый клиент: ${name}`, c.id);
  return c;
}
// новая заявка от сайта — менеджеру с наименьшим числом открытых заявок
function leastBusyManager() {
  const ms = db.users.filter((u) => u.role === 'manager' && u.active);
  const open = (m) => db.leads.filter((l) => l.managerId === m.id && !['done', 'lost'].includes(l.stage)).length;
  return ms.sort((a, b) => open(a) - open(b))[0] || db.users.find((u) => u.role === 'admin');
}
function createLead(me, b, source) {
  const managerId = me && me.role === 'manager' ? me.id : (b.managerId && userById(b.managerId)?.role === 'manager' ? b.managerId : leastBusyManager().id);
  const client = b.clientId ? clientById(b.clientId) : findOrCreateClient(me, { ...b, managerId });
  if (!client) return { error: 'Укажите клиента: имя и телефон' };
  if (!client.managerId) client.managerId = managerId;
  const l = {
    id: newId(), num: '№' + (++db.counters.lead), clientId: client.id, address: str(b.address, 300) || client.address, workType: str(b.workType, 80) || 'Не указан',
    budget: Math.max(0, Math.round(Number(b.budget) || 0)), source: SOURCES[source] ? source : 'call', managerId, stage: 'new',
    isDeal: false, dealNum: '', dealAt: null, amount: 0, payments: [], comments: [], files: [], history: [], createdAt: now(), updatedAt: now(), closedAt: null, lostReason: '',
  };
  if (!client.address && l.address) client.address = l.address;
  addHistory(l, me, me ? 'создал(а) заявку' : `заявка с сайта (вебхук)${b.comment ? ': ' + str(b.comment, 300) : ''}`);
  if (b.comment) l.comments.push({ id: newId(), userId: me ? me.id : null, at: now(), text: str(b.comment, 2000) });
  db.leads.push(l);
  audit(me, `новая заявка ${l.num} (${SOURCES[l.source]}), клиент ${client.name}`, l.id);
  if (!me || me.id !== managerId) notify(managerId, `Новая заявка ${l.num}: ${client.name}, ${l.workType}`, `#/lead/${l.id}`);
  return { lead: l };
}

// ---------- отчёты ----------
function report(from, to, me) {
  const inRange = (iso) => { const d = localDate(iso); return d >= from && d <= to; };
  const leads = db.leads.filter((l) => me.role === 'admin' || l.managerId === me.id);
  const created = leads.filter((l) => inRange(l.createdAt));
  const payments = leads.flatMap((l) => l.payments.map((p) => ({ ...p, managerId: l.managerId }))).filter((p) => p.date >= from && p.date <= to);
  const closed = leads.filter((l) => l.stage === 'done' && l.closedAt && inRange(l.closedAt));
  const revenue = payments.reduce((s, p) => s + p.sum, 0);
  const managers = db.users.filter((u) => u.role === 'manager' && (me.role === 'admin' || u.id === me.id)).map((m) => {
    const mc = created.filter((l) => l.managerId === m.id);
    const deals = mc.filter((l) => l.isDeal).length;
    const mClosed = closed.filter((l) => l.managerId === m.id);
    return {
      id: m.id, name: m.name, leads: mc.length, deals, conversion: mc.length ? Math.round((deals / mc.length) * 100) : 0,
      closed: mClosed.length, revenue: payments.filter((p) => p.managerId === m.id).reduce((s, p) => s + p.sum, 0),
      avgCheck: mClosed.length ? Math.round(mClosed.reduce((s, l) => s + l.amount, 0) / mClosed.length) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const bySource = Object.keys(SOURCES).map((k) => ({ key: k, name: SOURCES[k], leads: created.filter((l) => l.source === k).length, deals: created.filter((l) => l.source === k && l.isDeal).length }));
  const funnel = STAGES.map((s) => ({ stage: s, name: STAGE_RU[s], count: leads.filter((l) => l.stage === s).length, sum: leads.filter((l) => l.stage === s).reduce((a, l) => a + (l.amount || l.budget), 0) }));
  const debt = leads.filter((l) => l.isDeal && l.stage !== 'lost').reduce((s, l) => s + Math.max(0, l.amount - paidOf(l)), 0);
  // выручка по неделям для графика
  const weeks = [];
  for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 7)) {
    const a = d.toISOString().slice(0, 10); const e = new Date(d); e.setUTCDate(e.getUTCDate() + 6); const b = e.toISOString().slice(0, 10) > to ? to : e.toISOString().slice(0, 10);
    weeks.push({ from: a, to: b, sum: payments.filter((p) => p.date >= a && p.date <= b).reduce((s, p) => s + p.sum, 0) });
  }
  return {
    from, to, revenue, leads: created.length, deals: created.filter((l) => l.isDeal).length, closed: closed.length, debt,
    avgCheck: closed.length ? Math.round(closed.reduce((s, l) => s + l.amount, 0) / closed.length) : 0,
    conversion: created.length ? Math.round((created.filter((l) => l.isDeal).length / created.length) * 100) : 0,
    managers, bySource, funnel, weeks,
  };
}

// ---------- фильтры списков ----------
function filterLeads(me, q) {
  const text = String(q.get('q') || '').toLowerCase().trim();
  const digits = text.replace(/\D/g, '');
  return db.leads.filter((l) => canLead(me, l)).filter((l) => {
    const c = clientById(l.clientId) || {};
    if (q.get('stage') && l.stage !== q.get('stage')) return false;
    if (q.get('source') && l.source !== q.get('source')) return false;
    if (q.get('manager') && l.managerId !== q.get('manager')) return false;
    if (q.get('deal') === '1' && !l.isDeal) return false;
    if (q.get('deal') === '0' && l.isDeal) return false;
    if (q.get('pay') && payStatus(l) !== q.get('pay')) return false;
    const d = localDate(l.createdAt);
    if (isDate(q.get('from')) && d < q.get('from')) return false;
    if (isDate(q.get('to')) && d > q.get('to')) return false;
    if (text) {
      const hay = `${l.num} ${l.dealNum} ${c.name} ${l.address} ${l.workType}`.toLowerCase();
      const phoneHit = digits.length >= 3 && String(c.phone || '').replace(/\D/g, '').includes(digits);
      if (!hay.includes(text) && !phoneHit) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function filterTasks(me, q) {
  return db.tasks.filter((t) => canTask(me, t)).filter((t) => {
    if (q.get('master') && t.masterId !== q.get('master')) return false;
    if (q.get('status') && t.status !== q.get('status')) return false;
    if (isDate(q.get('from')) && t.date < q.get('from')) return false;
    if (isDate(q.get('to')) && t.date > q.get('to')) return false;
    return true;
  }).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
}

// ---------- HTTP ----------
function send(res, code, data, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
const fail = (res, code, msg) => send(res, code, { error: msg });
function readBody(req, limit = 12e6) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Файл слишком большой (до 8 МБ)'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); } catch {
        // вебхук может прийти обычной формой с сайта
        if ((req.headers['content-type'] || '').includes('urlencoded')) resolve(Object.fromEntries(new URLSearchParams(raw)));
        else reject(Object.assign(new Error('Некорректный JSON'), { code: 400 }));
      }
    });
  });
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
function currentUser(req) {
  const s = db.sessions[cookies(req).nd_session];
  const u = s && userById(s.userId);
  return u && u.active ? u : null;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
function serveStatic(res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, 'forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const pub = (u) => { const { hash, salt, ...r } = u; return r; };
const staffList = () => db.users.filter((u) => u.role !== 'client').map((u) => ({ id: u.id, name: u.name, role: u.role, specialty: u.specialty || '', active: u.active, phone: u.phone }));
function saveUpload(body) {
  const m = /^data:([^;]*);base64,(.*)$/.exec(String(body.data || ''));
  if (!m) return { error: 'Файл не прочитан' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8 * 1024 * 1024) return { error: 'Файл больше 8 МБ' };
  const fid = newId();
  fs.writeFileSync(path.join(FILES_DIR, fid), buf);
  return { file: { id: fid, name: str(body.name, 120) || 'файл', mime: m[1] || 'application/octet-stream', size: buf.length, at: now() } };
}

// ---------- API ----------
async function api(req, res, parts, me, url) {
  const m = req.method;
  const [what, id, sub] = parts;
  const q = url.searchParams;

  // вебхук заявок с сайта: POST /api/hook/lead?key=…  (JSON или обычная форма)
  if (what === 'hook' && id === 'lead' && m === 'POST') {
    if (q.get('key') !== db.settings.webhookKey) return fail(res, 403, 'Неверный ключ вебхука');
    const b = await readBody(req, 1e5);
    if (!str(b.name) || !str(b.phone)) return fail(res, 400, 'Нужны поля name и phone');
    const r = createLead(null, { ...b, workType: b.workType || b.work_type, comment: b.comment || b.message }, 'site');
    if (r.error) return fail(res, 400, r.error);
    save();
    return send(res, 201, { ok: true, num: r.lead.num });
  }

  const body = ['GET', 'HEAD'].includes(m) ? {} : await readBody(req);

  if (what === 'login' && m === 'POST') {
    const u = db.users.find((x) => x.login === str(body.login).toLowerCase());
    if (!u || !checkPassword(u, String(body.password || ''))) return fail(res, 401, 'Неверный логин или пароль');
    if (!u.active) return fail(res, 403, 'Учётная запись отключена. Обратитесь к администратору');
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = { userId: u.id, at: now() };
    audit(u, 'вход в систему');
    save();
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    return send(res, 200, { ok: true }, { 'Set-Cookie': `nd_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 86400}${secure}` });
  }
  if (what === 'logout' && m === 'POST') {
    delete db.sessions[cookies(req).nd_session]; save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'nd_session=; Path=/; Max-Age=0' });
  }
  if (!me) return fail(res, 401, 'Нужно войти');
  const isAdmin = me.role === 'admin';
  const done = (data, code = 200) => { save(); return send(res, code, data); };

  if (what === 'bootstrap' && m === 'GET') {
    return send(res, 200, {
      me: pub(me), today: todayStr(), stages: STAGES.map((s) => ({ key: s, name: STAGE_RU[s] })), sources: SOURCES, workTypes: db.workTypes,
      staff: me.role === 'client' ? [] : staffList(), unread: db.notifications.filter((n) => n.userId === me.id && !n.read).length,
    });
  }

  // ----- уведомления -----
  if (what === 'notifications') {
    if (m === 'GET') return send(res, 200, db.notifications.filter((n) => n.userId === me.id).slice(0, 50));
    if (m === 'POST' && id === 'read') { db.notifications.forEach((n) => { if (n.userId === me.id) n.read = true; }); return done({ ok: true }); }
  }

  // ----- профиль -----
  if (what === 'profile' && m === 'PATCH') {
    if (body.name !== undefined) { const n = str(body.name, 80); if (!n) return fail(res, 400, 'Укажите имя'); me.name = n; }
    if (body.phone !== undefined) me.phone = str(body.phone, 30);
    if (body.tgChatId !== undefined) me.tgChatId = str(body.tgChatId, 20).replace(/[^\d-]/g, '');
    if (body.password) {
      if (!checkPassword(me, String(body.oldPassword || ''))) return fail(res, 400, 'Текущий пароль указан неверно');
      if (String(body.password).length < 6) return fail(res, 400, 'Новый пароль — не короче 6 символов');
      Object.assign(me, hashPassword(String(body.password)));
    }
    audit(me, 'изменил(а) профиль');
    return done({ me: pub(me) });
  }

  // ----- кабинет клиента -----
  if (what === 'my' && m === 'GET' && me.role === 'client') {
    const leads = db.leads.filter((l) => l.clientId === me.clientId && l.stage !== 'lost').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return send(res, 200, leads.map((l) => ({
      ...leadView(l, me),
      visits: db.tasks.filter((t) => t.leadId === l.id && t.status !== 'declined').sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from))
        .map((t) => ({ id: t.id, title: t.title, date: t.date, from: t.from, to: t.to, status: t.status, masterName: nameOf(t.masterId), photos: t.photos })),
    })));
  }

  // ----- файлы -----
  if (what === 'file' && id && m === 'GET') {
    let owner = null; let meta = null;
    for (const l of db.leads) { const f = l.files.find((x) => x.id === id); if (f) { owner = { lead: l }; meta = f; break; } }
    if (!meta) for (const t of db.tasks) { const f = t.photos.find((x) => x.fileId === id || x.id === id); if (f) { owner = { task: t }; meta = f; break; } }
    if (!meta) return fail(res, 404, 'Файл не найден');
    const allowed = owner.lead ? canLead(me, owner.lead) && (me.role !== 'client' || ['estimate', 'contract'].includes(meta.kind)) && me.role !== 'master'
      : canTask(me, owner.task) || (me.role === 'client' && leadById(owner.task.leadId)?.clientId === me.clientId);
    if (!allowed) return fail(res, 403, 'Нет доступа к файлу');
    const fp = path.join(FILES_DIR, meta.fileId || meta.id);
    if (!fs.existsSync(fp)) return fail(res, 404, 'Это демо-файл: в демо-данных хранится только его карточка');
    res.writeHead(200, { 'Content-Type': meta.mime || 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}` });
    return fs.createReadStream(fp).pipe(res);
  }

  // ----- мастер: свои задачи -----
  if (what === 'tasks' && !id && m === 'GET') {
    return send(res, 200, filterTasks(me, q).map(taskView));
  }
  if (what === 'tasks' && id) {
    const t = db.tasks.find((x) => x.id === id);
    if (!t || !canTask(me, t)) return fail(res, 404, 'Задача не найдена');
    if (m === 'GET') return send(res, 200, { ...taskView(t), lead: leadView(leadById(t.leadId), me) });
    if (sub === 'status' && m === 'POST') {
      const r = setTaskStatus(t, me, body.status, body.reason);
      if (r.error) return fail(res, 400, r.error);
      return done(taskView(t));
    }
    if (sub === 'photos' && m === 'POST') {
      if (!['before', 'after'].includes(body.phase)) return fail(res, 400, 'Укажите: фото «до» или «после»');
      if (!String(body.mime || body.data || '').includes('image')) return fail(res, 400, 'Можно загрузить только изображение');
      const up = saveUpload(body);
      if (up.error) return fail(res, 400, up.error);
      t.photos.push({ id: newId(), fileId: up.file.id, phase: body.phase, name: up.file.name, mime: up.file.mime, url: `/api/file/${up.file.id}`, at: now(), userId: me.id });
      addHistory(t, me, `добавил(а) фото «${body.phase === 'before' ? 'до' : 'после'}»`);
      audit(me, `${t.num}: фото «${body.phase === 'before' ? 'до' : 'после'}»`, t.id);
      return done(taskView(t));
    }
    if (!staff(me)) return fail(res, 403, 'Недостаточно прав');
    if (m === 'PATCH') {
      const next = { ...t };
      if (body.masterId !== undefined) { const ms = userById(body.masterId); if (!ms || ms.role !== 'master' || !ms.active) return fail(res, 400, 'Выберите мастера'); next.masterId = ms.id; }
      if (body.date !== undefined) { if (!isDate(body.date)) return fail(res, 400, 'Укажите дату'); next.date = body.date; }
      if (body.from !== undefined) { if (!isTime(body.from)) return fail(res, 400, 'Время в формате ЧЧ:ММ'); next.from = body.from; }
      if (body.to !== undefined) { if (!isTime(body.to)) return fail(res, 400, 'Время в формате ЧЧ:ММ'); next.to = body.to; }
      if (next.from >= next.to) return fail(res, 400, 'Время окончания должно быть позже начала');
      if (body.title !== undefined) { next.title = str(body.title, 120); if (!next.title) return fail(res, 400, 'Укажите, что сделать'); }
      if (body.note !== undefined) next.note = str(body.note, 1000);
      if (body.address !== undefined) next.address = str(body.address, 300);
      const clash = overlaps(next, t.id);
      if (clash.length && !body.force) return fail(res, 409, `У мастера в это время уже есть ${clash[0].num} (${clash[0].from}–${clash[0].to}). Выберите другое время`);
      const changedMaster = next.masterId !== t.masterId;
      Object.assign(t, next);
      if (changedMaster || t.status === 'declined') { t.status = 'assigned'; t.declineReason = ''; }
      addHistory(t, me, changedMaster ? `переназначил(а) на ${nameOf(t.masterId)}` : 'изменил(а) задачу');
      audit(me, `${t.num}: изменена задача`, t.id);
      notify(t.masterId, `${changedMaster ? 'Новая задача' : 'Изменена задача'} ${t.num}: ${t.title}, ${ruDate(t.date)} ${t.from}`, '#/my', !changedMaster);
      if (changedMaster) tgTaskMessage(t);
      return done(taskView(t));
    }
    if (m === 'DELETE') {
      db.tasks = db.tasks.filter((x) => x !== t);
      audit(me, `удалена задача ${t.num}`, t.id);
      notify(t.masterId, `Задача ${t.num} отменена`, '#/my');
      return done({ ok: true });
    }
  }

  // всё ниже — только для админа и менеджеров
  if (!staff(me)) return fail(res, 403, 'Недостаточно прав');

  // ----- заявки и сделки -----
  if (what === 'leads' && !id) {
    if (m === 'GET') return send(res, 200, filterLeads(me, q).map((l) => leadView(l, me)));
    if (m === 'POST') {
      const r = createLead(me, body, body.source);
      if (r.error) return fail(res, 400, r.error);
      return done(leadView(r.lead, me), 201);
    }
  }
  if (what === 'leads' && id) {
    const l = leadById(id);
    if (!l || !canLead(me, l)) return fail(res, 404, 'Заявка не найдена');
    const full = () => ({
      ...leadView(l, me), client: clientById(l.clientId),
      tasks: db.tasks.filter((t) => t.leadId === l.id).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from)).map(taskView),
      reminders: db.reminders.filter((r) => r.leadId === l.id && !r.done),
      otherLeads: db.leads.filter((x) => x.clientId === l.clientId && x.id !== l.id && canLead(me, x)).map((x) => ({ id: x.id, num: x.num, dealNum: x.dealNum, stage: x.stage, workType: x.workType, createdAt: x.createdAt })),
    });
    if (m === 'GET' && !sub) return send(res, 200, full());
    if (m === 'PATCH' && !sub) {
      const changes = [];
      if (body.address !== undefined && str(body.address, 300) !== l.address) { l.address = str(body.address, 300); changes.push('адрес'); }
      if (body.workType !== undefined && str(body.workType, 80) !== l.workType) { l.workType = str(body.workType, 80) || l.workType; changes.push(`тип работ: ${l.workType}`); }
      if (body.budget !== undefined && Number(body.budget) !== l.budget) { l.budget = Math.max(0, Math.round(Number(body.budget) || 0)); changes.push(`бюджет: ${money(l.budget)}`); }
      if (body.source !== undefined && SOURCES[body.source] && body.source !== l.source) { l.source = body.source; changes.push(`источник: ${SOURCES[l.source]}`); }
      if (body.amount !== undefined && l.isDeal && Number(body.amount) !== l.amount) { l.amount = Math.max(0, Math.round(Number(body.amount) || 0)); changes.push(`сумма сделки: ${money(l.amount)}`); }
      if (body.managerId !== undefined && body.managerId !== l.managerId) {
        if (!isAdmin) return fail(res, 403, 'Передать заявку другому менеджеру может только администратор');
        const mg = userById(body.managerId);
        if (!mg || mg.role !== 'manager' || !mg.active) return fail(res, 400, 'Выберите менеджера');
        l.managerId = mg.id; changes.push(`менеджер: ${mg.name}`);
        notify(mg.id, `Вам передана заявка ${l.num}`, `#/lead/${l.id}`);
      }
      if (changes.length) { addHistory(l, me, 'изменил(а) ' + changes.join(', ')); audit(me, `${l.num}: ${changes.join(', ')}`, l.id); }
      return done(full());
    }
    if (sub === 'stage' && m === 'POST') {
      const r = setStage(l, me, body.stage, body.lostReason);
      if (r.error) return fail(res, 400, r.error);
      return done(full());
    }
    if (sub === 'deal' && m === 'POST') {
      const r = toDeal(l, me, body.amount);
      if (r.error) return fail(res, 400, r.error);
      return done(full());
    }
    if (sub === 'comments' && m === 'POST') {
      const text = str(body.text, 3000);
      if (!text) return fail(res, 400, 'Пустой комментарий');
      l.comments.push({ id: newId(), userId: me.id, at: now(), text });
      l.updatedAt = now();
      audit(me, `${l.num}: комментарий`, l.id);
      if (me.id !== l.managerId) notify(l.managerId, `${me.name} прокомментировал(а) ${l.num}`, `#/lead/${l.id}`);
      return done(full());
    }
    if (sub === 'files' && m === 'POST') {
      const up = saveUpload(body);
      if (up.error) return fail(res, 400, up.error);
      const kind = ['photo', 'estimate', 'contract', 'other'].includes(body.kind) ? body.kind : 'other';
      l.files.push({ ...up.file, kind, userId: me.id });
      addHistory(l, me, `добавил(а) файл «${up.file.name}»`);
      audit(me, `${l.num}: файл ${up.file.name}`, l.id);
      return done(full());
    }
    if (sub === 'files' && m === 'DELETE') {
      const f = l.files.find((x) => x.id === body.id);
      if (!f) return fail(res, 404, 'Файл не найден');
      l.files = l.files.filter((x) => x !== f);
      addHistory(l, me, `удалил(а) файл «${f.name}»`);
      audit(me, `${l.num}: удалён файл ${f.name}`, l.id);
      return done(full());
    }
    if (sub === 'payments' && m === 'POST') {
      if (!l.isDeal) return fail(res, 400, 'Оплаты принимаются только по сделке');
      const sum = Math.round(Number(body.sum) || 0);
      if (sum <= 0) return fail(res, 400, 'Укажите сумму');
      if (!isDate(body.date)) return fail(res, 400, 'Укажите дату оплаты');
      const kind = body.kind === 'prepay' ? 'prepay' : 'pay';
      l.payments.push({ id: newId(), date: body.date, sum, kind, note: str(body.note, 200) });
      addHistory(l, me, `${kind === 'prepay' ? 'предоплата' : 'оплата'} ${money(sum)} от ${ruDate(body.date)}`);
      audit(me, `${l.dealNum}: оплата ${money(sum)}`, l.id);
      return done(full());
    }
    if (sub === 'payments' && m === 'DELETE') {
      const p = l.payments.find((x) => x.id === body.id);
      if (!p) return fail(res, 404, 'Оплата не найдена');
      l.payments = l.payments.filter((x) => x !== p);
      addHistory(l, me, `удалил(а) оплату ${money(p.sum)} от ${ruDate(p.date)}`);
      audit(me, `${l.dealNum}: удалена оплата ${money(p.sum)}`, l.id);
      return done(full());
    }
    if (sub === 'tasks' && m === 'POST') {
      const ms = userById(body.masterId);
      if (!ms || ms.role !== 'master' || !ms.active) return fail(res, 400, 'Выберите мастера');
      if (!isDate(body.date)) return fail(res, 400, 'Укажите дату');
      if (!isTime(body.from) || !isTime(body.to) || body.from >= body.to) return fail(res, 400, 'Укажите время: начало раньше окончания');
      const title = str(body.title, 120);
      if (!title) return fail(res, 400, 'Укажите, что сделать');
      if (l.stage === 'lost') return fail(res, 400, 'Заявка в отказе');
      const t = {
        id: newId(), num: 'Т-' + (++db.counters.task), leadId: l.id, masterId: ms.id, kind: body.kind === 'measure' ? 'measure' : 'work', title,
        date: body.date, from: body.from, to: body.to, address: str(body.address, 300) || l.address, note: str(body.note, 1000), status: 'assigned', declineReason: '',
        photos: [], createdBy: me.id, createdAt: now(), history: [],
      };
      const clash = overlaps(t);
      if (clash.length && !body.force) { db.counters.task--; return fail(res, 409, `У мастера ${ms.name} в это время уже есть ${clash[0].num} (${clash[0].from}–${clash[0].to}). Выберите другое время или мастера`); }
      addHistory(t, me, `назначил(а) мастеру ${ms.name}`);
      db.tasks.push(t);
      addHistory(l, me, `задача ${t.num} «${title}» → ${ms.name}, ${ruDate(t.date)} ${t.from}`);
      audit(me, `${l.num}: задача ${t.num} → ${ms.name}`, t.id);
      notify(ms.id, `Новая задача ${t.num}: ${title}, ${ruDate(t.date)} ${t.from}, ${t.address}`, '#/my', false);
      tgTaskMessage(t);
      return done(full(), 201);
    }
  }

  // ----- клиенты -----
  if (what === 'clients' && !id) {
    if (m === 'GET') {
      const text = String(q.get('q') || '').toLowerCase().trim(); const digits = text.replace(/\D/g, '');
      const tag = q.get('tag');
      const list = db.clients.filter((c) => canClient(me, c)).filter((c) => {
        if (tag && !c.tags.includes(tag)) return false;
        const leads = db.leads.filter((l) => l.clientId === c.id);
        // поиск по дате: ДД.ММ.ГГГГ — дата заявки или звонка
        const dm = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
        if (dm) { const d = `${dm[3]}-${dm[2]}-${dm[1]}`; return leads.some((l) => localDate(l.createdAt) === d) || c.calls.some((x) => localDate(x.at) === d); }
        if (!text) return true;
        return `${c.name} ${c.address} ${c.email}`.toLowerCase().includes(text) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits));
      }).map((c) => {
        const leads = db.leads.filter((l) => l.clientId === c.id);
        return { ...c, calls: undefined, callsCount: c.calls.length, orders: leads.length, active: leads.filter((l) => !['done', 'lost'].includes(l.stage)).length,
          total: leads.filter((l) => l.isDeal && l.stage !== 'lost').reduce((s, l) => s + l.amount, 0), lastAt: leads.map((l) => l.createdAt).sort().pop() || c.createdAt, managerName: nameOf(c.managerId) };
      }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
      return send(res, 200, list);
    }
    if (m === 'POST') {
      const name = str(body.name, 100); if (!name) return fail(res, 400, 'Укажите имя клиента');
      const digits = str(body.phone, 30).replace(/\D/g, '').replace(/^8/, '7');
      if (digits && db.clients.some((c) => c.phone.replace(/\D/g, '').replace(/^8/, '7') === digits)) return fail(res, 400, 'Клиент с таким телефоном уже есть');
      const c = findOrCreateClient(me, { ...body, managerId: me.role === 'manager' ? me.id : body.managerId || null });
      c.tags = Array.isArray(body.tags) ? body.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 10) : [];
      c.note = str(body.note, 2000);
      return done(c, 201);
    }
  }
  if (what === 'clients' && id) {
    const c = clientById(id);
    if (!c || !canClient(me, c)) return fail(res, 404, 'Клиент не найден');
    const full = () => ({
      ...c, managerName: nameOf(c.managerId),
      leads: db.leads.filter((l) => l.clientId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((l) => ({ ...leadView(l, me), hidden: !canLead(me, l) })),
      reminders: db.reminders.filter((r) => r.clientId === c.id && !r.done),
      calls: [...c.calls].sort((a, b) => b.at.localeCompare(a.at)).map((x) => ({ ...x, userName: nameOf(x.userId) })),
    });
    if (m === 'GET' && !sub) return send(res, 200, full());
    if (m === 'PATCH' && !sub) {
      if (body.name !== undefined) { const n = str(body.name, 100); if (!n) return fail(res, 400, 'Укажите имя'); c.name = n; }
      if (body.phone !== undefined) c.phone = str(body.phone, 30);
      if (body.email !== undefined) c.email = str(body.email, 100);
      if (body.address !== undefined) c.address = str(body.address, 300);
      if (body.note !== undefined) c.note = str(body.note, 2000);
      if (Array.isArray(body.tags)) c.tags = [...new Set(body.tags.map((t) => str(t, 30)).filter(Boolean))].slice(0, 10);
      audit(me, `изменён клиент ${c.name}`, c.id);
      return done(full());
    }
    if (sub === 'calls' && m === 'POST') {
      const text = str(body.text, 1000); if (!text) return fail(res, 400, 'Опишите звонок');
      c.calls.push({ id: newId(), at: now(), userId: me.id, text });
      audit(me, `звонок клиенту ${c.name}`, c.id);
      return done(full());
    }
  }

  // ----- напоминания менеджеру -----
  if (what === 'reminders') {
    if (m === 'GET') {
      const list = db.reminders.filter((r) => !r.done && (isAdmin ? (q.get('all') ? true : r.managerId === me.id) : r.managerId === me.id))
        .sort((a, b) => a.due.localeCompare(b.due)).map((r) => ({ ...r, clientName: clientById(r.clientId)?.name || '', leadNum: leadById(r.leadId)?.num || '', managerName: nameOf(r.managerId) }));
      return send(res, 200, list);
    }
    if (m === 'POST' && !id) {
      const c = clientById(body.clientId);
      if (!c || !canClient(me, c)) return fail(res, 400, 'Клиент не найден');
      const days = Number(body.inDays);
      const due = isDate(body.due) ? body.due : Number.isFinite(days) ? new Date(Date.now() + (TZ_OFFSET * 3600 + days * 86400) * 1000).toISOString().slice(0, 10) : null;
      if (!due) return fail(res, 400, 'Укажите дату');
      const text = str(body.text, 300) || 'Позвонить клиенту';
      const r = { id: newId(), managerId: me.role === 'manager' ? me.id : (body.managerId || c.managerId || me.id), clientId: c.id, leadId: body.leadId || null, due, text, done: false, createdAt: now() };
      db.reminders.push(r);
      audit(me, `напоминание ${ruDate(due)}: ${text} (${c.name})`, c.id);
      return done(r, 201);
    }
    if (m === 'POST' && id && sub === 'done') {
      const r = db.reminders.find((x) => x.id === id);
      if (!r || (!isAdmin && r.managerId !== me.id)) return fail(res, 404, 'Напоминание не найдено');
      r.done = true; r.doneAt = now();
      audit(me, `выполнено напоминание: ${r.text}`, r.clientId);
      return done({ ok: true });
    }
  }

  // ----- календарь загрузки мастеров -----
  if (what === 'calendar' && m === 'GET') {
    const from = isDate(q.get('from')) ? q.get('from') : todayStr();
    const days = Math.min(14, Math.max(1, Number(q.get('days')) || 1));
    const to = new Date(from + 'T12:00:00Z'); to.setUTCDate(to.getUTCDate() + days - 1);
    const toS = to.toISOString().slice(0, 10);
    const masters = db.users.filter((u) => u.role === 'master' && u.active).map((u) => ({ id: u.id, name: u.name, specialty: u.specialty || '', phone: u.phone }));
    // в календаре менеджер видит занятость всех мастеров, но подробности — только своих задач
    const tasks = db.tasks.filter((t) => t.date >= from && t.date <= toS && t.status !== 'declined').map((t) => (canTask(me, t) ? { ...taskView(t), mine: true }
      : { id: t.id, masterId: t.masterId, date: t.date, from: t.from, to: t.to, status: t.status, title: 'Занят', mine: false }));
    return send(res, 200, { from, to: toS, masters, tasks });
  }

  // ----- отчёты -----
  if (what === 'report' && m === 'GET') {
    const to = isDate(q.get('to')) ? q.get('to') : todayStr();
    const from = isDate(q.get('from')) ? q.get('from') : to.slice(0, 8) + '01';
    return send(res, 200, report(from, to, me));
  }

  // ----- экспорт в Excel -----
  if (what === 'export' && m === 'GET') {
    let name; let rows;
    if (id === 'leads') {
      name = 'Заявки';
      rows = [['Номер', 'Сделка', 'Дата', 'Клиент', 'Телефон', 'Адрес', 'Тип работ', 'Источник', 'Этап', 'Менеджер', 'Бюджет', 'Сумма сделки', 'Оплачено', 'Остаток', 'Оплата']];
      for (const l of filterLeads(me, q)) {
        const v = leadView(l, me);
        rows.push([l.num, l.dealNum, ruDate(localDate(l.createdAt)), v.clientName, v.clientPhone, l.address, l.workType, SOURCES[l.source], STAGE_RU[l.stage], v.managerName, l.budget, l.amount || '', v.paid || '', v.rest || '', v.payStatus]);
      }
    } else if (id === 'tasks') {
      name = 'Задачи';
      rows = [['Номер', 'Дата', 'С', 'До', 'Мастер', 'Что сделать', 'Адрес', 'Клиент', 'Заявка', 'Статус']];
      for (const t of filterTasks(me, q)) { const v = taskView(t); rows.push([t.num, ruDate(t.date), t.from, t.to, v.masterName, t.title, t.address, v.clientName, v.leadNum, TASK_RU[t.status]]); }
    } else return fail(res, 404, 'Неизвестная выгрузка');
    audit(me, `выгрузка в Excel: ${name.toLowerCase()} (${rows.length - 1} строк)`);
    save();
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${name}_${todayStr()}.xlsx`)}` });
    return res.end(xlsx(name, rows));
  }

  // ===== дальше — только администратор =====
  if (!isAdmin) return fail(res, 403, 'Раздел доступен только администратору');

  if (what === 'users') {
    if (m === 'GET') return send(res, 200, db.users.map((u) => ({ ...pub(u), clientName: u.clientId ? clientById(u.clientId)?.name : '' })));
    if (m === 'POST' && !id) {
      const login = str(body.login, 40).toLowerCase();
      if (!/^[a-z0-9._@-]{3,}$/.test(login)) return fail(res, 400, 'Логин — латиница/цифры, от 3 символов');
      if (db.users.some((u) => u.login === login)) return fail(res, 400, 'Такой логин уже есть');
      if (!['admin', 'manager', 'master', 'client'].includes(body.role)) return fail(res, 400, 'Выберите роль');
      const name = str(body.name, 80); if (!name) return fail(res, 400, 'Укажите имя');
      if (String(body.password || '').length < 6) return fail(res, 400, 'Пароль — не короче 6 символов');
      if (body.role === 'client' && !clientById(body.clientId)) return fail(res, 400, 'Для кабинета клиента выберите клиента из базы');
      const u = { id: newId(), login, name, role: body.role, phone: str(body.phone, 30), tgChatId: str(body.tgChatId, 20), specialty: str(body.specialty, 60), clientId: body.role === 'client' ? body.clientId : undefined, active: true, ...hashPassword(String(body.password)), createdAt: now() };
      db.users.push(u);
      audit(me, `создан пользователь ${login} (${body.role})`, u.id);
      return done(pub(u), 201);
    }
    if (m === 'PATCH' && id) {
      const u = userById(id); if (!u) return fail(res, 404, 'Пользователь не найден');
      if (body.active === false && u.id === me.id) return fail(res, 400, 'Нельзя отключить самого себя');
      if (body.name !== undefined) { const n = str(body.name, 80); if (!n) return fail(res, 400, 'Укажите имя'); u.name = n; }
      for (const k of ['phone', 'specialty']) if (body[k] !== undefined) u[k] = str(body[k], 60);
      if (body.tgChatId !== undefined) u.tgChatId = str(body.tgChatId, 20).replace(/[^\d-]/g, '');
      if (body.role !== undefined && body.role !== u.role) {
        if (u.id === me.id) return fail(res, 400, 'Нельзя менять свою роль');
        if (!['admin', 'manager', 'master'].includes(body.role) || u.role === 'client') return fail(res, 400, 'Недопустимая роль');
        u.role = body.role;
      }
      if (body.active !== undefined) {
        u.active = !!body.active;
        if (!u.active) for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
      }
      if (body.password) { if (String(body.password).length < 6) return fail(res, 400, 'Пароль — не короче 6 символов'); Object.assign(u, hashPassword(String(body.password))); }
      audit(me, `изменён пользователь ${u.login}`, u.id);
      return done(pub(u));
    }
  }
  if (what === 'worktypes' && m === 'PUT') {
    const list = Array.isArray(body.list) ? [...new Set(body.list.map((x) => str(x, 80)).filter(Boolean))] : [];
    if (!list.length) return fail(res, 400, 'Нужен хотя бы один тип работ');
    db.workTypes = list;
    audit(me, 'изменён справочник типов работ');
    return done({ workTypes: list });
  }
  if (what === 'log' && m === 'GET') {
    const text = String(q.get('q') || '').toLowerCase();
    const list = db.log.filter((x) => (!q.get('user') || x.userId === q.get('user')) && (!text || x.text.toLowerCase().includes(text))).slice(0, 300).map((x) => ({ ...x, userName: nameOf(x.userId) }));
    return send(res, 200, list);
  }
  if (what === 'settings') {
    const view = () => ({ telegramToken: db.settings.telegramToken ? '••••' + db.settings.telegramToken.slice(-4) : '', webhookKey: db.settings.webhookKey, tgLog });
    if (m === 'GET') return send(res, 200, view());
    if (m === 'PATCH') {
      if (body.telegramToken !== undefined && !String(body.telegramToken).startsWith('••••')) { db.settings.telegramToken = str(body.telegramToken, 100); db.settings.tgOffset = 0; }
      if (body.newWebhookKey) db.settings.webhookKey = crypto.randomBytes(8).toString('hex');
      audit(me, 'изменены настройки интеграций');
      return done(view());
    }
    if (m === 'POST' && id === 'test') {
      if (!me.tgChatId) return fail(res, 400, 'Укажите свой Telegram ID в профиле');
      const r = await tgCall('sendMessage', { chat_id: me.tgChatId, text: '✅ Тестовое уведомление из CRM «Новый дом»' });
      return r.ok ? send(res, 200, { ok: true }) : fail(res, 400, 'Telegram: ' + r.description);
    }
  }
  if (what === 'backups') {
    // новые копии сверху (по времени создания, а не по имени)
    if (m === 'GET' && !id) return send(res, 200, fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).map((f) => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { name: f, size: st.size, at: st.mtime.toISOString() }; }).sort((a, b) => b.at.localeCompare(a.at)));
    if (m === 'POST' && !id) { const f = makeBackup('manual'); audit(me, `резервная копия ${f}`); return done({ name: f }); }
    if (id && /^db-[\w-]+\.json$/.test(id)) {
      const fp = path.join(BACKUP_DIR, id);
      if (!fs.existsSync(fp)) return fail(res, 404, 'Копия не найдена');
      if (m === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${id}"` }); return fs.createReadStream(fp).pipe(res); }
      if (m === 'POST' && sub === 'restore') {
        makeBackup('before-restore');
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (!Array.isArray(data.leads) || !Array.isArray(data.users)) return fail(res, 400, 'Файл не похож на копию CRM');
        const sessions = db.sessions; db = data; db.sessions = sessions;
        audit(me, `база восстановлена из ${id}`);
        return done({ ok: true });
      }
    }
  }
  return fail(res, 404, 'Не найдено');
}

// ---------- резервные копии по расписанию ----------
function makeBackup(kind = 'auto') {
  const stamp = localNow().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const name = kind === 'auto' ? `db-${todayStr()}.json` : `db-${stamp}-${kind}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, name), JSON.stringify(db));
  const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort((a, b) => fs.statSync(path.join(BACKUP_DIR, a)).mtimeMs - fs.statSync(path.join(BACKUP_DIR, b)).mtimeMs);
  for (const f of all.slice(0, Math.max(0, all.length - 20))) fs.unlinkSync(path.join(BACKUP_DIR, f));
  return name;
}
function backupTick() { if (!fs.existsSync(path.join(BACKUP_DIR, `db-${todayStr()}.json`))) makeBackup('auto'); }

// ---------- запуск ----------
load();
backupTick();
setInterval(() => { backupTick(); tgWorker().catch(console.error); }, 60000).unref();
setInterval(() => { tgWorker().catch(console.error); tgPoll().catch(console.error); }, 3000).unref();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname === '/health') return send(res, 200, { ok: true });
    if (pathname.startsWith('/api/')) return await api(req, res, pathname.split('/').filter(Boolean).slice(1), currentUser(req), url);
    return serveStatic(res, pathname);
  } catch (e) {
    if (e.code) return fail(res, e.code, e.message);
    console.error(e);
    if (!res.headersSent) fail(res, 500, 'Ошибка сервера');
  }
});
if (require.main === module) server.listen(PORT, () => console.log(`Новый дом · CRM: http://localhost:${PORT} (данные: ${DATA_DIR})`));
process.on('SIGTERM', () => { saveNow(); process.exit(0); });
module.exports = { server, handleTgUpdate, getDb: () => db };
