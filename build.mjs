// Builds the static site into dist/. Run: npm run build   (or npm run check to validate only)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const CHECK_ONLY = process.argv.includes('--check');
const errors = [];
const todos = [];

/* ---------- UI labels (also checked for en + ko) ---------- */
const UI = {
  plan: { en: 'Plan', ko: '일정' },
  places: { en: 'Places', ko: '장소' },
  contacts: { en: 'Contacts', ko: '연락처' },
  info: { en: 'Info', ko: '정보' },
  online: { en: 'Available offline', ko: '오프라인 사용 가능' },
  offline: { en: 'You are offline', ko: '오프라인 상태' },
  update: { en: 'New version available. Tap to refresh.', ko: '새 버전이 있습니다. 눌러서 새로고침하세요.' },
  today: { en: 'Today', ko: '오늘' },
  reserve: { en: 'Reserved', ko: '예약됨' },
  fixed: { en: 'Fixed', ko: '확정 일정' },
  optional: { en: 'Optional', ko: '선택' },
  taxi: { en: 'Taxi', ko: '택시' },
  openMap: { en: 'Open in Maps', ko: '지도 열기' },
  photo: { en: 'Photo', ko: '사진' },
  about: { en: 'About this place', ko: '장소 정보' },
  site: { en: 'Official site', ko: '공식 사이트' },
  hours: { en: 'Opening hours', ko: '운영 시간' },
  access: { en: 'For older adults', ko: '어르신 이용' },
  tickets: { en: 'Tickets', ko: '입장권' },
  address: { en: 'Address', ko: '주소' },
  easy: { en: 'Easy', ko: '편함' },
  moderate: { en: 'Some effort', ko: '다소 힘듦' },
  hard: { en: 'Challenging', ko: '힘듦' },
  verify: { en: 'Not verified', ko: '확인되지 않음' },
  emergency: { en: 'Emergency numbers', ko: '긴급 전화' },
  taxiTitle: { en: 'Show this to a taxi driver', ko: '택시 기사님께 보여 주세요' },
  flights: { en: 'Flights', ko: '항공편' },
  overview: { en: 'Overview', ko: '개요' },
  route: { en: 'Our route', ko: '여정' },
  stay: { en: 'Where we stay', ko: '숙소' },
  stays: { en: 'Stays', ko: '숙소' },
  drive: { en: 'Drive', ko: '운전' },
  call: { en: 'Call', ko: '전화' },
  kakao: { en: 'KakaoTalk', ko: '카카오톡' },
  travelers: { en: 'Travelers', ko: '여행자' },
  everyone: { en: 'Everyone', ko: '전체' },
  travelersHelp: { en: 'Tap a name to see only that traveler\'s trips. Times are local.', ko: '이름을 누르면 그 여행자의 일정만 보입니다. 시간은 현지 시각입니다.' },
  flight: { en: 'Flight', ko: '항공편' },
  train: { en: 'Train', ko: '기차' },
  nextDay: { en: 'next day', ko: '다음 날' },
  nights: { en: 'nights', ko: '박' },
  family: { en: 'Family and group chat', ko: '가족 연락처와 단체 채팅방' },
  goToday: { en: 'Today', ko: '오늘' },
  embassy: { en: 'Embassy', ko: '대사관' },
  tips: { en: 'Tips for the group', ko: '여행 팁' },
  money: { en: 'Czech koruna helper', ko: '체코 코루나 계산기' },
  amount: { en: 'Amount', ko: '금액' },
  rateNote: { en: 'Approximate rates. Check a current rate before relying on it.', ko: '대략적인 환율입니다. 정확한 금액은 현재 환율을 확인하세요.' },
  rateDate: { en: 'Rates as of', ko: '환율 기준일' },
};
checkText(UI, 'ui labels (build.mjs)');

/* ---------- loading and validation ---------- */
function load(name) {
  const file = path.join(ROOT, 'content', name);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { errors.push(`content/${name}: file is missing.`); return null; }
  try { return JSON.parse(raw); } catch (e) {
    errors.push(`content/${name}: the file is not valid JSON. ${e.message}. Look for a missing or extra comma, quote mark or bracket near that spot.`);
    return null;
  }
}

