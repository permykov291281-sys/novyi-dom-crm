// Демо-данные студии ремонта «Новый дом». Даты считаются от сегодняшнего дня, поэтому демо всегда «живое».
const crypto = require('crypto');

const STAGES = ['new', 'qualified', 'measure', 'estimate', 'work', 'done', 'lost'];
const WORK_TYPES = ['Ремонт под ключ', 'Косметический ремонт', 'Ванная и санузел', 'Кухня', 'Электрика', 'Сантехника', 'Отделка новостройки', 'Мелкий ремонт'];
const SOURCES = { site: 'Сайт', call: 'Звонок', avito: 'Avito', referral: 'Сарафан' };

function seed(hashPassword, todayStr) {
  let n = 0;
  const id = () => crypto.randomBytes(5).toString('hex');
  // детерминированный «случайный» генератор, чтобы демо было одинаковым при каждом запуске
  let s = 20261001;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const day = (off) => { const d = new Date(todayStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
  const at = (off, h = 10, m = 0) => `${day(off)}T${String(h - 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`; // время Екатеринбурга (UTC+5)

  const pw = hashPassword('remont');
  const user = (login, name, role, extra = {}) => ({ id: id(), login, name, role, phone: '', tgChatId: '', active: true, ...pw, createdAt: at(-90), ...extra });
  const admin = user('admin', 'Ольга Белова', 'admin', { phone: '+7 912 600-10-01' });
  const managers = [
    user('manager', 'Андрей Карпов', 'manager', { phone: '+7 912 600-20-02' }),
    user('manager2', 'Елена Смирнова', 'manager', { phone: '+7 912 600-20-03' }),
    user('manager3', 'Дмитрий Орлов', 'manager', { phone: '+7 912 600-20-04' }),
    user('manager4', 'Наталья Ершова', 'manager', { phone: '+7 912 600-20-05' }),
  ];
  const masters = [
    user('master', 'Иван Кравцов', 'master', { specialty: 'Плиточник', phone: '+7 922 100-30-01' }),
    user('master2', 'Сергей Лебедев', 'master', { specialty: 'Электрик', phone: '+7 922 100-30-02' }),
    user('master3', 'Павел Морозов', 'master', { specialty: 'Сантехник', phone: '+7 922 100-30-03' }),
    user('master4', 'Алексей Зуев', 'master', { specialty: 'Маляр-штукатур', phone: '+7 922 100-30-04' }),
    user('master5', 'Николай Фомин', 'master', { specialty: 'Универсал, замерщик', phone: '+7 922 100-30-05' }),
    user('master6', 'Рустам Галиев', 'master', { specialty: 'Плиточник', phone: '+7 922 100-30-06' }),
  ];

  const NAMES = ['Мария Ковалёва', 'Игорь Степанов', 'Анна Воронцова', 'Константин Мельников', 'Юлия Абрамова', 'Виктор Тарасов', 'Светлана Гусева',
    'Роман Белоусов', 'Татьяна Комарова', 'Евгений Сафонов', 'Ксения Лаптева', 'Олег Гаврилов', 'Полина Широкова', 'Артём Медведев', 'Людмила Егорова',
    'Максим Савельев', 'Дарья Никитина', 'Глеб Фролов', 'Вера Кудрявцева', 'Станислав Пестов', 'Алина Хабибуллина', 'Григорий Рябов', 'Ольга Мартынова',
    'Денис Зайцев', 'Елизавета Котова', 'Михаил Бурцев', 'Надежда Соболева', 'Тимур Валиев', 'Инна Захарова', 'Фёдор Кириллов', 'Валерия Юдина',
    'Борис Голованов', 'Ирина Чернова', 'Ярослав Пахомов', 'Кристина Осипова', 'Андрей Лукин', 'Софья Демидова', 'Руслан Ахметов'];
  const STREETS = ['ул. Малышева', 'ул. Белинского', 'ул. Шейнкмана', 'ул. Радищева', 'ул. Академика Шварца', 'ул. Щорса', 'ул. Татищева', 'ул. Викулова',
    'ул. Учителей', 'ул. Народной Воли', 'пр. Космонавтов', 'ул. Блюхера', 'ул. Репина', 'ул. Фурманова', 'ул. Сурикова', 'ул. Вильгельма де Геннина'];
  const clients = NAMES.map((name, i) => ({
    id: id(), name,
    phone: `+7 9${12 + (i % 8)} ${String(200 + i * 7).padStart(3, '0')}-${String(10 + i).padStart(2, '0')}-${String(40 + i * 3 % 60).padStart(2, '0')}`,
    email: i % 3 === 0 ? `client${i + 1}@mail.ru` : '',
    address: `Екатеринбург, ${STREETS[i % STREETS.length]}, ${10 + (i * 7) % 90}, кв. ${5 + (i * 13) % 180}`,
    tags: [], note: '', managerId: managers[i % 4].id, createdAt: at(-80 + i), calls: [],
  }));
  clients[0].tags = ['VIP', 'повторный']; clients[0].note = 'Второй заказ: в 2025 делали кухню. Предпочитает связь в Telegram.';
  clients[3].tags = ['проблемный']; clients[3].note = 'Спорил по смете, всё фиксировать письменно.';
  clients[7].tags = ['VIP']; clients[12].tags = ['повторный']; clients[20].tags = ['повторный']; clients[25].tags = ['VIP'];

  // ----- заявки и сделки -----
  const leads = []; const tasks = []; const reminders = []; let leadNo = 100; let dealNo = 40; let taskNo = 300;
  const BUDGETS = { 'Ремонт под ключ': [600, 1400], 'Косметический ремонт': [120, 350], 'Ванная и санузел': [180, 450], 'Кухня': [150, 400], 'Электрика': [40, 160], 'Сантехника': [30, 120], 'Отделка новостройки': [450, 1100], 'Мелкий ремонт': [10, 45] };
  const masterFor = (wt) => (/Ванная|Кухня/.test(wt) ? [masters[0], masters[5]] : wt === 'Электрика' ? [masters[1]] : wt === 'Сантехника' ? [masters[2]] : [masters[3], masters[4]]);
  const LOST = ['Дорого, выбрали другую бригаду', 'Перенесли ремонт на весну', 'Не дозвонились после замера'];
  // распределение этапов: больше всего в работе и завершённых, чтобы были отчёты
  const plan = ['work', 'done', 'work', 'estimate', 'measure', 'done', 'work', 'lost', 'qualified', 'new', 'done', 'work', 'estimate', 'done', 'measure', 'lost',
    'done', 'work', 'qualified', 'done', 'new', 'estimate', 'done', 'work', 'measure', 'done', 'lost', 'done', 'work', 'qualified', 'done', 'estimate', 'done',
    'work', 'measure', 'done', 'new', 'lost', 'done', 'work', 'qualified', 'estimate', 'new', 'measure', 'new'];
  const measureSlot = [0, 0]; // свободные окна замерщика сегодня и завтра
  plan.forEach((stage, i) => {
    const client = clients[i % clients.length];
    const manager = managers.find((m) => m.id === client.managerId);
    const wt = i === 0 ? 'Ванная и санузел' : pick(WORK_TYPES);
    const [lo, hi] = BUDGETS[wt];
    const budget = Math.round((lo + rnd() * (hi - lo)) / 5) * 5000;
    // старые заявки — завершённые, свежие — в начале воронки
    const created = stage === 'new' ? -Math.floor(rnd() * 2) : stage === 'qualified' ? -2 - Math.floor(rnd() * 3) : stage === 'measure' ? -4 - Math.floor(rnd() * 4)
      : stage === 'estimate' ? -7 - Math.floor(rnd() * 6) : stage === 'work' ? -14 - Math.floor(rnd() * 25) : stage === 'lost' ? -5 - Math.floor(rnd() * 60) : -24 - Math.floor(rnd() * 64);
    const source = pick(['site', 'site', 'call', 'avito', 'referral']);
    const lead = {
      id: id(), num: '№' + (++leadNo), clientId: client.id, address: client.address, workType: wt, budget, source, managerId: manager.id, stage,
      isDeal: false, dealNum: '', dealAt: null, amount: 0, payments: [], comments: [], files: [], history: [],
      createdAt: at(created, 9 + (i % 8), (i * 17) % 60), updatedAt: at(created), closedAt: null, lostReason: '',
    };
    const h = (off, uid, text) => lead.history.push({ at: at(off, 11, i % 60), userId: uid, text });
    h(created, source === 'site' ? null : manager.id, source === 'site' ? 'заявка с сайта (вебхук)' : 'создал(а) заявку');
    const reached = STAGES.indexOf(stage === 'lost' ? ['qualified', 'measure', 'estimate'][i % 3] : stage);
    // путь заявки по этапам: у завершённых — 3–5 недель от заявки, у остальных — растянут до сегодняшнего дня
    const span = stage === 'done' ? Math.min(-created - 2, 20 + Math.floor(rnd() * 15)) : -created;
    const stepOff = (k) => Math.min(0, created + Math.round((k * span) / 6));
    for (let k = 1; k <= Math.min(reached, 5); k++) h(stepOff(k), manager.id, `этап: ${STAGE_RU[STAGES[k]]}`);
    if (reached >= 2) { // замер
      // у заявок на этапе «Замер» выезд сегодня или завтра, у остальных — уже выполнен
      const upcoming = stage === 'measure';
      tasks.push(mkTask(lead, masters[4], 'measure', 'Замер и фото объекта', upcoming ? i % 2 : stepOff(2), upcoming ? 9 + 2 * (measureSlot[i % 2]++) : 10 + (i % 6), upcoming ? (i % 2 ? 'assigned' : 'accepted') : 'done'));
    }
    if (reached >= 3 && stage !== 'lost') {
      lead.isDeal = true; lead.dealNum = 'С-' + (++dealNo); lead.dealAt = at(stepOff(3));
      lead.amount = Math.round(budget * (0.9 + rnd() * 0.3) / 1000) * 1000;
      h(stepOff(3), manager.id, `заявка переведена в сделку ${lead.dealNum}, сумма ${lead.amount.toLocaleString('ru-RU')} ₽`);
      lead.files.push({ id: id(), name: `Смета_${lead.num.replace('№', '')}.pdf`, kind: 'estimate', size: 184000, mime: 'application/pdf', demo: true, at: at(stepOff(3)), userId: manager.id });
    }
    if (reached >= 4 && stage !== 'lost') {
      const pre = Math.round(lead.amount * 0.3 / 1000) * 1000;
      lead.payments.push({ id: id(), date: day(stepOff(4)), sum: pre, kind: 'prepay', note: 'Предоплата 30% по договору' });
      lead.files.push({ id: id(), name: `Договор_${lead.dealNum}.pdf`, kind: 'contract', size: 96000, mime: 'application/pdf', demo: true, at: at(stepOff(4)), userId: manager.id });
      const ms = masterFor(wt);
      const startOff = stepOff(4) + 1;
      const workDays = stage === 'done' ? 3 : 4;
      for (let k = 0; k < workDays; k++) {
        // у сделок «в работе» последний этап ещё впереди (через 1–3 дня)
        const off = stage === 'work' && k === workDays - 1 ? 1 + (i % 3) : startOff + k * 2;
        const st = stage === 'done' || off < 0 ? 'done' : off === 0 ? (k % 2 ? 'in_progress' : 'accepted') : (k % 2 ? 'assigned' : 'accepted');
        tasks.push(mkTask(lead, ms[k % ms.length], 'work', k === 0 ? 'Демонтаж и подготовка' : k === workDays - 1 ? 'Чистовая отделка' : 'Основные работы', off, 9 + (k % 3) * 2, st));
      }
    }
    if (stage === 'done') {
      const closeOff = Math.min(-1, stepOff(6));
      lead.payments.push({ id: id(), date: day(closeOff), sum: lead.amount - lead.payments[0].sum, kind: 'pay', note: 'Окончательный расчёт' });
      lead.closedAt = at(closeOff); h(closeOff, manager.id, 'этап: Завершено, оплата получена полностью');
    }
    if (stage === 'work' && i % 3 === 0) lead.payments.push({ id: id(), date: day(-3), sum: Math.round(lead.amount * 0.3 / 1000) * 1000, kind: 'pay', note: 'Оплата за черновой этап' });
    if (stage === 'lost') { lead.lostReason = LOST[i % 3]; lead.closedAt = at(created + 4); h(created + 4, manager.id, `этап: Отказ — ${lead.lostReason}`); }
    if (i % 4 === 0) lead.comments.push({ id: id(), userId: manager.id, at: at(created, 15), text: 'Клиент просит согласовать время визита за день, звонить после 18:00.' });
    if (reached >= 3 && i % 3 === 1) lead.comments.push({ id: id(), userId: admin.id, at: at(stepOff(3), 17), text: 'Смету проверила, материалы с запасом 10% — ок.' });
    lead.updatedAt = lead.history[lead.history.length - 1].at;
    leads.push(lead);
    client.calls.push({ id: id(), at: at(created, 12), userId: manager.id, text: source === 'call' ? 'Входящий звонок: обсудили объём работ' : 'Перезвонил по заявке, договорились о замере' });
  });

  function mkTask(lead, master, kind, title, off, hour, status) {
    const t = {
      id: id(), num: 'Т-' + (++taskNo), leadId: lead.id, masterId: master.id, kind, title, date: day(off), from: `${String(hour).padStart(2, '0')}:00`,
      to: `${String(hour + (kind === 'measure' ? 1 : 4)).padStart(2, '0')}:00`, address: lead.address, note: kind === 'measure' ? 'Взять лазерную рулетку, сфотографировать стены и коммуникации' : '',
      status, declineReason: '', photos: [], createdBy: lead.managerId, createdAt: at(off - 2), history: [{ at: at(off - 2), userId: lead.managerId, text: `назначил(а) мастеру ${master.name}` }],
    };
    if (status !== 'assigned') t.history.push({ at: at(off - 1), userId: master.id, text: 'принял(а) задачу' });
    if (status === 'done') t.history.push({ at: at(off, hour + 3), userId: master.id, text: 'отметил(а): выполнена' });
    return t;
  }

  // Мария Ковалёва (клиент с кабинетом) — сделка «Ванная» в работе, с фото до/после
  const maria = leads[0];
  const mariaTasks = tasks.filter((t) => t.leadId === maria.id);
  const firstDone = mariaTasks.find((t) => t.kind === 'work' && t.status === 'done') || mariaTasks[0];
  firstDone.photos = [
    { id: id(), phase: 'before', name: 'до-1.jpg', url: '/demo/before-1.jpg', at: firstDone.createdAt, userId: firstDone.masterId },
    { id: id(), phase: 'after', name: 'после-1.jpg', url: '/demo/after-1.jpg', at: firstDone.createdAt, userId: firstDone.masterId },
    { id: id(), phase: 'after', name: 'после-2.jpg', url: '/demo/after-2.jpg', at: firstDone.createdAt, userId: firstDone.masterId },
  ];

  // у «Ивана Кравцова» (демо-мастер) сегодня 2 задачи и 1 завтра — чтобы кабинет мастера был наглядным
  const ivan = masters[0];
  const workLeads = leads.filter((l) => l.stage === 'work');
  const addIvan = (lead, off, hour, status, title) => tasks.push(mkTask(lead, ivan, 'work', title, off, hour, status));
  addIvan(workLeads[1] || maria, 0, 9, 'accepted', 'Укладка плитки на пол');
  addIvan(workLeads[2] || maria, 0, 14, 'assigned', 'Затирка швов, установка трапа');
  addIvan(workLeads[3] || maria, 1, 10, 'assigned', 'Облицовка фартука кухни');
  // демо не должно противоречить правилу сервера «у мастера нет пересечений по времени»:
  // задачи, которые накладываются на уже занятое время, переносим на соседний свободный день
  const busy = [];
  const clash = (t) => busy.some((x) => x.masterId === t.masterId && x.date === t.date && x.from < t.to && t.from < x.to);
  for (const t of [...tasks.slice(-3), ...tasks.slice(0, -3)]) { // сначала три показательные задачи Ивана
    while (clash(t)) { const back = t.date < todayStr; const d = new Date(t.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + (back ? -1 : 1)); t.date = d.toISOString().slice(0, 10); }
    busy.push(t);
  }
  const unassignedLead = leads.find((l) => l.stage === 'measure' && !tasks.some((t) => t.leadId === l.id && t.date >= todayStr));

  // напоминания менеджерам: просроченное, на сегодня, на будущее
  const mainMgr = managers[0];
  const mLeads = leads.filter((l) => l.managerId === mainMgr.id);
  const rem = (off, lead, text, mgr = mainMgr) => reminders.push({ id: id(), managerId: mgr.id, clientId: lead.clientId, leadId: lead.id, due: day(off), text, done: false, createdAt: at(off - 3) });
  rem(-1, mLeads[2], 'Позвонить: согласовать смету');
  rem(0, mLeads[3], 'Позвонить клиенту — уточнить дату старта');
  rem(0, mLeads[5], 'Напомнить о второй оплате');
  rem(3, mLeads[1], 'Позвонить через 3 дня: как клиенту результат, попросить отзыв');
  rem(1, leads.find((l) => l.managerId === managers[1].id), 'Отправить договор на почту', managers[1]);

  // клиент с личным кабинетом
  const clientUser = user('client', clients[0].name, 'client', { clientId: clients[0].id, phone: clients[0].phone });

  const users = [admin, ...managers, ...masters, clientUser];
  const notifications = [
    { id: id(), userId: mainMgr.id, at: at(0, 9, 5), text: `Новая заявка ${leads.find((l) => l.stage === 'new' && l.managerId === mainMgr.id)?.num || ''} с сайта`, link: '#/leads', read: false },
    { id: id(), userId: ivan.id, at: at(-1, 18), text: 'Новая задача на сегодня: Затирка швов, установка трапа', link: '#/my', read: false },
  ];
  void unassignedLead;
  return {
    version: 1, users, clients, leads, tasks, reminders, notifications,
    workTypes: WORK_TYPES.slice(), sessions: {}, log: [],
    settings: { telegramToken: '', webhookKey: crypto.randomBytes(8).toString('hex'), tgOffset: 0 },
    counters: { lead: leadNo, deal: dealNo, task: taskNo },
  };
}
const STAGE_RU = { new: 'Новая', qualified: 'Квалифицирована', measure: 'Замер', estimate: 'Смета', work: 'В работе', done: 'Завершено', lost: 'Отказ' };

module.exports = { seed, STAGES, STAGE_RU, WORK_TYPES, SOURCES };
