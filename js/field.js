/* the particle sculpture. one fixed WebGL canvas behind the whole page:
   a few thousand points that morph into a different 3D shape for each
   section (galaxy, wave, cube, torus, trophy, globe, "5", "@").
   exposes window.RonitField = { setShape, setColors, frame }.
   main.js decides which shape is active and calls frame() every tick. */

(function () {
  'use strict';
  const canvas = document.getElementById('field');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) { canvas.style.display = 'none'; return; }

  const small = window.matchMedia('(max-width: 860px)').matches;
  const N = small ? 3200 : 9000;
  const rand = Math.random;
  const TAU = Math.PI * 2;

  /* ---------- shape generators: each returns Float32Array(N*3), roughly unit radius ---------- */
  function make(fn) { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = fn(i); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; } return a; }
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

  const shapes = {
    galaxy: () => make(() => {
      const r = Math.pow(rand(), 0.62) * 1.5, arm = Math.floor(rand() * 3);
      const a = arm * TAU / 3 + r * 3.2 + gauss() * 0.28;
      return [Math.cos(a) * r, gauss() * 0.1 * (1.7 - r), Math.sin(a) * r];
    }),
    wave: () => { const side = Math.ceil(Math.sqrt(N)); return make((i) => {
      const x = ((i % side) / side - 0.5) * 3.6, z = (Math.floor(i / side) / side - 0.5) * 3.6;
      return [x, Math.sin(x * 2.4) * Math.cos(z * 2.4) * 0.26, z];
    }); },
    cube: () => make(() => {
      // points along the edges and faces of a cube, plus a smaller one inside
      const s = rand() < 0.3 ? 0.42 : 0.9, f = Math.floor(rand() * 3), p = [0, 0, 0];
      const onEdge = rand() < 0.55;
      p[f] = (rand() < 0.5 ? -1 : 1) * s;
      p[(f + 1) % 3] = onEdge ? (rand() < 0.5 ? -1 : 1) * s : (rand() * 2 - 1) * s;
      p[(f + 2) % 3] = (rand() * 2 - 1) * s;
      return p;
    }),
    torus: () => make(() => {
      const u = rand() * TAU, v = rand() * TAU, R = 0.95, r = 0.4;
      return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
    }),
    trophy: () => make(() => {
      const k = rand(), a = rand() * TAU; let y, r;
      if (k < 0.16) { y = -1.05 + rand() * 0.14; r = 0.58 * (rand() < 0.5 ? 1 : Math.sqrt(rand())); }          // base
      else if (k < 0.3) { y = -0.91 + rand() * 0.66; r = 0.09 + 0.07 * Math.abs(Math.sin(y * 9)); }               // stem
      else if (k < 0.82) { const t = Math.pow(rand(), 0.8); y = -0.25 + t * 1.2; r = 0.12 + 0.68 * Math.sqrt(t); } // bowl
      else {                                                                                                       // handles
        const h = rand() * Math.PI - Math.PI / 2, side = rand() < 0.5 ? -1 : 1;
        return [side * (0.74 + 0.32 * Math.cos(h)), 0.42 + 0.34 * Math.sin(h), (rand() - 0.5) * 0.06];
      }
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    }),
    globe: () => make(() => {
      let lat = Math.asin(rand() * 2 - 1), lon = rand() * TAU;
      const k = rand();
      if (k < 0.4) lat = Math.round(lat / 0.3) * 0.3; else if (k < 0.75) lon = Math.round(lon / 0.35) * 0.35;
      return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    }),
    five: () => glyph('5'),
    at: () => glyph('@'),
    ra: () => glyph('RA'),
  };

  // sample a character's filled pixels into a slightly extruded point cloud
  function glyph(ch) {
    const W = 480, H = 240;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.font = '900 200px "Arial Black", Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#fff'; x.fillText(ch, W / 2, 128);
    const d = x.getImageData(0, 0, W, H).data, px = [];
    for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 128) px.push(i);
    if (!px.length) return shapes.torus();
    return make(() => {
      const p = px[(rand() * px.length) | 0];
      return [((p % W) - W / 2 + rand()) / 95, -(Math.floor(p / W) - 120 + rand()) / 95, (rand() < 0.5 ? -1 : 1) * (0.06 + rand() * 0.1)];
    });
  }

  /* ---------- gl program ---------- */
  const vs = `
    attribute vec3 aFrom; attribute vec3 aTo; attribute float aRand;
    uniform float uMix, uTime, uRotY, uRotX, uScale, uSize, uAspect, uAlpha;
    uniform vec2 uOff, uMouse; uniform vec3 uC1, uC2, uC3, uC4;
    varying vec3 vCol; varying float vA;
    void main() {
      float m = smoothstep(aRand * 0.45, aRand * 0.45 + 0.55, uMix);
      vec3 p = mix(aFrom, aTo, m);
      p += normalize(p + 0.001) * sin(m * 3.14159) * 0.45 * (0.4 + aRand);
      p += 0.022 * vec3(sin(uTime * 0.9 + aRand * 40.0), cos(uTime * 0.7 + aRand * 57.0), sin(uTime * 0.8 + aRand * 23.0));
      float g = fract(aRand * 0.35 + p.y * 0.28 + p.x * 0.12 + uTime * 0.035) * 4.0;
      vCol = g < 1.0 ? mix(uC1, uC2, g) : g < 2.0 ? mix(uC2, uC3, g - 1.0) : g < 3.0 ? mix(uC3, uC4, g - 2.0) : mix(uC4, uC1, g - 3.0);
      float cy = cos(uRotY), sy = sin(uRotY); p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
      float cx = cos(uRotX), sx = sin(uRotX); p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
      float z = p.z + 3.2, persp = 2.4 / z;
      vec2 xy = p.xy * persp * uScale;
      vec2 c = vec2(xy.x / uAspect + uOff.x, xy.y + uOff.y);
      // the cursor pushes nearby points aside
      vec2 dv = (c - uMouse) * vec2(uAspect, 1.0); float dd = length(dv);
      c += normalize(dv + 0.0001) / vec2(uAspect, 1.0) * 0.1 * smoothstep(0.34, 0.0, dd);
      gl_Position = vec4(c, 0.0, 1.0);
      gl_PointSize = uSize * persp * (0.55 + aRand * 1.1);
      vA = uAlpha * (0.3 + 0.7 * smoothstep(4.6, 2.2, z));
    }`;
  const fs = `
    precision mediump float;
    varying vec3 vCol; varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = (smoothstep(0.5, 0.0, d) * 0.75 + smoothstep(0.22, 0.0, d) * 0.6) * vA;
      gl_FragColor = vec4(vCol, a);
    }`;
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }
  gl.useProgram(prog);
  const U = {}; ['uMix', 'uTime', 'uRotY', 'uRotX', 'uScale', 'uSize', 'uAspect', 'uAlpha', 'uOff', 'uMouse', 'uC1', 'uC2', 'uC3', 'uC4'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  const rnd = new Float32Array(N); for (let i = 0; i < N; i++) rnd[i] = rand();
  const attribs = [];
  function buffer(name, size, data) {
    const b = gl.createBuffer(), loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    attribs.push({ b, loc, size });
    return b;
  }

  /* ---------- background starfield: its own tiny program, parallax on scroll ---------- */
  const sProg = gl.createProgram();
  gl.attachShader(sProg, compile(gl.VERTEX_SHADER, `
    attribute vec3 aPos; uniform float uScroll, uTime, uSize; varying float vA;
    void main() {
      float y = mod(aPos.y + uScroll * (0.12 + aPos.z * 0.5) + 1.0, 2.0) - 1.0;
      gl_Position = vec4(aPos.x, y, 0.0, 1.0);
      gl_PointSize = uSize * (0.7 + aPos.z * 1.8);
      vA = (0.2 + 0.8 * aPos.z) * (0.5 + 0.5 * sin(uTime * (0.5 + aPos.z * 2.2) + aPos.x * 60.0));
    }`));
  gl.attachShader(sProg, compile(gl.FRAGMENT_SHADER, `
    precision mediump float; varying float vA;
    void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.93, 0.92, 1.0, smoothstep(0.5, 0.0, d) * vA * 0.8); }`));
  gl.linkProgram(sProg);
  const S = small ? 260 : 620, starData = new Float32Array(S * 3);
  for (let i = 0; i < S; i++) { starData[i * 3] = rand() * 2 - 1; starData[i * 3 + 1] = rand() * 2 - 1; starData[i * 3 + 2] = Math.pow(rand(), 2.2); }
  const sBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);
  const sLoc = gl.getAttribLocation(sProg, 'aPos');
  const SU = { scroll: gl.getUniformLocation(sProg, 'uScroll'), time: gl.getUniformLocation(sProg, 'uTime'), size: gl.getUniformLocation(sProg, 'uSize') };
  const cache = {};
  const get = (name) => cache[name] || (cache[name] = (shapes[name] || shapes.galaxy)());
  let from = get('ra'), to = from, mix = 1, mixStart = 0, current = 'ra';
  // start scattered so the first shape assembles itself on load
  from = make(() => [gauss() * 4, gauss() * 4, gauss() * 4]); mix = 0;
  const bFrom = buffer('aFrom', 3, from), bTo = buffer('aTo', 3, to);
  buffer('aRand', 1, rnd);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.disable(gl.DEPTH_TEST);

  /* per-shape staging: spin speed, tilt, where it sits (clip-space offset), size, opacity */
  const stage = {
    galaxy: { spin: 0.1, tilt: 1.02, ox: 0.4, oy: 0.02, s: 1.3, a: 0.95 },
    wave:   { spin: 0.05, tilt: 1.05, ox: 0, oy: -0.45, s: 1.6, a: 0.65 },
    cube:   { spin: 0.22, tilt: 0.5, ox: 0.9, oy: 0.84, s: 0.2, a: 0.4 },
    torus:  { spin: 0.3, tilt: 0.95, ox: 0.52, oy: 0.42, s: 0.78, a: 0.85 },
    trophy: { spin: 0.55, tilt: 0.14, ox: 0, oy: 0, s: 1.0, a: 1 },
    globe:  { spin: 0.16, tilt: 0.3, ox: 0, oy: -0.25, s: 1.55, a: 0.5 },
    five:   { osc: 0.55, tilt: 0.05, ox: 0.66, oy: 0.5, s: 0.66, a: 0.5 },
    at:     { osc: 0.6, tilt: 0.05, ox: 0.5, oy: -0.15, s: 0.95, a: 1 },
    ra:     { osc: 0.16, tilt: 0.04, ox: 0, oy: 0, s: 1.0, ns: 0.34, a: 1 },                               // the opening monogram
    torusc: { shape: 'torus', spin: 0.4, tilt: 0.85, ox: 0, oy: 0, s: 1.2, a: 1 },               // torus, centre stage
  };
  const cur = { tilt: 0.04, ox: 0, oy: 0, s: small ? 0.34 : 1.0, a: 0, rot: 0, zoom: 1 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, fx: 0, fy: 0 };
  window.addEventListener('pointermove', (e) => { mouse.tx = e.clientX / window.innerWidth - 0.5; mouse.ty = e.clientY / window.innerHeight - 0.5; }, { passive: true });

  let w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize(); window.addEventListener('resize', resize);

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const DUR = 1700;

  function setShape(name, now) {
    if (name === current || !stage[name]) return;
    // freeze whatever is on screen right now as the new starting point
    if (mix < 1) {
      const m0 = ease(mix), snap = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = rnd[i] * 0.45; let m = (m0 - r) / 0.55; m = m < 0 ? 0 : m > 1 ? 1 : m; m = m * m * (3 - 2 * m);
        for (let k = 0; k < 3; k++) snap[i * 3 + k] = from[i * 3 + k] + (to[i * 3 + k] - from[i * 3 + k]) * m;
      }
      from = snap;
    } else from = to;
    to = get(stage[name].shape || name); current = name; mix = 0; mixStart = now;
    gl.bindBuffer(gl.ARRAY_BUFFER, bFrom); gl.bufferData(gl.ARRAY_BUFFER, from, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bTo); gl.bufferData(gl.ARRAY_BUFFER, to, gl.DYNAMIC_DRAW);
  }

  let colors = [[0.24, 0.35, 1], [0.65, 0.3, 1], [1, 0.3, 0.62], [1, 0.64, 0.3]];
  function setColors(list) { colors = list.map((c) => c.map((v) => v / 255)); }

  let started = 0, lastT = 0;
  function frame(now, scrollY, still, zoom) {
    if (!started) { started = now; mixStart = now; lastT = now; }
    const t = (now - started) / 1000, dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    mix = Math.min(1, (now - mixStart) / DUR);
    const st = stage[current], k = 0.06, narrow = w < 860;
    cur.tilt += (st.tilt - cur.tilt) * k;
    cur.ox += ((narrow ? 0 : st.ox) - cur.ox) * k;
    cur.oy += (st.oy - cur.oy) * k;
    cur.s += ((narrow ? (st.ns || st.s * 0.56) : st.s) - cur.s) * k;
    cur.a += (Math.min(1, st.a * (narrow ? 1.15 : 1)) - cur.a) * k;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    mouse.fx += (mouse.tx - mouse.fx) * 0.2; mouse.fy += (mouse.ty - mouse.fy) * 0.2;
    cur.zoom += ((zoom || 1) - cur.zoom) * 0.1;
    // glyphs rock side to side so they stay readable, everything else spins
    let rotY;
    if (st.osc) { cur.rot += (0 - cur.rot) * 0.05; rotY = Math.sin(t * 0.6) * st.osc + cur.rot; }
    else { cur.rot += dt * st.spin; rotY = cur.rot + scrollY * 0.0005; }
    if (still) rotY = 0.6;

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(sProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.enableVertexAttribArray(sLoc); gl.vertexAttribPointer(sLoc, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(SU.scroll, scrollY / h); gl.uniform1f(SU.time, still ? 0 : t); gl.uniform1f(SU.size, 2.6 * dpr);
    gl.drawArrays(gl.POINTS, 0, S);

    gl.useProgram(prog);
    for (const at of attribs) { gl.bindBuffer(gl.ARRAY_BUFFER, at.b); gl.vertexAttribPointer(at.loc, at.size, gl.FLOAT, false, 0, 0); }
    gl.uniform1f(U.uMix, ease(mix)); gl.uniform1f(U.uTime, still ? 0 : t);
    gl.uniform1f(U.uRotY, rotY + mouse.x * 0.5); gl.uniform1f(U.uRotX, cur.tilt + mouse.y * 0.3);
    gl.uniform1f(U.uScale, cur.s * cur.zoom); gl.uniform2f(U.uMouse, mouse.fx * 2, -mouse.fy * 2); gl.uniform1f(U.uSize, (w < 860 ? 4.6 : 5.6) * dpr * Math.max(0.7, h / 900));
    gl.uniform1f(U.uAspect, w / h); gl.uniform1f(U.uAlpha, cur.a);
    gl.uniform2f(U.uOff, cur.ox, cur.oy);
    gl.uniform3fv(U.uC1, colors[0]); gl.uniform3fv(U.uC2, colors[1]); gl.uniform3fv(U.uC3, colors[2]); gl.uniform3fv(U.uC4, colors[3]);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  window.RonitField = { setShape, setColors, frame };
})();
