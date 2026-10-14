// REAL source evaluated in a simulated DOM with fake camera/p5/ml5.
// Tests application wiring, not browser rendering or real-camera accuracy.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {hand,mcpFoldedHand,threeFingerHand}=require('./fixtures.js');
const PROJECT=process.env.HAND_REMOTE_ROOT||path.join(__dirname,'..');
class Element{
  constructor(tag='DIV'){
    this.tagName=tag;this.listeners={};this.children=[];this.textContent='';this.style={};
    this.hidden=false;this.disabled=false;this.attributes={};this.classList={toggle(){},add(){},remove(){}};
    this.paused=true;this.ended=false;this.volume=.5;this.value='50';this.playCalls=0;
    this.videoWidth=640;this.videoHeight=480;this.readyState=4;this.width=640;this.height=480;
  }
  addEventListener(name,callback){(this.listeners[name]||=[]).push(callback);}
  async fire(name,event={}){for(const callback of this.listeners[name]||[])await callback({target:this,preventDefault(){},...event});}
  setAttribute(name,value){this.attributes[name]=value;}
  getContext(){return {drawImage(){}};}
  append(child){this.children.push(child);}
  async play(){this.playCalls++;this.paused=false;await this.fire('play');}
  pause(){this.paused=true;this.fire('pause');}
  load(){}
  remove(){this.removed=true;}
}
const flush=()=>new Promise(setImmediate);
function harness(){
  const html=fs.readFileSync(path.join(PROJECT,'index.html'),'utf8');
  const elements=new Map();
  for(const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
    const element=new Element(match[1].toUpperCase());
    element.textContent=html.slice(match.index+match[0].length).split('<')[0].trim();
    elements.set(match[2],element);
  }
  const get=id=>{assert.ok(elements.has(id),`source accessed absent HTML id: ${id}`);return elements.get(id);};
  const slides=Array.from({length:5},()=>new Element('ARTICLE'));
  const stage=new Element(),slideCanvas=new Element(),videoState=new Element(),brand=new Element('A');
  const state={time:0,hand:null,detectCalls:0,requests:new Map(),rafId:0,tracks:[],inferenceDelay:0,drawnPoints:0,inputs:[],drawnFrames:0};
  const document=new Element('DOCUMENT');
  Object.assign(document,{hidden:false,head:new Element(),body:new Element('BODY'),documentElement:new Element(),fullscreenElement:null,
    getElementById:get,querySelectorAll:selector=>selector==='.slide'?slides:[],
    querySelector:selector=>selector==='.video-state'?videoState:selector==='.brand'?brand:selector==='.slide-frame'?stage:selector==='.slide-canvas'?slideCanvas:selector.startsWith('#')?get(selector.slice(1)):null,
    createElement:tag=>new Element(tag.toUpperCase()),
    exitFullscreen:async()=>{document.fullscreenElement=null;await document.fire('fullscreenchange');}});
  stage.requestFullscreen=async()=>{document.fullscreenElement=stage;await document.fire('fullscreenchange');};
  // Both stage ID and class lookups must resolve the same actual stage element.
  const stageID=html.match(/<[^>]*\bid="([^"]+)"[^>]*class="[^"]*slide-frame[^\"]*"|<[^>]*class="[^"]*slide-frame[^\"]*"[^>]*\bid="([^"]+)"/);
  if(stageID)elements.set(stageID[1]||stageID[2],stage);
  const noop=()=>{};
  const context={console,document,performance:{now:()=>state.time},setTimeout,clearTimeout,
    URL:{createObjectURL:()=>'',revokeObjectURL(){}},
    navigator:{mediaDevices:{getUserMedia:async()=>{
      const track={readyState:'live',stop(){this.readyState='ended';},addEventListener(){}};
      state.tracks.push(track);return {getTracks:()=>[track],getVideoTracks:()=>[track]};
    }}},
    requestAnimationFrame:callback=>{const id=++state.rafId;state.requests.set(id,callback);return id;},cancelAnimationFrame:id=>state.requests.delete(id),
    ml5:{handPose:()=>({ready:Promise.resolve(),detect:async(input)=>{
      state.detectCalls++;state.inputs.push({tag:input.tagName,width:input.width,height:input.height});state.time+=state.inferenceDelay;
      return state.hand?[{...state.hand,keypoints:state.hand.keypoints.map(point=>({...point,x:640-point.x}))}]:[];
    }})},
    p5:class{
      constructor(make){const p={createCanvas:()=>({parent(){}}),pixelDensity:noop,background:noop,push:noop,pop:noop,
        translate:noop,scale:noop,stroke:noop,strokeWeight:noop,line:noop,noStroke:noop,fill:noop,
        circle:()=>state.drawnPoints++,noFill:noop,beginShape:noop,vertex:noop,endShape:noop,
        drawingContext:{drawImage:()=>state.drawnFrames++}};make(p);p.setup();state.draw=p.draw;}
      remove(){}
    },addEventListener:noop};
  context.window=context;context.globalThis=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(PROJECT,'gestures.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(PROJECT,'sketch.js'),'utf8'),context);
  async function frame(pose,x=320,y=360,dt=40){
    state.hand=pose&&typeof pose==='object'?pose:pose?hand(pose,x,y):null;state.time+=dt;
    const callbacks=[...state.requests.values()];state.requests.clear();
    for(const callback of callbacks)callback(state.time);await flush();if(state.draw)state.draw();
  }
  async function hold(pose,n=15,x=320,y=360){for(let i=0;i<n;i++)await frame(pose,x,y);}
  async function swipe(pose,direction,start=320){await hold(pose,15,start);for(let i=1;i<=4;i++)await frame(pose,start+direction*i*11.25);}
  return {get,state,frame,hold,swipe,document,stage,html};
}

