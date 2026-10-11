// HTML 카드뉴스를 PNG(1600x2000)로 내보낸다: NODE_PATH=$(npm root -g) node render.js ai-genius-how-to.html [출력.png]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const src = path.resolve(process.argv[2]);
  const out = process.argv[3] || src.replace(/\.html$/, '.png');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 2000 }, deviceScaleFactor: 1 });
  await page.goto('file://' + src);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // 넘침 검사: 본문이 2000px 안에 들어가는지
  const overflow = await page.evaluate(() => document.body.scrollHeight - 2000);
  if (overflow > 0) console.warn(`경고: 내용이 ${overflow}px 넘칩니다`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1600, height: 2000 } });
  await browser.close();
  console.log(out);
})();
