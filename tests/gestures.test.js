// Synthetic pose/motion tests. They do not establish real-webcam accuracy.
const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../gestures.js');
const {GestureController,classifyHand,SETTINGS}=api;
const {hand,mcpFoldedHand,mildlyBentIndex,threeFingerHand,occludedMiddleHand,curledTipIndex,diagonalThumbHand,driver}=require('./fixtures.js');

test('classifies exact V, index-only, fist, open-palm and neutral poses',()=>{
  for(const pose of ['two fingers','index finger','fist','open palm','neutral'])
    assert.equal(classifyHand(hand(pose)).pose,pose);
  assert.notEqual(classifyHand(hand('two fingers')).pose,'index finger');
});
test('V right goes next and index left goes previous with the same motion feel',()=>{
  for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const d=driver(new GestureController(),false);d.swipe(pose,direction);
    assert.deepEqual(d.actions,[action]);
  }
});
test('wrong fixed-pose directions and open palm, fist or neutral movement cannot navigate',()=>{
  const cases=[['two fingers',-1],['index finger',1],['open palm',1],['open palm',-1],['fist',1],['neutral',-1]];
  for(const [pose,direction] of cases){
    const d=driver(new GestureController(),false);d.swipe(pose,direction);
    assert.deepEqual(d.actions,[],`${pose} direction ${direction}`);
  }
});
test('middle, ring or pinky extended invalidates index-only previous posture',()=>{
  for(const tip of [12,16,20]){
    const h=hand('index finger'),opened=hand('open palm');
    for(let i=tip-3;i<=tip;i++)h.keypoints[i]=opened.keypoints[i];
    assert.notEqual(classifyHand(h).pose,'index finger');
  }
});
test('an additional raised ring finger or pinky invalidates the V next posture',()=>{
  for(const tip of [16,20]){
    const h=hand('two fingers'),open=hand('open palm');
    for(let i=tip-3;i<=tip;i++)h.keypoints[i]=open.keypoints[i];
    assert.notEqual(classifyHand(h).pose,'two fingers');
  }
});
test('an upright thumb rejects a navigation pose',()=>{
  for(const pose of ['two fingers','index finger']){
    const h=hand(pose);
    h.keypoints[1]={x:295,y:345};h.keypoints[2]={x:290,y:310};
    h.keypoints[3]={x:290,y:270};h.keypoints[4]={x:290,y:230};
    assert.ok(!['two fingers','index finger'].includes(classifyHand(h).pose));
  }
});
test('a single spatial jump or stationary finger-pose alternation cannot navigate',()=>{
  const a=driver(new GestureController(),false);
  a.step('index finger',200);a.step('index finger',330,360,60);
  assert.deepEqual(a.actions,[]);
  const b=driver(new GestureController(),false);
  for(let i=0;i<15;i++)b.step(i%2?'two fingers':'index finger',240);
  assert.deepEqual(b.actions,[]);
});
test('small jitter and vertical motion do not switch slides',()=>{
  for(const vertical of [false,true]){
    const d=driver(new GestureController(),false);d.hold('index finger',12,300,200);
    for(let i=0;i<25;i++)d.step('index finger',300+(vertical?0:Math.sin(i)*10),vertical?200+i*6:200);
    assert.deepEqual(d.actions,[]);
  }
});
test('long stationary index posture followed by one 95px jump and hold cannot navigate',()=>{
  const d=driver(new GestureController(),false);d.hold('index finger',35,250);
  d.step('index finger',345);d.hold('index finger',35,345);
  assert.deepEqual(d.actions,[]);
});
test('three distinct deliberate motion samples still work with 200ms camera intervals',()=>{
  const d=driver(new GestureController(),false);d.hold('two fingers',15,200);
  d.step('two fingers',250,360,200);
  d.step('two fingers',300,360,200);
  d.step('two fingers',350,360,200);
  assert.deepEqual(d.actions,['next']);
});
test('holding a navigation posture still never repeats a completed slide action',()=>{
  for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const engine=new GestureController(),d=driver(engine,false);
    d.swipe(pose,direction,320);engine.onSlideChange(true);
    d.hold(pose,60,320+direction*45);
    assert.deepEqual(d.actions,[action]);
  }
});
test('fresh same-pose movement can navigate consecutive pages without lowering fingers',()=>{
  for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const engine=new GestureController(),d=driver(engine,false);
    for(let i=0;i<4;i++)d.step(pose,320+direction*i*15);
    engine.onSlideChange(true);d.hold(pose,6,320+direction*45);
    for(let i=1;i<=3;i++)d.step(pose,320+direction*(45+i*15));
    assert.deepEqual(d.actions,[action,action],pose);
  }
});
test('a direct V-to-index switch goes previous without a neutral release',()=>{
  const engine=new GestureController(),d=driver(engine,false);
  for(let i=0;i<4;i++)d.step('two fingers',250+i*15);
  engine.onSlideChange(true);
  for(let i=0;i<5;i++)d.step('index finger',295-i*15);
  assert.deepEqual(d.actions,['next','previous']);
});
test('stable fist pauses once; sustained visible release plays once',()=>{
  const d=driver(new GestureController());d.hold('fist',35);
  assert.deepEqual(d.actions,['pause']);d.hold('open palm',20);
  assert.deepEqual(d.actions,['pause','play']);d.hold('open palm',30);
  assert.deepEqual(d.actions,['pause','play']);d.hold('fist',20);
  assert.deepEqual(d.actions,['pause','play','pause']);
});
test('brief fist or brief release cannot affect video',()=>{
  const d=driver(new GestureController());d.hold('fist',5);d.hold('open palm',15);
  assert.deepEqual(d.actions,[]);
  d.hold('fist',20);d.hold('open palm',2);d.hold('fist',10);
  assert.deepEqual(d.actions,['pause']);
});
test('ambiguous neutral pose cannot release a paused video latch',()=>{
  const d=driver(new GestureController());d.hold('fist',25);d.hold('neutral',25);
  assert.deepEqual(d.actions,['pause']);d.hold('open palm',20);
  assert.deepEqual(d.actions,['pause','play']);
});
test('hand loss, tracking reset or leaving video never auto-plays',()=>{
  for(const reset of ['loss','reset','slide']){
    const engine=new GestureController(),d=driver(engine);d.hold('fist',25);
    assert.deepEqual(d.actions,['pause']);
    if(reset==='loss')d.step(null);
    if(reset==='reset')engine.reset();
    if(reset==='slide')engine.onSlideChange();
    d.hold('open palm',30);assert.deepEqual(d.actions,['pause'],reset);
  }
});
test('video media gestures do not fire on non-video slides',()=>{
  const d=driver(new GestureController(),false);d.hold('fist',30);d.hold('open palm',30);
  assert.deepEqual(d.actions,[]);
});
test('track loss, identity switch or teleport cannot complete an old swipe',()=>{
  for(const reset of ['loss','label','jump','stale']){
    const engine=new GestureController(),d=driver(engine,false);d.hold('index finger',12,240);
    d.step('index finger',280);
    if(reset==='loss')d.step(null);
    const label=reset==='label'?'Left':'Right';
    const x=reset==='jump'?600:360;
    const dt=reset==='stale'?SETTINGS.staleAfter+1:40;
    assert.equal(d.step('index finger',x,360,dt,label),null,reset);
    assert.deepEqual(d.actions,[],reset);
  }
});
test('circle-volume recognition and toggle action have been removed',()=>{
  assert.equal(api.fitCircle,undefined);
  assert.ok(!Object.keys(SETTINGS).some(key=>/circle|volume/i.test(key)));
  const d=driver(new GestureController());d.hold('index finger',12,342,330);
  for(let i=0;i<70;i++)d.step('index finger',320+22*Math.cos(i/69*2*Math.PI),330+22*Math.sin(i/69*2*Math.PI));
  assert.deepEqual(d.actions,[]);
});
test('invalid or unresolved landmarks are rejected',()=>{
  assert.equal(classifyHand({keypoints:[]}),null);
  const h=hand('index finger');h.keypoints[8].x=NaN;assert.equal(classifyHand(h),null);
  assert.equal(classifyHand(hand('index finger',320,360,'Right',.05)),null);
});
test('fingers folded at MCP can still have straight PIP/DIP joints and be recognized',()=>{
  for(const pose of ['index finger'])assert.equal(classifyHand(mcpFoldedHand(pose)).pose,pose);
});
test('lowered straight folded fingers allow an actual index-only previous swipe',()=>{
  const engine=new GestureController(),actions=[];let now=0;
  function frame(x){now+=40;const action=engine.update(mcpFoldedHand('index finger',x),now,false);if(action)actions.push(action);}
  for(let i=0;i<15;i++)frame(380);
  for(let i=1;i<=4;i++)frame(380-i*6);
  for(let i=0;i<8;i++)frame(356);
  assert.deepEqual(actions,['previous']);
});
test('a mildly bent but upward pointing index remains a valid previous posture',()=>{
  assert.equal(classifyHand(mildlyBentIndex()).pose,'index finger');
});
test('a deliberate 60px swipe is sufficient after a short stable pose',()=>{
  for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const d=driver(new GestureController(),false);d.hold(pose,10,320);
    for(let i=1;i<=10;i++)d.step(pose,320+direction*i*6);
    const count=d.actions.length;d.hold(pose,12,320+direction*60);
    assert.ok(count>=1,pose);assert.ok(d.actions.every(a=>a===action),pose);
    assert.equal(d.actions.length,count,'holding still cannot deliver another queued page');
  }
});
test('realistic small lateral and vertical tracking jitter does not prevent a deliberate swipe',()=>{
  const d=driver(new GestureController(),false);d.hold('two fingers',12,250);
  for(let i=1;i<=7;i++)d.step('two fingers',250+i*7+(i%2?3:-3),360+Math.sin(i*1.7)*3);
  d.hold('two fingers',10,302);
  assert.deepEqual(d.actions,['next']);
});
test('one brief ambiguous neutral frame during motion does not erase a valid swipe',()=>{
  const d=driver(new GestureController(),false);d.hold('two fingers',12,250);
  d.step('two fingers',258);d.step('two fingers',266);d.step('neutral',268);
  for(let i=1;i<=5;i++)d.step('two fingers',266+i*6);
  assert.deepEqual(d.actions,['next']);
});

