# CODEX HANDOFF — Pocket Kitten

## Start here

Continue this existing app. Preserve the supplied cat at `dist/assets/kitten.glb` and working care features. Run `npm run dev`, inspect desktop/mobile browser previews, and run `npm run check`. All runtime dependencies are local; no installation or build is required.

## User goal

A Tamagotchi-like cat using this model, with viewable previews. The user wants a cute, happy expression and convincing fluid movement, including stretching, rolling, pouncing and kneading. Earlier broader Pocket Kitten goals included playing inside a brown paper bag, occasional attempts to climb out, naming, snacks, breed choices and pleasant playful meows.

This export contains the **new companion app** built October 5, 2026. The earlier separate paper-bag project and reference videos are not included or merged. Do not claim those assets are present or those goals complete.

## Implemented

- Original textured/skinned Meshy model through GLTFLoader.
- Cozy Three.js room: rug, window, cushion, bowl, decorative paper bag and toy.
- Responsive cream/sage/terracotta UI with daytime/nighttime lighting.
- Name (default Mochi), mood, day count, bond, cuddle count and journal.
- Food, happiness, energy and cleanliness meters.
- Kibble, salmon or chicken feeding; brush; pet by tapping the model.
- 15-second pointer/touch toy-follow interaction; rest/wake toggle.
- localStorage persistence and capped offline progression; optional synthesized sound.
- Accessible controls and reduced-motion support.

## October 7 update, part 2 — cozy study room, fountain and Water need

Orion supplied five design references (a daytime room, an evening room, a plaid bed, an ivory bowl and an olive fountain). They were used only as style guides. `dist/room.js` builds the room in 3D, and all its textures (oak planks, plaid, leather, sherpa, linen, plaster, jute, botanical print, sky, ivy leaf) are drawn on canvases in code, so no reference pixels are shipped.

- **Layout:** follows the daytime reference. The window and bed are back-left, the club chair and side table with lamp back-right, the botanical print on the back wall, the bookcase on the right wall, and the food bowl and fountain front-right off the rug. The centre of the rug stays open for play. The wide camera now sits low, near Mochi's eye level, like the reference photos.
- **Evening:** when Mochi sleeps, the window turns night-blue, the lamp glows strongly, the reflections switch to a warm dark version, a warm front fill keeps Mochi readable, and the page theme turns warm espresso instead of navy.
- **Water need** (`pet-state.js`, `water`): drops 3.5 per hour awake and 1.5 asleep. `drink` adds 35 and declines above 94. Saves without `water` restore to 85. The mood "A little thirsty" shows below 25.
  - Mochi drinks on her own when water is below 60, as one of her idle choices. Tapping the fountain invites a drink.
  - While drinking she crouches at the fountain lapping with her tongue, the ripples grow, and she grooms afterwards.
  - With sound on, there's a soft synthesized trickle.
- When she has low energy she sometimes naps in her bed. Sleep happens in the bed.
- Walk timeouts now scale with distance, so slow devices don't cut walks short.

## October 7 update — realistic ragdoll Mochi

The user switched to a ragdoll cat (seal-point face mask, white blaze, blue eyes) so the character isn't mistaken for Grumpy Cat. The model is `dist/assets/mochi-ragdoll.glb`: a static Meshy free-plan model (one mesh, about 40k vertices, three 2048² JPEG textures). Free-plan output is CC BY 4.0, so the footer credits Meshy. Check Meshy's current terms before a commercial launch.

- **Rigging at load time** (`cat-rig.js`): a 28-bone skeleton (hips, spine, chest, neck, head, jaw, two ears, three joints per leg, an eight-bone tail) is placed from landmarks measured on this exact model.
  - Skin weights use inverse distance to each bone segment, with region gates (the tail is found by distance plus its dark fur colour; legs by their columns; jaw and ears by region), then four rounds of smoothing across welded UV seams.
  - The tail is weighted only along its own chain, so where it curls back on itself it doesn't split apart.
  - Weighting takes about 0.6–0.9 s in software rendering.
