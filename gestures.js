// Hand Remote gesture rules. Each camera result is processed once.
(function (root) {
  const SETTINGS = {
    poseGrace: 110, swipeWindow: 2200, swipeDistance: 22, maxSwipeDistance: 38,
    swipeHandDistance: 0.28, palmSmoothing: 0.8, minSwipeSamples: 2, maxSwipeStep: 85,
    cooldown: 300, releaseOnReturn: true, fistHold: 260, releaseHold: 600,
    staleAfter: 3500, minHandSize: 18
  };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function cosineAt(a, b, c) {
    const ux = a.x - b.x, uy = a.y - b.y;
    const vx = c.x - b.x, vy = c.y - b.y;
    return (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1);
  }
  function classifyHand(hand) {
    const p = hand?.keypoints;
    if (!Array.isArray(p) || p.length !== 21 || p.some(k => !Number.isFinite(k.x) || !Number.isFinite(k.y))) return null;
    const size = distance(p[0], p[9]);
    if (size < SETTINGS.minHandSize) return null;
    const extended = [], folded = [];
    for (const tip of [8, 12, 16, 20]) {
      const mcp = p[tip - 3], pip = p[tip - 2], dip = p[tip - 1];
      // The raised index may have a curled last joint. Its overall upward
      // direction matters; the other fingers keep their clear-raised test.
      const isIndex = tip === 8;
      const straight = cosineAt(mcp, pip, p[tip]) < (isIndex ? -0.25 : -0.45) &&
        (isIndex || cosineAt(pip, dip, p[tip]) < 0.05);
      const up = p[tip].y < pip.y - size * (isIndex ? 0.07 : 0.12) &&
        p[tip].y < mcp.y - size * (isIndex ? 0.45 : 0.12) &&
        distance(p[tip], p[0]) > distance(pip, p[0]) + size * (isIndex ? 0.03 : 0.12);
      const raised = straight && up;
      extended.push(raised);
      folded.push(!raised && distance(p[tip], mcp) < size * 1.5 &&
        (p[tip].y > pip.y - size * 0.2 || distance(p[tip], p[0]) < distance(pip, p[0]) + size * 0.25));
    }
    const thumbRise = p[2].y - p[4].y;
    const thumbUp = p[4].y < p[3].y - size * 0.3 && thumbRise > size * 0.55 &&
      Math.abs(p[4].x - p[2].x) < thumbRise * 0.75 &&
      distance(p[4], p[0]) > size * 1.3 && distance(p[4], p[0]) > distance(p[2], p[0]) + size * 0.25;
    let pose = 'neutral';
    // Lowered fingers can be partly occluded or relaxed. Navigation only
    // needs to reject additional raised fingers; a precise fold is unnecessary.
    if (!thumbUp && extended[0] && extended[1] && !extended[2] && !extended[3]) pose = 'two fingers';
    else if (!thumbUp && extended[0] && !extended[1] && !extended[2] && !extended[3]) pose = 'index finger';
    else if (!extended.some(Boolean) && folded.every(Boolean)) pose = 'fist';
    else if (extended.filter(Boolean).length >= 3) pose = 'open palm';
    const bases = [0, 5, 9, 13, 17];
    const palm = {
      x: bases.reduce((sum, i) => sum + p[i].x, 0) / bases.length,
      y: bases.reduce((sum, i) => sum + p[i].y, 0) / bases.length
    };
    return { pose, wrist: p[0], palm, size, keypoints: p, label: hand.handedness, extended };
  }

  class GestureController {
    constructor(settings = {}) {
      this.settings = { ...SETTINGS, ...settings };
      this.lastAction = -Infinity; this.reset();
    }
    reset() {
      this.pose = 'no hand'; this.poseSince = 0;
      this.pendingPose = null; this.pendingSince = null;
      this.previous = null; this.lastTime = null;
      this.pauseLatched = false; this.releaseSince = null; this.resetMotion();
      this.navLocked = false; this.lockDirection = 0; this.lockPeak = 0;
    }
    resetMotion() {
      this.navPose = null; this.anchor = null; this.history = [];
      this.moving = false; this.movingSamples = 0; this.lastMotionPoint = null;
      this.filteredPalm = null; this.rawOrigin = null; this.moveStartedAt = null;
    }
    beginMotion(info, now) {
      this.resetMotion(); this.navPose = info.pose;
      this.anchor = { ...info.palm, t: now };
      this.filteredPalm = { ...info.palm }; this.rawOrigin = { ...info.palm };
      this.history = [{ ...info.palm, t: now }];
    }
    onSlideChange(byGesture = false) {
      this.pauseLatched = false; this.releaseSince = null;
      // A gesture already established the next movement origin. Keep it so
      // the same raised fingers can continue navigating without a reset pose.
      if (!byGesture) { this.resetMotion(); this.navLocked = false; }
    }
    getHint() {
      if (this.pose === 'no hand') return 'Show one hand to the camera.';
      if (this.pose === 'index finger') return 'Index finger ready. Swipe left for previous; keep this pose to repeat.';
      if (this.pose === 'two fingers') return 'Two fingers ready. Swipe right for next; keep this pose to repeat.';
      if (this.pose === 'fist') return this.pauseLatched ? 'Video paused. Use one or two fingers to swipe, or open your whole palm and hold to play.' : 'Fist detected.';
      if (this.pose === 'open palm') return this.pauseLatched ? 'Open your whole palm and hold briefly to play.' : 'Raise two fingers for next, or only index for previous.';
      return 'Keep the raised finger upright and the other fingers lowered.';
    }
    update(hand, now, videoVisible) {
      const info = classifyHand(hand), s = this.settings;
      if (!info) { this.reset(); return null; }
      const priorInfo = this.previous, priorTime = this.lastTime;
      const rawStep = priorInfo ? distance(info.palm, priorInfo.palm) : 0;
      const frameTime = priorTime === null ? 0 : now - priorTime;
      if (this.previous && (now - this.lastTime > s.staleAfter ||
          distance(info.palm, this.previous.palm) > 220 ||
          (info.label && this.previous.label && info.label !== this.previous.label))) this.reset();
      this.previous = info; this.lastTime = now;
      const isNav = info.pose === 'index finger' || info.pose === 'two fingers';

      // Only a continuously visible, fully open palm can resume a paused
      // video. Reset immediately on raw non-palm frames, including during
      // pose debounce, so changing from a fist to a swipe never counts.
      if (!videoVisible) this.pauseLatched = false;
      const fullOpenPalm = info.pose === 'open palm' && info.extended.every(Boolean);
      if (!this.pauseLatched || !fullOpenPalm) this.releaseSince = null;
      else if (this.releaseSince === null) this.releaseSince = now;

      if (info.pose !== this.pose) {
        if (this.pose !== 'no hand' && !isNav) {
          if (this.pendingPose !== info.pose) { this.pendingPose = info.pose; this.pendingSince = now; }
          // One ambiguous camera frame should not erase an otherwise valid
          // swipe. It cannot produce an action while the pose is uncertain.
          if (now - this.pendingSince < s.poseGrace) return null;
        }
        this.pose = info.pose; this.poseSince = now; this.resetMotion();
        // Leaving the navigation poses (fist, palm, neutral) unlocks navigation.
        if (!isNav) this.navLocked = false;
      }
      this.pendingPose = null; this.pendingSince = null;
      // Desired-state media actions. A held fist never toggles the video.
      if (videoVisible && info.pose === 'fist' && now - this.poseSince >= s.fistHold && !this.pauseLatched) {
        this.pauseLatched = true; this.releaseSince = null; return 'pause';
      }
      if (videoVisible && this.pauseLatched && fullOpenPalm && this.releaseSince !== null && now - this.releaseSince >= s.releaseHold) {
        this.pauseLatched = false; this.releaseSince = null; return 'play';
      }
      if (!isNav) return null;
      // Slow inference can sample a real swipe farther apart. Keep the strict
      // jump limit at normal cadence, and allow a larger step only when the
      // elapsed camera interval warrants it. One jump alone still cannot fire.
      const stepLimit = Math.min(180, Math.max(s.maxSwipeStep, frameTime * 0.45));
      if (rawStep > stepLimit) { this.resetMotion(); return null; }
      const direction = info.pose === 'two fingers' ? 1 : -1;
      const threshold = Math.min(s.maxSwipeDistance, Math.max(s.swipeDistance, info.size * s.swipeHandDistance));
      // One swipe, one slide. After a page change the same direction stays
      // locked until the hand travels back against the swipe by one swipe
      // distance, or leaves the pose / the camera view. Switching to the other
      // finger pose is a different gesture and is not locked.
      if (this.navLocked && this.lockDirection === direction) {
        const ahead = (info.palm.x - this.lockPeak) * direction;
        if (ahead > 0) this.lockPeak = info.palm.x;
        else if (s.releaseOnReturn && -ahead >= threshold) { this.navLocked = false; this.beginMotion(info, now); }
        return null;
      }
      // Minimum gap between slide changes. Movement during the gap is
      // discarded, so a swipe has to be made again after it ends.
      if (now - this.lastAction < s.cooldown) { this.beginMotion(info, now); return null; }
      if (!this.anchor) { this.beginMotion(info, now); return null; }
      const alpha = s.palmSmoothing;
      this.filteredPalm = this.filteredPalm ? {
        x: this.filteredPalm.x + alpha * (info.palm.x - this.filteredPalm.x),
        y: this.filteredPalm.y + alpha * (info.palm.y - this.filteredPalm.y)
      } : { ...info.palm };
      const navPoint = this.filteredPalm;

      // No pose hold or minimum movement duration. Direction and distinct
      // actual movement samples provide the navigation confirmation.
      const rawDx = info.palm.x - this.rawOrigin.x;
      const rawDy = info.palm.y - this.rawOrigin.y;
      if (rawDx * direction < -8) {
        // A return stroke repositions the same raised hand without changing
        // slides. Both navigation poses use the same movement thresholds.
        this.beginMotion(info, now); return null;
      }
      const point = { ...navPoint, t: now };
      if (!this.moving) {
        const origin = this.history[0];
        if (distance(point, origin) < 8) {
          this.history = [{ ...origin, t: now }]; return null;
        }
        this.moving = true; this.lastMotionPoint = this.rawOrigin; this.moveStartedAt = origin.t;
        this.history = [{ ...origin }];
      }
      const freshMovement = distance(info.palm, this.lastMotionPoint) >= 2;
      if (freshMovement) {
        this.movingSamples++; this.lastMotionPoint = { ...info.palm };
      }
      if (distance(point, this.history[this.history.length - 1]) >= 2) this.history.push(point);
      if (now - this.moveStartedAt > s.swipeWindow) { this.resetMotion(); return null; }
      this.history = this.history.filter(p => now - p.t <= s.swipeWindow);
      const first = this.history[0];
      const dx = point.x - first.x, dy = point.y - first.y;
      let travel = 0;
      for (let i = 1; i < this.history.length; i++) travel += distance(this.history[i], this.history[i - 1]);
      if (dx * direction < -30 || Math.abs(dy) > Math.max(35, Math.abs(dx) * 0.75)) {
        this.resetMotion(); return null;
      }
      if (direction && freshMovement &&
          this.movingSamples >= s.minSwipeSamples &&
          rawDx * direction >= threshold && Math.abs(rawDy) <= Math.abs(rawDx) * 0.75 &&
          Math.abs(dx) / (travel || 1) >= 0.78) {
        this.lastAction = now; this.beginMotion(info, now);
        this.navLocked = true; this.lockDirection = direction; this.lockPeak = info.palm.x;
        return direction === 1 ? 'next' : 'previous';
      }
      return null;
    }
  }
  const api = { GestureController, classifyHand, SETTINGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HandGestures = api;
})(typeof window !== 'undefined' ? window : globalThis);