test('a fist followed by index or V navigation pose never requests video play',()=>{
  for(const pose of ['index finger','two fingers']){
    const d=driver(new GestureController());d.hold('fist',30);d.hold(pose,30);
    assert.deepEqual(d.actions,['pause'],pose);
  }
});
test('a brief full-palm transition before navigation does not resume paused video',()=>{
  const d=driver(new GestureController());d.hold('fist',30);d.hold('open palm',12);
  d.hold('index finger',30);assert.deepEqual(d.actions,['pause']);
});
test('three raised main fingers cannot resume a paused video',()=>{
  const engine=new GestureController(),actions=[];let now=0;
  function frame(h){now+=40;const action=engine.update(h,now,true);if(action)actions.push(action);}
  for(let i=0;i<30;i++)frame(hand('fist'));
  for(let i=0;i<40;i++)frame(threeFingerHand());
  assert.deepEqual(actions,['pause']);
});
test('600ms of deliberate continuous full-open palm resumes once',()=>{
  const engine=new GestureController(),actions=[];let now=0;
  function frame(pose){now+=40;const action=engine.update(hand(pose),now,true);if(action)actions.push(action);}
  for(let i=0;i<30;i++)frame('fist');
  for(let i=0;i<15;i++)frame('open palm');
  assert.deepEqual(actions,['pause'],'560ms between first and latest open frames is insufficient');
  frame('open palm');assert.deepEqual(actions,['pause','play']);
  for(let i=0;i<25;i++)frame('open palm');assert.deepEqual(actions,['pause','play']);
});
test('a single raw non-full-palm frame resets the full-palm resume timer immediately',()=>{
  const engine=new GestureController(),actions=[];let now=0;
  function frame(h){now+=40;const action=engine.update(h,now,true);if(action)actions.push(action);}
  for(let i=0;i<30;i++)frame(hand('fist'));
  for(let i=0;i<12;i++)frame(hand('open palm'));
  frame(threeFingerHand());
  for(let i=0;i<15;i++)frame(hand('open palm'));
  assert.deepEqual(actions,['pause']);frame(hand('open palm'));
  assert.deepEqual(actions,['pause','play']);
});
test('natural short swipes work in both directions without any stationary prehold',()=>{
  for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const d=driver(new GestureController(),false);
    for(let i=0;i<4;i++)d.step(pose,300+direction*i*15);
    assert.deepEqual(d.actions,[action],pose);
  }
});
test('200ms and 400ms camera cadence still permits immediate deliberate short swipes',()=>{
  for(const dt of [200,400])for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const d=driver(new GestureController(),false);
    for(let i=0;i<3;i++)d.step(pose,300+direction*i*25,360,dt);
    assert.deepEqual(d.actions,[action],`${pose} ${dt}ms`);
  }
});

