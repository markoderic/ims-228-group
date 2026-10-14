# Hand Remote

IMS 228 · Group 5

Hand Remote is a presentation remote you control with your hand. It uses your laptop webcam to watch your hand, so you can change slides without touching the keyboard or holding a clicker. It's a five-slide web page built with p5.js and ml5.js (hand tracking).

Group: Ana Avramov, Jacob Brztowski, Yongzhen Lu, Marko Deric

## How to use it

Start the camera, hold up one hand with your palm facing the camera, and keep your whole hand inside the frame. The preview is mirrored, so left and right match what you see on screen.

| Gesture | What happens |
| --- | --- |
| Index and middle finger up, swipe right | Next slide |
| Only index finger up, swipe left | Previous slide |
| Make a fist (slide 4) | Pause the video |
| Open your whole palm and hold for about 0.6 s (slide 4, after pausing) | Play the video |

A few tips:

- Keep the other fingers relaxed and down, and move your whole hand, not just your fingers. A short swipe is enough.
- One swipe changes one slide. To go again, bring your hand back the other way first, then swipe again.
- Slide changes are at least 0.3 seconds apart, so one long swipe won't fly through the whole deck.
- The video gestures only work on slide 4.
- You can also use the buttons or the keyboard: arrow keys for slides, Space to play or pause, F for fullscreen, Esc to leave it.

## Run it

You need Chrome and Python 3. We used a Mac.

1. Download this repo and unzip it.
2. Open Terminal, type `cd ` (with a space), drag the project folder into the window, and press Enter.
3. Run `python3 -m http.server 8000 --bind 127.0.0.1`
4. Open http://localhost:8000 in Chrome.
5. Click **Start camera** and allow access. The first time, it downloads the hand tracking model, so you need internet.
6. Click **Present fullscreen** to show only the slides. Press Esc to exit.

Don't just double-click `index.html`. The camera needs the page to be served from localhost (or https).

Your webcam picture stays on your computer. The hand tracking runs in the browser.

## Files

- `index.html`, `style.css`: the slides and the page layout
- `sketch.js`: camera, hand tracking, and the slide and video actions
- `gestures.js`: works out which finger pose you're making and whether you swiped
- `assets/`: the demo video and its poster image

To use your own video, click **Replace video** on slide 4. Or swap out `assets/demo-video.mp4` (MP4 with H.264 video and AAC audio works best).

## Tuning it

If swipes feel too sensitive or not sensitive enough, change the settings at the top of `gestures.js`.

| Setting | What it does | Now |
| --- | --- | --- |
| `swipeDistance`, `maxSwipeDistance` | How far your hand has to move (pixels). Bigger means a longer swipe. | 22, 38 |
| `cooldown` | Minimum time between slide changes (ms) | 300 |
| `releaseOnReturn` | If `false`, you have to lower your hand or change pose before you can swipe the same way again | `true` |
| `fistHold` | How long to hold a fist to pause (ms) | 260 |
| `releaseHold` | How long to hold an open palm to play (ms) | 600 |

## Limits

- It tracks one hand at a time.
- It works best with good lighting and your hand not too far from the camera.
- How fast it reacts depends on your webcam and computer.
- We haven't done user testing with other presenters yet, so it may feel different with different hands and lighting.

Built with [p5.js](https://p5js.org/reference/) 1.11.3 and [ml5.js](https://docs.ml5js.org/) 1.2.1.
