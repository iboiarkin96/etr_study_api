/* ui-kit/components/rocket.js
   On landing pages   → loads the home WebGL flowfield into a
                        [data-component="rocket"] slot.
   On docs-shell pages → mounts the premium scroll-to-top FAB:
     • Stroke-based SVG rocket icon (ported from legacy design)
     • Idle bob + rotate animation; 5 ember particles; CSS smoke puffs
     • Conic-gradient progress ring tracking scroll 0→100 %
     • On click: WebGL2 FBM smoke cloud + Bézier loop trajectory
       (Canvas2D fallback when WebGL2 unavailable)
     • prefers-reduced-motion: instant scroll, no animation
   The "armed at footer" gate from the legacy version is removed —
   the button is clickable from the moment it appears (300 px scroll). */

const WEBGL_URL = "/services/frontend/portal/assets/home-webgl.js";

/* ── SVG — stroke-based thin-line rocket, same as legacy design ── */
const ROCKET_SVG = `<svg class="docs-rocket-fab__rocket"
     xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 24 24" width="28" height="28"
     fill="none" stroke="currentColor"
     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true" focusable="false">
  <path d="M12 3c3.4 1.9 5.5 5.5 5.5 9.3v1.1L12 19l-5.5-5.6v-1.1C6.5 8.5 8.6 4.9 12 3z"/>
  <path d="M12 8.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z"/>
  <path d="M9.3 16.6l-1.8 3.1M14.7 16.6l1.8 3.1"/>
  <path d="M10.8 19.3h2.4"/>
</svg>`;

/* ── Fallback SVG for landing-page slots ─────────────────────── */
function svgFallback(slot) {
  slot.innerHTML =
    "<svg class='docs-rocket__fallback' viewBox='0 0 220 220' aria-hidden='true' xmlns='http://www.w3.org/2000/svg'>" +
    "<defs><radialGradient id='r-g' cx='50%' cy='40%' r='60%'><stop offset='0%' stop-color='var(--accent)' stop-opacity='0.5'/><stop offset='100%' stop-color='var(--accent)' stop-opacity='0'/></radialGradient></defs>" +
    "<circle cx='110' cy='110' r='90' fill='url(#r-g)'/>" +
    "<path d='M110 30 c20 30 30 60 30 90 c0 22 -14 40 -30 50 c-16 -10 -30 -28 -30 -50 c0 -30 10 -60 30 -90 z' fill='currentColor' fill-opacity='0.85'/>" +
    "<circle cx='110' cy='100' r='12' fill='var(--card)'/>" +
    "</svg>";
}

