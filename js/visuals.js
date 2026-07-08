/* project visuals — one small canvas animator per project.
   each factory gets the 2d ctx and a getSize() that returns css pixels
   (ctx is already dpr-scaled by main.js so we just draw in css units).
   each returns a frame(t) function where t is seconds since start. */

(function () {
  // clamp helper
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // cheap value-noise from layered sines. good enough for a moving field,
  // way lighter than a real perlin implementation.
  function fieldNoise(x, y, t) {
    const n =
      Math.sin(x * 1.3 + t) * 0.5 +
      Math.sin(y * 1.7 - t * 0.8) * 0.5 +
      Math.sin((x + y) * 0.9 + t * 1.3) * 0.5 +
      Math.sin(Math.hypot(x - 3, y - 2) * 1.1 - t) * 0.5;
    return (n / 2 + 0.5); // roughly 0..1
  }

  // interpolate through an array of [stop, [r,g,b]] color stops
  function ramp(stops, v) {
    v = clamp(v, 0, 1);
    for (let i = 0; i < stops.length - 1; i++) {
      const [s0, c0] = stops[i], [s1, c1] = stops[i + 1];
      if (v >= s0 && v <= s1) {
        const f = (v - s0) / (s1 - s0);
        return `rgb(${(c0[0] + (c1[0] - c0[0]) * f) | 0},${(c0[1] + (c1[1] - c0[1]) * f) | 0},${(c0[2] + (c1[2] - c0[2]) * f) | 0})`;
      }
    }
    return `rgb(${stops[stops.length - 1][1].join(',')})`;
  }

  const emberStops = [
    [0.0, [13, 13, 15]],
    [0.35, [58, 20, 0]],
    [0.55, [122, 38, 0]],
    [0.72, [255, 92, 31]],
    [0.88, [255, 176, 32]],
    [1.0, [255, 245, 224]],
  ];

  // 1) WILDFIRE — animated risk heatmap grid, flowing through the ember ramp
  function wildfire(ctx, getSize) {
    const cell = 20;
    return function (t) {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const v = fieldNoise(gx * 0.28, gy * 0.28, t * 0.6);
          ctx.fillStyle = ramp(emberStops, v);
          // tiny gap makes the grid read as cells, not a blur
          ctx.fillRect(gx * cell, gy * cell, cell - 1.5, cell - 1.5);
          // hottest cells get a soft glow dot
          if (v > 0.9) {
            ctx.fillStyle = 'rgba(255,240,210,0.9)';
            ctx.fillRect(gx * cell + cell / 2 - 1, gy * cell + cell / 2 - 1, 2, 2);
          }
        }
      }
    };
  }

  // 2) MINDFLOW — a slow breathing core with soft concentric rings
  function mindflow(ctx, getSize) {
    const violet = [139, 92, 246];
    return function (t) {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const breathe = (Math.sin(t * 0.9) + 1) / 2; // 0..1 in/out
      // background wash
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      g.addColorStop(0, `rgba(139,92,246,${0.16 + breathe * 0.14})`);
      g.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // concentric rings pulsing outward
      for (let i = 0; i < 5; i++) {
        const phase = (t * 0.35 + i / 5) % 1;
        const r = phase * Math.min(w, h) * 0.55;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${violet.join(',')},${(1 - phase) * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // steady core
      const coreR = 26 + breathe * 16;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, 'rgba(196,181,253,0.95)');
      cg.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
    };
  }

  // 3) FINQUEST — rising bars with a growing line drawn over them
  function finquest(ctx, getSize) {
    const emerald = '16,185,129';
    const bars = 14;
    // give each bar a target height that drifts, so the chart feels alive
    const seeds = Array.from({ length: bars }, (_, i) => 0.3 + 0.6 * ((i * 7) % bars) / bars);
    return function (t) {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      const pad = 16, base = h - 22;
      const bw = (w - pad * 2) / bars;
      const pts = [];
      for (let i = 0; i < bars; i++) {
        const grow = clamp(t * 0.8 - i * 0.05, 0, 1); // staggered rise-in
        const wobble = 0.12 * Math.sin(t * 1.2 + i);
        const height = (seeds[i] + wobble) * (base - 24) * grow;
        const x = pad + i * bw, y = base - height;
        const grd = ctx.createLinearGradient(0, y, 0, base);
        grd.addColorStop(0, `rgba(${emerald},0.85)`);
        grd.addColorStop(1, `rgba(${emerald},0.12)`);
        ctx.fillStyle = grd;
        ctx.fillRect(x + bw * 0.15, y, bw * 0.7, height);
        pts.push([x + bw / 2, y]);
      }
      // trend line over the bar tops
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.strokeStyle = `rgba(${emerald},0.9)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      // baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(pad, base); ctx.lineTo(w - pad, base); ctx.stroke();
    };
  }

  // 4) BRAILLEVISION — braille cells spelling VISION, with a reading sweep,
  //    that occasionally scrambles and resolves (camera -> text feel)
  function braille(ctx, getSize) {
    const cyan = '34,211,238';
    // braille dot positions in a 2x3 cell:  1 4 / 2 5 / 3 6
    const letters = {
      V: [1, 2, 3, 6], I: [2, 4], S: [2, 3, 4], O: [1, 3, 5], N: [1, 3, 4, 5],
    };
    const word = 'VISION'.split('');
    return function (t) {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      const n = word.length;
      const cellW = Math.min(64, (w - 40) / n);
      const dotR = cellW * 0.11;
      const gapX = cellW * 0.42, gapY = cellW * 0.42;
      const totalW = cellW * n;
      const startX = (w - totalW) / 2 + cellW * 0.28;
      const startY = h / 2 - gapY;
      // every ~5s do a short scramble then resolve
      const cyc = t % 5;
      const scramble = cyc < 0.8 ? (0.8 - cyc) / 0.8 : 0;
      const sweep = ((t * 0.5) % 1) * n; // which cell is being "read"
      for (let c = 0; c < n; c++) {
        const active = new Set(letters[word[c]] || []);
        const cellX = startX + c * cellW;
        const lit = Math.abs(sweep - (c + 0.5)) < 0.6; // near the sweep = brighter
        for (let d = 1; d <= 6; d++) {
          const col = d <= 3 ? 0 : 1;
          const rowi = (d - 1) % 3;
          const x = cellX + col * gapX;
          const y = startY + rowi * gapY;
          let on = active.has(d);
          if (scramble > 0 && Math.random() < scramble) on = !on; // flicker while scrambling
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          if (on) {
            ctx.fillStyle = `rgba(${cyan},${lit ? 1 : 0.75})`;
            ctx.shadowColor = `rgba(${cyan},0.9)`;
            ctx.shadowBlur = lit ? 14 : 6;
          } else {
            ctx.fillStyle = 'rgba(120,140,150,0.18)';
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      // reading sweep bar
      const sx = startX - cellW * 0.34 + sweep * cellW;
      ctx.fillStyle = `rgba(${cyan},0.10)`;
      ctx.fillRect(sx - cellW * 0.2, startY - gapY * 0.6, cellW * 0.4, gapY * 3.2);
    };
  }

  // 5) PROSPERITY EMPIRE — isometric blocks that build up and rise
  function prosperity(ctx, getSize) {
    const gold = [245, 158, 11];
    const cols = 6, rows = 6, tile = 26;
    return function (t) {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      const originX = w / 2, originY = h * 0.30;
      const iso = (gx, gy) => [originX + (gx - gy) * tile, originY + (gx + gy) * tile * 0.5];
      // draw back-to-front so stacks overlap correctly
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          // deterministic target height per tile, plus a slow grow-in
          const target = ((gx * 3 + gy * 5) % 5) * 0.5 + 0.5;
          const grow = clamp(t * 0.5 - (gx + gy) * 0.12, 0, 1);
          const bob = 0.15 * Math.sin(t * 1.4 + gx + gy);
          const height = (target + bob) * 18 * grow;
          const [x, y] = iso(gx, gy);
          drawBlock(ctx, x, y, tile, height, gold);
        }
      }
    };
    function drawBlock(ctx, x, y, s, hgt, [r, g, b]) {
      const top = y - hgt;
      // top face
      ctx.beginPath();
      ctx.moveTo(x, top - s * 0.5);
      ctx.lineTo(x + s, top);
      ctx.lineTo(x, top + s * 0.5);
      ctx.lineTo(x - s, top);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
      ctx.fill();
      // left face
      ctx.beginPath();
      ctx.moveTo(x - s, top);
      ctx.lineTo(x, top + s * 0.5);
      ctx.lineTo(x, y + s * 0.5);
      ctx.lineTo(x - s, y);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r * 0.55 | 0},${g * 0.55 | 0},${b * 0.55 | 0},0.95)`;
      ctx.fill();
      // right face
      ctx.beginPath();
      ctx.moveTo(x + s, top);
      ctx.lineTo(x, top + s * 0.5);
      ctx.lineTo(x, y + s * 0.5);
      ctx.lineTo(x + s, y);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r * 0.75 | 0},${g * 0.75 | 0},${b * 0.4 | 0},0.95)`;
      ctx.fill();
    }
  }

  // 6) ALPHALAB — a live candlestick chart with a moving-average line
  function alphalab(ctx, getSize) {
    const candles = [];
    let last = 60;
    function step() {
      const o = last;
      const c = o + (Math.random() - 0.48) * 7;
      const hi = Math.max(o, c) + Math.random() * 3;
      const lo = Math.min(o, c) - Math.random() * 3;
      last = c;
      candles.push({ o, c, hi, lo });
      if (candles.length > 80) candles.shift();
    }
    for (let i = 0; i < 60; i++) step();
    let acc = 0;
    return function () {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      // faint terminal grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      for (let gy = 1; gy < 5; gy++) { const y = h * gy / 5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const cw = 11, n = Math.min(candles.length, Math.floor(w / cw));
      const vis = candles.slice(-n);
      let mn = Infinity, mx = -Infinity;
      vis.forEach((c) => { mn = Math.min(mn, c.lo); mx = Math.max(mx, c.hi); });
      const pad = 14, span = (mx - mn) || 1;
      const yOf = (v) => h - pad - (v - mn) / span * (h - 2 * pad);
      vis.forEach((c, i) => {
        const x = i * cw + cw / 2, up = c.c >= c.o;
        ctx.strokeStyle = up ? 'rgba(72,199,142,.9)' : 'rgba(235,90,90,.9)';
        ctx.fillStyle = up ? 'rgba(72,199,142,.85)' : 'rgba(235,90,90,.85)';
        ctx.beginPath(); ctx.moveTo(x, yOf(c.hi)); ctx.lineTo(x, yOf(c.lo)); ctx.stroke();
        const yo = yOf(c.o), yc = yOf(c.c);
        ctx.fillRect(x - cw * 0.3, Math.min(yo, yc), cw * 0.6, Math.max(1.5, Math.abs(yc - yo)));
      });
      // moving-average line in AlphaLab blue
      ctx.strokeStyle = 'rgba(79,139,255,.95)'; ctx.lineWidth = 1.5; ctx.beginPath();
      const p = 6;
      vis.forEach((c, i) => {
        let sum = 0, cnt = 0;
        for (let k = Math.max(0, i - p + 1); k <= i; k++) { sum += vis[k].c; cnt++; }
        const x = i * cw + cw / 2, y = yOf(sum / cnt);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      // scroll: add a new candle roughly once a second
      if (++acc > 30) { step(); acc = 0; }
    };
  }

  // 7) ITEMLY — a campus map with pulsing item pins and a periodic "match"
  function itemly(ctx, getSize) {
    const pins = [[.18, .28], [.5, .18], [.78, .34], [.34, .62], [.66, .7], [.86, .72], [.14, .8]];
    const matches = [[1, 3], [2, 4], [0, 5], [6, 4]]; // pairs the matcher will connect
    const green = '45,212,191';
    return function (t) {
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      // faint map grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      const step = 34;
      for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // one match at a time, cycling through the pairs
      const period = 3.2, idx = Math.floor(t / period) % matches.length, cyc = (t % period) / period;
      const [ai, bi] = matches[idx];
      const a = pins[ai], b = pins[bi];
      if (cyc < 0.75) {
        const ax = a[0] * w, ay = a[1] * h, bx = b[0] * w, by = b[1] * h, p = cyc / 0.75;
        ctx.strokeStyle = 'rgba(255,176,32,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p); ctx.stroke();
        ctx.beginPath(); ctx.arc(ax + (bx - ax) * p, ay + (by - ay) * p, 4, 0, Math.PI * 2); ctx.fillStyle = '#FFB020'; ctx.fill();
      }
      // pins with a soft breathing halo
      pins.forEach((pt, i) => {
        const x = pt[0] * w, y = pt[1] * h, pulse = Math.sin(t * 2 + i) * 0.5 + 0.5;
        const hot = i === ai || i === bi;
        ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${green},${0.10 * (1 - pulse)})`; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = hot ? '#FFB020' : `rgb(${green})`; ctx.fill();
      });
    };
  }

  window.RonitVisuals = { alphalab, itemly, wildfire, mindflow, finquest, braille, prosperity };
})();