test('partly occluded lowered middle finger does not block a raised index previous pose',()=>{
  assert.equal(classifyHand(occludedMiddleHand()).pose,'index finger');
});
test('a curled fingertip remains a previous pose when the index is clearly upward',()=>{
  assert.equal(classifyHand(curledTipIndex()).pose,'index finger');
});
test('a relaxed diagonal thumb does not block index navigation',()=>{
  for(const pose of ['index finger'])assert.equal(classifyHand(diagonalThumbHand(pose)).pose,pose);
});
test('mirrored 24px V-right and index-left paths have identical trigger timing',()=>{
  for(const [pose,direction,step,action] of [['index finger',-1,12,'previous'],['two fingers',1,12,'next']]){
    const d=driver(new GestureController(),false);
    for(let i=0;i<3;i++)d.step(pose,320+direction*i*step);
    assert.deepEqual(d.actions,[action],pose);
    assert.equal(d.now,120,'response must not depend on seconds of stationary holding');
  }
});
test('returning a fixed navigation pose rebases without navigating; its next stroke still works',()=>{
  for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
    const engine=new GestureController(),d=driver(engine,false);
    for(let i=0;i<4;i++)d.step(pose,320+direction*i*15);
    engine.onSlideChange(true);d.hold(pose,6,320+direction*45);
    d.step(pose,320+direction*25);d.step(pose,320);
    assert.deepEqual(d.actions,[action],'returning must not navigate the opposite page');
    for(let i=1;i<=3;i++)d.step(pose,320+direction*i*15);
    assert.deepEqual(d.actions,[action,action]);
  }
});
test('qualified movement received during cooldown cannot deliver a queued repeat while stationary',()=>{
  const engine=new GestureController(),d=driver(engine,false);
  for(let i=0;i<4;i++)d.step('two fingers',250+i*15);
  engine.onSlideChange(true);d.step('two fingers',310);
  assert.deepEqual(d.actions,['next'],'second threshold is reached while cooldown is active');
  d.hold('two fingers',40,310);
  assert.deepEqual(d.actions,['next'],'elapsed cooldown alone must never change another page');
});

