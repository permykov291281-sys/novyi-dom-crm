/* Клиенты, задачи мастеров, календарь загрузки, кабинет мастера, кабинет клиента. */
(() => {
'use strict';
const A = window.App;
const { esc, ICON, money, $, $$ } = A;
const TAGS = ['VIP', 'проблемный', 'повторный'];

// ---------- клиенты ----------
A.pages.clients = {
  title: 'Клиенты',
  async render(r) {
    const q = r.q;
    const list = await A.api('GET', '/clients?' + q);
    return `<div class="page-head"><div><h1>Клиенты</h1><p class="muted">${A.plural(list.length, 'клиент', 'клиента', 'клиентов')} · одна карточка на клиента, внутри вся история заказов и звонков</p></div>
      <button class="btn primary" id="addClient">${ICON.plus}Новый клиент</button></div>
      <form class="filters" id="cf">
        <label class="search wide"><span>${ICON.search}</span><input name="q" value="${esc(q.get('q') || '')}" placeholder="Имя, телефон, адрес или дата заказа ДД.ММ.ГГГГ"></label>
        <div class="chips">${TAGS.map((t) => `<a class="chip ${q.get('tag') === t ? 'on' : ''}" href="#/clients?${q.get('tag') === t ? '' : 'tag=' + encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
        ${[...q.keys()].length ? '<a class="link" href="#/clients">Сбросить</a>' : ''}
      </form>
      <div class="card flush">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Клиент</th><th>Телефон</th><th>Адрес</th><th>Заказов</th><th>Сумма сделок</th><th>Менеджер</th><th>Последний заказ</th></tr></thead><tbody>
        ${list.map((c) => `<tr data-href="#/client/${c.id}"><td><a href="#/client/${c.id}"><b>${esc(c.name)}</b></a> ${A.tagBadges(c.tags)}</td><td><a href="${A.tel(c.phone)}">${esc(c.phone)}</a></td>
          <td class="cut">${esc(c.address.replace('Екатеринбург, ', ''))}</td><td>${c.orders}${c.active ? ` <small class="muted">(${c.active} в работе)</small>` : ''}</td><td class="num">${c.total ? money(c.total) : '—'}</td>
          <td>${esc(c.managerName)}</td><td>${A.short(A.localDate(c.lastAt))}</td></tr>`).join('')}</tbody></table></div>` : A.empty('Клиенты не найдены')}</div>`;
  },
  bind(el) {
    A.bindFilters($('#cf', el), 'clients');
    A.rowLinks(el);
    $('#addClient', el).onclick = () => {
      const w = A.modal('Новый клиент', `<form id="nc" class="grid2">
        <label class="field"><span>Имя *</span><input name="name" required></label><label class="field"><span>Телефон *</span><input name="phone" type="tel" required></label>
        <label class="field"><span>E-mail</span><input name="email" type="email"></label><label class="field"><span>Адрес</span><input name="address"></label>
        <div class="field full"><span>Теги</span><div class="chips">${TAGS.map((t) => `<label class="chip"><input type="checkbox" name="tags" value="${t}">${t}</label>`).join('')}</div></div>
        <label class="field full"><span>Заметка</span><textarea name="note" rows="2"></textarea></label>
        <div class="form-actions full"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Создать</button></div></form>`);
      $('#nc', w).onsubmit = async (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        const r = await A.act(() => A.api('POST', '/clients', { ...Object.fromEntries(fd), tags: fd.getAll('tags') }), 'Клиент добавлен');
        if (r) { A.closeModal(); A.go('#/client/' + r.id); }
      };
    };
  },
};

A.pages.client = {
  title: () => A.cache.client?.name || 'Клиент',
  async render(r) {
    const c = (A.cache.client = await A.api('GET', '/clients/' + r.id));
    const t = A.S.today;
    const total = c.leads.filter((l) => l.isDeal && l.stage !== 'lost').reduce((s, l) => s + l.amount, 0);
    return `<div class="crumbs"><a href="#/clients">${ICON.left}Клиенты</a></div>
      <div class="page-head"><div><h1>${esc(c.name)}</h1><p class="muted">Клиент с ${A.fmtDate(A.localDate(c.createdAt))} · менеджер ${esc(c.managerName)} · ${A.plural(c.leads.length, 'заказ', 'заказа', 'заказов')}${total ? ' на ' + money(total) : ''}</p></div>
        <button class="btn primary" id="addLead">${ICON.plus}Новая заявка</button></div>
      <div class="lead-grid">
        <div class="lead-main">
          <section class="card"><div class="card-head"><h2>Заказы</h2></div>
            ${c.leads.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Номер</th><th>Тип работ</th><th>Этап</th><th>Сумма</th><th>Оплата</th><th>Дата</th></tr></thead><tbody>
            ${c.leads.map((l) => l.hidden ? `<tr><td>${esc(l.num)}</td><td colspan="5" class="muted">заказ ведёт другой менеджер — ${esc(l.managerName)}</td></tr>` : `<tr data-href="#/lead/${l.id}"><td><a href="#/lead/${l.id}"><b>${esc(l.num)}</b></a>${l.isDeal ? `<small class="block green-text">${esc(l.dealNum)}</small>` : ''}</td><td>${esc(l.workType)}</td><td>${A.stageBadge(l.stage)}</td>
              <td class="num">${l.isDeal ? money(l.amount) : '—'}</td><td>${l.isDeal ? A.payBadge(l.payStatus) : '—'}</td><td>${A.short(A.localDate(l.createdAt))}</td></tr>`).join('')}</tbody></table></div>` : A.empty('Заказов пока нет')}
          </section>
          <section class="card"><div class="card-head"><h2>Звонки и контакты</h2></div>
            <form id="callf" class="comment-form"><textarea name="text" rows="2" placeholder="О чём говорили: «перезвонил, согласовали дату замера»" required></textarea><button class="btn sm primary">${ICON.phone}Записать звонок</button></form>
            <ul class="history">${c.calls.map((x) => `<li><small>${A.fmtDT(x.at)}</small><span><b>${esc(x.userName)}</b> ${esc(x.text)}</span></li>`).join('') || '<li class="muted">Звонков пока нет</li>'}</ul></section>
        </div>
        <div class="lead-side">
          <section class="card"><div class="card-head"><h2>Контакты</h2></div>
            <form id="clf" class="stack">
              <label class="field"><span>Имя</span><input name="name" value="${esc(c.name)}" required></label>
              <label class="field"><span>Телефон</span><div class="with-btn"><input name="phone" value="${esc(c.phone)}"><a class="icon-btn" href="${A.tel(c.phone)}" title="Позвонить" aria-label="Позвонить">${ICON.phone}</a></div></label>
              <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(c.email)}"></label>
              <label class="field"><span>Адрес</span><input name="address" value="${esc(c.address)}"></label>
              <div class="field"><span>Теги</span><div class="chips">${TAGS.map((tg) => `<label class="chip ${c.tags.includes(tg) ? 'on' : ''}"><input type="checkbox" name="tags" value="${tg}" ${c.tags.includes(tg) ? 'checked' : ''}>${tg}</label>`).join('')}</div></div>
              <label class="field"><span>Заметка</span><textarea name="note" rows="3">${esc(c.note)}</textarea></label>
              <button class="btn" id="saveC" disabled>Сохранить</button></form></section>
          <section class="card"><div class="card-head"><h2>Напоминания</h2></div>
            ${c.reminders.length ? `<ul class="rems">${c.reminders.map((r) => `<li class="rem ${r.due < t ? 'overdue' : r.due === t ? 'today' : ''}"><button class="check" data-rem="${r.id}" aria-label="Выполнено">${ICON.check}</button><div><b>${esc(r.text)}</b></div><span class="when">${A.relDate(r.due)}</span></li>`).join('')}</ul>` : ''}
            <form id="rf" class="inline-form"><input name="text" value="Позвонить клиенту"><select name="inDays">${A.opts([[1, 'завтра'], [3, 'через 3 дня'], [7, 'через неделю'], [30, 'через месяц']], 3)}</select><button class="btn">${ICON.bell}Напомнить</button></form></section>
        </div></div>`;
  },
  bind(el) {
    const c = A.cache.client;
    A.rowLinks(el);
    $('#addLead', el).onclick = () => A.newLeadModal({ clientId: c.id, clientName: c.name, address: c.address });
    const f = $('#clf', el); const sb = $('#saveC', el);
    f.addEventListener('input', () => (sb.disabled = false));
    $$('.chip input', f).forEach((i) => i.addEventListener('change', () => i.parentElement.classList.toggle('on', i.checked)));
    f.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(f); if (await A.act(() => A.api('PATCH', '/clients/' + c.id, { ...Object.fromEntries(fd), tags: fd.getAll('tags') }), 'Сохранено')) A.refresh(); };
    $('#callf', el).onsubmit = async (e) => { e.preventDefault(); if (await A.act(() => A.api('POST', `/clients/${c.id}/calls`, { text: e.target.text.value }), 'Звонок записан')) A.refresh(); };
    $('#rf', el).onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); if (await A.act(() => A.api('POST', '/reminders', { ...b, inDays: Number(b.inDays), clientId: c.id }), 'Напоминание добавлено')) A.refresh(); };
    $$('[data-rem]', el).forEach((b) => (b.onclick = async () => { if (await A.act(() => A.api('POST', `/reminders/${b.dataset.rem}/done`))) A.refresh(); }));
  },
};

// ---------- задачи мастеров (список) ----------
A.pages.tasks = {
  title: 'Задачи мастеров',
  async render(r) {
    const S = A.S; const q = new URLSearchParams(r.q);
    if (!q.get('from') && !q.get('to') && !q.get('all')) { q.set('from', S.today); q.set('to', A.addDays(S.today, 6)); }
    const list = await A.api('GET', '/tasks?' + q);
    const masters = S.staff.filter((u) => u.role === 'master');
    return `<div class="page-head"><div><h1>Задачи мастеров</h1><p class="muted">${A.plural(list.length, 'задача', 'задачи', 'задач')} · ${q.get('from') ? `${A.fmtDate(q.get('from'))} — ${A.fmtDate(q.get('to') || q.get('from'))}` : 'за всё время'}</p></div>
      <a class="btn" href="/api/export/tasks?${q}" download>${ICON.download}Excel</a></div>
      <form class="filters" id="tf">
        <select name="master">${A.opts(masters.map((m) => [m.id, m.name]), q.get('master'), 'Все мастера')}</select>
        <select name="status">${A.opts(Object.entries(A.TASK), q.get('status'), 'Все статусы')}</select>
        <label class="date-f"><span>с</span><input type="date" name="from" value="${esc(q.get('from') || '')}"></label>
        <label class="date-f"><span>по</span><input type="date" name="to" value="${esc(q.get('to') || '')}"></label>
        <a class="link" href="#/tasks?all=1">Все даты</a>
      </form>
      <div class="card flush">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Когда</th><th>Задача</th><th>Мастер</th><th>Адрес</th><th>Заявка</th><th>Статус</th></tr></thead><tbody>
        ${list.map((x) => `<tr data-href="#/lead/${x.leadId}" class="${x.date === S.today ? 'hl' : ''}"><td><b>${A.relDate(x.date)}</b><small class="block">${x.from}–${x.to}</small></td><td>${esc(x.title)}<small class="block muted">${esc(x.num)}</small></td>
          <td>${esc(x.masterName)}</td><td class="cut">${esc(x.address.replace('Екатеринбург, ', ''))}</td><td><a href="#/lead/${x.leadId}">${esc(x.leadNum)}</a><small class="block">${esc(x.clientName)}</small></td>
          <td>${A.taskBadge(x.status)}${x.declineReason ? `<small class="block red-text">${esc(x.declineReason)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : A.empty('Задач нет', 'Задачи создаются в карточке заявки: «Назначить мастера»')}</div>`;
  },
  bind(el) { A.bindFilters($('#tf', el), 'tasks'); A.rowLinks(el); },
};

// ---------- календарь загрузки мастеров ----------
const H0 = 8; const H1 = 21;
A.pages.calendar = {
  title: 'Календарь мастеров',
  async render(r) {
    const S = A.S; const view = r.q.get('view') === 'day' ? 'day' : 'week';
    let from = r.q.get('date') || S.today;
    if (view === 'week') { const wd = (new Date(from + 'T12:00:00Z').getUTCDay() + 6) % 7; from = A.addDays(from, -wd); }
    const days = view === 'week' ? 7 : 1;
    const cal = await A.api('GET', `/calendar?from=${from}&days=${days}`);
    const nav = (d) => `#/calendar?view=${view}&date=${d}`;
    const head = `<div class="page-head"><div><h1>Календарь мастеров</h1><p class="muted">Кто свободен, кто занят. ${A.isAdmin() ? '' : 'Чужие выезды видны как «Занят».'}</p></div>
      <div class="cal-nav"><div class="seg"><a href="#/calendar?view=day&date=${r.q.get('date') || S.today}" class="${view === 'day' ? 'on' : ''}">День</a><a href="#/calendar?view=week&date=${r.q.get('date') || S.today}" class="${view === 'week' ? 'on' : ''}">Неделя</a></div>
        <a class="icon-btn" href="${nav(A.addDays(from, -days))}" aria-label="Назад">${ICON.left}</a><a class="btn sm" href="${nav(S.today)}">Сегодня</a><a class="icon-btn" href="${nav(A.addDays(from, days))}" aria-label="Вперёд">${ICON.chev}</a>
        <b class="cal-title">${view === 'day' ? A.fmtDate(from, true) : `${A.fmtDate(from)} — ${A.fmtDate(cal.to)}`}</b></div></div>`;
    const block = (x) => `<${x.mine ? `a href="#/lead/${x.leadId}"` : 'div'} class="ev ${A.TASK_COLOR[x.status]} ${x.mine ? '' : 'busy-only'}" title="${esc(x.from + '–' + x.to + ' ' + x.title + (x.clientName ? ' · ' + x.clientName : ''))}"><b>${x.from}–${x.to}</b><span>${esc(x.title)}</span>${x.mine ? `<small>${esc(x.leadNum)} · ${esc((x.address || '').replace('Екатеринбург, ', ''))}</small>` : ''}</${x.mine ? 'a' : 'div'}>`;
    if (view === 'day') {
      const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
      const pos = (tm) => { const [h, m] = tm.split(':').map(Number); return ((h + m / 60 - H0) / (H1 - H0)) * 100; };
      return head + `<div class="card flush"><div class="dayview"><div class="dv-head"><div class="dv-m"></div><div class="dv-hours">${hours.map((h) => `<span>${h}:00</span>`).join('')}</div></div>
        ${cal.masters.map((m) => { const ts = cal.tasks.filter((x) => x.masterId === m.id); const busyH = ts.reduce((s, x) => s + (pos(x.to) - pos(x.from)) * (H1 - H0) / 100, 0);
          return `<div class="dv-row"><div class="dv-m"><b>${esc(m.name)}</b><small>${esc(m.specialty)}</small><small class="${busyH ? '' : 'green-text'}">${busyH ? `занят ${Math.round(busyH * 10) / 10} ч` : 'свободен'}</small></div>
          <div class="dv-line">${hours.map(() => '<i></i>').join('')}${ts.map((x) => `<div class="dv-ev" style="left:${Math.max(0, pos(x.from))}%;width:${Math.max(4, pos(x.to) - pos(x.from))}%">${block(x)}</div>`).join('')}</div></div>`; }).join('')}
        </div></div>`;
    }
    const dates = Array.from({ length: 7 }, (_, i) => A.addDays(from, i));
    return head + `<div class="card flush"><div class="table-wrap"><table class="weekview"><thead><tr><th>Мастер</th>${dates.map((d) => `<th class="${d === S.today ? 'today' : ''}"><a href="#/calendar?view=day&date=${d}">${A.fmtDate(d, true)}</a></th>`).join('')}</tr></thead><tbody>
      ${cal.masters.map((m) => `<tr><th><b>${esc(m.name)}</b><small>${esc(m.specialty)}</small></th>${dates.map((d) => {
        const ts = cal.tasks.filter((x) => x.masterId === m.id && x.date === d).sort((a, b) => a.from.localeCompare(b.from));
        const h = ts.reduce((s, x) => s + (parseInt(x.to) - parseInt(x.from)), 0);
        return `<td class="${d === S.today ? 'today' : ''} ${ts.length ? '' : 'free'}"><div class="load" title="Занято ${h} из 8 ч"><i style="width:${Math.min(100, h / 8 * 100)}%" class="${h >= 8 ? 'full' : ''}"></i></div>${ts.map(block).join('') || '<span class="free-t">свободен</span>'}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div></div>
      <p class="hint">Полоска над днём — загрузка мастера из 8 рабочих часов. Нажмите на дату, чтобы открыть день по часам.</p>`;
  },
};

// ---------- кабинет мастера ----------
const masterPage = {
  async render(r) {
    const S = A.S; const tab = r.q.get('tab') || 'today';
    const all = await A.api('GET', `/tasks?from=${A.addDays(S.today, -30)}`);
    A.cache.myTasks = all;
    const lists = {
      today: all.filter((x) => x.date === S.today && x.status !== 'declined'),
      next: all.filter((x) => x.date > S.today && x.status !== 'declined'),
      done: all.filter((x) => (x.status === 'done' || x.status === 'declined') && x.date < S.today).reverse(),
    };
    const newCount = all.filter((x) => x.status === 'assigned' && x.date >= S.today).length;
    const list = lists[tab];
    return `<div class="page-head"><div><h1>Мои задачи</h1><p class="muted">${A.fmtDate(S.today, true)}${newCount ? ` · <b class="orange-text">${A.plural(newCount, 'новая задача ждёт', 'новые задачи ждут', 'новых задач ждут')} ответа</b>` : ''}</p></div></div>
      <div class="seg wide"><a href="#/my?tab=today" class="${tab === 'today' ? 'on' : ''}">Сегодня <i>${lists.today.length}</i></a><a href="#/my?tab=next" class="${tab === 'next' ? 'on' : ''}">Дальше <i>${lists.next.length}</i></a><a href="#/my?tab=done" class="${tab === 'done' ? 'on' : ''}">Выполненные</a></div>
      ${list.length ? `<div class="mtasks">${list.map(mtask).join('')}</div>` : A.empty(tab === 'today' ? 'На сегодня задач нет' : 'Задач нет', tab === 'today' ? 'Новые задачи придут сюда и в Telegram' : '')}`;
  },
  bind(el) {
    const find = (id) => A.cache.myTasks.find((x) => x.id === id);
    $$('[data-st]', el).forEach((b) => (b.onclick = async () => {
      const [id, st] = b.dataset.st.split(':');
      let reason;
      if (st === 'declined') { reason = await A.prompt('Отклонить задачу', 'Почему не можете взять?', { placeholder: 'Например: в это время на другом объекте', okText: 'Отклонить' }); if (!reason) return; }
      if (st === 'done' && !find(id).photos.some((p) => p.phase === 'after') && !(await A.confirm('Нет фото «после»', 'Менеджер и клиент ждут фото результата. Отметить выполненной без фото?', 'Да, без фото'))) return;
      if (await A.act(() => A.api('POST', `/tasks/${id}/status`, { status: st, reason }), st === 'accepted' ? 'Задача принята' : st === 'done' ? 'Отлично, задача выполнена' : st === 'declined' ? 'Задача отклонена, менеджер увидит причину' : 'Статус обновлён')) A.refresh();
    }));
    $$('input[data-photo]', el).forEach((inp) => (inp.onchange = async () => {
      const [id, phase] = inp.dataset.photo.split(':');
      for (const f of inp.files) {
        A.toast('Загружаю фото…');
        const data = await A.shrinkImage(f);
        if (!(await A.act(() => A.api('POST', `/tasks/${id}/photos`, { phase, name: f.name, data })))) return;
      }
      A.toast('Фото добавлено'); A.refresh();
    }));
  },
};
function mtask(x) {
  const S = A.S;
  const btn = (st, label, cls = '') => `<button class="btn ${cls}" data-st="${x.id}:${st}">${label}</button>`;
  const actions = { assigned: btn('accepted', `${ICON.check}Принять`, 'primary') + btn('declined', 'Отклонить', 'ghost-danger'), accepted: btn('in_progress', 'Начать работу', 'primary') + btn('declined', 'Отклонить', 'ghost-danger'), in_progress: btn('done', `${ICON.check}Выполнено`, 'success'), done: '', declined: '' }[x.status];
  const photos = (phase) => x.photos.filter((p) => p.phase === phase);
  return `<article class="mtask ${x.status}">
    <div class="mt-head"><div class="mt-time">${ICON.clock}<b>${x.date === S.today ? '' : A.relDate(x.date) + ', '}${x.from}–${x.to}</b></div>${A.taskBadge(x.status)}</div>
    <h3>${esc(x.title)}</h3>
    <a class="mt-line" href="${A.mapLink(x.address)}" target="_blank" rel="noopener">${ICON.pin}<span>${esc(x.address)}</span></a>
    <a class="mt-line" href="${A.tel(x.clientPhone)}">${ICON.phone}<span>${esc(x.clientName)} · ${esc(x.clientPhone)}</span></a>
    ${x.note ? `<p class="note">${esc(x.note)}</p>` : ''}
    <small class="muted">${esc(x.num)} · заявка ${esc(x.leadNum)} · ${esc(x.workType)}</small>
    ${x.status === 'declined' ? `<p class="red-text">Отклонена: ${esc(x.declineReason)}</p>` : ''}
    ${['accepted', 'in_progress', 'done'].includes(x.status) ? `<div class="mt-photos">${['before', 'after'].map((ph) => `<div><span>Фото «${ph === 'before' ? 'до' : 'после'}»</span><div class="thumbs">${photos(ph).map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy"></a>`).join('')}
      ${x.status !== 'done' || ph === 'after' ? `<label class="add-photo" title="Добавить фото">${ICON.camera}<input type="file" accept="image/*" capture="environment" multiple data-photo="${x.id}:${ph}" hidden></label>` : ''}</div></div>`).join('')}</div>` : ''}
    ${actions ? `<div class="mt-actions">${actions}</div>` : ''}
  </article>`;
}

// ---------- кабинет клиента ----------
const clientPage = {
  async render() {
    const S = A.S;
    const orders = await A.api('GET', '/my');
    const steps = S.stages.filter((s) => s.key !== 'lost');
    return `<div class="page-head"><div><h1>Мой ремонт</h1><p class="muted">Здравствуйте, ${esc(S.me.name.split(' ')[0])}! Здесь видно, на каком этапе ваш заказ, когда приедет мастер и сколько осталось оплатить.</p></div></div>
      ${orders.length ? orders.map((o) => {
        const idx = steps.findIndex((s) => s.key === o.stage);
        const next = o.visits.find((v) => v.date >= S.today && v.status !== 'done');
        const photos = o.visits.flatMap((v) => v.photos);
        return `<section class="card order">
          <div class="card-head"><h2>${esc(o.workType)} · ${esc(o.dealNum || o.num)}</h2>${A.stageBadge(o.stage)}</div>
          <p class="muted">${ICON.pin} ${esc(o.address)}</p>
          <div class="progress">${steps.map((s, i) => `<div class="${i < idx ? 'past' : i === idx ? 'cur' : ''}"><i>${i < idx ? ICON.check : i + 1}</i><span>${esc(s.name)}</span></div>`).join('')}</div>
          <div class="order-grid">
            <div class="ob"><span>Ближайший визит мастера</span>${next ? `<b>${A.relDate(next.date)}, ${next.from}–${next.to}</b><small>${esc(next.title)} · ${esc(next.masterName)}</small>` : o.stage === 'done' ? '<b class="green-text">Работы завершены</b><small>Спасибо, что выбрали нас!</small>' : '<b>—</b><small>Менеджер сообщит дату</small>'}</div>
            ${o.isDeal ? `<div class="ob"><span>Стоимость работ</span><b>${money(o.amount)}</b><small>оплачено ${money(o.paid)}</small><div class="paybar"><i style="width:${Math.min(100, Math.round(o.paid / (o.amount || 1) * 100))}%"></i></div></div>
            <div class="ob"><span>Осталось оплатить</span><b class="${o.rest ? '' : 'green-text'}">${o.rest ? money(o.rest) : 'Всё оплачено'}</b></div>` : '<div class="ob"><span>Стоимость</span><b>после сметы</b><small>посчитаем после замера</small></div>'}
            <div class="ob"><span>Ваш менеджер</span><b>${esc(o.managerName)}</b><a href="${A.tel(o.managerPhone)}">${ICON.phone}${esc(o.managerPhone)}</a></div>
          </div>
          ${o.visits.length ? `<h3>График работ</h3><ul class="visits">${o.visits.map((v) => `<li class="${v.status === 'done' ? 'done' : ''}"><b>${A.fmtDate(v.date, true)}</b><span>${v.from}–${v.to} · ${esc(v.title)}</span>${v.status === 'done' ? `<span class="badge green sm">выполнено</span>` : ''}</li>`).join('')}</ul>` : ''}
          ${photos.length ? `<h3>Фото с объекта</h3><div class="thumbs big">${photos.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy"><i>${p.phase === 'before' ? 'до' : 'после'}</i></a>`).join('')}</div>` : ''}
          ${o.files.length ? `<h3>Документы</h3><ul class="files">${o.files.map((f) => `<li>${ICON.file}<a href="/api/file/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a></li>`).join('')}</ul>` : ''}
          ${o.payments.length ? `<h3>Платежи</h3><ul class="visits">${o.payments.map((p) => `<li class="done"><b>${A.short(p.date)}</b><span>${p.kind === 'prepay' ? 'Предоплата' : 'Оплата'}</span><b>${money(p.sum)}</b></li>`).join('')}</ul>` : ''}
        </section>`;
      }).join('') : A.empty('Заказов пока нет', 'Оставьте заявку на сайте — менеджер свяжется с вами')}`;
  },
};
A.pages.my = {
  title: () => (A.S.me.role === 'client' ? 'Мой ремонт' : 'Мои задачи'),
  render: (r) => (A.S.me.role === 'client' ? clientPage.render(r) : masterPage.render(r)),
  bind: (el, r) => { if (A.S.me.role === 'master') masterPage.bind(el, r); },
};
})();