- **Rest fixes:** the model stands curved, with its left hind leg stepped out and its tail wrapped along its haunch. At runtime the legs are aimed under the body, the head is levelled, and the tail is posed along a curve.
- **Fur:** an instanced SkinnedMesh draws 11 shells (7 on touch devices) in one draw call. Each shell takes its colour from the model's texture, and fur length is set per vertex (long ruff and tail, short face and paws, none on eyes, nose, mouth or whiskers).
- **Face:** realistic eyes are painted in the skin shader in bind space: pale-blue iris fibres, a slit-to-round pupil, gaze, a catchlight, and upper and lower lids coloured from the fur around each eye. A jaw bone with a painted mouth interior and tongue handles meows, yawns and grooming, and ear bones twitch and flatten.
- **Ground contact:** the lowest of about 22 contact points sits on the floor each frame, so sitting, loafing and rolling over land naturally.
- `RealCat` has the same interface as the earlier cartoon cat, so app.js behaviours carry over.

Limits: the motion is still procedural, not hand-animated. Large poses (sit, belly-up) stretch the fur texture somewhat at the hips and shoulders. Performance is not yet profiled on real phones (about 545k triangles including the shadow pass on mobile).

## October 6 update, part 3 — seal-point coat from a reference photo

The user asked for realistic fur rather than an animated look, with a seal-point / "snowshoe" cat photo as the colour reference. The photo was used only as a visual guide; none of its pixels are in the app. Changes:

- **Coat:** white base with chocolate points: a dark mask around the eyes, crown, sides of the head and ears, a white inverted-V blaze from the nose up between the eyes, a white muzzle with a smoky chin, a white chest ruff and belly, a taupe-brown back and haunches, and a dark plumed tail. The legs fade to white "snowshoe" paws with pink pads, and the nose is pink.
- **Fur realism:** strands are combed in the direction the coat lies (back and down on the body, down on the legs, toward the tip on the tail). Each strand varies a little in colour and brightness, the roots are darker, and low-frequency mottling breaks up flat areas. The fur is denser, with up to 16 shells.
- **Eyes:** pale blue irises, slightly smaller. As the eyes close, the head fur grows in over them, so a shut eye shows only as a soft line in the fur. Bare spots for the eyes now use angles instead of cosines, so their size is accurate.

## October 6 update, part 2 — realism back in

Feedback on the cartoon kitten: "very cute, on the right track, but keep the realism of the original cat." The kitten keeps its articulated body and behaviours, and gains:

- **Fur:** shell-textured fur on every body part (`dist/fur.js`). Each part is one InstancedMesh drawn 6–14 times along its normals; the shader keeps only the strand pixels. The coat is a long Persian ruff, cheeks and plumed tail, short on the face and paws. The cream/ginger colouring follows the original model: a ginger cap and forehead stripes, a warm mask around the eyes, and a ginger saddle and tail bands.
- **Eyes:** realistic copper irises with striations and a limbal ring, a pupil that narrows to a slit or dilates, and clear-coat gloss. The upper and lower eyelids are drawn by the eye shader on the eyeball, so blinks, the sleepy half-lid, the smile-squint and closed sleeping eyes follow the eye's curve.
- Nose leather with nostrils, fangs when meowing, four whiskers per side plus brow whiskers, ear tufts. The cartoon heart eyes and blush were removed.

Load: about 144 draw calls and 330k triangles, including the shadow pass. This hasn't been profiled on a phone yet.

## October 6 update — new cartoon kitten

User feedback on the Meshy model with a shader-painted face: it looked "freaky, not cute", didn't visibly emote, and read as "a round toy" with no body. The app now uses a hand-built, stylised kitten (`dist/cute-cat.js`) made from simple Three.js shapes, so every part can move:

