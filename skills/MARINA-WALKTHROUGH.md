# Hubtown Marina — Walkthrough Video

A walkthrough of Hubtown Marina at Nariman Point, about 65 seconds long. It's built from 9 **Wan 3.0 Prime** image-to-video clips (via the Higgsfield API) at 1080p and cut together in an editor.

**Status:** keyframes picked and installed. The prompts below are ready for review. Nothing has been generated yet.

---

## The idea

**"Sunset at the edge of the city."** Nariman Point is the one spot in Mumbai where a building looks straight out at the sun setting over the Arabian Sea. The film follows one evening:

- a golden approach along Marine Drive,
- inside as the sun drops through the atrium, the office floor and the boardroom,
- ending on the roof at blue hour, with the Queen's Necklace lit up.

The light gets lower and warmer in every shot, then turns violet. That colour shift carries the story, with no voiceover.

**Pacing:** every move is slow, stabilised and continuous, like a gimbal or drone in careful hands. There are no whip pans or fast cuts. Luxury reads as patience.

---

## Endpoint and settings

**Provider:** Higgsfield API · **Model:** `alibaba/wan-3.0-prime/image-to-video`
**Script:** `node scripts/gen-video.mjs`. It reads the shots and prompts straight from this file, so edit the prompts here.

| Setting | Value | Why |
|---|---|---|
| `image_url` | the shot's keyframe | Uploaded to Higgsfield's temporary storage on each run |
| `resolution` | `1080p` (test at `720p`) | |
| `duration` | per shot (below) | Integers from 2 to 30 are allowed |
| `aspect_ratio` | `16:9` | Pinned rather than `adaptive`, so all 9 clips cut together cleanly |
| `generate_audio` | `true` | Natural ambience: waves, footsteps, the espresso pour |
| `enable_thinking` | `false` | "Deep Thinking" lets the model rewrite the prompt. These prompts are written deliberately, so we keep them as they are. |
| `end_image_url` | **not used** | Every keyframe is a different space. Interpolating, say, the reception into the lobby would morph walls into each other. Use cuts instead. |

**Keyframes:** `uploads/video/hubtown-marina/frames/01-aerial.jpeg` through `09-terrace.jpeg`, in shot order.

---

## Cost

Higgsfield doesn't publish Wan 3.0 Prime pricing, but it has an **estimate endpoint** that returns the exact USD cost for your account, for a given set of settings, before anything is generated:

```
node scripts/gen-video.mjs --estimate --res 1080p    # all 9 shots, spends nothing
node scripts/gen-video.mjs --estimate --res 720p
```

Every generated clip also logs its cost to `uploads/video/hubtown-marina/clips/manifest.json`.

**Recommended order:**
1. Run the estimate.
2. Generate shot 1 at 720p to test the motion: `node scripts/gen-video.mjs --shots 1 --res 720p`.
3. Generate the rest at 1080p.

Shots run one at a time, so a bad take can be stopped early. Re-running a shot saves a new `-take2`, `-take3` and so on, and never overwrites an earlier take.

**Retention:** Higgsfield deletes outputs 7 days after generation. The script downloads every clip immediately, so nothing is lost.

---

## Shot list

| # | Keyframe | Length | Camera | Light |
|---|---|---|---|---|
| 1 | `01-aerial.jpeg` | 8s | Aerial glide along Marine Drive toward the tower | Golden |
| 2 | `02-exterior.jpeg` | 6s | Low push along the sea wall toward the tower | Sunset |
| 3 | `03-forecourt.jpeg` | 6s | Dolly toward the portal | Late golden |
| 4 | `04-reception.jpeg` | 6s | Slow push over the compass rose | Interior |
| 5 | `05-lobby.jpeg` | 8s | Push down the atrium, gentle tilt up | Sunset |
| 6 | `06-workspace.jpeg` | 7s | Track along the desk row toward the glass | Sunset |
| 7 | `07-boardroom.jpeg` | 8s | Symmetrical push along the table | Sun on the horizon |
| 8 | `08-cafe.jpeg` | 6s | Gentle arc around the bar | Dusk |
| 9 | `09-terrace.jpeg` | 10s | Rising pull-back, Queen's Necklace reveal | Blue hour |

