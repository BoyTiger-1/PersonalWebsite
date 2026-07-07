/* webgl ember hero. a fullscreen fragment shader draws domain-warped
   fbm noise rising like heat, colored through an ember ramp, brighter
   near the mouse. if webgl isn't available we fall back to a light
   2d ember-particle field so the hero is never flat. */

(function () {
  const canvas = document.getElementById('heroGl');
  if (!canvas) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  });

  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false })
          || canvas.getContext('experimental-webgl');

  if (!gl) { fallback2D(); return; }

  const vert = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  // fire-ish flow. fbm + domain warp, rising over time, ember palette,
  // stronger toward the bottom so the name up top stays readable.
  const frag = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float a = hash(i), b = hash(i + vec2(1.0,0.0));
      float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float v = 0.0, amp = 0.5;
      for (int i = 0; i < 5; i++){ v += amp * noise(p); p *= 2.0; amp *= 0.5; }
      return v;
    }

    vec3 ember(float t){
      t = clamp(t, 0.0, 1.0);
      vec3 c0 = vec3(0.04,0.04,0.05);   // near black
      vec3 c1 = vec3(0.23,0.08,0.0);    // deep red
      vec3 c2 = vec3(0.48,0.15,0.0);    // burnt orange
      vec3 c3 = vec3(1.0,0.36,0.12);    // ember (#FF5C1F)
      vec3 c4 = vec3(1.0,0.69,0.13);    // amber (#FFB020)
      vec3 c5 = vec3(1.0,0.96,0.88);    // white hot
      if (t < 0.2) return mix(c0,c1,t/0.2);
      if (t < 0.4) return mix(c1,c2,(t-0.2)/0.2);
      if (t < 0.65) return mix(c2,c3,(t-0.4)/0.25);
      if (t < 0.85) return mix(c3,c4,(t-0.65)/0.2);
      return mix(c4,c5,(t-0.85)/0.15);
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 p = uv;
      p.x *= u_res.x / u_res.y;

      float t = u_time * 0.12;
      // domain warp so the flow curls instead of scrolling flat
      vec2 q = vec2(fbm(p*3.0 + vec2(0.0, -t*4.0)), fbm(p*3.0 + vec2(5.2, -t*4.0 + 1.3)));
      float f = fbm(p*3.0 + q*1.6 + vec2(0.0, -t*3.0));

      // heat concentrated near the bottom, fading up quickly so the
      // upper half stays calm enough to read the name and tagline over
      float rise = pow(1.0 - uv.y, 3.0);
      float heat = f * rise * 1.4;

      // mouse adds a soft bright bloom
      vec2 m = u_mouse; m.x *= u_res.x / u_res.y;
      float md = distance(p, m);
      heat += smoothstep(0.5, 0.0, md) * 0.26 * rise;

      vec3 col = ember(heat);
      // keep the very top calm and dark for text contrast
      col *= smoothstep(1.0, 0.35, uv.y) * 0.9 + 0.08;

      // gentle vignette
      float vig = smoothstep(1.15, 0.35, distance(uv, vec2(0.5)));
      col *= vig;

      float alpha = clamp(heat * 1.2 + 0.05, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('shader', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) { fallback2D(); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback2D(); return; }
  gl.useProgram(prog);

  // one big triangle covering the screen
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // shader is cheap-ish, cap dpr anyway
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
  }
  resize();
  window.addEventListener('resize', resize);

  const start = performance.now();
  function render(now) {
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, reduce ? 6.0 : (now - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce) requestAnimationFrame(render);
  }
  if (reduce) { render(performance.now()); }      // one static frame
  else requestAnimationFrame(render);

  window.HeroGL = { mode: 'webgl' };

  // ---------- 2d fallback: rising ember particles ----------
  function fallback2D() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w, h, dpr;
    function rs() { dpr = Math.min(devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight; canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    rs(); addEventListener('resize', rs);
    const N = 90;
    const parts = Array.from({ length: N }, () => spawn());
    function spawn() { return { x: Math.random()*innerWidth, y: innerHeight + Math.random()*200, vy: 0.4 + Math.random()*1.4, r: 0.6 + Math.random()*2.2, a: 0.2 + Math.random()*0.5 }; }
    const cols = ['#FF5C1F', '#FFB020', '#ff8a3d'];
    function frame() {
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p, i) => {
        p.y -= p.vy; p.x += Math.sin((p.y + i) * 0.02) * 0.4;
        if (p.y < -10) parts[i] = spawn();
        const life = p.y / innerHeight;
        ctx.globalAlpha = p.a * life;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (!reduce) requestAnimationFrame(frame);
    }
    frame();
    window.HeroGL = { mode: '2d' };
  }
})();
