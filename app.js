// 交互逻辑：历史时间轴 + 主地图（路线/城市点，可缩放拖动）+ 每日详解（城市层级）
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// 底图 SVG 像素空间（0 0 1579.4531 677.31348），与底图校准一致
const X = lon => (lon - 25.5) / 20 * 1579.4531;
const Y = lat => (42.5 - lat) / 7 * 677.31348;

const TRIP_START_DAY = 3; // 集合日 10/3
const dayDate = d => `10/${TRIP_START_DAY + d - 1}`;

// 行程路线（按天序途经的城市坐标，lon/lat）
const ROUTE = [
  [28.98, 41.01],  // 伊斯坦布尔（起点）
  [34.83, 38.64],  // 卡帕多奇亚（内飞）
  [32.48, 37.87],  // 孔亚（D4 午餐经停）
  [30.71, 36.89],  // 安塔利亚
  [29.85, 36.19],  // 凯科瓦
  [29.12, 36.65],  // 费特希耶
  [29.09, 37.78],  // 棉花堡
  [27.60, 37.93],  // 希林杰
  [27.36, 37.94],  // 以弗所
  [27.14, 38.42],  // 伊兹密尔
  [29.06, 40.19],  // 布尔萨
  [28.98, 41.01]   // 回到伊斯坦布尔
];

let curPeriod = 0, curDay = 0;

/* ---------- 图片 + 署名 ---------- */
function imgTag(key, cls = '') {
  const c = CREDITS[key];
  if (!c) return '';
  return `<figure class="spot-img ${cls}">
    <img src="assets/img/${c.file}" alt="${c.desc}" loading="lazy">
    <figcaption>▲ ${c.desc}　<span class="cr">${c.artist ? c.artist + ' · ' : ''}${c.license}</span></figcaption>
  </figure>`;
}

/* ---------- 历史视图 ---------- */
function renderTimeline() {
  $('#timeline').innerHTML = PERIODS.map((p, i) => `
    <div class="tl-item ${i === curPeriod ? 'on' : ''}" data-i="${i}">
      <div class="tl-name" style="--dot:${p.color}">${p.name}</div>
      <div class="tl-time">${p.time}</div>
    </div>`).join('');
  $$('#timeline .tl-item').forEach(el =>
    el.onclick = () => { curPeriod = +el.dataset.i; renderTimeline(); renderPeriodDetail(); });
}

/* ---------- 主地图（土耳其共和国时期：底图 + 行程路线） ---------- */
function renderTurkeyMap(svg) {
  const routePts = ROUTE.map(pt => `${X(pt[0]).toFixed(1)},${Y(pt[1]).toFixed(1)}`).join(' ');
  const route = `
    <polyline points="${routePts}" fill="none" stroke="#B3342A" stroke-width="4"
      stroke-dasharray="12 8" stroke-opacity=".7" stroke-linecap="round" stroke-linejoin="round">
      <title>本次行程路线（D1–D9 环线）</title></polyline>`;
  const cityDots = CITIES.map(c => {
    const dx = c.dx || 0, dy = c.dy || 0;
    const anchor = c.anchor || 'middle';
    return `
    <g class="city" data-day="${c.day}" transform="translate(${X(c.lon).toFixed(1)},${Y(c.lat).toFixed(1)})">
      <circle r="7" fill="#B3342A" stroke="#fff" stroke-width="2.5"></circle>
      <text x="${dx}" y="${-13 + dy}" font-size="21" text-anchor="${anchor}" fill="#1B1812" font-weight="bold"
        stroke="#FBFAF7" stroke-width="4" paint-order="stroke" style="pointer-events:none">${c.name}</text>
      <text x="${dx}" y="${30 + dy}" font-size="16" text-anchor="${anchor}" fill="#B3342A" font-weight="bold"
        stroke="#FBFAF7" stroke-width="3.5" paint-order="stroke" style="pointer-events:none">${c.day}</text>
    </g>`;}).join('');
  svg.innerHTML = route + cityDots;
  [...svg.querySelectorAll('.city')].forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = () => { if (justDragged) return; switchView('days', dayFromTag(el.dataset.day)); };
  });
}

