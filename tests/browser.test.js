// Optional real Chromium checks. This environment could not download Chromium;
// do not describe this suite as run unless it actually executes locally.
// Start python3 -m http.server 8000 first; install Playwright + Chromium separately.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {hand}=require('./fixtures.js');
const BASE=process.env.TEST_BASE_URL||'http://localhost:8000';
const fakeP5=`window.p5=class{
 constructor(make){const noop=()=>{};const p={createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;this.canvas=c;return {parent:id=>document.getElementById(id).append(c)};},pixelDensity:noop,background:noop,push:noop,pop:noop,translate:noop,scale:noop,stroke:noop,strokeWeight:noop,line:noop,noStroke:noop,fill:noop,circle:()=>{window.drawnPoints=(window.drawnPoints||0)+1;},noFill:noop,beginShape:noop,vertex:noop,endShape:noop,drawingContext:{drawImage:noop}};make(p);p.setup();this.timer=setInterval(p.draw,30);}
 remove(){clearInterval(this.timer);this.canvas.remove();}
};`;
const fakeML5=`window.ml5={handPose:()=>({ready:Promise.resolve(),detect:async(input)=>{
 window.detectCalls=(window.detectCalls||0)+1;await new Promise(r=>setTimeout(r,window.fakeDelay||40));
 const hands=window.fakeScreenHands||[];
 return hands.map(hand=>({...hand,keypoints:hand.keypoints.map(p=>({...p,x:640-p.x}))}));
}})};`;
async function feed(page,pose,x=320,y=360,frames=10,interval=60){
 await page.evaluate(h=>{window.fakeScreenHands=h?[h]:[];},pose?hand(pose,x,y):null);
 await page.waitForTimeout(frames*interval);
}
async function swipe(page,pose,direction,start=320){
 await feed(page,pose,start,360,10);
 for(let i=1;i<=4;i++)await feed(page,pose,start+direction*i*11.25,360,1);
}
async function fakeTracking(page){
 await page.route('https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js',r=>r.fulfill({contentType:'application/javascript',body:fakeP5}));
 await page.route('https://unpkg.com/ml5@1.2.1/dist/ml5.min.js',r=>r.fulfill({contentType:'application/javascript',body:fakeML5}));
 await page.evaluate(()=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.cameraTracks=[];
  navigator.mediaDevices.getUserMedia=async c=>{const s=await original(c);window.cameraTracks.push(...s.getTracks());return s;};
 });
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||chromium.executablePath(),args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['camera']});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(BASE);await page.waitForSelector('#slide-dots button');
  assert.equal(await page.locator('.slide').count(),5);assert.equal(await page.locator('.slide:visible').count(),1);
  await page.locator('#next').click();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#slide-count').textContent(),'3 / 5');
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#demo-video').readyState>=2);
  await page.locator('#play-pause').click();await page.waitForFunction(()=>!document.querySelector('#demo-video').paused);
  await page.locator('#next').click();assert.equal(await page.locator('#demo-video').evaluate(v=>v.paused),true);
  assert.equal(await page.locator('#next').isDisabled(),true);
  await page.locator('#slide-dots button').nth(0).click();
  if(process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:true});
  console.log('PASS: five slides, keyboard after button focus, MP4 playback, leaving video pauses it.');

  const denied=await context.newPage();
  await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await denied.goto(BASE);await denied.locator('#start-camera').click();
  await denied.waitForFunction(()=>document.querySelector('#start-camera').disabled===false&&document.querySelector('#stop-camera').disabled===true);
  await denied.locator('#next').click();assert.equal(await denied.locator('#slide-count').textContent(),'2 / 5');await denied.close();
  console.log('PASS: camera permission denial leaves manual presentation usable.');

  await fakeTracking(page);
  for(let i=0;i<3;i++){
   await page.locator('#start-camera').click();await page.waitForFunction(()=>window.detectCalls>0);
   assert.equal(await page.locator('#camera-view canvas').count(),1);
   await page.locator('#stop-camera').click();assert.equal(await page.locator('#camera-view canvas').count(),0);
   assert.equal(await page.evaluate(()=>window.cameraTracks.every(t=>t.readyState==='ended')),true);
  }
  await page.locator('#start-camera').click();await page.waitForFunction(()=>document.querySelector('#camera-view canvas')&&window.detectCalls>0);
  await swipe(page,'open palm',1,200);assert.equal(await page.locator('#slide-count').textContent(),'1 / 5');
  await swipe(page,'two fingers',1,200);assert.equal(await page.locator('#slide-count').textContent(),'2 / 5');
  await feed(page,'two fingers',360,360,25);
  assert.equal(await page.locator('#slide-count').textContent(),'2 / 5');
  for(let i=1;i<=3;i++)await feed(page,'two fingers',360+i*15,360,1);
  assert.equal(await page.locator('#slide-count').textContent(),'3 / 5');
  await feed(page,'two fingers',405,360,15);
  assert.equal(await page.locator('#slide-count').textContent(),'3 / 5');
  await swipe(page,'index finger',-1,405);
  assert.equal(await page.locator('#slide-count').textContent(),'2 / 5');
  assert.equal(await page.evaluate(()=>window.drawnPoints||0),0);
  console.log('PASS: exact finger poses, repeated fresh movements without release, stillness guard, direct previous direction, zero overlays.');

  await page.locator('#fullscreen').click();
  await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('slide-frame'));
  assert.equal(await page.evaluate(()=>document.fullscreenElement===document.querySelector('.slide-frame')),true);
  const fit=await page.locator('.slide-canvas').evaluate(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});
  assert.ok(Math.abs(fit.w/fit.h-16/9)<.03);assert.ok(fit.w<=fit.vw+1&&fit.h<=fit.vh+1);
  await feed(page,'open palm',200,360,25);await swipe(page,'two fingers',1,200);
  assert.equal(await page.locator('#slide-count').textContent(),'3 / 5');
  // Hidden outside-stage controls cannot be clicked while in stage fullscreen.
  // Leave fullscreen to choose video, then re-enter before testing grip actions.
  await page.evaluate(()=>document.exitFullscreen());
  await page.locator('#slide-dots button').nth(3).click();await page.locator('#play-pause').click();
  await page.locator('#fullscreen').click();
  await feed(page,'fist',320,360,30);assert.equal(await page.locator('#demo-video').evaluate(v=>v.paused),true);
  await feed(page,'fist',320,360,25);assert.equal(await page.locator('#demo-video').evaluate(v=>v.paused),true);
  await feed(page,'neutral',320,360,15);assert.equal(await page.locator('#demo-video').evaluate(v=>v.paused),true);
  await feed(page,'open palm',320,360,15);assert.equal(await page.locator('#demo-video').evaluate(v=>v.paused),false);
  await feed(page,'fist',320,360,15);await feed(page,null,320,360,2);await feed(page,'open palm',320,360,15);
  assert.equal(await page.locator('#demo-video').evaluate(v=>v.paused),true);
  assert.equal(await page.evaluate(()=>document.fullscreenElement?.classList.contains('slide-frame')),true);
  await page.evaluate(()=>document.exitFullscreen());await page.locator('#stop-camera').click();
  console.log('PASS: letterboxed stage fullscreen keeps camera navigation and grip/release media actions active; loss cannot autoplay.');

  for(const id of ['model-state','hands-seen','frame-count','inference-time','last-gesture','pose'])assert.equal(await page.locator('#'+id).count(),0,id);
  assert.equal(await page.locator('#camera-badge').count(),1);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);console.log('PASS: no removed diagnostics, narrow viewport, no uncaught page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
