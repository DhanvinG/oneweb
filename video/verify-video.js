import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const { chromium }=require('playwright');
const sharp=require('sharp');
const videoPath=path.join(__dirname,'OneWeb-Campaign-Introduction.mp4');
const server=http.createServer((req,res)=>{
  if(req.url==='/video.mp4'){
    const size=fs.statSync(videoPath).size, range=req.headers.range;
    if(range){const [startText,endText]=range.replace(/bytes=/,'').split('-');const start=parseInt(startText,10),end=endText?parseInt(endText,10):size-1;res.writeHead(206,{'Content-Type':'video/mp4','Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes'});fs.createReadStream(videoPath,{start,end}).pipe(res);}
    else{res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':size,'Accept-Ranges':'bytes'});fs.createReadStream(videoPath).pipe(res);}return;
  }
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<video id="v" width="960" height="540" preload="auto" src="/video.mp4" style="display:none"></video><canvas id="c" width="960" height="540"></canvas>');
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:980,height:560}});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const meta=await page.evaluate(()=>new Promise((resolve,reject)=>{const v=document.querySelector('#v');const finish=()=>resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight,audioTracks:v.captureStream().getAudioTracks().length,readyState:v.readyState});if(v.readyState>=1)finish();else v.onloadedmetadata=finish;v.onerror=()=>reject(new Error('decode failed'));}));
  const times=[1,12,31,44,58], shots=[];
  await page.evaluate(()=>{const v=document.querySelector('#v');v.currentTime=0;v.playbackRate=8;v.muted=true;return v.play();});
  for(let i=0;i<times.length;i++){await page.waitForFunction(t=>document.querySelector('#v').currentTime>=t,times[i]);await page.evaluate(()=>{const v=document.querySelector('#v'),c=document.querySelector('#c');v.pause();c.getContext('2d').drawImage(v,0,0,c.width,c.height);});const p=path.join(__dirname,`preview-${String(i+1).padStart(2,'0')}.png`);await page.locator('#c').screenshot({path:p});shots.push(p);await page.evaluate(()=>document.querySelector('#v').play());}
  const thumbs=await Promise.all(shots.map(p=>sharp(p).resize(640,360).toBuffer()));
  await sharp({create:{width:1280,height:1080,channels:3,background:'#10182f'}}).composite(thumbs.map((input,i)=>({input,left:(i%2)*640,top:Math.floor(i/2)*360}))).png().toFile(path.join(__dirname,'OneWeb-video-preview.png'));
  console.log(JSON.stringify(meta));console.log(`Preview: ${path.join(__dirname,'OneWeb-video-preview.png')}`);
  await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});
