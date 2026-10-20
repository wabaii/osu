// Renders src/index.html frame-by-frame with headless Chromium and encodes it with ffmpeg.
//
//   node scripts/render.mjs cues                 -> build/cues.json (sound cues + track placement for mix_audio.py)
//   node scripts/render.mjs stills 0.5,6.2,31    -> build/stills/*.png
//   node scripts/render.mjs video [--workers=4] [--from=0] [--to=56] [--out=output/osu-motion-graphic.mp4]
//   node scripts/render.mjs serve                -> preview server on http://localhost:8080/src/
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const args = process.argv.slice(2);
const mode = args[0] || 'video';
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.json': 'application/json', '.css': 'text/css', '.bin': 'application/octet-stream' };
function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

async function openPage(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`${base}/src/index.html?render`);
  await page.evaluate(() => window.ready);
  return page;
}

async function grab(page, t) {
  await page.evaluate(tt => window.renderFrame(tt), t);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

// Render several frames in one round-trip; toBlob snapshots the canvas immediately and
// encodes the PNGs off the main thread, so a batch encodes in parallel.
async function grabBatch(page, times) {
  const urls = await page.evaluate(ts => Promise.all(ts.map(t => {
    window.renderFrame(t);
    return new Promise(res => document.getElementById('c').toBlob(b => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
    }, 'image/png'));
  })), times);
  return urls.map(u => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
}

function ffmpegSink(file, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  const write = buf => new Promise(res => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));
  return { write, end: () => { ff.stdin.end(); return done; } };
}

const server = await serve(mode === 'serve' ? 8080 : 0);
const base = `http://127.0.0.1:${server.address().port}`;
if (mode === 'serve') { console.log(`preview: ${base}/src/index.html`); }
else {
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb'] });
  fs.mkdirSync(BUILD, { recursive: true });
  try {
    if (mode === 'cues') {
      const page = await openPage(browser, base);
      const meta = await page.evaluate(() => window.getMeta());
      fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(meta, null, 1));
      console.log(`wrote build/cues.json (${meta.cues.length} cues)`);
    } else if (mode === 'stills') {
      const times = String(args[1] || '0').split(',').map(Number);
      const page = await openPage(browser, base);
      const dir = path.join(BUILD, 'stills'); fs.mkdirSync(dir, { recursive: true });
      for (const t of times) {
        const f = path.join(dir, `t${t.toFixed(3).padStart(7, '0')}.png`);
        fs.writeFileSync(f, await grab(page, t)); console.log(f);
      }
    } else if (mode === 'video') {
      const page0 = await openPage(browser, base);
      const meta = await page0.evaluate(() => window.getMeta());
      await page0.close();
      const fps = Number(opt.fps || meta.FPS), from = Number(opt.from || 0), to = Number(opt.to || meta.DURATION);
      const total = Math.round((to - from) * fps), workers = Number(opt.workers || 4);
      const per = Math.ceil(total / workers), segs = [];
      const t0 = Date.now(); let doneFrames = 0;
      await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const a = w * per, b = Math.min(total, a + per); if (a >= b) return;
        const seg = path.join(BUILD, `seg_${w}.mp4`); segs[w] = seg;
        const page = await openPage(browser, base), sink = ffmpegSink(seg, fps);
        const B = 8;
        for (let i = a; i < b; i += B) {
          const ts = []; for (let j = i; j < Math.min(b, i + B); j++) ts.push(from + j / fps);
          for (const buf of await grabBatch(page, ts)) await sink.write(buf);
          const before = doneFrames; doneFrames += ts.length;
          if (Math.floor(doneFrames / 240) > Math.floor(before / 240)) {
            const el = (Date.now() - t0) / 1000;
            console.log(`${doneFrames}/${total} frames  ${(doneFrames / el).toFixed(1)} fps  eta ${((total - doneFrames) / (doneFrames / el)).toFixed(0)}s`);
          }
        }
        await sink.end(); await page.close();
      }));
      const list = path.join(BUILD, 'segments.txt');
      fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
      const out = path.resolve(ROOT, opt.out || 'output/osu-motion-graphic.mp4');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const audio = path.join(BUILD, 'soundtrack.wav');
      const audioArgs = fs.existsSync(audio) && !opt.mute ? ['-ss', String(from), '-t', String(to - from), '-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest'] : [];
      execSync(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...audioArgs, '-c:v', 'copy', '-movflags', '+faststart', out].map(s => `'${s}'`).join(' '), { stdio: 'inherit' });
      console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  } finally { await browser.close(); server.close(); }
}
