(() => {
  'use strict';

  // ---------- Utils ----------
  const KEY = 'gym-tracker-v1';
  const app = document.getElementById('app');
  const uid = () => Math.random().toString(36).slice(2, 10);
  const today = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const fmtNum = n => n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('uk-UA');
  const fmtDate = iso => new Date(iso + 'T00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtShort = iso => new Date(iso + 'T00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };
  const toast = msg => {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  };

  const ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    workouts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/></svg>',
    program: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
    body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  const TABS = [
    ['home', 'Головна'],
    ['program', 'Програма'],
    ['stats', 'Аналітика'],
    ['body', 'Тіло'],
    ['profile', 'Профіль'],
  ];

  const MEAS = [
    ['weight', 'Вага', 'кг'],
    ['bodyFat', 'Жир', '%'],
    ['chest', 'Груди', 'см'],
    ['waist', 'Талія', 'см'],
    ['hips', 'Стегна', 'см'],
    ['arm', 'Біцепс', 'см'],
    ['thigh', 'Стегно', 'см'],
  ];

  // ---------- State ----------
  // Програма тренувань задається у program.js і не редагується в інтерфейсі
  const EXERCISES = window.EXERCISES || {};
  const PROGRAM = normalizeProgram(window.PROGRAM || { name: 'Програма', weeks: [] });

  // [назва, "4×6-8", "150-180с", базовий?, нотатка] -> об'єкт вправи
  function normalizeProgram(raw) {
    const secs = r => { const nums = String(r).match(/\d+/g); return nums ? +nums[nums.length - 1] : 90; };
    const weeks = (raw.weeks || []).map((w, wi) => ({
      num: w.num || String(wi + 1).padStart(2, '0'),
      label: (raw.weekLabels || [])[wi] || '',
      days: (w.days || []).map((d, di) => ({
        id: `w${wi + 1}d${di + 1}`,
        weekIdx: wi, dayIdx: di,
        weekNum: w.num || String(wi + 1),
        label: d.label,
        short: d.label,
        name: `${d.label} · тиждень ${w.num || wi + 1}`,
        focus: d.focus || '',
        exercises: (d.exercises || []).map(e => {
          const [name, scheme, rest, anchor, note] = e;
          const m = String(scheme).match(/^(\d+)\s*[×x]\s*(.+)$/);
          return {
            name,
            sets: m ? +m[1] : 3,
            reps: m ? m[2] : String(scheme),
            rest: secs(rest),
            anchor: !!anchor,
            note: note || '',
          };
        }),
      })),
    }));
    return Object.assign({}, raw, { weeks, days: weeks.flatMap(w => w.days) });
  }

  function fresh() {
    return { profile: { name: '', height: '', goal: '' }, measurements: [], checks: {}, workouts: [], active: null, tab: 'home' };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.workouts)) { delete s.program; return Object.assign(fresh(), s); }
    } catch (e) { /* ignore */ }
    return fresh();
  }

  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не вдалося зберегти дані'); } };

  // ---------- Derived ----------
  const measSorted = () => [...S.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const workoutsSorted = () => [...S.workouts].sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt || 0) - (a.startedAt || 0));
  const latestMeas = key => { const m = measSorted().filter(x => x[key] != null); return m.length ? m[m.length - 1] : null; };

  function lastSetsFor(name) {
    const n = name.trim().toLowerCase();
    for (const w of workoutsSorted()) {
      const e = w.exercises.find(x => x.name.trim().toLowerCase() === n);
      if (e && e.sets.length) return { date: w.date, sets: e.sets };
    }
    return null;
  }

  function nextDay() {
    const days = PROGRAM.days;
    if (!days.length) return null;
    const last = workoutsSorted().find(w => w.dayId && days.some(d => d.id === w.dayId));
    if (!last) return days[0];
    const i = days.findIndex(d => d.id === last.dayId);
    return days[(i + 1) % days.length];
  }

  function weekStart() {
    const d = new Date(today() + 'T00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  const volume = w => w.exercises.reduce((s, e) => s + e.sets.reduce((t, x) => t + (num(x.w) || 0) * (num(x.r) || 0), 0), 0);
  const setsStr = sets => sets.map(s => `${s.w || 0}×${s.r || 0}`).join(', ');

  function exerciseNames() {
    const set = new Map();
    for (const w of S.workouts) for (const e of w.exercises) set.set(e.name.trim().toLowerCase(), e.name.trim());
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'uk'));
  }

  // ---------- Chart ----------
  function chart(pts, unit) {
    if (pts.length < 2) return '<div class="empty small">Для графіка потрібно щонайменше 2 записи</div>';
    const W = 640, H = 220, P = { l: 44, r: 56, t: 16, b: 28 };
    const ys = pts.map(p => p.y);
    let min = Math.min(...ys), max = Math.max(...ys);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.15; min -= pad; max += pad;
    const t0 = +new Date(pts[0].x), t1 = +new Date(pts[pts.length - 1].x), span = t1 - t0 || 1;
    const X = p => P.l + (+new Date(p.x) - t0) / span * (W - P.l - P.r);
    const Y = v => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
    const area = `${line} L${X(pts[pts.length - 1]).toFixed(1)} ${H - P.b} L${X(pts[0]).toFixed(1)} ${H - P.b} Z`;
    const ticks = [0, 0.5, 1].map(f => min + (max - min) * f);
    const last = pts[pts.length - 1];
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Графік">
      ${ticks.map(v => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`).join('')}
      <path class="area" d="${area}"/>
      <path class="line" d="${line}"/>
      ${pts.length <= 40 ? pts.map(p => `<circle class="dot" cx="${X(p)}" cy="${Y(p.y)}" r="3.5"><title>${fmtShort(p.x)}: ${fmtNum(p.y)} ${unit}</title></circle>`).join('') : ''}
      <text class="last" x="${X(last) + 8}" y="${Y(last.y) + 4}">${fmtNum(last.y)} ${esc(unit)}</text>
      <text class="axis" x="${P.l}" y="${H - 8}">${fmtShort(pts[0].x)}</text>
      <text class="axis" x="${W - P.r}" y="${H - 8}" text-anchor="end">${fmtShort(last.x)}</text>
    </svg></div>`;
  }

  // ---------- Views ----------
  let minimized = false;
  function viewHome() {
    if (S.active && !minimized) return viewActive();
    const ws = workoutsSorted();
    const wk = weekStart();
    const wkDates = new Set([...S.workouts.map(w => w.date), ...Object.keys(S.checks).filter(d => S.checks[d])].filter(d => d >= wk && d <= today()));
    const thisWeek = wkDates.size;
    const weekDots = () => {
      const start = new Date(wk + 'T00:00');
      return '<span class="dots">' + Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        const date = d.toISOString().slice(0, 10);
        return `<i class="${wkDates.has(date) ? 'on' : ''}${date === today() ? ' now' : ''}"></i>`;
      }).join('') + '</span>';
    };
    const lastW = latestMeas('weight');
    const firstW = measSorted().find(m => m.weight != null);
    const wDiff = lastW && firstW && lastW !== firstW ? lastW.weight - firstW.weight : null;
    const lastWorkout = ws[0];
    const ago = lastWorkout ? daysBetween(lastWorkout.date, today()) : null;
    const nd = nextDay();
    const goal = num(S.profile.goal);

    return `
      <h1>${S.profile.name ? `Привіт, ${esc(S.profile.name)}` : 'Привіт'} 👋</h1>

      ${S.active ? `<div class="card accent row" style="margin-bottom:28px"><div class="body"><h3>Тренування триває · ${esc(S.active.dayName)}</h3><div class="muted small">Почато о ${new Date(S.active.startedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })} — дані збережені, можна продовжити будь-коли</div></div><span class="spacer"></span><button class="btn" data-act="resume">Продовжити</button></div>` : ''}

      <div class="grid stats">
        <div class="card stat"><div class="label">Цього тижня</div><div class="value">${thisWeek}<small> / ${PROGRAM.perWeek || 3}</small></div><div class="sub">${weekDots()}</div></div>
        <div class="card stat"><div class="label">Вага</div><div class="value">${lastW ? fmtNum(lastW.weight) : '—'} <small>кг</small></div><div class="sub">${wDiff != null ? `${wDiff > 0 ? '+' : ''}${fmtNum(wDiff)} кг від старту` : goal ? `ціль ${fmtNum(goal)} кг` : 'додай заміри'}</div></div>
        <div class="card stat"><div class="label">Всього</div><div class="value">${ws.length}</div><div class="sub">${plural(ws.length, 'тренування', 'тренування', 'тренувань')}</div></div>
        <div class="card stat"><div class="label">Остання</div><div class="value">${ago == null ? '—' : ago === 0 ? 'Сьогодні' : ago}</div><div class="sub">${ago == null ? 'ще не було' : ago === 0 ? fmtShort(lastWorkout.date) : `${plural(ago, 'день', 'дні', 'днів')} тому`}</div></div>
      </div>

      ${!S.active && nd ? `
      <div class="section">
        <div class="section-head"><h2>Наступне тренування</h2><span class="pill">${esc(PROGRAM.name)}</span></div>
        <div class="card accent">
          <div class="row"><h3>${esc(nd.label)} · тиждень ${esc(nd.weekNum)}</h3><span class="spacer"></span><button class="btn" data-act="start" data-day="${nd.id}">Почати тренування</button></div>
          <div class="muted small" style="margin-top:4px">${esc(nd.focus)}</div>
          <ul class="ex-lines">${nd.exercises.map(e => `<li><b>${esc(e.name)}</b><span>${e.sets}×${esc(e.reps)}</span></li>`).join('')}</ul>
        </div>
      </div>` : ''}

`;
  }

  function workoutCard(w, withDelete) {
    const vol = volume(w);
    return `<div class="card"><div class="list-item"><div class="body">
      <div class="row"><h3>${esc(w.dayName || 'Тренування')}</h3><span class="pill">${fmtDate(w.date)}</span>${w.durationMin ? `<span class="pill">${w.durationMin} хв</span>` : ''}${vol ? `<span class="pill accent">${fmtNum(vol)} кг об'єм</span>` : ''}</div>
      <ul class="ex-lines">${w.exercises.map(e => `<li><b>${esc(e.name)}</b><span>${esc(setsStr(e.sets))}</span></li>`).join('')}</ul>
      ${w.note ? `<div class="muted small" style="margin-top:6px">${esc(w.note)}</div>` : ''}
    </div>${withDelete === true ? `<button class="icon-btn" title="Видалити" data-act="del-workout" data-id="${w.id}">${ICON.trash}</button>` : ''}</div></div>`;
  }

  let progressEx = '';
  function viewStats() {
    const ws = workoutsSorted();
    const names = exerciseNames();
    if (!names.includes(progressEx)) progressEx = names[0] || '';
    const pts = progressEx ? S.workouts
      .map(w => { const e = w.exercises.find(x => x.name.trim() === progressEx); if (!e) return null; const best = Math.max(0, ...e.sets.map(s => num(s.w) || 0)); return best ? { x: w.date, y: best } : null; })
      .filter(Boolean).sort((a, b) => a.x.localeCompare(b.x)) : [];

    return `
      <h1>Аналітика</h1>
      <div class="section">
        <div class="section-head"><h2>Прогрес у вправі</h2>
          ${names.length ? `<select style="max-width:300px" data-act="progress-ex">${names.map(n => `<option ${n === progressEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
        </div>
        <div class="card">${names.length ? chart(pts, 'кг') + '<div class="muted small" style="margin-top:6px">Максимальна робоча вага за тренування</div>' : '<div class="empty small">Графік з’явиться після першого тренування</div>'}</div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Історія тренувань</h2><span class="muted small">${ws.length} ${plural(ws.length, 'запис', 'записи', 'записів')}</span></div>
        ${ws.length ? ws.map(w => workoutCard(w, true)).join('') : '<div class="empty">Тут з’являться завершені тренування</div>'}
      </div>`;
  }

  function viewActive() {
    const A = S.active;
    return `
      <div class="live-head">
        <div><div class="muted small">Тренування триває · <span class="clock" id="elapsed">0:00</span></div><h1 style="margin:2px 0 0">${esc(A.dayName)}</h1></div>
        <span class="spacer"></span>
        <input type="date" style="width:auto" value="${A.date}" data-act="active-date">
        <button class="btn close-live" title="Згорнути — тренування збережеться" data-act="minimize">✕</button>
      </div>

      <div class="section">
        ${A.exercises.map((e, ei) => {
          const prev = lastSetsFor(e.name);
          return `<div class="card ex-card">
            <div class="ex-top"><div class="body"><h3>${esc(e.name)}</h3>
              <div class="prev">${e.target ? `Ціль: ${esc(e.target)}${e.rest ? ` · відпочинок ${restLabel(e.rest)}` : ''}` : ''}${e.target && prev ? ' · ' : ''}${prev ? `Минулого разу (${fmtShort(prev.date)}): ${esc(setsStr(prev.sets))}` : ''}${e.note ? ` · ${esc(e.note)}` : ''}</div></div>
              <button class="icon-btn" title="Прибрати вправу" data-act="rm-ex" data-e="${ei}">${ICON.trash}</button></div>
            <table class="sets"><thead><tr><th>#</th><th>Вага, кг</th><th>Повтори</th><th></th></tr></thead><tbody>
            ${e.sets.map((s, si) => `<tr class="${s.done ? 'done' : ''}">
              <td>${si + 1}</td>
              <td><input type="text" inputmode="decimal" value="${esc(s.w)}" placeholder="${esc(prev?.sets[si]?.w ?? '0')}" data-set="w" data-e="${ei}" data-s="${si}"></td>
              <td><input type="text" inputmode="numeric" value="${esc(s.r)}" placeholder="${esc(prev?.sets[si]?.r ?? e.reps ?? '0')}" data-set="r" data-e="${ei}" data-s="${si}"></td>
              <td style="width:46px"><button class="check" title="Підхід виконано" data-act="done" data-e="${ei}" data-s="${si}">${ICON.check}</button></td>
            </tr>`).join('')}
            </tbody></table>
            <div class="row" style="margin-top:8px"><button class="btn sm" data-act="add-set" data-e="${ei}">+ Підхід</button>${e.sets.length > 1 ? `<button class="btn ghost sm" data-act="rm-set" data-e="${ei}">− Прибрати підхід</button>` : ''}</div>
          </div>`;
        }).join('')}

        <div class="section">
          <label class="field">Нотатки
            <textarea data-act="active-note" placeholder="Самопочуття, що вийшло, що змінити…">${esc(A.note)}</textarea>
          </label>
        </div>

        <div class="section row">
          <button class="btn primary" style="flex:1" data-act="finish">Завершити тренування</button>
          <button class="btn danger" data-act="cancel">Скасувати</button>
        </div>
      </div>

      <div class="rest" id="rest">
        <span class="muted small label">Відпочинок</span>
        <span class="time" id="rest-time">—</span>
        <span class="spacer"></span>
        ${[60, 90, 120, 180].map(s => `<button class="btn sm" data-act="rest" data-sec="${s}">${s < 120 ? s + 'с' : s / 60 + 'хв'}</button>`).join('')}
        <button class="btn ghost sm" data-act="rest" data-sec="0">Стоп</button>
      </div>`;
  }

  let progDay = null, openEx = null;
  function viewProgram() {
    const P = PROGRAM;
    const nd = nextDay();
    if (!P.days.some(d => d.id === progDay)) progDay = nd ? nd.id : (P.days[0] && P.days[0].id);
    const d = P.days.find(x => x.id === progDay);
    if (!d) return `<h1>${esc(P.name)}</h1><div class="empty">Програма ще складається</div>`;
    const week = P.weeks[d.weekIdx];

    return `
      <h1>${esc(P.name)}</h1>
      <div class="muted small" style="margin-top:-16px;margin-bottom:20px">${P.level ? esc(P.level) + ' рівень · ' : ''}${P.perWeek}× на тиждень · цикл ${P.weeks.length} ${plural(P.weeks.length, 'тиждень', 'тижні', 'тижнів')}${P.updated ? ` · оновлено ${fmtDate(P.updated)}` : ''}</div>

      <div class="weeks">${P.weeks.map((w, wi) => `
        <button class="week-btn ${wi === d.weekIdx ? 'on' : ''}" data-act="prog-week" data-w="${wi}">
          <span class="num">Тиждень ${esc(w.num)}</span>${esc(w.label)}
          ${nd && nd.weekIdx === wi ? '<i class="dot-next"></i>' : ''}
        </button>`).join('')}
      </div>

      <div class="daytabs">${week.days.map(x => `
        <button class="daytab ${x.id === progDay ? 'on' : ''}" data-act="prog-day" data-day="${x.id}">
          <span>${esc(x.label)}</span>
          ${nd && nd.id === x.id ? '<i class="dot-next"></i>' : ''}
        </button>`).join('')}
      </div>

      <div class="card">
        <div class="row">
          <div class="body"><h3 style="font-size:17px">${esc(d.label)} · тиждень ${esc(week.num)}</h3><div class="muted small">${esc(d.focus)}</div></div>
          <span class="spacer"></span>
          ${nd && nd.id === d.id ? '<span class="pill accent">Наступне</span>' : ''}
          <button class="btn primary sm" data-act="start" data-day="${d.id}">Почати</button>
        </div>
        <ol class="prog-list">${d.exercises.map(e => {
          const info = EXERCISES[e.name];
          const open = openEx === e.name;
          return `
          <li class="${open ? 'open' : ''} ${e.anchor ? 'anchor' : ''}">
            <button class="ex-row" data-act="ex-info" data-name="${esc(e.name)}" ${info ? '' : 'disabled'}>
              <div class="row"><b>${esc(e.name)}</b>${e.anchor ? '<span class="pill accent">базовий</span>' : ''}<span class="spacer"></span><span class="pill">${e.sets}×${esc(e.reps)}</span><span class="pill">${restLabel(e.rest)}</span>${info ? `<span class="chev">${open ? '▴' : '▾'}</span>` : ''}</div>
              ${e.note ? `<div class="muted small">${esc(e.note)}</div>` : ''}
            </button>
            ${open && info ? `
            <div class="ex-info">
              <div class="info-block"><div class="label">Цільові м’язи</div><div>${esc(info.muscles)}</div></div>
              ${info.how && info.how.length ? `<div class="info-block"><div class="label">Як робити</div><ol class="how">${info.how.map(h => `<li>${esc(h)}</li>`).join('')}</ol></div>` : ''}
              ${info.alts && info.alts.length ? `<div class="info-block"><div class="label">Чим замінити</div><div class="alts">${info.alts.map(a => `<span class="pill">${esc(a)}</span>`).join('')}</div></div>` : ''}
            </div>` : ''}
          </li>`;
        }).join('')}
        </ol>
      </div>

`;
  }

  const restLabel = sec => sec % 60 === 0 ? `${sec / 60} хв` : sec > 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} хв` : `${sec} с`;

  let bodyMetric = 'weight';
  function viewBody() {
    const ms = measSorted();
    const last = ms[ms.length - 1];
    const metric = MEAS.find(m => m[0] === bodyMetric) || MEAS[0];
    const pts = ms.filter(m => m[metric[0]] != null).map(m => ({ x: m.date, y: m[metric[0]] }));
    const h = num(S.profile.height);
    const lw = latestMeas('weight');
    const bmi = h && lw ? lw.weight / ((h / 100) ** 2) : null;

    const summary = MEAS.map(([k, label, unit]) => {
      const withVal = ms.filter(m => m[k] != null);
      if (!withVal.length) return '';
      const cur = withVal[withVal.length - 1][k];
      const prev = withVal.length > 1 ? withVal[withVal.length - 2][k] : null;
      const d = prev != null ? cur - prev : null;
      return `<div class="card stat"><div class="label">${label}</div><div class="value">${fmtNum(cur)} <small>${unit}</small></div><div class="sub diff">${d != null && d !== 0 ? `${d > 0 ? '▲ +' : '▼ '}${fmtNum(d)} ${unit}` : d === 0 ? 'без змін' : 'перший запис'}</div></div>`;
    }).join('');

    return `
      <h1>Параметри тіла</h1>
      <div class="card">
        <h2>Новий замір</h2>
        <form id="meas-form" class="form-grid">
          <label class="field">Дата<input type="date" name="date" value="${today()}" required></label>
          ${MEAS.map(([k, label, unit]) => `<label class="field">${label}, ${unit}<input type="text" inputmode="decimal" name="${k}" placeholder="${last && last[k] != null ? fmtNum(last[k]) : ''}"></label>`).join('')}
          <label class="field" style="grid-column:1/-1">Нотатка<input type="text" name="note" placeholder="Напр.: зранку натще"></label>
          <div style="grid-column:1/-1"><button class="btn primary" type="submit">Зберегти замір</button></div>
        </form>
      </div>

      ${ms.length ? `
      <div class="section">
        <div class="section-head"><h2>Поточні показники</h2>${bmi ? `<span class="pill">ІМТ ${fmtNum(bmi)}</span>` : ''}</div>
        <div class="grid stats">${summary}</div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Динаміка</h2>
          <select style="max-width:200px" data-act="body-metric">${MEAS.map(([k, l]) => `<option value="${k}" ${k === metric[0] ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="card">${chart(pts, metric[2])}</div>
      </div>

      <div class="section">
        <h2>Історія замірів</h2>
        <div class="card table-wrap"><table class="hist">
          <thead><tr><th>Дата</th>${MEAS.map(([, l, u]) => `<th>${l}, ${u}</th>`).join('')}<th></th></tr></thead>
          <tbody>${[...ms].reverse().map(m => `<tr><td>${fmtDate(m.date)}${m.note ? `<div class="muted small">${esc(m.note)}</div>` : ''}</td>${MEAS.map(([k]) => `<td>${fmtNum(m[k])}</td>`).join('')}<td><button class="icon-btn" title="Видалити" data-act="del-meas" data-id="${m.id}">${ICON.trash}</button></td></tr>`).join('')}</tbody>
        </table></div>
      </div>` : '<div class="section empty">Додай перший замір, щоб бачити динаміку</div>'}`;
  }

  function viewProfile() {
    const p = S.profile;
    return `
      <h1>Профіль</h1>
      <div class="card">
        <div class="form-grid">
          <label class="field" style="grid-column:span 2">Ім’я<input type="text" value="${esc(p.name)}" data-profile="name"></label>
          <label class="field">Зріст, см<input type="text" inputmode="decimal" value="${esc(p.height)}" data-profile="height"></label>
          <label class="field">Цільова вага, кг<input type="text" inputmode="decimal" value="${esc(p.goal)}" data-profile="goal"></label>
        </div>
      </div>

      <div class="section">
        <h2>Демо-дані</h2>
        <div class="card">
          <p class="muted small" style="margin-top:0">Заповнює трекер вигаданими тренуваннями й замірами за 6 тижнів, щоб подивитися, як виглядають графіки та історія. Це не твої результати — перед справжнім стартом натисни «Стерти демо».</p>
          <div class="row">
            <button class="btn" data-act="demo">Заповнити демо-даними</button>
            <button class="btn ghost" data-act="wipe">Стерти демо</button>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Дані</h2>
        <div class="card">
          <p class="muted small" style="margin-top:0">Усе зберігається лише в цьому браузері. Регулярно роби резервну копію, а щоб перенести дані на інший пристрій, імпортуй файл там.</p>
          <div class="row">
            <button class="btn" data-act="export">Експорт (JSON)</button>
            <label class="btn">Імпорт<input type="file" accept="application/json,.json" id="import" hidden></label>
            <span class="spacer"></span>
            <button class="btn danger" data-act="wipe">Стерти все</button>
          </div>
        </div>
      </div>`;
  }

  // ---------- Render ----------
  function render() {
    document.getElementById('tabs').innerHTML = TABS.map(([id, label]) =>
      `<button class="tab ${S.tab === id ? 'on' : ''}" data-act="go" data-tab="${id}">${ICON[id]}<span>${label}</span></button>`).join('');
    const nd = nextDay();
    document.getElementById('side-foot').innerHTML = `
      <div class="side-label">Програма</div>
      <div class="side-prog"><b>${esc(PROGRAM.name)}</b>${nd ? `Далі: тиждень ${esc(nd.weekNum)} · ${esc(nd.label)}` : ''}</div>`;
    const views = { home: viewHome, program: viewProgram, stats: viewStats, body: viewBody, profile: viewProfile };
    app.innerHTML = (views[S.tab] || viewHome)();
    tick();
  }

  // ---------- Active workout ----------
  function startWorkout(dayId) {
    if (S.active && !confirm('Уже є незавершене тренування. Почати нове замість нього?')) return;
    const day = PROGRAM.days.find(d => d.id === dayId);
    S.active = {
      date: today(),
      startedAt: Date.now(),
      dayId: day ? day.id : null,
      dayName: day ? `${day.label} · тиждень ${day.weekNum}` : 'Тренування',
      note: '',
      exercises: day ? day.exercises.map(e => newActiveEx(e)) : [],
    };
    S.tab = 'home'; minimized = false;
    save(); render(); scrollTo(0, 0);
  }

  function newActiveEx({ name, sets = 3, reps = '', rest = 90, note = '', anchor = false }) {
    const prev = lastSetsFor(name);
    const n = Math.max(1, parseInt(sets, 10) || 3);
    return {
      name: name.trim(),
      target: reps ? `${n}×${reps}` : '',
      anchor: !!anchor,
      reps: String(reps).match(/\d+/)?.[0] || '',
      rest,
      note,
      sets: Array.from({ length: n }, (_, i) => ({ w: prev?.sets[i]?.w ?? prev?.sets[prev.sets.length - 1]?.w ?? '', r: '', done: false })),
    };
  }

  function finishWorkout() {
    const A = S.active;
    const exercises = A.exercises
      .map(e => ({ name: e.name, sets: e.sets.filter(s => s.done || num(s.r) != null || num(s.w) != null).map(s => ({ w: num(s.w) ?? 0, r: num(s.r) ?? (num(e.reps) ?? 0) })) }))
      .filter(e => e.sets.length);
    if (!exercises.length) {
      toast('Внеси хоча б один підхід — або натисни «Скасувати»');
      return;
    }
    S.workouts.push({
      id: uid(), date: A.date, startedAt: A.startedAt, dayId: A.dayId, dayName: A.dayName,
      durationMin: Math.max(1, Math.round((Date.now() - A.startedAt) / 60000)),
      note: A.note.trim(), exercises,
    });
    S.active = null; restEnd = 0; minimized = false;
    save(); render(); scrollTo(0, 0);
    toast('Тренування збережено 💪');
  }

  // ---------- Демо-дані ----------
  function loadDemo() {
    const days = PROGRAM.days;
    if (!days.length) return;
    // стартові робочі ваги для кожної вправи
    const base = {
      'Жим штанги лежачи': 45, 'Присідання зі штангою': 70, 'Станова тяга': 85, 'Тяга штанги в нахилі': 50,
      'Жим ногами': 110, 'Румунська тяга зі штангою': 55, 'Тяга тазом зі штангою': 70, 'Присід у Смітті': 55,
      'Жим штанги стоячи': 30, 'Жим гантелей стоячи': 14, 'Жим гантелей на похилій лаві': 18,
      'Тяга нижнього блоку сидячи': 45, 'Тяга верхнього блоку широким хватом': 50, 'Підтягування з обтяженням': 5,
      'Віджимання на брусах': 5, 'Болгарські випади': 16, 'Випади з гантелями в ходьбі': 14,
      'Згинання ніг лежачи': 35, 'Розгинання ніг': 40, 'Розгинання ніг у тренажері': 40,
      'Підйоми на носки стоячи': 60, 'Підйоми на носки сидячи': 40, 'Face pull на блоці': 20,
      'Розгинання рук на блоці': 25, 'Французький жим лежачи': 20, 'Молоткові згинання': 12,
      'Згинання рук з EZ-грифом': 20, 'Розведення гантелей стоячи': 8,
    };

    const step = w => w >= 40 ? 2.5 : w >= 10 ? 2 : 1;
    const repsOf = r => { const m = String(r).match(/(\d+)(?:\D+(\d+))?/); return m ? [+m[1], +(m[2] || m[1])] : [10, 10]; };

    const workouts = [];
    const start = new Date(today() + 'T00:00');
    start.setDate(start.getDate() - 37);
    let di = 0;
    for (let week = 0; week < 6; week++) {
      for (const offset of [0, 1, 3, 4]) {              // Пн, Вт, Чт, Пт
        if (week === 5 && offset > 1) continue;          // поточний тиждень ще не завершено
        const dt = new Date(start);
        dt.setDate(start.getDate() + week * 7 + offset);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        const date = dt.toISOString().slice(0, 10);
        if (date > today()) continue;
        const day = days[di % days.length]; di++;
        workouts.push({
          id: uid(), date, startedAt: +dt + 18 * 36e5, dayId: day.id, dayName: day.name,
          durationMin: 52 + ((week + di) % 4) * 4,
          note: week === 2 && offset === 0 ? 'Легше спалося, присід пішов добре' : '',
          exercises: day.exercises.map(e => {
            const w0 = base[e.name] ?? 10;
            const [lo, hi] = repsOf(e.reps);
            const w = w0 ? Math.round((w0 + step(w0) * week) * 2) / 2 : 0;
            return {
              name: e.name,
              sets: Array.from({ length: e.sets }, (_, i) => ({
                w,
                r: Math.max(lo, hi - (i > 1 ? 1 : 0) - (week % 2 === 0 ? 1 : 0)),
              })),
            };
          }),
        });
      }
    }

    const meas = [];
    for (let week = 0; week <= 6; week++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + week * 7);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      const date = dt.toISOString().slice(0, 10);
      if (date > today()) continue;
      meas.push({
        id: uid(), date, note: week === 0 ? 'Старт' : '',
        weight: Math.round((68 - week * 0.55 + (week % 2 ? 0.2 : -0.1)) * 10) / 10,
        bodyFat: Math.round((28 - week * 0.4) * 10) / 10,
        chest: Math.round((92 - week * 0.2) * 10) / 10,
        waist: Math.round((74 - week * 0.5) * 10) / 10,
        hips: Math.round((99 - week * 0.35) * 10) / 10,
        arm: Math.round((28 + week * 0.1) * 10) / 10,
        thigh: Math.round((57 - week * 0.15) * 10) / 10,
      });
    }

    S.workouts = workouts;
    S.measurements = meas;
    S.profile = Object.assign({ name: '', height: '168', goal: '62' }, S.profile.height ? S.profile : {});
    S.active = null;
  }

  // ---------- Timers ----------
  let restEnd = 0, rang = false;
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function tick() {
    const el = document.getElementById('elapsed');
    if (el && S.active) el.textContent = mmss(Math.floor((Date.now() - S.active.startedAt) / 1000));
    const rt = document.getElementById('rest-time');
    if (rt) {
      const left = Math.ceil((restEnd - Date.now()) / 1000);
      const box = document.getElementById('rest');
      if (restEnd && left > 0) { rt.textContent = mmss(left); box.classList.remove('ring'); }
      else if (restEnd) {
        rt.textContent = '0:00'; box.classList.add('ring');
        if (!rang) { rang = true; navigator.vibrate?.([200, 100, 200]); beep(); }
      } else { rt.textContent = '—'; box.classList.remove('ring'); }
    }
  }
  setInterval(tick, 250);

  function startRest(sec) { restEnd = sec ? Date.now() + sec * 1000 : 0; rang = false; tick(); }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.start(); o.stop(ctx.currentTime + 0.6);
    } catch (e) { /* no audio */ }
  }

  // ---------- Events ----------
  
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    const { act } = t.dataset;
    const A = S.active;
    switch (act) {
      case 'prog-day': progDay = t.dataset.day; openEx = null; render(); break;
      case 'prog-week': { const w = PROGRAM.weeks[+t.dataset.w]; if (w && w.days[0]) { progDay = w.days[0].id; openEx = null; render(); } break; }
      case 'ex-info': openEx = openEx === t.dataset.name ? null : t.dataset.name; render(); break;
      case 'minimize': minimized = true; S.tab = 'home'; render(); scrollTo(0, 0); break;
      case 'resume': minimized = false; S.tab = 'home'; render(); scrollTo(0, 0); break;
      case 'go': S.tab = t.dataset.tab; save(); render(); scrollTo(0, 0); break;
      case 'start': startWorkout(t.dataset.day); break;
      case 'done': {
        const s = A.exercises[+t.dataset.e].sets[+t.dataset.s];
        s.done = !s.done;
        if (s.done) {
          const row = t.closest('tr');
          // fill empty fields from placeholders so the set gets recorded
          row.querySelectorAll('input').forEach(inp => { if (!inp.value && inp.placeholder && inp.placeholder !== '0') { inp.value = inp.placeholder; s[inp.dataset.set] = inp.value; } });
          startRest(A.exercises[+t.dataset.e].rest || 90);
        }
        t.closest('tr').classList.toggle('done', s.done);
        save(); break;
      }
      case 'add-set': {
        const ex = A.exercises[+t.dataset.e];
        const last = ex.sets[ex.sets.length - 1];
        ex.sets.push({ w: last ? last.w : '', r: '', done: false });
        save(); render(); break;
      }
      case 'rm-set': A.exercises[+t.dataset.e].sets.pop(); save(); render(); break;
      case 'rm-ex': if (confirm('Прибрати цю вправу з тренування?')) { A.exercises.splice(+t.dataset.e, 1); save(); render(); } break;
      case 'finish': finishWorkout(); break;
      case 'cancel': if (confirm('Скасувати тренування? Внесені дані буде втрачено.')) { S.active = null; restEnd = 0; minimized = false; save(); render(); } break;
      case 'rest': startRest(+t.dataset.sec); break;
      case 'del-workout': if (confirm('Видалити це тренування?')) { S.workouts = S.workouts.filter(w => w.id !== t.dataset.id); save(); render(); } break;
      case 'del-meas': if (confirm('Видалити цей замір?')) { S.measurements = S.measurements.filter(m => m.id !== t.dataset.id); save(); render(); } break;
      case 'demo': {
        if ((S.workouts.length || S.measurements.length) && !confirm('Замінити поточні записи демо-даними?')) break;
        loadDemo(); save(); S.tab = 'stats'; render(); scrollTo(0, 0);
        toast('Демо-дані завантажено');
        break;
      }
      case 'export': {
        const { tab, program, ...data } = S;
        const blob = new Blob([JSON.stringify({ app: 'gym-tracker', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `gym-tracker-${today()}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case 'wipe': if (confirm('Стерти всі дані? Цю дію не можна скасувати.') && confirm('Точно? Спершу краще зробити експорт.')) { S = fresh(); save(); render(); } break;
    }
  });

  document.addEventListener('input', e => {
    const t = e.target, d = t.dataset;
    if (d.set && S.active) { S.active.exercises[+d.e].sets[+d.s][d.set] = t.value; save(); }
    else if (d.act === 'active-note') { S.active.note = t.value; save(); }
    else if (d.profile) { S.profile[d.profile] = t.value; save(); }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.act === 'progress-ex') { progressEx = t.value; render(); }
    else if (t.dataset.act === 'body-metric') { bodyMetric = t.value; render(); }
    else if (t.dataset.act === 'active-date') { S.active.date = t.value || today(); save(); }
    else if (t.id === 'import' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!Array.isArray(data.workouts)) throw new Error('bad');
          if (!confirm('Імпорт замінить усі поточні дані. Продовжити?')) return;
          const { app: _a, version: _v, exportedAt: _e, program: _p, ...rest } = data;
          S = Object.assign(fresh(), rest, { tab: 'home' });
          save(); render(); toast('Дані імпортовано');
        } catch (err) { alert('Не вдалося прочитати файл. Перевір, що це експорт із цього трекера.'); }
      };
      r.readAsText(t.files[0]);
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'meas-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const m = { id: uid(), date: f.get('date') || today(), note: String(f.get('note') || '').trim() };
    let any = false;
    for (const [k] of MEAS) { const v = num(f.get(k)); m[k] = v; if (v != null) any = true; }
    if (!any) { toast('Введи хоча б один показник'); return; }
    S.measurements.push(m);
    save(); render(); toast('Замір збережено');
  });

  render();
})();
