// Hand Remote test sketch - IMS 228 Group 5
// Press Play, allow the camera, and hold your hand up.

let handPose;
let video;
let hands = [];

// fake "presentation" state so we can see the gestures do something
let slide = 1;
let videoPlaying = false;
let events = [];

// gesture tracking
let wristHistory = [];
let lastSwipeTime = 0;
let lastFistTime = 0;
let wasFist = false;
let fistRatio = 0;

// tuning numbers: change these while testing if gestures fire too easily or not at all
const FIST_RATIO = 1.3;      // fingertips closer to the wrist than this (in hand sizes) = fist
const SWIPE_DISTANCE = 0.25; // how far the hand has to travel, as a part of the screen width
const SWIPE_TIME = 400;      // the travel has to happen within this many milliseconds
const COOLDOWN = 1000;       // wait this long before the same gesture can fire again

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);
}

function gotHands(results) {
  hands = results;
}

function draw() {
  image(video, 0, 0, width, height);

  if (hands.length > 0) {
    let hand = hands[0];

    // draw the 21 points ml5 gives us
    noStroke();
    fill(0, 255, 0);
    for (let kp of hand.keypoints) {
      circle(kp.x, kp.y, 8);
    }

    checkFist(hand);
    checkSwipe(hand);
  } else {
    wristHistory = [];
  }

  drawInfo();
}

// hand size = distance from the wrist (point 0) to the base of the middle finger (point 9)
// using this means the rules still work when the hand is close to or far from the camera
function handSize(hand) {
  let wrist = hand.keypoints[0];
  let middleBase = hand.keypoints[9];
  return dist(wrist.x, wrist.y, middleBase.x, middleBase.y);
}

// FIST: all four fingertips (points 8, 12, 16, 20) are close to the wrist
function checkFist(hand) {
  let wrist = hand.keypoints[0];
  let tips = [8, 12, 16, 20];
  let total = 0;
  for (let i of tips) {
    total += dist(wrist.x, wrist.y, hand.keypoints[i].x, hand.keypoints[i].y);
  }
  fistRatio = total / tips.length / handSize(hand);

  let isFist = fistRatio < FIST_RATIO;
  let now = millis();

  // only fire once when the hand closes, not every frame it stays closed
  if (isFist && !wasFist && now - lastFistTime > COOLDOWN) {
    videoPlaying = !videoPlaying;
    lastFistTime = now;
    record("FIST: video " + (videoPlaying ? "playing" : "paused"));
  }
  wasFist = isFist;
}

// SWIPE: the wrist moves far left or right in a short time
function checkSwipe(hand) {
  let wrist = hand.keypoints[0];
  let now = millis();

  wristHistory.push({ x: wrist.x, t: now });
  wristHistory = wristHistory.filter((p) => now - p.t < SWIPE_TIME);

  if (wasFist || now - lastSwipeTime < COOLDOWN || wristHistory.length < 2) {
    return;
  }

  let moved = wrist.x - wristHistory[0].x;

  if (moved > width * SWIPE_DISTANCE) {
    slide++;
    lastSwipeTime = now;
    wristHistory = [];
    record("SWIPE RIGHT: slide " + slide);
  } else if (moved < -width * SWIPE_DISTANCE) {
    slide = max(1, slide - 1);
    lastSwipeTime = now;
    wristHistory = [];
    record("SWIPE LEFT: slide " + slide);
  }
}

function record(text) {
  let seconds = nf(millis() / 1000, 1, 1);
  events.unshift(seconds + "s  " + text);
  events = events.slice(0, 6);
  console.log(text);
}

function drawInfo() {
  fill(0, 180);
  noStroke();
  rect(0, 0, 260, 190);

  fill(255);
  textSize(16);
  text("Slide: " + slide, 12, 26);
  text("Video: " + (videoPlaying ? "playing" : "paused"), 12, 48);
  text("Hands seen: " + hands.length, 12, 70);
  text("Fist ratio: " + nf(fistRatio, 1, 2) + "  (fist under " + FIST_RATIO + ")", 12, 92);

  textSize(13);
  for (let i = 0; i < events.length; i++) {
    text(events[i], 12, 118 + i * 12);
  }
}
