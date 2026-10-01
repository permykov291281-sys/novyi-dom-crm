/* Продажи: главная, воронка (канбан), список заявок, карточка заявки/сделки, новая заявка. */
(() => {
'use strict';
const A = window.App;
const { esc, ICON, money, $, $$ } = A;

// ---------- новая заявка ----------
A.newLeadModal = (preset = {}) => {
  const S = A.S;
  const w = A.modal('Новая заявка', `<form id="nl" class="grid2">
    ${preset.clientId ? `<input type="hidden" name="clientId" value="${esc(preset.clientId)}"><div class="field full"><span>Клиент</span><b>${esc(preset.clientName)}</b></div>`
      : `<label class="field"><span>Имя клиента *</span><input name="name" required placeholder="Мария Иванова"></label>
         <label class="field"><span>Телефон *</span><input name="phone" required type="tel" placeholder="+7 900 000-00-00"></label>`}
    <label class="field full"><span>Адрес объекта</span><input name="address" value="${esc(preset.address || '')}" placeholder="Екатеринбург, ул. …, дом, кв."></label>
    <label class="field"><span>Тип работ</span><select name="workType">${A.opts(S.workTypes.map((t) => [t, t]), '')}</select></label>
    <label class="field"><span>Бюджет клиента, ₽</span><input name="budget" type="number" min="0" step="1" placeholder="300000"></label>
    <label class="field"><span>Откуда пришёл</span><select name="source">${A.opts(Object.entries(S.sources), 'call')}</select></label>
    ${A.isAdmin() ? `<label class="field"><span>Менеджер</span><select name="managerId">${A.opts(S.staff.filter((u) => u.role === 'manager' && u.active).map((u) => [u.id, u.name]), '', 'Наименее загруженный')}</select></label>` : '<div></div>'}
    <label class="field full"><span>Комментарий</span><textarea name="comment" rows="2" placeholder="Что хочет клиент, удобное время для звонка"></textarea></label>
    ${preset.clientId ? '' : '<p class="hint full">Если клиент с таким телефоном уже есть в базе, заявка добавится к его карточке.</p>'}
    <div class="form-actions full"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">Создать заявку</button></div></form>`);
  $('#nl', w).onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const r = await A.act(() => A.api('POST', '/leads', body), 'Заявка создана');
    if (r) { A.closeModal(); A.go('#/lead/' + r.id); }
  };
};

// ---------- перевод в сделку ----------
A.dealModal = (lead) => new Promise((resolve) => {
  const w = A.modal('Перевести заявку в сделку', `<form id="dm"><p class="muted">Заявка <b>${esc(lead.num)}</b> станет сделкой — карточка, история и файлы сохраняются, пересоздавать ничего не нужно.</p>
    <label class="field"><span>Сумма сделки по смете, ₽</span><input name="amount" type="number" min="0" step="1" value="${lead.budget || ''}" required></label>
    <div class="form-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn primary">В сделку</button></div></form>`);
  $('#dm', w).onsubmit = async (e) => {
    e.preventDefault();
    const r = await A.act(() => A.api('POST', `/leads/${lead.id}/deal`, { amount: Number(e.target.amount.value) }), 'Сделка создана');
    A.closeModal(); resolve(r);
  };
  $$('[data-close]', w).forEach((b) => b.addEventListener('click', () => resolve(null)));
});
// смена этапа с нужными вопросами (сделка / причина отказа)
A.changeStage = async (lead, stage) => {
  if (stage === lead.stage) return null;
  if (['work', 'done'].includes(stage) && !lead.isDeal) {
    const d = await A.dealModal(lead);
    if (!d) return null;
  }
  let lostReason;
  if (stage === 'lost') {
    lostReason = await A.prompt('Отказ', 'Причина отказа', { placeholder: 'Например: дорого, выбрали другую бригаду', okText: 'Перевести в отказ' });
    if (!lostReason) return null;
  }
  return A.act(() => A.api('POST', `/leads/${lead.id}/stage`, { stage, lostReason }), `Этап: ${A.stageName(stage)}`);
};

// ---------- главная ----------
A.pages.home = {
  title: 'Главная',
  async render() {
    const S = A.S; const t = S.today;
    const [leads, rems, tasks] = await Promise.all([A.api('GET', '/leads'), A.api('GET', '/reminders' + (A.isAdmin() ? '?all=1' : '')), A.api('GET', `/tasks?from=${t}&to=${t}`)]);
    const open = leads.filter((l) => !['done', 'lost'].includes(l.stage));
    const fresh = leads.filter((l) => l.stage === 'new');
    const debt = leads.filter((l) => l.isDeal && l.stage !== 'lost').reduce((s, l) => s + l.rest, 0);
    const monthPaid = leads.flatMap((l) => l.payments).filter((p) => p.date > A.addDays(t, -30)).reduce((s, p) => s + p.sum, 0);
    const overdue = rems.filter((r) => r.due < t); const todayR = rems.filter((r) => r.due === t); const later = rems.filter((r) => r.due > t).slice(0, 4);
    const remRow = (r) => `<li class="rem ${r.due < t ? 'overdue' : r.due === t ? 'today' : ''}"><button class="check" data-rem="${r.id}" title="Выполнено" aria-label="Отметить выполненным">${ICON.check}</button>
      <div><b>${esc(r.text)}</b><small><a href="#/lead/${r.leadId || ''}" ${r.leadId ? '' : 'hidden'}>${esc(r.leadNum)}</a> ${esc(r.clientName)}${A.isAdmin() ? ' · ' + esc(r.managerName) : ''}</small></div>
      <span class="when">${r.due < t ? 'просрочено · ' : ''}${A.relDate(r.due)}</span></li>`;
    const hello = new Date().getHours() < 12 ? 'Доброе утро' : new Date().getHours() < 18 ? 'Добрый день' : 'Добрый вечер';
    return `<div class="page-head"><div><h1>${hello}, ${esc(S.me.name.split(' ')[0])}</h1><p class="muted">${A.fmtDate(t, true)} · ${A.isAdmin() ? 'вся студия' : 'ваши заявки и сделки'}</p></div>
      <button class="btn primary" id="addLead">${ICON.plus}Новая заявка</button></div>
      <div class="kpis">
        <a class="kpi" href="#/funnel"><span>Новые заявки</span><b>${fresh.length}</b><small>ждут первого звонка</small></a>
        <a class="kpi" href="#/leads?deal=1"><span>Сделок в работе</span><b>${open.filter((l) => l.isDeal).length}</b><small>${A.moneyShort(open.filter((l) => l.isDeal).reduce((s, l) => s + l.amount, 0))} в портфеле</small></a>
        <a class="kpi" href="#/reports"><span>Оплаты за 30 дней</span><b>${A.moneyShort(monthPaid)}</b><small>поступило на счёт</small></a>
        <a class="kpi ${debt ? 'warn' : ''}" href="#/leads?pay=${encodeURIComponent('Частично')}"><span>Ждём от клиентов</span><b>${A.moneyShort(debt)}</b><small>остаток по сделкам</small></a>
      </div>
      <div class="cols">
        <section class="card"><div class="card-head"><h2>Напоминания</h2><span class="muted">${overdue.length ? `<b class="red-text">${overdue.length} просрочено</b> · ` : ''}${todayR.length} на сегодня</span></div>
          ${rems.length ? `<ul class="rems">${[...overdue, ...todayR, ...later].map(remRow).join('')}</ul>` : A.empty('Напоминаний нет', 'Добавляйте их в карточке клиента или заявки: «позвонить через 3 дня»')}</section>
        <section class="card"><div class="card-head"><h2>Мастера сегодня</h2><a href="#/calendar" class="link">Календарь ${ICON.chev}</a></div>
          ${tasks.length ? `<ul class="tasks-mini">${tasks.map((x) => `<li><span class="time">${x.from}–${x.to}</span><div><b>${esc(x.title)}</b><small>${esc(x.masterName)} · <a href="#/lead/${x.leadId}">${esc(x.leadNum)}</a> · ${esc(x.address.replace('Екатеринбург, ', ''))}</small></div>${A.taskBadge(x.status)}</li>`).join('')}</ul>` : A.empty('На сегодня выездов нет')}</section>
      </div>
      <section class="card"><div class="card-head"><h2>Новые заявки</h2><a href="#/funnel" class="link">Воронка ${ICON.chev}</a></div>
        ${fresh.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Заявка</th><th>Клиент</th><th>Тип работ</th><th>Источник</th><th>Бюджет</th><th>Поступила</th></tr></thead><tbody>
        ${fresh.map((l) => `<tr data-href="#/lead/${l.id}"><td><a href="#/lead/${l.id}"><b>${esc(l.num)}</b></a></td><td>${esc(l.clientName)}<small class="block">${esc(l.clientPhone)}</small></td><td>${esc(l.workType)}</td><td>${esc(S.sources[l.source])}</td><td>${l.budget ? money(l.budget) : '—'}</td><td>${A.fmtDT(l.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : A.empty('Новых заявок нет')}</section>`;
  },
  bind(el) {
    $('#addLead', el).onclick = () => A.newLeadModal();
    $$('[data-rem]', el).forEach((b) => (b.onclick = async () => { if (await A.act(() => A.api('POST', `/reminders/${b.dataset.rem}/done`), 'Готово')) A.refresh(); }));
    A.rowLinks(el);
  },
};
A.rowLinks = (el) => $$('tr[data-href]', el).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a,button,input,select')) location.hash = tr.dataset.href; }));

// ---------- воронка (канбан) ----------
A.pages.funnel = {
  title: 'Воронка',
  async render(r) {
    const S = A.S; const q = r.q;
    const params = new URLSearchParams(); ['q', 'manager', 'source'].forEach((k) => q.get(k) && params.set(k, q.get(k)));
    const leads = await A.api('GET', '/leads?' + params);
    A.cache.funnel = leads;
    const cols = S.stages.map((s) => {
      const items = leads.filter((l) => l.stage === s.key);
      const sum = items.reduce((a, l) => a + (l.isDeal ? l.amount : l.budget), 0);
      return `<div class="kcol" data-stage="${s.key}"><div class="kcol-head"><span class="kdot ${A.STAGE_COLOR[s.key]}"></span><b>${esc(s.name)}</b><i>${items.length}</i></div>
        <div class="kcol-sum">${sum ? A.moneyShort(sum) : '&nbsp;'}</div>
        <div class="kcol-body" data-drop="${s.key}">${items.map(card).join('') || '<div class="kempty">Перетащите сюда</div>'}</div></div>`;
    }).join('');
    return `<div class="page-head"><div><h1>Воронка</h1><p class="muted">Перетащите карточку, чтобы сменить этап. «В работе» и «Завершено» — только для сделок.</p></div>
      <button class="btn primary" id="addLead">${ICON.plus}Новая заявка</button></div>
      <form class="filters" id="ff">
        <label class="search"><span>${ICON.search}</span><input name="q" value="${esc(q.get('q') || '')}" placeholder="Клиент, телефон, адрес, номер"></label>
        ${A.isAdmin() ? `<select name="manager">${A.opts(S.staff.filter((u) => u.role === 'manager').map((u) => [u.id, u.name]), q.get('manager'), 'Все менеджеры')}</select>` : ''}
        <select name="source">${A.opts(Object.entries(S.sources), q.get('source'), 'Все источники')}</select>
        ${[...q.keys()].length ? '<a class="link" href="#/funnel">Сбросить</a>' : ''}
      </form>
      <div class="kanban" id="kanban">${cols}</div>`;
  },
  bind(el) {
    $('#addLead', el).onclick = () => A.newLeadModal();
    A.bindFilters($('#ff', el), 'funnel');
    let dragId = null;
    $$('.kcard', el).forEach((c) => {
      c.addEventListener('dragstart', (e) => { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
      c.addEventListener('dragend', () => { c.classList.remove('dragging'); $$('.kcol-body', el).forEach((b) => b.classList.remove('over')); });
    });
    $$('.kcol-body', el).forEach((b) => {
      b.addEventListener('dragover', (e) => { e.preventDefault(); b.classList.add('over'); });
      b.addEventListener('dragleave', () => b.classList.remove('over'));
      b.addEventListener('drop', async (e) => {
        e.preventDefault(); b.classList.remove('over');
        const lead = A.cache.funnel.find((l) => l.id === (dragId || e.dataTransfer.getData('text/plain')));
        if (lead && await A.changeStage(lead, b.dataset.drop)) A.refresh();
      });
    });
    // на телефоне перетаскивания нет — этап меняется списком в карточке
    $$('.kcard select', el).forEach((s) => s.addEventListener('change', async () => {
      const lead = A.cache.funnel.find((l) => l.id === s.dataset.id);
      if (await A.changeStage(lead, s.value)) A.refresh(); else s.value = lead.stage;
    }));
  },
};
function card(l) {
  return `<article class="kcard" draggable="true" data-id="${l.id}">
    <div class="kc-top"><a href="#/lead/${l.id}" class="kc-num">${esc(l.num)}</a>${l.isDeal ? `<span class="badge green sm">${esc(l.dealNum)}</span>` : ''}${A.tagBadges(l.clientTags.filter((t) => t !== 'повторный'))}</div>
    <a href="#/lead/${l.id}" class="kc-name">${esc(l.clientName)}</a>
    <div class="kc-work">${esc(l.workType)}</div>
    <div class="kc-bottom"><b>${l.isDeal ? money(l.amount) : l.budget ? '~' + money(l.budget) : 'бюджет ?'}</b>
      <span class="kc-meta">${l.openTasks ? `<span title="Открытых задач мастеров">${ICON.tool}${l.openTasks}</span>` : ''}<span class="src">${esc(A.S.sources[l.source])}</span>${A.avatar(l.managerName, 'sm')}</span></div>
    ${l.stage === 'lost' && l.lostReason ? `<div class="kc-lost">${esc(l.lostReason)}</div>` : ''}
    ${l.isDeal && l.stage !== 'lost' ? `<div class="kc-pay"><i style="width:${Math.min(100, Math.round((l.paid / (l.amount || 1)) * 100))}%"></i></div>` : ''}
    <select class="kc-stage" data-id="${l.id}" aria-label="Этап">${A.opts(A.S.stages.map((s) => [s.key, s.name]), l.stage)}</select>
  </article>`;
}
// фильтры обновляют адрес страницы (#/page?…), чтобы ссылкой можно было поделиться
A.bindFilters = (form, page) => {
  const apply = () => { const p = new URLSearchParams(); for (const [k, v] of new FormData(form)) if (v) p.set(k, v); location.hash = `#/${page}${p.toString() ? '?' + p : ''}`; };
  form.onsubmit = (e) => { e.preventDefault(); apply(); };
  $$('select, input[type=date]', form).forEach((s) => s.addEventListener('change', apply));
};

// ---------- список заявок ----------
A.pages.leads = {
  title: 'Заявки и сделки',
  async render(r) {
    const S = A.S; const q = r.q;
    const leads = await A.api('GET', '/leads?' + q);
    const sum = leads.reduce((s, l) => s + (l.isDeal ? l.amount : 0), 0);
    return `<div class="page-head"><div><h1>Заявки и сделки</h1><p class="muted">${A.plural(leads.length, 'запись', 'записи', 'записей')}${sum ? ' · сделок на ' + money(sum) : ''}</p></div>
      <div class="actions"><a class="btn" href="/api/export/leads?${q}" download>${ICON.download}Excel</a><button class="btn primary" id="addLead">${ICON.plus}Новая заявка</button></div></div>
      <form class="filters" id="lf">
        <label class="search"><span>${ICON.search}</span><input name="q" value="${esc(q.get('q') || '')}" placeholder="Клиент, телефон, адрес, номер"></label>
        <select name="stage">${A.opts(S.stages.map((s) => [s.key, s.name]), q.get('stage'), 'Все этапы')}</select>
        <select name="deal">${A.opts([['0', 'Только заявки'], ['1', 'Только сделки']], q.get('deal'), 'Заявки и сделки')}</select>
        <select name="pay">${A.opts([['Не оплачено', 'Не оплачено'], ['Частично', 'Оплачено частично'], ['Оплачено', 'Оплачено']], q.get('pay'), 'Любая оплата')}</select>
        <select name="source">${A.opts(Object.entries(S.sources), q.get('source'), 'Все источники')}</select>
        ${A.isAdmin() ? `<select name="manager">${A.opts(S.staff.filter((u) => u.role === 'manager').map((u) => [u.id, u.name]), q.get('manager'), 'Все менеджеры')}</select>` : ''}
        <label class="date-f"><span>с</span><input type="date" name="from" value="${esc(q.get('from') || '')}"></label>
        <label class="date-f"><span>по</span><input type="date" name="to" value="${esc(q.get('to') || '')}"></label>
        ${[...q.keys()].length ? '<a class="link" href="#/leads">Сбросить</a>' : ''}
      </form>
      <div class="card flush">${leads.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Номер</th><th>Клиент</th><th>Тип работ</th><th>Этап</th><th>Сумма</th><th>Оплата</th><th>Менеджер</th><th>Создана</th></tr></thead><tbody>
        ${leads.map((l) => `<tr data-href="#/lead/${l.id}"><td><a href="#/lead/${l.id}"><b>${esc(l.num)}</b></a>${l.isDeal ? `<small class="block green-text">${esc(l.dealNum)}</small>` : ''}</td>
          <td>${esc(l.clientName)} ${A.tagBadges(l.clientTags)}<small class="block">${esc(l.clientPhone)}</small></td><td>${esc(l.workType)}<small class="block">${esc(S.sources[l.source])}</small></td>
          <td>${A.stageBadge(l.stage)}</td><td class="num">${l.isDeal ? money(l.amount) : l.budget ? `<span class="muted">~${money(l.budget)}</span>` : '—'}</td>
          <td>${l.isDeal ? `${payBadge(l.payStatus)}${l.rest ? `<small class="block">ост. ${money(l.rest)}</small>` : ''}` : '<span class="muted">—</span>'}</td>
          <td>${A.avatar(l.managerName, 'sm')} ${esc(l.managerName.split(' ')[0])}</td><td>${A.short(A.localDate(l.createdAt))}</td></tr>`).join('')}
        </tbody></table></div>` : A.empty('Ничего не найдено', 'Измените фильтры или поиск')}</div>`;
  },
  bind(el) { $('#addLead', el).onclick = () => A.newLeadModal(); A.bindFilters($('#lf', el), 'leads'); A.rowLinks(el); },
};
const payBadge = (s) => A.badge(s, s === 'Оплачено' ? 'green' : s === 'Частично' ? 'amber' : s === 'Не оплачено' ? 'red' : 'grey');
A.payBadge = payBadge;

// ---------- карточка заявки / сделки ----------
const FILE_KIND = { photo: 'Фото объекта', estimate: 'Смета', contract: 'Договор', other: 'Другое' };
A.pages.lead = {
  title: () => A.cache.lead ? A.cache.lead.num : 'Заявка',
  async render(r) {
    const S = A.S;
    const l = (A.cache.lead = await A.api('GET', '/leads/' + r.id));
    const c = l.client; const t = S.today;
    const stepIdx = S.stages.findIndex((s) => s.key === l.stage);
    const steps = S.stages.filter((s) => s.key !== 'lost').map((s, i) => `<button class="step ${l.stage === 'lost' ? '' : i < stepIdx ? 'past' : i === stepIdx ? 'cur' : ''}" data-stage="${s.key}" title="Перевести на этап «${esc(s.name)}»"><span>${i + 1}</span>${esc(s.name)}</button>`).join('');
    const tab = r.q.get('tab') || 'comments';
    return `<div class="crumbs"><a href="#/funnel">${ICON.left}Воронка</a></div>
      <div class="page-head lead-head"><div>
        <h1>${esc(l.num)} · ${esc(c.name)}</h1>
        <p class="muted">${l.isDeal ? `<b class="green-text">Сделка ${esc(l.dealNum)}</b> · ` : 'Заявка · '}${esc(l.workType)} · создана ${A.fmtDT(l.createdAt)} · ${esc(S.sources[l.source])}</p></div>
        <div class="actions">${!l.isDeal && l.stage !== 'lost' ? `<button class="btn primary" id="toDeal">${ICON.ruble}В сделку</button>` : ''}
          ${l.stage !== 'lost' && l.stage !== 'done' ? '<button class="btn ghost-danger" id="toLost">Отказ</button>' : ''}
          ${l.stage === 'lost' ? '<button class="btn" id="reopen">Вернуть в работу</button>' : ''}</div></div>
      ${l.stage === 'lost' ? `<div class="alert grey">${ICON.alert}<span>Отказ: <b>${esc(l.lostReason)}</b></span></div>` : `<div class="stepper">${steps}</div>`}
      <div class="lead-grid">
        <div class="lead-main">
          <section class="card"><div class="card-head"><h2>Заявка</h2></div>
            <form id="lf" class="grid2">
              <label class="field"><span>Тип работ</span><select name="workType">${A.opts([...new Set([...S.workTypes, l.workType])].map((x) => [x, x]), l.workType)}</select></label>
              <label class="field"><span>Бюджет клиента, ₽</span><input name="budget" type="number" min="0" step="1" value="${l.budget || ''}"></label>
              <label class="field full"><span>Адрес объекта</span><input name="address" value="${esc(l.address)}"></label>
              <label class="field"><span>Источник</span><select name="source">${A.opts(Object.entries(S.sources), l.source)}</select></label>
              <label class="field"><span>Менеджер</span>${A.isAdmin() ? `<select name="managerId">${A.opts(S.staff.filter((u) => u.role === 'manager' && u.active).map((u) => [u.id, u.name]), l.managerId)}</select>` : `<input value="${esc(l.managerName)}" disabled>`}</label>
              <div class="form-actions full"><button class="btn" id="saveLead" disabled>Сохранить изменения</button></div>
            </form></section>

          <section class="card"><div class="card-head"><h2>Финансы</h2>${l.isDeal ? payBadge(l.payStatus) : ''}</div>
            ${l.isDeal ? `<div class="fin">
                <div><span>Сумма сделки</span><b><button class="link-edit" id="editAmount" title="Изменить сумму">${money(l.amount)}</button></b></div>
                <div><span>Предоплата</span><b>${money(l.prepaid)}</b></div>
                <div><span>Оплачено всего</span><b class="green-text">${money(l.paid)}</b></div>
                <div><span>Остаток</span><b class="${l.rest ? 'red-text' : ''}">${money(l.rest)}</b></div></div>
              <div class="paybar"><i style="width:${Math.min(100, Math.round((l.paid / (l.amount || 1)) * 100))}%"></i></div>
              ${l.payments.length ? `<table class="table compact"><tbody>${l.payments.map((p) => `<tr><td>${A.short(p.date)}</td><td>${p.kind === 'prepay' ? 'Предоплата' : 'Оплата'}${p.note ? `<small class="block">${esc(p.note)}</small>` : ''}</td><td class="num"><b>${money(p.sum)}</b></td><td class="num"><button class="icon-btn sm" data-delpay="${p.id}" title="Удалить оплату" aria-label="Удалить оплату">${ICON.x}</button></td></tr>`).join('')}</tbody></table>` : ''}
              <form id="payf" class="inline-form"><input name="sum" type="number" min="1" step="1" placeholder="Сумма, ₽" required value="${l.rest || ''}"><input name="date" type="date" value="${t}" required>
                <select name="kind">${A.opts([['prepay', 'Предоплата'], ['pay', 'Оплата']], l.paid ? 'pay' : 'prepay')}</select><input name="note" placeholder="Комментарий"><button class="btn">${ICON.plus}Внести</button></form>`
              : `<p class="muted">Сумма, предоплата и остаток появятся, когда заявка станет сделкой.</p>${l.stage !== 'lost' ? `<button class="btn" id="toDeal2">${ICON.ruble}Перевести в сделку</button>` : ''}`}
          </section>

          <section class="card"><div class="card-head"><h2>Задачи мастеров</h2>${l.stage !== 'lost' ? `<button class="btn sm primary" id="addTask">${ICON.plus}Назначить мастера</button>` : ''}</div>
            ${l.tasks.length ? `<ul class="tlist">${l.tasks.map((x) => `<li class="${x.date === t ? 'is-today' : ''}">
              <div class="t-date"><b>${A.relDate(x.date)}</b><small>${x.from}–${x.to}</small></div>
              <div class="t-body"><b>${esc(x.title)}</b> <small class="muted">${esc(x.num)}</small><small class="block">${esc(x.masterName)}${x.declineReason ? ` · <span class="red-text">${esc(x.declineReason)}</span>` : ''}</small>
                ${x.photos.length ? `<div class="thumbs">${x.photos.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${p.phase === 'before' ? 'до' : 'после'}" loading="lazy"><i>${p.phase === 'before' ? 'до' : 'после'}</i></a>`).join('')}</div>` : ''}</div>
              <div class="t-side">${A.taskBadge(x.status)}<button class="icon-btn sm" data-edittask="${x.id}" title="Изменить" aria-label="Изменить задачу">${ICON.gear}</button></div></li>`).join('')}</ul>` : A.empty('Мастера ещё не назначены', l.stage === 'lost' ? '' : 'Назначьте замерщика или бригаду — мастер получит задачу в Telegram')}
          </section>
        </div>

        <div class="lead-side">
          <section class="card"><div class="card-head"><h2>Клиент</h2><a class="link" href="#/client/${c.id}">Карточка ${ICON.chev}</a></div>
            <div class="client-mini"><div class="cm-name"><b>${esc(c.name)}</b> ${A.tagBadges(c.tags)}</div>
              <a href="${A.tel(c.phone)}" class="contact">${ICON.phone}${esc(c.phone)}</a>${c.email ? `<span class="contact">✉ ${esc(c.email)}</span>` : ''}
              <a href="${A.mapLink(l.address)}" target="_blank" rel="noopener" class="contact">${ICON.pin}${esc(l.address)}</a>
              ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
              ${l.otherLeads.length ? `<small class="muted">Другие заказы: ${l.otherLeads.map((o) => `<a href="#/lead/${o.id}">${esc(o.num)}</a> (${esc(A.stageName(o.stage)).toLowerCase()})`).join(', ')}</small>` : ''}</div></section>

          <section class="card"><div class="card-head"><h2>Напоминания</h2></div>
            ${l.reminders.length ? `<ul class="rems">${l.reminders.map((r) => `<li class="rem ${r.due < t ? 'overdue' : r.due === t ? 'today' : ''}"><button class="check" data-rem="${r.id}" aria-label="Выполнено">${ICON.check}</button><div><b>${esc(r.text)}</b></div><span class="when">${A.relDate(r.due)}</span></li>`).join('')}</ul>` : ''}
            <form id="rf" class="inline-form"><input name="text" placeholder="Позвонить клиенту" value="Позвонить клиенту"><select name="inDays">${A.opts([[1, 'завтра'], [3, 'через 3 дня'], [7, 'через неделю'], [14, 'через 2 недели']], 3)}</select><button class="btn">${ICON.bell}Напомнить</button></form></section>

          <section class="card"><div class="card-head"><h2>Файлы</h2><span class="muted">${l.files.length}</span></div>
            ${l.files.length ? `<ul class="files">${l.files.map((f) => `<li>${ICON.file}<a href="/api/file/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a><span class="badge sm grey">${FILE_KIND[f.kind] || 'Файл'}</span><button class="icon-btn sm" data-delfile="${f.id}" aria-label="Удалить файл">${ICON.x}</button></li>`).join('')}</ul>` : ''}
            <form id="ff" class="inline-form"><select name="kind">${A.opts(Object.entries(FILE_KIND), 'photo')}</select><label class="btn file-btn">${ICON.plus}Загрузить<input type="file" name="file" hidden></label></form>
            <p class="hint">Фото объекта, смета, договор — до 8 МБ.</p></section>

          <section class="card"><div class="tabs"><a href="#/lead/${l.id}?tab=comments" class="${tab === 'comments' ? 'active' : ''}">Комментарии (${l.comments.length})</a><a href="#/lead/${l.id}?tab=history" class="${tab === 'history' ? 'active' : ''}">История (${l.history.length})</a></div>
            ${tab === 'comments' ? `<form id="cf" class="comment-form"><textarea name="text" rows="2" placeholder="Написать комментарий для команды…" required></textarea><button class="btn sm primary">Отправить</button></form>
              <ul class="feed">${[...l.comments].reverse().map((x) => `<li>${A.avatar(A.staffName(x.userId) !== '—' ? A.staffName(x.userId) : 'Сайт', 'sm')}<div><b>${esc(A.staffName(x.userId) !== '—' ? A.staffName(x.userId) : 'С сайта')}</b> <small>${A.fmtDT(x.at)}</small><p>${esc(x.text)}</p></div></li>`).join('') || '<li class="muted">Комментариев пока нет</li>'}</ul>`
            : `<ul class="history">${[...l.history].reverse().map((h) => `<li><small>${A.fmtDT(h.at)}</small><span><b>${esc(h.userId ? A.staffName(h.userId) : 'Система')}</b> ${esc(h.text)}</span></li>`).join('')}</ul>`}</section>
        </div>
      </div>`;
  },
  bind(el) {
    const l = A.cache.lead;
    const upd = (p) => A.act(() => p, null).then((r) => { if (r) A.refresh(); return r; });
    $$('.step', el).forEach((b) => (b.onclick = async () => { if (await A.changeStage(l, b.dataset.stage)) A.refresh(); }));
    const td = async () => { if (await A.dealModal(l)) A.refresh(); };
    ['#toDeal', '#toDeal2'].forEach((s) => { const b = $(s, el); if (b) b.onclick = td; });
    const lost = $('#toLost', el); if (lost) lost.onclick = async () => { if (await A.changeStage(l, 'lost')) A.refresh(); };
    const ro = $('#reopen', el); if (ro) ro.onclick = async () => { if (await A.changeStage(l, l.isDeal ? 'estimate' : 'qualified')) A.refresh(); };
    const lf = $('#lf', el); const sb = $('#saveLead', el);
    lf.addEventListener('input', () => (sb.disabled = false)); lf.addEventListener('change', () => (sb.disabled = false));
    lf.onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(lf)); b.budget = Number(b.budget) || 0; if (await A.act(() => A.api('PATCH', '/leads/' + l.id, b), 'Сохранено')) A.refresh(); };
    const ea = $('#editAmount', el);
    if (ea) ea.onclick = async () => { const v = await A.prompt('Сумма сделки', 'Новая сумма по смете, ₽', { type: 'number', value: l.amount }); if (v) { if (await A.act(() => A.api('PATCH', '/leads/' + l.id, { amount: Number(v) }), 'Сумма изменена')) A.refresh(); } };
    const pf = $('#payf', el);
    if (pf) pf.onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(pf)); b.sum = Number(b.sum); if (await A.act(() => A.api('POST', `/leads/${l.id}/payments`, b), 'Оплата внесена')) A.refresh(); };
    $$('[data-delpay]', el).forEach((b) => (b.onclick = async () => { if (await A.confirm('Удалить оплату?', 'Запись об оплате будет удалена, это попадёт в историю.', 'Удалить', true)) upd(A.api('DELETE', `/leads/${l.id}/payments`, { id: b.dataset.delpay })); }));
    $('#rf', el).onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); if (await A.act(() => A.api('POST', '/reminders', { ...b, inDays: Number(b.inDays), clientId: l.clientId, leadId: l.id }), 'Напоминание добавлено')) A.refresh(); };
    $$('[data-rem]', el).forEach((b) => (b.onclick = () => upd(A.api('POST', `/reminders/${b.dataset.rem}/done`))));
    const fileIn = $('#ff input[type=file]', el);
    fileIn.onchange = async () => {
      const f = fileIn.files[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) return A.toast('Файл больше 8 МБ', true);
      A.toast('Загружаю…');
      const data = f.type.startsWith('image/') ? await A.shrinkImage(f) : await A.readFile(f);
      if (await A.act(() => A.api('POST', `/leads/${l.id}/files`, { name: f.name, kind: $('#ff select', el).value, data }), 'Файл загружен')) A.refresh();
    };
    $$('[data-delfile]', el).forEach((b) => (b.onclick = async () => { if (await A.confirm('Удалить файл?', 'Файл будет удалён из карточки.', 'Удалить', true)) upd(A.api('DELETE', `/leads/${l.id}/files`, { id: b.dataset.delfile })); }));
    const cf = $('#cf', el);
    if (cf) cf.onsubmit = async (e) => { e.preventDefault(); if (await A.act(() => A.api('POST', `/leads/${l.id}/comments`, { text: cf.text.value }))) A.refresh(); };
    const at = $('#addTask', el); if (at) at.onclick = () => A.taskModal(l);
    $$('[data-edittask]', el).forEach((b) => (b.onclick = () => A.taskModal(l, l.tasks.find((x) => x.id === b.dataset.edittask))));
  },
};