const OPTIONAL_TEXT = new Set(['note', 'when']);
function checkText(node, where, key = '') {
  if (typeof node === 'string') { if (/TODO/.test(node)) todos.push(`${where}: ${node}`); return; }
  if (Array.isArray(node)) { node.forEach((x, i) => checkText(x, `${where}[${i}]`, key)); return; }
  if (!node || typeof node !== 'object') return;
  const keys = Object.keys(node);
  if (keys.includes('en') || keys.includes('ko')) {
    const en = typeof node.en === 'string' ? node.en.trim() : '';
    const ko = typeof node.ko === 'string' ? node.ko.trim() : '';
    const extra = keys.filter((k) => k !== 'en' && k !== 'ko');
    if (extra.length) errors.push(`${where}: unexpected field "${extra[0]}" next to en/ko.`);
    if (!en && ko) errors.push(`${where}: the ENGLISH text (en) is missing. Korean says: "${ko}"`);
    else if (en && !ko) errors.push(`${where}: the KOREAN text (ko) is missing. English says: "${en}"`);
    else if (!en && !ko && !OPTIONAL_TEXT.has(key)) errors.push(`${where}: both English and Korean are empty.`);
    if (/TODO/.test(en + ko)) todos.push(`${where}: ${en || ko}`);
    return;
  }
  for (const k of keys) {
    const v = node[k];
    const label = v && typeof v === 'object' && !Array.isArray(v) ? (v.id || v.time || '') : '';
    checkText(v, `${where} → ${k}${label ? ` (${label})` : ''}`, k);
  }
}

const site = load('site.json');
const itinerary = load('itinerary.json');
const places = load('places.json');
const contacts = load('contacts.json');
const info = load('info.json');
const stays = load('stays.json');
const flights = load('flights.json');

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['normal', 'taxi', 'drive', 'reserve', 'fixed', 'optional'];
const PHONE = /^\+?[\d ()-]{3,}$/;
const KAKAO = /^(https?:\/\/|kakaotalk:\/\/)\S+$/;

