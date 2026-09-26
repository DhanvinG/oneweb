import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'OneWeb-Campaign-Introduction.mp4');
const mime = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.otf':'font/otf', '.wav':'audio/wav' };

const server = http.createServer((req,res)=>{
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(root, '.' + clean);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},acceptDownloads:true});
  page.on('console',msg=>console.log('[browser]',msg.text()));
  await page.goto(`http://127.0.0.1:${port}/video/render.html`,{waitUntil:'networkidle'});
  const downloadPromise=page.waitForEvent('download',{timeout:90000});
  await page.evaluate(()=>window.startRender());
  const download=await downloadPromise;
  await download.saveAs(output);
  console.log(await page.title());
  console.log(`Saved ${output} (${(fs.statSync(output).size/1024/1024).toFixed(1)} MB)`);
  await browser.close(); server.close();
})().catch(err=>{console.error(err);server.close();process.exit(1);});
