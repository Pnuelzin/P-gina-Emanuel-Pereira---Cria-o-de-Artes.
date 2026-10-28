/* ==========================================================================
   Carrossel 3D em anel (inspirado no componente "Tholos", do Framer)
   --------------------------------------------------------------------------
   Os cards ficam sobre um cilindro: giram em Y, recebem opacidade, blur e
   escurecimento conforme se afastam do centro. Funciona com arraste (com
   inércia), clique para centralizar, setas do teclado, roda horizontal e
   rolagem automática lenta.

   Sem dependências. Respeita prefers-reduced-motion e pausa fora da tela.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Dobra final: no mobile, .final-bg (textura bg-dobras.png) precisa
     cobrir da CTA até o fim da página, como no desktop. O CSS desktop
     fixa top: 2620px; aqui mede o topo da CTA e reposiciona quando a
     altura do conteúdo muda (resize, fontes, imagens).
     ------------------------------------------------------------------ */
  const mqMobileBg = window.matchMedia('(max-width: 1229.98px)');
  const finalBgEl = document.querySelector('.final-bg');
  const ctaEl = document.querySelector('.cta');

  const placeFinalBg = () => {
    if (!finalBgEl || !ctaEl) return;
    finalBgEl.style.top = mqMobileBg.matches ? `${ctaEl.offsetTop}px` : '';
  };

  placeFinalBg();
  if ('ResizeObserver' in window && document.body) {
    new ResizeObserver(placeFinalBg).observe(document.body);
  }
  window.addEventListener('resize', placeFinalBg);
  if (mqMobileBg.addEventListener) {
    mqMobileBg.addEventListener('change', placeFinalBg);
  }

  /* Glass Tiles: cobre da divisória até o fim da última foto da dobra 2. */
  const glassEl = document.querySelector('.glass-tiles');
  const dividerEl = document.querySelector('.divider');

  const placeGlassTiles = () => {
    if (!glassEl || !dividerEl) return;
    /* anchor = última foto da dobra: os <section> colapsam (filhos
       absolutos) no desktop — offsetTop de portfolio era 0 de altura */
    const thumb4 = document.querySelector('.trabalhos__thumb--4');
    if (!thumb4) return;
    const opts = dividerEl.offsetTop + 60;
    const end = thumb4.offsetTop + thumb4.offsetHeight + 140;
    glassEl.style.top = `${opts}px`;
    glassEl.style.height = `${Math.max(120, end - opts)}px`;
  };

  placeGlassTiles();
  if ('ResizeObserver' in window && document.body) {
    new ResizeObserver(placeGlassTiles).observe(document.body);
  }
  window.addEventListener('resize', placeGlassTiles);

  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const cards = Array.from(root.querySelectorAll('.carousel__card'));
  const total = cards.length;
  if (!total) return;

  const shades = cards.map((card) => card.querySelector('.carousel__shade'));
  const stage = root.querySelector('.carousel__stage');

  /* Parâmetros do anel (mesma lógica do Tholos).
     cardW, gap, radius e persp são recalculados em readMetrics() a partir
     da largura real do card no CSS — assim o carrossel acompanha o mobile. */
  const CFG = {
    cardW: 340,
    gap: 20,
    radius: 680,      // raio do cilindro — quanto maior, mais reto
    persp: 1300,
    maxTurn: 50,      // graus máximos de rotação
    arc: 78,          // metade do arco visível (graus)
    opFall: 0.55,     // queda de opacidade nas laterais
    blur: 6,          // blur máximo nas bordas
    darken: 0.6,      // escurecimento lateral
    drift: 0.12,      // cartões por segundo na rolagem automática
    stiffness: 120,
    damping: 20,
  };

  let unit = CFG.cardW + CFG.gap;
  let stride = unit / CFG.radius;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Lê a largura real do card (definida no CSS) e refaz as proporções.
     Mantém a relação do desktop: raio = 2x a largura do card e a mesma
     perspectiva — os cards menores no celular giram menos e não estouram. */
  const readMetrics = () => {
    const w = parseFloat(window.getComputedStyle(cards[0]).width);
    if (!w || !isFinite(w)) return false;

    const changed = Math.abs(w - CFG.cardW) > 0.5;

    CFG.cardW = w;
    CFG.gap = w * (20 / 340);
    CFG.radius = w * 2;
    CFG.persp = w * (1300 / 340);
    CFG.blur = w < 300 ? 4 : 6;

    unit = CFG.cardW + CFG.gap;
    stride = unit / CFG.radius;

    if (stage) stage.style.perspective = `${CFG.persp}px`;
    return changed;
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const smooth = (t) => {
    const u = clamp(t, 0, 1);
    return u * u * (3 - 2 * u);
  };

  /* Distância assinada mais curta no anel (em cartões) */
  const loopGap = (v) => {
    let r = ((v % total) + total) % total;
    if (r > total / 2) r -= total;
    return r;
  };

  const state = {
    pos: 0,
    vel: 0,
    aim: null,
    grabbed: false,
    hover: false,
    lastTouch: 0,
    raf: 0,
    lastT: 0,
  };

  let visible = true;
  let grip = null;
  let swallowClick = false;
  let wheelTimer = 0;

  /* ------------------------------------------------------------------ */
  /* Desenho                                                            */
  /* ------------------------------------------------------------------ */
  const paint = () => {
    for (let i = 0; i < total; i++) {
      const el = cards[i];
      const d = loopGap(i - state.pos);
      const theta = d * stride;
      const deg = (theta * 180) / Math.PI;
      const t = Math.abs(deg) / CFG.arc;

      if (t >= 1) {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '0';
        el.tabIndex = -1;
        el.setAttribute('aria-hidden', 'true');
        continue;
      }

      const rim = t > 0.72 ? 1 - smooth((t - 0.72) / 0.28) : 1;
      const x = CFG.radius * Math.sin(theta);
      const z = CFG.radius * (Math.cos(theta) - 1);
      const turn = clamp(deg, -CFG.maxTurn, CFG.maxTurn);
      const alpha = clamp(1 - CFG.opFall * t, 0, 1) * rim;
      const blur = CFG.blur * Math.pow(t, 1.3);
      const dim = clamp(CFG.darken * t, 0, 1);
      const layer = 500 - Math.round(Math.abs(d) * 20);
      const reachable = alpha > 0.18;

      el.style.visibility = 'visible';
      el.style.opacity = alpha.toFixed(4);
      el.style.zIndex = String(layer);
      el.style.transform =
        `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, 0px, ${z.toFixed(2)}px) ` +
        `rotateY(${turn.toFixed(2)}deg)`;
      el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
      el.style.pointerEvents = reachable ? 'auto' : 'none';
      el.tabIndex = reachable ? 0 : -1;

      if (reachable) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');

      if (shades[i]) shades[i].style.opacity = dim.toFixed(4);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Loop                                                               */
  /* ------------------------------------------------------------------ */
  const tick = (now) => {
    state.raf = 0;
    if (!visible) {
      state.lastT = 0;
      return;
    }

    const dt = Math.min(0.05, state.lastT ? (now - state.lastT) / 1000 : 1 / 60);
    state.lastT = now;

    let keepGoing = false;

    if (state.grabbed) {
      keepGoing = true;
    } else if (state.aim !== null) {
      /* mola: integração em 4 fatias, como no componente original */
      const slices = 4;
      const h = dt / slices;
      for (let s = 0; s < slices; s++) {
        const pull = CFG.stiffness * (state.aim - state.pos) - CFG.damping * state.vel;
        state.vel += pull * h;
        state.pos += state.vel * h;
      }
      if (Math.abs(state.aim - state.pos) < 8e-4 && Math.abs(state.vel) < 0.003) {
        state.pos = state.aim;
        state.vel = 0;
        state.aim = null;
      }
      /* Mesmo assentando o card, o anel continua no próximo tick (drift) —
         sem isso o rAF encerrava aqui e o carrossel ficava parado. */
      keepGoing = true;
    } else if (!reduced.matches) {
      /* Movimento contínuo: o drift volta a rodar assim que o usuário
         solta (o mola termina de assentar acima) e também com o mouse
         sobre o carrossel — nunca fica parado. */
      state.pos += CFG.drift * dt;
      keepGoing = true;
    }

    paint();

    if (keepGoing) state.raf = requestAnimationFrame(tick);
    else state.lastT = 0;
  };

  const wake = () => {
    if (state.raf || !visible) return;
    state.lastT = 0;
    state.raf = requestAnimationFrame(tick);
  };

  const nudge = (dir) => {
    const base = state.aim !== null ? state.aim : state.pos;
    state.aim = Math.round(base) + dir;
    state.lastTouch = performance.now();
    wake();
  };

  /* ------------------------------------------------------------------ */
  /* Arraste                                                            */
  /* ------------------------------------------------------------------ */
  const onMove = (e) => {
    if (!grip) return;

    const dx = e.clientX - grip.x0;

    if (!grip.moved) {
      if (Math.abs(dx) < 6) return;
      grip.moved = true;
      state.grabbed = true;
      state.aim = null;
      state.vel = 0;
      grip.pos0 = state.pos + dx / unit;
      wake();
    }

    state.pos = grip.pos0 - dx / unit;

    const now = performance.now();
    const span = (now - grip.tPrev) / 1000;
    if (span > 0) {
      const inst = (-(e.clientX - grip.xPrev) / unit) / span;
      state.vel = state.vel * 0.55 + inst * 0.45;
    }
    grip.xPrev = e.clientX;
    grip.tPrev = now;

    paint();
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    const g = grip;
    grip = null;
    if (!g || !g.moved) return;

    swallowClick = true;
    window.setTimeout(() => {
      swallowClick = false;
    }, 80);

    const now = performance.now();
    if (now - g.tPrev > 90) state.vel = 0;

    state.grabbed = false;
    const fling = clamp(state.vel, -24, 24);
    state.aim = Math.round(state.pos + fling * 0.32);
    state.lastTouch = now;
    wake();
  };

  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    grip = {
      x0: e.clientX,
      xPrev: e.clientX,
      tPrev: performance.now(),
      pos0: state.pos,
      moved: false,
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') state.hover = true;
  });

  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || grip) return;
    state.hover = false;
    state.lastTouch = performance.now() - 900;
  });

  /* ------------------------------------------------------------------ */
  /* Clique centraliza o card / teclado                                 */
  /* ------------------------------------------------------------------ */
  cards.forEach((card, i) => {
    const img = card.querySelector('img');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${img ? img.alt : 'Projeto'} — centralizar`);

    card.addEventListener('click', () => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      const d = loopGap(i - state.pos);
      state.aim = Math.round(state.pos + d);
      state.lastTouch = performance.now();
      wake();
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        card.click();
      }
    });
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudge(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudge(-1);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Roda do trackpad (apenas horizontal, para não travar o scroll)      */
  /* ------------------------------------------------------------------ */
  root.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

      e.preventDefault();

      const from = state.aim !== null ? state.aim : state.pos;
      state.aim = clamp(from + (e.deltaX / unit) * 0.8, state.pos - 6, state.pos + 6);
      state.lastTouch = performance.now();
      wake();

      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        state.aim = Math.round(state.aim !== null ? state.aim : state.pos);
        state.lastTouch = performance.now();
        wake();
      }, 150);
    },
    { passive: false }
  );

  /* ------------------------------------------------------------------ */
  /* Pausa fora da tela / preferência de movimento                       */
  /* ------------------------------------------------------------------ */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
        if (visible) {
          state.lastT = 0;
          wake();
        } else if (state.raf) {
          cancelAnimationFrame(state.raf);
          state.raf = 0;
        }
      },
      { threshold: 0 }
    ).observe(root);
  }

  if (reduced.addEventListener) {
    reduced.addEventListener('change', () => {
      state.lastT = 0;
      paint();
      wake();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Recalcula o anel ao mudar a largura (resize / girar o celular)      */
  /* ------------------------------------------------------------------ */
  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (readMetrics()) {
        state.lastT = 0;
        paint();
        wake();
      }
    });
  };

  if ('ResizeObserver' in window) {
    new ResizeObserver(onResize).observe(cards[0]);
  } else {
    window.addEventListener('resize', onResize);
  }

  /* ------------------------------------------------------------------ */
  /* Início                                                             */
  /* ------------------------------------------------------------------ */
  readMetrics();
  root.classList.add('is-ready');
  paint();
  wake();
})();