test('V-right and index-left 1ms, 5ms and 10ms updates share the same trigger sample and time',()=>{
  for(const dt of [1,5,10]){
    const results=[];
    for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
      const d=driver(new GestureController(),false);let sample=null;
      for(let i=0;i<3;i++)if(d.step(pose,300+direction*i*12,360,dt))sample=i+1;
      assert.deepEqual(d.actions,[action]);results.push({sample,time:d.now});
    }
    assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],{sample:3,time:dt*3});
  }
});
test('V-left cannot navigate or resume video after a paused fist',()=>{
  const d=driver(new GestureController());d.hold('fist',30);d.hold('two fingers',30,400);
  for(let i=0;i<8;i++)d.step('two fingers',400-i*15);
  assert.deepEqual(d.actions,['pause']);
});
test('larger hands need the same travel and trigger sample for V-right and index-left',()=>{
  for(const scale of [.6,1,1.6,2]){
    const results=[];
    for(const [pose,direction,action] of [['two fingers',1,'next'],['index finger',-1,'previous']]){
      const engine=new GestureController();let first=null;
      for(let i=0;i<6;i++){
        const result=engine.update(hand(pose,300+direction*i*10,360,'Right',scale),i+1,false);
        if(result&&!first){assert.equal(result,action);first={sample:i+1,time:i+1,travel:i*10};}
      }
      assert.ok(first,`${pose} scale ${scale}`);results.push(first);
    }
    assert.deepEqual(results[0],results[1],`scale ${scale}`);
  }
});
