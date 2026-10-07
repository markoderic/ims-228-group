# Hand Remote - IMS 228 Group 5

A presentation remote you control with your hand, using your laptop webcam. Built with ml5.js hand tracking and p5.js.

Group: Ana Avramov, Jacob Brztowski, Yongzhen Lu, Marko Deric

## What works right now

This is our first test. It shows a fake slide number and video status so we can see the gestures doing something.

- Swipe your open palm right: next slide
- Swipe your open palm left: previous slide
- Make a fist: pause or play the video

Still to do: circle your finger for volume, real slides, and making the gestures more reliable. Swiping too fast doesn't always register, and the fist is still shaky.

## How to run it

Easiest way:

1. Go to editor.p5js.org and start a new sketch
2. Replace index.html, sketch.js, and style.css with the files from this repo
3. Press Play and allow the camera

On your own computer: open the folder in VS Code and run index.html with the Live Server extension. Opening index.html by double clicking it may not get camera access.

## Files

- index.html: loads p5.js 1.11.3 and ml5.js. Keep p5 on version 1, the code uses preload() which p5 version 2 removed
- sketch.js: the hand tracking and gesture rules
- style.css: basic page style

## Tuning

At the top of sketch.js there are four numbers you can change if a gesture fires too easily or not at all: FIST_RATIO, SWIPE_DISTANCE, SWIPE_TIME, and COOLDOWN. The box in the top left of the screen shows the live fist ratio to help with this.
