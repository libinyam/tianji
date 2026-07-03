import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5199';
const routes = ['/', '/discussion', '/ideas', '/library', '/workshop', '/profile', '/admin', '/tags/AI', '/nonexistent-page'];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[console.${m.type()}] ${page.url()} :: ${m.text().slice(0, 300)}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${page.url()} :: ${String(e).slice(0, 300)}`));
page.on('requestfailed', r => logs.push(`[reqfail] ${page.url()} :: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));

for (const r of routes) {
  try {
    await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) { logs.push(`[nav-timeout] ${r} :: ${String(e).slice(0, 120)}`); }
  await page.waitForTimeout(1500);
  const name = r === '/' ? 'home' : r.replace(/[/:]/g, '_');
  await page.screenshot({ path: `.tmp-e2e/shot-${name}.png`, fullPage: false });
  // basic a11y-ish counts
  const info = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelectorAll('h1').length,
    imgsNoAlt: [...document.querySelectorAll('img:not([alt])')].length,
    btnsNoName: [...document.querySelectorAll('button')].filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    bodyLen: document.body.innerText.length,
  }));
  console.log(`ROUTE ${r} :: title="${info.title}" h1=${info.h1} imgsNoAlt=${info.imgsNoAlt} btnsNoName=${info.btnsNoName} textLen=${info.bodyLen}`);
}

console.log('\n=== LOGS ===');
console.log([...new Set(logs)].join('\n') || '(none)');
await browser.close();