if (site && itinerary && places && contacts && info && stays && flights) {
  for (const [name, data] of [['site.json', site], ['itinerary.json', itinerary], ['places.json', places], ['contacts.json', contacts], ['info.json', info], ['stays.json', stays], ['flights.json', flights]]) checkText(data, name);

  if (!DATE.test(site.start || '') || !DATE.test(site.end || '')) errors.push('site.json: "start" and "end" must look like 2026-11-24.');
  const placeIds = new Set((places.places || []).map((p) => p.id));
  const cityIds = new Set((site.cities || []).map((c) => c.id));
  const stayIds = new Set((stays.stays || []).map((x) => x.id));
  (stays.stays || []).forEach((x) => {
    const w = `stays.json → ${x.id}`;
    if (!cityIds.has(x.city)) errors.push(`${w}: city "${x.city}" is not in site.json cities. Known: ${[...cityIds].join(', ')}.`);
    if (!['cs', 'de'].includes(x.lang)) errors.push(`${w}: "lang" must be cs (Czech) or de (German) for the taxi card.`);
    if (!DATE.test(x.from || '') || !DATE.test(x.to || '')) errors.push(`${w}: "from" and "to" must be dates like 2026-12-01.`);
    if (!x.address || !x.mapQuery) errors.push(`${w}: "address" and "mapQuery" are required.`);
    if (x.phone && !/TODO/.test(x.phone) && !PHONE.test(x.phone)) errors.push(`${w}: phone "${x.phone}" should contain only digits, spaces, + ( ) -.`);
    if (x.kakao && !/TODO/.test(x.kakao) && !KAKAO.test(x.kakao)) errors.push(`${w}: kakao "${x.kakao}" must be a link starting with https://`);
  });
  const travelerIds = new Set((flights.travelers || []).map((x) => x.id));
  (flights.trips || []).forEach((f, i) => {
    const w = `flights.json → trip ${i + 1} (${f.number || f.date})`;
    if (!DATE.test(f.date || '')) errors.push(`${w}: "date" must look like 2026-11-24.`);
    if (!['flight', 'train'].includes(f.kind)) errors.push(`${w}: "kind" must be flight or train.`);
    if (!TIME.test(f.dep || '')) errors.push(`${w}: "dep" must look like 09:30.`);
    if (f.arr && !TIME.test(f.arr)) errors.push(`${w}: "arr" must look like 09:30, or be left out.`);
    if (!Array.isArray(f.who) || !f.who.length) errors.push(`${w}: "who" must list at least one traveler.`);
    (f.who || []).forEach((x) => { if (!travelerIds.has(x)) errors.push(`${w}: traveler "${x}" is not in "travelers". Known: ${[...travelerIds].join(', ')}.`); });
  });
  if (!Array.isArray(itinerary.days) || !itinerary.days.length) errors.push('itinerary.json: "days" must be a list with at least one day.');
  (itinerary.days || []).forEach((day, di) => {
    const dw = `itinerary.json → day ${di + 1} (${day.id})`;
    if (!DATE.test(day.id || '')) errors.push(`${dw}: "id" must be a date like 2026-11-25.`);
    if (!cityIds.has(day.city)) errors.push(`${dw}: city "${day.city}" is not in site.json cities. Known: ${[...cityIds].join(', ')}.`);
    (day.stay || []).forEach((sid) => { if (!stayIds.has(sid)) errors.push(`${dw}: stay "${sid}" does not exist in stays.json. Known: ${[...stayIds].join(', ')}.`); });
    (day.items || []).forEach((it, ii) => {
      const w = `${dw} → item ${ii + 1} (${it.time || 'no time'})`;
      if (it.time && !TIME.test(it.time)) errors.push(`${w}: time "${it.time}" must look like 09:30 (24-hour clock).`);
      if (!it.time && !it.when) errors.push(`${w}: needs a "time" like 09:30, or a "when" with en/ko words such as Night.`);
      if (!TYPES.includes(it.type)) errors.push(`${w}: type "${it.type}" must be one of: ${TYPES.join(', ')}.`);
      if (it.place && !placeIds.has(it.place)) errors.push(`${w}: place "${it.place}" does not exist in places.json. Known ids: ${[...placeIds].join(', ')}.`);
    });
  });
  (places.places || []).forEach((p) => {
    const w = `places.json → ${p.id}`;
    if (!['easy', 'moderate', 'hard'].includes(p.access)) errors.push(`${w}: "access" must be easy, moderate or hard.`);
    if (!p.address || !p.mapQuery) errors.push(`${w}: "address" and "mapQuery" are required.`);
    if (p.image && !fs.existsSync(path.join(ROOT, p.image.file))) errors.push(`${w}: image file "${p.image.file}" does not exist.`);
    if (p.image && !p.image.credit) errors.push(`${w}: an image needs a "credit" line.`);
    if (typeof p.verified !== 'boolean') errors.push(`${w}: "verified" must be true or false.`);
  });
  const phones = [...(contacts.emergency || []).map((e) => e.phone), contacts.embassy?.phone, ...(contacts.family?.people || []).map((p) => p.phone)];
  [contacts.family?.groupChat?.kakao, ...(contacts.family?.people || []).map((p) => p.kakao)].forEach((k) => { if (k && !/TODO/.test(k) && !KAKAO.test(k)) errors.push(`contacts.json: kakao "${k}" must be a link starting with https://`); });
  phones.forEach((ph) => { if (ph && !/TODO/.test(ph) && !PHONE.test(ph)) errors.push(`contacts.json: phone "${ph}" should contain only digits, spaces, + ( ) -.`); });
  for (const c of ['USD', 'EUR', 'KRW']) if (!(info.currency?.rates?.[c] > 0)) errors.push(`info.json: currency.rates.${c} must be a number above 0.`);
}

function finish() {
  if (todos.length) {
    console.warn(`\n⚠  ${todos.length} TODO placeholder(s) still to fill in:`);
    for (const t of todos) {
      console.warn(`   - ${t}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning::TODO left in ${t.slice(0, 200)}`);
    }
  }
  if (errors.length) {
    console.error(`\n✖  The site was NOT built. Fix ${errors.length} problem(s) in the content files:\n`);
    for (const e of errors) {
      console.error(`   - ${e}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::error::${e.slice(0, 300)}`);
    }
    process.exit(1);
  }
}
finish();
if (CHECK_ONLY) { console.log('✔  Content check passed.'); process.exit(0); }