- **Body:** pelvis → spine → chest → neck → head joints; two-segment front and back legs with paws and pink toe beans; a 10-joint striped tail.
- **Poses:** sit, stand (with a walk/run cycle), loaf, sleep (curled), crouch, leap, stretch, belly-up and beg, eased between with damping.
- **Face:** big glossy eyes with highlights and gaze, blink/squint, closed "^^" and "‿" eyes, heart eyes, ":3" mouth, open mouth, tongue, blush, whiskers, springy ears.

`app.js` drives behaviours on top: walking around the rug, going to the bowl to eat and then grooming, chasing the toy and doing a wiggle-and-pounce, rolling onto its back after a few cuddles in a row, loafing while brushed, stretching and yawning, zoomies, begging at the bowl when hungry, and walking to the cushion to sleep. The camera follows the kitten, and dragging the room orbits it.

The original GLB stays in `dist/assets/` for reference but is no longer loaded, so the page no longer has a 24 MB download.

## October 5 update — expressive face & modern UI (superseded for the cat itself)

The cat now emotes. Because the GLB has no blend shapes and its face is skinned almost entirely to `Bone_010` (chest), the rig alone cannot move the face. `dist/kitten-face.js` patches the kitten's `MeshStandardMaterial` instead:

- **Vertex stage (before skinning):** head yaw/pitch/roll around a neck pivot and independent left/right ear rotations, using smooth falloff weights in bind space. A matching `customDepthMaterial` keeps shadows in sync.
- **Fragment stage:** procedural eyes drawn over the painted ones (amber iris, dilating pupils, gaze offset, sparkle highlights, upper/lower lids, lash lines), lids tinted from fur colours sampled around each eye at load time, plus an open mouth with tongue, a ":3" smile line and cheek blush. Everything is positioned in bind space, so it stays attached through deformation.
- Landmarks (eye centres/radii, mouth, head and ear pivots) were measured on this exact GLB. Re-measure them if the model changes.

Expression presets: content, joy, excited, yum, bliss, curious, sleepy, asleep, hungry, lonely, grumpy, surprised. `app.js` eases between them and layers on blinks (with occasional double and slow "I love you" blinks), gaze tracking of the pointer/toy/bowl/camera, ear twitches, yawns, meow mouth sync, chewing, kneading, hops, a sleeping posture, wake-up yawn and a wiggle-and-pounce sequence while playing.

UI: the room is now the hero with a glass HUD (name, mood, close-up and turn buttons), a floating action dock (Feed, Play, Cuddle, Brush, Rest/Wake), ring meters with +/- delta chips, friendship levels derived from `bond`, a journal and care guide, animated day/night themes and a phone layout. Stroking the cat with the pointer pets it. Petting hits cheap proxy colliders instead of raycasting the 600k-triangle mesh. Synthesized meows and purrs use simple formant and noise synthesis. They are still not recorded audio.

Save format is unchanged (`pocket-kitten-companion-v1`). New journal entries store SVG icon ids, and old unicode icons are mapped on render.

Still procedural: expressions and body motion are code-driven, not authored animation clips. Desktop and phone screenshots were checked in headless Chromium (SwiftShader). Real-device performance has not been profiled.

## Critical limitations (original export)

1. **No professionally authored animation is present.** The supplied asset contains zero animation clips. Current behavior is small procedural bone rotations, slight breathing scale and limited motion. Rest changes lighting/state and nods the head; it does not produce a proper lying-down pose. Feeding is a nod, not realistic eating. Play is basic toy following, not a convincing chase/pounce system.
2. **No browser visual QA or screenshots were completed in this session.** Verify GLB loading, model pose/orientation, lighting, touch, mobile layout and WebGL performance. Successful publication and logic checks do not prove visual quality.
3. The bag is decorative; no inside-bag camera, entry or exit. Only one cat model; no breed selector.
4. Sound is an oscillator approximation, not natural recorded kitten audio.
5. Saves are per browser/origin, with no cross-device backend. This is a web app, not a native mobile app. No PWA install flow, service worker or offline asset caching yet.
6. The GLB is about 23.9 MB. Profile mobile performance before optimizing; keep the original and visually compare any optimized derivative.
7. Reduced motion disables some visual behavior; verify play remains understandable and usable.

