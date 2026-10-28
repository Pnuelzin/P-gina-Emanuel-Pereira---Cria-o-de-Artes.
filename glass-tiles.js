/* ==========================================================================
   Glass Tiles — parede de vidros grossos com luz passando atrás
   --------------------------------------------------------------------------
   Porte vanilla (sem React) do componente "glass-tiles". O canvas cobre a
   dobra 2 (da divisória até o início do portfólio) e fica ATRÁS da lâmina
   de vidro: o backdrop-filter blur(8px) do .divider desfoca os feixes que
   passam por trás do vidro.

   Paleta = cores da página (styles.css):
     glow   = --color-accent #ffa058  (feixes)
     deep   = #5c341a                (poças — acento escurecido)
     ground = #0a0603                (vinco preto da página)

   Pointer-events none: o "lampião" segue o cursor via window (camada não
   intercepta cliques). prefers-reduced-motion: desenha um frame parado.
   ========================================================================== */
(() => {
  'use strict';

  const host = document.querySelector('.glass-tiles');
  const cv = document.querySelector('.glass-tiles__canvas');
  if (!host || !cv) return;

  const PALETTE = { glow: '#ffa058', deep: '#5c341a', ground: '#0a0603' };
  const COLUMNS = 8;

  const gl = cv.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return; /* sem WebGL: fica o fundo preto da página */

  /* ------------------------------------------------------------------
     Shaders (portados 1:1 do componente original)
     ------------------------------------------------------------------ */
  const VERT =
    'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uCols; uniform vec2 uMouse; uniform float uLamp;
uniform vec3 uGlow; uniform vec3 uDeep; uniform vec3 uGround;

float light(vec2 p){
  float t = uTime;
  float v = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float y = 0.5 + 0.32 * sin(p.x * (0.9 + fi * 0.35) + t * (0.21 + fi * 0.07) + fi * 2.1) + 0.12 * sin(p.x * 2.7 - t * 0.3 + fi);
    v += exp(-pow((p.y - y) / 0.02, 2.0)) * (1.0 - fi * 0.18);
  }
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 c = vec2(0.5 * uRes.x / uRes.y + 0.6 * sin(t * 0.13 + fi * 2.4), 0.5 + 0.35 * cos(t * 0.11 + fi * 1.7));
    v += exp(-dot(p - c, p - c) / 0.05) * 0.35;
  }
  vec2 m = uMouse / uRes.y;
  v += exp(-dot(p - m, p - m) / 0.012) * 1.2 * uLamp;
  return v;
}

void main(){
  vec2 p = gl_FragCoord.xy / uRes.y;
  float aspect = uRes.x / uRes.y;
  float size = aspect / uCols;
  vec2 id = floor(p / size);
  vec2 q = (fract(p / size) - 0.5) * 2.0;
  vec2 aq = abs(q);
  float sq = pow(pow(aq.x, 9.0) + pow(aq.y, 9.0), 1.0 / 9.0);
  float d = sq - 0.955;
  if (d > 0.0) { gl_FragColor = vec4(uGround * 0.6, 1.0); return; }
  float edge = clamp(1.0 + d / 0.55, 0.0, 1.0);
  vec2 g = normalize(sign(q) * pow(aq + 1e-4, vec2(8.0)));
  float bend = pow(edge, 2.2);
  vec2 centre = (id + 0.5) * size;
  vec2 look = centre + q * size * 0.5 * (1.0 - 0.55 * bend) - g * bend * size * 0.9;
  float L = light(look);
  float face = light(centre + q * size * 0.32) * 0.3;
  float rim = L * pow(edge, 1.5) * 3.2;
  float fres = pow(edge, 8.0) * 0.08;
  vec3 col = uGround + uDeep * (face + 0.04) + uGlow * (rim + face * 0.6) + vec3(1.0) * pow(max(rim - 1.2, 0.0), 2.0) * 0.35 + fres;
  col *= 0.85 + 0.15 * (0.5 + 0.5 * q.y);
  gl_FragColor = vec4(col, 1.0);
}`;

  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };

  const pr = gl.createProgram();
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;

  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(pr, n);
  const u = {
    res: U('uRes'),
    time: U('uTime'),
    cols: U('uCols'),
    mouse: U('uMouse'),
    lamp: U('uLamp'),
  };

  const rgb = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  };
  gl.uniform3f(U('uGlow'), ...rgb(PALETTE.glow));
  gl.uniform3f(U('uDeep'), ...rgb(PALETTE.deep));
  gl.uniform3f(U('uGround'), ...rgb(PALETTE.ground));

  /* Lampião segue o cursor (via window: o host é pointer-events none) */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = !matchMedia('(hover: hover) and (pointer: fine)').matches;

  let scale = 1,
    raf = 0,
    visible = true,
    alive = true,
    last = 0,
    t = 12;
  const m = { x: 0, y: 0, tx: 0, ty: 0, l: 0, tl: 0 };

  const resize = () => {
    scale = Math.min(devicePixelRatio || 1, 2) * (coarse ? 0.6 : 0.85);
    cv.width = Math.max(1, Math.round(host.clientWidth * scale));
    cv.height = Math.max(1, Math.round(host.clientHeight * scale));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(u.res, cv.width, cv.height);
    /* Ladrilhos maiores em telas estreitas */
    gl.uniform1f(
      u.cols,
      host.clientWidth < 640 ? Math.max(4, Math.round(COLUMNS * 0.55)) : COLUMNS
    );
  };

  const draw = () => {
    gl.uniform1f(u.time, t);
    gl.uniform2f(u.mouse, m.x, m.y);
    gl.uniform1f(u.lamp, m.l);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const tick = (now) => {
    raf = 0;
    if (!alive || !visible || document.hidden) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    if (coarse && now - last < 33) {
      raf = requestAnimationFrame(tick);
      return;
    }
    last = now;
    t += dt;
    m.x += (m.tx - m.x) * 0.12;
    m.y += (m.ty - m.y) * 0.12;
    m.l += (m.tl - m.l) * 0.06;
    draw();
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (reduced) return draw();
    if (!raf && alive) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    m.tx = ((e.clientX - r.left) / r.width) * cv.width;
    m.ty = (1 - (e.clientY - r.top) / r.height) * cv.height;
    if (!m.l) {
      m.x = m.tx;
      m.y = m.ty;
    }
    m.tl = 1;
  };
  const onLeave = () => (m.tl = 0);

  /* O host muda de posição/altura quando a página reconfigura (top/height
     são definidos pelo script.js) — re-renderiza nesses momentos */
  new ResizeObserver(() => {
    resize();
    draw();
  }).observe(host);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(host);

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) onLeave();
  });

  resize();
  draw();
  start();
})();