test('exact camera finger poses change actual slide DOM, ordinary palm movement does not',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  assert.equal(h.get('camera-status').hidden,true);
  await h.swipe('open palm',1,200);assert.equal(h.get('slide-count').textContent,'1 / 5');
  await h.hold('two fingers',12,200);
  assert.equal(h.get('gesture-hint').hidden,false);
  assert.ok(h.get('gesture-hint').textContent.length>0);
  await h.swipe('two fingers',1,200);assert.equal(h.get('slide-count').textContent,'2 / 5');
  await h.hold('open palm',35,360);await h.swipe('index finger',-1,360);
  assert.equal(h.get('slide-count').textContent,'1 / 5');
  assert.ok(h.state.detectCalls>30);assert.equal(h.state.drawnPoints,0);assert.ok(h.state.drawnFrames>0);
  await h.get('stop-camera').fire('click');assert.ok(h.state.tracks.every(track=>track.readyState==='ended'));
});
test('fist pauses, release resumes, continued fist cannot toggle and lost hand cannot resume',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
  await h.hold('fist',35);assert.equal(h.get('demo-video').paused,true);
  await h.hold('fist',35);assert.equal(h.get('demo-video').paused,true);
  await h.hold('neutral',15);assert.equal(h.get('demo-video').paused,true);
  await h.hold('open palm',20);assert.equal(h.get('demo-video').paused,false);
  await h.hold('fist',20);assert.equal(h.get('demo-video').paused,true);
  await h.frame(null);await h.hold('open palm',20);assert.equal(h.get('demo-video').paused,true);
  await h.get('stop-camera').fire('click');
});
test('lowered straight folded fingers in camera landmarks can now move the actual slide previous',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[1].fire('click');await h.hold('open palm',20,380);
  for(let i=0;i<12;i++)await h.frame(mcpFoldedHand('index finger',380));
  for(let i=1;i<=12;i++)await h.frame(mcpFoldedHand('index finger',380-i*6));
  for(let i=0;i<8;i++)await h.frame(mcpFoldedHand('index finger',308));
  assert.equal(h.get('slide-count').textContent,'1 / 5');
  assert.equal(h.state.drawnPoints,0);await h.get('stop-camera').fire('click');
});
test('800ms inference is accepted with fixed-size snapshots and zero landmark overlays',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
  h.state.inferenceDelay=800;await h.hold('fist',3);
  assert.equal(h.get('demo-video').paused,true,'slow valid results must still trigger the fist pause');
  assert.equal(h.state.drawnPoints,0);assert.ok(h.state.drawnFrames>0);
  assert.equal(h.state.inputs.at(-1).tag,'CANVAS');
  assert.deepEqual([h.state.inputs.at(-1).width,h.state.inputs.at(-1).height],[640,480]);
  h.state.inferenceDelay=0;await h.get('slide-dots').children[0].fire('click');
  await h.hold('open palm',20);await h.swipe('two fingers',1,200);
  assert.equal(h.get('slide-count').textContent,'2 / 5');await h.get('stop-camera').fire('click');
});
test('fullscreen targets only the slide stage and camera gesture actions remain active',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('fullscreen').fire('click');assert.equal(h.document.fullscreenElement,h.stage);
  await h.swipe('two fingers',1,200);assert.equal(h.get('slide-count').textContent,'2 / 5');
  await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
  await h.hold('fist',25);assert.equal(h.get('demo-video').paused,true);
  await h.hold('open palm',20);assert.equal(h.get('demo-video').paused,false);
  assert.equal(h.document.fullscreenElement,h.stage);assert.ok(h.state.detectCalls>30);
  await h.document.exitFullscreen();assert.equal(h.document.fullscreenElement,null);
  await h.get('stop-camera').fire('click');
});
test('removed diagnostic IDs stay absent and no circle-volume actions remain in source',()=>{
  const html=fs.readFileSync(path.join(PROJECT,'index.html'),'utf8');
  for(const id of ['model-state','hands-seen','frame-count','inference-time','last-gesture','pose'])
    assert.ok(!new RegExp(`id="${id}"`).test(html),id);
  assert.ok(/id="camera-badge"/.test(html));
  assert.ok(!/class="version-label"/.test(html));
  const source=fs.readFileSync(path.join(PROJECT,'sketch.js'),'utf8');
  assert.ok(!/volumeUp|volumeDown|circleVolume|fitCircle/.test(source));
  assert.ok(/class="[^"]*slide-canvas/.test(html));
  const css=fs.readFileSync(path.join(PROJECT,'style.css'),'utf8');
  assert.ok(/\.slide-frame:fullscreen/.test(css));
  assert.ok(/\.slide-canvas/.test(css));
});