/* ---------- rendering helpers ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => esc(s).replace(/TODO/g, '<mark class="todo">TODO</mark>');
const tr = (o) => `<span lang="en">${plain(o.en)}</span><span lang="ko">${plain(o.ko)}</span>`;
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_KO = ['일', '월', '화', '수', '목', '금', '토'];
function dateInfo(id) {
  const [y, m, d] = id.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    d, m, wd: { en: WD_EN[w], ko: WD_KO[w] },
    mon: { en: MO_EN[m - 1], ko: `${m}월` },
    short: { en: `${MO_EN[m - 1]} ${d}`, ko: `${m}월 ${d}일` },
    label: { en: `${WD_EN[w]}, ${MO_EN[m - 1]} ${d}`, ko: `${m}월 ${d}일 (${WD_KO[w]})` },
  };
}
const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const SVG = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  plan: SVG('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  places: SVG('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  flights: SVG('<path d="M10.5 13.5 3 11l1.5-2 8 .5L17 5a2 2 0 0 1 3 3l-4.5 4.5.5 8-2 1.5-2.5-7.5L8 17.5l-1.5-.5z"/>'),
  contacts: SVG('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  bed: SVG('<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>'),
  chat: SVG('<path d="M4 5h16v11H9l-5 4z"/>'),
  train: SVG('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>'),
};
const mapBtn = (q, solid = false) => `<a class="btn ${solid ? 'solid' : ''}" data-q="${esc(q)}" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(q)}">${ICON.places}${tr(UI.openMap)}</a>`;
const isTodo = (s) => /TODO/.test(s);
const validPhone = (p) => p && !isTodo(p) && PHONE.test(p);
function phoneBtn(p, solid = false, extra = '') {
  if (!p) return '';
  if (!validPhone(p)) return `<span class="btn ghost">${ICON.contacts}${plain(p)}</span>`;
  return `<a class="btn ${solid ? 'solid' : ''} ${extra}" href="tel:${p.replace(/[^\d+]/g, '')}">${ICON.contacts}${esc(p)}</a>`;
}
function kakaoBtn(k) {
  if (!k) return '';
  if (!KAKAO.test(k)) return `<span class="btn ghost">${ICON.chat}${plain(k)}</span>`;
  return `<a class="btn kakao" href="${esc(k)}" rel="noopener">${ICON.chat}${tr(UI.kakao)}</a>`;
}
const stayById = (id) => stays.stays.find((x) => x.id === id);
const cityName = (id) => site.cities.find((c) => c.id === id).name;

/* ---------- sections ---------- */
function renderItem(it) {
  const badges = [];
  if (it.type === 'reserve') badges.push(`<span class="badge reserve">${tr(UI.reserve)}</span>`);
  if (it.type === 'fixed') badges.push(`<span class="badge fixed">${tr(UI.fixed)}</span>`);
  if (it.type === 'optional') badges.push(`<span class="badge optional">${tr(UI.optional)}</span>`);
  if (it.type === 'taxi') badges.push(`<span class="badge taxi">${tr(UI.taxi)}</span>`);
  if (it.type === 'drive') badges.push(`<span class="badge taxi">${tr(UI.drive)}</span>`);
  const place = it.place ? places.places.find((p) => p.id === it.place) : null;
  const q = it.mapQuery || place?.mapQuery;
  const actions = [];
  if (q && it.type !== 'taxi' && it.type !== 'drive') actions.push(mapBtn(q));
  if (place) actions.push(`<a class="btn" href="#place-${place.id}">${tr(UI.about)}</a>`);
  const thumb = place?.image && it.type !== 'taxi' && it.type !== 'drive' ? `<img class="thumb" src="${esc(place.image.file)}" alt="" width="72" height="72" loading="lazy">` : '';
  const time = it.time ? `<span class="time">${it.time}</span>` : `<span class="time">${tr(it.when)}</span>`;
  return `<li class="item type-${it.type}"><div class="rail"></div><div class="card ${thumb ? 'has-thumb' : ''}">${thumb}
    <div class="meta">${time}${badges.join('')}</div>
    <h3>${tr(it.title)}</h3>
    ${it.note && (it.note.en || it.note.ko) ? `<p class="note">${tr(it.note)}</p>` : ''}
    ${actions.length ? `<div class="actions">${actions.join('')}</div>` : ''}
  </div></li>`;
}

function stayLine(st) {
  const nights = nightsBetween(st.from, st.to);
  const f = dateInfo(st.from), t = dateInfo(st.to);
  return `<div class="stay">
    <div class="stay-top">${ICON.bed}<div><b>${tr(st.name)}</b>
      <div class="sub">${plain(st.address)}</div>
      <div class="sub">${tr(f.short)} – ${tr(t.short)} · ${nights} ${tr(UI.nights)}</div></div></div>
    <div class="actions">${isTodo(st.mapQuery) ? '' : mapBtn(st.mapQuery)}${validPhone(st.phone) ? phoneBtn(st.phone) : ''}${KAKAO.test(st.kakao || '') ? kakaoBtn(st.kakao) : ''}</div>
  </div>`;
}

