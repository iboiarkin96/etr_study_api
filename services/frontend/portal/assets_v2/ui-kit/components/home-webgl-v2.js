/* ui-kit/components/home-webgl-v2.js
   Soft sky-blue flowfield WebGL2 background for the landing-portal hero.

   Ported from v1 home-webgl.js so the field reads "alive" again:
     - Simplex-noise fbm with curl-style domain warp (calm, organic ribbons).
     - Mouse warp + a barely-there halo glow so the field acknowledges the
       cursor; never chases.
     - Scroll-driven rotation + slight zoom; the surface settles as the
       user reads down the hero.
     - Intensity fade-in so the canvas glides in instead of popping.
     - Premultiplied alpha + vignette mask: corners and the H1 zone stay
       quiet, the canvas never paints above ~55 % opacity anywhere.

   Usage:
     import { initHomeWebGL } from "./home-webgl-v2.js";
     const cancel = initHomeWebGL(document.querySelector(".lp-hero__canvas")); */

const VERT = `#version 300 es
in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;

uniform float u_t;
uniform vec2  u_res;
uniform vec2  u_mouse;       /* 0..1 in hero space, y-up */
uniform float u_scroll;      /* 0..1 across hero scroll-out */
uniform float u_intensity;   /* 0..1 fade-in */
uniform vec3  u_c0;          /* deep base */
uniform vec3  u_c1;          /* mid */
uniform vec3  u_c2;          /* highlight */
uniform float u_theme;       /* 1 dark, 0 light */

out vec4 fragColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0),
                          dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float a = 0.5;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  uv.y = 1.0 - uv.y;

  /* Aspect-corrected coords so rotation/swirls read circular */
  vec2 q = (gl_FragCoord.xy - 0.5 * u_res.xy) / min(u_res.x, u_res.y);

  /* Mouse warp — subtle local pull, decays quickly with distance */
  vec2 m   = (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  vec2 toM = m - q;
  float md = length(toM);
  vec2 warp = toM * exp(-md * 4.5) * 0.07;

  /* Scroll: slow rotation + gentle zoom — the field "settles" as you read */
  float ang  = u_scroll * 0.28;
  float zoom = 1.0 + u_scroll * 0.18;
  vec2 nq = rot(ang) * q * zoom + warp;

  /* Slowed time — noble drift, never frantic */
  float t = u_t * 0.035;

  /* Two-stage fbm with curl-style domain warp = cheap fluid look */
  vec2 d1 = vec2(fbm(nq * 1.1 + vec2(t,        -t * 0.7)),
                 fbm(nq * 1.1 + vec2(-t * 0.6,  t)));
  float n  = fbm(nq * 1.25 + d1 * 1.0 + vec2(0.0, t * 0.5));

  /* Wide, slow sinusoidal bands — fewer ridges, no shimmer */
  float bands = 0.5 + 0.5 * sin(n * 6.2831853 * 0.85 + u_t * 0.16);

  /* Color stack: base → mid by bands, bias to highlight in deep field */
  vec3 col = mix(u_c0, u_c1, smoothstep(0.05, 0.95, bands));
  col = mix(col, u_c2, smoothstep(0.62, 1.10, n * 0.5 + 0.5));

  /* Restrained mouse halo — a breath of light, not a torch */
  float glow = exp(-md * 6.0);
  col += u_c2 * glow * 0.18;

  /* Light theme keeps colours saturated so multiply blend reads on white */
  col = mix(col * 0.72, col, u_theme);

  /* Vignette mask: top (H1 zone) + corners stay quiet */
  float vignTop = smoothstep(0.0, 0.60, uv.y);
  float vignRad = smoothstep(0.92, 0.22, length(uv - vec2(0.5, 0.48)));
  float mask = vignTop * vignRad;

  /* Two ceilings so the highlight never reads as "white flash" */
  float lightA = clamp(0.28 + 0.14 * bands, 0.0, 0.62) * mask;
  float darkA  = clamp(0.22 + 0.09 * bands, 0.0, 0.50) * mask;
  float alpha  = mix(lightA, darkA, u_theme) * u_intensity;

  /* Premultiplied alpha — required by blendFunc(ONE, 1-SRC_ALPHA) */
  fragColor = vec4(col * alpha, alpha);
}`;

