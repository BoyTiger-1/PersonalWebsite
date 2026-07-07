/* site behavior: smooth scroll, reveals, canvas lifecycle, count-ups,
   nav, custom cursor, and a couple of easter eggs.
   everything that moves checks prefers-reduced-motion first. */

(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const isTouch = window.matchMedia('(hover: none)').matches;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    setupCanvases();
    setupReveals();
    setupCountUps();
    setupNav();
    setupScrollProgress();
    if (!isTouch && !reduce) setupCursor();
    setupHero();
    setupBrailleFooter();
    setupEasterEggs();
  }

  /* ---------- canvas project visuals ----------
     each canvas runs its own rAF loop, but only while it is on screen.
     that keeps five animations from cooking the cpu at once. */
  function setupCanvases() {
    const canvases = document.querySelectorAll('.project__canvas');
    canvases.forEach((canvas) => {
      const kind = canvas.dataset.visual;
      const factory = window.RonitVisuals && window.RonitVisuals[kind];
      if (!factory) return;
      const ctx = canvas.getContext('2d');
      let size = { w: 0, h: 0 };
      const getSize = () => size;

      function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap dpr for perf
        size = { w: rect.width, h: rect.height };
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in css pixels
      }
      resize();
      window.addEventListener('resize', resize);

      const frame = factory(ctx, getSize);
      let raf = null;
      const start = performance.now();
      frame(2.6); // paint one settled frame right away so the canvas is never blank pre-scroll

      function loop(now) {
        frame((now - start) / 1000);
        raf = requestAnimationFrame(loop);
      }

      // only spin the loop when the canvas is visible
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && raf === null) {
            if (reduce) { frame(2.6); return; } // one settled static frame, no loop
            raf = requestAnimationFrame(loop);
          } else if (!e.isIntersecting && raf !== null) {
            cancelAnimationFrame(raf); raf = null;
          }
        });
      }, { threshold: 0.05 });
      io.observe(canvas);
    });
  }

  /* ---------- scroll reveals ----------
     tag the things we want to fade+rise, then reveal on enter.
     prefer gsap ScrollTrigger; fall back to IntersectionObserver. */
  function setupReveals() {
    const targets = [
      ['.section-head', 0],
      ['.project__body', 0],
      ['.project__visual', 1],
      ['.stat', 0],
      ['.award', 0],
      ['.card', 0],
      ['.about__bio', 0],
      ['.about__skills', 1],
      ['.contact__title', 0],
      ['.contact__sub', 1],
      ['.contact__links', 2],
    ];
    const els = [];
    targets.forEach(([sel, delay]) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.setAttribute('data-reveal', '');
        if (delay) el.setAttribute('data-reveal-delay', String(delay));
        els.push(el);
      });
    });

    // titles are readable by default; only apply the outline when we can
    // animate it back to filled, so reduced-motion keeps them legible
    const fills = document.querySelectorAll('[data-fill]');
    if (reduce) { els.forEach((el) => el.classList.add('in')); return; }
    fills.forEach((el) => el.classList.add('is-outlined'));
    const fillIn = (el) => { el.classList.remove('is-outlined'); el.classList.add('is-filled'); };

    if (hasGSAP && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      els.forEach((el) => {
        ScrollTrigger.create({ trigger: el, start: 'top 85%', onEnter: () => el.classList.add('in') });
      });
      fills.forEach((el) => {
        ScrollTrigger.create({ trigger: el, start: 'top 80%', onEnter: () => fillIn(el) });
      });
    } else {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
        });
      }, { threshold: 0.15 });
      els.forEach((el) => io.observe(el));
      const io2 = new IntersectionObserver((entries, obs) => {
        entries.forEach((e) => { if (e.isIntersecting) { fillIn(e.target); obs.unobserve(e.target); } });
      }, { threshold: 0.4 });
      fills.forEach((el) => io2.observe(el));
    }
  }

  /* ---------- count-up numbers ---------- */
  function setupCountUps() {
    const nums = document.querySelectorAll('[data-count]');
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const comma = el.dataset.comma === '1';
      if (reduce) { el.textContent = fmt(target); return; }
      const dur = 1400, t0 = performance.now();
      function fmt(v) {
        let s = decimals ? v.toFixed(decimals) : String(Math.round(v));
        if (comma) s = Number(s).toLocaleString('en-US');
        return s + suffix;
      }
      function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.5 });
    nums.forEach((n) => io.observe(n));
  }

  /* ---------- nav: hide on scroll down, show on scroll up ---------- */
  function setupNav() {
    const nav = document.getElementById('nav');
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 20);
      if (y > last && y > 300) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- top scroll-progress bar ---------- */
  function setupScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- custom cursor (desktop, motion-ok only) ---------- */
  function setupCursor() {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    if (!dot || !ring) return;
    document.body.classList.add('has-cursor');
    let rx = 0, ry = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = `translate(${tx}px, ${ty}px) translate(-50%,-50%)`;
    });
    // ring trails with a little lag
    (function follow() {
      rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(follow);
    })();
    // grow over interactive things
    document.querySelectorAll('a, button, .card, .project__canvas').forEach((el) => {
      el.addEventListener('mouseenter', () => ring.classList.add('is-hot'));
      el.addEventListener('mouseleave', () => ring.classList.remove('is-hot'));
    });
    // safety net: if anything throws, hand control back to the native cursor
    window.addEventListener('error', () => {
      document.body.classList.remove('has-cursor');
      dot.style.display = ring.style.display = 'none';
    });
  }

  /* ---------- lenis smooth scroll, synced to gsap ---------- */
  function setupSmoothScroll() {
    if (reduce || isTouch || typeof window.Lenis === 'undefined') return;
    const lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (hasGSAP && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
    }
    // make in-page anchor clicks use lenis
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const el = document.querySelector(id);
        if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -10 }); }
      });
    });
  }

  /* ---------- hero entrance: stagger the two big lines in ---------- */
  function setupHero() {
    setupSmoothScroll();
    if (reduce || !hasGSAP) return;
    const lines = document.querySelectorAll('.hero__line');
    gsap.set(lines, { yPercent: 110, opacity: 0 });
    gsap.to(lines, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'power4.out', stagger: 0.12, delay: 0.15 });
    gsap.from('.hero__eyebrow, .hero__tagline, .hero__blurb, .hero__meta, .hero__scroll', {
      y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.5,
    });
    // gentle parallax: push the hero title up as you scroll away
    if (window.ScrollTrigger) {
      gsap.to('.hero__title', {
        yPercent: -18, opacity: 0.35, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      });
    }
  }

  /* ---------- braille footer: swap glyphs for the word on hover/focus ---------- */
  function setupBrailleFooter() {
    const el = document.querySelector('.footer__braille');
    if (!el) return;
    const braille = el.textContent;
    const word = el.dataset.translate || 'ronit';
    const show = (v) => { el.textContent = v; };
    el.addEventListener('mouseenter', () => show(word));
    el.addEventListener('mouseleave', () => show(braille));
    el.addEventListener('focus', () => show(word));
    el.addEventListener('blur', () => show(braille));
  }

  /* ---------- easter eggs ---------- */
  function setupEasterEggs() {
    // styled console note for anyone who peeks
    const s1 = 'color:#FF5C1F;font-size:15px;font-weight:700;font-family:monospace';
    const s2 = 'color:#A1A1AA;font-size:12px;font-family:monospace';
    console.log('%cRONIT AGARWAL', s1);
    console.log('%cbuilder / ai-ml developer. hiring or building something? ronit_agarwal@outlook.com', s2);
    console.log('%ctry typing "fire" anywhere on the page.', s2);

    // konami code OR typing "fire" triggers an ember burst
    const konami = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let ki = 0, typed = '';
    window.addEventListener('keydown', (e) => {
      // konami
      if (e.keyCode === konami[ki]) { ki++; if (ki === konami.length) { emberBurst(); ki = 0; } }
      else ki = 0;
      // word "fire"
      if (/^[a-z]$/i.test(e.key)) {
        typed = (typed + e.key.toLowerCase()).slice(-4);
        if (typed === 'fire') emberBurst();
      }
    });
  }

  // a quick particle burst on the fixed ember canvas
  function emberBurst() {
    if (reduce) return;
    const canvas = document.getElementById('emberLayer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = innerWidth / 2, cy = innerHeight * 0.55;
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
      return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 1, size: 1 + Math.random() * 3 };
    });
    const colors = ['#FF5C1F', '#FFB020', '#fff2d0'];
    const t0 = performance.now();
    (function anim(now) {
      const dt = Math.min(32, now - (anim._last || now)); anim._last = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      let alive = false;
      parts.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.vy += 0.12; // gravity
        p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.life -= 0.012;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = colors[(p.size | 0) % colors.length];
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (alive && now - t0 < 4000) requestAnimationFrame(anim);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }
})();
