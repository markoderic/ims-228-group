// Synthetic landmarks in mirrored screen coordinates. No real-camera accuracy claim.
const PATTERNS={
  'open palm':[true,true,true,true],
  'two fingers':[true,true,false,false],
  'index finger':[true,false,false,false],
  'fist':[false,false,false,false],
  'neutral':[false,true,false,false]
};
function hand(pose,x=320,y=360,label='Right',scale=1){
  const p=Array.from({length:21},()=>({x,y:y-40}));p[0]={x,y};
  [[-30,-15],[-50,-40],[-70,-55],[-90,-60]].forEach(([dx,dy],i)=>p[i+1]={x:x+dx,y:y+dy});
  [8,12,16,20].forEach((tip,i)=>{
    const fx=x-35+i*24,up=PATTERNS[pose][i];
    p[tip-3]={x:fx,y:y-65};p[tip-2]={x:fx,y:y-(up?100:75)};
    p[tip-1]={x:fx,y:y-(up?130:55)};p[tip]={x:fx,y:y-(up?160:40)};
  });
  return {keypoints:p.map(point=>({...point,x:x+(point.x-x)*scale,y:y+(point.y-y)*scale})),handedness:label,confidence:.99};
}
function mcpFoldedHand(pose='index finger',x=320,y=360){
  const h=hand(pose,x,y);
  const foldedTips=pose==='two fingers'?[16,20]:[12,16,20];
  for(const tip of foldedTips){
    const base=h.keypoints[tip-3];
    h.keypoints[tip-2]={x:base.x,y:base.y+15};
    h.keypoints[tip-1]={x:base.x,y:base.y+30};
    h.keypoints[tip]={x:base.x,y:base.y+45};
  }
  return h;
}
function mildlyBentIndex(x=320,y=360){
  const h=hand('index finger',x,y),base=h.keypoints[5];
  h.keypoints[6]={x:base.x,y:y-100};
  h.keypoints[7]={x:base.x+28,y:y-118};
  h.keypoints[8]={x:base.x+52,y:y-130};
  return h;
}
function threeFingerHand(x=320,y=360){
  const h=hand('open palm',x,y),folded=hand('fist',x,y);
  for(let i=17;i<=20;i++)h.keypoints[i]=folded.keypoints[i];
  return h;
}
function occludedMiddleHand(x=320,y=360){
  const h=hand('index finger',x,y),base=h.keypoints[9];
  h.keypoints[10]={x:base.x+22,y:base.y+8};
  h.keypoints[11]={x:base.x+54,y:base.y+14};
  h.keypoints[12]={x:base.x+105,y:base.y+22};
  return h;
}
function curledTipIndex(x=320,y=360){
  const h=hand('index finger',x,y),fx=h.keypoints[5].x;
  h.keypoints[6]={x:fx,y:y-100};
  h.keypoints[7]={x:fx,y:y-144};
  h.keypoints[8]={x:fx+12,y:y-129};
  return h;
}
function diagonalThumbHand(pose='index finger',x=320,y=360){
  const h=hand(pose,x,y);
  h.keypoints[1]={x:x-25,y:y-15};h.keypoints[2]={x:x-45,y:y-32};
  h.keypoints[3]={x:x-70,y:y-47};h.keypoints[4]={x:x-100,y:y-72};
  return h;
}
function driver(engine,video=true){
  let now=0;const actions=[];
  function step(pose,x=320,y=360,dt=40,label='Right',scale=1){
    now+=dt;const action=engine.update(pose?hand(pose,x,y,label,scale):null,now,video);
    if(action)actions.push(action);return action;
  }
  function hold(pose,n=12,x=320,y=360){for(let i=0;i<n;i++)step(pose,x,y);}
  function swipe(pose,direction,start=320,travel=45){
    hold(pose,12,start);
    for(let i=1;i<=4;i++)step(pose,start+direction*travel*i/4);
  }
  return {step,hold,swipe,actions,get now(){return now;}};
}
module.exports={hand,mcpFoldedHand,mildlyBentIndex,threeFingerHand,occludedMiddleHand,curledTipIndex,diagonalThumbHand,driver,PATTERNS};
