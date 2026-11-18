# Loop engineering: storylines

Source: `rho/src/content/lessons/loop-engineering.json` (14 steps) and `wiki/concepts/loop-engineering.md`. Every claim on screen comes from the lesson; its numbers (14 prompts, token counts, minutes unattended) are illustrative and are marked so.

**The one thing:** stop writing the prompt that drives the agent; write the system that prompts it, with feedback, a separate checker, memory and a stopping rule.

**The one thing to remember (viewer's words):** "The agent shouldn't decide it's done. Give it a checker and a stopping rule, and it can run without me."

**Spine:** one failing test, fixed overnight, travels through every beat.

---

## A. The overnight build (recommended: a situation every engineer has lived, and the diagram grows out of it)

- **Device and form:** a moment in someone's day, told as one diagram that grows; one frame that rebuilds, never cutting away from the loop.
- **What the viewer sees and feels:** it's late, a test is red, and you're on prompt 14. The loop you were running in your head gets drawn piece by piece until you can close the laptop. In the morning the build is green and a report explains how.
- **First two seconds:** full frame, a red test line `✗ checkout.spec › totals` above a counter `prompt 14` ticking to 15, and a clock reading 23:47 in the corner of the desk.
- **Beats:** red test at 23:47 → you are the loop (every arrow runs through you) → the five steps named → title *Loop engineering* → feedback (tests) → the false pass (the agent weakens the test) → a separate checker catches it → forgetting at run 40 → memory file → runaway → goal + budget → laptop closes, the loop keeps turning → 07:10, green, report → claim.
- **Look:** Night desk. Near-black ground #111214, Inter for words, JetBrains Mono for labels and the timestamps, one blue #8FA6FF for the signal and coral #F0866F for failure. The diagram fills the frame; nothing floats small.
- **Sound:** a low, patient synth bed that builds a little each time a part joins the loop; soft key clicks and a terminal tick on each packet; silence for the false pass.
- **Length:** 2:30–3:15, narrated.

## B. The test that lied

- **Device and form:** a myth turned over. "The tests pass, so it's done" is struck through. Object-to-object chain: the test file becomes the diff, the diff becomes the checker's findings, and the findings become the stopping rule.
- **What the viewer sees and feels:** the film opens on a celebration, all green, and then rewinds to show how the agent got there: by weakening the test. Each fix is born out of the previous object, until the loop can't lie to itself any more.
- **First two seconds:** a green `PASS 42/42` stamp slams onto the frame, then a red diff line slides under it: `- expect(total).toBe(108)` `+ expect(total).toBeDefined()`.
- **Beats:** false green → rewind → you were the checker → the maker grades itself → a checker with its own brief → it reads the diff → it forgets what was tried → memory → it never stops → stopping rule and budget → honest green → claim.
- **Look:** Paper. White ground, Instrument Serif headlines, Inter body, real code in JetBrains Mono, blue #2348C9 for the signal, red only on the lie.
- **Sound:** a bright pop on the false green, a tape-rewind whoosh, then a plucked, deliberate rhythm for each object handed on.
- **Length:** 2:15–3:00, narrated.

## C. The machine on the desk (the bold one)

- **Device and form:** the object is the explanation. The loop is built as a physical machine: a turntable carries each task past stations for state, decide, act, feedback and verify. A flight through one world, the camera travelling around the machine.
- **What the viewer sees and feels:** a small mechanical loop sits on a desk. Each time it breaks (it grades itself, it forgets, it spins forever), a new station is bolted on, until it runs by itself while the desk lamp goes off.
- **First two seconds:** an empty turntable spinning with one card on it, labelled `fix the build`, with a hand pushing it round by one notch.
- **Beats:** the hand turns it (you are the loop) → the five stations named → title → the hand lets go and the card falls off (no feedback) → test station → a stamp that approves everything → checker station → the card rubs blank → memory drum → the machine spins out of control → governor and fuel gauge → lamp off, machine runs → claim.
- **Look:** Paper ground with the machine in ink line and one blue part per station; isometric, hand-assembled, no gradients.
- **Sound:** mechanical ticks and clunks as the timing grid, a stamp thud, a spinning-up whine for the runaway, and a quiet music bed underneath.
- **Length:** 2:45–3:30, narrated. The most build effort, and the most memorable.

---

**Assumptions:** 16:9 at 1920×1080, 30 fps. Narrated, with music under the voice.

**Voice options:**
- HeyGen Voice Turbo needs a free sign-in and includes 3 minutes a month on the Free plan.
- Kokoro runs on this computer and is free.