function dayFromTag(tag) {
  const m = tag.match(/D(\d)/);
  return m ? Math.min(8, +m[1] - 1) : 0;
}

function renderPeriodDetail() {
  const p = PERIODS[curPeriod];
  const isRep = p.id === 'republic';
  // 时期地图：共和国→土耳其底图+行程路线（可缩放）；其他时期→疆域全图
  const mapBlock = isRep ? `
    <div class="period-map">
      <div class="sec-label">行程路线 · D1–D9 环线</div>
      <div class="map-box">
        <div class="map-inner">
          <img src="assets/img/base-map.png" alt="土耳其底图">
          <svg id="mapSvg" viewBox="0 0 1579.4531 677.31348" preserveAspectRatio="none"></svg>
        </div>
        <div id="zoomCtl">
          <button id="zIn" title="放大">＋</button>
          <button id="zOut" title="缩小">－</button>
          <button id="zReset" title="复位">⟲</button>
        </div>
      </div>
      <p class="map-note">红线 = 行程环线，红点 = 行程城市（点红点跳当天）。双指/滚轮缩放，拖动平移，⟲ 复位。</p>
    </div>` : '';
  const ekey = 'empire-' + p.id;
  const empireFig = CREDITS[ekey] && !isRep ? `
    <div class="empire-box period-map">
      <div class="sec-label">${p.name} · 疆域全图</div>
      ${imgTag(ekey, 'empire-img')}
      <p class="empire-note">极盛时期完整疆域示意（图片来源 Wikimedia Commons，署名见图注）；你们实际走行的环线见"土耳其共和国"部分。</p>
    </div>` : '';
  $('#periodDetail').innerHTML = `
    <div class="pd-head">
      <span class="pd-sq" style="background:${p.color}"></span>
      <h3>${p.name}</h3><span class="pd-time">${p.time}</span>
    </div>
    ${mapBlock}
    ${empireFig}
    <div class="pd-grid">
      ${p.img ? imgTag(p.img, 'pd-img') : ''}
      <div>
        <p class="pd-west">${p.west}</p>
        <p class="pd-east">${p.east}</p>
        <p>${p.anatolia}</p>
        <p class="pd-sites">行程关联：${p.sites}</p>
      </div>
    </div>`;
  if (isRep) {
    const svg = $('#mapSvg');
    vb = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    mapBoxEl = svg.closest('.map-box');
    mapInnerEl = mapBoxEl.querySelector('.map-inner');
    renderTurkeyMap(svg);
    bindMapNav(svg);
    applyVB();
  }
}

/* ---------- 地图缩放 / 拖动（整层 transform：底图与标注同步缩放） ---------- */
const MAP_W = 1579.4531, MAP_H = 677.31348;
let vb = { x: 0, y: 0, w: MAP_W, h: MAP_H };
let justDragged = false;
let mapBoxEl = null, mapInnerEl = null;
window.addEventListener('resize', applyVB);
function applyVB() {
  if (!mapInnerEl || !mapBoxEl) return;
  const scale = mapBoxEl.clientWidth / vb.w;
  mapInnerEl.style.transform =
    `translate(${(-vb.x * scale).toFixed(1)}px, ${(-vb.y * scale).toFixed(1)}px) scale(${scale.toFixed(4)})`;
}
function clampVB() {
  vb.w = Math.min(MAP_W, Math.max(MAP_W / 6, vb.w));
  vb.h = vb.w * (MAP_H / MAP_W);
  vb.x = Math.max(0, Math.min(MAP_W - vb.w, vb.x));
  vb.y = Math.max(0, Math.min(MAP_H - vb.h, vb.y));
}
function zoomBy(f, cx, cy) {
  const kx = cx == null ? vb.x + vb.w / 2 : cx;
  const ky = cy == null ? vb.y + vb.h / 2 : cy;
  vb.x = kx - (kx - vb.x) * f;
  vb.y = ky - (ky - vb.y) * f;
  vb.w *= f;
  clampVB();
  applyVB();
}
function resetVB() { vb = { x: 0, y: 0, w: MAP_W, h: MAP_H }; applyVB(); }

