# Pachinko — Project Plan

A free, just-for-fun, traditional Japanese-style pachinko game with a **retro** look.
Play-money only: virtual balls, no purchases, no real-money anything.
Runs in the browser on every Apple device (iPhone, iPad, Mac, Vision Pro) and anywhere else,
and can be installed to the Home Screen like an app.

This is an **original game**. It is inspired by the *feel* of classic pachinko machines and an
old favorite iPhone pachinko app, but it must not copy that app's art, sounds, board layout,
characters, names, or theme. All art and sound are made fresh for this project.



---

## 1. What we're aiming for

The things that make a great pachinko game, and that this one must get right:

1. **Physics that feel real.** Small, heavy steel balls that clatter through dense pin fields,
   roll along pin "rails", get caught by tulips, and rattle into pockets. Many balls on screen at once.
   However, fun takes precedence over real.
2. **Exquisite sound.** The single most important "feel" ingredient. Layered ball-on-pin ticks
   (varying pitch/volume by speed), launch thunk, pocket chimes, tulip snaps, payout cascade,
   a fanfare when the tiger opens every tulip, and a soft mechanical ambience. Sound must work reliably on iPhone
   (iOS requires audio to be unlocked by a first tap — handle this explicitly).
3. **A satisfying launcher.** A chrome handle in the lower right that you pull back by touching
   it (phone/tablet) or dragging it with the mouse (desktop), then let go to shoot. **One ball
   per pull, no steady streams** — just like a machine from Japan. How far you pull sets the
   power, and it is consistent so players can learn a "sweet spot".
4. **A machine cabinet, not a web page.** Wood-grain and chrome control panel, red LED
   counters (seven bars plus a decimal point per digit), a framed playfield.
5. **Clear scoring.**
   - **Balls Remaining** — balls the player has to shoot.
   - **Balls Awarded** — total balls won on this device. It is saved and carries over between
     visits rather than resetting each time.
   - No high score: the owner decided the game is better without one.

## 2. Retro theme (original)

Direction: **1970s Showa-era machine**, after the owner's photo of a machine like the one they
had as a child — honey-coloured wood cabinet, chrome frame, cream playfield printed with faded
mid-century flowers, turquoise and coral accents, a chrome launch handle, and a mechanical
centre feature. The machine is **purely mechanical, as machines were before about 1980**: no
reels, no screen and no jackpot gate (the owner tried reels in Phase 3 and decided they do not
belong). The centre feature is a **tiger's face: fun and endearing, not fierce**, an original
drawing. The general arrangement of a traditional board (round rail, launch
lane up the left, stopper at upper right, tulips, center feature, out hole) is common to all
machines of the era and is fair to follow. Do not copy any maker's name, logo, or artwork, and
avoid any surf/beach/starfish motif (that belongs to the inspiring app).

## 3. Gameplay (traditional style)

- **Playfield:** circular guide rail; ball is launched up the left rail and enters at the top.
  Dense pin fields arranged in curved rows and "gates" that steer balls toward features.
- **The tiger (centre):** a round, friendly tiger face with four ways in. A ball in the top of
  his head (between the ears) or in the pocket under his chin **opens all the tulips**; a ball
  in either of his raised paws **opens the two tulips on that side**. When a ball finds him
  his hinged jaw drops open and the lamps behind his cheeks light for a moment.
- **Tulips:** catchers with two rigid petals hinged on visible pivots. A catch flips a tulip
  open or shut; open tulips are much easier to hit. **At least four tulips.**
- **Windmills:** traditional round wheels with raised vanes, free-spinning, set turning by
  the balls. They sit in the upper and middle board, never near the bottom.
- **Ball size:** balls are large enough that a pocket is only a little wider than a ball.
- **Side pockets:** plain cups.
- **Bonus lights:** the strip across the top lights a bulb for each tulip catch; completing it
  gives a bonus.