test('paused video never receives play calls while index or V hand navigates off slide 4',async()=>{
  for(const [pose,direction,slide] of [['index finger',-1,'3 / 5'],['two fingers',1,'5 / 5']]){
    const h=harness();await h.get('start-camera').fire('click');await flush();
    await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
    await h.hold('fist',25);const video=h.get('demo-video'),before=video.playCalls;
    assert.equal(video.paused,true);await h.hold(pose,25);
    assert.equal(video.playCalls,before,'navigation posture must not even briefly call play');
    await h.swipe(pose,direction,320);
    assert.equal(h.get('slide-count').textContent,slide);
    assert.equal(video.playCalls,before,'leaving slide cannot hide a transient play call');
    assert.equal(video.paused,true);await h.get('stop-camera').fire('click');
  }
});
test('brief open palm and three-finger hand cannot call play; deliberate 600ms full palm plays once',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
  await h.hold('fist',25);const video=h.get('demo-video'),before=video.playCalls;
  await h.hold('open palm',12);assert.equal(video.playCalls,before);
  for(let i=0;i<30;i++)await h.frame(threeFingerHand());
  assert.equal(video.playCalls,before);assert.equal(video.paused,true);
  await h.hold('open palm',15);assert.equal(video.playCalls,before);
  await h.frame('open palm');assert.equal(video.playCalls,before+1);assert.equal(video.paused,false);
  await h.hold('open palm',25);assert.equal(video.playCalls,before+1);
  await h.get('stop-camera').fire('click');
});
test('raw one-frame partial palm breaks the camera-driven 600ms release timer',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
  await h.hold('fist',25);const video=h.get('demo-video'),before=video.playCalls;
  await h.hold('open palm',12);await h.frame(threeFingerHand());await h.hold('open palm',15);
  assert.equal(video.playCalls,before);await h.frame('open palm');assert.equal(video.playCalls,before+1);
  await h.get('stop-camera').fire('click');
});
test('actual camera pipeline navigates with short moving poses and no stationary prehold',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  for(let i=0;i<4;i++)await h.frame('two fingers',250+i*15);
  assert.equal(h.get('slide-count').textContent,'2 / 5');
  await h.hold('open palm',20,350);
  for(let i=0;i<4;i++)await h.frame('index finger',350-i*15);
  assert.equal(h.get('slide-count').textContent,'1 / 5');
  await h.get('stop-camera').fire('click');
});