function bindMapNav(svg) {
  if (svg.dataset.navBound) return;
  svg.dataset.navBound = '1';
  const pts = new Map();
  let start = null, pinchDist = 0;

  function svgPoint(e) {
    const r = svg.getBoundingClientRect();
    return {
      x: vb.x + (e.clientX - r.left) / r.width * vb.w,
      y: vb.y + (e.clientY - r.top) / r.height * vb.h,
    };
  }
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) start = { x: e.clientX, y: e.clientY, vb: { ...vb } };
    if (pts.size === 2) {
      const a = [...pts.values()];
      pinchDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (pts.size === 1 && start) {
      const dx = (e.clientX - start.x) / r.width * vb.w;
      const dy = (e.clientY - start.y) / r.height * vb.h;
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 5) {
        justDragged = true;
        svg.classList.add('dragging');
      }
      vb.x = start.vb.x - dx;
      vb.y = start.vb.y - dy;
      clampVB();
      applyVB();
    } else if (pts.size === 2) {
      const a = [...pts.values()];
      const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinchDist > 0 && d > 0) zoomBy(pinchDist / d);
      pinchDist = d;
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size === 0) { start = null; svg.classList.remove('dragging'); setTimeout(() => justDragged = false, 60); }
    if (pts.size < 2) pinchDist = 0;
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = svgPoint(e);
    zoomBy(e.deltaY > 0 ? 1.2 : 0.83, p.x, p.y);
  }, { passive: false });
  const box = svg.parentElement;
  box.querySelector('#zIn').onclick = () => zoomBy(0.7);
  box.querySelector('#zOut').onclick = () => zoomBy(1.35);
  box.querySelector('#zReset').onclick = resetVB;
}

/* ---------- 每日视图 ---------- */
function renderDayNav() {
  $('#dayNav').innerHTML = DAYS.map((d, i) =>
    `<button class="${i === curDay ? 'on' : ''}" data-i="${i}">D${d.d}</button>`).join('');
  $$('#dayNav button').forEach(b => b.onclick = () => { curDay = +b.dataset.i; renderDay(); });
}

function scheduleHTML(d) {
  const list = (SCHEDULES[d.d] || []);
  return `
    <div class="sec-label">今日行程</div>
    <ol class="tl">
      ${list.map(s => `<li class="e ${s.lv === 2 ? 'l2' : ''} ${s.self ? 'self' : ''}">
        <span class="t">${s.t}</span><span class="dot"></span><p class="c">${s.c}</p>
      </li>`).join('')}
    </ol>
    <p class="tl-legend"><i></i>既定行程&nbsp;&nbsp;<i class="r"></i>自行安排 / 推荐&nbsp;&nbsp;·&nbsp;&nbsp;灰字小字 = 交通、住宿（二级信息）<br>具体时间来自路书或你的预订，其余为大概时段；写"推荐"的是建议而非既定安排</p>`;
}

function spotsHTML(spots) {
  return spots.map(s => `
    <article class="spot">
      ${s.img ? imgTag(s.img) : ''}
      <h4>${s.name}</h4>
      <p class="spot-his">${s.history}</p>
      <ul class="spot-see">${s.see.map(x => `<li>${x}</li>`).join('')}</ul>
    </article>`).join('');
}