**Total: 65 seconds.** Join the shots with straight cuts, or 12-frame dissolves between interior spaces.

---

## Prompts

Each prompt describes **only motion and sound**, because the keyframe already supplies the look. Every one ends with the same lock line, since video models like to bend straight architecture.

**Shot 1 — Aerial approach** · 8s · `01-aerial.jpeg`
> Slow, smooth aerial drone glide forward along the curve of Marine Drive toward the ivory Art Deco tower, gently descending, golden evening light shimmering across the sea, small waves rolling against the sea wall, traffic moving softly along the promenade road, warm haze over the skyline, sound of distant waves and soft wind, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 2 — The tower at the sea's edge** · 6s · `02-exterior.jpeg`
> Slow, low push forward along the curved sea wall toward the tower, waves crashing against the tetrapods and throwing gold-lit spray, the sun sinking at the horizon, the sky deepening toward violet, a few figures strolling at the tower's base, sound of waves breaking and sea wind, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 3 — Arrival** · 6s · `03-forecourt.jpeg`
> Slow, steady dolly forward across the forecourt toward the tall nickel doors, the doorman opening the rear door of the black sedan, the brass compass rose gliding beneath the camera, long golden shadows across the limestone, sound of soft footsteps and a car door opening, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 4 — Reception** · 6s · `04-reception.jpeg`
> Slow, steady push forward over the brass compass rose toward the limestone reception desk, the receptionist looking up with a small welcoming nod, soft light glowing through the fluted glass, calm and quiet atmosphere, sound of a hushed lobby and a soft footstep echo, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 5 — The atrium** · 8s · `05-lobby.jpeg`
> Slow push forward down the centre of the atrium toward the great window, gently tilting up to reveal the tiered galleries, the lone executive walking across the floor through long beams of sunset light, dust motes glowing in the air, the sun lowering toward the sea, sound of footsteps echoing in a large stone hall, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 6 — Office floor** · 7s · `06-workspace.jpeg`
> Slow tracking shot gliding along the teak desk row toward the glass wall, the open notebook and pen passing in the foreground, professionals working quietly at their desks, the curve of Marine Drive glowing in the sunset beyond the window, sound of a quiet office and soft keyboard taps, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 7 — Boardroom** · 8s · `07-boardroom.jpeg`
> Slow, perfectly symmetrical push forward along the marble boardroom table toward the glass, the sun touching the sea horizon and flaring softly across the table surface, the crystal glass catching light in the foreground, the sky deepening from gold to violet, near silence with a faint hum of the sea, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 8 — Café** · 6s · `08-cafe.jpeg`
> Slow, gentle arc around the curved bar, the barista finishing a steady milk pour into the cup with steam rising, warm globe pendants glowing, the sky over the sea fading to pink and violet as the promenade streetlights glow, sound of an espresso machine and soft café ambience, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

**Shot 9 — Sky deck finale** · 10s · `09-terrace.jpeg`
> Slow rising pull-back over the teak sky deck, revealing the full sweep of the Queen's Necklace curving along Marine Drive with its streetlights glittering, the infinity pool reflecting the violet sky, warm deck lights glowing among the planters, the city settling into blue hour, ending on a wide, still composition, sound of gentle wind and distant city hum, no dialogue, smooth stabilized cinematic motion, the architecture stays rigid and unchanged, straight lines remain straight, no warping, no text.

---

## Continuity issues in the picked frames

These are worth knowing before spending on video. Each can be fixed by regenerating one keyframe in the picker, without touching the prompts.

