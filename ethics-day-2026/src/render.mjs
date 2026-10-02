import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const [,, mode, arg] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file://' + process.cwd() + '/index.html');
await page.evaluate(async () => { for (const t of [2,6,10,14,19,23,28]) { render(t); await document.fonts.ready; } });
await page.waitForTimeout(1500);
if (mode === 'stills') {
  for (const t of arg.split(',').map(Number)) {
    await page.evaluate(t => render(t), t);
    await page.screenshot({ path: `../still_${t}.png` });
  }
} else {
  const FPS = 30, N = 900;
  const ff = spawn('ffmpeg', ['-y','-v','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p','../video_noaudio.mp4'], { stdio: ['pipe','inherit','inherit'] });
  for (let i = 0; i < N; i++) {
    await page.evaluate(t => render(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 100 === 0) console.log('frame', i);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close();