function citySectionHTML(c, i) {
  const kick = `<div class="city-kicker">城市 ${i + 1}${c.tag ? ' · ' + c.tag : ''}</div>`;
  // 已介绍过的城市：弱化标题 + 返回链接 + 仅今日景点
  if (c.repeat) {
    return `
    <section class="city-sec repeat">
      <header class="city-head">${kick}
        <button class="backref" data-goday="${c.repeat.replace('D', '')}">城市介绍见 ${c.repeat} ↩</button>
      </header>
      <h3>${c.name}<span class="note-sec">　今日只列看点</span></h3>
      ${c.spots && c.spots.length ? `<div class="city-body"><div class="block spots-block">${spotsHTML(c.spots)}</div></div>` : ''}
    </section>`;
  }
  // 仅夜抵/经停的迷你板块
  if (c.mini) {
    return `
    <section class="city-sec mini">
      <header class="city-head">${kick}</header>
      <h3>${c.name}</h3>
      <div class="city-body">
        ${c.history.map(p => `<p class="mini-p">${p}</p>`).join('')}
        ${c.culture && c.culture.length ? `<ul class="city-culture">${c.culture.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      </div>
    </section>`;
  }
  // 完整城市板块
  return `
    <section class="city-sec">
      <header class="city-head">${kick}</header>
      <h3>${c.name}</h3>
      <div class="city-body">
        <div class="block history-block">
          <h5>历史脉络</h5>
          ${c.history.map(p => `<p>${p}</p>`).join('')}
        </div>
        ${c.culture && c.culture.length ? `
        <div class="block culture-block">
          <h5>风土人情</h5>
          <ul class="city-culture">${c.culture.map(x => `<li>${x}</li>`).join('')}</ul>
        </div>` : ''}
        ${c.spots && c.spots.length ? `
        <div class="block spots-block">
          <h5>今日到访 · 我们会去</h5>
          ${spotsHTML(c.spots)}
        </div>` : ''}
      </div>
    </section>`;
}

function renderDay() {
  const d = DAYS[curDay];
  $$('#dayNav button').forEach((b, i) => b.classList.toggle('on', i === curDay));
  $('#dayTitle').innerHTML = `
    <div class="kicker">Day ${d.d} — ${dayDate(d.d)}</div>
    <h2>${d.title}</h2>`;
  $('#daySchedule').innerHTML = scheduleHTML(d);
  // 第二个板块：当天到访城市挨个介绍（含图景点 = 行程内我们会去的地方）
  $('#dayHistory').innerHTML = `
    <p class="cities-note">每个城市在其首次到访当天完整介绍（历史脉络 → 风土人情 → 今日到访，含图 = 行程中实际会去）；之后再次出现只列当日看点。当天不去的景点见文末"自由可选"。</p>
    ${d.cities.map(citySectionHTML).join('')}`;
  $$('#dayHistory .backref').forEach(b => b.onclick = () => {
    curDay = Math.min(8, +b.dataset.goday - 1);
    renderDayNav(); renderDay();
  });
  const ex = EXTRA[d.d];
  $('#dayExtra').innerHTML = `
    <div class="extra">
      <div class="extra-label">自由可选 · 建议</div>
      <h3>${ex.title}</h3>
      <ul>${ex.items.map(c => `<li>${c}</li>`).join('')}</ul>
    </div>`;
  window.scrollTo({ top: 0 });
}

/* ---------- 视图切换 ---------- */
function switchView(v, dayIdx) {
  if (typeof dayIdx === 'number') curDay = dayIdx;
  $('#view-history').classList.toggle('on', v === 'history');
  $('#view-days').classList.toggle('on', v === 'days');
  $$('.topnav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'days') { renderDayNav(); renderDay(); }
  else window.scrollTo({ top: 0 });
}

$$('.topnav button').forEach(b => b.onclick = () => switchView(b.dataset.v));

renderTimeline(); renderPeriodDetail();
// 支持深链：#days 打开每日详解（首次），#days-N 直接定位到第 N 天
const _h = location.hash.match(/^#days(?:-(\d+))?/);
if (_h) switchView('days', _h[1] ? Math.min(8, +_h[1] - 1) : 0);
else switchView('history');
