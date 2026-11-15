/* project visuals — one animated scene per project, drawn on a 2d canvas.
   each factory gets the 2d ctx and a getSize() that returns css pixels
   (ctx is already dpr-scaled by main.js so everything draws in css units).
   each returns a frame(t) function where t is seconds since start.
   the scenes are illustrations of what each project does, not live data. */

(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const frac = (v) => v - Math.floor(v);
  const ease = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const hash = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  const INK = '244,242,236';

  function text(ctx, s, x, y, color, size, align, weight) {
    ctx.font = `${weight || 500} ${size || 10}px ${MONO}`;
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function fill(ctx, w, h, top, bot) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  function glow(ctx, x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  const topOf = (h) => (h < 320 ? 52 : 58);   // room for the label chip in the corner

  /* 1) ALPHALAB — scrolling candles, ticker tape, equity curve, 118-module gauntlet */
  function alphalab(ctx, getSize) {
    const price = (i) => Math.sin(i * 0.21) * 18 + Math.sin(i * 0.057) * 34 + Math.sin(i * 0.93) * 5 + (hash(i) - 0.5) * 9 + i * 0.35;
    const names = ['TREND', 'MOMENTUM', 'STAT-ARB', 'VOLATILITY', 'FACTOR', 'ML', 'CARRY', 'MEAN-REV'];
    const UP = '#5B93FF', DN = '#FF5D73';
    let lo = null, hi = null;
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#070A14', '#04050B');
      // ticker tape
      let x = -((t * 40) % 1280);
      for (let k = 0; k < 24; k++) {
        const up = hash(k % 8 * 3 + Math.floor(t / 4)) > 0.4;
        text(ctx, `${names[k % 8]} ${up ? '▲' : '▼'} ${(hash(k % 8 + 7) * 2.4).toFixed(2)}%`, x, top + 6, up ? UP : DN, 10);
        x += 160;
      }
      // candles
      const chartH = (h - top) * 0.44, y1 = top + 30 + chartH, cw = 12, n = Math.ceil(w / cw) + 2;
      const sc = t * 1.6, i0 = Math.floor(sc), off = frac(sc) * cw;
      let a = 1e9, b = -1e9;
      for (let i = 0; i <= n; i++) { const p = price(i0 + i); a = Math.min(a, p - 9); b = Math.max(b, p + 9); }
      lo = lo === null ? a : lerp(lo, a, 0.08); hi = hi === null ? b : lerp(hi, b, 0.08);
      const Y = (p) => y1 - ((p - lo) / (hi - lo)) * chartH;
      ctx.strokeStyle = `rgba(${INK},.06)`; ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) { const gy = y1 - (chartH * g) / 4; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
      for (let i = 0; i < n; i++) {
        const o = price(i0 + i), c = price(i0 + i + 1), up = c >= o, cx = i * cw - off;
        ctx.strokeStyle = ctx.fillStyle = up ? UP : DN;
        ctx.beginPath(); ctx.moveTo(cx + cw / 2, Y(Math.max(o, c) + hash(i0 + i) * 6)); ctx.lineTo(cx + cw / 2, Y(Math.min(o, c) - hash(i0 + i + 9) * 6)); ctx.stroke();
        ctx.fillRect(cx + 2, Math.min(Y(o), Y(c)), cw - 4, Math.max(2, Math.abs(Y(o) - Y(c))));
        const v = (0.25 + hash(i0 + i + 31) * 0.75) * chartH * 0.16;
        ctx.globalAlpha = 0.32; ctx.fillRect(cx + 2, y1 + chartH * 0.2 - v, cw - 4, v); ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 7; k++) s += price(i0 + i - k); const px = i * cw - off + cw / 2, py = Y(s / 7); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.strokeStyle = `rgba(${INK},.85)`; ctx.lineWidth = 1.5; ctx.stroke();
      // crosshair
      const chx = w * (0.5 + 0.36 * Math.sin(t * 0.45));
      ctx.setLineDash([3, 4]); ctx.strokeStyle = `rgba(${INK},.35)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(chx, top + 22); ctx.lineTo(chx, y1 + chartH * 0.2); ctx.stroke(); ctx.setLineDash([]);
      // lower deck: equity curve + module grid
      const y0 = y1 + chartH * 0.2 + 22, bh = h - y0 - 16, lw = w * 0.52 - 24;
      if (bh < 40) return;
      text(ctx, 'STRATEGY vs BENCHMARK', 16, y0, `rgba(${INK},.5)`, 9);
      const prog = clamp(frac(t / 9) * 1.25, 0, 1), pts = 60;
      [[0.45, 0.3, 5, `rgba(${INK},.35)`], [0.95, 0.5, 4, UP]].forEach(([slope, f, amp, col], q) => {
        ctx.beginPath();
        for (let j = 0; j <= pts * prog; j++) {
          const v = j * slope + Math.sin(j * f) * amp + Math.sin(j * 0.13) * 6;
          const px = 16 + (j / pts) * lw, py = y0 + bh - 4 - (v / 70) * (bh - 20);
          if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.strokeStyle = col; ctx.lineWidth = q ? 2 : 1.2; ctx.stroke();
      });
      const gx = w * 0.52 + 8, cols = 12, cs = Math.min((w - gx - 16) / cols, (bh - 16) / 10), cur = Math.floor(frac(t / 12) * 118);
      text(ctx, '118 MODULES · GAUNTLET', gx, y0, `rgba(${INK},.5)`, 9);
      for (let i = 0; i < 118; i++) {
        const px = gx + (i % cols) * cs, py = y0 + 12 + Math.floor(i / cols) * cs;
        ctx.fillStyle = i === cur ? '#fff' : i < cur ? (hash(i + 5) > 0.7 ? UP : `rgba(${INK},.2)`) : `rgba(${INK},.07)`;
        ctx.fillRect(px, py, cs - 2, cs - 2);
      }
    };
  }

  /* 2) TERRASIGHT — tilted dotted globe, hazard pings, cascade arcs, scan ring, risk table */
  function terrasight(ctx, getSize) {
    const dots = [];
    for (let lat = -80; lat <= 80; lat += 10) {
      const n = Math.max(6, Math.round(40 * Math.cos((lat * Math.PI) / 180)));
      for (let i = 0; i < n; i++) dots.push([(lat * Math.PI) / 180, (i / n) * TAU]);
    }
    const hz = [[0.62, 4.2, '255,122,61', 'WILDFIRE'], [0.2, 1.3, '79,216,255', 'FLOOD'], [-0.4, 2.6, '255,196,61', 'HEATWAVE'], [0.85, 0.4, '91,147,255', 'HURRICANE'], [-0.15, 5.3, '255,77,109', 'EARTHQUAKE'], [0.45, 3.1, '167,139,250', 'AIR QUALITY']];
    const links = [[0, 5], [2, 0], [3, 1], [4, 1]];
    const T = 0.38, cT = Math.cos(T), sT = Math.sin(T);
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#050A12', '#03060A');
      const panel = h > 320 ? 108 : 0, cx = w / 2, cy = top + (h - top - panel) / 2, R = Math.min(w * 0.4, (h - top - panel) * 0.42), rot = t * 0.22;
      const proj = (lat, lon) => {
        const l = lon + rot, x = Math.cos(lat) * Math.sin(l), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(l);
        return [cx + R * x, cy - R * (y * cT - z * sT), y * sT + z * cT];
      };
      glow(ctx, cx, cy, R * 1.7, '79,216,255', 0.16);
      // orbit (back half), globe, orbit (front half)
      const orbit = (front) => {
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) { const a = (front ? 0 : Math.PI) + (k / 40) * Math.PI, ox = Math.cos(a) * R * 1.32, oy = Math.sin(a) * R * 0.34; const px = cx + ox * 0.94 - oy * 0.34, py = cy + ox * 0.34 + oy * 0.94; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.strokeStyle = 'rgba(79,216,255,.28)'; ctx.lineWidth = 1; ctx.stroke();
      };
      orbit(false);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = '#060D16'; ctx.fill(); ctx.strokeStyle = 'rgba(79,216,255,.35)'; ctx.stroke();
      for (const d of dots) { const [x, y, z] = proj(d[0], d[1]); if (z < 0) continue; ctx.fillStyle = `rgba(200,240,255,${0.12 + z * 0.6})`; ctx.fillRect(x - 1, y - 1, 2, 2); }
      // scan ring sweeping north to south
      const sl = Math.sin(t * 0.6) * 1.25; ctx.beginPath(); let pen = false;
      for (let k = 0; k <= 72; k++) { const [x, y, z] = proj(sl, (k / 72) * TAU - rot); if (z < 0) { pen = false; continue; } if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; }
      ctx.strokeStyle = 'rgba(79,216,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      // cascade arcs between hazards
      const P = hz.map((q) => proj(q[0], q[1]));
      ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t * 26; ctx.lineWidth = 1.2;
      links.forEach(([i, j]) => {
        const p = P[i], q = P[j]; if (p[2] < 0.05 || q[2] < 0.05) return;
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, d = Math.hypot(mx - cx, my - cy) || 1;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(mx + ((mx - cx) / d) * R * 0.4, my + ((my - cy) / d) * R * 0.4, q[0], q[1]);
        ctx.strokeStyle = `rgba(${INK},.5)`; ctx.stroke();
      });
      ctx.setLineDash([]);
      hz.forEach((q, i) => {
        const [x, y, z] = P[i]; if (z < 0.08) return;
        const pulse = frac(t * 0.7 + i * 0.37);
        ctx.strokeStyle = `rgba(${q[2]},${(1 - pulse) * z})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 28, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(${q[2]},1)`; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
        if (z > 0.45 && w > 340) text(ctx, q[3], x + 9, y - 9, `rgba(${q[2]},${z})`, 9);
      });
      orbit(true);
      const sa = t * 0.9, sx0 = Math.cos(sa) * R * 1.32, sy0 = Math.sin(sa) * R * 0.34;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + sx0 * 0.94 - sy0 * 0.34, cy + sx0 * 0.34 + sy0 * 0.94, 2.5, 0, TAU); ctx.fill();
      // risk table
      if (!panel) return;
      const y0 = h - panel + 6, colW = (w - 32) / 2;
      hz.forEach((q, i) => {
        const px = 16 + (i % 2) * colW, py = y0 + Math.floor(i / 2) * 30, v = 0.3 + 0.65 * (Math.sin(t * 0.7 + i * 1.7) * 0.5 + 0.5);
        text(ctx, q[3], px, py, `rgba(${INK},.6)`, 9); text(ctx, Math.round(v * 100) + '%', px + colW - 16, py, `rgba(${q[2]},1)`, 9, 'right');
        ctx.fillStyle = `rgba(${INK},.1)`; ctx.fillRect(px, py + 9, colW - 16, 3);
        ctx.fillStyle = `rgba(${q[2]},.95)`; ctx.fillRect(px, py + 9, (colW - 16) * v, 3);
      });
    };
  }

  /* 3) FALLEN HOUR — pixel survival: torchlight, horde, tracer shots, portal, hotbar */
  function fallenhour(ctx, getSize) {
    const tile = 16;
    const h2 = (x, y) => frac(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
    const horde = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ a: i * 0.8, r: 0.26 + (i % 3) * 0.09, s: 0.3 + (i % 4) * 0.08 }));
    const snap = (v) => Math.round(v / 4) * 4;
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      ctx.fillStyle = '#0d0a12'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < Math.ceil(h / tile); y++) for (let x = 0; x < Math.ceil(w / tile); x++) {
        const v = h2(x, y);
        ctx.fillStyle = v > 0.93 ? '#2b1d3a' : v > 0.6 ? '#151020' : '#110d1a';
        ctx.fillRect(x * tile, y * tile, tile - 1, tile - 1);
        if (v > 0.965) { ctx.fillStyle = '#4FD8FF'; ctx.fillRect(x * tile + 5, y * tile + 5, 5, 5); }
      }
      const mid = top + (h - top - 40) / 2;
      const px = snap(w * 0.5 + Math.sin(t * 0.6) * w * 0.24), py = snap(mid + Math.sin(t * 1.2) * (h - top) * 0.16);
      const qx = snap(w * 0.82), qy = snap(top + (h - top) * 0.16);
      for (let i = 0; i < 4; i++) {
        const s = 10 + i * 8 + Math.sin(t * 3 + i) * 3;
        ctx.save(); ctx.translate(qx, qy); ctx.rotate(t * (i % 2 ? -0.8 : 0.8));
        ctx.strokeStyle = `rgba(167,139,250,${0.95 - i * 0.22})`; ctx.lineWidth = 2; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
      }
      glow(ctx, qx, qy, 60, '167,139,250', 0.25);
      const zs = horde.map((z) => { const ang = z.a + t * z.s, rad = Math.min(w, h) * (z.r + 0.08 * Math.sin(t * 0.9 + z.a)); return [snap(px + Math.cos(ang) * rad * 1.4), snap(py + Math.sin(ang) * rad)]; });
      // tracer: one shot every third of a second at the next enemy in line
      const shot = Math.floor(t * 3), ph = frac(t * 3), tg = zs[shot % zs.length];
      ctx.strokeStyle = '#FFA24D'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lerp(px, tg[0], Math.max(0, ph - 0.25)), lerp(py, tg[1], Math.max(0, ph - 0.25))); ctx.lineTo(lerp(px, tg[0], ph), lerp(py, tg[1], ph)); ctx.stroke();
      zs.forEach((z, i) => {
        const hit = i === shot % zs.length && ph > 0.8;
        ctx.fillStyle = hit ? '#fff' : '#FF4D6D'; ctx.fillRect(z[0] - 5, z[1] - 5, 10, 10);
        ctx.fillStyle = '#0d0a12'; ctx.fillRect(z[0] - 3, z[1] - 2, 2, 2); ctx.fillRect(z[0] + 1, z[1] - 2, 2, 2);
        if (hit) for (let k = 0; k < 6; k++) { ctx.fillStyle = '#FFA24D'; ctx.fillRect(z[0] + Math.cos(k) * 14 * ph, z[1] + Math.sin(k) * 14 * ph, 3, 3); }
      });
      glow(ctx, px, py, Math.min(w, h) * 0.5, '255,214,150', 0.22);
      ctx.fillStyle = '#F4F2EC'; ctx.fillRect(px - 6, py - 6, 12, 12);
      ctx.fillStyle = '#FFA24D'; ctx.fillRect(px - 6, py - 10, 12, 3);
      // hud: hearts, night bar, hotbar
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#FF4D6D'; ctx.fillRect(16 + i * 13, top, 9, 9); }
      text(ctx, 'NIGHT 3', w - 16, top + 4, `rgba(${INK},.6)`, 9, 'right');
      ctx.fillStyle = `rgba(${INK},.15)`; ctx.fillRect(w - 96, top + 14, 80, 4);
      ctx.fillStyle = '#FFA24D'; ctx.fillRect(w - 96, top + 14, 80 * frac(t * 0.06), 4);
      const sel = Math.floor(t / 1.5) % 5, bx = w / 2 - 5 * 15;
      const items = ['#F4F2EC', '#4FD8FF', '#FFA24D', '#A78BFA', '#FF4D6D'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(13,10,18,.85)'; ctx.fillRect(bx + i * 30, h - 40, 26, 26);
        ctx.strokeStyle = i === sel ? '#fff' : `rgba(${INK},.3)`; ctx.lineWidth = i === sel ? 2 : 1; ctx.strokeRect(bx + i * 30, h - 40, 26, 26);
        ctx.fillStyle = items[i]; ctx.fillRect(bx + i * 30 + 8, h - 32, 10, 10);
      }
    };
  }

  /* 4) GHOST WATT — a viewfinder walks an empty school, flags waste, ranks what to fix first */
  function ghostwatt(ctx, getSize) {
    const items = [['PROJECTOR', 310], ['VENDING', 420], ['LAB PCS', 260], ['HVAC ZONE', 880], ['SMARTBOARD', 150], ['HALL LIGHTS', 190]];
    const V = '184,166,255';
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#0A0814', '#05040B');
      const list = h > 320 ? Math.min(150, h * 0.3) : 0, gx = 16, gy = top + 4, gw = w - 32, gh = h - gy - list - 16, cw = gw / 3, ch = gh / 2;
      const room = (i) => [gx + (i % 3) * cw, gy + Math.floor(i / 3) * ch];
      const step = 2.2, tt = t % (step * 6 + 2), k = Math.min(5, Math.floor(tt / step)), p = ease(clamp((tt - k * step) / 0.7, 0, 1));
      // floor plan
      for (let i = 0; i < 6; i++) {
        const [x, y] = room(i), scanned = i < k || (i === k && p > 0.9);
        ctx.strokeStyle = `rgba(${V},.22)`; ctx.lineWidth = 1; ctx.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
        ctx.fillStyle = `rgba(${V},.04)`; ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
        const ax = x + cw * (0.3 + hash(i) * 0.4), ay = y + ch * (0.4 + hash(i + 3) * 0.3), s = Math.min(cw, ch) * 0.2;
        if (scanned) {
          glow(ctx, ax, ay, s * 2.6, items[i][1] > 300 ? '255,122,61' : V, 0.45);
          // ghost wisps rising off the wasted energy
          for (let g = 0; g < 4; g++) { const gp = frac(t * 0.35 + g * 0.25 + i * 0.1); ctx.fillStyle = `rgba(${V},${0.35 * (1 - gp)})`; ctx.beginPath(); ctx.arc(ax + Math.sin(t * 2 + g * 2) * 6, ay - gp * ch * 0.45, 5 * (1 - gp) + 1, 0, TAU); ctx.fill(); }
        }
        ctx.fillStyle = scanned ? '#F4F2EC' : `rgba(${V},.35)`; rr(ctx, ax - s / 2, ay - s / 2, s, s * 0.8, 3); ctx.fill();
        if (scanned && cw > 110) { text(ctx, items[i][0], x + 10, y + 16, `rgba(${INK},.75)`, 9); text(ctx, '⚡ ' + items[i][1] + ' W', x + 10, y + 30, '#FFA24D', 9); }
      }
      // viewfinder glides from room to room
      const [ax0, ay0] = room(Math.max(0, k - 1)), [bx0, by0] = room(k), vx = lerp(k ? ax0 : bx0, bx0, p) + 8, vy = lerp(k ? ay0 : by0, by0, p) + 8, vw = cw - 16, vh = ch - 16, c = 14;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
      [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(([fx, fy, dx, dy]) => { const x = vx + fx * vw, y = vy + fy * vh; ctx.moveTo(x + dx * c, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * c); });
      ctx.stroke();
      const sy = vy + frac(t * 0.9) * vh; ctx.fillStyle = `rgba(${V},.8)`; ctx.fillRect(vx, sy, vw, 1.5);
      if (frac(t * 1.2) < 0.5) { ctx.fillStyle = '#FF4D6D'; ctx.beginPath(); ctx.arc(vx + vw - 10, vy + 10, 3, 0, TAU); ctx.fill(); }
      // ranking: costliest waste first
      if (!list) return;
      const y0 = h - list, done = items.slice(0, tt > step * 6 ? 6 : k + (p > 0.9 ? 1 : 0)).sort((a, b) => b[1] - a[1]).slice(0, Math.floor((list - 22) / 20));
      text(ctx, 'FIX FIRST', 16, y0 + 6, `rgba(${V},1)`, 9);
      done.forEach((it, i) => {
        const y = y0 + 26 + i * 20, bw = (w - 150) * (it[1] / 880);
        text(ctx, String(i + 1).padStart(2, '0'), 16, y, `rgba(${INK},.45)`, 9); text(ctx, it[0], 38, y, `rgba(${INK},.85)`, 9);
        ctx.fillStyle = i ? `rgba(${V},.75)` : '#FFA24D'; rr(ctx, 124, y - 4, Math.max(4, bw), 8, 4); ctx.fill();
      });
    };
  }

  /* 5) BYTEBLITZ — two editors racing, tests lighting up, a countdown, Elo on the line */
  function byteblitz(ctx, getSize) {
    const A = '#FFB020', B = '#7CCBFF', tok = [A, `rgba(${INK},.55)`, '#FF6FB5', B, `rgba(${INK},.3)`];
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#0B0905', '#060504');
      const round = 8, tt = t % round, pr = tt / round, foot = h > 320 ? 96 : 34, pw = (w - 42) / 2, ph = h - top - foot - 8, lines = Math.max(4, Math.floor((ph - 44) / 15));
      [0, 1].forEach((s) => {
        const x = 16 + s * (pw + 10), y = top + 2, col = s ? B : A, speed = s ? 0.96 : 1.14, prog = clamp(pr * speed * 1.08, 0, 1);
        rr(ctx, x, y, pw, ph, 10); ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fill(); ctx.strokeStyle = `rgba(${INK},.12)`; ctx.lineWidth = 1; ctx.stroke();
        text(ctx, s ? 'OPPONENT' : 'YOU', x + 12, y + 16, col, 9); text(ctx, String(s ? 1467 : 1482), x + pw - 12, y + 16, `rgba(${INK},.6)`, 9, 'right');
        const shown = prog * lines;
        for (let l = 0; l < Math.min(lines, Math.ceil(shown)); l++) {
          const ly = y + 38 + l * 15, part = l < Math.floor(shown) ? 1 : frac(shown);
          let lx = x + 24 + (hash(l * 7 + s) > 0.55 ? 14 : 0) + (hash(l * 3 + s) > 0.8 ? 14 : 0), room = (pw - 44) * part;
          text(ctx, String(l + 1), x + 6, ly, `rgba(${INK},.2)`, 7);
          for (let k = 0; k < 4 && room > 0; k++) {
            const tw = Math.min(room, 12 + hash(l * 13 + k * 5 + s * 3) * pw * 0.26);
            ctx.fillStyle = tok[Math.floor(hash(l * 5 + k * 11 + s) * 5)]; rr(ctx, lx, ly - 3, tw, 6, 3); ctx.fill();
            lx += tw + 6; room -= tw + 6;
            if (lx > x + pw - 40) break;
          }
          if (l === Math.floor(shown) && frac(t * 2) < 0.5) { ctx.fillStyle = '#fff'; ctx.fillRect(lx, ly - 5, 2, 10); }
        }
        // tests
        const pass = Math.min(6, Math.floor(prog * 7));
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + 16 + k * 14, y + ph - 14, 4, 0, TAU); if (k < pass) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = `rgba(${INK},.3)`; ctx.stroke(); } }
        text(ctx, pass + '/6', x + pw - 12, y + ph - 14, `rgba(${INK},.6)`, 9, 'right');
        if (pr > 0.86) text(ctx, s ? '−18' : '+18', x + pw / 2, y + ph / 2 - (pr - 0.86) * 160, col, 22, 'center', 600);
      });
      // countdown ring between the panes
      const cx = w / 2, cy = top + 2 + ph / 2, R = Math.min(22, pw * 0.16);
      ctx.fillStyle = '#060504'; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${INK},.15)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = A; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pr)); ctx.stroke();
      text(ctx, 'VS', cx, cy, '#fff', 10, 'center', 600);
      // season ladder
      if (foot < 60) return;
      const y0 = h - foot + 18, lw = w - 32, pos = 0.62 + 0.3 * Math.sin(t * 0.25);
      text(ctx, 'SEASON LADDER', 16, y0, `rgba(${INK},.5)`, 9); text(ctx, 'GLOBAL #' + Math.round(240 - pos * 200), w - 16, y0, A, 9, 'right');
      ctx.fillStyle = `rgba(${INK},.12)`; rr(ctx, 16, y0 + 18, lw, 6, 3); ctx.fill();
      const g = ctx.createLinearGradient(16, 0, 16 + lw, 0); g.addColorStop(0, B); g.addColorStop(1, A); ctx.fillStyle = g; rr(ctx, 16, y0 + 18, lw * pos, 6, 3); ctx.fill();
      ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'].forEach((n, i) => { const tx = 16 + (lw * (i + 0.5)) / 4; text(ctx, n, tx, y0 + 42, `rgba(${INK},${pos > (i + 0.2) / 4 ? 0.8 : 0.3})`, 8, 'center'); });
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(16 + lw * pos, y0 + 21, 6, 0, TAU); ctx.fill();
    };
  }

  /* 6) JAGCHESS — a game plays itself out, with an eval bar and a running move list */
  function jagchess(ctx, getSize) {
    const start = [['♚', 4, 7, 0], ['♛', 3, 7, 0], ['♜', 0, 7, 0], ['♜', 7, 7, 0], ['♝', 5, 7, 0], ['♞', 6, 7, 0], ['♟', 4, 6, 0], ['♟', 3, 6, 0], ['♟', 5, 6, 0], ['♟', 2, 6, 0],
      ['♚', 4, 0, 1], ['♛', 3, 0, 1], ['♜', 0, 0, 1], ['♜', 7, 0, 1], ['♝', 5, 0, 1], ['♞', 1, 0, 1], ['♟', 4, 1, 1], ['♟', 3, 1, 1], ['♟', 2, 1, 1], ['♟', 5, 1, 1]];
    const moves = [[6, 4, 4, 'e4'], [16, 4, 3, 'e5'], [5, 5, 5, 'Nf3'], [15, 2, 2, 'Nc6'], [4, 2, 4, 'Bc4'], [14, 2, 3, 'Bc5'], [7, 3, 5, 'd3'], [17, 3, 2, 'd6']];
    const C = '125,211,252', per = 1.15;
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#070B14', '#04060C');
      const foot = h > 320 ? 74 : 0, S = Math.min(w - 64, h - top - foot - 14), bx = (w - S) / 2 + 8, by = top + 4, q = S / 8;
      const tt = t % (moves.length * per + 2.2), k = Math.min(moves.length, Math.floor(tt / per)), mp = ease(clamp((tt - k * per) / 0.75, 0, 1));
      const pos = start.map((p) => [p[1], p[2]]);
      for (let i = 0; i < k; i++) pos[moves[i][0]] = [moves[i][1], moves[i][2]];
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { ctx.fillStyle = (r + f) % 2 ? '#111A2C' : '#22304E'; ctx.fillRect(bx + f * q, by + r * q, q + 0.5, q + 0.5); }
      let anim = null;
      if (k < moves.length) {
        const m = moves[k], from = pos[m[0]];
        ctx.fillStyle = `rgba(${C},.3)`; ctx.fillRect(bx + from[0] * q, by + from[1] * q, q, q); ctx.fillRect(bx + m[1] * q, by + m[2] * q, q, q);
        anim = [m[0], lerp(from[0], m[1], mp), lerp(from[1], m[2], mp)];
      } else if (k) { const m = moves[k - 1]; ctx.fillStyle = `rgba(${C},.22)`; ctx.fillRect(bx + m[1] * q, by + m[2] * q, q, q); }
      ctx.font = `${q * 0.8}px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols2", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      start.forEach((p, i) => {
        const f = anim && anim[0] === i ? anim[1] : pos[i][0], r = anim && anim[0] === i ? anim[2] : pos[i][1];
        const lift = anim && anim[0] === i ? Math.sin(mp * Math.PI) * q * 0.25 : 0;
        ctx.fillStyle = p[3] ? `rgb(${C})` : '#F4F2EC';
        ctx.fillText(p[0], bx + (f + 0.5) * q, by + (r + 0.54) * q - lift);
      });
      ctx.strokeStyle = `rgba(${C},.4)`; ctx.lineWidth = 1; ctx.strokeRect(bx, by, S, S);
      // eval bar
      const ev = 0.5 + 0.1 * Math.sin(t * 0.6) + (k % 2 ? -0.03 : 0.03), ex = bx - 16;
      ctx.fillStyle = `rgb(${C})`; ctx.fillRect(ex, by, 6, S); ctx.fillStyle = '#F4F2EC'; ctx.fillRect(ex, by + S * (1 - ev), 6, S * ev);
      if (!foot) return;
      const y0 = by + S + 24; let line = '';
      for (let i = 0; i < Math.min(k + (mp > 0.9 ? 1 : 0), moves.length); i++) line += (i % 2 ? '' : `${i / 2 + 1}. `) + moves[i][3] + ' ';
      text(ctx, 'LIVE BOARD · CLUB NIGHT', bx, y0, `rgba(${C},1)`, 9);
      text(ctx, line + (frac(t * 2) < 0.5 ? '▍' : ''), bx, y0 + 22, `rgba(${INK},.85)`, Math.min(12, w / 34));
    };
  }

  /* 7) PITCHLY — two pitchers trade the mic, the room votes, three judges score */
  function pitchly(ctx, getSize) {
    const L = '255,111,181', R = '124,203,255';
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#120713', '#07040A');
      const turn = 3, who = Math.floor(t / turn) % 2, tp = frac(t / turn), foot = h > 320 ? 110 : 0;
      const ay = top + (h - top - foot) * 0.3, ar = Math.min(w * 0.1, (h - top - foot) * 0.16, 46);
      [0, 1].forEach((s) => {
        const cx = w * (s ? 0.75 : 0.25), col = s ? R : L, on = who === s;
        glow(ctx, cx, ay, ar * 3.2, col, on ? 0.3 : 0.08);
        // radial waveform: the voice
        for (let k = 0; k < 44; k++) {
          const a = (k / 44) * TAU, amp = on ? (0.3 + 0.7 * Math.abs(Math.sin(t * 7 + k * 1.7) * Math.sin(t * 3.1 + k * 0.6))) * ar * 0.85 : ar * 0.08;
          ctx.strokeStyle = `rgba(${col},${on ? 0.95 : 0.35})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (ar + 6), ay + Math.sin(a) * (ar + 6)); ctx.lineTo(cx + Math.cos(a) * (ar + 6 + amp), ay + Math.sin(a) * (ar + 6 + amp)); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${col},${on ? 1 : 0.4})`; ctx.beginPath(); ctx.arc(cx, ay, ar, 0, TAU); ctx.fill();
        ctx.fillStyle = '#120713'; ctx.beginPath(); ctx.arc(cx, ay - ar * 0.18, ar * 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(cx, ay + ar * 0.62, ar * 0.52, Math.PI, TAU); ctx.fill();
        text(ctx, s ? 'CHALLENGER' : 'YOU', cx, ay + ar * 2.25 + 8, `rgba(${col},1)`, 9, 'center');
        if (on) { ctx.fillStyle = `rgba(${INK},.15)`; rr(ctx, cx - ar, ay + ar * 2.25 + 20, ar * 2, 4, 2); ctx.fill(); ctx.fillStyle = `rgb(${col})`; rr(ctx, cx - ar, ay + ar * 2.25 + 20, ar * 2 * (1 - tp), 4, 2); ctx.fill(); }
      });
      text(ctx, 'VS', w / 2, ay, '#fff', Math.max(14, ar * 0.5), 'center', 600);
      // the room votes: a wall of dots tipping one way or the other
      const share = 0.5 + 0.2 * Math.sin(t * 0.45), cols = 16, rows = 4, gw = Math.min(w - 48, 420), d = gw / cols, gx = (w - gw) / 2, gy = top + (h - top - foot) * 0.72;
      for (let i = 0; i < cols * rows; i++) {
        const left = hash(i + 3) < share, x = gx + (i % cols) * d + d / 2, y = gy + Math.floor(i / cols) * d, tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
        ctx.fillStyle = `rgba(${left ? L : R},${0.45 + tw * 0.5})`; ctx.beginPath(); ctx.arc(x, y, d * 0.26, 0, TAU); ctx.fill();
      }
      text(ctx, Math.round(share * 100) + '%', gx - 6, gy + d * 1.5, `rgb(${L})`, 10, 'right'); text(ctx, Math.round((1 - share) * 100) + '%', gx + gw + 6, gy + d * 1.5, `rgb(${R})`, 10);
      // judges
      if (!foot) return;
      const y0 = h - foot / 2 - 2, dr = Math.min(24, w * 0.055);
      ['CLARITY', 'IDEA', 'DELIVERY'].forEach((n, i) => {
        const cx = w * (0.22 + i * 0.28), v = clamp(0.62 + 0.3 * Math.sin(t * 0.5 + i * 2.1) * ease(frac(t / 6) * 2), 0, 1);
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(${INK},.12)`; ctx.beginPath(); ctx.arc(cx, y0, dr, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgb(${i % 2 ? R : L})`; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, y0, dr, -Math.PI / 2, -Math.PI / 2 + TAU * v); ctx.stroke(); ctx.lineCap = 'butt';
        text(ctx, (v * 10).toFixed(1), cx, y0, '#fff', 10, 'center', 600); text(ctx, n, cx, y0 + dr + 14, `rgba(${INK},.5)`, 8, 'center');
      });
    };
  }

  /* 8) WCLEGENDS — cards fly from the deck into a 4-3-3, then the ball moves through the side */
  function wclegends(ctx, getSize) {
    const G = '255,209,102';
    const slots = [[0.5, 0.92], [0.14, 0.74], [0.38, 0.78], [0.62, 0.78], [0.86, 0.74], [0.24, 0.52], [0.5, 0.56], [0.76, 0.52], [0.2, 0.27], [0.5, 0.2], [0.8, 0.27]];
    const chain = [0, 2, 6, 5, 8, 9, 10, 7, 9];
    const rating = (i) => 84 + Math.floor(hash(i + 2) * 14);
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#080C1C', '#04060F');
      const foot = h > 320 ? 84 : 0, px = 18, py = top + 2, pw = w - 36, ph = h - py - foot - 14;
      rr(ctx, px, py, pw, ph, 12); ctx.fillStyle = '#0B1330'; ctx.fill();
      for (let s = 0; s < 8; s += 2) { ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(px, py + (ph * s) / 8, pw, ph / 8); }
      ctx.strokeStyle = `rgba(${G},.5)`; ctx.lineWidth = 1.2;
      rr(ctx, px, py, pw, ph, 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py + ph / 2); ctx.lineTo(px + pw, py + ph / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, Math.min(pw, ph) * 0.11, 0, TAU); ctx.stroke();
      ctx.strokeRect(px + pw * 0.28, py, pw * 0.44, ph * 0.13); ctx.strokeRect(px + pw * 0.28, py + ph * 0.87, pw * 0.44, ph * 0.13);
      const P = slots.map((s) => [px + s[0] * pw, py + s[1] * ph]);
      const draft = 0.42, total = 11 * draft + 5.2, tt = t % total, dx = w - 60, dy = h - (foot ? foot / 2 : 30), r = clamp(Math.min(pw, ph) * 0.045, 9, 17);
      let sum = 0, placed = 0;
      P.forEach((p, i) => {
        const a = ease((tt - i * draft) / 0.8); if (a <= 0) return;
        const x = lerp(dx, p[0], a), y = lerp(dy, p[1], a) - Math.sin(a * Math.PI) * 50;
        if (a >= 1) { sum += rating(i); placed++; glow(ctx, x, y, r * 2.6, G, 0.25); }
        const cw2 = lerp(30, r * 2, a), ch2 = lerp(40, r * 2, a);
        const g = ctx.createLinearGradient(x - cw2 / 2, y - ch2 / 2, x + cw2 / 2, y + ch2 / 2); g.addColorStop(0, '#FFE8A3'); g.addColorStop(0.5, '#FFD166'); g.addColorStop(1, '#C98A1B');
        ctx.save(); ctx.translate(x, y); ctx.rotate((1 - a) * 1.4); rr(ctx, -cw2 / 2, -ch2 / 2, cw2, ch2, lerp(5, r, a)); ctx.fillStyle = g; ctx.fill(); ctx.restore();
        text(ctx, String(rating(i)), x, y + 0.5, '#1A1204', Math.max(8, r * 0.85), 'center', 600);
      });
      // the ball moves through the side once everyone is placed
      const bt = tt - 11 * draft - 0.6;
      if (bt > 0) {
        const seg = Math.min(chain.length - 2, Math.floor(bt / 0.55)), sp = ease(clamp(bt / 0.55 - seg, 0, 1)), a = P[chain[seg]], b = P[chain[seg + 1]];
        const bx = lerp(a[0], b[0], sp), by = lerp(a[1], b[1], sp) - Math.sin(sp * Math.PI) * 14;
        ctx.strokeStyle = `rgba(${INK},.5)`; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.fill();
        if (seg === chain.length - 2 && sp > 0.95) glow(ctx, bx, by, 70, G, 0.6);
      }
      if (!foot) return;
      const y0 = h - foot / 2;
      text(ctx, 'NATION OVR', 18, y0 - 12, `rgba(${INK},.5)`, 9);
      text(ctx, placed ? String(Math.round(sum / placed)) : '--', 18, y0 + 12, `rgb(${G})`, 26, 'left', 600);
      text(ctx, placed + ' / 11 DRAFTED', 78, y0 + 14, `rgba(${INK},.6)`, 9);
      for (let i = 0; i < 4; i++) {   // the deck
        ctx.save(); ctx.translate(dx - i * 5, dy); ctx.rotate(-0.12 + i * 0.07 + Math.sin(t + i) * 0.02);
        rr(ctx, -15, -20, 30, 40, 5); ctx.fillStyle = i === 3 ? '#FFD166' : `rgba(${G},${0.25 + i * 0.15})`; ctx.fill(); ctx.restore();
      }
    };
  }

  /* 9) ITEMLY — a campus map: reports drop in, the engine draws the match, the item goes home */
  function itemly(ctx, getSize) {
    const I = '124,140,255', F = '79,216,255', LOST = '255,111,181';
    const names = ['WATER BOTTLE', 'AIRPODS CASE', 'CALCULATOR', 'JACKET'];
    const pairs = [[[0.2, 0.25], [0.72, 0.6]], [[0.8, 0.2], [0.3, 0.7]], [[0.5, 0.15], [0.55, 0.8]], [[0.15, 0.62], [0.85, 0.42]]];
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#080A18', '#05060E');
      const foot = h > 320 ? 92 : 0, mx = 16, my = top + 2, mw = w - 32, mh = h - my - foot - 14;
      // map: paths and buildings
      ctx.strokeStyle = `rgba(${I},.1)`; ctx.lineWidth = 1;
      for (let x = 0; x <= 8; x++) { ctx.beginPath(); ctx.moveTo(mx + (mw * x) / 8, my); ctx.lineTo(mx + (mw * x) / 8, my + mh); ctx.stroke(); }
      for (let y = 0; y <= 8; y++) { ctx.beginPath(); ctx.moveTo(mx, my + (mh * y) / 8); ctx.lineTo(mx + mw, my + (mh * y) / 8); ctx.stroke(); }
      for (let b = 0; b < 7; b++) {
        const bx = mx + mw * (0.06 + hash(b) * 0.7), by = my + mh * (0.06 + hash(b + 9) * 0.72), bw = mw * (0.12 + hash(b + 4) * 0.14), bh = mh * (0.08 + hash(b + 6) * 0.1);
        rr(ctx, bx, by, bw, bh, 6); ctx.fillStyle = `rgba(${I},.1)`; ctx.fill(); ctx.strokeStyle = `rgba(${I},.3)`; ctx.stroke();
      }
      const per = 3.6, idx = Math.floor(t / per) % 4, c = frac(t / per);
      const pin = (p, rgb, a, s) => {
        const x = mx + p[0] * mw, y = my + p[1] * mh - (1 - ease(a)) * 40;
        ctx.globalAlpha = clamp(a * 2, 0, 1);
        const pulse = frac(t * 0.8); ctx.strokeStyle = `rgba(${rgb},${1 - pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 18, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgb(${rgb})`; ctx.beginPath(); ctx.arc(x, y - 8, s, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s * 0.7, y - 5); ctx.lineTo(x, y + 3); ctx.lineTo(x + s * 0.7, y - 5); ctx.fill();
        ctx.fillStyle = '#080A18'; ctx.beginPath(); ctx.arc(x, y - 8, s * 0.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; return [x, y - 4];
      };
      // quiet pins from the other pairs
      pairs.forEach((p, i) => { if (i !== idx) { pin(p[0], LOST, 1, 4); pin(p[1], F, 1, 4); } });
      const a = pin(pairs[idx][0], LOST, clamp(c / 0.15, 0, 1), 7), b = pin(pairs[idx][1], F, clamp((c - 0.15) / 0.15, 0, 1), 7);
      if (c > 0.34) {
        const lp = ease((c - 0.34) / 0.3), ex = lerp(a[0], b[0], lp), ey = lerp(a[1], b[1], lp);
        const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, `rgb(${LOST})`); g.addColorStop(1, `rgb(${F})`);
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        if (c > 0.66) {
          const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, s = ease((c - 0.66) / 0.12), label = 'MATCH ' + (91 + idx * 2) + '%';
          ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); rr(ctx, -44, -12, 88, 24, 12); ctx.fillStyle = '#fff'; ctx.fill(); text(ctx, label, 0, 1, '#080A18', 10, 'center', 600); ctx.restore();
        }
      }
      if (!foot) return;
      const y0 = h - foot + 6;
      text(ctx, 'REPORTED', 16, y0, `rgba(${INK},.45)`, 9);
      names.forEach((n, i) => {
        const x = 16 + (i % 2) * ((w - 110) / 2), y = y0 + 24 + Math.floor(i / 2) * 24, on = i === idx, done = on && c > 0.66;
        ctx.fillStyle = on ? `rgb(${done ? F : LOST})` : `rgba(${INK},.25)`; ctx.beginPath(); ctx.arc(x + 4, y, 4, 0, TAU); ctx.fill();
        text(ctx, n, x + 16, y, `rgba(${INK},${on ? 0.95 : 0.45})`, 9);
      });
      // qr tag
      const qs = 6, qx = w - 16 - qs * 9, qy = h - 16 - qs * 9;
      for (let i = 0; i < 81; i++) { const fx = i % 9, fy = Math.floor(i / 9), corner = (fx < 3 && fy < 3) || (fx > 5 && fy < 3) || (fx < 3 && fy > 5); if (corner || hash(i + 40) > 0.5) { ctx.fillStyle = `rgba(${INK},${corner ? 0.9 : 0.55})`; ctx.fillRect(qx + fx * qs, qy + fy * qs, qs - 1, qs - 1); } }
      ctx.fillStyle = `rgb(${F})`; ctx.fillRect(qx - 3, qy + frac(t * 0.7) * qs * 9, qs * 9 + 6, 2);
    };
  }

  /* 10) BRAILLEVISION — a camera frame scans embossed cells, letters decode, speech plays */
  function braille(ctx, getSize) {
    const map = { a: '1', b: '12', c: '14', d: '145', e: '15', f: '124', g: '1245', h: '125', i: '24', j: '245', k: '13', l: '123', m: '134', n: '1345', o: '135', p: '1234', q: '12345', r: '1235', s: '234', t: '2345', u: '136', v: '1236', w: '2456', x: '1346', y: '13456', z: '1356', ' ': '' };
    const phrase = 'read with a phone ', cols = 6, rows = 3, C = '34,211,238';
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#04101A', '#03080F');
      const foot = h > 320 ? 118 : 44, fx = 22, fy = top + 6, fw = w - 44, fh = h - fy - foot - 12, cw = fw / cols, ch = fh / rows;
      const per = 7, c = frac(t / per), scan = clamp(c * 1.25, 0, 1) * (cols * rows);
      rr(ctx, fx, fy, fw, fh, 12); ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fill();
      for (let i = 0; i < cols * rows; i++) {
        const cx = fx + (i % cols + 0.5) * cw, cy = fy + (Math.floor(i / cols) + 0.5) * ch, dots = map[phrase[i]] || '', read = i < Math.floor(scan), now = i === Math.floor(scan);
        const dx = Math.min(cw * 0.2, 13), dy = Math.min(ch * 0.2, 15), r = Math.min(dx, dy) * 0.42;
        if (now) { rr(ctx, cx - cw / 2 + 4, cy - ch / 2 + 4, cw - 8, ch - 8, 8); ctx.fillStyle = `rgba(${C},.14)`; ctx.fill(); ctx.strokeStyle = `rgb(${C})`; ctx.lineWidth = 1.5; ctx.stroke(); }
        for (let d = 1; d <= 6; d++) {
          const px = cx + (d > 3 ? dx : -dx), py = cy + ((d - 1) % 3 - 1) * dy * 1.45 - 4, on = dots.indexOf(String(d)) !== -1;
          ctx.beginPath(); ctx.arc(px, py, on ? r : r * 0.4, 0, TAU);
          ctx.fillStyle = on ? (read || now ? `rgb(${C})` : `rgba(${INK},.75)`) : `rgba(${INK},.12)`; ctx.fill();
          if (on && now) glow(ctx, px, py, r * 4, C, 0.5);
        }
        if (read && ch > 54) text(ctx, phrase[i].toUpperCase(), cx, cy + ch / 2 - 10, `rgba(${INK},.7)`, 10, 'center');
      }
      // viewfinder corners
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
      [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(([ax, ay, sx, sy]) => { const x = fx + ax * fw, y = fy + ay * fh; ctx.moveTo(x + sx * 18, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 18); });
      ctx.stroke();
      // decoded text + speech
      const y0 = h - foot + 10, out = phrase.slice(0, Math.floor(scan)).toUpperCase();
      text(ctx, out + (frac(t * 2) < 0.5 ? '▍' : ''), 22, y0 + 4, '#fff', Math.min(18, w / 22), 'left', 600);
      if (foot < 80) return;
      text(ctx, 'TEXT-TO-SPEECH', 22, y0 + 34, `rgba(${C},1)`, 9);
      const n = Math.floor((w - 44) / 6), talking = c < 0.86;
      for (let i = 0; i < n; i++) {
        const v = talking ? Math.abs(Math.sin(t * 6 + i * 0.5) * Math.sin(t * 2.3 + i * 0.17)) : 0.05, bh = 3 + v * 34;
        ctx.fillStyle = `rgba(${C},${0.35 + v * 0.65})`; rr(ctx, 22 + i * 6, y0 + 70 - bh / 2, 3, bh, 1.5); ctx.fill();
      }
    };
  }

  /* 11) MINDFLOW — a breathing orb, orbiting thoughts, a week of check-ins that it adapts to */
  function mindflow(ctx, getSize) {
    const V = '167,139,250', P = '255,111,181';
    const tips = ['BREATHE 4 · 7 · 8', 'TEN-MINUTE WALK', 'WRITE THREE LINES', 'LIGHTS OUT BY 11'];
    const mood = [0.45, 0.3, 0.5, 0.62, 0.4, 0.7, 0.82];
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#0D0A1C', '#06050E');
      const foot = h > 320 ? 120 : 0, cx = w / 2, cy = top + (h - top - foot) / 2, R = Math.min(w, h - top - foot) * 0.22, br = Math.sin(t * 0.8) * 0.5 + 0.5;
      glow(ctx, cx, cy, R * 3.4, V, 0.22 + br * 0.14);
      for (let ring = 3; ring >= 1; ring--) { ctx.strokeStyle = `rgba(${V},${0.12 * ring * (0.5 + br * 0.5)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R * (1 + ring * 0.42 + br * 0.14), 0, TAU); ctx.stroke(); }
      // the orb: a few wobbling blobs stacked up
      for (let l = 0; l < 4; l++) {
        ctx.beginPath();
        for (let k = 0; k <= 60; k++) {
          const a = (k / 60) * TAU, rad = R * (0.72 + br * 0.24 - l * 0.13) * (1 + 0.07 * Math.sin(a * 3 + t * 1.2 + l) + 0.05 * Math.sin(a * 5 - t * 0.9 + l * 2));
          const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, `rgba(${V},${0.3 + l * 0.2})`); g.addColorStop(1, `rgba(${P},${0.25 + l * 0.2})`);
        ctx.fillStyle = g; ctx.fill();
      }
      for (let i = 0; i < 26; i++) {
        const a = t * (0.25 + (i % 3) * 0.12) + i * 1.9, rx = R * (1.5 + (i % 3) * 0.42), z = Math.sin(a);
        ctx.fillStyle = `rgba(${i % 2 ? P : V},${0.35 + 0.6 * (z * 0.5 + 0.5)})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx, cy + z * rx * 0.34, 1.5 + (z * 0.5 + 0.5) * 2, 0, TAU); ctx.fill();
      }
      text(ctx, br > 0.5 ? 'BREATHE IN' : 'BREATHE OUT', cx, cy, '#fff', 9, 'center');
      if (!foot) return;
      // check-in line and the suggestion it leads to
      const y0 = h - foot + 4, gw = w - 44, day = Math.floor(t / 1.4) % 7;
      text(ctx, 'CHECK-INS · THIS WEEK', 22, y0, `rgba(${INK},.5)`, 9);
      ctx.beginPath(); mood.forEach((m, i) => { const x = 22 + (gw * i) / 6, y = y0 + 52 - m * 34; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.strokeStyle = `rgb(${V})`; ctx.lineWidth = 2; ctx.stroke();
      mood.forEach((m, i) => { const x = 22 + (gw * i) / 6, y = y0 + 52 - m * 34; ctx.fillStyle = i === day ? '#fff' : `rgb(${V})`; ctx.beginPath(); ctx.arc(x, y, i === day ? 5 : 3, 0, TAU); ctx.fill(); if (i === day) glow(ctx, x, y, 22, P, 0.5); });
      const tip = tips[Math.floor(t / 2.8) % tips.length], a = Math.min(1, frac(t / 2.8) * 4, (1 - frac(t / 2.8)) * 4);
      ctx.globalAlpha = a; rr(ctx, 22, y0 + 74, Math.min(gw, tip.length * 7.4 + 44), 26, 13); ctx.fillStyle = `rgba(${P},.16)`; ctx.fill(); ctx.strokeStyle = `rgba(${P},.7)`; ctx.lineWidth = 1; ctx.stroke();
      text(ctx, '→ ' + tip, 36, y0 + 87.5, '#fff', 10); ctx.globalAlpha = 1;
    };
  }

  /* 12) FINQUEST — a quest path with coins at every level, a budget that rebalances, savings that grow */
  function finquest(ctx, getSize) {
    const O = '253,186,116', Bl = '124,203,255', Pk = '255,111,181';
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#130C06', '#080503');
      const foot = h > 320 ? 104 : 0, y0 = top + 30, ph = h - y0 - foot - 14, N = 7;
      // budget bar
      const a = 0.5 + 0.06 * Math.sin(t * 0.5), b = 0.3 - 0.08 * Math.sin(t * 0.5), bw = w - 32;
      [[0, a, O, 'NEEDS'], [a, b, Pk, 'WANTS'], [a + b, 1 - a - b, Bl, 'SAVE']].forEach(([s, f, c, n]) => {
        ctx.fillStyle = `rgb(${c})`; rr(ctx, 16 + bw * s + 1, top, bw * f - 2, 8, 4); ctx.fill();
        text(ctx, n + ' ' + Math.round(f * 100), 16 + bw * s + 2, top + 18, `rgba(${c},.9)`, 8);
      });
      // quest path
      const node = (i) => [w * (0.5 + 0.32 * Math.sin(i * 1.25 + 0.4)), y0 + ph - 12 - (i / (N - 1)) * (ph - 36)];
      ctx.strokeStyle = `rgba(${O},.3)`; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let s = 0; s <= (N - 1) * 12; s++) { const [x, y] = node(s / 12); if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      const per = 1.3, tt = t % (N * per + 1), k = Math.min(N - 1, Math.floor(tt / per)), hp = ease(clamp((tt - k * per) / 0.6, 0, 1));
      ctx.strokeStyle = `rgb(${O})`; ctx.lineWidth = 4; ctx.beginPath();
      const reach = Math.max(0, k - 1 + (k ? hp : 0));
      for (let s = 0; s <= reach * 12; s++) { const [x, y] = node(s / 12); if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); ctx.lineCap = 'butt';
      for (let i = 0; i < N; i++) {
        const [x, y] = node(i), done = i < k || (i === k && hp > 0.95);
        ctx.fillStyle = done ? `rgb(${O})` : '#1E140A'; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(${O},.8)`; ctx.lineWidth = 2; ctx.stroke();
        text(ctx, i === N - 1 ? '★' : String(i + 1), x, y + 0.5, done ? '#130C06' : `rgb(${O})`, 10, 'center', 600);
        if (i === k && hp > 0.6) for (let c = 0; c < 6; c++) {   // coin burst
          const cp = frac((tt - k * per - 0.36) / 0.9), ang = -Math.PI / 2 + (c - 2.5) * 0.4;
          if (cp > 0 && cp < 1) { ctx.fillStyle = `rgba(255,209,102,${1 - cp})`; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 46 * cp, y + Math.sin(ang) * 46 * cp + 40 * cp * cp, 4, 0, TAU); ctx.fill(); }
        }
      }
      const from = node(Math.max(0, k - 1)), to = node(k), ax = lerp(k ? from[0] : to[0], to[0], hp), ay = lerp(k ? from[1] : to[1], to[1], hp) - Math.sin(hp * Math.PI) * 26 - 24;
      glow(ctx, ax, ay, 30, Bl, 0.5); ctx.fillStyle = `rgb(${Bl})`; rr(ctx, ax - 8, ay - 8, 16, 16, 5); ctx.fill();
      ctx.fillStyle = '#130C06'; ctx.fillRect(ax - 4, ay - 3, 2.5, 2.5); ctx.fillRect(ax + 1.5, ay - 3, 2.5, 2.5);
      if (!foot) return;
      // savings sandbox
      const sy = h - foot + 10, gw = w - 32, prog = clamp(tt / (N * per), 0, 1);
      text(ctx, 'SANDBOX SAVINGS', 16, sy, `rgba(${INK},.5)`, 9); text(ctx, 'LEVEL ' + (k + 1) + ' / ' + N, w - 16, sy, `rgb(${O})`, 9, 'right');
      ctx.beginPath(); ctx.moveTo(16, sy + 78);
      for (let j = 0; j <= 50 * prog; j++) { const v = Math.pow(j / 50, 1.7) + Math.sin(j * 0.6) * 0.03; ctx.lineTo(16 + (gw * j) / 50, sy + 78 - v * 56); }
      ctx.lineTo(16 + gw * prog, sy + 78); ctx.closePath();
      const g = ctx.createLinearGradient(0, sy + 18, 0, sy + 78); g.addColorStop(0, `rgba(${Bl},.5)`); g.addColorStop(1, `rgba(${Bl},0)`); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); for (let j = 0; j <= 50 * prog; j++) { const v = Math.pow(j / 50, 1.7) + Math.sin(j * 0.6) * 0.03, x = 16 + (gw * j) / 50, y = sy + 78 - v * 56; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.strokeStyle = `rgb(${Bl})`; ctx.lineWidth = 2; ctx.stroke();
    };
  }

  /* 13) PROSPERITY EMPIRE — an isometric city that grows as trade routes pay out */
  function prosperity(ctx, getSize) {
    const N = 6;
    return function (t) {
      const { w, h } = getSize(), top = topOf(h);
      fill(ctx, w, h, '#120D03', '#070501');
      const foot = h > 320 ? 60 : 0, tw = Math.min((w - 40) / N, (h - top - foot) / (N * 0.5 + 3.6)), th = tw / 2, cx = w / 2, cy = top + (h - top - foot) * 0.36 + th * 1.2;
      const iso = (x, y, z) => [cx + ((x - y) * tw) / 2, cy + ((x + y - N + 1) * th) / 2 - z];
      const grow = 0.55 + 0.45 * ease(frac(t / 14) * 1.4);
      const H = (x, y) => (0.3 + hash(x * 7 + y * 13) * 1.25) * tw * grow * (0.8 + 0.2 * Math.sin(t * 0.8 + x + y * 2));
      glow(ctx, cx, cy, tw * N * 0.8, '251,191,36', 0.14);
      for (let s = 0; s <= 2 * (N - 1); s++) for (let x = 0; x < N; x++) {
        const y = s - x; if (y < 0 || y >= N) continue;
        const z = H(x, y), a = iso(x, y, 0), b = iso(x + 1, y, 0), c = iso(x + 1, y + 1, 0), d = iso(x, y + 1, 0), poly = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
        poly([d, c, [c[0], c[1] - z], [d[0], d[1] - z]], '#8A5A08');
        poly([b, c, [c[0], c[1] - z], [b[0], b[1] - z]], '#C98A1B');
        poly([[a[0], a[1] - z], [b[0], b[1] - z], [c[0], c[1] - z], [d[0], d[1] - z]], hash(x + y * 3) > 0.8 ? '#FFE8A3' : '#FBBF24');
        // windows on the taller towers
        if (z > tw * 0.9) for (let k = 1; k < z / 9 - 1; k++) { ctx.fillStyle = `rgba(255,244,214,${0.25 + 0.6 * (Math.sin(t * 2 + k + x * 3) > 0.2)})`; ctx.fillRect(lerp(b[0], c[0], 0.5) - 1.5, lerp(b[1], c[1], 0.5) - k * 9, 3, 4); }
        // payouts floating up
        const cp = frac(t * 0.5 + hash(x * 3 + y * 11));
        if (hash(x + y * 5 + Math.floor(t * 0.5 + hash(x * 3 + y * 11))) > 0.72) text(ctx, '+', (a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - z - 8 - cp * 30, `rgba(255,244,214,${1 - cp})`, 12, 'center', 600);
      }
      // trade routes
      [[0, 0, 5, 3], [5, 0, 1, 5], [2, 5, 4, 0]].forEach(([x0, y0, x1, y1], i) => {
        const a = iso(x0 + 0.5, y0 + 0.5, H(x0, y0) + 6), b = iso(x1 + 0.5, y1 + 0.5, H(x1, y1) + 6), p = frac(t * 0.35 + i * 0.33), mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - tw * 1.3;
        ctx.strokeStyle = 'rgba(255,244,214,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
        const q = 1 - p, bx = q * q * a[0] + 2 * q * p * mx + p * p * b[0], by = q * q * a[1] + 2 * q * p * my + p * p * b[1];
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, TAU); ctx.fill(); glow(ctx, bx, by, 14, '251,191,36', 0.7);
      });
      if (!foot) return;
      const y0 = h - foot / 2, bars = ['PRODUCE', 'TRADE', 'REINVEST'];
      bars.forEach((n, i) => {
        const x = 16 + i * ((w - 32) / 3), bw = (w - 32) / 3 - 12, v = 0.35 + 0.6 * (Math.sin(t * 0.6 + i * 2.1) * 0.5 + 0.5);
        text(ctx, n, x, y0 - 8, `rgba(${INK},.55)`, 9);
        ctx.fillStyle = `rgba(${INK},.12)`; rr(ctx, x, y0 + 6, bw, 6, 3); ctx.fill(); ctx.fillStyle = '#FBBF24'; rr(ctx, x, y0 + 6, bw * v, 6, 3); ctx.fill();
      });
    };
  }

  window.RonitVisuals = { alphalab, terrasight, fallenhour, ghostwatt, byteblitz, jagchess, pitchly, wclegends, itemly, braille, mindflow, finquest, prosperity };
})();