## Model facts

`dist/assets/kitten.glb` is byte-for-byte the user's `Meshy_AI_Character_output 2.glb`:

- glTF 2.0 GLB, 23,909,624 bytes.
- One mesh, one skin, 22 joints, three embedded PNG textures.
- Zero animation clips, no required compression extension.
- Generic joint names `Bone_000`–`Bone_021`.
- App applies small motions to `Bone_013` (apparent head) and `Bone_017`/`Bone_021` (apparent front legs). Verify anatomical roles/local axes in a 3D editor before extending animation.
- Source bounds about x [-0.803, 0.800], y [0, 1.700], z [-1.137, 1.135]. The app centers and scales height to 1.75 scene units.
- Three.js license: `dist/vendor/LICENSE.txt`. No separate model license document was supplied; do not invent commercial redistribution permissions.

## Next priorities

1. Run and inspect this actual app; capture honest daytime/nighttime desktop and phone screenshots.
2. Inspect the mesh, rig, skin weights and expression in Blender or another 3D editor. Repair rig/weights if necessary.
3. Create or obtain properly authored idle, stretch, knead, pounce, eat, groom, lie-down, sleep and wake animation clips. Avoid presenting procedural wobble as realistic authored animation.
4. Integrate AnimationMixer with crossfades, interrupt rules, correct ground contact, and animation state independent of care state. Check deformation closely.
5. Improve toy-follow/chase on touch; keep expression relaxed and cheerful.
6. Add suitable licensed kitten audio; then consider real bag interactions, performance and installable PWA support as separate steps.
7. Clearly identify missing animation assets or reference videos if needed. Do not silently substitute unrelated models.

## Architecture and state

Buildless HTML/CSS/ES modules; `dist/` is the static deploy root. `app.js` owns scene, GLB loading, input, UI, frame loop and audio. `pet-state.js` provides pure helpers (`fresh`, `restore`, `advance`, `care`, `mood`).

Save key: `pocket-kitten-companion-v1`. Need changes are capped at 12 elapsed hours per advance. Sleep restores energy at 25 points/hour; awake drains 2.5/hour. Meters clamp to 0–100; pets do not die. Malformed saves are repaired. Preserve saves or migrate explicitly.

## Checks passed

- `dist/app.js` syntax.
- Full tummy rejects food; low energy rejects play; sleep blocks care until wake.
- Sleep/offline rates, long-absence cap, clamping, malformed/future saved state.
- GLB header/length, mesh/skin/textures and required local runtime assets.
- Exported model matches original bytes.

These checks are not visual QA.

## Hosting continuity

Live URL: https://pocket-kitten-companion.elbrilliant4.chatgpt.site

Project: `appgprj_6ac3ebb301e88191ac7057b0631f90a1`
Deployed source commit: `fb0e3501ac40a062696533a442e7fd5619ece42f`
Deployment: `appgdep_6ac3ed463f608191b6d887c2c1a41bb1`
Saved version: `appgprj_6ac3ebb301e88191ac7057b0631f90a1~appgver_e722339141f881918cf2317f6d31c286`

Owner-private publication succeeded October 5, 2026. `.openai/hosting.json` retains identity. With Sites tools, open/select this existing Site and obtain a fresh source write credential through the supported workflow; do not create another Site for an update or change sharing without instruction. No credentials or tokens are included.

This is a standalone source export, not a Git clone. It adds handoff docs, source metadata, a portable server and package scripts to the deployed snapshot. These helper additions have not been redeployed. Initialize a repo or copy into the intended existing checkout when continuing elsewhere.
