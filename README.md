# Hand Remote

Hand Remote is a web page that changes slides when you swipe your hand in front of your laptop camera. We made it for IMS 228 at Miami University (Group 5).

Our first ideas were media controls and a cursor you move by pinching. The class told us those needed a clearer use case. We also looked at controlling a guitar tutorial video, but when you're playing an instrument your hands are busy too. A presenter standing away from the laptop with free hands was a better fit, so the project became a slide remote that can also pause and play a video.

The page has six slides (our project deck, saved as PNG images), buttons under them, and a camera panel on the right.

## Run it

You need Chrome and Python 3. We used a Mac.

1. Download the repo and unzip it.
2. Open Terminal, type `cd ` (with a space after it), drag the project folder into the window, and press Enter.
3. Run `python3 -m http.server 8000 --bind 127.0.0.1`
4. Open http://localhost:8000 in Chrome.
5. Click **Start camera** and allow access.
6. Wait for the label next to "Hand tracking" to turn green and say live. The first time takes longer because the hand model has to download.

Don't double-click `index.html` to open it. The camera code needs the page to come from localhost or https. You also need internet: p5.js and ml5.js are loaded from a CDN when you press Start camera, ml5 downloads the hand model, and the fonts come from Google Fonts (if they can't load, the page uses fonts already on your computer). Press Ctrl+C in Terminal when you want to stop the server.

## Use it

Hold one hand up in front of the camera with your fingers pointing up, and keep your whole hand in the frame. The preview is mirrored, so left and right are the same as on screen. Nothing is drawn over your hand, it's just the camera picture, and that picture stays on your computer because the tracking runs in the browser. **Stop** turns the camera off.

| Gesture | What happens |
| --- | --- |
| Index and middle finger up, swipe right | Next slide |
| Only index finger up, swipe left | Previous slide |
| Fist, held for a moment (slide 6 only) | Pause the video |
| Open hand with all four fingers up, held for about 0.6 s (slide 6 only, after a fist) | Play the video |

Some things that help:

- Keep the other fingers down. A thumb pointing straight up also stops the pose from counting.
- Move your whole hand sideways. Moving just your fingers does nothing, and a swipe that drifts a lot up or down is thrown away.
- A short swipe is enough, about a quarter of the length of your palm. Smooth works better than fast: if your hand jumps a long way between two camera frames, that movement is ignored.
- One swipe changes one slide. To go again, bring your hand back the other way first, then swipe. Slide changes are also at least 0.3 s apart.
- The video gestures only work on slide 6, and changing slides pauses the video.

The buttons, the dots under the slides and the keyboard work too: arrow keys for slides, Space to play or pause the video on slide 6, F for fullscreen, Esc to leave it. Clicking "Hand Remote" at the top goes back to slide 1.

To present, start the camera first, then click **Present fullscreen**. Only the slides stay on screen and the camera keeps running behind them. If the page gets hidden (another tab, a minimized window), tracking is on hold and the video is paused.

## Your own slides and video

The slides are the PNG files in `assets/` (`slides1.png` to `slides6.png`), listed in order in `index.html`. To use your own deck, export it as 16:9 PNGs and replace those files. For more or fewer slides, add or remove the `<article class="slide image-slide">` blocks in `index.html`. The dots, the buttons and the counter follow along, except for the starting `1 / 6` text in `index.html`, which you'd change by hand.

The video is tied to the last slide. In `sketch.js` that's slide `5`, because the code counts from 0, and `style.css` puts the video in the bottom right corner of the slide image. If you change how many slides there are, check that number (it shows up in a few places).

To swap the video, go to slide 6 and click **Replace video**. That only lasts until you reload the page. To change it for good, replace `assets/demo-video.mp4`, and `assets/video-poster.png` too (the picture shown before it plays). MP4 with H.264 video and AAC audio is the safest format.

## How it works

ml5.js (the handPose model, lite version, set to find one hand) finds 21 points on your hand in every camera frame. `gestures.js` uses those points to decide which pose you're making by checking which fingers are straight and raised: index finger, two fingers, fist or open hand. For the two swipe poses it follows the center of your palm and checks that it moved far enough, in a fairly straight line, within about two seconds. When all of that is true it tells `sketch.js`, which changes the slide or pauses or plays the video.

`gestures.js` never touches the page, and it exports itself with `module.exports` when it runs in Node. That means you can test it with made-up keypoints and no camera.

Files:

- `index.html`: the page and the list of slides
- `style.css`: the look
- `sketch.js`: camera, preview, model, and the slide and video actions
- `gestures.js`: pose and swipe detection
- `assets/`: the slide PNGs, `demo-video.mp4` and `video-poster.png`

The `?v=` numbers on the files in `index.html` just stop the browser from using an old cached copy. Raise the number after you edit a file.

## Tuning

If swipes feel too touchy or not touchy enough, change the numbers at the top of `gestures.js`. Distances are in pixels of the 640 by 480 camera image.

- `swipeDistance` (22) and `maxSwipeDistance` (38): the shortest and longest swipe it will ask for. The real distance is `swipeHandDistance` (0.28) times your hand size (wrist to middle knuckle), kept between those two. Bigger numbers mean a longer swipe, which helps if slides change by accident.
- `cooldown` (300): the least time between slide changes, in ms.
- `releaseOnReturn` (`true`): if you set it to `false`, you have to lower your hand or change pose before you can swipe the same way again.
- `fistHold` (260): how long to hold a fist before the video pauses, in ms.
- `releaseHold` (600): how long to hold an open hand before the video plays, in ms.

## Limits

- It tracks one hand at a time.
- It needs decent light, and your hand can't be too far from the camera. If it looks too small, it gets ignored.
- How fast it reacts depends on your laptop. If the label drops from live to loading while you're using it, the model is falling behind.
- We haven't tested it with other presenters yet, so it may feel different with different hands and lighting.

Made by Ana Avramov, Jacob Brztowski, Yongzhen Lu and Marko Deric. Built with [p5.js](https://p5js.org/reference/) 1.11.3 and [ml5.js](https://docs.ml5js.org/) 1.2.1.
