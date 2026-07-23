import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  window.__samples = [];
  const t0 = performance.now();
  const tick = () => {
    const section = document.querySelector('.tma-section');
    if (section) {
      const wrap = section.parentElement;
      window.__samples.push({
        t: Math.round(performance.now() - t0),
        op: getComputedStyle(wrap).opacity,
        y: Math.round(section.getBoundingClientRect().top),
        ov: getComputedStyle(wrap).overflow,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.goto('http://localhost:5173/', { waitUntil: 'commit' });
await page.waitForTimeout(3500);
const s = await page.evaluate(() => window.__samples);
const blinks = s.filter((x, i) => i > 0 && parseFloat(x.op) < parseFloat(s[i-1].op));
console.log('samples:', s.length, 'opacity regressions:', blinks.length, JSON.stringify(blinks.slice(0,5)));
console.log('final:', JSON.stringify(s[s.length-1]));
const jumps = s.filter((x, i) => i > 0 && Math.abs(x.y - s[i-1].y) > 40);
console.log('y-jumps >40px between frames:', jumps.length, JSON.stringify(jumps.slice(0,5)));