function compileShader(gl, src, type) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn("[home-webgl-v2] shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function buildProgram(gl) {
  const vs = compileShader(gl, VERT, gl.VERTEX_SHADER);
  const fs = compileShader(gl, FRAG, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn("[home-webgl-v2] program link failed:", gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

/* Sky palette — saturated mid-to-deep sky blues; no near-white, no violet,
   no harsh accent that could flash. */
const PALETTE = {
  light: {
    c0: [0.008, 0.318, 0.490],  /* #0851a0 sky-800 — deep base */
    c1: [0.012, 0.412, 0.631],  /* #0369a1 sky-700 — mid tone  */
    c2: [0.055, 0.647, 0.914],  /* #0ea5e9 sky-500 — highlight */
    theme: 0.0,
  },
  dark: {
    c0: [0.012, 0.412, 0.631],  /* #0369a1 sky-700 — base */
    c1: [0.055, 0.647, 0.914],  /* #0ea5e9 sky-500 — mid + halo */
    c2: [0.490, 0.827, 0.988],  /* #7dd3fc sky-300 — highlight */
    theme: 1.0,
  },
};

export function initHomeWebGL(canvas) {
  if (!canvas) return null;
  if (window.innerWidth < 1025) return null;

  const host = canvas.parentElement || canvas;
  const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const prog = buildProgram(gl);
  if (!prog) return null;
  gl.useProgram(prog);

  /* Full-screen quad */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1,  1, -1,  -1,  1,  1,  1]),
    gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  /* Premultiplied-alpha blending so the vignette mask fades into the card */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const uT         = gl.getUniformLocation(prog, "u_t");
  const uRes       = gl.getUniformLocation(prog, "u_res");
  const uMouse     = gl.getUniformLocation(prog, "u_mouse");
  const uScroll    = gl.getUniformLocation(prog, "u_scroll");
  const uIntensity = gl.getUniformLocation(prog, "u_intensity");
  const uC0        = gl.getUniformLocation(prog, "u_c0");
  const uC1        = gl.getUniformLocation(prog, "u_c1");
  const uC2        = gl.getUniformLocation(prog, "u_c2");
  const uTheme     = gl.getUniformLocation(prog, "u_theme");

  /* ── State ─────────────────────────────────────────────────────────── */

  let mouseX = 0.5, mouseY = 0.5;
  let mouseTargetX = 0.5, mouseTargetY = 0.5;
  let scroll = 0, scrollTarget = 0;
  let intensity = 0;
  const intensityTarget = 1;
  let raf = 0;
  let disposed = false;
  let lastTs = 0;

  function getPalette() {
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    return PALETTE[theme] || PALETTE.light;
  }

  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  function readScrollProgress() {
    const rect = host.getBoundingClientRect();
    const total = rect.height;
    if (total <= 0) return 0;
    const traveled = Math.max(0, -rect.top);
    return Math.max(0, Math.min(1, traveled / total));
  }

  function onPointerMove(event) {
    const rect = host.getBoundingClientRect();
    mouseTargetX = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouseTargetY = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
  }

  function onPointerLeave() {
    mouseTargetX = 0.5;
    mouseTargetY = 0.5;
  }

  function draw(timeSeconds, dt) {
    /* Smooth state — restrained coefficients so the field glides */
    mouseX += (mouseTargetX - mouseX) * Math.min(1, dt * 3.2);
    mouseY += (mouseTargetY - mouseY) * Math.min(1, dt * 3.2);
    scrollTarget = readScrollProgress();
    scroll += (scrollTarget - scroll) * Math.min(1, dt * 3.0);
    intensity += (intensityTarget - intensity) * Math.min(1, dt * 2.0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    const pal = getPalette();
    gl.uniform3fv(uC0, pal.c0);
    gl.uniform3fv(uC1, pal.c1);
    gl.uniform3fv(uC2, pal.c2);
    gl.uniform1f(uTheme, pal.theme);
    gl.uniform1f(uT, timeSeconds);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mouseX, mouseY);
    gl.uniform1f(uScroll, scroll);
    gl.uniform1f(uIntensity, intensity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  resize();
  draw(0, 0);

  if (reducedMq.matches) {
    /* Reduced motion: a single static draw at full intensity, no rAF */
    intensity = 1;
    draw(0, 0);
    return null;
  }

  const t0 = performance.now();
  function tick(now) {
    if (disposed) return;
    const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 0.016;
    lastTs = now;
    draw((now - t0) * 0.001, dt);
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  host.addEventListener("pointermove", onPointerMove, { passive: true });
  host.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("scroll", () => { scrollTarget = readScrollProgress(); }, { passive: true });

  raf = requestAnimationFrame(tick);

  return function cancel() {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerleave", onPointerLeave);
  };
}