test('the same held V can advance consecutive DOM pages and remaining still cannot repeat',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  for(let i=0;i<4;i++)await h.frame('two fingers',220+i*15);
  assert.equal(h.get('slide-count').textContent,'2 / 5');
  await h.hold('two fingers',8,265);assert.equal(h.get('slide-count').textContent,'2 / 5');
  for(let i=1;i<=3;i++)await h.frame('two fingers',265+i*15);
  assert.equal(h.get('slide-count').textContent,'3 / 5');
  await h.hold('two fingers',15,310);assert.equal(h.get('slide-count').textContent,'3 / 5');
  await h.get('stop-camera').fire('click');
});
test('the same held index can go previous twice without lowering fingers',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[4].fire('click');
  for(let i=0;i<4;i++)await h.frame('index finger',420-i*15);
  assert.equal(h.get('slide-count').textContent,'4 / 5');
  await h.hold('index finger',8,375);assert.equal(h.get('slide-count').textContent,'4 / 5');
  for(let i=1;i<=3;i++)await h.frame('index finger',375-i*15);
  assert.equal(h.get('slide-count').textContent,'3 / 5');
  await h.get('stop-camera').fire('click');
});
test('a direct camera V-to-index switch reverses actual slides within a short motion sequence',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  for(let i=0;i<4;i++)await h.frame('two fingers',250+i*15);
  assert.equal(h.get('slide-count').textContent,'2 / 5');const at=h.state.time;
  for(let i=0;i<6;i++)await h.frame('index finger',295-i*15);
  assert.equal(h.get('slide-count').textContent,'1 / 5');
  assert.ok(h.state.time-at<=240);await h.get('stop-camera').fire('click');
});
test('continuous V/index navigation away from and back to paused video never calls play',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
  await h.hold('fist',25);const video=h.get('demo-video'),count=video.playCalls;
  for(let i=0;i<4;i++)await h.frame('index finger',400-i*12);
  assert.equal(h.get('slide-count').textContent,'3 / 5');
  await h.hold('index finger',6,364);
  for(let i=1;i<=3;i++)await h.frame('index finger',364-i*12);
  assert.equal(h.get('slide-count').textContent,'2 / 5');
  for(let i=0;i<6;i++)await h.frame('two fingers',328+i*18);
  assert.equal(h.get('slide-count').textContent,'3 / 5');
  await h.hold('two fingers',6,418);
  for(let i=1;i<=3;i++)await h.frame('two fingers',418+i*18);
  assert.equal(h.get('slide-count').textContent,'4 / 5');
  assert.equal(video.playCalls,count);assert.equal(video.paused,true);
  await h.get('stop-camera').fire('click');
});

test('camera motion qualifying during cooldown never queues a slide change after the hand stops',async()=>{
  const h=harness();await h.get('start-camera').fire('click');await flush();
  for(let i=0;i<4;i++)await h.frame('two fingers',250+i*15);
  await h.frame('two fingers',310);assert.equal(h.get('slide-count').textContent,'2 / 5');
  await h.hold('two fingers',40,310);assert.equal(h.get('slide-count').textContent,'2 / 5');
  await h.get('stop-camera').fire('click');
});

test('mirrored three-frame V-right and index-left trajectories change actual pages symmetrically within 3ms',async()=>{
  for(const [pose,direction,slide] of [['two fingers',1,'4 / 5'],['index finger',-1,'2 / 5']]){
    const h=harness();await h.get('start-camera').fire('click');await flush();
    await h.get('slide-dots').children[2].fire('click');const start=h.state.time;
    for(let i=0;i<3;i++)await h.frame(pose,320+direction*i*12,360,1);
    assert.equal(h.get('slide-count').textContent,slide);assert.equal(h.state.time-start,3);
    await h.get('stop-camera').fire('click');
  }
});
test('wrong V-left or index-right camera motion cannot navigate or play paused video',async()=>{
  for(const [pose,direction] of [['two fingers',-1],['index finger',1]]){
    const h=harness();await h.get('start-camera').fire('click');await flush();
    await h.get('slide-dots').children[3].fire('click');await h.get('play-pause').fire('click');
    await h.hold('fist',25);const video=h.get('demo-video'),before=video.playCalls;
    await h.hold(pose,20,320);
    for(let i=0;i<4;i++)await h.frame(pose,320+direction*i*15);
    assert.equal(h.get('slide-count').textContent,'4 / 5');
    assert.equal(video.playCalls,before);assert.equal(video.paused,true);
    await h.get('stop-camera').fire('click');
  }
});