function routeMap() {
  const W = 320, H = 190, K = 40, KY = 60.8;
  const pos = site.cities.map((c, i) => ({ ...c, n: i + 1, x: Math.round((c.lon - 7.5) * K + 6), y: Math.round((50.6 - c.lat) * KY + 12) }));
  const line = pos.map((p) => `${p.x},${p.y}`).join(' ');
  const dots = pos.map((p) => {
    const left = p.x > 230;
    return `<g><circle cx="${p.x}" cy="${p.y}" r="10" fill="#1f6f67"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${p.n}</text>
      <text x="${p.x + (left ? -15 : 15)}" y="${p.y + 4}" text-anchor="${left ? 'end' : 'start'}" font-size="13" font-weight="600" fill="#16302f" stroke="#e6f0ef" stroke-width="4" paint-order="stroke"><tspan lang="en">${esc(p.name.en)}</tspan><tspan lang="ko">${esc(p.name.ko)}</tspan></text></g>`;
  }).join('');
  return `<svg class="route-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Route: ${site.cities.map((c) => esc(c.name.en)).join(', ')}">
    <rect width="${W}" height="${H}" rx="14" fill="#e6f0ef"/>
    <polyline points="${line}" fill="none" stroke="#1f6f67" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

function renderOverview() {
  const legs = site.cities.map((c, i) => {
    const days = itinerary.days.filter((d) => d.city === c.id);
    if (!days.length) return '';
    const a = dateInfo(days[0].id), b = dateInfo(days[days.length - 1].id);
    const cs = stays.stays.filter((x) => x.city === c.id);
    return `<article class="card leg"><div class="leg-head"><span class="leg-n">${i + 1}</span><div><h3>${tr(c.name)}</h3><div class="sub">${tr(a.short)} – ${tr(b.short)}</div></div></div>
      ${cs.map(stayLine).join('')}</article>`;
  }).join('');
  return `<article class="day ov" data-date="overview">
    <header class="day-head"><h2 class="serif">${tr(UI.route)}</h2></header>
    ${routeMap()}
    <div class="stack" style="margin-top:12px">${legs}</div></article>`;
}

function renderPlan() {
  const chips = [`<button class="chip wide" role="tab" data-day="overview" aria-selected="false"><b>${tr(UI.overview)}</b></button>`]
    .concat(itinerary.days.map((d) => {
      const di = dateInfo(d.id);
      return `<button class="chip" role="tab" data-day="${d.id}" aria-selected="false"><small>${tr(di.wd)}</small><b>${tr(di.short)}</b></button>`;
    })).join('');
  const days = itinerary.days.map((d) => {
    const di = dateInfo(d.id);
    return `<article class="day" data-date="${d.id}">
      <header class="day-head"><div class="date">${tr(di.label)} · ${tr(cityName(d.city))}<span class="today-tag" data-for="${d.id}" hidden>${tr(UI.today)}</span></div><h2 class="serif">${tr(d.title)}</h2></header>
      ${(d.stay || []).length ? `<details class="card stays"><summary>${ICON.bed}${tr(UI.stay)}</summary>${d.stay.map((id) => stayLine(stayById(id))).join('')}</details>` : ''}
      <ol class="tl">${d.items.map(renderItem).join('')}</ol></article>`;
  }).join('');
  return `<section id="plan" class="tab">
    <div class="daybar" role="tablist">${chips}</div>
    ${renderOverview()}
    ${days}
  </section>`;
}

const ACCESS_UI = { easy: UI.easy, moderate: UI.moderate, hard: UI.hard };
function renderPlaces() {
  const cards = places.places.map((p) => `<article class="card place" id="place-${p.id}">
    ${p.image ? `<figure class="hero"><img src="${esc(p.image.file)}" alt="" width="${p.image.w}" height="${p.image.h}" loading="lazy"><figcaption>${tr(UI.photo)}: ${esc(p.image.credit)} · <a href="${esc(p.image.source)}" rel="noopener" target="_blank">Wikimedia Commons</a></figcaption></figure>` : ''}
    <div class="badges"><span class="badge ${p.access}">${tr(ACCESS_UI[p.access])}</span>${p.verified ? '' : `<span class="badge verify">${tr(UI.verify)}</span>`}</div>
    <h2>${tr(p.name)}</h2>
    <p>${tr(p.desc)}</p>
    <dl class="facts">
      <div><dt>${tr(UI.hours)}</dt><dd>${tr(p.hours)}</dd></div>
      <div><dt>${tr(UI.access)}</dt><dd>${tr(p.accessNote)}</dd></div>
      <div><dt>${tr(UI.tickets)}</dt><dd>${tr(p.tickets)}</dd></div>
      <div><dt>${tr(UI.address)}</dt><dd class="addr">${plain(p.address)}</dd></div>
    </dl>
    <div class="actions">${mapBtn(p.mapQuery)}${p.link ? `<a class="btn" href="${esc(p.link)}" rel="noopener" target="_blank">${tr(UI.site)}</a>` : ''}</div>
  </article>`).join('');
  return `<section id="places" class="tab stack" hidden><h2 class="page-title serif">${tr(UI.places)}</h2>${cards}</section>`;
}

function renderFlights() {
  const nameOf = (id) => tr(flights.travelers.find((x) => x.id === id).name);
  const chips = [`<button class="chip pick" data-who="all" aria-pressed="true">${tr(UI.everyone)}</button>`]
    .concat(flights.travelers.map((x) => `<button class="chip pick" data-who="${esc(x.id)}" aria-pressed="false">${tr(x.name)}</button>`)).join('');
  const sorted = [...flights.trips].sort((a, b) => (a.date + a.dep).localeCompare(b.date + b.dep));
  const dates = [...new Set(sorted.map((f) => f.date))];
  const groups = dates.map((date) => {
    const di = dateInfo(date);
    const cards = sorted.filter((f) => f.date === date).map((f) => `<article class="card trip" data-who="${f.who.join(' ')}">
      <div class="meta"><span class="badge taxi">${tr(f.kind === 'train' ? UI.train : UI.flight)}</span><span class="num-label">${plain(f.number)}</span>
        <span class="who">${f.who.map((w) => `<b>${nameOf(w)}</b>`).join('')}</span></div>
      <div class="legs"><div><div class="code">${esc(f.from)}</div><div class="clock">${f.dep}</div></div>
        <div class="arrow" aria-hidden="true">${f.kind === 'train' ? ICON.train : ICON.flights}</div>
        <div><div class="code">${esc(f.to)}</div><div class="clock">${f.arr ? `${f.arr}${f.nextDay ? `<small> +1 ${tr(UI.nextDay)}</small>` : ''}` : '–'}</div></div></div>
      ${f.note ? `<p class="note">${tr(f.note)}</p>` : ''}
    </article>`).join('');
    return `<div class="flight-day" data-date="${date}"><h3 class="date-h">${tr(di.label)}</h3>${cards}</div>`;
  }).join('');
  return `<section id="flights" class="tab stack" hidden>
    <h2 class="page-title serif">${tr(UI.flights)}</h2>
    <div class="card"><h3>${tr(UI.travelers)}</h3><div class="field" style="margin-top:8px" role="group">${chips}</div>
      <p class="sub" style="margin-top:8px">${tr(UI.travelersHelp)}</p></div>
    ${groups}
  </section>`;
}

function taxiCard(st) {
  const L = contacts.taxi[st.lang];
  return `<div class="taxi-card"><div class="badges"><span class="badge taxi">${tr(UI.taxiTitle)}</span></div>
    <p class="cz">${esc(L.intro)}</p><p class="cz-addr">${plain(st.address)}</p>
    ${validPhone(st.phone) ? `<p class="cz">${esc(L.phone)} <b>${esc(st.phone)}</b></p>` : ''}
    <p class="cz">${esc(L.outro)}</p></div>`;
}

function renderStays() {
  const stayCards = stays.stays.map((st) => {
    const f = dateInfo(st.from), t = dateInfo(st.to);
    return `<article class="card"><div class="badges"><span class="badge taxi">${tr(cityName(st.city))}</span></div>
      <h2>${tr(st.name)}</h2><div class="sub">${tr(f.short)} – ${tr(t.short)}</div>
      <dl class="facts"><div><dt>${tr(UI.address)}</dt><dd>${plain(st.address)}</dd></div>
      ${st.note ? `<div><dd>${tr(st.note)}</dd></div>` : ''}</dl>
      <div class="actions">${isTodo(st.mapQuery) ? '' : mapBtn(st.mapQuery, true)}${phoneBtn(st.phone)}${kakaoBtn(st.kakao)}</div>
      ${isTodo(st.address) ? '' : `<details class="taxi-details"><summary>${tr(UI.taxiTitle)}</summary>${taxiCard(st)}</details>`}
    </article>`;
  }).join('');
  return `<section id="stays" class="tab stack" hidden><h2 class="page-title serif">${tr(UI.stays)}</h2>${stayCards}</section>`;
}

function renderContacts() {
  const c = contacts;
  const emerg = c.emergency.map((e) => `<li class="row"><div><div class="big-num">${esc(e.phone)}</div><div class="sub">${tr(e.label)}</div></div>${phoneBtn(e.phone, true, 'danger')}</li>`).join('');
  const people = c.family.people.map((p) => `<li><div class="row"><h3>${tr(flights.travelers.find((x) => x.id === p.id).name)}</h3><div class="actions" style="margin:0">${phoneBtn(p.phone)}${kakaoBtn(p.kakao)}</div></div></li>`).join('');
  return `<section id="contacts" class="tab stack" hidden>
    <h2 class="page-title serif">${tr(UI.contacts)}</h2>
    <div class="card"><h2>${tr(UI.emergency)}</h2><ul class="list">${emerg}</ul></div>
    <div class="card"><h2>${tr(UI.family)}</h2>
      <div class="row" style="margin-top:8px"><b>${tr(c.family.groupChat.name)}</b>${kakaoBtn(c.family.groupChat.kakao)}</div>
      <ul class="list" style="margin-top:10px">${people}</ul></div>
    <div class="card"><h2>${tr(UI.embassy)}</h2><p>${tr(c.embassy.name)}</p><p class="sub">${plain(c.embassy.address)}</p><div class="actions">${phoneBtn(c.embassy.phone)}</div></div>
  </section>`;
}

function renderInfo() {
  const tips = info.tips.map((t) => `<article class="card"><h3>${tr(t.title)}</h3><p class="note">${tr(t.body)}</p></article>`).join('');
  const cur = ['CZK', 'EUR', 'USD', 'KRW'];
  const dateOk = DATE.test(info.currency.updated || '');
  return `<section id="info" class="tab stack" hidden>
    <h2 class="page-title serif">${tr(UI.info)}</h2>
    <article class="card"><h2>${tr(UI.money)}</h2>
      <div class="field" style="margin-top:10px"><label for="cur-amount" class="sub">${tr(UI.amount)}</label>
        <input id="cur-amount" type="text" inputmode="decimal" autocomplete="off" value="1000"></div>
      <div class="field" style="margin-top:10px" role="group">${cur.map((c) => `<button class="chip cur" data-cur="${c}" aria-pressed="${c === 'CZK'}">${c}</button>`).join('')}</div>
      <div class="cur-out">${cur.map((c) => `<div><small>${c}</small><b data-out="${c}"></b></div>`).join('')}</div>
      <p class="sub" style="margin-top:10px">${tr(UI.rateNote)} ${dateOk ? `${tr(UI.rateDate)} ${esc(info.currency.updated)}` : plain(info.currency.updated)}</p>
    </article>
    <h2 class="page-title serif">${tr(UI.tips)}</h2>${tips}
  </section>`;
}

function renderPage(version) {
  const cfg = { days: itinerary.days.map((d) => d.id), timezone: site.timezone || 'Europe/Prague', rates: info.currency.rates };
  return `<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(site.title.en)} · ${esc(site.title.ko)}</title>