// ---------- назначение мастера: видно, кто свободен в выбранный день ----------
A.taskModal = (lead, task) => {
  const S = A.S;
  const masters = S.staff.filter((u) => u.role === 'master' && u.active);
  const w = A.modal(task ? `Задача ${task.num}` : 'Назначить мастера', `<form id="tm" class="grid2">
    <label class="field full"><span>Что сделать *</span><input name="title" required value="${esc(task?.title || (lead.stage === 'measure' || lead.stage === 'qualified' || lead.stage === 'new' ? 'Замер и фото объекта' : ''))}" placeholder="Например: укладка плитки в санузле"></label>
    <label class="field"><span>Дата *</span><input name="date" type="date" required value="${task?.date || A.addDays(S.today, 1)}"></label>
    <div class="field"><span>Время *</span><div class="time2"><input name="from" type="time" required value="${task?.from || '10:00'}"><i>—</i><input name="to" type="time" required value="${task?.to || '13:00'}"></div></div>
    <label class="field full"><span>Мастер *</span><select name="masterId" required>${A.opts(masters.map((m) => [m.id, `${m.name} — ${m.specialty}`]), task?.masterId, 'Выберите мастера')}</select></label>
    <div class="full busy" id="busy"></div>
    <label class="field full"><span>Адрес</span><input name="address" value="${esc(task?.address || lead.address)}"></label>
    <label class="field full"><span>Комментарий мастеру</span><textarea name="note" rows="2" placeholder="Что взять, код домофона, особенности объекта">${esc(task?.note || '')}</textarea></label>
    ${!task ? '<input type="hidden" name="kind" value="work">' : ''}
    <div class="form-actions full">${task ? '<button type="button" class="btn ghost-danger" id="delTask">Удалить задачу</button><span class="grow"></span>' : ''}<button type="button" class="btn" data-close>Отмена</button><button class="btn primary">${task ? 'Сохранить' : 'Назначить'}</button></div></form>`, { wide: true });
  const f = $('#tm', w);
  // загрузка мастеров на выбранную дату
  const showBusy = async () => {
    const d = f.date.value; if (!d) return;
    const cal = await A.api('GET', `/calendar?from=${d}&days=1`).catch(() => null); if (!cal) return;
    $('#busy', w).innerHTML = `<span class="muted">Загрузка мастеров на ${A.fmtDate(d, true)}:</span><div class="busy-list">${cal.masters.map((m) => {
      const ts = cal.tasks.filter((x) => x.masterId === m.id && x.id !== task?.id);
      const hours = ts.reduce((s, x) => s + (parseInt(x.to) - parseInt(x.from)), 0);
      return `<button type="button" class="busy-m ${f.masterId.value === m.id ? 'sel' : ''} ${hours >= 8 ? 'full' : hours ? 'part' : 'free'}" data-m="${m.id}"><b>${esc(m.name)}</b><small>${esc(m.specialty)}</small><span>${ts.length ? ts.map((x) => `${x.from}–${x.to}`).join(', ') : 'свободен весь день'}</span></button>`;
    }).join('')}</div>`;
    $$('.busy-m', w).forEach((b) => (b.onclick = () => { f.masterId.value = b.dataset.m; showBusy(); }));
  };
  f.date.onchange = showBusy; f.masterId.onchange = showBusy; showBusy();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(f));
    const r = await A.act(() => (task ? A.api('PATCH', '/tasks/' + task.id, b) : A.api('POST', `/leads/${lead.id}/tasks`, b)), task ? 'Задача обновлена' : 'Мастер назначен — уведомление отправлено');
    if (r) { A.closeModal(); A.refresh(); }
  };
  const del = $('#delTask', w);
  if (del) del.onclick = async () => { if (await A.confirm('Удалить задачу?', `Мастер ${esc(task.masterName)} получит уведомление об отмене.`, 'Удалить', true)) { if (await A.act(() => A.api('DELETE', '/tasks/' + task.id), 'Задача удалена')) A.refresh(); } };
};
})();