- **Out hole:** balls that miss everything drain at the bottom.
- **Starting balls / refill:** player starts with a stack of balls; if they run out, a free
  "refill" button resets (it's just for fun).
- Payout numbers are tuned to feel generous and lively, not punishing.
- **Settings button** on the control panel opens a small panel on top of the machine with the
  sound on/off switch and a **luck slider**. Luck is set the way a parlour sets it, by moving
  pins: each tulip and side pocket has a pair of gate pins above it that spread apart for
  Easier and close up for Harder (never tighter than a ball). Saved on the device.
- **Payout** (also in Settings): the player chooses **5, 10 or 25 balls** for every ball that
  lands in a pocket. Every pocket pays the same, and the choice never changes how hard the
  pockets are to hit. At 5 the machine roughly breaks even over a long session; 10 and 25 are
  generous. A full bonus strip pays twice the chosen amount.

## 4. Technology

| Part | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Safe, well-supported |
| Build | Vite | Fast, simple |
| Physics | Rapier (2D, WASM) | Handles many small fast balls without tunneling through pins; repeatable on a given device |
| Rendering | PixiJS | Smooth 60 fps on phones; good for sprites, glow, particles |
| Audio | Web Audio API | Low latency, many overlapping sounds, pitch/volume variation |
| Install | PWA (manifest + service worker) | Home Screen install, full screen, offline |
| Tests | Vitest (logic), Playwright (in-browser smoke + screenshots) | Can be run in the cloud |
| Hosting | GitHub Pages via GitHub Actions | Free; every push updates the link |

**Board layouts are data**, not code: each board is a JSON file listing pins, rails, tulips,
pockets, and features. That makes tuning (and adding new boards later) easy.

**Optional later:** wrap the finished game as a native app for the App Store (needs a Mac with
Xcode — the owner has several). Not needed to play on Apple devices.

## 5. Build phases

Each phase is roughly one build session. After each, the owner plays it at the GitHub Pages link
and gives feedback before the next phase starts.

### Phase 1 — Foundation (built)
- Vite + TypeScript + PixiJS + Rapier skeleton; lint, tests, GitHub Actions deploy to Pages.
- Portrait cabinet layout that scales to any screen (phone, iPad, Mac window, Vision Pro window).
- **Done when:** the link loads on iPhone and Mac and shows an empty cabinet with LED counters.

### Phase 2 — Physics prototype (built)
- Board-from-JSON loader; circular guide rail; pins; out hole.
- Launcher: pull-back handle, one ball per pull; balls decrement
  Balls Remaining. Balls that roll back down the launch lane are returned to the player.
- Tuned ball/pin physics (restitution, friction, ball mass, fixed timestep, CCD).
- First-pass sound so the physics can be tuned by ear: rough pin ticks, launch thunk, and the
  iOS audio unlock.
- Settings button and panel (sound switch, luck slider), saved on the device. The luck slider
  starts to matter in Phase 3, when there are holes to aim for.
- Until payouts exist, an empty machine refills itself automatically.
- **Done when:** balls launch one per pull, rattle through pins convincingly, and drain, and
  the board still runs at 60 fps with 50+ balls on it.

### Phase 3 — Game features (built)
- The tiger centre feature with its four entrances, four tulips, two side pockets and four
  windmills, all placed in the board JSON.
- Bonus light strip: each tulip catch lights a bulb; nine pays a bonus.
- Winnings trickle into the tray and onto Balls Awarded. Out of balls: a free refill card.
- The luck slider moves the gate pins above the tulips and side pockets. Payout choice in
  Settings.
- First-pass sounds for wins and the tiger (the real set is Phase 4).
- Original artwork for the tiger, tulips, paws and windmills.
- **Done when:** a full game loop works and the tiger opens the tulips at a fun rate.

### Phase 4 — Sound
- Builds on the rough ticks from Phase 2.
- Original sound set (synthesized and/or recorded; must be original or licensed CC0).
- Pin ticks scaled by impact speed, with voice limiting so dense clatter stays pleasant.
- Volume and mute in Settings (the iOS audio unlock is already in place from Phase 2).
- **Done when:** sound works on iPhone, iPad, Mac, and Vision Pro, and it sounds great.

### Phase 5 — Retro art & polish
- Final retro art for cabinet, board, tiger, tulips, lever; lights and particles; celebration
  animations. No haptics (not available in iPhone browsers; the owner chose to skip them).
- Settings screen (sound, music, launcher hand).
- **Done when:** it looks and feels like a real, lovingly made machine.

### Phase 6 — Install & share
- PWA install (Home Screen icon, splash, offline), accessibility basics, performance pass on
  older devices, a simple "About" page.
- **Done when:** installs and plays offline on iPhone and iPad; link is ready to share.

### Phase 7 (optional) — Native App Store version
- Wrap with a native shell on a Mac, add App Store assets. Simulated-gambling apps are rated 17+.

## 6. Ground rules for builders

- **Mechanical only.** Nothing happens on the board that a physical machine could not do with
  moving parts and lamps: no floating text, no animated drawings, no screens. Feedback comes
  from parts that move (tulip petals on pivots, the tiger's hinged jaw, windmills), lamps that
  light, the counters, and sound.

- Original assets only. Don't copy art, sounds, layouts, or names from any existing game.
- Keep everything free; no ads, purchases, accounts, or tracking.
- Every phase ends with passing tests and a working deploy.
- Commit small, descriptive commits; keep this plan updated if decisions change.
