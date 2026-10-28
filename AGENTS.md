# Instruções do projeto — Arte.

## Regras de trabalho

- **NUNCA tirar screenshots, ejecutar Playwright/headless browser, ou gerar
  imagens de conferência visual** — nem em pastas temporárias, nem no projeto.
  O usuário pediu explicitamente para que isso NÃO aconteça.
- Não rodar processos de verificação/medição desnecessários. Quando o usuário
  pedir uma alteração, fazer **apenas a alteração no código** (HTML/CSS/JS),
  direto no ponto, e reportar de forma breve.
- Economizar tokens: nada de análises longas, serializações ou leituras
  completas de arquivos quando basta uma busca pontual.

## Contexto do site

- Desktop: layout absoluto fixo em 1230px (`styles.css`), breakpoint mobile em
  `1229.98px` (`responsive.css` + `media` do `<picture>` da hero).
- A dobra 2 mobile usa o próprio SVG do desktop (viewBox 1230×1160) em
  escala uniforme 0.85, recortado pela caixa da divisória.
- A última dobra (CTA + rodapé) usa `assets/bg-dobras.png` via `.final-bg`
  contínuo (topo posicionado por `script.js` no mobile).
- Introdução de letras da hero: `text-intro.js` (GSAP via CDN) — letras
  inline (não inline-block), `<br>` preservado.
- Carrossel: movimento contínuo após qualquer interação (`script.js`).