1. **The tower changes between shots 1 and 2.** In the aerial (Nano Banana) it's a pale stepped tower inside the skyline. In the exterior (Recraft) it's a darker, standalone Deco tower at the end of a pier. Viewers will read them as two different buildings, two cuts apart. The fix is to regenerate one of them so they match, most simply the exterior on Nano Banana.
2. **Shot 4 breaks the light arc.** The reception is bright and neutral, like midday, between a golden forecourt and a sunset atrium. Either accept it (interiors can be artificially lit), or regenerate it with warm low sun from the side.

---

## Production notes

- **Takes:** budget 2–3 takes per shot. The model is least reliable on hands (shots 3 and 8) and long straight lines (shots 5 and 7).
- **Music:** generated audio covers ambience only. In the edit, add a slow, minimal piano-and-strings score under all the shots, and duck each clip's ambience to around −18 dB beneath it.
- **End card:** the HUBTOWN wordmark over shot 9's final held second.
- **Output:** save clips as `uploads/video/hubtown-marina/clips/01.mp4` through `09.mp4`, and the final film as `uploads/video/hubtown-marina/walkthrough-1080p.mp4`.
- **API keys:** `.env` holds `FAL_KEY` (images) and `HF_KEY` (video). It is git-ignored and the dev server won't serve it.

---

## Single 30-second cut — Wan 3.0 Reference-to-Video

The whole walkthrough as **one 30-second clip**, 3–4 seconds per scene. Instead of 9 separate image-to-video clips, the 9 keyframes are passed as **reference images**, in order.

**Model:** `alibaba/wan-3.0/reference-to-video` (Higgsfield) · **Script:** `node scripts/gen-video.mjs --single --res 1080p`

| Setting | Value |
|---|---|
| `image_urls` | `frames/01-aerial.jpeg` … `09-terrace.jpeg`, in order (the model takes up to 10) |
| `duration` | 30 |
| `resolution` | 1080p |
| `aspect_ratio` | 16:9 |
| `generate_audio` | true |
| `prompt_extend` / `enable_thinking` | false (both rewrite the prompt and lose the shot timing) |

Timing: 4+3+3+3+4+3+3+3+4 = 30 seconds. The docs don't say how a prompt should point at an individual reference image, so the `[Image N]` tags follow the upload order.

```text single-30s
A 30-second luxury real-estate walkthrough film of Hubtown Marina, an ivory limestone Art Deco headquarters tower at Nariman Point, Mumbai, told as nine shots across one evening that moves from golden hour to blue hour. Each shot follows its reference image in order: keep the architecture, materials, lighting and composition faithful to that image. Slow, stabilized gimbal and drone moves throughout; the building stays rigid and straight lines stay straight.

0–4s [Image 1]: aerial drone glide along the curve of Marine Drive toward the ivory Art Deco tower, golden light shimmering on the sea.
4–7s [Image 2]: low push along the curved sea wall toward the tower, waves crashing on the tetrapods in gold-lit spray, sun at the horizon.
7–10s [Image 3]: dolly toward the tall nickel Art Deco doors as the doorman opens the black sedan's rear door, brass compass rose on the forecourt.
10–13s [Image 4]: push over the brass compass rose to the limestone reception desk, the receptionist looks up with a small nod.
13–17s [Image 5]: push down the triple-height atrium toward the great window, tilting up the tiered galleries, a lone executive walking through long beams of sunset light.
17–20s [Image 6]: track along the teak desks toward the glass wall, the curve of Marine Drive glowing at sunset.
20–23s [Image 7]: symmetrical push along the marble boardroom table as the sun touches the sea horizon.
23–26s [Image 8]: gentle arc around the curved café bar as the barista pours, the sky over the sea turning pink-violet.
26–30s [Image 9]: rising pull-back over the rooftop sky deck revealing the glittering Queen's Necklace at blue hour, ending on a still wide frame.

Clean straight cuts between shots, calm deliberate pacing, light warming from gold to sunset and settling into violet, photorealistic, cinematic grade. Sound: sea waves, soft footsteps, an espresso machine, a gentle city hum. No dialogue, no text, no logos.
```
