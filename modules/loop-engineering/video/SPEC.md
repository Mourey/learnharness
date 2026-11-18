# SPEC: Loop engineering, "The overnight build"

GOAL:    the viewer can name the four parts that let an agent run without them (feedback, a separate checker, memory, a stopping rule) and leaves thinking "write the system, not the prompt".
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    108.5 s x 30 = 3255 frames. The voice is the clock: beat starts come from `beats.json`, measured from the Kokoro files (af_heart, speed 0.9). No music: no catalog without a HeyGen sign-in (see Sound).

LOOK:    the medium is a code editor at night, then the same editor in the morning.
         Night (Night desk): ground #111214 with a 64 px editor grid of 1 px lines at #FFFFFF at 3.5%; panels #17181B, 1 px border #2C2E33, radius 10.
         Ink #E8E8E6, muted #9A9CA3. Signal blue #8FA6FF: packets, the active node, the one highlighted word. Coral #F0866F: failure only. Green #7FCF97: passing only.
         Morning (Paper): ground #FFFFFF, ink #16181D, blue #2348C9, green #22603A.
         Type: Inter 700 for labels and titles (title 112 px, -2% tracking; node label 40 px); JetBrains Mono 400/600 for terminal lines (34 px), sublabels (22 px), notes (22 px), the clock and counters. Nothing read is under 22 px.
         No shadow, no grain, no vignette, no glow.

OBJECTS: the terminal (title bar with the session name and the clock, real test output lines);
         the loop: seven nodes, 360 x 170 panels on a 3 x 3 grid (columns x = 360, 960, 1560; rows y = 230, 540, 850), each with a label, a mono sublabel and a mono note line inside the box;
         edges are 2 px lines clipped 14 px off the boxes, two-way pairs 14 px apart, with a 22 px mono label 28 px off the midpoint;
         packets are 14 px squares travelling the edges at a constant speed.

MOTION:  arrivals expo.out 0.5 s with blur 6 → 0 and scale 0.94 → 1; exits power3.in 0.25 s; state changes 0.3 s power2.inOut on border and fill;
         packets linear, 1.1 s per edge; title words blur 6 → 0 in 0.13 s, 0.067 s apart, no translate;
         the colour flood into morning takes 0.4 s, power2.inOut.

SHOTS:   night 0–9.93 s: the terminal fills 78% of the width; lines land with the words that name them; the "prompt" counter rolls to 14 on "fourteen"; the terminal shrinks into the You node.
         loop 9.93–93.79 s: one frame that rebuilds. Each node arrives when the voice names it (tests, checker, progress.md, goal); failures turn coral on the word; the title "Loop engineering" lands over the dimmed loop on b04; the token counter climbs on b10; the clock runs 23:47 → 07:10 on b12 while You fades out and the loop keeps turning.
         morning 93.79–108.5 s: the colour flood to Paper; three result lines land with b13; the claim lands with b14 and holds 3 s.

BANNED:  a dark void with small things floating (the loop fills ≥ 70% of the frame; the grid makes it a surface);
         glow, bloom, particles, gradients, glass;
         everything fading and sliding up (arrivals scale and sharpen in place);
         titles that move after landing; breathing or pulsing loops on nodes;
         decorative corner HUDs (the clock and counter are story objects in the empty grid cell);
         narration repeated word for word on screen.

QA:      2.5 s (red test line), 9.0 s (counter at 14), 14 s (three-node loop with notes), 21 s (title), 37 s (repo coral: test weakened), 46 s (checker findings), 66 s (progress.md read), 69 s (token counter), 77 s (goal + checker green), 83 s (clock, You gone), 97 s (morning lines), 106 s (claim).