<meta name="description" content="${esc(site.tagline.en)} / ${esc(site.tagline.ko)}">
<meta name="theme-color" content="#ffffff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Family Trip">
<meta name="build" content="${version}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="style.css">
<script>(function(){var d=document.documentElement,l;d.classList.add('js');try{l=localStorage.getItem('lang')}catch(e){}if(l!=='en'&&l!=='ko'){l=((navigator.languages&&navigator.languages[0])||navigator.language||'en').toLowerCase().indexOf('ko')===0?'ko':'en'}d.setAttribute('data-lang',l);d.lang=l})();</script>
</head>
<body>
<header class="top">
  <div class="top-row">
    <p class="tagline">${tr(site.tagline)}</p>
    <div class="seg" role="group" aria-label="Language / 언어"><button data-setlang="en" aria-pressed="true">EN</button><button data-setlang="ko" aria-pressed="false">한국어</button></div>
  </div>
  <h1 class="serif">${tr(site.title)}</h1>
  <div class="status"><span class="pill" id="chip-ready" hidden>✓ ${tr(UI.online)}</span><span class="pill warn" id="chip-offline" hidden>${tr(UI.offline)}</span></div>
</header>
<main>
${renderPlan()}
${renderPlaces()}
${renderFlights()}
${renderStays()}
${renderContacts()}
${renderInfo()}
</main>
<button class="today-fab" id="today-fab" hidden>${tr(UI.goToday)}</button>
<button class="update" id="update" hidden>${tr(UI.update)}</button>
<nav class="nav" aria-label="Main">
  <a href="#plan">${ICON.plan}${tr(UI.plan)}</a>
  <a href="#places">${ICON.places}${tr(UI.places)}</a>
  <a href="#flights">${ICON.flights}${tr(UI.flights)}</a>
  <a href="#stays">${ICON.bed}${tr(UI.stays)}</a>
  <a href="#contacts">${ICON.contacts}${tr(UI.contacts)}</a>
  <a href="#info">${ICON.info}${tr(UI.info)}</a>
