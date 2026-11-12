(() => {
  'use strict';

  /* ---------- constants & helpers ---------- */
  const KEY = 'job-tracker:v1';
  const STAGES = ['saved', 'applied', 'screen', 'interview', 'offer', 'accepted', 'rejected'];
  const LABEL = { saved: 'To apply', applied: 'Applied', screen: 'Screen', interview: 'Interview', offer: 'Offer', accepted: 'Accepted', rejected: 'Rejected' };
  const RANK = { saved: 0, applied: 1, screen: 2, interview: 3, offer: 4, accepted: 4, rejected: 1 };
  const MODE = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };
  const FOLLOW_UP_DAYS = 7;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => iso(new Date());
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const money = n => (n ? '$' + Number(n).toLocaleString('en-US') : '—');
  const shortMoney = n => (n ? '$' + Math.round(n / 1000) + 'k' : '');
  const num = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const isTime = s => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
  const fmtDay = s => fromIso(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`; };
  const ivDate = iv => { const d = fromIso(iv.date); const [h, m] = (iv.time || '09:00').split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
  const daysSince = s => Math.floor((fromIso(today()) - fromIso(s)) / 864e5);
  const shade = name => ['', 'g1', 'g2', 'g3'][[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4];
  const icon = id => `<svg class="ic"><use href="#${id}"/></svg>`;
  const avatar = (a, cls = '') => `<span class="av ${shade(a.company)} ${cls}">${esc(a.company.trim()[0]?.toUpperCase() || '?')}</span>`;

  function relative(date) {
    const mins = Math.round((date - Date.now()) / 6e4);
    if (mins < 60) return `in ${Math.max(mins, 1)} min`;
    if (mins < 24 * 60) return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
    const days = Math.round((fromIso(iso(date)) - fromIso(today())) / 864e5);
    return days === 1 ? 'Tomorrow' : `in ${days} days`;
  }

  /* ---------- state ---------- */
  function sampleData() {
    const d = n => iso(addDays(new Date(), n));
    const mk = (company, role, location, mode, salary, status, appliedOffset, extra = {}) => ({
      id: uid(), company, role, location, mode, salary, url: '', status,
      furthest: extra.furthest ?? RANK[status],
      applied: status === 'saved' ? '' : d(appliedOffset),
      updated: d(extra.updated ?? appliedOffset),
      offer: extra.offer || null, interviews: extra.interviews || [], notes: extra.notes || []
    });
    return [
      mk('Linear', 'Senior Product Designer', 'Remote', 'remote', 168000, 'interview', -15, { updated: -3, interviews: [{ id: uid(), date: d(1), time: '14:00', type: 'Design critique' }], notes: [{ id: uid(), text: 'Ask about team size', date: d(-3) }] }),
      mk('Figma', 'Product Designer', 'San Francisco', 'hybrid', 172000, 'screen', -9, { updated: -2, interviews: [{ id: uid(), date: d(5), time: '10:00', type: 'Portfolio review' }] }),
      mk('Vercel', 'Design Engineer', 'Remote', 'remote', 160000, 'applied', -10),
      mk('Monzo', 'Senior Designer', 'London', 'hybrid', 135000, 'applied', -2),
      mk('Spotify', 'Product Designer II', 'Stockholm', 'onsite', 128000, 'screen', -12, { updated: -5 }),
      mk('Notion', 'Senior Product Designer', 'Remote', 'remote', 165000, 'offer', -30, { updated: -1, offer: { base: 165000, bonus: 15000, equity: 40000 }, interviews: [{ id: uid(), date: d(7), time: '15:30', type: 'Offer call' }] }),
      mk('Stripe', 'Product Designer', 'New York', 'hybrid', 172000, 'offer', -34, { updated: -4, offer: { base: 172000, bonus: 10000, equity: 28000 } }),
      mk('Airbnb', 'Senior Designer', 'San Francisco', 'hybrid', 180000, 'rejected', -40, { updated: -20, furthest: 3 }),
      mk('Shopify', 'Staff Designer', 'Remote', 'remote', 175000, 'rejected', -28, { updated: -14, furthest: 2 }),
      mk('Ramp', 'Staff Designer', 'New York', 'onsite', 195000, 'saved', 0),
      mk('Duolingo', 'Senior Designer', 'Remote', 'remote', 175000, 'saved', 0),
      mk('Canva', 'Design Lead', 'Sydney', 'hybrid', 180000, 'saved', 0)
    ];
  }

  function clean(raw) {
    if (!raw || typeof raw !== 'object' || !raw.company || !raw.role) return null;
    const status = STAGES.includes(raw.status) ? raw.status : 'saved';
    const str = (v, n) => String(v ?? '').slice(0, n);
    return {
      id: str(raw.id, 40) || uid(),
      company: str(raw.company, 80), role: str(raw.role, 100), location: str(raw.location, 80),
      mode: MODE[raw.mode] ? raw.mode : 'remote',
      salary: num(raw.salary), url: /^https?:\/\//i.test(raw.url || '') ? str(raw.url, 500) : '',
      status,
      furthest: Math.max(RANK[status], Math.min(4, num(raw.furthest))),
      applied: isDate(raw.applied) ? raw.applied : (status === 'saved' ? '' : today()),
      updated: isDate(raw.updated) ? raw.updated : today(),
      offer: raw.offer && typeof raw.offer === 'object' ? { base: num(raw.offer.base), bonus: num(raw.offer.bonus), equity: num(raw.offer.equity) } : null,
      interviews: (Array.isArray(raw.interviews) ? raw.interviews : []).filter(i => i && isDate(i.date))
        .map(i => ({ id: str(i.id, 40) || uid(), date: i.date, time: isTime(i.time) ? i.time : '09:00', type: str(i.type, 60) || 'Interview' })),
      notes: (Array.isArray(raw.notes) ? raw.notes : []).filter(n => n && n.text)
        .map(n => ({ id: str(n.id, 40) || uid(), text: str(n.text, 300), date: isDate(n.date) ? n.date : today() }))
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.apps)) {
        return { apps: raw.apps.map(clean).filter(Boolean), goal: Math.min(50, Math.max(1, num(raw.goal) || 5)), sample: !!raw.sample };
      }
    } catch (e) { /* storage unavailable or corrupt: fall through to sample data */ }
    return { apps: sampleData(), goal: 5, sample: true };
  }

  const state = load();
  const ui = { tab: 'active', q: '', modes: new Set(), minSalary: 0, followUp: false, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), day: today() };
  let storageOk = true;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, apps: state.apps, goal: state.goal, sample: state.sample })); }
    catch (e) { if (storageOk) toast('Could not save in this browser. Export to keep your data.'); storageOk = false; }
  }

  function setStatus(app, status) {
    app.status = status;
    app.furthest = Math.max(app.furthest || 0, RANK[status]);
    app.updated = today();
    if (status !== 'saved' && !app.applied) app.applied = today();
    if ((status === 'offer' || status === 'accepted') && !app.offer) app.offer = { base: app.salary || 0, bonus: 0, equity: 0 };
  }

  /* ---------- derived ---------- */
  const isActive = a => ['applied', 'screen', 'interview', 'offer'].includes(a.status);
  const isClosed = a => a.status === 'accepted' || a.status === 'rejected';
  const needsFollowUp = a => a.status === 'applied' && daysSince(a.updated || a.applied) >= FOLLOW_UP_DAYS;
  const offerTotal = a => (a.offer ? a.offer.base + a.offer.bonus + a.offer.equity : 0);

  function allInterviews() {
    return state.apps.flatMap(app => app.interviews.map(iv => ({ app, iv, at: ivDate(iv) }))).sort((a, b) => a.at - b.at);
  }
  const upcomingInterviews = () => allInterviews().filter(x => x.at >= Date.now() && x.app.status !== 'rejected');

  function inTab(a) {
    return ui.tab === 'saved' ? a.status === 'saved' : ui.tab === 'closed' ? isClosed(a) : isActive(a);
  }
  function matches(a) {
    const q = ui.q.trim().toLowerCase();
    if (q && !`${a.company} ${a.role} ${a.location}`.toLowerCase().includes(q)) return false;
    if (ui.modes.size && !ui.modes.has(a.mode)) return false;
    if (ui.minSalary && (a.salary || 0) < ui.minSalary) return false;
    if (ui.followUp && !needsFollowUp(a)) return false;
    return true;
  }

  /* ---------- render ---------- */
  function renderStats() {
    const applied = state.apps.filter(a => a.status !== 'saved');
    const responded = applied.filter(a => a.furthest >= 2 || a.status === 'rejected').length;
    const rate = applied.length ? Math.round(responded / applied.length * 100) : 0;
    const now = new Date(), monday = iso(addDays(now, -((now.getDay() + 6) % 7)));
    const week = applied.filter(a => a.applied >= monday).length;
    const C = 2 * Math.PI * 32, frac = Math.min(1, week / state.goal);
    const tile = (label, n, unit = '') => `<div class="stat"><div class="sub">${label}</div><div class="n">${n}${unit && `<small>${unit}</small>`}</div></div>`;
    $('#stats').innerHTML =
      tile('Applications', applied.length) +
      tile('In progress', state.apps.filter(isActive).length) +
      tile('Interviews ahead', upcomingInterviews().length) +
      tile('Response rate', rate, '%') +
      `<div class="stat goal">
        <div class="ring"><svg viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="32"/><circle class="fg" cx="38" cy="38" r="32" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg><b>${week}/${state.goal}</b></div>
        <div><div class="h">${week >= state.goal ? 'Weekly goal met' : 'Applied this week'}</div>
        <div class="stepper"><button data-act="goal" data-d="-1" aria-label="Lower weekly goal">${icon('minus')}</button>Goal ${state.goal}<button data-act="goal" data-d="1" aria-label="Raise weekly goal">${icon('plus')}</button></div></div>
      </div>`;
  }

  function renderTabs() {
    const counts = { saved: state.apps.filter(a => a.status === 'saved').length, active: state.apps.filter(isActive).length, closed: state.apps.filter(isClosed).length };
    $('#tabs').innerHTML = [['active', 'Active'], ['saved', 'To apply'], ['closed', 'Closed']]
      .map(([k, l]) => `<button role="tab" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${l}<em>${counts[k]}</em></button>`).join('');
    const followCount = state.apps.filter(needsFollowUp).length;
    $('#chips').innerHTML =
      Object.entries(MODE).map(([k, l]) => `<button class="fc" data-act="mode" data-mode="${k}" aria-pressed="${ui.modes.has(k)}">${icon('check')}${l}</button>`).join('') +
      `<select class="fc ${ui.minSalary ? 'on' : ''}" data-act="min-salary" aria-label="Minimum salary">
        ${[0, 100, 125, 150, 175, 200].map(k => `<option value="${k * 1000}" ${ui.minSalary === k * 1000 ? 'selected' : ''}>${k ? `$${k}k+` : 'Any salary'}</option>`).join('')}
      </select>` +
      `<button class="fc" data-act="follow" aria-pressed="${ui.followUp}">${icon('check')}Needs follow-up${followCount ? ` · ${followCount}` : ''}</button>`;
  }

  function renderApps() {
    const list = state.apps.filter(a => inTab(a) && matches(a))
      .sort((a, b) => (RANK[b.status] - RANK[a.status]) || (b.updated || '').localeCompare(a.updated || ''));
    const next = new Map();
    upcomingInterviews().forEach(x => { if (!next.has(x.app.id)) next.set(x.app.id, x); });
    if (!list.length) {
      const filtered = ui.q || ui.modes.size || ui.minSalary || ui.followUp;
      const msg = filtered ? ['Nothing matches', 'Try clearing the search or filters.']
        : ui.tab === 'saved' ? ['No jobs saved yet', 'Add roles you want to apply to and they will wait here.']
        : ui.tab === 'closed' ? ['Nothing closed yet', 'Accepted and rejected applications land here.']
        : ['No active applications', 'Add one to start tracking it.'];
      $('#apps').innerHTML = `<li class="empty"><b>${msg[0]}</b>${msg[1]}</li>`;
      return;
    }
    $('#apps').innerHTML = list.map((a, i) => {
      const meta = [a.company, a.location || MODE[a.mode], shortMoney(a.salary)].filter(Boolean).map(esc).join(' · ');
      const nx = next.get(a.id);
      return `<li class="app is-${a.status}" data-id="${esc(a.id)}" style="animation-delay:${Math.min(i, 8) * 30}ms">
        <button class="app-main" data-act="edit" aria-label="Edit ${esc(a.role)} at ${esc(a.company)}">
          ${avatar(a)}
          <span class="grow"><span class="h clip" style="display:block">${esc(a.role)}</span><span class="sub clip" style="display:block">${meta}</span></span>
        </button>
        ${nx ? `<span class="badge cal">${icon('i-cal')}${fmtDay(nx.iv.date)}</span>` : ''}
        ${needsFollowUp(a) ? `<span class="badge warn">Follow up · ${daysSince(a.updated || a.applied)}d</span>` : ''}
        ${a.status === 'saved'
          ? `<button class="btn small dark" data-act="apply">Apply</button>`
          : `<select class="status s-${a.status}" data-act="status" aria-label="Status for ${esc(a.company)}">${STAGES.filter(s => s !== 'saved').map(s => `<option value="${s}" ${s === a.status ? 'selected' : ''}>${LABEL[s]}</option>`).join('')}</select>`}
      </li>`;
    }).join('');
  }

  function renderCalendar() {
    const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
    const lead = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    const byDay = {};
    allInterviews().forEach(x => (byDay[x.iv.date] ||= []).push(x));
    let cells = 'SMTWTFS'.split('').map(d => `<b>${d}</b>`).join('') + '<span></span>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad(mo + 1)}-${pad(d)}`;
      const n = (byDay[key] || []).length;
      cells += `<button class="day${key === today() ? ' today' : ''}${n ? ' has' : ''}${key === ui.day ? ' sel' : ''}" data-act="day" data-day="${key}" aria-label="${fmtDay(key)}${n ? `, ${n} interview${n > 1 ? 's' : ''}` : ''}" aria-pressed="${key === ui.day}"><span>${d}</span></button>`;
    }
    const events = byDay[ui.day] || [];
    $('#calendar').innerHTML = `
      <div class="cal-head">
        <h2 class="h">${m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
        <span class="cal-nav"><button data-act="month" data-d="-1" aria-label="Previous month">${icon('left')}</button><button data-act="month" data-d="1" aria-label="Next month">${icon('right')}</button></span>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-events">${events.length
        ? events.map(x => `<button class="cal-event" data-act="edit" data-id="${esc(x.app.id)}">${icon('i-cal')}<span class="clip">${esc(x.app.company)} · ${esc(x.iv.type)}, ${fmtTime(x.iv.time)}</span></button>`).join('')
        : `<div class="cal-event none">No interviews on ${fmtDay(ui.day)}</div>`}</div>`;
  }

  function renderUpcoming() {
    const ups = upcomingInterviews();
    $('#up-count').textContent = ups.length ? `${ups.length} scheduled` : '';
    $('#upcoming').innerHTML = ups.length
      ? ups.slice(0, 5).map((x, i) => `<li><button class="up${i === 0 ? ' next' : ''}" data-act="edit" data-id="${esc(x.app.id)}">
          ${avatar(x.app)}
          <span class="grow"><span class="h clip" style="display:block">${esc(x.app.company)}</span><span class="sub clip" style="display:block">${esc(x.iv.type)}</span></span>
          <span class="when">${i === 0 ? relative(x.at) : fmtDay(x.iv.date)}<small>${i === 0 ? fmtDay(x.iv.date) + ', ' : ''}${fmtTime(x.iv.time)}</small></span>
        </button></li>`).join('')
      : `<li class="empty" style="padding:22px 8px">Open an application to schedule an interview.</li>`;
  }

  function renderFunnel() {
    const applied = state.apps.filter(a => a.status !== 'saved');
    const rows = [['Applied', applied.length], ['Screen', applied.filter(a => a.furthest >= 2).length], ['Interview', applied.filter(a => a.furthest >= 3).length], ['Offer', applied.filter(a => a.furthest >= 4).length]];
    const max = Math.max(1, rows[0][1]);
    $('#funnel').innerHTML = rows.map(([l, n], i) => `<div class="r"><span>${l}</span><div class="bar"><i class="${i === 3 ? 'g' : ''}" style="width:${n ? Math.max(4, n / max * 100) : 0}%"></i></div><span>${n}</span></div>`).join('');
  }

  function renderOffers() {
    const offers = state.apps.filter(a => (a.status === 'offer' || a.status === 'accepted') && a.offer);
    if (!offers.length) {
      $('#offers').innerHTML = `<div class="empty" style="padding:26px 8px"><b>No offers yet</b>When an application reaches Offer, its numbers line up here.</div>`;
      return;
    }
    const best = f => { const v = offers.map(f), mx = Math.max(...v); return offers.length > 1 && mx > 0 && v.filter(x => x === mx).length === 1 ? mx : null; };
    const row = (label, f, cls = '') => { const b = best(f); return `<span class="lab">${label}</span>` + offers.map(a => `<span class="v ${cls} ${b !== null && f(a) === b ? 'win' : ''}">${money(f(a))}</span>`).join(''); };
    $('#offers').innerHTML = `<div class="cmp-scroll"><div class="cmp" style="--n:${offers.length}">
      <span></span>${offers.map(a => `<span class="hd">${avatar(a, 'sm')}${esc(a.company)}</span>`).join('')}
      ${row('Base', a => a.offer.base)}
      ${row('Bonus', a => a.offer.bonus)}
      ${row('Equity', a => a.offer.equity)}
      <span class="lab">Location</span>${offers.map(a => `<span class="v ${a.mode === 'remote' && offers.some(o => o.mode !== 'remote') ? 'win' : ''}">${MODE[a.mode]}</span>`).join('')}
      <span class="rule"></span>
      ${row('Total', offerTotal, 'tot')}
      <span></span>${offers.map(a => `<span class="act" data-id="${esc(a.id)}">${a.status === 'accepted'
        ? `<span class="accepted">${icon('check')}Accepted</span>`
        : `<button class="btn small dark" data-act="accept">Accept</button>`}</span>`).join('')}
    </div></div>`;
  }

  function render() {
    $('#banner').hidden = !state.sample;
    renderStats(); renderTabs(); renderApps(); renderCalendar(); renderUpcoming(); renderFunnel(); renderOffers();
  }
  function commit(msg) { save(); render(); if (msg) toast(msg); }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ---------- dialog ---------- */
  const dlg = $('#dlg'), form = $('#form');
  let draft = null;
  $('#f-status').innerHTML = STAGES.map(s => `<option value="${s}">${LABEL[s]}</option>`).join('');

  function openDialog(app) {
    draft = app
      ? JSON.parse(JSON.stringify(app))
      : { id: '', company: '', role: '', location: '', mode: 'remote', salary: 0, url: '', status: ui.tab === 'saved' ? 'saved' : 'applied', furthest: 0, applied: '', updated: today(), offer: null, interviews: [], notes: [] };
    $('#dlg-title').textContent = app ? 'Edit application' : 'Add application';
    $('#btn-delete').hidden = !app;
    const f = form.elements;
    f.company.value = draft.company; f.role.value = draft.role; f.location.value = draft.location;
    f.mode.value = draft.mode; f.salary.value = draft.salary || ''; f.url.value = draft.url;
    f.status.value = draft.status; f.applied.value = draft.applied || (draft.status === 'saved' ? '' : today());
    f.base.value = draft.offer?.base || ''; f.bonus.value = draft.offer?.bonus || ''; f.equity.value = draft.offer?.equity || '';
    $('#iv-date').value = ''; $('#iv-time').value = '10:00'; $('#iv-type').value = ''; $('#note-text').value = '';
    $('#err').hidden = true; $$('.bad', form).forEach(el => el.classList.remove('bad'));
    syncOfferFields(); renderSublists();
    dlg.showModal();
    if (!app) f.company.focus();
  }
  function syncOfferFields() {
    const st = form.elements.status.value;
    $('#offer-fs').hidden = !(st === 'offer' || st === 'accepted');
  }
  function renderSublists() {
    draft.interviews.sort((a, b) => ivDate(a) - ivDate(b));
    $('#iv-list').innerHTML = draft.interviews.map(i => `<li data-sub="${esc(i.id)}"><span class="grow clip">${esc(i.type)}</span><small>${fmtDay(i.date)}, ${fmtTime(i.time)}</small><button type="button" class="x" data-act="del-iv" aria-label="Remove interview">${icon('x')}</button></li>`).join('');
    $('#note-list').innerHTML = draft.notes.map(n => `<li data-sub="${esc(n.id)}"><span class="grow">${esc(n.text)}</span><small>${fmtDay(n.date)}</small><button type="button" class="x" data-act="del-note" aria-label="Remove note">${icon('x')}</button></li>`).join('');
  }
  function fail(msg, field) {
    $('#err').textContent = msg; $('#err').hidden = false;
    if (field) { field.classList.add('bad'); field.focus(); }
  }
  function addInterview() {
    const date = $('#iv-date').value, time = $('#iv-time').value || '09:00';
    if (!isDate(date)) return fail('Pick a date for the interview.', $('#iv-date')), false;
    draft.interviews.push({ id: uid(), date, time: isTime(time) ? time : '09:00', type: $('#iv-type').value.trim() || 'Interview' });
    $('#iv-date').value = ''; $('#iv-type').value = ''; $('#err').hidden = true; $('#iv-date').classList.remove('bad');
    renderSublists();
    return true;
  }
  function addNote() {
    const text = $('#note-text').value.trim();
    if (!text) return;
    draft.notes.push({ id: uid(), text, date: today() });
    $('#note-text').value = '';
    renderSublists();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    $$('.bad', form).forEach(el => el.classList.remove('bad'));
    const company = f.company.value.trim(), role = f.role.value.trim(), url = f.url.value.trim();
    if (!company) return fail('Add the company name.', f.company);
    if (!role) return fail('Add the role.', f.role);
    if (url && !/^https?:\/\/\S+$/i.test(url)) return fail('Job link should start with http:// or https://', f.url);
    // pick up anything typed into the add rows but not yet added
    if ($('#iv-date').value && !addInterview()) return;
    addNote();

    const existing = state.apps.find(a => a.id === draft.id);
    const status = f.status.value;
    const app = Object.assign(existing || { id: uid(), furthest: 0 }, {
      company, role, location: f.location.value.trim(), mode: f.mode.value, salary: num(f.salary.value), url,
      interviews: draft.interviews, notes: draft.notes
    });
    const wasStatus = existing ? existing.status : null;
    app.applied = isDate(f.applied.value) ? f.applied.value : '';
    if (status === 'offer' || status === 'accepted') {
      app.offer = { base: num(f.base.value) || app.salary, bonus: num(f.bonus.value), equity: num(f.equity.value) };
    }
    if (wasStatus !== status) setStatus(app, status); else app.status = status;
    if (app.interviews.length && app.furthest < 3 && ['applied', 'screen'].includes(app.status) && app.interviews.some(i => /interview|onsite|final|critique|review|panel/i.test(i.type))) app.furthest = Math.max(app.furthest, 2);
    if (!existing) state.apps.unshift(app);

    ui.tab = app.status === 'saved' ? 'saved' : isClosed(app) ? 'closed' : 'active';
    dlg.close();
    commit(existing ? 'Saved' : `${company} added`);
  });
  form.elements.status.addEventListener('change', syncOfferFields);
  $('#note-text').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });
  $('#iv-type').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addInterview(); } });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  /* ---------- actions ---------- */
  const appFor = el => state.apps.find(a => a.id === el.closest('[data-id]')?.dataset.id);

  const actions = {
    new: () => openDialog(null),
    edit: el => { const a = appFor(el); if (a) openDialog(a); },
    close: () => dlg.close(),
    tab: el => { ui.tab = el.dataset.tab; render(); },
    mode: el => { const k = el.dataset.mode; ui.modes.has(k) ? ui.modes.delete(k) : ui.modes.add(k); render(); },
    follow: () => { ui.followUp = !ui.followUp; render(); },
    goal: el => { state.goal = Math.min(50, Math.max(1, state.goal + Number(el.dataset.d))); commit(); },
    month: el => { ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + Number(el.dataset.d), 1); renderCalendar(); },
    day: el => { ui.day = el.dataset.day; renderCalendar(); },
    apply: el => { const a = appFor(el); if (!a) return; setStatus(a, 'applied'); a.applied = today(); commit(`Applied to ${a.company}`); },
    accept: el => { const a = appFor(el); if (!a) return; setStatus(a, 'accepted'); commit(`Accepted ${a.company}`); },
    'add-iv': () => addInterview(),
    'add-note': () => addNote(),
    'del-iv': el => { draft.interviews = draft.interviews.filter(i => i.id !== el.closest('[data-sub]').dataset.sub); renderSublists(); },
    'del-note': el => { draft.notes = draft.notes.filter(n => n.id !== el.closest('[data-sub]').dataset.sub); renderSublists(); },
    delete: () => {
      if (!confirm(`Delete ${draft.company}? This can't be undone.`)) return;
      state.apps = state.apps.filter(a => a.id !== draft.id);
      dlg.close(); commit('Deleted');
    },
    'clear-sample': () => {
      if (!confirm('Remove the sample applications and start with an empty tracker?')) return;
      state.apps = []; state.sample = false; commit('Sample data cleared');
    },
    export: () => {
      const blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), goal: state.goal, apps: state.apps }, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `job-tracker-${today()}.json` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Exported');
    },
    import: () => $('#import-file').click()
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.act === 'status') {
      const a = appFor(el); if (!a) return;
      setStatus(a, el.value);
      commit(`${a.company} moved to ${LABEL[el.value]}`);
    } else if (el.dataset.act === 'min-salary') {
      ui.minSalary = Number(el.value); render();
    }
  });
  $('#q').addEventListener('input', e => { ui.q = e.target.value; renderApps(); });

  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5e6) throw new Error('too big');
      const raw = JSON.parse(await file.text());
      const list = Array.isArray(raw) ? raw : raw.apps;
      if (!Array.isArray(list)) throw new Error('no apps');
      const apps = list.map(clean).filter(Boolean);
      if (!apps.length && list.length) throw new Error('nothing valid');
      if (state.apps.length && !confirm(`Replace the ${state.apps.length} applications here with ${apps.length} from the file?`)) return;
      state.apps = apps; state.sample = false;
      if (raw.goal) state.goal = Math.min(50, Math.max(1, num(raw.goal) || 5));
      commit(`Imported ${apps.length} application${apps.length === 1 ? '' : 's'}`);
    } catch (err) { toast("That file isn't a Job Tracker export."); }
  });

  // keep countdowns and "today" fresh, and stay in sync with other tabs
  setInterval(() => { renderUpcoming(); renderStats(); }, 30000);
  window.addEventListener('storage', e => { if (e.key === KEY) { Object.assign(state, load()); render(); } });

  render();
})();
