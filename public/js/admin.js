/* Отчёты, сотрудники, настройки и интеграции, журнал действий, профиль. */
(() => {
'use strict';
const A = window.App;
const { esc, ICON, money, $, $$ } = A;

// ---------- отчёты ----------
A.pages.reports = {
  title: 'Отчёты',
  async render(r) {
    const S = A.S; const t = S.today;
    const presets = [['month', 'Этот месяц', t.slice(0, 8) + '01', t], ['prev', 'Прошлый месяц', prevMonth(t)[0], prevMonth(t)[1]], ['30', '30 дней', A.addDays(t, -29), t], ['90', '90 дней', A.addDays(t, -89), t]];
    const p = r.q.get('p') || (r.q.get('from') ? '' : '90');
    const pr = presets.find((x) => x[0] === p);
    const from = pr ? pr[2] : r.q.get('from'); const to = pr ? pr[3] : r.q.get('to') || t;
    const d = await A.api('GET', `/report?from=${from}&to=${to}`);
    const maxW = Math.max(1, ...d.weeks.map((w) => w.sum));
    const maxF = Math.max(1, ...d.funnel.filter((f) => f.stage !== 'lost').map((f) => f.count));
    const maxS = Math.max(1, ...d.bySource.map((s) => s.leads));
    return `<div class="page-head"><div><h1>Отчёты</h1><p class="muted">${A.fmtDate(from)} — ${A.fmtDate(to)}${A.isAdmin() ? ' · вся студия' : ' · ваши сделки'}</p></div>
      <form class="filters" id="rpf">${presets.map(([k, l]) => `<a class="chip ${p === k ? 'on' : ''}" href="#/reports?p=${k}">${l}</a>`).join('')}
        <label class="date-f"><span>с</span><input type="date" name="from" value="${from}"></label><label class="date-f"><span>по</span><input type="date" name="to" value="${to}"></label></form></div>
      <div class="kpis six">
        <div class="kpi"><span>Выручка</span><b>${A.moneyShort(d.revenue)}</b><small>поступило оплат</small></div>
        <div class="kpi"><span>Средний чек</span><b>${A.moneyShort(d.avgCheck)}</b><small>по ${A.plural(d.closed, 'закрытой сделке', 'закрытым сделкам', 'закрытым сделкам')}</small></div>
        <div class="kpi"><span>Конверсия</span><b>${d.conversion}%</b><small>заявка → сделка</small></div>
        <div class="kpi"><span>Заявок</span><b>${d.leads}</b><small>${A.plural(d.deals, 'стала', 'стали', 'стали')} сделкой</small></div>
        <div class="kpi"><span>Закрыто сделок</span><b>${d.closed}</b><small>этап «Завершено»</small></div>
        <div class="kpi warn"><span>Ждём оплат</span><b>${A.moneyShort(d.debt)}</b><small>остаток по сделкам</small></div>
      </div>
      <div class="cols">
        <section class="card"><div class="card-head"><h2>Выручка по неделям</h2></div>
          <div class="bars">${d.weeks.map((w) => `<div class="bar" title="${A.short(w.from)}–${A.short(w.to)}: ${money(w.sum)}"><span class="bv">${w.sum ? A.moneyShort(w.sum).replace(' ₽', '') : ''}</span><i style="height:${Math.round((w.sum / maxW) * 100)}%"></i><small>${A.short(w.from).slice(0, 5)}</small></div>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h2>Воронка сейчас</h2></div>
          <div class="hbars">${d.funnel.map((f) => `<div class="hbar"><span>${esc(f.name)}</span><div><i class="${A.STAGE_COLOR[f.stage]}" style="width:${f.stage === 'lost' ? Math.round(f.count / maxF * 100) : Math.round((f.count / maxF) * 100)}%"></i></div><b>${f.count}</b><small>${A.moneyShort(f.sum)}</small></div>`).join('')}</div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Менеджеры</h2><span class="muted">рейтинг по выручке за период</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Менеджер</th><th class="num">Заявок</th><th class="num">Сделок</th><th>Конверсия</th><th class="num">Закрыто</th><th class="num">Средний чек</th><th class="num">Выручка</th></tr></thead><tbody>
        ${d.managers.map((m, i) => `<tr><td>${i === 0 && m.revenue ? '🏆' : i + 1}</td><td>${A.avatar(m.name, 'sm')} <b>${esc(m.name)}</b></td><td class="num">${m.leads}</td><td class="num">${m.deals}</td>
          <td><div class="conv"><i style="width:${m.conversion}%"></i><span>${m.conversion}%</span></div></td><td class="num">${m.closed}</td><td class="num">${m.avgCheck ? money(m.avgCheck) : '—'}</td><td class="num"><b>${money(m.revenue)}</b></td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>Источники заявок</h2></div>
        <div class="hbars">${d.bySource.map((s) => `<div class="hbar"><span>${esc(s.name)}</span><div><i class="blue" style="width:${Math.round(s.leads / maxS * 100)}%"></i></div><b>${s.leads}</b><small>${s.leads ? Math.round(s.deals / s.leads * 100) : 0}% в сделку</small></div>`).join('')}</div></section>`;
  },
  bind(el) {
    const f = $('#rpf', el);
    $$('input[type=date]', f).forEach((i) => (i.onchange = () => { location.hash = `#/reports?from=${f.from.value}&to=${f.to.value}`; }));
  },
};
function prevMonth(t) {
  const [y, m] = t.split('-').map(Number);
  const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return [`${py}-${String(pm).padStart(2, '0')}-01`, `${py}-${String(pm).padStart(2, '0')}-${last}`];
}

// ---------- сотрудники ----------
A.pages.users = {
  title: 'Сотрудники',
  async render() {
    const users = (A.cache.users = await A.api('GET', '/users'));
    const group = (role) => users.filter((u) => u.role === role);
    const row = (u) => `<tr class="${u.active ? '' : 'off'}"><td>${A.avatar(u.name, 'sm')} <b>${esc(u.name)}</b>${u.specialty ? `<small class="block">${esc(u.specialty)}</small>` : ''}${u.clientName ? `<small class="block">кабинет клиента: ${esc(u.clientName)}</small>` : ''}</td>
      <td><code>${esc(u.login)}</code></td><td>${A.ROLE[u.role]}</td><td>${esc(u.phone || '—')}</td><td>${u.tgChatId ? `<span class="badge green sm">подключён</span>` : '<span class="muted">—</span>'}</td>
      <td>${u.active ? '<span class="badge green sm">активен</span>' : '<span class="badge grey sm">отключён</span>'}</td><td class="num"><button class="btn sm" data-edit="${u.id}">Изменить</button></td></tr>`;
    return `<div class="page-head"><div><h1>Сотрудники и доступы</h1><p class="muted">Роли: администратор видит всё; менеджер — свои заявки и сделки; мастер — только свои задачи; клиент — статус своего заказа.</p></div>
      <button class="btn primary" id="addUser">${ICON.plus}Добавить</button></div>
      ${[['admin', 'Администраторы'], ['manager', 'Менеджеры'], ['master', 'Мастера'], ['client', 'Кабинеты клиентов']].map(([r, t]) => `<section class="card flush"><div class="card-head pad"><h2>${t}</h2><span class="muted">${group(r).length}</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Телефон</th><th>Telegram</th><th>Статус</th><th></th></tr></thead><tbody>${group(r).map(row).join('')}</tbody></table></div></section>`).join('')}`;
  },
  bind(el) {
    $('#addUser', el).onclick = () => userModal();
    $$('[data-edit]', el).forEach((b) => (b.onclick = () => userModal(A.cache.users.find((u) => u.id === b.dataset.edit))));
  },
};
async function userModal(u) {
  const clients = u ? [] : await A.api('GET', '/clients');
  const w = A.modal(u ? u.name : 'Новый пользователь', `<form id="um" class="grid2">
    <label class="field"><span>Имя *</span><input name="name" required value="${esc(u?.name || '')}"></label>
    <label class="field"><span>Логин *</span><input name="login" ${u ? 'disabled' : 'required'} value="${esc(u?.login || '')}" placeholder="ivanov"></label>
    <label class="field"><span>Роль *</span><select name="role" ${u?.role === 'client' || u?.id === A.S.me.id ? 'disabled' : ''}>${A.opts(Object.entries(A.ROLE).filter(([k]) => !u || k !== 'client' || u.role === 'client'), u?.role || 'manager')}</select></label>
    <label class="field"><span>Телефон</span><input name="phone" value="${esc(u?.phone || '')}"></label>
    <label class="field" data-for="master"><span>Специализация</span><input name="specialty" value="${esc(u?.specialty || '')}" placeholder="Плиточник"></label>
    <label class="field"><span>Telegram ID</span><input name="tgChatId" value="${esc(u?.tgChatId || '')}" placeholder="бот пришлёт по команде /start"></label>
    ${u ? '' : `<label class="field full" data-for="client"><span>Клиент из базы *</span><select name="clientId">${A.opts(clients.map((c) => [c.id, `${c.name} · ${c.phone}`]), '', 'Выберите клиента')}</select></label>`}
    <label class="field"><span>${u ? 'Новый пароль' : 'Пароль *'}</span><input name="password" type="text" ${u ? 'placeholder="не менять"' : 'required'} minlength="6" autocomplete="new-password"></label>
    ${u && u.id !== A.S.me.id ? `<label class="field check-f"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Доступ включён</label>` : '<div></div>'}
    <div class="form-actions full"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">${u ? 'Сохранить' : 'Создать'}</button></div></form>`);
  const f = $('#um', w);
  const sync = () => $$('[data-for]', f).forEach((x) => (x.hidden = x.dataset.for !== f.role.value));
  f.role.onchange = sync; sync();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(f));
    if (u) { if (u.id !== A.S.me.id) b.active = !!f.active?.checked; if (!b.password) delete b.password; if (u.role === 'client' || u.id === A.S.me.id) delete b.role; }
    if (await A.act(() => (u ? A.api('PATCH', '/users/' + u.id, b) : A.api('POST', '/users', b)), 'Сохранено')) { A.closeModal(); A.S = await A.api('GET', '/bootstrap'); A.refresh(); }
  };
}

// ---------- настройки и интеграции ----------
A.pages.settings = {
  title: 'Настройки',
  async render() {
    const [s, backups] = await Promise.all([A.api('GET', '/settings'), A.api('GET', '/backups')]);
    const hook = `${location.origin}/api/hook/lead?key=${s.webhookKey}`;
    return `<div class="page-head"><div><h1>Настройки и интеграции</h1></div></div>
      <div class="cols">
      <section class="card"><div class="card-head"><h2>Заявки с сайта (вебхук)</h2></div>
        <p class="muted">Форма сайта отправляет заявку POST-запросом — в CRM появляется заявка с источником «Сайт», клиент находится по телефону или создаётся, менеджер получает уведомление.</p>
        <label class="field"><span>Адрес вебхука</span><div class="with-btn"><input readonly value="${esc(hook)}" id="hookUrl"><button class="btn sm" id="copyHook">Копировать</button></div></label>
        <details><summary>Пример запроса и HTML-формы</summary><pre>curl -X POST '${esc(hook)}' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Иван","phone":"+7 900 123-45-67","workType":"Ванная и санузел","address":"ул. Ленина, 1","budget":250000,"comment":"Нужен замер"}'</pre>
<pre>&lt;form method="post" action="${esc(hook)}"&gt;
  &lt;input name="name"&gt; &lt;input name="phone"&gt; &lt;textarea name="comment"&gt;&lt;/textarea&gt;
  &lt;button&gt;Оставить заявку&lt;/button&gt;
&lt;/form&gt;</pre><p class="hint">Поля: name и phone — обязательные; workType, address, budget, comment — по желанию.</p></details>
        <button class="btn sm" id="newKey">Сменить ключ</button></section>

      <section class="card"><div class="card-head"><h2>Telegram-бот</h2>${s.telegramToken ? '<span class="badge green">подключён</span>' : '<span class="badge grey">не подключён</span>'}</div>
        <ol class="howto"><li>Создайте бота у <b>@BotFather</b> и вставьте токен ниже.</li><li>Сотрудник пишет боту <code>/start</code> — бот присылает его Telegram ID.</li><li>Укажите ID в карточке сотрудника — ему начнут приходить уведомления, а мастеру — задачи с кнопками «Принять / Отклонить».</li></ol>
        <form id="tgf" class="inline-form"><input name="telegramToken" value="${esc(s.telegramToken)}" placeholder="123456:ABC-DEF…"><button class="btn">Сохранить</button><button type="button" class="btn" id="tgTest">Тест мне</button></form>
        ${s.tgLog.length ? `<details><summary>Последние отправки (${s.tgLog.length})</summary><ul class="history">${s.tgLog.map((x) => `<li><small>${A.fmtDT(x.at)}</small><span>${x.ok ? '✅' : '⚠️ ' + esc(x.error)} ${esc(x.text)}</span></li>`).join('')}</ul></details>` : ''}
      </section></div>

      <div class="cols">
      <section class="card"><div class="card-head"><h2>Справочник: типы работ</h2></div>
        <form id="wtf"><textarea name="list" rows="9">${esc(A.S.workTypes.join('\n'))}</textarea><p class="hint">Каждый тип — с новой строки.</p><button class="btn">Сохранить</button></form></section>

      <section class="card"><div class="card-head"><h2>Резервные копии</h2><button class="btn sm" id="mkBackup">${ICON.plus}Сделать копию</button></div>
        <p class="muted">Копия базы создаётся автоматически раз в сутки, хранятся 20 последних. Восстановление перед заменой делает ещё одну копию текущего состояния.</p>
        <ul class="files">${backups.map((b) => `<li>${ICON.file}<a href="/api/backups/${esc(b.name)}" download>${esc(b.name)}</a><small class="muted">${A.fmtDT(b.at)} · ${Math.round(b.size / 1024)} КБ</small><button class="btn sm" data-restore="${esc(b.name)}">Восстановить</button></li>`).join('')}</ul></section></div>`;
  },
  bind(el) {
    $('#copyHook', el).onclick = () => { navigator.clipboard?.writeText($('#hookUrl', el).value).then(() => A.toast('Скопировано'), () => { $('#hookUrl', el).select(); }); };
    $('#newKey', el).onclick = async () => { if (await A.confirm('Сменить ключ вебхука?', 'Старый адрес перестанет работать — его нужно будет заменить на сайте.', 'Сменить', true)) { if (await A.act(() => A.api('PATCH', '/settings', { newWebhookKey: true }), 'Ключ изменён')) A.refresh(); } };
    $('#tgf', el).onsubmit = async (e) => { e.preventDefault(); if (await A.act(() => A.api('PATCH', '/settings', { telegramToken: e.target.telegramToken.value }), 'Сохранено')) A.refresh(); };
    $('#tgTest', el).onclick = () => A.act(() => A.api('POST', '/settings/test'), 'Сообщение отправлено — проверьте Telegram');
    $('#wtf', el).onsubmit = async (e) => { e.preventDefault(); const r = await A.act(() => A.api('PUT', '/worktypes', { list: e.target.list.value.split('\n') }), 'Справочник сохранён'); if (r) A.S.workTypes = r.workTypes; };
    $('#mkBackup', el).onclick = async () => { if (await A.act(() => A.api('POST', '/backups'), 'Копия создана')) A.refresh(); };
    $$('[data-restore]', el).forEach((b) => (b.onclick = async () => {
      if (await A.confirm('Восстановить базу?', `Все данные будут заменены на копию <b>${esc(b.dataset.restore)}</b>. Текущее состояние сохранится отдельной копией.`, 'Восстановить', true)) {
        if (await A.act(() => A.api('POST', `/backups/${b.dataset.restore}/restore`), 'База восстановлена')) { A.S = await A.api('GET', '/bootstrap'); A.refresh(); }
      }
    }));
  },
};

// ---------- журнал действий ----------
A.pages.log = {
  title: 'Журнал действий',
  async render(r) {
    const list = await A.api('GET', '/log?' + r.q);
    return `<div class="page-head"><div><h1>Журнал действий</h1><p class="muted">Кто, что и когда менял — последние 300 записей</p></div></div>
      <form class="filters" id="lgf"><label class="search"><span>${ICON.search}</span><input name="q" value="${esc(r.q.get('q') || '')}" placeholder="Номер заявки, клиент, действие"></label>
        <select name="user">${A.opts(A.S.staff.map((u) => [u.id, u.name]), r.q.get('user'), 'Все сотрудники')}</select></form>
      <div class="card flush"><div class="table-wrap"><table class="table compact"><thead><tr><th>Когда</th><th>Кто</th><th>Действие</th></tr></thead><tbody>
        ${list.map((x) => `<tr><td class="nowrap">${A.fmtDT(x.at)}</td><td class="nowrap">${esc(x.userName)}</td><td>${esc(x.text)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Записей нет</td></tr>'}</tbody></table></div></div>`;
  },
  bind(el) { A.bindFilters($('#lgf', el), 'log'); },
};

// ---------- профиль ----------
A.pages.profile = {
  title: 'Профиль',
  render() {
    const me = A.S.me;
    return `<div class="page-head"><div><h1>Профиль</h1><p class="muted">${A.ROLE[me.role]} · логин <code>${esc(me.login)}</code></p></div></div>
      <div class="cols">
        <section class="card"><div class="card-head"><h2>Данные</h2></div><form id="pf" class="stack">
          <label class="field"><span>Имя</span><input name="name" value="${esc(me.name)}" required></label>
          <label class="field"><span>Телефон</span><input name="phone" value="${esc(me.phone || '')}"></label>
          ${me.role !== 'client' ? `<label class="field"><span>Telegram ID для уведомлений</span><input name="tgChatId" value="${esc(me.tgChatId || '')}" placeholder="напишите боту студии /start — он пришлёт ID"></label>` : ''}
          <button class="btn primary">Сохранить</button></form></section>
        <section class="card"><div class="card-head"><h2>Пароль</h2></div><form id="pwf" class="stack">
          <label class="field"><span>Текущий пароль</span><input name="oldPassword" type="password" required autocomplete="current-password"></label>
          <label class="field"><span>Новый пароль</span><input name="password" type="password" required minlength="6" autocomplete="new-password"></label>
          <button class="btn">Сменить пароль</button></form>
          <button class="btn ghost-danger" id="logout2">${ICON.logout}Выйти из аккаунта</button></section>
      </div>`;
  },
  bind(el) {
    $('#pf', el).onsubmit = async (e) => { e.preventDefault(); const r = await A.act(() => A.api('PATCH', '/profile', Object.fromEntries(new FormData(e.target))), 'Сохранено'); if (r) { A.S.me = r.me; A.render(); } };
    $('#pwf', el).onsubmit = async (e) => { e.preventDefault(); if (await A.act(() => A.api('PATCH', '/profile', Object.fromEntries(new FormData(e.target))), 'Пароль изменён')) e.target.reset(); };
    $('#logout2', el).onclick = () => $('#logout').click();
  },
};
})();