</nav>
<script type="application/json" id="cfg">${JSON.stringify(cfg)}</script>
<script src="app.js"></script>
</body>
</html>
`;
}

/* ---------- icons (drawn in code so no image tools are needed) ---------- */
function makePng(size, scale) {
  const S = 3; // supersampling
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const teal = [0x1f, 0x4e, 0x5f], white = [255, 255, 255], coral = [0xd8, 0x5a, 0x3a];
  const R = 0.5 * scale;
  const hand = (dx, dy, len, ang, w) => {
    const ux = Math.sin(ang), uy = -Math.cos(ang), t = dx * ux + dy * uy;
    return t >= 0 && t <= len * R && Math.abs(-dx * uy + dy * ux) <= w * R;
  };
  const at = (nx, ny) => {
    const dx = nx - 0.5, dy = ny - 0.5, d = Math.hypot(dx, dy);
    if (d <= R && d >= R * 0.8) return white;
    if (d <= R * 0.17) return coral;
    if (hand(dx, dy, 0.62, 0, 0.045) || hand(dx, dy, 0.45, Math.PI * 0.67, 0.045)) return white;
    return teal;
  };
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const c = at((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / (S * S); raw[o + 1] = g / (S * S); raw[o + 2] = b / (S * S); raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1f4e5f"/><circle cx="50" cy="50" r="40" fill="none" stroke="#fff" stroke-width="8"/><path d="M50 50V22M50 50l17 11" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><circle cx="50" cy="50" r="7" fill="#d85a3a"/></svg>`;

