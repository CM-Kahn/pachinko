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
   jackpot fanfare, and a soft mechanical ambience. Sound must work reliably on iPhone
   (iOS requires audio to be unlocked by a first tap — handle this explicitly).
3. **A satisfying launcher.** A chrome handle in the lower right that you pull back by touching
   it (phone/tablet) or dragging it with the mouse (desktop). Pull and let go to flick one ball;
   keep it held back to fire a steady stream at that power. Power is consistent so players can
   learn a "sweet spot".
4. **A machine cabinet, not a web page.** Wood-grain and chrome control panel, red LED
   counters (seven bars plus a decimal point per digit), a framed playfield.
5. **Clear scoring.**
   - **Balls Remaining** — balls the player has to shoot.
   - **Balls Awarded** — total balls won this session.
   - No high score: the owner decided the game is better without one.

## 2. Retro theme (original)

Direction: **1970s Showa-era machine**, after the owner's photo of a machine like the one they
had as a child — honey-coloured wood cabinet, chrome frame, cream playfield printed with faded
mid-century flowers, turquoise and coral accents, a chrome launch handle, and a vintage
"attraction" center display. The general arrangement of a traditional board (round rail, launch
lane up the left, stopper at upper right, tulips, center feature, out hole) is common to all
machines of the era and is fair to follow. Do not copy any maker's name, logo, or artwork, and
avoid any surf/beach/starfish motif (that belongs to the inspiring app).

## 3. Gameplay (traditional style)

- **Playfield:** circular guide rail; ball is launched up the left rail and enters at the top.
  Dense pin fields arranged in curved rows and "gates" that steer balls toward features.
- **Start pocket (center, below the display):** a ball landing here spins the **center display
  reels** (three digital reels in the retro style).
- **Tulips:** flower-shaped catchers that pay a few balls; some open wider after a catch,
  then close. **At least four tulips**; some may be linked (a catch in one opens another).
- **Side pockets:** small, steady payouts by default.
- **Reach & jackpot:** when two reels match, a "reach" animation builds tension; three of a kind
  = **jackpot mode**: the **attacker** (large gate near the bottom) opens for several rounds and
  pays big.
- **Bonus lights:** the strip across the top lights segments as features are hit; completing it
  gives a bonus.
- **Out hole:** balls that miss everything drain at the bottom.
- **Starting balls / refill:** player starts with a stack of balls; if they run out, a free
  "refill" button resets (it's just for fun).
- Payout numbers are tuned to feel generous and lively, not punishing. Include a slider behind a settings button that makes payouts easier or harder than the default.

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
- Launcher: pull-back handle, flick for one ball or hold for a stream; balls decrement
  Balls Remaining. Balls that roll back down the launch lane are returned to the player.
- Tuned ball/pin physics (restitution, friction, ball mass, fixed timestep, CCD).
- First-pass sound so the physics can be tuned by ear: rough pin ticks, launch thunk, and the
  iOS audio unlock, with a sound on/off button.
- Until payouts exist, an empty machine refills itself automatically.
- **Done when:** a stream of balls launches, rattles through pins convincingly, and drains,
  at 60 fps with 50+ balls on screen.

### Phase 3 — Game features
- Pockets, tulips (open/close), start pocket, three-reel center display, reach, jackpot mode with
  the attacker, bonus light strip.
- Balls Awarded, saved progress (localStorage), free refill.
- **Done when:** a full game loop works and jackpots happen at a fun rate.

### Phase 4 — Sound
- Builds on the rough ticks from Phase 2.
- Original sound set (synthesized and/or recorded; must be original or licensed CC0).
- Pin ticks scaled by impact speed, with voice limiting so dense clatter stays pleasant.
- Volume and mute in Settings (the iOS audio unlock is already in place from Phase 2).
- **Done when:** sound works on iPhone, iPad, Mac, and Vision Pro, and it sounds great.

### Phase 5 — Retro art & polish
- Final retro art for cabinet, board, display, tulips, lever; lights and particles; jackpot
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

- Original assets only. Don't copy art, sounds, layouts, or names from any existing game.
- Keep everything free; no ads, purchases, accounts, or tracking.
- Every phase ends with passing tests and a working deploy.
- Commit small, descriptive commits; keep this plan updated if decisions change.