function loadWebgl() {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src='${WEBGL_URL}']`)) return resolve();
    const s = document.createElement("script");
    s.src = WEBGL_URL;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ── WebGL2 smoke launch animation ────────────────────────────────
   Ported from legacy docs-nav.js:initBackToTopButton.launchRocketAnimation.
   Architecture:
     • Bézier loop trajectory: approach + G2-continuous circle + exit
     • C2-smooth velocity profile: smootherstep + Gaussian apex
     • Per-frame tangent rotation + curvature banking + speed stretch
     • CPU particle pool (2400 WebGL / 800 Canvas2D)
     • WebGL2: two-pass instanced quads — smoke (premul over) + hot (additive)
       Fragment shader: domain-warped FBM gives cauliflower cloud structure
     • Canvas2D fallback: radial gradients, no shader needed
   @param {HTMLElement} wrap — the __rocket-wrap span (gets CSS transform during flight)
   @param {Function} onDone — called when animation fully completes */
function launchRocketAnimation(wrap, onDone) {
  const DURATION        = 2600;    // ms total flight
  const PRE_MS          = 800;     // smoke pre-charge before liftoff
  const FIXED_STEP      = 1 / 60; // deterministic sim step (seconds)
  const SMOKE_DRAG      = 0.93;
  const SMOKE_SETTLE_ACC = 50;     // px/s² downward drift
  const SMOKE_SPREAD    = 1.0;
  const SMOKE_LIFETIME  = 3.0;    // seconds

  // Deterministic particle RNG — fixed seed → same visuals every launch.
  let rngState = 0x51f15eed >>> 0;
  function rand() {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ── Trajectory ────────────────────────────────────────────────
  const vw = window.innerWidth, vh = window.innerHeight;
  const s  = Math.max(0.45, Math.min(vh / 900, (vw - 60) / 480, 1.4));
  const R  = 110 * s;
  const kc = R * 0.5522847498; // Bézier kappa for circle
  const lx = -260 * s, ly = -560 * s;
  const cx = lx + R, cy = ly;

  const segs = [
    [[0, 0], [-40 * s, -120 * s], [-120 * s, -260 * s], [-180 * s, -360 * s]],
    [[-180 * s, -360 * s], [-240 * s, -460 * s], [lx, ly + kc], [lx, ly]],
    [[cx - R, cy], [cx - R, cy - kc], [cx - kc, cy - R], [cx, cy - R]],
    [[cx, cy - R], [cx + kc, cy - R], [cx + R, cy - kc], [cx + R, cy]],
    [[cx + R, cy], [cx + R, cy + kc], [cx + kc, cy + R], [cx, cy + R]],
    [[cx, cy + R], [cx - kc, cy + R], [cx - R, cy + kc], [cx - R, cy]],
    [[lx, ly], [lx, ly - kc], [-220 * s, -780 * s], [-160 * s, -900 * s]],
  ];

  function bpt(seg, t) {
    const [p0, c1, c2, p1] = seg;
    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt, t2 = t * t, t3 = t2 * t;
    return [
      mt3 * p0[0] + 3 * mt2 * t * c1[0] + 3 * mt * t2 * c2[0] + t3 * p1[0],
      mt3 * p0[1] + 3 * mt2 * t * c1[1] + 3 * mt * t2 * c2[1] + t3 * p1[1],
    ];
  }
  function btan(seg, t) {
    const [p0, c1, c2, p1] = seg;
    const mt = 1 - t, mt2 = mt * mt, t2 = t * t;
    return [
      3 * (mt2 * (c1[0] - p0[0]) + 2 * mt * t * (c2[0] - c1[0]) + t2 * (p1[0] - c2[0])),
      3 * (mt2 * (c1[1] - p0[1]) + 2 * mt * t * (c2[1] - c1[1]) + t2 * (p1[1] - c2[1])),
    ];
  }
  function bcurv(seg, t) {
    const tan = btan(seg, t);
    const [p0, c1, c2, p1] = seg; const mt = 1 - t;
    const d2x = 6 * (mt * (c2[0] - 2 * c1[0] + p0[0]) + t * (p1[0] - 2 * c2[0] + c1[0]));
    const d2y = 6 * (mt * (c2[1] - 2 * c1[1] + p0[1]) + t * (p1[1] - 2 * c2[1] + c1[1]));
    const cr  = tan[0] * d2y - tan[1] * d2x;
    const ln  = Math.hypot(tan[0], tan[1]);
    return ln < 1e-8 ? 0 : cr / (ln * ln * ln);
  }

  // Arc-length table for uniform-speed reparameterization.
  const NSAMP = 100;
  const arcTbl = [];
  let totalArc = 0;
  for (let si = 0; si < segs.length; si++) {
    let prev = bpt(segs[si], 0);
    for (let i = 1; i <= NSAMP; i++) {
      const t = i / NSAMP;
      const cur = bpt(segs[si], t);
      const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
      totalArc += Math.sqrt(dx * dx + dy * dy);
      arcTbl.push({ si, t, len: totalArc });
      prev = cur;
    }
  }
  function arcLookup(u) {
    const tgt = u * totalArc;
    let lo = 0, hi = arcTbl.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (arcTbl[m].len < tgt) lo = m + 1; else hi = m;
    }
    if (lo === 0) return { si: arcTbl[0].si, t: arcTbl[0].t };
    const a = arcTbl[lo - 1], b = arcTbl[lo];
    const f = (b.len - a.len) > 1e-10 ? (tgt - a.len) / (b.len - a.len) : 0;
    return { si: b.si, t: a.t + f * (b.t - a.t) };
  }

  // C2-smooth velocity profile: smootherstep + Gaussian apex + exit bias.
  function smootherstep(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  const APEX_T = 0.54, APEX_S = 0.072, APEX_A = 0.42, EXIT_B = 0.20;
  function velProfile(t) {
    let u = smootherstep(t);
    const dt = t - APEX_T;
    u *= 1 - APEX_A * Math.exp(-(dt * dt) / (2 * APEX_S * APEX_S));
    if (t > 0.74) { const e = (t - 0.74) / 0.26; u += EXIT_B * e * e; }
    return Math.max(0, Math.min(1, u));
  }
  function velSpeed(t) {
    const h = 0.008;
    return (velProfile(Math.min(1, t + h)) - velProfile(Math.max(0, t - h))) / (2 * h);
  }

  // Start position in viewport coordinates.
  const wr     = wrap.getBoundingClientRect();
  const startX = wr.left + wr.width  * 0.5;
  const startY = wr.top  + wr.height * 0.5;

  const NOZZLE_LEN = 14;
  function nozzlePos(cx2, cy2, ang) {
    return {
      x: cx2 - Math.sin(ang) * NOZZLE_LEN,
      y: cy2 + Math.cos(ang) * NOZZLE_LEN,
    };
  }

  function rocketStateAt(flightT) {
    const u   = velProfile(flightT);
    const { si, t: bt } = arcLookup(u);
    const seg = segs[si];
    const pos = bpt(seg, bt);
    const tan = btan(seg, bt);
    const tl  = Math.hypot(tan[0], tan[1]);
    const tx  = tl > 1e-8 ? tan[0] / tl : 0;
    const ty  = tl > 1e-8 ? tan[1] / tl : -1;
    const angle = Math.atan2(tx, -ty);
    const curv  = bcurv(seg, bt);
    const bank  = Math.max(-0.38, Math.min(0.38, curv * R * 0.22));
    const spd   = velSpeed(flightT);
    const sy2   = 1 + Math.min(0.22, spd * 0.14);
    const sx2   = 1 - Math.min(0.06, spd * 0.04);
    const vib   = 0.009 * Math.sin(flightT * Math.PI * 12);
    const fAng  = angle + bank + vib;
    const rocketCX = startX + pos[0];
    const rocketCY = startY + pos[1];
    const noz = nozzlePos(rocketCX, rocketCY, fAng);
    return { pos, tx, ty, spd, sx2, sy2, fAng, noz };
  }

  // ── Canvas + WebGL2 detection ─────────────────────────────────
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cvs = document.createElement("canvas");
  cvs.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9998;";
  cvs.width  = Math.max(1, Math.round(vw * dpr));
  cvs.height = Math.max(1, Math.round(vh * dpr));
  cvs.style.width  = vw + "px";
  cvs.style.height = vh + "px";
  document.body.appendChild(cvs);

  let gl = null;
  try {
    gl = cvs.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
    });
  } catch (_) { /* unsupported → fallback */ }

  const useGL  = !!gl;
  const NPARTS = useGL ? 2400 : 800;

  // ── Shared CPU particle pool ──────────────────────────────────
  const P = new Array(NPARTS);
  for (let i = 0; i < NPARTS; i++) {
    P[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxL: 1, size: 0, hot: 0, seed: (i + 1) * 0.61803398875 };
  }
  let ph = 0;

  // ── Particle emitter ──────────────────────────────────────────
  // dense=true → pre-launch boil (wide billowing cloud)
  function emit(noz, exhX, exhY, spd, dense) {
    if (dense) {
      const baseCnt = (useGL ? 18 : 8) + ((rand() * (useGL ? 9 : 6)) | 0);
      const cnt     = Math.max(4, Math.round(baseCnt * (0.7 + spd * 0.2)));
      const baseR   = (useGL ? 70 : 50) * s * SMOKE_SPREAD;
      for (let i = 0; i < cnt; i++) {
        const p        = P[ph++ % NPARTS];
        const ang      = rand() * Math.PI * 2;
        const rr       = Math.sqrt(rand());
        p.x            = noz.x + Math.cos(ang) * rr * baseR;
        p.y            = noz.y + Math.sin(ang) * rr * baseR * 0.36 + 4 * s;
        const swayAng  = ang + (rand() - 0.5) * 0.72;
        const outSpd   = (40 + rand() * 80) * (0.7 + spd * 0.3);
        p.vx  = Math.cos(swayAng) * outSpd * SMOKE_SPREAD + (rand() - 0.5) * 26 * SMOKE_SPREAD;
        p.vy  = (5 + rand() * 28) * (0.7 + spd * 0.3);
        p.maxL = SMOKE_LIFETIME * (0.85 + rand() * 0.55);
        p.size = (useGL ? 36 : 14) * s + rand() * (useGL ? 50 : 28) * s;
        p.life = 1;
        p.hot  = 0;
      }
    }
  }

  // ── Physics step ─────────────────────────────────────────────
  // lockSmokeY=true means rocket is flying → kill cold particles immediately.
  function physicsStep(dt, lockSmokeY) {
    if (lockSmokeY) {
      for (let i = 0; i < NPARTS; i++) {
        const p = P[i];
        if (!p.hot && p.life > 0) p.life = 0;
      }
    }
    const dragStep  = Math.pow(SMOKE_DRAG, dt * 60);
    const ceilingY  = startY - 2 * s;
    for (let i = 0; i < NPARTS; i++) {
      const p = P[i]; if (p.life <= 0) continue;
      p.life -= dt / p.maxL;
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      if (!p.hot) {
        if (p.vy < 0) p.vy = 0;
        p.vy += SMOKE_SETTLE_ACC * dt;
        const t = 1 - p.life;
        const swirl =
          Math.sin(t * 7.3 + p.seed * 6.7) +
          0.62 * Math.sin(t * 3.1 + p.seed * 4.2) +
          0.34 * Math.sin(t * 1.5 + p.seed * 2.3);
        p.vx += swirl * 26 * SMOKE_SPREAD * dt;
        p.vx *= dragStep;
        p.vy *= dragStep;
        if (p.vy > 95) p.vy = 95;
        if (p.y < ceilingY) { p.y = ceilingY; if (p.vy < 0) p.vy = 0; }
      } else {
        const hd = Math.pow(0.94, dt * 60);
        p.vx *= hd; p.vy *= hd;
      }
    }
  }

  // ── WebGL2 renderer ──────────────────────────────────────────
  // Two-pass instanced quads:
  //   Pass 1 (uPass=0): smoke, premultiplied-alpha "over"
  //   Pass 2 (uPass=1): hot core, additive bloom
  // Fragment shader: domain-warped FBM → cauliflower cloud structure.
  function setupWebGLRenderer() {
    const VS =
      "#version 300 es\n" +
      "layout(location=0) in vec2 aCorner;\n" +
      "layout(location=1) in vec4 aPSA;\n" +
      "layout(location=2) in vec2 aSK;\n" +
      "uniform vec2 uRes;\n" +
      "out vec2 vUv;\n" +
      "out float vAge;\n" +
      "out float vSeed;\n" +
      "out float vKind;\n" +
      "void main() {\n" +
      "  vec2 worldPos = aPSA.xy + aCorner * aPSA.z;\n" +
      "  vec2 ndc = (worldPos / uRes) * 2.0 - 1.0;\n" +
      "  ndc.y = -ndc.y;\n" +
      "  gl_Position = vec4(ndc, 0.0, 1.0);\n" +
      "  vUv = aCorner; vAge = aPSA.w; vSeed = aSK.x; vKind = aSK.y;\n" +
      "}\n";

    const FS =
      "#version 300 es\n" +
      "precision highp float;\n" +
      "in vec2 vUv; in float vAge; in float vSeed; in float vKind;\n" +
      "uniform float uPass;\n" +
      "out vec4 fragColor;\n" +
      "float hash21(vec2 p, float s) {\n" +
      "  p = fract(p * vec2(123.34, 456.21) + s * 17.71);\n" +
      "  p += dot(p, p + 45.32);\n" +
      "  return fract(p.x * p.y);\n" +
      "}\n" +
      "float vnoise(vec2 p, float s) {\n" +
      "  vec2 i = floor(p); vec2 f = fract(p);\n" +
      "  vec2 u = f * f * (3.0 - 2.0 * f);\n" +
      "  return mix(mix(hash21(i,s), hash21(i+vec2(1,0),s), u.x),\n" +
      "             mix(hash21(i+vec2(0,1),s), hash21(i+vec2(1,1),s), u.x), u.y);\n" +
      "}\n" +
      "float fbm(vec2 p, float s) {\n" +
      "  float v=0.0; float a=0.5;\n" +
      "  for(int i=0;i<4;i++){v+=a*vnoise(p,s);p*=2.07;a*=0.5;}\n" +
      "  return v;\n" +
      "}\n" +
      "float warp(vec2 p, float s) {\n" +
      "  vec2 q=vec2(fbm(p,s),fbm(p+vec2(5.2,1.3),s+0.31));\n" +
      "  return fbm(p+1.4*q, s+0.71);\n" +
      "}\n" +
      "void main() {\n" +
      "  if(abs(vKind-uPass)>0.5) discard;\n" +
      "  float r=length(vUv); if(r>1.0) discard;\n" +
      "  float life=1.0-vAge;\n" +
      "  vec2 nuv=vUv*2.85+vec2(vSeed*12.34,vAge*20.1);\n" +
      "  float n=warp(nuv,vSeed*0.7); n=0.55+n*0.62;\n" +
      "  float core=smoothstep(0.0,0.45,1.0-r);\n" +
      "  float halo=smoothstep(0.0,1.0,1.0-r);\n" +
      "  float density=mix(halo*0.6,core,0.62)*n;\n" +
      "  if(vKind>0.5){\n" +
      "    vec3 col=mix(vec3(1.0,0.55,0.05),vec3(1.0,0.92,0.5),life*0.7);\n" +
      "    float a=density*(life*life)*0.95;\n" +
      "    fragColor=vec4(col*a,a);\n" +
      "  } else {\n" +
      "    vec3 cI=vec3(0.88,0.87,0.91);\n" +
      "    vec3 cM=vec3(0.78,0.77,0.82);\n" +
      "    vec3 cO=vec3(0.68,0.66,0.72);\n" +
      "    float t=clamp(density*1.35,0.0,1.0);\n" +
      "    vec3 col=mix(cO,mix(cM,cI,smoothstep(0.45,1.0,t)),smoothstep(0.0,0.7,t));\n" +
      "    col*=mix(1.0,0.9,vAge*0.5);\n" +
      "    float clump=0.72+0.5*sin(vSeed*8.7+vAge*9.5);\n" +
      "    float a=density*(life*life*1.6*clump);\n" +
      "    fragColor=vec4(col*a,a);\n" +
      "  }\n" +
      "}\n";

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("[rocket] shader compile failed:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh); return null;
      }
      return sh;
    }
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[rocket] program link failed:", gl.getProgramInfoLog(prog));
      return null;
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    const uRes  = gl.getUniformLocation(prog, "uRes");
    const uPass = gl.getUniformLocation(prog, "uPass");

    const cornerBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const psaArr = new Float32Array(NPARTS * 4);
    const skArr  = new Float32Array(NPARTS * 2);
    const psaBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, psaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, psaArr.byteLength, gl.DYNAMIC_DRAW);
    const skBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skBuf);
    gl.bufferData(gl.ARRAY_BUFFER, skArr.byteLength, gl.DYNAMIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, psaBuf);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, skBuf);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    function ensureSize() {
      const w = Math.max(1, Math.round(window.innerWidth * dpr));
      const h = Math.max(1, Math.round(window.innerHeight * dpr));
      if (cvs.width !== w || cvs.height !== h) {
        cvs.width = w; cvs.height = h;
        cvs.style.width  = window.innerWidth  + "px";
        cvs.style.height = window.innerHeight + "px";
      }
    }

    function render() {
      let live = 0;
      for (let i = 0; i < NPARTS; i++) {
        const p = P[i]; if (p.life <= 0) continue;
        const age = 1 - p.life;
        const r   = p.size * (0.95 + age * 1.95);
        const j   = live * 4;
        psaArr[j]   = p.x * dpr; psaArr[j+1] = p.y * dpr;
        psaArr[j+2] = r * dpr;   psaArr[j+3] = age;
        const k = live * 2;
        skArr[k] = p.seed; skArr[k+1] = p.hot;
        live++;
      }
      ensureSize();
      gl.viewport(0, 0, cvs.width, cvs.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.useProgram(prog);
      gl.uniform2f(uRes, cvs.width, cvs.height);
      if (live === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, psaBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, psaArr.subarray(0, live * 4));
      gl.bindBuffer(gl.ARRAY_BUFFER, skBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, skArr.subarray(0, live * 2));
      gl.bindVertexArray(vao);
      gl.uniform1f(uPass, 0.0);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, live);
      gl.uniform1f(uPass, 1.0);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, live);
      gl.bindVertexArray(null);
    }

    function dispose() {
      try {
        gl.deleteBuffer(cornerBuf); gl.deleteBuffer(psaBuf);
        gl.deleteBuffer(skBuf);     gl.deleteVertexArray(vao);
        gl.deleteProgram(prog);
      } catch (_) { /* best-effort */ }
    }
    return { render, dispose };
  }

  // ── Canvas2D fallback ─────────────────────────────────────────
  function setupCanvas2DRenderer() {
    cvs.width  = window.innerWidth;
    cvs.height = window.innerHeight;
    cvs.style.width  = window.innerWidth  + "px";
    cvs.style.height = window.innerHeight + "px";
    const ctx = cvs.getContext("2d");

    function ensureSize() {
      if (cvs.width !== window.innerWidth || cvs.height !== window.innerHeight) {
        cvs.width = window.innerWidth; cvs.height = window.innerHeight;
      }
    }
    function render() {
      ensureSize();
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < NPARTS; i++) {
        const p = P[i]; if (p.life <= 0 || !p.hot) continue;
        const a = Math.max(0, p.life);
        const r = p.size * (0.35 + a * 0.65);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, "rgba(255,225,110," + (a * 0.95).toFixed(3) + ")");
        g.addColorStop(0.38, "rgba(255,130,20," + (a * 0.58).toFixed(3) + ")");
        g.addColorStop(1, "rgba(160,30,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < NPARTS; i++) {
        const p = P[i]; if (p.life <= 0 || p.hot) continue;
        const age   = 1 - p.life;
        const clump = 0.85 + 0.45 * Math.sin(p.seed * 8.7 + age * 10.5);
        const a     = Math.max(0, p.life * p.life * 0.62 * clump);
        const r     = p.size * (0.95 + age * 2.4);
        const g     = ctx.createRadialGradient(p.x, p.y, r * 0.02, p.x, p.y, r);
        g.addColorStop(0,    "rgba(224,222,232," + (a * 0.95).toFixed(3) + ")");
        g.addColorStop(0.28, "rgba(199,196,209," + (a * 0.78).toFixed(3) + ")");
        g.addColorStop(0.6,  "rgba(173,168,184," + (a * 0.40).toFixed(3) + ")");
        g.addColorStop(1,    "rgba(153,148,167,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    return { render, dispose: () => {} };
  }

  // ── Wire up renderer ──────────────────────────────────────────
  function noop() {}
  let renderFrame    = noop;
  let disposeRenderer = noop;
  if (useGL) {
    const gx = setupWebGLRenderer();
    if (gx) { renderFrame = gx.render; disposeRenderer = gx.dispose; }
    else console.warn("[rocket] WebGL2 shader setup failed; smoke disabled");
  } else {
    const cx2 = setupCanvas2DRenderer();
    renderFrame = cx2.render; disposeRenderer = cx2.dispose;
  }

  // ── Animation loop ────────────────────────────────────────────
  let startTs = 0, simTs = 0, simAccumulator = 0, rafId = 0, disposed = false;

  function frame(ts) {
    if (disposed) return;
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;
    simAccumulator += Math.max(0, elapsed - simTs);

    while (simAccumulator >= FIXED_STEP * 1000) {
      simTs         += FIXED_STEP * 1000;
      simAccumulator -= FIXED_STEP * 1000;
      if (simTs < PRE_MS) {
        const preT = simTs / PRE_MS;
        const noz  = nozzlePos(startX, startY, 0);
        emit(noz, 0, 1, 0.8 + preT * 2.5, true);
      }
      physicsStep(FIXED_STEP, simTs >= PRE_MS);
    }

    renderFrame();

    if (elapsed < PRE_MS) {
      rafId = window.requestAnimationFrame(frame);
      return;
    }

    const flightT = Math.min(1, (elapsed - PRE_MS) / DURATION);
    const st = rocketStateAt(flightT);
    wrap.style.transform =
      "translate(" + st.pos[0].toFixed(2) + "px," + st.pos[1].toFixed(2) + "px)" +
      " rotate(" + st.fAng.toFixed(4) + "rad)" +
      " scaleX(" + st.sx2.toFixed(4) + ") scaleY(" + st.sy2.toFixed(4) + ")";

    if (flightT > 0.84) {
      const ft = (flightT - 0.84) / 0.16;
      wrap.style.opacity = (1 - ft * ft).toFixed(4);
    }

    if (flightT < 1) {
      rafId = window.requestAnimationFrame(frame);
    } else {
      cleanup(); onDone();
    }
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    try { disposeRenderer(); } catch (_) {}
    cvs.remove();
    wrap.style.transform = "";
    wrap.style.opacity   = "";
  }

  rafId = window.requestAnimationFrame(frame);
  return cleanup;
}

/* ── Mount FAB on docs-shell pages ──────────────────────────── */
function mountRocketFab() {
  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (document.querySelector(".docs-rocket-fab")) return; // idempotent

  const btn = document.createElement("button");
  btn.type      = "button";
  btn.className = "docs-rocket-fab";
  btn.setAttribute("aria-label", "Back to top");
  btn.setAttribute("data-tooltip", "Back to top — launch the rocket. Press G to scroll instantly.");
  btn.setAttribute("data-tooltip-placement", "left");
  btn.setAttribute("data-visible", "false");

  btn.innerHTML = [
    '<span class="docs-rocket-fab__progress-ring" aria-hidden="true"></span>',
    '<span class="docs-rocket-fab__rocket-wrap" aria-hidden="true">',
    ROCKET_SVG,
    '<span class="docs-rocket-fab__ember docs-rocket-fab__ember--1"></span>',
    '<span class="docs-rocket-fab__ember docs-rocket-fab__ember--2"></span>',
    '<span class="docs-rocket-fab__ember docs-rocket-fab__ember--3"></span>',
    '<span class="docs-rocket-fab__ember docs-rocket-fab__ember--4"></span>',
    '<span class="docs-rocket-fab__ember docs-rocket-fab__ember--5"></span>',
    '<span class="docs-rocket-fab__trail"></span>',
    '<span class="docs-rocket-fab__flame"></span>',
    '<span class="docs-rocket-fab__speed-line docs-rocket-fab__speed-line--a"></span>',
    '<span class="docs-rocket-fab__speed-line docs-rocket-fab__speed-line--b"></span>',
    '<span class="docs-rocket-fab__smoke docs-rocket-fab__smoke--left"></span>',
    '<span class="docs-rocket-fab__smoke docs-rocket-fab__smoke--mid"></span>',
    '<span class="docs-rocket-fab__smoke docs-rocket-fab__smoke--right"></span>',
    '</span>',
  ].join("");

  document.body.appendChild(btn);

  const wrap = btn.querySelector(".docs-rocket-fab__rocket-wrap");

  // ── Progress ring ──────────────────────────────────────────────
  const updateProgress = () => {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const pct = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
    btn.style.setProperty("--rocket-progress", pct.toFixed(1));
  };

  // ── Visibility ──────────────────────────────────────────────────
  // suppressVisibility=true while the rocket is animating: scroll events
  // during flight must NOT hide the button (the shell is already transparent
  // via .is-launching, so the visible rocket SVG would vanish with it).
  let suppressVisibility  = false;
  let suppressTimeoutId   = 0;

  const updateVisibility = () => {
    if (suppressVisibility) return;
    const visible = window.scrollY > 300;
    btn.setAttribute("data-visible", visible ? "true" : "false");
    btn.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) updateProgress();
  };

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();

  // ── Launch ─────────────────────────────────────────────────────
  // PRE_MS must match the constant inside launchRocketAnimation.
  const PRE_MS          = 800;
  const SCROLL_DELAY_MS = PRE_MS + 1200; // 2000 ms — fires mid-flight, mirrors legacy
  const TOTAL_ANIM_MS   = PRE_MS + 2600; // pre-charge + flight

  let launching        = false;
  let cancelLaunch     = null;
  let safetyTimeoutId  = 0;

  function finishLaunch() {
    btn.classList.remove("is-launching");
    launching    = false;
    cancelLaunch = null;
    clearTimeout(safetyTimeoutId);
    // Short settle window so the CSS opacity transition completes before
    // updateVisibility re-evaluates and potentially shows the button.
    clearTimeout(suppressTimeoutId);
    suppressTimeoutId = window.setTimeout(() => {
      suppressVisibility = false;
      updateVisibility();
    }, 320);
  }

  btn.addEventListener("click", () => {
    if (launching) return;

    if (reduced) {
      window.scrollTo({ top: 0 });
      return;
    }

    launching          = true;
    suppressVisibility = true;
    btn.classList.add("is-launching");

    // Scroll fires well into the flight phase so the pre-charge smoke and
    // liftoff are fully visible before the page starts moving.
    window.setTimeout(
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      SCROLL_DELAY_MS,
    );

    cancelLaunch = launchRocketAnimation(wrap, finishLaunch);

    // Safety net: force-complete if rAF stalls (backgrounded tab).
    safetyTimeoutId = window.setTimeout(() => {
      if (!launching) return;
      if (cancelLaunch) { cancelLaunch(); }
      finishLaunch();
    }, TOTAL_ANIM_MS + 600);
  });
}

/* ── Mount hook ───────────────────────────────────────────────── */

const LANDING_TYPES = new Set(["landing"]);

export async function mountRocket(root = document) {
  const slots      = root.querySelectorAll('[data-component="rocket"]');
  const pageType   = document.body.getAttribute("data-page-type") || "";
  const isLanding  = LANDING_TYPES.has(pageType);
  const isDocsShell = document.body.classList.contains("docs-shell");

  if (isDocsShell && !isLanding) {
    mountRocketFab();
    return;
  }

  if (!slots.length) return;
  if (isLanding)    return; // landing keeps slot content as-is

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const slot of slots) {
    slot.classList.add("docs-rocket");
    if (reduced) { svgFallback(slot); continue; }
    if (!slot.querySelector("canvas")) {
      const c = document.createElement("canvas");
      c.className = "docs-rocket__canvas";
      slot.appendChild(c);
    }
    try { await loadWebgl(); }
    catch (_) { svgFallback(slot); }
  }
}