/* ---------- write dist ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(DIST, name), data);
const css = fs.readFileSync(path.join(ROOT, 'src/style.css'));
const js = fs.readFileSync(path.join(ROOT, 'src/app.js'));
const manifest = JSON.stringify({
  name: `${site.title.en} · ${site.title.ko}`,
  short_name: 'Family Trip',
  description: site.tagline.en,
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ffffff',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);

const hash = crypto.createHash('sha1');
[css, js, manifest, renderPage('')].forEach((x) => hash.update(x));
const version = hash.digest('hex').slice(0, 10);

write('index.html', renderPage(version));
write('style.css', css);
write('app.js', js);
write('manifest.webmanifest', manifest);
write('icon.svg', ICON_SVG);
write('icon-192.png', makePng(192, 0.78));
write('icon-512.png', makePng(512, 0.78));
write('icon-maskable-512.png', makePng(512, 0.58));
write('apple-touch-icon.png', makePng(180, 0.78));
write('.nojekyll', '');
fs.cpSync(path.join(ROOT, 'images'), path.join(DIST, 'images'), { recursive: true });
const imageFiles = fs.readdirSync(path.join(DIST, 'images/places')).sort().map((f) => `images/places/${f}`);

const assets = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', ...imageFiles];
write('sw.js', `const CACHE = 'family-trip-${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
`);

console.log(`✔  Built dist/ (version ${version}), ${assets.length} files cached for offline use.`);
