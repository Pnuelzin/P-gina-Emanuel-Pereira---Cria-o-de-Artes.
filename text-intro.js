/* ==========================================================================
   Surgimento dos textos letra por letra (GSAP)
   --------------------------------------------------------------------------
   Hero: anima ao carregar a página.
   Restante (manifesto, portfólio, CTA): letras ficam prontas mas invisíveis
   e cada bloco anima quando entra na tela (IntersectionObserver, 1 vez).

   Os textos são recriados como palavras/letras INLINE — o kerning continua
   funcionando, quebra de linha acontece só entre palavras e os <br> (e
   qualquer <span> de cor/estilo, como o "S" do portfólio) são preservados.
   Sem GSAP ou com prefers-reduced-motion, a página fica estática.
   ========================================================================== */
(() => {
  'use strict';

  if (!window.gsap) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  /* Hero anima no load; o resto, ao entrar na tela */
  const HERO_TARGETS = ['.hero__eyebrow', '.hero__title', '.hero__text'];
  const SCROLL_TARGETS = [
    '.manifesto__title',
    '.manifesto__text',
    '.portfolio__title',
    '.portfolio__text',
    '.cta__title',
    '.cta__text',
  ];

  /* ------------------------------------------------------------------
     Reconstrução do texto em palavras/letras
     ------------------------------------------------------------------ */
  const appendWords = (text, parent) => {
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        parent.appendChild(document.createTextNode(' '));
        return;
      }
      const word = document.createElement('span');
      word.setAttribute('aria-hidden', 'true');
      part.split('').forEach((ch) => {
        const char = document.createElement('span');
        /* inline não aceita transform → a subida usa position relativo */
        char.style.position = 'relative';
        char.style.top = '0.7em';
        char.style.opacity = '0';
        char.textContent = ch;
        word.appendChild(char);
      });
      parent.appendChild(word);
    });
  };

  /* Text node → palavras; <br> → novo <br>; elemento → clone raso preservando
     classe/atributos, com os filhos processados dentro dele. */
  const rebuild = (node, parent) => {
    if (node.nodeType === 1 && node.tagName === 'BR') {
      /* Remove o original também — senão fica um <br> tardio a mais no fim
         do bloco, criando uma linha em branco indevida (espaçamento errado) */
      node.remove();
      parent.appendChild(document.createElement('br'));
    } else if (node.nodeType === 1) {
      const clone = node.cloneNode(false);
      parent.appendChild(clone);
      /* Remove o original ANTES de processar os filhos para dentro do clone
         — sem isso o texto fica DUPLICADO (original + clone por cima) */
      node.remove();
      Array.from(node.childNodes).forEach((child) => rebuild(child, clone));
    } else if (node.nodeType === 3) {
      appendWords(node.textContent, parent);
      /* Mesmo cuidado do clone: remove o texto original, senão ele
         permanece no DOM e o parágrafo aparece inteiro DE NOVO por cima */
      node.remove();
    }
  };

  const LETTERS_SELECTOR = 'span[aria-hidden] > span';

  const ornate = (el) => {
    if (!el || el.dataset.introDone) return;
    el.dataset.introDone = '1';
    /* innerText (não textContent) preserva quebras de <br> no aria-label */
    el.setAttribute('aria-label', el.innerText.trim().replace(/\s+/g, ' '));
    Array.from(el.childNodes).forEach((node) => rebuild(node, el));
  };

  /* ------------------------------------------------------------------
     Animação (mesma receita: fade + subida, letras em sequência)
     ------------------------------------------------------------------ */
  const animate = (el) => {
    gsap.to(el.querySelectorAll(LETTERS_SELECTOR), {
      top: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'power3.out',
      stagger: 0.014,
    });
  };

  /* Hero: entra no load, em sequência (eyebrow → título → texto) */
  const heroEls = HERO_TARGETS.map((s) => document.querySelector(s)).filter(
    Boolean
  );
  heroEls.forEach(ornate);
  heroEls.forEach((el, i) => {
    const before = heroEls.slice(0, i).reduce((n, e) => n + e.innerText.length, 0);
    gsap.to(el.querySelectorAll(LETTERS_SELECTOR), {
      top: 0,
      opacity: 1,
      duration: 0.5,
      ease: 'power3.out',
      stagger: 0.014,
      delay: 0.15 + before * 0.014,
    });
  });

  /* Restante: cada bloco anima quando 25% dele entra na tela (uma vez só) */
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              io.unobserve(entry.target);
              animate(entry.target);
            }
          },
          { threshold: 0.25 }
        )
      : null;

  SCROLL_TARGETS.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    ornate(el);
    if (io) io.observe(el);
    else animate(el); /* sem observer: anima direto */
  });
})();
