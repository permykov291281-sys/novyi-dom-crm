// Тесты ключевых сценариев: заявка → сделка → задача мастеру, права ролей, вебхук, Telegram-кнопки, отчёт, Excel.
// Запуск: npm test (поднимает сервер на свободном порту с отдельной временной базой).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-test-'));
const { server, handleTgUpdate, getDb } = require('../server');
let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
// ждём отложенную запись базы (150 мс), потом убираем временную папку
test.after(async () => { server.close(); await new Promise((r) => setTimeout(r, 400)); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

async function login(loginName) {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: loginName, password: 'remont' }) });
  assert.strictEqual(r.status, 200, 'вход ' + loginName);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return async (method, url, body) => {
    const res = await fetch(base + '/api' + url, { method, headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
}
const today = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

test('заявка → сделка → задача мастеру → мастер выполняет → оплата → завершено', async () => {
  const mgr = await login('manager');
  const lead = await mgr('POST', '/leads', { name: 'Тест Клиентов', phone: '+7 900 000-11-22', address: 'Екатеринбург, ул. Тестовая, 1', workType: 'Кухня', budget: 200000, source: 'call' });
  assert.strictEqual(lead.status, 201);
  assert.strictEqual(lead.data.stage, 'new');
  const id = lead.data.id;

  // в работу без сделки нельзя
  let r = await mgr('POST', `/leads/${id}/stage`, { stage: 'work' });
  assert.strictEqual(r.status, 400);
  assert.match(r.data.error, /сделку/);

  r = await mgr('POST', `/leads/${id}/deal`, { amount: 210000 });
  assert.strictEqual(r.status, 200);
  assert.ok(r.data.isDeal && r.data.dealNum.startsWith('С-'));
  assert.strictEqual(r.data.num, lead.data.num, 'номер заявки сохраняется — без пересоздания');
  assert.strictEqual(r.data.amount, 210000);

  r = await mgr('POST', `/leads/${id}/payments`, { sum: 63000, date: today(), kind: 'prepay' });
  assert.strictEqual(r.data.payStatus, 'Частично');
  assert.strictEqual(r.data.rest, 147000);

  const boot = await mgr('GET', '/bootstrap');
  const ivan = boot.data.staff.find((u) => u.name === 'Иван Кравцов');
  // пересечение с уже назначенной задачей Ивана сегодня в 09:00 — сервер не даёт поставить
  r = await mgr('POST', `/leads/${id}/tasks`, { masterId: ivan.id, date: today(), from: '10:00', to: '12:00', title: 'Сборка кухни' });
  assert.strictEqual(r.status, 409);
  r = await mgr('POST', `/leads/${id}/tasks`, { masterId: ivan.id, date: today(), from: '19:00', to: '21:00', title: 'Сборка кухни' });
  assert.strictEqual(r.status, 201);
  const task = r.data.tasks.find((t) => t.title === 'Сборка кухни');
  assert.strictEqual(task.status, 'assigned');

  const master = await login('master');
  const mine = await master('GET', '/tasks');
  assert.ok(mine.data.some((t) => t.id === task.id), 'мастер видит новую задачу');
  r = await master('POST', `/tasks/${task.id}/status`, { status: 'done' });
  assert.strictEqual(r.status, 400, 'нельзя выполнить, не приняв');
  for (const s of ['accepted', 'in_progress', 'done']) { r = await master('POST', `/tasks/${task.id}/status`, { status: s }); assert.strictEqual(r.status, 200, s); }
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await master('POST', `/tasks/${task.id}/photos`, { phase: 'after', name: 'после.png', data: png });
  assert.strictEqual(r.data.photos.length, 1);
  const photo = await master('GET', r.data.photos[0].url.replace('/api', ''));
  assert.strictEqual(photo.status, 200);

  // менеджер получил уведомление о выполнении
  const notes = await mgr('GET', '/notifications');
  assert.ok(notes.data.some((n) => n.text.includes(task.num) && n.text.includes('Выполнена')));

  r = await mgr('POST', `/leads/${id}/payments`, { sum: 147000, date: today() });
  assert.strictEqual(r.data.payStatus, 'Оплачено');
  r = await mgr('POST', `/leads/${id}/stage`, { stage: 'work' });
  r = await mgr('POST', `/leads/${id}/stage`, { stage: 'done' });
  assert.strictEqual(r.data.stage, 'done');
  assert.ok(r.data.history.length >= 6, 'вся история изменений записана');
});

test('права: мастер, менеджер, клиент видят только своё', async () => {
  const admin = await login('admin');
  const all = await admin('GET', '/leads');
  const mgr = await login('manager');
  const own = await mgr('GET', '/leads');
  assert.ok(own.data.length > 0 && own.data.length < all.data.length);
  const me = (await mgr('GET', '/bootstrap')).data.me;
  assert.ok(own.data.every((l) => l.managerId === me.id));
  const foreign = all.data.find((l) => l.managerId !== me.id);
  assert.strictEqual((await mgr('GET', '/leads/' + foreign.id)).status, 404, 'чужая сделка недоступна по прямой ссылке');
  assert.strictEqual((await mgr('PATCH', '/leads/' + own.data[0].id, { managerId: foreign.managerId })).status, 403, 'передать заявку может только админ');
  assert.strictEqual((await mgr('GET', '/users')).status, 403);
  assert.strictEqual((await mgr('GET', '/log')).status, 403);

  const master = await login('master');
  assert.strictEqual((await master('GET', '/leads')).status, 403);
  assert.strictEqual((await master('GET', '/clients')).status, 403);
  const mt = await master('GET', '/tasks');
  const myId = (await master('GET', '/bootstrap')).data.me.id;
  assert.ok(mt.data.length && mt.data.every((t) => t.masterId === myId));
  const other = getDb().tasks.find((t) => t.masterId !== myId);
  assert.strictEqual((await master('POST', `/tasks/${other.id}/status`, { status: 'accepted' })).status, 404, 'чужую задачу не изменить');

  const client = await login('client');
  const my = await client('GET', '/my');
  assert.ok(my.data.length >= 1);
  assert.ok(my.data.every((l) => l.comments === undefined && l.history === undefined), 'клиенту не видны внутренние комментарии и история');
  assert.strictEqual((await client('GET', '/leads')).status, 403);
  assert.strictEqual((await client('GET', '/tasks')).data.length, 0);
});

test('вебхук с сайта создаёт заявку и клиента, повторный телефон — тот же клиент', async () => {
  const key = getDb().settings.webhookKey;
  const send = (b, k = key) => fetch(`${base}/api/hook/lead?key=${k}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.strictEqual((await send({ name: 'X', phone: '1' }, 'wrong')).status, 403);
  assert.strictEqual((await send({ phone: '+79001112233' })).status, 400);
  const before = getDb().clients.length;
  let r = await send({ name: 'Сайт Сайтов', phone: '8 (900) 111-22-33', workType: 'Электрика', comment: 'Заменить проводку в двушке' });
  assert.strictEqual(r.status, 201);
  r = await send({ name: 'Сайт Сайтов', phone: '+7 900 111 22 33', workType: 'Сантехника' });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(getDb().clients.length, before + 1, 'клиент один, заявок две');
  const form = await fetch(`${base}/api/hook/lead?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=%D0%A4%D0%BE%D1%80%D0%BC%D0%B0&phone=89005556677' });
  assert.strictEqual(form.status, 201, 'обычная HTML-форма тоже принимается');
  const { num } = await r.json();
  const lead = getDb().leads.find((l) => l.num === num);
  assert.strictEqual(lead.source, 'site');
  assert.ok(getDb().notifications.some((n) => n.userId === lead.managerId && n.text.includes(lead.num)), 'менеджер получил уведомление');
});

test('Telegram: кнопки «Принять / Отклонить» у задачи', async () => {
  const db = getDb();
  const ivan = db.users.find((u) => u.login === 'master');
  ivan.tgChatId = '555';
  const t = db.tasks.find((x) => x.masterId === ivan.id && x.status === 'assigned');
  assert.match(handleTgUpdate({ message: { text: '/start', chat: { id: 555 } } }).text, /Иван Кравцов/);
  assert.match(handleTgUpdate({ message: { text: '/start', chat: { id: 777 } } }).text, /777/);
  assert.match(handleTgUpdate({ callback_query: { id: 'c1', from: { id: 999 }, data: `task:${t.id}:accept` } }).answer, /не вам/);
  assert.strictEqual(handleTgUpdate({ callback_query: { id: 'c2', from: { id: 555 }, data: `task:${t.id}:accept` } }).answer, 'Задача принята');
  assert.strictEqual(t.status, 'accepted');
});

test('напоминания, клиенты, отчёт, выгрузка в Excel', async () => {
  const mgr = await login('manager');
  const clients = await mgr('GET', '/clients?q=ковал');
  assert.strictEqual(clients.data[0].name, 'Мария Ковалёва');
  assert.ok(clients.data[0].tags.includes('VIP'));
  const byPhone = await mgr('GET', '/clients?q=' + encodeURIComponent(clients.data[0].phone.slice(-5)));
  assert.ok(byPhone.data.some((c) => c.name === 'Мария Ковалёва'));
  const vip = await mgr('GET', '/clients?tag=VIP');
  assert.ok(vip.data.every((c) => c.tags.includes('VIP')));
  let r = await mgr('POST', '/reminders', { clientId: clients.data[0].id, inDays: 3, text: 'Позвонить через 3 дня' });
  assert.strictEqual(r.status, 201);
  const rems = await mgr('GET', '/reminders');
  assert.ok(rems.data.some((x) => x.id === r.data.id));
  assert.strictEqual((await mgr('POST', `/reminders/${r.data.id}/done`)).status, 200);

  const admin = await login('admin');
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const rep = await admin('GET', `/report?from=${from}&to=${today()}`);
  assert.ok(rep.data.revenue > 0 && rep.data.avgCheck > 0);
  assert.strictEqual(rep.data.managers.length, 4);
  assert.strictEqual(rep.data.managers.reduce((s, m) => s + m.revenue, 0), rep.data.revenue, 'выручка по менеджерам сходится с итогом');
  const x = await admin('GET', '/export/leads?stage=work');
  assert.strictEqual(x.data.slice(0, 2).toString(), 'PK', 'это настоящий .xlsx (zip)');
  const cal = await mgr('GET', `/calendar?from=${today()}&days=7`);
  assert.strictEqual(cal.data.masters.length, 6);
  assert.ok(cal.data.tasks.some((t) => !t.mine && t.title === 'Занят'), 'чужие задачи в календаре — только «занят»');
  const log = await admin('GET', '/log');
  assert.ok(log.data.length > 10 && log.data.some((l) => /выгрузка в Excel/.test(l.text)));
});
