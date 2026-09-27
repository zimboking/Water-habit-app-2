# CapySpa

A cozy onsen-themed hydration tracker prototype. Drink water, and your capybara's hot spring fills up.

`CapySpa.jsx` is a single-file React component (Tailwind core classes + `lucide-react`) that drops straight into a Claude React artifact, or any React 18 app with Tailwind.

## Features

- **Spa (Home):** live net-hydration ring, streak, and an animated SVG onsen with four unlock stages
  (towel at 26%, yuzu + rubber duck at 51%, turtle + bamboo spout + golden glow at 76%, confetti at 100%).
  Tap Capy for a squish, hearts and a bliss toast. Quick-add Water / Green Tea / Americano / Custom, each with Undo.
- **Log:** today's drinks with inline edit (type, volume, time) and delete with an Undo toast; an adjustable hydration calculator.
- **Stats:** hourly intake bars by period, weekly trend vs the 2,500 ml target (this week / last week),
  beverage mix, and a mood check-in whose correlation insight is computed from the mock history and stays locked until
  there are 30 days of check-ins (at least 5 above and 5 below 90% hydration).
- **Squad:** three capybara tubs reflecting each person's progress, simulated friend activity,
  and Splash Nudges for friends under 50%.

## Hydration ratios

Tea, coffee and juice default to a ratio of 1.0 (they count like water). This follows the Beverage Hydration Index
(Maughan et al., 2016, *Am J Clin Nutr*) and Killer et al. (2014, *PLoS ONE*), which found these drinks hydrate like water
at everyday intake. Users can adjust any ratio from 0.5 to 1.5 in the Log tab.

## Tuning

Defaults are constants at the top of the file: `DEFAULT_RATIOS`, `GOAL`, `STAGES`, `HISTORY`, `INSIGHT_MIN_DAYS`.
