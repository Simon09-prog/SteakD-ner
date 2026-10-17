/* Krillion — the daily trivia dive. Vanilla JS, no build step. */
(() => {
  'use strict';

  /* ───────────────────────────── Constants ───────────────────────────── */

  const PROMPTS = window.KRILLION_PROMPTS || [];
  const PACKS = window.KRILLION_PACKS || [];
  const PROMPT_BY_ID = new Map(PROMPTS.map((p) => [p.id, p]));
  const PACK_BY_ID = new Map(PACKS.map((p) => [p.id, p]));

  const ROUNDS = 7;
  const ANSWER_MS = 40000;
  const ANSWER_SECS = ANSWER_MS / 1000;
  const PREVIEW_MS = 3000;
  const M_PER_POINT = 10;
  const MAX_DEPTH = ROUNDS * 100 * M_PER_POINT; // 7,000 m — the trench floor
  const EPOCH = Date.UTC(2026, 6, 16); // Daily Dive #1
  const DAY_MS = 864e5;

  const TIERS = {
    krillion: { name: 'Eins zu einer Million', pts: 100, emoji: '🦐', blurb: 'Die seltenste Antwort auf dem ganzen Bogen. Legendär.' },
    deep: { name: 'Tiefgang', pts: 85, emoji: '🦑', blurb: 'So tief ist kaum jemand getaucht.' },
    rare: { name: 'Rarität', pts: 60, emoji: '🐠', blurb: 'Weit abseits vom Riff.' },
    schooler: { name: 'Mitschwimmer', pts: 30, emoji: '🐟', blurb: 'Du schwimmst in einem ordentlichen Schwarm.' },
    clever: { name: 'Neunmalklug', pts: 15, emoji: '🤓', blurb: 'Schlau gedacht. Wir sehen, was du da gemacht hast.' },
    plankton: { name: 'Plankton', pts: 10, emoji: '🫧', blurb: 'Hier treiben alle.' },
    miss: { name: 'Verpasst', pts: 0, emoji: '⬛', blurb: 'Diesmal nichts auf dem Bogen.' },
  };
  const TIER_ORDER = ['krillion', 'deep', 'rare', 'schooler', 'clever', 'plankton'];
  const SHEET_CODES = [['p', 'plankton'], ['c', 'clever'], ['s', 'schooler'], ['r', 'rare'], ['d', 'deep'], ['k', 'krillion']];

  const ZONES = [
    { name: 'Sonnenlichtzone', short: 'Licht', from: 0, to: 200, flavor: 'Du bist mit den Meeresschildkröten herumgedümpelt.' },
    { name: 'Dämmerzone', short: 'Zwielicht', from: 200, to: 1000, flavor: 'Laternenfische haben dir im Halbdunkel zugeblinkt.' },
    { name: 'Mitternachtszone', short: 'Nacht', from: 1000, to: 4000, flavor: 'Du hast es bis ins Revier der Anglerfische geschafft.' },
    { name: 'Abyssalzone', short: 'Abyssal', from: 4000, to: 6000, flavor: 'Dumbo-Oktopusse haben dir zugewinkt.' },
    { name: 'Hadalzone', short: 'Hadal', from: 6000, to: MAX_DEPTH, flavor: 'Scheibenbäuche, so weit das Auge reicht — die tiefsten Gräben der Erde.' },
  ];

  const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────────────────────── Utilities ───────────────────────────── */

  const $ = (sel, root = document) => root.querySelector(sel);
  const LOCALE = 'de-DE';
  const fmt = (n) => Math.round(n).toLocaleString(LOCALE);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('krillion:' + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('krillion:' + key, JSON.stringify(value));
      } catch (e) { /* storage unavailable — play on without saving */ }
    },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rnd = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function zoneFor(depth) {
    return ZONES.find((z) => depth < z.to) || ZONES[ZONES.length - 1];
  }

  /* ─────────────────────────── Answer matching ─────────────────────────── */

  const ROMANISH = /^(?:\d+|i{1,3}|iv|vi{0,3}|ix|x)$/;
  const ARTICLES = new Set(['the', 'a', 'an', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen']);

  function tokens(text, prompt, foldAdjectives = false) {
    let t = String(text)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/ß/g, 'ss').replace(/[æ]/g, 'ae').replace(/[œ]/g, 'oe').replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l')
      .replace(/&/g, ' und ')
      .replace(/['’‘`´ʻ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    // "Aegypten" and "Ägypten" are the same country; spelling games keep their exact letters.
    if (!prompt.strict) t = t.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
    // "&", "and" and "und" all read the same, so "Romeo & Julia" meets "Romeo und Julia".
    let words = t ? t.split(' ').map((w) => (w === 'and' ? 'und' : w)) : [];
    if (words.length > 1 && ARTICLES.has(words[0])) words.shift();
    if (prompt.strip) {
      if (words.length > 1) {
        const kept = words.filter((w) => !prompt.strip.includes(w));
        if (kept.length) words = kept;
      }
      // German compounds glue the filler on: "Namibwüste", "Erzgebirge".
      const last = words.length - 1;
      const suffix = last >= 0 && prompt.strip.find((s) => words[last].endsWith(s) && words[last].length >= s.length + 3);
      if (suffix) words[last] = words[last].slice(0, -suffix.length);
    }
    // German adjectives bend with their article: "Schwarzes Meer" and "das Schwarze Meer" fold
    // to one form. Only words before the noun are touched, and only as a second matching pass,
    // so spellings like "Genfer See" / "Genfersee" still meet on the first one.
    if (foldAdjectives) {
      words = words.map((w, i) => (i < words.length - 1 && w.length > 4 && /(?:er|es|en|em)$/.test(w) ? w.slice(0, -1) : w));
    }
    return words;
  }

  function singular(w) {
    if (w.length <= 3) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(?:x|z|ch|sh|ss)es$/.test(w)) return w.slice(0, -2);
    if (/(?:ss|us|is)$/.test(w)) return w;
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function keyOf(text, prompt, foldAdjectives = false) {
    const words = tokens(text, prompt, foldAdjectives);
    if (!words.length) return { key: '', tail: '' };
    if (!prompt.strict) words[words.length - 1] = singular(words[words.length - 1]);
    return { key: words.join(''), tail: words[words.length - 1] };
  }

  const sheetCache = new Map();

  function sheetFor(prompt) {
    if (sheetCache.has(prompt.id)) return sheetCache.get(prompt.id);
    const entries = [];
    for (const [code, tier] of SHEET_CODES) {
      if (!prompt[code]) continue;
      for (const raw of prompt[code].split(';')) {
        const item = raw.trim();
        if (!item) continue;
        const [names, note] = item.split('::');
        const aliases = names.split('|').map((s) => s.trim()).filter(Boolean);
        entries.push({ label: aliases[0], aliases, tier, note: note ? note.trim() : '' });
      }
    }
    const index = new Map();
    const adjIndex = new Map();
    for (const entry of entries) {
      for (const alias of entry.aliases) {
        const { key, tail } = keyOf(alias, prompt);
        if (key && !index.has(key)) index.set(key, { entry, tail });
        if (!prompt.strict) {
          const folded = keyOf(alias, prompt, true).key;
          if (folded && !adjIndex.has(folded)) adjIndex.set(folded, entry);
        }
      }
    }
    const sheet = { entries, index, adjIndex };
    sheetCache.set(prompt.id, sheet);
    return sheet;
  }

  // Optimal-string-alignment distance with an early exit once `max` is exceeded.
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length];
  }

  const digitsOf = (s) => s.replace(/\D/g, '');

  // German plurals differ from the singular only at the end ("Kartoffeln", "Bohne"/"Bohnen"),
  // so those endings count as the same answer straight away.
  const PLURAL_ENDINGS = ['en', 'n', 'e', 's', 'er'];

  function keyVariants(key, prompt) {
    if (prompt.strict || key.length < 4) return [key];
    const out = [key, ...PLURAL_ENDINGS.map((s) => key + s)];
    for (const s of PLURAL_ENDINGS) if (key.endsWith(s) && key.length - s.length >= 3) out.push(key.slice(0, -s.length));
    return out;
  }

  function matchAnswer(input, prompt) {
    const sheet = sheetFor(prompt);
    const { key } = keyOf(input, prompt);
    if (!key) return null;
    for (const k of keyVariants(key, prompt)) {
      const hit = sheet.index.get(k);
      if (hit) return { entry: hit.entry, fuzzy: k !== key };
    }
    if (!prompt.strict) {
      const folded = keyOf(input, prompt, true).key;
      for (const k of keyVariants(folded, prompt)) {
        const entry = sheet.adjIndex.get(k);
        if (entry) return { entry, fuzzy: true };
      }
    }
    return null;
  }

  // Near misses are never scored silently: they come back as "Meintest du …?" choices.
  function suggestAnswers(input, prompt, limit = 3) {
    const sheet = sheetFor(prompt);
    const { key, tail } = keyOf(input, prompt);
    if (key.length < 3) return [];
    const maxD = prompt.strict ? (key.length >= 5 ? 1 : 0) : key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3;
    const scores = new Map();
    for (const [k, { entry, tail: candTail }] of sheet.index) {
      let score = null;
      const sameNumbers = digitsOf(k) === digitsOf(key) // "Toy Story 6" never hints at "Toy Story 5"
        && !((ROMANISH.test(tail) || ROMANISH.test(candTail)) && tail !== candTail); // nor "Richard I" at "Richard II"
      if (maxD > 0 && sameNumbers && Math.abs(k.length - key.length) <= maxD) {
        const d = editDistance(key, k, maxD);
        if (d <= maxD) score = d;
      }
      // A recognisable start of a longer answer: "Monster" → "Die Monster AG", "Bernhard" → "Bernhardiner".
      if (score === null && !prompt.strict && key.length >= 4 && (k.startsWith(key) || (key.length >= 5 && k.includes(key)))) {
        score = maxD + 1 + (k.length - key.length) / 100;
      }
      if (score !== null && !(scores.get(entry) <= score)) scores.set(entry, score);
    }
    return [...scores].sort((a, b) => a[1] - b[1]).slice(0, limit).map(([entry]) => entry);
  }

  /* ───────────────────────────── Daily dive ───────────────────────────── */

  function dayStamp(date = new Date()) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function diveNumber(date = new Date()) {
    return Math.max(1, Math.floor((dayStamp(date) - EPOCH) / DAY_MS) + 1);
  }

  function dateOfDive(n) {
    const t = new Date(EPOCH + (n - 1) * DAY_MS);
    return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }

  const DAILY_POOL = PROMPTS.map((p) => p.id).sort();
  const cyclePerms = new Map();

  function cyclePerm(c) {
    if (!cyclePerms.has(c)) cyclePerms.set(c, shuffle(DAILY_POOL, mulberry32(0x4b52494c ^ Math.imul(c + 1, 2654435761))));
    return cyclePerms.get(c);
  }

  // One endless, seeded sequence of shuffled decks; dive N takes the next seven cards.
  function dailyPromptIds(n) {
    const L = DAILY_POOL.length;
    const out = [];
    for (let i = (n - 1) * ROUNDS; out.length < Math.min(ROUNDS, L); i++) {
      const id = cyclePerm(Math.floor(i / L))[i % L];
      if (!out.includes(id)) out.push(id);
    }
    return out;
  }

  function msUntilNextDive() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }

  function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    return `${h}:${m}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ────────────────────────────── Ocean FX ────────────────────────────── */

  const SEA_STOPS = [
    { d: 0, top: [26, 163, 204], bot: [10, 79, 126] },
    { d: 200, top: [19, 116, 176], bot: [9, 55, 104] },
    { d: 1000, top: [11, 58, 116], bot: [6, 33, 74] },
    { d: 4000, top: [6, 26, 62], bot: [3, 12, 34] },
    { d: 6000, top: [4, 15, 40], bot: [2, 6, 21] },
    { d: MAX_DEPTH, top: [2, 8, 26], bot: [1, 3, 10] },
  ];

  const ocean = {
    depth: 0,
    rush: 0,
    raf: 0,
    anim: null,

    set(depth) {
      this.depth = depth;
      let i = 0;
      while (i < SEA_STOPS.length - 2 && depth > SEA_STOPS[i + 1].d) i++;
      const a = SEA_STOPS[i];
      const b = SEA_STOPS[i + 1];
      const t = clamp((depth - a.d) / (b.d - a.d), 0, 1);
      const mix = (x, y) => x.map((v, k) => Math.round(v + (y[k] - v) * t)).join(',');
      const root = document.documentElement.style;
      root.setProperty('--sea-top', `rgb(${mix(a.top, b.top)})`);
      root.setProperty('--sea-bot', `rgb(${mix(a.bot, b.bot)})`);
      root.setProperty('--rays', String(clamp(1 - depth / 700, 0, 1)));
      document.dispatchEvent(new CustomEvent('krillion:depth', { detail: depth }));
    },

    // Animate from the current depth to `target`; onStep receives every intermediate depth.
    dive(target, onStep, duration = 1400) {
      cancelAnimationFrame(this.raf);
      const from = this.depth;
      if (REDUCED_MOTION || from === target || duration <= 0) {
        this.set(target);
        if (onStep) onStep(target);
        return;
      }
      const start = performance.now();
      const step = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const d = from + (target - from) * e;
        this.rush = Math.sin(t * Math.PI);
        this.set(d);
        if (onStep) onStep(d);
        if (t < 1) this.raf = requestAnimationFrame(step);
        else this.rush = 0;
      };
      this.raf = requestAnimationFrame(step);
    },
  };

  function startMarineSnow() {
    const canvas = $('#snow');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let flakes = [];

    const make = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.12 + Math.random() * 0.35,
      vx: (Math.random() - 0.5) * 0.12,
      a: 0.15 + Math.random() * 0.45,
      glow: Math.random(),
      phase: Math.random() * Math.PI * 2,
      hue: [178, 190, 200, 300][Math.floor(Math.random() * 4)],
    });

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp((w * h) / 12000, 36, 140));
      flakes = Array.from({ length: count }, () => make(true));
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, w, h);
      const deep = clamp(ocean.depth / MAX_DEPTH, 0, 1);
      const lumeShare = clamp((ocean.depth - 600) / 3000, 0, 0.35);
      for (const f of flakes) {
        if (!REDUCED_MOTION) {
          f.y -= f.vy * (1 + ocean.rush * 9);
          f.x += f.vx + Math.sin(time / 2400 + f.phase) * 0.08;
          if (f.y < -10) Object.assign(f, make(false));
        }
        const lit = f.glow < lumeShare;
        if (lit) {
          const pulse = 0.55 + 0.45 * Math.sin(time / 700 + f.phase * 3);
          ctx.fillStyle = `hsla(${f.hue}, 95%, 70%, ${0.25 + 0.6 * pulse})`;
          ctx.shadowColor = `hsla(${f.hue}, 100%, 65%, 0.9)`;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r + 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = `rgba(220, 240, 255, ${f.a * (0.55 + deep * 0.45)})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Browsers pause rAF in background tabs, so a single self-scheduling loop is enough.
    const loop = (time) => {
      draw(time);
      requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    if (REDUCED_MOTION) {
      document.addEventListener('krillion:depth', () => draw(0));
      draw(0);
    } else {
      requestAnimationFrame(loop);
    }
  }

  /* ───────────────────────────── Persistence ───────────────────────────── */

  const dailyKey = (n) => `daily:${n}`;

  function loadDaily(n) {
    return store.get(dailyKey(n), null);
  }

  function saveDaily(game) {
    store.set(dailyKey(game.diveNo), { ids: game.ids, results: game.results, done: game.done });
  }

  function pushLog(game) {
    const log = store.get('log', []);
    log.unshift({
      mode: game.mode,
      title: game.title,
      diveNo: game.diveNo || null,
      date: new Date().toISOString(),
      points: totalPoints(game.results),
      tiers: game.results.map((r) => r.tier),
    });
    store.set('log', log.slice(0, 400));
  }

  const totalPoints = (results) => results.reduce((sum, r) => sum + (r.pts || 0), 0);
  const emojiRow = (results) => results.map((r) => TIERS[r.tier || 'miss'].emoji).join('');

  /* ───────────────────────────── Game state ───────────────────────────── */

  let game = null;
  let timers = [];
  let countdownTimer = 0;

  function clearTimers() {
    timers.forEach((t) => (t.cancel ? t.cancel() : clearTimeout(t)));
    timers = [];
    clearInterval(countdownTimer);
  }

  function newGame(mode, opts = {}) {
    if (mode === 'daily') {
      const diveNo = diveNumber();
      const saved = loadDaily(diveNo);
      const ids = saved && saved.ids ? saved.ids : dailyPromptIds(diveNo);
      const results = saved && saved.results ? saved.results.map((r) => (r.pending ? { id: r.id, tier: 'miss', pts: 0, answer: '', tries: r.tries || [] } : r)) : [];
      return { mode, diveNo, title: `Tagestauchgang #${diveNo}`, ids, results, done: !!(saved && saved.done) };
    }
    if (mode === 'pack') {
      const pack = PACK_BY_ID.get(opts.packId);
      return { mode, packId: pack.id, title: pack.name, ids: practiceIds(pack.id), results: [], done: false };
    }
    return { mode: 'endless', title: 'Endlos-Tauchgang', ids: practiceIds(), results: [], done: false };
  }

  /* Question rotation ------------------------------------------------------ */

  // Every prompt remembers when it was last on screen (daily dives included), and practice
  // dives draw the least recently played ones: nothing repeats until everything else had a turn.
  let seen = store.get('seen', {});
  let seenTick = Math.max(0, ...Object.values(seen));

  function markSeen(id) {
    seen[id] = ++seenTick;
    store.set('seen', seen);
  }

  function practicePool(packId) {
    return PROMPTS.filter((p) => !packId || p.pack === packId).map((p) => p.id);
  }

  function practiceIds(packId) {
    // Shuffle first so prompts never seen (or seen equally long ago) come in random order;
    // the sort is stable, so that randomness survives.
    return shuffle(practicePool(packId))
      .sort((a, b) => (seen[a] || 0) - (seen[b] || 0))
      .slice(0, ROUNDS);
  }

  const unseenCount = (packId) => practicePool(packId).filter((id) => !seen[id]).length;

  const gameDepth = (g) => totalPoints(g.results) * M_PER_POINT;

  /* ─────────────────────────────── Markup ─────────────────────────────── */

  const KRILL_SVG = `
  <svg class="krill" viewBox="0 0 160 110" aria-hidden="true">
    <defs>
      <linearGradient id="krillBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffb199"/><stop offset="1" stop-color="#ff6f5b"/>
      </linearGradient>
    </defs>
    <g class="krill-antennae" fill="none" stroke="#ffb199" stroke-width="2.2" stroke-linecap="round">
      <path d="M124 38 C 138 20, 150 14, 158 4"/>
      <path d="M126 42 C 142 34, 152 32, 158 30"/>
    </g>
    <g class="krill-legs" stroke="#ff8f78" stroke-width="2.4" stroke-linecap="round">
      <path d="M100 66 l-4 16"/><path d="M88 70 l-5 15"/><path d="M76 73 l-6 14"/><path d="M64 75 l-7 12"/><path d="M53 76 l-7 10"/>
    </g>
    <path d="M30 82 C 18 90, 10 98, 6 106 C 18 102, 26 98, 32 92 C 30 100, 30 104, 32 108 C 38 100, 40 94, 40 88 Z" fill="#ff8a70"/>
    <ellipse cx="44" cy="80" rx="12" ry="10" fill="url(#krillBody)"/>
    <ellipse cx="57" cy="74" rx="13" ry="12" fill="url(#krillBody)"/>
    <ellipse cx="71" cy="68" rx="14" ry="13" fill="url(#krillBody)"/>
    <ellipse cx="86" cy="62" rx="15" ry="14" fill="url(#krillBody)"/>
    <path d="M96 40 C 116 34, 132 42, 130 56 C 128 68, 110 74, 94 72 C 84 70, 80 60, 84 50 C 86 44, 90 42, 96 40 Z" fill="url(#krillBody)"/>
    <g fill="#7ff3ff" class="krill-lights"><circle cx="58" cy="85" r="2"/><circle cx="72" cy="80" r="2"/><circle cx="87" cy="75" r="2"/><circle cx="104" cy="73" r="2"/></g>
    <circle cx="116" cy="49" r="7.5" fill="#1b1030"/><circle cx="118.5" cy="46.5" r="2.4" fill="#fff"/>
  </svg>`;

  const ICONS = {
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.4 9.3a2.7 2.7 0 1 1 3.7 2.5c-.8.3-1.1.9-1.1 1.7v.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>',
    log: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16m0 0l-6-6m6 6l6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  function tierBadge(tier, small = false) {
    const t = TIERS[tier || 'miss'];
    return `<span class="tier-badge tier-${tier || 'miss'}${small ? ' small' : ''}"><span class="tier-emoji" aria-hidden="true">${t.emoji}</span>${esc(t.name)}${tier && tier !== 'miss' ? `<span class="tier-pts">${t.pts}</span>` : ''}</span>`;
  }

  function gaugeMarkup() {
    const zones = ZONES.map((z) => {
      const top = (z.from / MAX_DEPTH) * 100;
      const height = ((z.to - z.from) / MAX_DEPTH) * 100;
      return `<div class="gauge-zone" style="top:${top}%;height:${height}%"><span>${z.short}</span></div>`;
    }).join('');
    const ticks = [1000, 2000, 3000, 4000, 5000, 6000].map((d) => `<div class="gauge-tick" style="top:${(d / MAX_DEPTH) * 100}%"><span>${d / 1000}k</span></div>`).join('');
    return `<aside class="gauge" aria-hidden="true"><div class="gauge-track">${zones}${ticks}<div class="gauge-fill"></div><div class="gauge-marker">${KRILL_SVG}</div></div><div class="gauge-floor">${fmt(MAX_DEPTH)} m</div></aside>`;
  }

  function setGauge(depth) {
    const pct = clamp(depth / MAX_DEPTH, 0, 1) * 100;
    const fill = $('.gauge-fill');
    const marker = $('.gauge-marker');
    if (fill) fill.style.height = pct + '%';
    if (marker) marker.style.top = pct + '%';
    const num = $('#depthNum');
    if (num) num.textContent = fmt(depth);
    const zone = $('#zoneName');
    if (zone) zone.textContent = zoneFor(depth).name;
  }

  /* ─────────────────────────────── Screens ─────────────────────────────── */

  const app = () => $('#app');

  function show(html, cls) {
    clearTimers();
    const root = app();
    document.body.dataset.screen = cls || '';
    root.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* Home ------------------------------------------------------------------ */

  function renderHome() {
    game = null;
    ocean.dive(0, null, 900);
    const n = diveNumber();
    const saved = loadDaily(n);
    const dateLabel = dateOfDive(n).toLocaleDateString(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' });

    let dailyBody;
    if (saved && saved.done) {
      const pts = totalPoints(saved.results);
      dailyBody = `
        <div class="daily-done">
          <div class="daily-depth"><strong>${fmt(pts * M_PER_POINT)}</strong><span>m</span></div>
          <div class="daily-meta">
            <div class="emoji-row" aria-label="Deine Stufen">${emojiRow(saved.results)}</div>
            <p>${fmt(pts)} / 700 Punkte · ${zoneFor(pts * M_PER_POINT).name}</p>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn primary" data-act="daily-results">Ergebnis ansehen</button>
          <p class="next-dive">Nächster Tauchgang in <strong id="nextDive">${formatCountdown(msUntilNextDive())}</strong></p>
        </div>`;
    } else if (saved && saved.results && saved.results.length) {
      const pts = totalPoints(saved.results.filter((r) => !r.pending));
      dailyBody = `
        <p class="daily-copy">Du hast ${saved.results.length} von ${ROUNDS} Fragen geschafft und bist auf <strong>${fmt(pts * M_PER_POINT)} m</strong>. Deine Luft wartet.</p>
        <div class="card-actions"><button class="btn primary big" data-act="start-daily">Tauchgang fortsetzen</button></div>`;
    } else {
      dailyBody = `
        <ul class="daily-facts">
          <li><strong>7</strong> Fragen</li><li><strong>${ANSWER_SECS}</strong> Sekunden pro Frage</li><li>Seltenere Antworten tauchen <strong>tiefer</strong></li>
        </ul>
        <div class="card-actions"><button class="btn primary big" data-act="start-daily">Tauchgang starten ${ICONS.down}</button></div>`;
    }

    const packs = PACKS.map((p) => {
      const count = practicePool(p.id).length;
      const fresh = unseenCount(p.id);
      return `
      <button class="pack${p.soon ? ' soon' : ''}" ${p.soon ? 'disabled aria-disabled="true"' : `data-act="pack" data-pack="${p.id}"`}>
        <span class="pack-icon" aria-hidden="true">${p.icon}</span>
        <span class="pack-name">${esc(p.name)}</span>
        <span class="pack-blurb">${esc(p.blurb)}</span>
        <span class="pack-meta">${p.soon ? 'Bald verfügbar' : fresh ? `${count} Fragen · ${fresh} neu` : `${count} Fragen · alle gespielt`}</span>
      </button>`;
    }).join('');

    show(`
      <section class="screen home">
        <div class="hero">
          <div class="mascot">${KRILL_SVG}</div>
          <h1 class="wordmark">Krillion</h1>
          <p class="tagline">Tauche so tief du kannst — mit <em>seltenen</em> Antworten auf jede Quizfrage.</p>
        </div>

        <article class="card daily">
          <header class="card-head">
            <span class="eyebrow">Tagestauchgang #${n}</span>
            <span class="date">${dateLabel}</span>
          </header>
          ${dailyBody}
        </article>

        <article class="card endless">
          <div>
            <h2>Endlos-Tauchgang</h2>
            <p>Sieben Fragen aus allen Paketen, ohne Wiederholung: Erst wenn du alle gesehen hast, kommen die am längsten zurückliegenden wieder. Dein Tagesergebnis bleibt davon unberührt.</p>
            <p class="endless-count">${unseenCount()
              ? `Noch <strong>${unseenCount()}</strong> von ${PROMPTS.length} Fragen hast du noch nie gesehen.`
              : `Du hast alle ${PROMPTS.length} Fragen gesehen — ab jetzt kommen die am längsten zurückliegenden wieder.`}</p>
          </div>
          <button class="btn ghost" data-act="endless">Abtauchen</button>
        </article>

        <section class="packs" aria-labelledby="packs-title">
          <h2 id="packs-title">Themenpakete</h2>
          <div class="pack-grid">${packs}</div>
        </section>

        <footer class="foot">
          <p>Ein inoffizieller Fan-Nachbau des Tagestauchgangs von krillion.io. Antwortbögen und Seltenheitsstufen sind von Hand zusammengestellt — die erreichte Tiefe ist also ein Richtwert.</p>
        </footer>
      </section>`, 'is-home');

    if (saved && saved.done) {
      countdownTimer = setInterval(() => {
        const el = $('#nextDive');
        if (!el) return clearInterval(countdownTimer);
        const left = msUntilNextDive();
        el.textContent = formatCountdown(left);
        if (diveNumber() !== n) renderHome();
      }, 1000);
    }
  }

  /* Game ------------------------------------------------------------------ */

  function startGame(mode, opts) {
    game = newGame(mode, opts);
    if (game.done) return renderResults(game);
    renderGameShell();
    ocean.set(gameDepth(game));
    setGauge(gameDepth(game));
    nextRound();
  }

  function renderGameShell() {
    const pips = Array.from({ length: ROUNDS }, (_, i) => `<li class="pip" data-pip="${i}"></li>`).join('');
    show(`
      <section class="screen game">
        <div class="game-bar">
          <button class="icon-btn" data-act="quit" aria-label="Zurück an die Oberfläche" title="Zurück an die Oberfläche">${ICONS.close}</button>
          <div class="game-title"><span class="eyebrow">${esc(game.title)}</span><ol class="pips" aria-label="Fortschritt">${pips}</ol></div>
          <div class="depth-readout" aria-live="off"><span class="depth-num"><strong id="depthNum">0</strong> m</span><span id="zoneName" class="zone-name">${ZONES[0].name}</span></div>
        </div>
        <div class="game-body">
          ${gaugeMarkup()}
          <div class="stage"><article class="card prompt-card" id="promptCard"></article></div>
        </div>
      </section>`, 'is-game');
    updatePips();
  }

  function updatePips() {
    document.querySelectorAll('.pip').forEach((el, i) => {
      const r = game.results[i];
      el.className = 'pip' + (r ? ` done tier-${r.tier || 'miss'}` : '') + (i === game.results.length && !game.done ? ' current' : '');
      el.textContent = r ? TIERS[r.tier || 'miss'].emoji : '';
      el.setAttribute('aria-label', r ? `Frage ${i + 1}: ${TIERS[r.tier || 'miss'].name}` : `Frage ${i + 1}`);
    });
  }

  function nextRound() {
    const i = game.results.length;
    if (i >= game.ids.length) return finishGame();
    const prompt = PROMPT_BY_ID.get(game.ids[i]);
    if (!prompt) {
      game.results.push({ id: game.ids[i], tier: 'miss', pts: 0, answer: '', tries: [] });
      return nextRound();
    }
    game.round = { prompt, tries: [], phase: 'preview' };
    markSeen(prompt.id);
    updatePips();
    const packName = prompt.pack !== 'mixed' && PACK_BY_ID.get(prompt.pack) ? PACK_BY_ID.get(prompt.pack).name : 'Gemischt';
    $('#promptCard').innerHTML = `
      <div class="prompt-meta"><span class="eyebrow">Frage ${i + 1} von ${game.ids.length}</span><span class="pack-tag">${esc(packName)}</span></div>
      <h2 class="prompt-q">${esc(prompt.q)}</h2>
      <div class="timer" id="timer" role="timer" aria-label="Verbleibende Zeit">
        <svg viewBox="0 0 64 64" aria-hidden="true"><circle class="timer-bg" cx="32" cy="32" r="28"/><circle class="timer-fg" id="timerRing" cx="32" cy="32" r="28" pathLength="100"/></svg>
        <span id="timerNum">3</span>
      </div>
      <div class="round-body" id="roundBody">
        <p class="get-ready">Mach dich bereit zum Abtauchen …</p>
      </div>`;
    $('#promptCard').classList.remove('revealed');
    runClock(PREVIEW_MS, 'preview', () => openAnswerWindow());
  }

  // Drives the ring + number; returns a cancellable handle stored in `timers`.
  function runClock(ms, phase, onDone) {
    const ring = $('#timerRing');
    const num = $('#timerNum');
    const timer = $('#timer');
    const start = performance.now();
    let raf = 0;
    let cancelled = false;
    timer.classList.toggle('preview', phase === 'preview');
    const tick = (now) => {
      if (cancelled) return;
      const left = Math.max(0, ms - (now - start));
      const secs = Math.ceil(left / 1000);
      if (num.textContent !== String(secs)) num.textContent = String(secs);
      ring.style.strokeDashoffset = String(100 - (left / ms) * 100);
      timer.classList.toggle('urgent', phase === 'answer' && left <= 5000);
      if (left <= 0) return onDone();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timers.push({ cancel: () => { cancelled = true; cancelAnimationFrame(raf); } });
  }

  function openAnswerWindow() {
    const round = game.round;
    round.phase = 'answer';
    if (game.mode === 'daily') {
      // Reserve the slot so a reload mid-answer counts as a miss rather than a free retry.
      saveDaily({ ...game, results: [...game.results, { id: round.prompt.id, pending: true }] });
    }
    $('#roundBody').innerHTML = `
      <form class="answer-form" id="answerForm" autocomplete="off" novalidate>
        <label class="sr-only" for="answer">Deine Antwort</label>
        <input id="answer" name="answer" type="text" maxlength="80" placeholder="Deine seltene Antwort …" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">
        <button class="btn primary" type="submit">Tauchen ${ICONS.down}</button>
      </form>
      <p class="feedback" id="feedback" aria-live="polite"></p>
      <div class="suggest" id="suggest" hidden></div>
      <ul class="tries" id="tries" aria-label="Antworten, die nicht auf dem Bogen stehen"></ul>
      <button class="link-btn" data-act="skip">Frage überspringen</button>`;
    const input = $('#answer');
    input.focus({ preventScroll: true });
    $('#answerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      submitAnswer(input.value);
    });
    runClock(ANSWER_MS, 'answer', () => resolveRound(null));
  }

  function submitAnswer(value) {
    const round = game.round;
    if (!round || round.phase !== 'answer') return;
    const text = value.trim();
    if (!text) return;
    const hit = matchAnswer(text, round.prompt);
    if (hit) return resolveRound({ text, ...hit });

    const fb = $('#feedback');
    const already = round.tries.some((t) => t.toLowerCase() === text.toLowerCase());
    if (!already) round.tries.push(text);
    round.suggestions = suggestAnswers(text, round.prompt);
    const box = $('#suggest');
    fb.classList.toggle('soft', round.suggestions.length > 0);
    if (round.suggestions.length) {
      fb.textContent = `„${text}" steht so nicht auf dem Bogen.`;
      box.innerHTML = `<span class="suggest-label">Meintest du:</span>${round.suggestions
        .map((e, i) => `<button type="button" class="suggest-btn" data-act="pick" data-idx="${i}">${esc(e.label)}</button>`).join('')}`;
      box.hidden = false;
    } else {
      fb.textContent = already ? `„${text}" hast du schon probiert.` : `„${text}" steht nicht auf dem Antwortbogen. Versuch es nochmal!`;
      box.hidden = true;
      box.innerHTML = '';
    }
    $('#tries').innerHTML = round.tries.map((t) => `<li>${esc(t)}</li>`).join('');
    const input = $('#answer');
    input.value = '';
    input.focus({ preventScroll: true });
    const form = $('#answerForm');
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
  }

  function resolveRound(hit, reason = 'timeout') {
    const round = game.round;
    if (!round || round.phase !== 'answer') return;
    round.phase = 'reveal';
    clearTimers();

    const tier = hit ? hit.entry.tier : 'miss';
    const pts = TIERS[tier].pts;
    const result = { id: round.prompt.id, answer: hit ? hit.text : '', matched: hit ? hit.entry.label : '', tier, pts, tries: round.tries };
    game.results.push(result);
    if (game.mode === 'daily') saveDaily(game);

    const prevDepth = ocean.depth;
    const depth = gameDepth(game);
    const sheet = sheetFor(round.prompt);
    const common = sheet.entries.filter((e) => e.tier === 'plankton').slice(0, 4).map((e) => e.label);
    const last = game.results.length >= game.ids.length;
    const note = hit && hit.entry.note ? hit.entry.note : TIERS[tier].blurb;
    const missText = reason === 'skip'
      ? 'Du hast diese Frage übersprungen.'
      : round.tries.length ? 'Keine Luft mehr — nichts davon stand auf dem Bogen.' : 'Keine Luft mehr — die Zeit ist abgelaufen.';

    $('#promptCard').classList.add('revealed');
    $('#timer').classList.remove('urgent');
    $('#roundBody').innerHTML = `
      <div class="reveal tier-${tier}">
        ${tierBadge(tier)}
        ${hit
          ? `<p class="reveal-answer">„${esc(hit.text)}"${hit.picked
            ? '<span class="matched">Vorschlag übernommen</span>'
            : hit.fuzzy || keyDiffers(hit.text, hit.entry.label, round.prompt) ? `<span class="matched">gewertet als ${esc(hit.entry.label)}</span>` : ''}</p>`
          : `<p class="reveal-answer muted">${missText}</p>`}
        <p class="reveal-points">${pts ? `+${pts} Punkte <span class="sep">·</span> <span class="descent">${ICONS.down} ${fmt(pts * M_PER_POINT)} m</span>` : 'Du hältst deine Tiefe.'}</p>
        <p class="reveal-note">${esc(note)}</p>
        ${common.length ? `<p class="reveal-common"><span>Am häufigsten:</span> ${common.map(esc).join(' · ')}</p>` : ''}
        <button class="btn primary" data-act="next" id="nextBtn">${last ? 'Tauchgang beenden' : 'Nächste Frage'} <span aria-hidden="true">→</span></button>
      </div>`;
    updatePips();
    ocean.dive(depth, setGauge, depth === prevDepth ? 0 : 1400);
    setTimeout(() => { const b = $('#nextBtn'); if (b) b.focus({ preventScroll: true }); }, 60);
  }

  function keyDiffers(text, label, prompt) {
    return keyOf(text, prompt).key !== keyOf(label, prompt).key;
  }

  function finishGame() {
    game.done = true;
    game.round = null;
    if (game.mode === 'daily') saveDaily(game);
    pushLog(game);
    renderResults(game);
  }

  function quitGame() {
    if (!game || game.done) return renderHome();
    if (game.mode === 'daily') {
      return confirmModal({
        title: 'Früher auftauchen?',
        body: 'Dein Tagesfortschritt ist gespeichert. Eine Frage, die du mitten in der Antwort verlässt, zählt beim Zurückkommen als verpasst.',
        ok: 'Zurück an die Oberfläche',
        onOk: renderHome,
      });
    }
    return confirmModal({ title: 'Tauchgang abbrechen?', body: 'Trainingstauchgänge werden nicht gespeichert — dieser Lauf geht verloren.', ok: 'Tauchgang abbrechen', onOk: renderHome });
  }

  /* Results --------------------------------------------------------------- */

  function profileSvg(results) {
    const W = 640;
    const H = 260;
    const padL = 78;
    const padR = 24;
    const padT = 18;
    const padB = 30;
    const x = (i) => padL + (i / ROUNDS) * (W - padL - padR);
    const y = (d) => padT + (d / MAX_DEPTH) * (H - padT - padB);
    // The Sunlight Zone is only a few pixels tall at this scale, so thin bands go unlabelled.
    const bands = ZONES.map((z, i) => `
      <rect x="${padL}" y="${y(z.from)}" width="${W - padL - padR}" height="${y(z.to) - y(z.from)}" class="band band-${i}"/>
      ${y(z.to) - y(z.from) >= 14 ? `<text x="${padL - 8}" y="${(y(z.from) + y(z.to)) / 2 + 4}" class="band-label" text-anchor="end">${z.short}</text>` : ''}`).join('');
    let depth = 0;
    const pts = [[x(0), y(0)]];
    const dots = [];
    results.forEach((r, i) => {
      depth += (r.pts || 0) * M_PER_POINT;
      pts.push([x(i + 1), y(depth)]);
      dots.push(`<circle cx="${x(i + 1)}" cy="${y(depth)}" r="6.5" class="dot tier-${r.tier || 'miss'}"><title>Frage ${i + 1}: ${TIERS[r.tier || 'miss'].name}, ${fmt(depth)} m</title></circle>`);
    });
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    const area = `${d} L${pts[pts.length - 1][0]},${y(0)} Z`;
    const xLabels = Array.from({ length: ROUNDS }, (_, i) => `<text x="${x(i + 1)}" y="${H - 8}" class="axis-label" text-anchor="middle">${i + 1}</text>`).join('');
    return `
      <svg class="profile" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tauchprofil: Tiefe nach jeder Frage">
        ${bands}
        <path d="${area}" class="profile-area"/>
        <path d="${d}" class="profile-line"/>
        ${dots.join('')}
        <circle cx="${x(0)}" cy="${y(0)}" r="4" class="dot start"/>
        ${xLabels}
      </svg>`;
  }

  function sheetMarkup(prompt, picked) {
    const sheet = sheetFor(prompt);
    return TIER_ORDER.map((tier) => {
      const items = sheet.entries.filter((e) => e.tier === tier);
      if (!items.length) return '';
      return `
        <div class="sheet-tier tier-${tier}">
          <h5>${tierBadge(tier, true)}<span class="count">${items.length}</span></h5>
          <p>${items.map((e) => `<span class="sheet-item${e === picked ? ' picked' : ''}"${e.note ? ` title="${esc(e.note)}"` : ''}>${esc(e.label)}</span>`).join('')}</p>
        </div>`;
    }).join('');
  }

  function shareText(g) {
    const pts = totalPoints(g.results);
    const depth = pts * M_PER_POINT;
    const head = g.mode === 'daily' ? `Krillion Tagestauchgang #${g.diveNo}` : `Krillion · ${g.title}`;
    const url = /^https?:/.test(location.protocol) ? `\n${location.origin}${location.pathname}` : '';
    return `${head}\n${emojiRow(g.results)}\n${fmt(depth)} m · ${pts}/700 Punkte · ${zoneFor(depth).name}${url}`;
  }

  function renderResults(g) {
    game = g;
    const pts = totalPoints(g.results);
    const depth = pts * M_PER_POINT;
    const zone = zoneFor(depth);
    const perfect = depth >= MAX_DEPTH;
    const best = g.results.reduce((acc, r) => (TIERS[r.tier || 'miss'].pts > TIERS[acc.tier || 'miss'].pts ? r : acc), g.results[0] || {});

    const rounds = g.results.map((r, i) => {
      const prompt = PROMPT_BY_ID.get(r.id);
      if (!prompt) return '';
      const sheet = sheetFor(prompt);
      const picked = r.matched ? sheet.entries.find((e) => e.label === r.matched) : null;
      return `
        <li class="round-row">
          <details>
            <summary>
              <span class="round-no">${i + 1}</span>
              <span class="round-main">
                <span class="round-q">${esc(prompt.q)}</span>
                <span class="round-a">${r.answer ? `„${esc(r.answer)}"` : '<em>Keine Antwort</em>'}</span>
              </span>
              ${tierBadge(r.tier, true)}
            </summary>
            <div class="sheet">
              ${r.tries && r.tries.length ? `<p class="sheet-tries">Nicht auf dem Bogen: ${r.tries.map(esc).join(', ')}</p>` : ''}
              <p class="sheet-intro">Vollständiger Antwortbogen · ${sheet.entries.length} akzeptierte Antworten</p>
              ${sheetMarkup(prompt, picked)}
            </div>
          </details>
        </li>`;
    }).join('');

    show(`
      <section class="screen results">
        <article class="card results-hero">
          <span class="eyebrow">${esc(g.title)} · geschafft</span>
          <div class="final-depth"><span id="finalDepth">${fmt(depth)}</span><small>m</small></div>
          <p class="final-sub">${fmt(pts)} / 700 Punkte · ${zone.name}</p>
          <p class="final-flavor">${perfect ? 'Du hast den Grabenboden berührt. Ein perfekter Tauchgang!' : zone.flavor}</p>
          <div class="emoji-row big" aria-label="Deine Stufen">${emojiRow(g.results)}</div>
          ${best && best.tier && best.tier !== 'miss' ? `<p class="best">Tiefste Antwort: <strong>„${esc(best.answer)}"</strong> ${tierBadge(best.tier, true)}</p>` : ''}
          <div class="card-actions row">
            <button class="btn primary" data-act="share">${ICONS.share} Ergebnis teilen</button>
            ${g.mode === 'daily' ? '<button class="btn ghost" data-act="endless">Endlos-Tauchgang spielen</button>' : `<button class="btn ghost" data-act="again">Nochmal tauchen</button>`}
            <button class="btn ghost" data-act="home">Zurück an die Oberfläche</button>
          </div>
        </article>

        <article class="card">
          <h3>Tauchprofil</h3>
          ${profileSvg(g.results)}
        </article>

        <article class="card">
          <h3>Deine Antworten &amp; die Antwortbögen</h3>
          <p class="muted small">Tippe auf eine Frage, um alle akzeptierten Antworten und ihre Stufe zu sehen.</p>
          <ol class="round-list">${rounds}</ol>
        </article>
      </section>`, 'is-results');

    ocean.dive(depth, null, 900);
    const counter = $('#finalDepth');
    if (counter && !REDUCED_MOTION && depth > 0) {
      const t0 = performance.now();
      const tick = (now) => {
        const t = clamp((now - t0) / 1200, 0, 1);
        counter.textContent = fmt(depth * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  async function share() {
    const text = shareText(game);
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Ergebnis in die Zwischenablage kopiert');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      toast(ok ? 'Ergebnis in die Zwischenablage kopiert' : 'Kopieren fehlgeschlagen — markiere stattdessen die Emoji-Zeile');
    }
  }

  /* Dive log --------------------------------------------------------------- */

  function streaks() {
    const today = diveNumber();
    const played = new Set();
    for (let n = today; n >= 1; n--) {
      const s = loadDaily(n);
      if (s && s.done) played.add(n);
    }
    let current = 0;
    for (let n = played.has(today) ? today : today - 1; played.has(n); n--) current++;
    let best = 0;
    let run = 0;
    for (let n = 1; n <= today; n++) {
      run = played.has(n) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return { current, best };
  }

  function renderLog() {
    game = null;
    ocean.dive(0, null, 900);
    const log = store.get('log', []);
    const daily = log.filter((e) => e.mode === 'daily');
    const depths = daily.map((e) => e.points * M_PER_POINT);
    const avg = depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;
    const deepest = depths.length ? Math.max(...depths) : 0;
    const { current, best } = streaks();

    const tally = Object.fromEntries([...TIER_ORDER, 'miss'].map((t) => [t, 0]));
    log.forEach((e) => e.tiers.forEach((t) => { tally[t || 'miss'] = (tally[t || 'miss'] || 0) + 1; }));
    const maxTally = Math.max(1, ...Object.values(tally));
    const bars = [...TIER_ORDER, 'miss'].map((t) => `
      <li class="tally tier-${t}">
        <span class="tally-label"><span aria-hidden="true">${TIERS[t].emoji}</span> ${TIERS[t].name}</span>
        <span class="tally-bar"><span style="width:${(tally[t] / maxTally) * 100}%"></span></span>
        <span class="tally-n">${tally[t]}</span>
      </li>`).join('');

    const entries = log.slice(0, 60).map((e) => {
      const d = new Date(e.date);
      return `
        <li class="log-row">
          <span class="log-title">${esc(e.title)}<small>${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })} Uhr</small></span>
          <span class="emoji-row">${e.tiers.map((t) => TIERS[t || 'miss'].emoji).join('')}</span>
          <span class="log-depth">${fmt(e.points * M_PER_POINT)} m</span>
        </li>`;
    }).join('');

    show(`
      <section class="screen log">
        <header class="screen-head">
          <h1>Tauchlogbuch</h1>
          <p class="muted">Nur in diesem Browser gespeichert.</p>
        </header>
        <div class="stats-grid">
          <div class="stat card"><strong>${daily.length}</strong><span>Tagestauchgänge</span></div>
          <div class="stat card"><strong>${fmt(avg)}<small> m</small></strong><span>Durchschnittstiefe</span></div>
          <div class="stat card"><strong>${fmt(deepest)}<small> m</small></strong><span>Tiefster Tauchgang</span></div>
          <div class="stat card"><strong>${current}</strong><span>Aktuelle Serie</span></div>
          <div class="stat card"><strong>${best}</strong><span>Beste Serie</span></div>
        </div>
        <article class="card">
          <h3>Alle Antworten nach Stufe</h3>
          <ul class="tally-list">${bars}</ul>
        </article>
        <article class="card">
          <h3>Letzte Tauchgänge</h3>
          ${entries ? `<ol class="log-list">${entries}</ol>` : '<p class="muted">Noch keine Tauchgänge im Logbuch. Das Wasser ist herrlich — spring rein!</p>'}
        </article>
        <div class="card-actions center"><button class="btn ghost" data-act="home">Zurück an die Oberfläche</button></div>
      </section>`, 'is-log');
  }

  /* ─────────────────────────── Modal & toast ─────────────────────────── */

  let lastFocus = null;

  function openModal(html, label) {
    lastFocus = document.activeElement;
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" data-act="close-modal"></div>
      <div class="modal card" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <button class="icon-btn modal-close" data-act="close-modal" aria-label="Schließen">${ICONS.close}</button>
        ${html}
      </div>`;
    root.classList.add('open');
    const focusable = root.querySelector('.modal button:not(.modal-close), .modal-close');
    if (focusable) focusable.focus();
  }

  function closeModal() {
    const root = $('#modal-root');
    root.classList.remove('open');
    root.innerHTML = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function confirmModal({ title, body, ok, onOk }) {
    openModal(`
      <h2>${esc(title)}</h2>
      <p>${esc(body)}</p>
      <div class="card-actions row end">
        <button class="btn ghost" data-act="close-modal">Weitertauchen</button>
        <button class="btn primary" data-act="confirm-ok">${esc(ok)}</button>
      </div>`, title);
    confirmModal.onOk = onOk;
  }

  function helpModal() {
    const tiers = TIER_ORDER.map((t) => `
      <li>${tierBadge(t, true)}<span>${TIERS[t].blurb}</span><strong>${fmt(TIERS[t].pts * M_PER_POINT)} m</strong></li>`).join('');
    const zones = ZONES.map((z) => `<li><span>${z.name}</span><span>${fmt(z.from)}–${fmt(z.to)} m</span></li>`).join('');
    openModal(`
      <h2>So wird gespielt</h2>
      <ol class="rules">
        <li>Jeden Tag gibt es einen neuen Tauchgang mit <strong>7 Fragen</strong> — für alle dieselben.</li>
        <li>Du hast <strong>${ANSWER_SECS} Sekunden</strong> pro Frage. Falsche Versuche kosten nur Zeit, also tipp einfach weiter.</li>
        <li>Liegst du knapp daneben, schlagen wir passende Antworten vor — tippe auf einen Vorschlag, um ihn abzugeben.</li>
        <li>Jede Antwort auf dem Bogen zählt — aber je <strong>seltener</strong> sie ist, desto mehr Punkte gibt es.</li>
        <li>Jeder Punkt bringt dich <strong>10 m tiefer</strong>. Ein perfekter Tauchgang (700 Punkte) erreicht den Grabenboden in ${fmt(MAX_DEPTH)} m Tiefe.</li>
      </ol>
      <h3>Seltenheitsstufen</h3>
      <ul class="tier-table">${tiers}</ul>
      <h3>Meereszonen</h3>
      <ul class="zone-table">${zones}</ul>
      <p class="muted small">Endlos-Tauchgang und Themenpakete sind unbegrenztes Training — dein Tagesergebnis ändern sie nie. Deine Tauchgänge werden nur in diesem Browser gespeichert.</p>
      <div class="card-actions row end"><button class="btn primary" data-act="close-modal">Los geht's</button></div>`, 'So wird gespielt');
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ───────────────────────────── Wiring ───────────────────────────── */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    switch (act) {
      case 'home': return renderHome();
      case 'brand': return game && !game.done ? quitGame() : renderHome();
      case 'start-daily': return startGame('daily');
      case 'daily-results': return startGame('daily');
      case 'endless': return startGame('endless');
      case 'pack': return startGame('pack', { packId: el.dataset.pack });
      case 'again': return game && game.mode === 'pack' ? startGame('pack', { packId: game.packId }) : startGame('endless');
      case 'next': return nextRound();
      case 'skip': return resolveRound(null, 'skip');
      case 'pick': {
        const entry = game && game.round && game.round.suggestions && game.round.suggestions[Number(el.dataset.idx)];
        return entry ? resolveRound({ text: entry.label, entry, fuzzy: true, picked: true }) : undefined;
      }
      case 'quit': return quitGame();
      case 'share': return share();
      case 'help': return helpModal();
      case 'log': return game && !game.done ? quitGame() : renderLog();
      case 'close-modal': return closeModal();
      case 'confirm-ok': {
        const fn = confirmModal.onOk;
        closeModal();
        return fn && fn();
      }
      default: return undefined;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal-root').classList.contains('open')) return closeModal();
    if (e.key === 'Enter' && !e.repeat && game && game.round && game.round.phase === 'reveal' && !$('#modal-root').classList.contains('open')) {
      if (document.activeElement && document.activeElement.id === 'nextBtn') return undefined; // native click handles it
      e.preventDefault();
      return nextRound();
    }
    return undefined;
  });

  // Small hook for tests and the curious.
  window.KrillionEngine = { matchAnswer, suggestAnswers, sheetFor, keyOf, dailyPromptIds, diveNumber, practiceIds, markSeen, TIERS };

  startMarineSnow();
  ocean.set(0);
  renderHome();
  if (!store.get('seenHelp', false)) {
    store.set('seenHelp', true);
    helpModal();
  }
})();
