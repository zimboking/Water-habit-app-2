# CapySpa

A cozy onsen-themed hydration tracker prototype. Drink water, and your capybara's hot spring fills up.

`CapySpa.jsx` is a single-file React component (Tailwind core classes + `lucide-react`) that drops straight into a Claude React artifact, or any React 18 app with Tailwind.

## Features

- **Spa (Home):** live net-hydration ring, streak, and an animated SVG onsen with four unlock stages
  (towel at 26%, yuzu + rubber duck at 51%, turtle + bamboo spout + golden glow at 76%, confetti at 100%).
  Tap Capy for a squish, hearts and a bliss toast. Quick-add Water / Green Tea / Espresso / Custom, each with Undo.
- **Log:** today's drinks with inline edit (type, volume, time) and delete with an Undo toast; hydration-ratio legend.
- **Stats:** hourly intake bars by period, weekly trend vs the 2,500 ml target (this week / last week),
  beverage mix, and a mood check-in whose correlation insight is computed from the mock history.
- **Squad:** three capybara tubs reflecting each person's progress, simulated friend activity,
  and Splash Nudges for friends under 50%.

## Tuning

Hydration ratios, goal, stage thresholds and mock data are constants at the top of the file (`BEVERAGES`, `GOAL`, `STAGES`, `HISTORY`).
