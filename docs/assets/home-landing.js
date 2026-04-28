"use strict";

(function () {
  const mediaReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canAnimate = !mediaReduced.matches;
  const INTRO_DURATION_MS = 5400;

  function markFirstVisitClass() {
    if (canAnimate) {
      document.body.classList.add("home-first-visit");
    }
  }

  function startTypewriter(el) {
    const full = el.textContent.trim();
    el.textContent = "";
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.animation = "none";

    const cursor = document.createElement("span");
    cursor.className = "home-intro__cursor";
    cursor.setAttribute("aria-hidden", "true");
    el.appendChild(cursor);

    let idx = 0;
    function typeNext() {
      if (!el.isConnected) return;
      if (idx < full.length) {
        el.insertBefore(document.createTextNode(full[idx]), cursor);
        idx++;
        window.setTimeout(typeNext, 50 + Math.random() * 40);
      } else {
        // Typing done — remove inline cursor, then show dots + pulsing cursor
        cursor.remove();
        showIntroSuffix(el);
      }
    }
    window.setTimeout(typeNext, 200);
  }

  function showIntroSuffix(titleEl) {
    if (!titleEl.isConnected) return;

    // Space before dots, stays on the same line as the typed title
    titleEl.appendChild(document.createTextNode("\u00a0"));

    // Three dots inline inside the title, one every 500 ms
    [".", ".", "."].forEach(function (ch, i) {
      window.setTimeout(function () {
        if (!titleEl.isConnected) return;
        const span = document.createElement("span");
        span.className = "home-intro__dot";
        span.textContent = ch;
        titleEl.appendChild(span);
      }, i * 500);
    });

    // Pulsing cursor after all three dots
    window.setTimeout(function () {
      if (!titleEl.isConnected) return;
      const cur = document.createElement("span");
      cur.className = "home-intro__cursor";
      cur.setAttribute("aria-hidden", "true");
      titleEl.appendChild(cur);
    }, 3 * 500 + 80);
  }

  function runShutterExit(intro) {
    const DURATION = 720;
    const bg = window.getComputedStyle(intro).backgroundColor;

    // Single full-screen overlay — collapses via radial iris (diaphragm effect)
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:130;pointer-events:none;" +
      "background:" + bg + ";" +
      "clip-path:circle(150% at 50% 46%);";

    document.body.appendChild(overlay);
    overlay.getBoundingClientRect(); // force reflow before transition

    // Hide intro instantly behind overlay
    intro.style.transition = "none";
    intro.classList.remove("is-active");
    intro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("home-intro-lock");

    // Iris collapses to centre point
    overlay.style.transition = "clip-path " + DURATION + "ms cubic-bezier(0.87, 0, 0.13, 1)";
    overlay.style.clipPath = "circle(0% at 50% 46%)";

    window.setTimeout(() => {
      overlay.remove();
      intro.style.transition = "";
      // Force hero title lines visible (guards against fill-mode edge cases)
      document.querySelectorAll(".home-hero__title-line").forEach((el) => {
        el.style.animation = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.letterSpacing = "";
      });
    }, DURATION + 40);
  }

  function bindFirstVisitIntro() {
    const intro = document.querySelector("[data-home-intro]");
    const skip = document.querySelector("[data-home-intro-skip]");
    if (!intro || !canAnimate) {
      return;
    }

    document.body.classList.add("home-intro-lock");
    intro.classList.add("is-active");
    intro.setAttribute("aria-hidden", "false");

    const titleEl = intro.querySelector(".home-intro__title");
    if (titleEl) startTypewriter(titleEl);

    let closed = false;
    function closeIntro() {
      if (closed) {
        return;
      }
      closed = true;
      runShutterExit(intro);
    }

    window.setTimeout(closeIntro, INTRO_DURATION_MS);
    if (skip) {
      skip.addEventListener("click", closeIntro);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeIntro();
      }
    });
  }

  function bindRevealOnScroll() {
    const revealNodes = Array.from(document.querySelectorAll("[data-home-reveal]"));
    if (!revealNodes.length) {
      return;
    }
    if (!canAnimate || !("IntersectionObserver" in window)) {
      revealNodes.forEach((node) => {
        node.classList.add("is-visible");
        node.querySelectorAll(".home-card").forEach((card) => card.classList.add("is-visible"));
      });
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const cards = Array.from(entry.target.querySelectorAll(".home-card"));
          if (cards.length > 0) {
            // Reveal section instantly — visual effect comes entirely from card stagger
            entry.target.style.transition = "none";
            entry.target.style.opacity = "1";
            entry.target.style.transform = "none";
            entry.target.classList.add("is-visible");
            window.requestAnimationFrame(() => {
              entry.target.style.transition = "";
              entry.target.style.opacity = "";
              entry.target.style.transform = "";
            });

            // Stagger cards with double-rAF to ensure initial hidden state rendered
            cards.forEach((card, i) => {
              const delay = i * 65;
              card.style.transitionDelay = delay + "ms";
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => card.classList.add("is-visible"))
              );
              window.setTimeout(() => { card.style.transitionDelay = ""; }, 480 + delay + 80);
            });
          } else {
            // Section without cards — standard fade-in
            entry.target.classList.add("is-visible");
          }

          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    revealNodes.forEach((node) => observer.observe(node));
  }

  function bindHeroParallax() {
    const host = document.querySelector("[data-home-parallax-host]");
    const layers = Array.from(document.querySelectorAll("[data-home-parallax-layer]"));
    if (!host || !layers.length || !canAnimate) {
      return;
    }
    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function tick() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      layers.forEach((layer) => {
        const depth = Number(layer.getAttribute("data-home-parallax-layer")) || 0;
        const x = currentX * depth;
        const y = currentY * depth;
        layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      if (Math.abs(targetX - currentX) > 0.08 || Math.abs(targetY - currentY) > 0.08) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    }

    host.addEventListener("pointermove", (event) => {
      const rect = host.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const relY = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      targetX = relX * 32;
      targetY = relY * 24;
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    });

    host.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    });
  }

  function bindScrollProgress() {
    const bar = document.querySelector("[data-home-scroll-progress]");
    if (!bar || !canAnimate) {
      return;
    }
    let rafId = 0;
    function draw() {
      rafId = 0;
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const p = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    function schedule() {
      if (!rafId) {
        rafId = window.requestAnimationFrame(draw);
      }
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
  }

  function bindMagneticCta() {
    const elements = Array.from(document.querySelectorAll("[data-home-magnetic]"));
    if (!elements.length || !canAnimate) {
      return;
    }
    elements.forEach((el) => {
      let rafId = 0;
      let tx = 0;
      let ty = 0;
      let cx = 0;
      let cy = 0;

      function paint() {
        cx += (tx - cx) * 0.16;
        cy += (ty - cy) * 0.16;
        el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          rafId = window.requestAnimationFrame(paint);
        } else {
          rafId = 0;
        }
      }

      el.addEventListener("pointermove", (event) => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        tx = Math.max(Math.min(dx * 0.16, 9), -9);
        ty = Math.max(Math.min(dy * 0.16, 7), -7);
        if (!rafId) {
          rafId = window.requestAnimationFrame(paint);
        }
      });

      el.addEventListener("pointerleave", () => {
        tx = 0;
        ty = 0;
        if (!rafId) {
          rafId = window.requestAnimationFrame(paint);
        }
      });
    });
  }

  function init() {
    markFirstVisitClass();
    bindFirstVisitIntro();
    bindRevealOnScroll();
    bindHeroParallax();
    bindScrollProgress();
    bindMagneticCta();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
