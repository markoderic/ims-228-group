// Hand Remote · IMS 228 Group 5
(() => {
  const $ = id => document.getElementById(id);
  const slides = [...document.querySelectorAll('.slide')];
  const stage = document.querySelector('.slide-frame');
  const video = $('demo-video');
  const gestures = new HandGestures.GestureController();
  const FRAME_WIDTH = 640, FRAME_HEIGHT = 480;
  let currentSlide = 0, replacementURL = null, mediaCommand = 0;
  let session = 0, active = false, stream = null, camera = null;
  let sketch = null, model = null, modelPromise = null, dependencyPromise = null;
  let inputCanvas = null, frameRequest = null, inferencePending = null;
  let inferenceStartedAt = 0, presentationFallback = false;

  function feedback() {}
  function updateMediaUI() {
    $('play-pause').textContent = video.paused ? 'Play video' : 'Pause video';
    document.querySelector('.video-state').textContent = video.ended ? 'ENDED' : video.paused ? 'PAUSED' : 'PLAYING';
  }
  function showSlide(index, source = 'Button', byGesture = false) {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    if (next === currentSlide) {
      feedback(index < 0 ? 'Already on the first slide.' : index >= slides.length ? 'Already on the last slide.' : 'Already on this slide.');
      return;
    }
    mediaCommand++; video.pause();
    currentSlide = next;
    slides.forEach((slide, i) => { slide.hidden = i !== next; });
    $('previous').disabled = next === 0; $('next').disabled = next === slides.length - 1;
    $('slide-count').textContent = (next + 1) + ' / ' + slides.length;
    $('media-controls').hidden = next !== 5;
    [...$('slide-dots').children].forEach((dot, i) => {
      dot.classList.toggle('active', i === next); dot.setAttribute('aria-current', String(i === next));
    });
    gestures.onSlideChange(byGesture);
    feedback(source + ': slide ' + (next + 1) + ' of ' + slides.length + '. Keep the finger pose to swipe again.');
  }
  function pauseVideo(source) {
    if (currentSlide !== 5) return;
    mediaCommand++; video.pause(); updateMediaUI();
    feedback(source + ': video paused.');
  }
  async function playVideo(source) {
    if (currentSlide !== 5) return;
    const command = ++mediaCommand;
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
      if (command !== mediaCommand) return;
      feedback(source + ': video playing.');
    } catch (error) {
      if (command !== mediaCommand) return;
      feedback(error.name === 'NotAllowedError' ? 'Click the video Play button once, then use gestures.' : 'Video could not play. Choose Replace video to try another clip.');
    }
    updateMediaUI();
  }
  function toggleVideo() {
    if (video.paused) playVideo('Button'); else pauseVideo('Button');
  }
  function performGesture(action) {
    if (action === 'next') showSlide(currentSlide + 1, 'Two-finger swipe right', true);
    if (action === 'previous') showSlide(currentSlide - 1, 'Index-finger swipe left', true);
    if (action === 'pause') pauseVideo('Fist');
    if (action === 'play') playVideo('Open palm held');
  }

  function updatePresentationMode() {
    const presenting = document.fullscreenElement === stage || presentationFallback;
    document.body.classList.toggle('presenting', presenting);
    $('fullscreen').textContent = presenting ? 'Exit presentation' : 'Present fullscreen';
    $('fullscreen').setAttribute('aria-pressed', String(presenting));
  }
  async function exitPresentation() {
    presentationFallback = false;
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    updatePresentationMode();
  }
  async function fullscreen() {
    if (document.fullscreenElement === stage || presentationFallback) {
      await exitPresentation(); return;
    }
    try {
      // Fullscreen only the slide stage. The camera/model continue outside it.
      await stage.requestFullscreen();
    } catch {
      // Browsers without Fullscreen API still get a slides-only window view.
      presentationFallback = true;
    }
    updatePresentationMode();
    stage.focus?.({ preventScroll: true });
  }
  document.addEventListener('fullscreenchange', updatePresentationMode);

  slides.forEach((slide, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    dot.setAttribute('aria-current', String(i === 0));
    if (i === 0) dot.className = 'active';
    dot.addEventListener('click', () => showSlide(i)); $('slide-dots').append(dot);
  });
  $('previous').disabled = true;
  $('previous').addEventListener('click', () => showSlide(currentSlide - 1));
  $('next').addEventListener('click', () => showSlide(currentSlide + 1));
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); showSlide(0); });
  $('fullscreen').addEventListener('click', fullscreen);
  $('play-pause').addEventListener('click', toggleVideo);
  for (const name of ['play', 'pause', 'ended']) video.addEventListener(name, updateMediaUI);
  video.addEventListener('error', () => feedback('The video could not load. Choose Replace video on slide 4.'));
  video.volume = 0.5; updateMediaUI();
  $('video-file').addEventListener('change', event => {
    const file = event.target.files[0]; if (!file) return;
    mediaCommand++; video.pause(); gestures.pauseLatched = false;
    if (replacementURL) URL.revokeObjectURL(replacementURL);
    replacementURL = URL.createObjectURL(file);
    video.src = replacementURL; video.load();
    feedback('Video selected. Make a fist to pause, then open your whole palm and hold to play.');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { exitPresentation(); return; }
    if (/^(INPUT|TEXTAREA|SELECT|VIDEO)$/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.target.tagName === 'BUTTON' && event.key === ' ') return;
    if (['ArrowRight', 'ArrowLeft', ' '].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowRight') showSlide(currentSlide + 1, 'Keyboard');
    if (event.key === 'ArrowLeft') showSlide(currentSlide - 1, 'Keyboard');
    if (event.key === ' ') toggleVideo();
    if (event.key.toLowerCase() === 'f') fullscreen();
  });

  function loadScript(url, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script'); tag.src = url;
      const timer = setTimeout(() => { tag.remove(); reject(new Error(globalName + ' download timed out.')); }, 25000);
      tag.onload = () => { clearTimeout(timer); resolve(); };
      tag.onerror = () => { clearTimeout(timer); tag.remove(); reject(new Error(globalName + ' could not load. Check your internet connection.')); };
      document.head.append(tag);
    });
  }
  function loadDependencies() {
    if (!dependencyPromise) dependencyPromise = (async () => {
      await loadScript('https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js', 'p5');
      await loadScript('https://unpkg.com/ml5@1.2.1/dist/ml5.min.js', 'ml5');
    })().catch(error => { dependencyPromise = null; throw error; });
    return dependencyPromise;
  }
  function loadModel() {
    if (!modelPromise) {
      model = ml5.handPose({ runtime: 'tfjs', modelType: 'lite', maxHands: 1, flipped: false });
      modelPromise = model.ready.catch(error => { modelPromise = null; model = null; throw error; });
    }
    return modelPromise;
  }
  function status(message, badge = 'OFF') {
    $('camera-badge').textContent = badge;
    $('camera-badge').classList.toggle('live', badge === 'LIVE');
    $('camera-status').textContent = message;
    $('camera-status').hidden = badge === 'LIVE';
  }
  function clearTracking() { gestures.reset(); }
  function stopCamera(message = 'Camera stopped.') {
    session++; active = false;
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    frameRequest = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    if (camera) { camera.pause(); camera.srcObject = null; camera.remove(); camera = null; }
    inputCanvas = null;
    if (sketch) { sketch.remove(); sketch = null; }
    clearTracking(); $('camera-placeholder').hidden = false;
    $('start-camera').disabled = false; $('stop-camera').disabled = true;
    status(message);
  }
  function mirrorHand(hand) {
    return { ...hand, keypoints: hand.keypoints.map(point => ({ ...point, x: FRAME_WIDTH - point.x, y: point.y })) };
  }
  async function detectFrame(token) {
    if (!active || token !== session) return;
    try {
      if (document.hidden || camera.readyState < 2 || !camera.videoWidth) {
        frameRequest = requestAnimationFrame(() => detectFrame(token)); return;
      }
      inferenceStartedAt = performance.now();
      inputCanvas.getContext('2d').drawImage(camera, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      inferencePending = model.detect(inputCanvas);
      const results = await inferencePending; inferencePending = null;
      if (!active || token !== session) return;
      if (document.hidden) {
        clearTracking(); frameRequest = requestAnimationFrame(() => detectFrame(token)); return;
      }
      const valid = results.filter(hand => Array.isArray(hand.keypoints) && hand.keypoints.length === 21 &&
        hand.keypoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
      if (valid.length) {
        const action = gestures.update(mirrorHand(valid[0]), performance.now(), currentSlide === 5);
        if (action) performGesture(action);
      } else clearTracking();
      status('', 'LIVE');
      frameRequest = requestAnimationFrame(() => detectFrame(token));
    } catch (error) {
      inferencePending = null;
      if (active && token === session) stopCamera('Tracking failed. Start the camera again. ' + error.message);
    }
  }
  function createPreview(token) {
    sketch = new p5(p => {
      p.setup = () => { p.createCanvas(FRAME_WIDTH, FRAME_HEIGHT).parent('camera-view'); p.pixelDensity(1); };
      p.draw = () => {
        p.background(237, 240, 232);
        if (!active || token !== session || !camera || camera.readyState < 2) return;
        p.push(); p.translate(FRAME_WIDTH, 0); p.scale(-1, 1);
        p.drawingContext.drawImage(camera, 0, 0, FRAME_WIDTH, FRAME_HEIGHT); p.pop();
        // Clean camera picture. No keypoint dots, bones, or finger trails.
        if (inferencePending && performance.now() - inferenceStartedAt > 2500) status('Processing camera…', 'LOADING');
      };
    });
    $('camera-placeholder').hidden = true;
  }
  async function startCamera() {
    if (active) return;
    const token = ++session; active = true;
    $('start-camera').disabled = true; $('stop-camera').disabled = false;
    status('Allow camera access to use gestures.', 'STARTING');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open this page at localhost or over HTTPS.');
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
      if (token !== session) { newStream.getTracks().forEach(track => track.stop()); return; }
      stream = newStream;
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (token === session) stopCamera('Camera disconnected. Start it again.'); });
      camera = document.createElement('video'); camera.muted = true; camera.playsInline = true;
      camera.width = FRAME_WIDTH; camera.height = FRAME_HEIGHT;
      camera.setAttribute('aria-hidden', 'true'); camera.style.display = 'none';
      document.body.append(camera); camera.srcObject = stream; await camera.play();
      if (token !== session) return;
      status('Loading gesture controls…', 'LOADING'); await loadDependencies();
      if (token !== session) return;
      createPreview(token); inputCanvas = document.createElement('canvas');
      inputCanvas.width = FRAME_WIDTH; inputCanvas.height = FRAME_HEIGHT;
      await loadModel(); if (token !== session) return;
      if (inferencePending) await inferencePending.catch(() => {});
      if (token !== session) return;
      clearTracking(); status('', 'LIVE'); feedback('Gesture control ready. Two fingers right for next, only index left for previous.');
      detectFrame(token);
    } catch (error) {
      if (token !== session) return;
      const message = error.name === 'NotAllowedError' ? 'Allow camera access in your browser, then retry.' :
        error.name === 'NotFoundError' ? 'No webcam found.' :
        error.name === 'NotReadableError' ? 'Camera is busy. Close other camera apps.' : error.message;
      stopCamera(message);
    }
  }
  $('start-camera').addEventListener('click', startCamera);
  $('stop-camera').addEventListener('click', () => stopCamera());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTracking(); mediaCommand++; video.pause(); }
  });
  window.addEventListener('pagehide', () => { stopCamera(); if (replacementURL) URL.revokeObjectURL(replacementURL); });
})();
