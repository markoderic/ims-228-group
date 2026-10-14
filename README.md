# Hand Remote · IMS 228 Group 5

A five-slide webcam presentation built with p5.js 1.11.3 and ml5.js 1.2.1.

Group: Ana Avramov, Jacob Brztowski, Yongzhen Lu, Marko Deric.

## v8 controls

| Pose and movement | Action |
| --- | --- |
| Only index and middle upright, swipe right | Next slide |
| Only index upright, swipe left | Previous slide |
| Hold a fist on slide 4 | Pause video |
| After a recognized fist, fully open the palm for 0.6 seconds | Play video |

Use one hand with index and middle upright for Next, or only index upright for Previous. Keep the remaining fingers naturally lowered and face the palm toward the camera. Index may have a slightly curled tip and thumb may rest diagonally. Move the whole hand and wrist horizontally. Directions follow the mirrored preview. Both gestures use the same distance, smoothing and sample requirements as the previous-slide sensitivity in v6.

Keep the navigation pose for consecutive pages. A long swipe may change several pages; holding still stops navigation. A return stroke in the wrong direction repositions the hand without changing slides. Switch to the other finger pose to navigate the other direction. Test Previous from slide 2 or later.

## Run or update on Mac

1. Extract the complete project folder.
2. In Terminal, type `cd ` and drag in the folder, then press Enter.
3. Run `python3 -m http.server 8000 --bind 127.0.0.1`.
4. Open <http://localhost:8000> in Chrome.
5. Click **Start camera** and allow access. The first model download needs internet.
6. Click **Present fullscreen** for the slides-only view. Esc returns.

For an existing running copy, replace its files and refresh Chrome with **Command + Shift + R**. The camera hint should read **Index finger ready. Swipe right for next or left for previous.** See `Quick_Start_CN.md` for Chinese steps.

## Navigation and video behavior

Navigation has no pose-hold timer or minimum movement-duration timer. It needs actual horizontal travel, consistent direction and at least two distinct movement updates. Both directions use the same threshold and smoothing. A return stroke reanchors the movement path without navigating.

Small jitter, vertical movement and isolated coordinate jumps cannot navigate. Every action starts a new movement origin. The short inter-page cooldown applies only between actions, while movement keeps being tracked. An action needs fresh movement, so stopping cannot cause queued page changes later. Real response still depends on webcam inference speed.

Video controls apply only on slide 4. A held fist stays paused. Fist-to-index or fist-to-two-finger navigation never requests playback. Three fingers, brief palm transitions, uncertain poses and missing hands cannot resume playback. After a recognized fist, all four main fingers must be fully open continuously for 600 ms to play. Any raw non-full-palm frame resets that timer immediately. If the browser blocks audio playback, click the video Play control once. Changing slides pauses the hidden video.

## Settings

Defaults are at the top of `gestures.js`.

| Setting | Default |
| --- | --- |
| Navigation pose hold | None |
| Minimum navigation movement duration | None |
| Swipe travel, either direction | 22–38 px, scaled to 0.28 palm lengths |
| Distinct actual movement updates | 2 |
| Swipe window | 2200 ms |
| Inter-page cooldown | 220 ms |
| Brief ambiguous-pose grace | 110 ms |
| Fist confirmation | 260 ms |
| Continuous full-open palm to resume | 600 ms |

Try a short horizontal stroke of about one-sixteenth of the camera preview width in either direction. The per-frame jump allowance adapts to slower camera intervals, but one jump followed by holding still cannot navigate.

## Presentation mode and files

Fullscreen targets only the five-slide stage, fitted at 16:9 with black margins when needed. Header, camera panel and outside controls hide while camera inference continues. A browser without native fullscreen uses a slides-only window view. Esc exits either view.

The normal camera preview is a raw mirrored image without dots, skeletons or trails. Numeric debug counters and version labels stay removed. Circular volume gestures and custom volume controls stay removed.

- `index.html`, `style.css`: five browser slides, controls and presentation layout.
- `sketch.js`: webcam snapshots, ml5 inference, raw preview and slide/video actions.
- `gestures.js`: finger classification and movement state.
- `Hand_Remote_Group5.pptx`: editable five-page deck with current gesture instructions and embedded video.
- `assets/demo-video.mp4`: 12-second test clip.
- `tests/`: logic, camera-pipeline simulations and optional browser checks.

Webcam control runs in this webpage. The PPTX supports ordinary playback and does not independently control PowerPoint through the webcam. Choose **Replace video** on slide 4 for a local clip, or replace `assets/demo-video.mp4` with H.264 video and AAC audio in MP4 for distribution.

## Validation

60 tests pass: 43 gesture tests and 17 camera-pipeline DOM simulations. They execute the actual app code with simulated camera/model data. Mirrored 24 px two-finger-right and index-left trajectories trigger on the same sample and time, including 1–10 ms intervals with no forced confirmation wait. Different hand sizes have matching trigger distances too. These are simulated timestamps, not webcam performance measurements. Cases also cover consecutive two-finger and index swipes, direct pose changes and ignored wrong-direction return strokes, natural finger shapes, jitter, vertical motion, a single jump, circle motion and stopped cooldown queues. Video.play() spies confirm that paused-video index or two-finger navigation never resumes playback. Full-open palm held 600 ms, interrupted confirmation, fullscreen and slow inference remain covered.

```bash
node --test tests/gestures.test.js tests/camera-integration.test.js
node --check sketch.js
```

The browser suite was updated but not run because a browser binary is unavailable here. Real-camera tuning still needs your laptop. Optional browser tests need Playwright, Chromium and the HTTP server: `node tests/browser.test.js`.

Official references: [ml5 documentation](https://docs.ml5js.org/), [p5 reference](https://p5js.org/reference/), [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen).
