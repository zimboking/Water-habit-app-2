import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Droplets,
  Coffee,
  Flame,
  BarChart3,
  Users,
  Plus,
  Minus,
  Trash2,
  Edit3,
  Undo,
  Sparkles,
  Smile,
  BatteryCharging,
  Heart,
  ChevronRight,
  Check,
  X,
  Info,
  Waves,
  Leaf,
  Clock,
  Send,
  TrendingUp,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const GOAL = 2500;
const PRIOR_STREAK = 6; // consecutive completed days before today that hit the goal

// Net hydration ratios live in one place so they can be tuned without touching UI code.
const BEVERAGES = {
  water: { label: 'Water', category: 'Water', emoji: '💧', ratio: 1, color: '#0284c7', tint: '#e0f2fe', note: 'Baseline. Every ml counts in full.' },
  tea: { label: 'Green Tea', category: 'Tea', emoji: '🍵', ratio: 0.95, color: '#059669', tint: '#d1fae5', note: 'Mild caffeine, small deduction.' },
  coffee: { label: 'Espresso', category: 'Coffee', emoji: '☕', ratio: 0.8, color: '#92400e', tint: '#fef3c7', note: 'Higher caffeine, larger deduction.' },
  juice: { label: 'Juice', category: 'Juice', emoji: '🧃', ratio: 0.9, color: '#ca8a04', tint: '#fef9c3', note: 'Sugar content, small deduction.' },
};
const TYPE_ORDER = ['water', 'tea', 'coffee', 'juice'];

const QUICK_ADDS = [
  { type: 'water', volume: 250, label: 'Water', emoji: '💧', ring: 'border-sky-200 hover:bg-sky-50' },
  { type: 'tea', volume: 300, label: 'Green Tea', emoji: '🍵', ring: 'border-emerald-200 hover:bg-emerald-50' },
  { type: 'coffee', volume: 200, label: 'Espresso', emoji: '☕', ring: 'border-amber-200 hover:bg-amber-50' },
];

const STAGES = [
  { at: 0, name: 'Shallow Soak', emoji: '♨️', unlock: 'calm capy and soft steam' },
  { at: 26, name: 'Towel Time', emoji: '🧺', unlock: 'a folded towel for Capy' },
  { at: 51, name: 'Yuzu Float', emoji: '🍋', unlock: 'yuzu floats and a rubber duck' },
  { at: 76, name: 'Golden Zen', emoji: '🐢', unlock: 'turtle buddy and bamboo spout' },
];

const MOODS = {
  energy: { label: 'High Energy', emoji: '⚡', score: 4 },
  focused: { label: 'Focused', emoji: '😊', score: 3 },
  tired: { label: 'Tired', emoji: '😴', score: 2 },
  headachy: { label: 'Headachy', emoji: '🤕', score: 1 },
};
const MOOD_ORDER = ['energy', 'focused', 'tired', 'headachy'];

// 13 completed days, oldest first (day -13 .. day -1). Net ml + the mood check-in for that day.
const HISTORY = [
  { total: 2150, mood: 'focused' },
  { total: 1900, mood: 'headachy' },
  { total: 2600, mood: 'focused' },
  { total: 1750, mood: 'tired' },
  { total: 2300, mood: 'focused' },
  { total: 2700, mood: 'energy' },
  { total: 2050, mood: 'focused' },
  { total: 2620, mood: 'focused' },
  { total: 2810, mood: 'energy' },
  { total: 2540, mood: 'focused' },
  { total: 3050, mood: 'energy' },
  { total: 2700, mood: 'focused' },
  { total: 2580, mood: 'tired' },
];

const PERIODS = {
  morning: { label: 'Morning', range: '5a to 12p', color: '#d97706' },
  afternoon: { label: 'Afternoon', range: '12p to 5p', color: '#0284c7' },
  evening: { label: 'Evening', range: '5p to 5a', color: '#7c3aed' },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const netOf = (log) => Math.round(log.volume * BEVERAGES[log.type].ratio);
const pctOf = (total, goal) => Math.floor((total * 100) / goal);
const stageFor = (pct) => (pct >= 76 ? 3 : pct >= 51 ? 2 : pct >= 26 ? 1 : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const timeLabel = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const hourLabel = (h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);
const periodOf = (h) => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening');
const toHHMM = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const todayAt = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
// Logs can't live in the future: a clock time later than now means "yesterday evening".
const tsFromHHMM = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ts = todayAt(h || 0, m || 0);
  return ts > Date.now() + 60000 ? ts - 86400000 : ts;
};
const daysAgo = (n) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const ago = (ts, now) => {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

let seq = 0;
const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

// Mock sips are placed relative to "now" so the demo reads naturally at any hour.
const MOCK_SIPS = [
  ['water', 400, 480],
  ['coffee', 200, 405],
  ['water', 250, 320],
  ['tea', 300, 230],
  ['water', 500, 140],
  ['juice', 250, 45],
];
const makeInitialLogs = () => {
  const now = Date.now();
  return MOCK_SIPS.map(([type, volume, minsAgo], i) => ({ id: `log-${i + 1}`, type, volume, ts: now - minsAgo * 60000 }));
};

const makeInitialFriends = () => [
  { id: 'sora', name: 'Sora', total: 840, goal: 2200, lastType: 'tea', lastTs: Date.now() - 48 * 60000 },
  { id: 'kenji', name: 'Kenji', total: 2130, goal: 2600, lastType: 'water', lastTs: Date.now() - 6 * 60000 },
];

const makeInitialFeed = () => [
  { id: 'f-1', text: 'Kenji unlocked the turtle buddy 🐢', ts: Date.now() - 6 * 60000 },
  { id: 'f-2', text: 'Sora logged 300 ml Green Tea 🍵', ts: Date.now() - 48 * 60000 },
  { id: 'f-3', text: 'You unlocked yuzu floats 🍋', ts: Date.now() - 95 * 60000 },
];

/* ------------------------------------------------------------------ */
/* Animations (plain CSS, no Tailwind compiler needed)                 */
/* ------------------------------------------------------------------ */

const STYLES = `
@keyframes cs-steam { 0% { transform: translateY(0) scaleX(1); opacity: 0 } 25% { opacity: .85 } 100% { transform: translateY(-46px) scaleX(1.7); opacity: 0 } }
.cs-steam { transform-box: fill-box; transform-origin: 50% 100%; animation: cs-steam 3.6s ease-out infinite; }
@keyframes cs-bob { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-3px) rotate(4deg) } }
.cs-bob { transform-box: fill-box; transform-origin: 50% 50%; animation: cs-bob 2.8s ease-in-out infinite; }
@keyframes cs-wave { from { transform: translateX(0) } to { transform: translateX(-40px) } }
.cs-wave { animation: cs-wave 3.2s linear infinite; }
@keyframes cs-breathe { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.012,.99) } }
.cs-breathe { transform-box: fill-box; transform-origin: 50% 100%; animation: cs-breathe 4s ease-in-out infinite; }
@keyframes cs-squish { 0% { transform: scale(1,1) } 25% { transform: scale(1.14,.84) } 55% { transform: scale(.94,1.08) } 80% { transform: scale(1.03,.97) } 100% { transform: scale(1,1) } }
.cs-squish { transform-box: fill-box; transform-origin: 50% 100%; animation: cs-squish .65s ease-out; }
@keyframes cs-heart { 0% { transform: translate(-50%,0) scale(.4); opacity: 0 } 15% { transform: translate(-50%,-10px) scale(1.15); opacity: 1 } 100% { transform: translate(calc(-50% + var(--dx)),-110px) scale(.9); opacity: 0 } }
.cs-heart { animation: cs-heart 1.4s ease-out forwards; }
@keyframes cs-pour { to { stroke-dashoffset: -28 } }
.cs-pour { animation: cs-pour .45s linear infinite; }
@keyframes cs-ripple { 0% { transform: scale(.3); opacity: .9 } 100% { transform: scale(1.7); opacity: 0 } }
.cs-ripple { transform-box: fill-box; transform-origin: 50% 50%; animation: cs-ripple 1.2s ease-out infinite; }
@keyframes cs-glow { 0%,100% { opacity: .55 } 50% { opacity: .95 } }
.cs-glow { animation: cs-glow 3s ease-in-out infinite; }
@keyframes cs-twinkle { 0%,100% { opacity: .15; transform: scale(.6) } 50% { opacity: 1; transform: scale(1.1) } }
.cs-twinkle { transform-box: fill-box; transform-origin: 50% 50%; animation: cs-twinkle 2.2s ease-in-out infinite; }
@keyframes cs-turtle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
.cs-turtle { transform-box: fill-box; transform-origin: 50% 100%; animation: cs-turtle 2.4s ease-in-out infinite; }
@keyframes cs-confetti { 0% { transform: translate3d(0,-20px,0) rotate(0deg); opacity: 1 } 100% { transform: translate3d(var(--dx),105vh,0) rotate(var(--rot)); opacity: .9 } }
.cs-confetti { animation-name: cs-confetti; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards; }
@keyframes cs-splash { 0% { transform: translate(0,0) scale(.5); opacity: 1 } 100% { transform: translate(var(--dx),var(--dy)) scale(1); opacity: 0 } }
.cs-splash { transform-box: fill-box; transform-origin: 50% 50%; animation: cs-splash .9s ease-out forwards; }
@keyframes cs-rise { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }
.cs-rise { animation: cs-rise .28s ease-out; }
@keyframes cs-sheet { from { transform: translateY(100%) } to { transform: none } }
.cs-sheet { animation: cs-sheet .3s cubic-bezier(.2,.9,.3,1); }
@keyframes cs-fade { from { opacity: 0 } to { opacity: 1 } }
.cs-fade { animation: cs-fade .2s ease-out; }
@keyframes cs-timer { from { transform: scaleX(1) } to { transform: scaleX(0) } }
.cs-timer { transform-origin: 0 50%; animation-name: cs-timer; animation-timing-function: linear; animation-fill-mode: forwards; }
@keyframes cs-pop { 0% { transform: scale(1) } 40% { transform: scale(1.12) } 100% { transform: scale(1) } }
.cs-pop { animation: cs-pop .45s ease-out; }
.cs-noscroll::-webkit-scrollbar { display: none; }
.cs-noscroll { scrollbar-width: none; }
@media (prefers-reduced-motion: reduce) {
  .cs-steam, .cs-bob, .cs-wave, .cs-breathe, .cs-pour, .cs-ripple, .cs-glow, .cs-twinkle, .cs-turtle { animation: none !important; }
}
`;

/* ------------------------------------------------------------------ */
/* Onsen scene (SVG)                                                   */
/* ------------------------------------------------------------------ */

const RIM = { cx: 160, cy: 172, rx: 146, ry: 52 };
const STONE_FILLS = ['#a8a29e', '#d6d3d1', '#78716c'];
const makeStones = (from, to, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (n - 1);
    return {
      x: RIM.cx + RIM.rx * Math.cos(a),
      y: RIM.cy + RIM.ry * Math.sin(a),
      rx: 15 + ((i * 5) % 6),
      ry: 10 + ((i * 3) % 4),
      fill: STONE_FILLS[i % 3],
    };
  });
const BACK_STONES = makeStones(Math.PI, 2 * Math.PI, 12);
const FRONT_STONES = makeStones(0, Math.PI, 13);
const FENCE_POLES = Array.from({ length: 21 }, (_, i) => i * 16);
const WAVE_PATH = (() => {
  let d = 'M -40 0';
  for (let i = 0; i < 24; i++) d += ` q 10 ${i % 2 === 0 ? -3.5 : 3.5} 20 0`;
  return `${d} V 120 H -40 Z`;
})();
const STEAM_X = [78, 232, 112, 262, 198, 56, 150];
const SPLASH_DROPS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { dx: Math.cos(a) * 60, dy: Math.sin(a) * 42 - 18, r: 4 + (i % 3) };
});

function OnsenScene({ pct, id, compact = false, onTap, squish = false, splashKey = 0 }) {
  const stage = stageFor(pct);
  const level = clamp(pct, 0, 100);
  const waterY = 198 - level * 0.48; // 198 (shallow) to 150 (neck deep)
  const ref = (s) => `${id}-${s}`;
  const bodyHalf = (y) => {
    const t = (y - 166) / 46;
    return Math.abs(t) >= 1 ? 0 : 58 * Math.sqrt(1 - t * t);
  };
  const rippleRx = bodyHalf(waterY) + 7;
  const steamCount = compact ? 2 + stage : 3 + stage;
  const smoothY = { transition: 'transform 1s cubic-bezier(.3,1.2,.5,1)' };

  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto block select-none" role="img" aria-label={`Capybara onsen at ${pct}% of goal`}>
      <defs>
        <linearGradient id={ref('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfe8d8" />
          <stop offset="100%" stopColor="#eef6ee" />
        </linearGradient>
        <linearGradient id={ref('gold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fef9c3" />
        </linearGradient>
        <radialGradient id={ref('glow')}>
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#facc15" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref('water')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
        </linearGradient>
        <clipPath id={ref('basin')}>
          <ellipse cx="160" cy="174" rx="132" ry="44" />
        </clipPath>
      </defs>

      {/* Backdrop */}
      <rect width="320" height="240" fill={`url(#${ref('sky')})`} />
      <rect width="320" height="240" fill={`url(#${ref('gold')})`} style={{ opacity: stage === 3 ? 0.85 : 0, transition: 'opacity 1s' }} />
      <path d="M0 120 L40 86 L78 108 L122 66 L170 102 L214 74 L262 100 L300 82 L320 94 V240 H0 Z" fill="#b7d8c3" />
      <g>
        {FENCE_POLES.map((x) => (
          <rect key={x} x={x + 2} y="92" width="12" height="60" rx="6" fill="#e5c890" stroke="#c9a66b" strokeWidth="1" />
        ))}
        <rect x="0" y="104" width="320" height="5" fill="#b08850" />
        <rect x="0" y="134" width="320" height="5" fill="#b08850" />
      </g>

      {/* Golden glow */}
      {stage === 3 && <circle className="cs-glow" cx="160" cy="118" r="128" fill={`url(#${ref('glow')})`} />}

      {/* Stone rim and dry basin */}
      <ellipse cx={RIM.cx} cy={RIM.cy} rx={RIM.rx + 6} ry={RIM.ry + 4} fill="#78716c" />
      <ellipse cx="160" cy="174" rx="132" ry="44" fill="#57534e" />
      {BACK_STONES.map((s, i) => (
        <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={s.fill} stroke="#57534e" strokeWidth="1.5" />
      ))}

      {/* Bamboo spout (always present, flows at Golden Zen) */}
      <rect x="296" y="96" width="10" height="70" rx="3" fill="#a16207" />
      <g>
        <rect x="256" y="82" width="84" height="15" rx="7.5" fill="#84cc16" stroke="#4d7c0f" strokeWidth="1.5" />
        <line x1="282" y1="82" x2="282" y2="97" stroke="#4d7c0f" strokeWidth="2" />
        <line x1="310" y1="82" x2="310" y2="97" stroke="#4d7c0f" strokeWidth="2" />
        <ellipse cx="257" cy="89.5" rx="4" ry="7" fill="#365314" />
      </g>
      {stage === 3 && (
        <path className="cs-pour" d="M255 92 Q244 98 243 116 L243 214" fill="none" stroke="#e0f2fe" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 4" />
      )}

      {/* Capybara */}
      <g
        onClick={onTap}
        style={{ cursor: onTap ? 'pointer' : 'default' }}
        role={onTap ? 'button' : undefined}
        aria-label={onTap ? 'Tap Capy' : undefined}
      >
        <g className={squish ? 'cs-squish' : 'cs-breathe'}>
          <ellipse cx="160" cy="166" rx="58" ry="46" fill="#a47148" />
          <ellipse cx="160" cy="178" rx="42" ry="30" fill="#b98556" />
          <ellipse cx="136" cy="150" rx="10" ry="7" fill="#8b5a33" />
          <ellipse cx="184" cy="150" rx="10" ry="7" fill="#8b5a33" />
          <ellipse cx="127" cy="70" rx="9" ry="7" fill="#7c4a26" />
          <ellipse cx="193" cy="70" rx="9" ry="7" fill="#7c4a26" />
          <rect x="120" y="64" width="80" height="72" rx="32" fill="#a47148" />
          <rect x="130" y="100" width="60" height="38" rx="19" fill="#8b5a33" />
          <ellipse cx="160" cy="110" rx="13" ry="6" fill="#3b2416" />
          <path d="M160 116 v5 M152 123 q8 5 16 0" fill="none" stroke="#3b2416" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M136 90 q7 -6 14 0 M170 90 q7 -6 14 0" fill="none" stroke="#2b1a0e" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="133" cy="102" rx="7" ry="4" fill="#fb7185" opacity="0.4" />
          <ellipse cx="187" cy="102" rx="7" ry="4" fill="#fb7185" opacity="0.4" />

          {stage >= 1 && (
            <g transform="rotate(-7 160 60)">
              <rect x="134" y="54" width="52" height="15" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
              <rect x="139" y="45" width="42" height="12" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="139" y1="61.5" x2="181" y2="61.5" stroke="#7dd3fc" strokeWidth="2" />
              <line x1="143" y1="51" x2="177" y2="51" stroke="#7dd3fc" strokeWidth="1.5" />
            </g>
          )}

          {stage >= 3 && (
            <g transform="translate(158 44)">
              <g className="cs-turtle">
                <ellipse cx="-14" cy="2" rx="5" ry="3" fill="#84cc16" />
                <ellipse cx="13" cy="2" rx="5" ry="3" fill="#84cc16" />
                <circle cx="25" cy="-7" r="7" fill="#84cc16" stroke="#3f6212" strokeWidth="1.2" />
                <circle cx="27.5" cy="-9" r="1.4" fill="#1f2937" />
                <path d="M26 -4.5 q2 1.5 4 0" fill="none" stroke="#3f6212" strokeWidth="1" strokeLinecap="round" />
                <path d="M-20 0 Q-20 -22 0 -22 Q20 -22 20 0 Z" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" />
                <path d="M-9 -1 L-6 -12 L6 -12 L9 -1 M-6 -12 L0 -21 L6 -12" fill="none" stroke="#14532d" strokeWidth="1.2" />
                <rect x="-22" y="-2" width="44" height="5" rx="2.5" fill="#65a30d" stroke="#14532d" strokeWidth="1" />
              </g>
            </g>
          )}
        </g>
      </g>

      {/* Water, clipped to the basin, rises with progress */}
      <g clipPath={`url(#${ref('basin')})`}>
        <g style={{ transform: `translateY(${waterY}px)`, ...smoothY }}>
          <g className="cs-wave">
            <path d={WAVE_PATH} fill={`url(#${ref('water')})`} />
          </g>
          <ellipse cx="160" cy="1" rx={rippleRx} ry="6" fill="none" stroke="#f0f9ff" strokeWidth="2" opacity="0.7" />
          <path d="M60 14 h26 M210 20 h32 M110 30 h20" stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          {stage === 3 && <ellipse className="cs-ripple" cx="243" cy="2" rx="14" ry="4" fill="none" stroke="#f0f9ff" strokeWidth="2" />}
        </g>
      </g>

      {/* Floaties ride the water line */}
      {stage >= 2 && (
        <g style={{ transform: `translateY(${waterY}px)`, ...smoothY }}>
          <g transform="translate(62 0)">
            <g className="cs-bob">
              <path d="M-15 -6 q-4 -8 2 -7 l6 3 z" fill="#fde047" stroke="#eab308" strokeWidth="1" />
              <ellipse cx="0" cy="-4" rx="14" ry="8.5" fill="#fde047" stroke="#eab308" strokeWidth="1.2" />
              <circle cx="8" cy="-15" r="7" fill="#fde047" stroke="#eab308" strokeWidth="1.2" />
              <path d="M14 -16 l7 2 l-7 3 z" fill="#f97316" />
              <circle cx="10" cy="-17" r="1.3" fill="#1f2937" />
              <path d="M-5 -6 q5 4 10 0" fill="none" stroke="#eab308" strokeWidth="1.2" />
            </g>
          </g>
          {[
            [100, 3, '0s'],
            [236, 0, '.6s'],
            [268, 4, '1.2s'],
          ].map(([x, dy, delay]) => (
            <g key={x} transform={`translate(${x} ${dy})`}>
              <g className="cs-bob" style={{ animationDelay: delay }}>
                <circle cx="0" cy="-3" r="9" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
                <circle cx="-3" cy="-6" r="1" fill="#ca8a04" />
                <circle cx="3" cy="-1" r="1" fill="#ca8a04" />
                <ellipse cx="5" cy="-12" rx="5" ry="2.5" fill="#65a30d" transform="rotate(-30 5 -12)" />
              </g>
            </g>
          ))}
        </g>
      )}

      {/* Front stones */}
      {FRONT_STONES.map((s, i) => (
        <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx + 2} ry={s.ry} fill={s.fill} stroke="#57534e" strokeWidth="1.5" />
      ))}

      {/* Steam */}
      <g style={{ transform: `translateY(${waterY - 6}px)`, ...smoothY }}>
        {STEAM_X.slice(0, steamCount).map((x, i) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <path
              className="cs-steam"
              style={{ animationDelay: `${i * 0.55}s` }}
              d="M0 0 q-6 -9 0 -18 q6 -9 0 -18"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>

      {/* Golden sparkles */}
      {stage === 3 &&
        [
          [48, 44, '0s'],
          [276, 40, '.7s'],
          [214, 22, '1.4s'],
          [98, 26, '1s'],
        ].map(([x, y, delay]) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <path className="cs-twinkle" style={{ animationDelay: delay }} d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#facc15" />
          </g>
        ))}

      {/* Splash nudge burst */}
      {splashKey > 0 && (
        <g key={splashKey} transform="translate(160 96)">
          {SPLASH_DROPS.map((d, i) => (
            <circle key={i} className="cs-splash" style={{ '--dx': `${d.dx}px`, '--dy': `${d.dy}px`, animationDelay: `${(i % 3) * 0.05}s` }} r={d.r} fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1" />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function ProgressRing({ pct, size = 84 }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = clamp(pct, 0, 100) / 100;
  const done = pct >= 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? '#eab308' : '#0284c7'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset .8s ease, stroke .4s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold text-slate-800 leading-none">{pct}%</span>
        <span className="text-xs text-slate-500 mt-0.5">{done ? 'zen' : 'of goal'}</span>
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-3xl p-4 shadow-sm border border-slate-100 ${className}`}>{children}</div>;
}

function CardTitle({ icon: Icon, title, right, iconClass = 'text-sky-600' }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={18} className={iconClass} />}
        <h3 className="font-bold text-slate-800 whitespace-nowrap">{title}</h3>
      </div>
      <div className="shrink-0 ml-2">{right}</div>
    </div>
  );
}

function BevBadge({ type, size = 'md' }) {
  const b = BEVERAGES[type];
  const dim = size === 'sm' ? 'w-8 h-8 text-base' : 'w-11 h-11 text-xl';
  return (
    <div className={`${dim} rounded-2xl flex items-center justify-center shrink-0`} style={{ background: b.tint }}>
      {b.emoji}
    </div>
  );
}

function TypePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {TYPE_ORDER.map((t) => {
        const b = BEVERAGES[t];
        const on = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`rounded-2xl py-2 px-1 border-2 text-center transition ${on ? 'border-sky-600 bg-sky-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
          >
            <div className="text-xl leading-none">{b.emoji}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1 truncate">{b.label}</div>
            <div className="text-xs text-slate-500">{Math.round(b.ratio * 100)}%</div>
          </button>
        );
      })}
    </div>
  );
}

function VolumeControl({ value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Decrease volume"
          onClick={() => onChange(clamp(value - 50, 50, 1500))}
          className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
        >
          <Minus size={18} />
        </button>
        <div className="text-center">
          <span className="text-3xl font-extrabold text-slate-800">{value}</span>
          <span className="text-slate-500 ml-1">ml</span>
        </div>
        <button
          type="button"
          aria-label="Increase volume"
          onClick={() => onChange(clamp(value + 50, 50, 1500))}
          className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
        >
          <Plus size={18} />
        </button>
      </div>
      <input
        type="range"
        min="50"
        max="1000"
        step="10"
        value={Math.min(value, 1000)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-3"
        style={{ accentColor: '#0284c7' }}
        aria-label="Volume in ml"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Custom add drawer                                                   */
/* ------------------------------------------------------------------ */

function CustomDrawer({ open, onClose, onAdd }) {
  const [type, setType] = useState('water');
  const [volume, setVolume] = useState(350);
  const [time, setTime] = useState(() => toHHMM(Date.now()));

  useEffect(() => {
    if (open) setTime(toHHMM(Date.now()));
  }, [open]);

  if (!open) return null;
  const b = BEVERAGES[type];
  const net = Math.round(volume * b.ratio);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 cs-fade" style={{ background: 'rgba(15,23,42,.45)' }} onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl p-5 pb-6 cs-sheet shadow-2xl">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">Custom sip</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <X size={18} />
          </button>
        </div>
        <TypePicker value={type} onChange={setType} />
        <div className="mt-5">
          <VolumeControl value={volume} onChange={setVolume} />
          <div className="flex gap-2 mt-3 overflow-x-auto cs-noscroll">
            {[100, 200, 250, 330, 500, 750].map((v) => (
              <button
                key={v}
                onClick={() => setVolume(v)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border shrink-0 ${volume === v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {v} ml
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-5 bg-slate-50 rounded-2xl p-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Clock size={16} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent font-semibold text-slate-800" />
          </label>
          <div className="text-right">
            <div className="text-xs text-slate-500">Net hydration</div>
            <div className="font-bold text-slate-800">
              {net} ml <span className="text-slate-500 font-normal text-sm">({Math.round(b.ratio * 100)}%)</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            onAdd(type, volume, tsFromHHMM(time));
            onClose();
          }}
          className="w-full mt-4 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Plus size={18} /> Add {volume} ml {b.label}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HOME TAB                                                            */
/* ------------------------------------------------------------------ */

function HomeTab({ total, pct, stage, streak, onQuickAdd, onCustom, onCapyTap, squish, hearts, pulseKey }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const remaining = Math.max(0, GOAL - total);

  let nextLine;
  if (stage < 3) {
    const next = STAGES[stage + 1];
    const need = Math.ceil((next.at * GOAL) / 100) - total;
    nextLine = (
      <>
        Drink <b className="text-slate-800">{fmt(need)} ml</b> more to unlock {next.emoji} <b className="text-slate-800">{next.name}</b>: {next.unlock}.
      </>
    );
  } else if (pct < 100) {
    nextLine = (
      <>
        Turtle buddy aboard! <b className="text-slate-800">{fmt(remaining)} ml</b> to full zen and today's 🔥 streak.
      </>
    );
  } else {
    nextLine = <>Full zen reached. Capy, turtle and the yuzu salute you. 🐢✨</>;
  }

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{dateStr}</p>
          <h1 className="text-2xl font-extrabold text-slate-800 mt-0.5">{greeting} ♨️</h1>
        </div>
        <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-3 py-1.5 font-bold text-sm">
          <Flame size={16} className="text-orange-500" />
          {streak} Days
        </div>
      </div>

      <Card className="flex items-center gap-4">
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 font-medium">Net hydration today</div>
          <div key={pulseKey} className={`text-2xl font-extrabold text-slate-800 ${pulseKey ? 'cs-pop' : ''}`}>
            {fmt(total)} <span className="text-base font-semibold text-slate-400">/ {fmt(GOAL)} ml</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${clamp(pct, 0, 100)}%`, background: pct >= 100 ? '#eab308' : '#0284c7', transition: 'width .8s ease' }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1.5">{remaining > 0 ? `${fmt(remaining)} ml to go` : `Goal smashed by ${fmt(total - GOAL)} ml 🎉`}</div>
        </div>
      </Card>

      {/* Onsen */}
      <div className="rounded-3xl overflow-hidden border border-emerald-100 shadow-sm bg-white">
        <div className="relative">
          <OnsenScene pct={pct} id="home" onTap={onCapyTap} squish={squish} />
          <div className="absolute top-3 left-3 bg-white rounded-full px-3 py-1 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1">
            {STAGES[stage].emoji} {STAGES[stage].name}
          </div>
          <div className="absolute top-3 right-3 bg-white rounded-full px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm flex items-center gap-1">
            <Heart size={12} className="text-rose-500" /> Tap Capy
          </div>
          {hearts.map((h) => (
            <span key={h.id} className="cs-heart absolute pointer-events-none text-2xl" style={{ left: `${h.x}%`, top: '34%', '--dx': `${h.dx}px`, animationDelay: `${h.delay}s` }}>
              ❤️
            </span>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-emerald-50">
          <div className="flex items-center gap-1.5">
            {STAGES.map((s, i) => (
              <div key={s.name} className="flex-1">
                <div className="h-1.5 rounded-full" style={{ background: i <= stage ? (i === 3 ? '#eab308' : '#0284c7') : '#e2e8f0', transition: 'background .5s' }} />
                <div className={`text-xs mt-1 text-center ${i <= stage ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                  {s.emoji} {s.at}%
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 mt-2 leading-snug">{nextLine}</p>
        </div>
      </div>

      {/* Quick-add bar */}
      <div className="sticky bottom-0 z-20 pt-2 pb-3" style={{ background: 'linear-gradient(to top, #f8fafc 70%, rgba(248,250,252,0))' }}>
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-2 grid grid-cols-4 gap-2">
          {QUICK_ADDS.map((q) => (
            <button
              key={q.type}
              onClick={() => onQuickAdd(q.type, q.volume)}
              className={`rounded-2xl border ${q.ring} py-2 px-1 text-center active:scale-95 transition`}
              aria-label={`Add ${q.volume} ml ${q.label}`}
            >
              <div className="text-xl leading-none">{q.emoji}</div>
              <div className="text-sm font-extrabold text-slate-800 mt-1">+{q.volume}</div>
              <div className="text-xs text-slate-500 truncate">{q.label}</div>
            </button>
          ))}
          <button
            onClick={onCustom}
            className="rounded-2xl border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 py-2 px-1 text-center active:scale-95 transition"
            aria-label="Add a custom drink"
          >
            <div className="flex justify-center">
              <div className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center">
                <Plus size={16} strokeWidth={3} />
              </div>
            </div>
            <div className="text-sm font-extrabold text-slate-800 mt-1">Custom</div>
            <div className="text-xs text-slate-500">any sip</div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LOG TAB                                                             */
/* ------------------------------------------------------------------ */

function LogRow({ log, editing, onEdit, onCancel, onSave, onDelete }) {
  const b = BEVERAGES[log.type];
  const [draft, setDraft] = useState({ type: log.type, volume: log.volume, time: toHHMM(log.ts) });

  useEffect(() => {
    if (editing) setDraft({ type: log.type, volume: log.volume, time: toHHMM(log.ts) });
  }, [editing, log]);

  const draftNet = Math.round(draft.volume * BEVERAGES[draft.type].ratio);

  return (
    <div className={`rounded-2xl border transition ${editing ? 'border-sky-200 bg-sky-50' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-center gap-3 p-3">
        <BevBadge type={log.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-bold text-slate-800 truncate">{b.label}</span>
            <span className="font-bold text-slate-800 shrink-0">{log.volume} ml</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
            <span>
              {timeLabel(log.ts)} · {Math.round(b.ratio * 100)}% ratio
            </span>
            <span className="shrink-0">
              <span className="text-sky-700 font-semibold">{netOf(log)} ml</span> net
            </span>
          </div>
        </div>
        {!editing && (
          <div className="flex gap-1 shrink-0">
            <button onClick={onEdit} aria-label={`Edit ${b.label} at ${timeLabel(log.ts)}`} className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500 flex items-center justify-center">
              <Edit3 size={16} />
            </button>
            <button onClick={onDelete} aria-label={`Delete ${b.label} at ${timeLabel(log.ts)}`} className="w-9 h-9 rounded-xl hover:bg-rose-50 text-rose-500 flex items-center justify-center">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      {editing && (
        <div className="px-3 pb-3 space-y-3 cs-rise">
          <TypePicker value={draft.type} onChange={(type) => setDraft((d) => ({ ...d, type }))} />
          <VolumeControl value={draft.volume} onChange={(volume) => setDraft((d) => ({ ...d, volume }))} />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <Clock size={16} />
              <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} className="bg-white rounded-lg px-2 py-1 border border-slate-200 font-semibold text-slate-800" />
            </label>
            <span className="text-slate-600">
              Net <b className="text-slate-800">{draftNet} ml</b>
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-slate-600">
              Cancel
            </button>
            <button
              onClick={() => onSave({ type: draft.type, volume: draft.volume, ts: tsFromHHMM(draft.time) })}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center justify-center gap-1"
            >
              <Check size={16} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogTab({ logs, totalVol, totalNet, onUpdate, onDelete, onCustom }) {
  const [editingId, setEditingId] = useState(null);
  const sorted = useMemo(() => [...logs].sort((a, b) => b.ts - a.ts), [logs]);

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Drink log</p>
          <h1 className="text-2xl font-extrabold text-slate-800">Today's sips</h1>
        </div>
        <button onClick={onCustom} className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-full px-4 py-2 active:scale-95 transition">
          <Plus size={16} /> Log drink
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Drinks', logs.length, ''],
          ['Volume', fmt(totalVol), 'ml'],
          ['Net', fmt(totalNet), 'ml'],
        ].map(([k, v, u]) => (
          <div key={k} className="bg-white rounded-2xl border border-slate-100 p-3">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="text-lg font-extrabold text-slate-800">
              {v} <span className="text-xs font-semibold text-slate-400">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8">
            <div className="text-4xl">🫙</div>
            <p className="font-bold text-slate-700 mt-2">No sips yet today</p>
            <p className="text-sm text-slate-500">Capy's bath is running dry. Log your first drink.</p>
          </div>
        )}
        {sorted.map((log) => (
          <LogRow
            key={log.id}
            log={log}
            editing={editingId === log.id}
            onEdit={() => setEditingId(log.id)}
            onCancel={() => setEditingId(null)}
            onSave={(patch) => {
              onUpdate(log.id, patch);
              setEditingId(null);
            }}
            onDelete={() => {
              if (editingId === log.id) setEditingId(null);
              onDelete(log.id);
            }}
          />
        ))}
      </div>

      <Card>
        <CardTitle icon={Info} title="Hydration calculator" />
        <p className="text-sm text-slate-600 mb-3">
          Net hydration = volume × beverage ratio. Capy's onsen, your goal and your streak all track <b>net ml</b>.
        </p>
        <div className="space-y-3">
          {TYPE_ORDER.map((t) => {
            const b = BEVERAGES[t];
            const sample = t === 'coffee' ? 200 : t === 'tea' ? 300 : 250;
            return (
              <div key={t} className="flex items-center gap-3">
                <BevBadge type={t} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-800">{b.label}</span>
                    <span className="font-bold text-slate-800">×{b.ratio.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${b.ratio * 100}%`, background: b.color }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{b.note}</span>
                    <span className="shrink-0 ml-2">
                      {sample} → {Math.round(sample * b.ratio)} ml
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ANALYTICS TAB                                                       */
/* ------------------------------------------------------------------ */

const topRoundedBar = (x, y, w, h, r) => {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`;
};

function HourlyChart({ logs }) {
  const buckets = useMemo(() => {
    const b = Array(24).fill(0);
    logs.forEach((l) => {
      b[new Date(l.ts).getHours()] += netOf(l);
    });
    return b;
  }, [logs]);
  const periodTotals = useMemo(() => {
    const t = { morning: 0, afternoon: 0, evening: 0 };
    buckets.forEach((v, h) => {
      t[periodOf(h)] += v;
    });
    return t;
  }, [buckets]);

  const max = Math.max(...buckets);
  const yMax = Math.max(500, Math.ceil(max / 250) * 250);
  const peak = max > 0 ? buckets.indexOf(max) : null;
  const [sel, setSel] = useState(null);
  const active = sel ?? peak;
  const nowH = new Date().getHours();

  const W = 320, H = 150, L = 30, R = 6, T = 10, B = 22;
  const pw = W - L - R, ph = H - T - B, slot = pw / 24, bw = slot - 3;
  const y = (v) => T + ph - (v / yMax) * ph;

  return (
    <Card>
      <CardTitle icon={TrendingUp} title="Hourly intake velocity" right={<span className="text-xs text-slate-500">net ml</span>} />
      <div className="text-sm text-slate-600 h-5 mb-1">
        {active != null ? (
          <>
            <b className="text-slate-800">{hourLabel(active)}</b> · {fmt(buckets[active])} ml net · {PERIODS[periodOf(active)].label}
            {sel == null && peak != null && <span className="text-slate-400"> (peak)</span>}
          </>
        ) : (
          'No sips logged yet'
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setSel(null)}>
        {[0, yMax / 2, yMax].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#cbd5e1' : '#eef2f7'} strokeWidth="1" />
            <text x={L - 5} y={y(v) + 3.5} textAnchor="end" fontSize="9" fill="#64748b">
              {v >= 1000 ? `${v / 1000}k` : v}
            </text>
          </g>
        ))}
        {buckets.map((v, h) => {
          const x = L + h * slot + 1.5;
          const color = PERIODS[periodOf(h)].color;
          const dim = sel != null && sel !== h;
          return (
            <g key={h}>
              {v > 0 && <path d={topRoundedBar(x, y(v), bw, T + ph - y(v), 4)} fill={color} opacity={dim ? 0.45 : 1} />}
              <rect
                x={L + h * slot}
                y={T}
                width={slot}
                height={ph + B}
                fill="transparent"
                onMouseEnter={() => setSel(h)}
                onClick={() => setSel(h)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={L + h * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#64748b">
            {hourLabel(h)}
          </text>
        ))}
        <path d={`M${L + nowH * slot + slot / 2 - 4} ${T + ph + 9} l4 -5 l4 5 z`} fill="#0f172a" />
      </svg>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {Object.entries(PERIODS).map(([k, p]) => (
          <div key={k} className="rounded-2xl bg-slate-50 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </div>
            <div className="font-extrabold text-slate-800 mt-0.5">
              {fmt(periodTotals[k])} <span className="text-xs text-slate-400 font-semibold">ml</span>
            </div>
            <div className="text-xs text-slate-400">{p.range}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-2">▲ marks the current hour. Tap a bar for details.</p>
    </Card>
  );
}

function WeeklyChart({ todayTotal }) {
  const [week, setWeek] = useState('this');
  const data = useMemo(() => {
    if (week === 'this') {
      return [...HISTORY.slice(7).map((d, i) => ({ total: d.total, date: daysAgo(6 - i) })), { total: todayTotal, date: daysAgo(0), today: true }];
    }
    return HISTORY.slice(0, 7).map((d, i) => ({ total: d.total, date: daysAgo(13 - i) }));
  }, [week, todayTotal]);
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(null), [week]);
  const active = sel ?? data.length - 1;

  const W = 320, H = 170, L = 30, R = 14, T = 14, B = 24;
  const pw = W - L - R, ph = H - T - B;
  const yMax = Math.max(3500, Math.ceil((Math.max(...data.map((d) => d.total)) * 1.1) / 500) * 500);
  const x = (i) => L + (i * pw) / (data.length - 1);
  const y = (v) => T + ph - (v / yMax) * ph;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.total)}`).join(' ');
  const area = `${line} L${x(data.length - 1)} ${T + ph} L${x(0)} ${T + ph} Z`;
  const met = data.filter((d) => d.total >= GOAL).length;
  const avg = Math.round(data.reduce((s, d) => s + d.total, 0) / data.length);
  const a = data[active];

  return (
    <Card>
      <CardTitle
        icon={BarChart3}
        title="Weekly trend"
        right={
          <div className="flex bg-slate-100 rounded-full p-0.5 text-xs font-semibold">
            {[
              ['this', 'This week'],
              ['last', 'Last week'],
            ].map(([k, lbl]) => (
              <button key={k} onClick={() => setWeek(k)} className={`px-2 py-1 whitespace-nowrap rounded-full transition ${week === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                {lbl}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex gap-4 text-sm mb-1">
        <div>
          <span className="text-slate-500">Avg </span>
          <b className="text-slate-800">{fmt(avg)} ml</b>
        </div>
        <div>
          <span className="text-slate-500">Goal hit </span>
          <b className="text-slate-800">
            {met}/{data.length} days
          </b>
        </div>
      </div>
      <div className="text-sm text-slate-600 h-5">
        <b className="text-slate-800">{a.today ? 'Today' : a.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</b> · {fmt(a.total)} ml ·{' '}
        {pctOf(a.total, GOAL)}% of goal {a.total >= GOAL ? '✓' : ''}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setSel(null)}>
        {[0, 1000, 2000, 3000].filter((v) => v <= yMax).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#cbd5e1' : '#eef2f7'} />
            <text x={L - 5} y={y(v) + 3.5} textAnchor="end" fontSize="9" fill="#64748b">
              {v / 1000}k
            </text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(GOAL)} y2={y(GOAL)} stroke="#d97706" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={L - 5} y={y(GOAL) + 3.5} textAnchor="end" fontSize="9" fontWeight="700" fill="#92400e">
          2.5k
        </text>
        <path d={area} fill="#0284c7" opacity="0.08" />
        <path d={line} fill="none" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {active != null && <line x1={x(active)} x2={x(active)} y1={T} y2={T + ph} stroke="#94a3b8" strokeDasharray="2 3" />}
        {data.map((d, i) => {
          const hit = d.total >= GOAL;
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(d.total)} r={i === active ? 6 : 4.5} fill={hit ? '#0284c7' : '#ffffff'} stroke={hit ? '#ffffff' : '#0284c7'} strokeWidth="2" />
              {hit && <circle cx={x(i)} cy={y(d.total)} r={i === active ? 7.5 : 6} fill="none" stroke="#0284c7" strokeWidth="1" opacity="0.35" />}
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fontWeight={d.today ? 700 : 400} fill={d.today ? '#0f172a' : '#64748b'}>
                {d.today ? 'Today' : d.date.toLocaleDateString('en-US', { weekday: 'short' })}
              </text>
              <rect
                x={x(i) - pw / (data.length - 1) / 2}
                y={T}
                width={pw / (data.length - 1)}
                height={ph + B}
                fill="transparent"
                onMouseEnter={() => setSel(i)}
                onClick={() => setSel(i)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mt-1 whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-600 inline-block" /> Goal met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-sky-600 inline-block" /> Below goal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-amber-600 inline-block" /> 2.5k target
        </span>
      </div>
    </Card>
  );
}

function BreakdownCard({ logs }) {
  const totals = useMemo(() => {
    const t = Object.fromEntries(TYPE_ORDER.map((k) => [k, 0]));
    logs.forEach((l) => {
      t[l.type] += l.volume;
    });
    return t;
  }, [logs]);
  const sum = Object.values(totals).reduce((s, v) => s + v, 0);
  const [hover, setHover] = useState(null);

  return (
    <Card>
      <CardTitle icon={Coffee} title="Beverage breakdown" />
      <p className="text-xs text-slate-500 -mt-2 mb-3">Share of today's volume</p>
      {sum === 0 ? (
        <p className="text-sm text-slate-500">Log a drink to see your mix.</p>
      ) : (
        <>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5 bg-white">
            {TYPE_ORDER.filter((t) => totals[t] > 0).map((t) => (
              <div
                key={t}
                title={`${BEVERAGES[t].category}: ${totals[t]} ml`}
                onMouseEnter={() => setHover(t)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(t)}
                className="h-full transition-all cursor-pointer"
                style={{ width: `${(totals[t] / sum) * 100}%`, background: BEVERAGES[t].color, opacity: hover && hover !== t ? 0.45 : 1 }}
              />
            ))}
          </div>
          <div className="space-y-1.5 mt-3">
            {TYPE_ORDER.map((t) => {
              const b = BEVERAGES[t];
              const share = sum ? Math.round((totals[t] / sum) * 100) : 0;
              return (
                <div key={t} className={`flex items-center justify-between text-sm rounded-lg px-1.5 py-0.5 ${hover === t ? 'bg-slate-50' : ''}`}>
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: b.color }} />
                    {b.emoji} {b.category}
                  </span>
                  <span className="text-slate-500">
                    <b className="text-slate-800">{share}%</b> · {fmt(totals[t])} ml
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function MoodCard({ mood, onMood, pct, onQuickWater }) {
  const insight = useMemo(() => {
    const hi = HISTORY.filter((d) => d.total > GOAL * 0.9);
    const lo = HISTORY.filter((d) => d.total <= GOAL * 0.9);
    const avg = (arr) => arr.reduce((s, d) => s + MOODS[d.mood].score, 0) / arr.length;
    const hiAvg = avg(hi);
    const loAvg = avg(lo);
    return { hiAvg, loAvg, hiN: hi.length, loN: lo.length, lift: Math.round(((hiAvg - loAvg) / loAvg) * 100) };
  }, []);

  const last7 = HISTORY.slice(7).map((d, i) => ({ ...d, date: daysAgo(6 - i) }));
  const low = mood === 'tired' || mood === 'headachy';

  return (
    <Card>
      <CardTitle icon={BatteryCharging} title="Mood & energy check-in" iconClass="text-amber-600" />
      <div className="grid grid-cols-4 gap-2">
        {MOOD_ORDER.map((k) => {
          const m = MOODS[k];
          const on = mood === k;
          return (
            <button
              key={k}
              onClick={() => onMood(k)}
              aria-pressed={on}
              className={`rounded-2xl py-2.5 px-1 border-2 text-center transition active:scale-95 ${on ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
            >
              <div className="text-2xl leading-none">{m.emoji}</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">{m.label}</div>
            </button>
          );
        })}
      </div>

      {mood && (
        <div className="mt-3 rounded-2xl p-3 text-sm cs-rise" style={{ background: low && pct < 60 ? '#fff7ed' : '#f0f9ff' }}>
          {low && pct < 60 ? (
            <div className="flex items-center gap-3">
              <p className="flex-1 text-slate-700">
                Feeling {MOODS[mood].label.toLowerCase()} and you're at <b>{pct}%</b>. Low intake often tracks with low energy. Quick glass?
              </p>
              <button onClick={onQuickWater} className="shrink-0 bg-sky-600 text-white font-bold rounded-xl px-3 py-2 text-xs active:scale-95">
                +250 ml 💧
              </button>
            </div>
          ) : (
            <p className="text-slate-700 flex items-start gap-2">
              <Smile size={16} className="text-sky-600 shrink-0 mt-0.5" />
              <span>{MOODS[mood].emoji} Saved for today. It joins your insights once today closes, so a half-finished day can't skew the numbers.</span>
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between mt-4 px-1">
        {last7.map((d, i) => (
          <div key={i} className="text-center">
            <div className="text-lg">{MOODS[d.mood].emoji}</div>
            <div className="text-xs text-slate-400">{d.date.toLocaleDateString('en-US', { weekday: 'narrow' })}</div>
          </div>
        ))}
        <div className="text-center">
          <div className="text-lg">{mood ? MOODS[mood].emoji : '·'}</div>
          <div className="text-xs font-bold text-slate-700">Today</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3.5">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <Sparkles size={16} className="text-yellow-600" /> Correlation insight
        </div>
        <p className="text-sm text-slate-700 mt-1.5">
          On days with <b>&gt;90% hydration</b>, your focus rating averaged <b className="text-amber-800">{insight.lift}% higher</b>.
        </p>
        <div className="space-y-1.5 mt-3">
          {[
            ['>90%', insight.hiAvg, insight.hiN, '#0284c7'],
            ['≤90%', insight.loAvg, insight.loN, '#94a3b8'],
          ].map(([label, v, n, c]) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="w-10 font-semibold text-slate-600 shrink-0">{label}</span>
              <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(v / 4) * 100}%`, background: c }} />
              </div>
              <span className="w-28 text-right text-slate-600 shrink-0">
                <b className="text-slate-800">{v.toFixed(1)}</b>/4 · {n} days
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Focus rating: ⚡4 😊3 😴2 🤕1. Based on {HISTORY.length} completed days. Correlation, not causation. Confidence firms up after ~30 days.
        </p>
      </div>
    </Card>
  );
}

function AnalyticsTab({ logs, total, pct, mood, onMood, onQuickWater }) {
  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Analytics</p>
        <h1 className="text-2xl font-extrabold text-slate-800">Your hydration story</h1>
      </div>
      <HourlyChart logs={logs} />
      <WeeklyChart todayTotal={total} />
      <BreakdownCard logs={logs} />
      <MoodCard mood={mood} onMood={onMood} pct={pct} onQuickWater={onQuickWater} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SQUAD TAB                                                           */
/* ------------------------------------------------------------------ */

function SquadTab({ members, splashing, nudged, onSplash, feed, now }) {
  const ranked = [...members].sort((a, b) => b.pct - a.pct);
  const you = members.find((m) => m.id === 'you');

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Spa squad</p>
        <h1 className="text-2xl font-extrabold text-slate-800">The social onsen</h1>
      </div>

      <div className="rounded-3xl overflow-hidden border border-emerald-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-sm font-bold text-slate-700">♨️ Rotenburo row</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-2">
          {members.map((m) => {
            const canSplash = m.id !== 'you' && m.pct < 50;
            return (
              <div key={m.id} className="text-center">
                <div className="rounded-2xl overflow-hidden">
                  <OnsenScene pct={m.pct} id={`sq-${m.id}`} compact splashKey={splashing[m.id] || 0} />
                </div>
                <div className="font-bold text-slate-800 text-sm mt-1">{m.name}</div>
                <div className="text-xs text-slate-500">
                  <b className="text-slate-700">{m.pct}%</b> · {fmt(m.total)} ml
                </div>
                <div className="h-9 mt-1 flex items-center justify-center">
                  {canSplash ? (
                    <button
                      onClick={() => onSplash(m.id)}
                      disabled={nudged[m.id]}
                      className={`text-xs font-bold rounded-full px-3 py-1.5 transition active:scale-95 ${nudged[m.id] ? 'bg-slate-100 text-slate-400' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm'}`}
                    >
                      {nudged[m.id] ? 'Splashed ✓' : '💦 Splash'}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">{STAGES[stageFor(m.pct)].emoji} {m.pct >= 100 ? 'Full zen' : STAGES[stageFor(m.pct)].name}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {you && you.pct < 50 && (
        <div className="rounded-2xl bg-sky-50 border border-sky-100 p-3 text-sm text-sky-800">👀 You're under 50%. Your squad can splash you too. Beat them to it with a sip.</div>
      )}

      <Card>
        <CardTitle icon={Users} title="Today's standings" />
        <div className="space-y-3">
          {ranked.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-7 text-center text-lg">{['🥇', '🥈', '🥉'][i]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-800">{m.name}</span>
                  <span className="text-slate-500">
                    {fmt(m.total)} / {fmt(m.goal)} ml
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${clamp(m.pct, 0, 100)}%`, background: m.pct >= 100 ? '#eab308' : '#0284c7', transition: 'width .8s ease' }} />
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Last: {BEVERAGES[m.lastType].emoji} {BEVERAGES[m.lastType].label} · {m.lastTs ? ago(m.lastTs, now) : 'no sips yet'}
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
          <Send size={12} /> Splash nudges unlock for friends under 50% of their goal.
        </p>
      </Card>

      <Card>
        <CardTitle icon={Waves} title="Squad activity" />
        <div className="space-y-2.5">
          {feed.slice(0, 6).map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 text-sm cs-rise">
              <span className="text-slate-700">{f.text}</span>
              <span className="text-xs text-slate-400 shrink-0 mt-0.5">{ago(f.ts, now)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast + confetti                                                    */
/* ------------------------------------------------------------------ */

function Toast({ toast, onAction, position }) {
  if (!toast) return null;
  return (
    <div className={`absolute left-3 right-3 ${position} z-40 pointer-events-none`}>
      <div key={toast.id} className="pointer-events-auto bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden cs-rise" role="status" aria-live="polite">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{toast.message}</div>
            {toast.sub && <div className="text-xs text-slate-300 mt-0.5 italic">{toast.sub}</div>}
          </div>
          {toast.actionLabel && (
            <button onClick={onAction} className="shrink-0 flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-sm rounded-xl px-3 py-1.5">
              <Undo size={14} /> {toast.actionLabel}
            </button>
          )}
        </div>
        <div className="h-1 bg-slate-700">
          <div className="h-full bg-yellow-400 cs-timer" style={{ animationDuration: `${toast.duration}ms` }} />
        </div>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#0ea5e9', '#facc15', '#f59e0b', '#10b981', '#f472b6', '#ffffff'];

function Confetti({ burst }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 6 + Math.random() * 6,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.2,
        dx: (Math.random() - 0.5) * 140,
        rot: (Math.random() - 0.5) * 900,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    [burst]
  );
  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="cs-confetti absolute"
          style={{
            left: `${p.left}%`,
            top: -12,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            borderRadius: p.round ? '999px' : '2px',
            boxShadow: '0 0 0 1px rgba(15,23,42,.06)',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'home', label: 'Spa', Icon: Waves },
  { id: 'log', label: 'Log', Icon: Droplets },
  { id: 'stats', label: 'Stats', Icon: BarChart3 },
  { id: 'squad', label: 'Squad', Icon: Users },
];

export default function CapySpa() {
  const [tab, setTab] = useState('home');
  const [logs, setLogs] = useState(makeInitialLogs);
  const [toast, setToast] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [squish, setSquish] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [mood, setMood] = useState(null);
  const [friends, setFriends] = useState(makeInitialFriends);
  const [feed, setFeed] = useState(makeInitialFeed);
  const [splashing, setSplashing] = useState({});
  const [nudged, setNudged] = useState({});
  const [now, setNow] = useState(Date.now());

  const scrollRef = useRef(null);
  const toastRef = useRef(null);
  const toastTimer = useRef(null);
  const timers = useRef(new Set());
  const friendsRef = useRef(friends);
  friendsRef.current = friends;

  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
    return t;
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      clearTimeout(toastTimer.current);
    },
    []
  );

  /* ---- derived ---- */
  const totalNet = useMemo(() => logs.reduce((s, l) => s + netOf(l), 0), [logs]);
  const totalVol = useMemo(() => logs.reduce((s, l) => s + l.volume, 0), [logs]);
  const pct = pctOf(totalNet, GOAL);
  const stage = stageFor(pct);
  const streak = PRIOR_STREAK + (totalNet >= GOAL ? 1 : 0);

  /* ---- toast ---- */
  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    toastRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    ({ message, sub, actionLabel, onAction, duration = 3200, soft = false }) => {
      // "Soft" toasts (capy bliss) never bump an undo that is still on screen.
      if (soft && toastRef.current && toastRef.current.actionLabel) return;
      clearTimeout(toastTimer.current);
      const t = { id: uid('toast'), message, sub, actionLabel, onAction, duration };
      toastRef.current = t;
      setToast(t);
      toastTimer.current = setTimeout(dismissToast, duration);
    },
    [dismissToast]
  );

  const runToastAction = () => {
    const t = toastRef.current;
    dismissToast();
    if (t && t.onAction) t.onAction();
  };

  /* ---- goal celebration ---- */
  const prevNet = useRef(totalNet);
  useEffect(() => {
    if (prevNet.current < GOAL && totalNet >= GOAL) {
      setConfetti((c) => c + 1);
    }
    prevNet.current = totalNet;
  }, [totalNet]);

  useEffect(() => {
    if (!confetti) return undefined;
    const t = setTimeout(() => setConfetti(0), 3800);
    return () => clearTimeout(t);
  }, [confetti]);

  /* ---- log actions ---- */
  const addLog = (type, volume, ts = Date.now()) => {
    const entry = { id: uid('log'), type, volume, ts };
    const net = netOf(entry);
    const after = totalNet + net;
    setLogs((prev) => [...prev, entry]);
    setPulseKey((k) => k + 1);
    const crossed = totalNet < GOAL && after >= GOAL;
    const newStage = stageFor(pctOf(after, GOAL));
    let sub = `${net} ml net hydration · ${pctOf(after, GOAL)}% of goal`;
    if (crossed) sub = 'Goal reached! Full zen unlocked, streak extended 🔥';
    else if (newStage > stage) sub = `Unlocked ${STAGES[newStage].emoji} ${STAGES[newStage].name}!`;
    showToast({
      message: `+${volume} ml ${BEVERAGES[type].label} ${BEVERAGES[type].emoji}`,
      sub,
      actionLabel: 'Undo',
      duration: 4500,
      onAction: () => setLogs((prev) => prev.filter((l) => l.id !== entry.id)),
    });
  };

  const updateLog = (id, patch) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    showToast({ message: 'Log updated ✓', sub: `${patch.volume} ml ${BEVERAGES[patch.type].label} at ${timeLabel(patch.ts)}` });
  };

  const deleteLog = (id) => {
    const removed = logs.find((l) => l.id === id);
    if (!removed) return;
    setLogs((prev) => prev.filter((l) => l.id !== id));
    showToast({
      message: `Deleted ${removed.volume} ml ${BEVERAGES[removed.type].label}`,
      sub: `${netOf(removed)} ml net removed from today`,
      actionLabel: 'Undo Log',
      duration: 5000,
      onAction: () => setLogs((prev) => (prev.some((l) => l.id === removed.id) ? prev : [...prev, removed])),
    });
  };

  /* ---- capy tap ---- */
  const tapCapy = () => {
    setSquish(false);
    requestAnimationFrame(() => setSquish(true));
    later(() => setSquish(false), 700);
    const batch = Array.from({ length: 3 }, (_, i) => ({
      id: uid('heart'),
      x: 44 + Math.random() * 12,
      dx: (Math.random() - 0.5) * 70,
      delay: i * 0.12,
    }));
    setHearts((h) => [...h, ...batch]);
    later(() => setHearts((h) => h.filter((x) => !batch.includes(x))), 1800);
    showToast({ message: '🔊 ahh~ *bloop bloop*', sub: 'Capy sits in pure bliss...', duration: 2200, soft: true });
  };

  /* ---- squad ---- */
  const addFeed = useCallback((text) => {
    setFeed((f) => [{ id: uid('feed'), text, ts: Date.now() }, ...f].slice(0, 20));
  }, []);

  const friendDrinks = useCallback(
    (id, type, volume, reason) => {
      const f = friendsRef.current.find((x) => x.id === id);
      if (!f) return;
      const net = Math.round(volume * BEVERAGES[type].ratio);
      const before = pctOf(f.total, f.goal);
      const after = pctOf(f.total + net, f.goal);
      setFriends((prev) => prev.map((x) => (x.id === id ? { ...x, total: x.total + net, lastType: type, lastTs: Date.now() } : x)));
      addFeed(reason || `${f.name} logged ${volume} ml ${BEVERAGES[type].label} ${BEVERAGES[type].emoji}`);
      if (before < 100 && after >= 100) addFeed(`${f.name} hit their goal! Full zen 🐢✨`);
      else if (stageFor(after) > stageFor(before)) addFeed(`${f.name} unlocked ${STAGES[stageFor(after)].name} ${STAGES[stageFor(after)].emoji}`);
    },
    [addFeed]
  );

  // Simulated live friend activity. Friends under 50% are the forgetful ones:
  // they only drink when splashed, so the nudge loop always has someone to nudge.
  useEffect(() => {
    const iv = setInterval(() => {
      setNow(Date.now());
      if (Math.random() < 0.5) return;
      const pool = friendsRef.current.filter((f) => pctOf(f.total, f.goal) >= 50 && f.total < f.goal * 1.15);
      if (!pool.length) return;
      const f = pool[Math.floor(Math.random() * pool.length)];
      const type = TYPE_ORDER[Math.floor(Math.random() * TYPE_ORDER.length)];
      const volume = [150, 200, 250, 300][Math.floor(Math.random() * 4)];
      friendDrinks(f.id, type, volume);
    }, 30000);
    return () => clearInterval(iv);
  }, [friendDrinks]);

  const splashFriend = (id) => {
    const f = friendsRef.current.find((x) => x.id === id);
    if (!f || nudged[id]) return;
    setSplashing((s) => ({ ...s, [id]: Date.now() }));
    setNudged((s) => ({ ...s, [id]: true }));
    addFeed(`You splashed ${f.name} 💦`);
    showToast({ message: `Splash sent to ${f.name}! 💦`, sub: `${f.name} is at ${pctOf(f.total, f.goal)}%. A friendly nudge is on its way.` });
    later(() => setSplashing((s) => ({ ...s, [id]: 0 })), 1200);
    later(() => friendDrinks(id, 'water', 300, `${f.name} felt the splash and drank 300 ml Water 🌊`), 2600);
    later(() => setNudged((s) => ({ ...s, [id]: false })), 20000);
  };

  const members = [
    { id: 'you', name: 'You', total: totalNet, goal: GOAL, pct, lastType: logs.length ? [...logs].sort((a, b) => b.ts - a.ts)[0].type : 'water', lastTs: logs.length ? Math.max(...logs.map((l) => l.ts)) : null },
    ...friends.map((f) => ({ ...f, pct: pctOf(f.total, f.goal) })),
  ];

  /* ---- mood ---- */
  const pickMood = (k) => {
    setMood(k);
  };

  const switchTab = (id) => {
    setTab(id);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return (
    <div className="min-h-screen bg-emerald-50 font-sans text-slate-800">
      <style>{STYLES}</style>
      <div className="relative max-w-md mx-auto min-h-screen h-screen flex flex-col shadow-2xl rounded-3xl overflow-hidden border border-amber-900/10 bg-slate-50">
        {/* Brand bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white">
              <Leaf size={16} />
            </div>
            <span className="font-extrabold text-slate-800 tracking-tight">CapySpa</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Droplets size={14} className="text-sky-600" />
            {fmt(totalNet)} / {fmt(GOAL)} ml
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto cs-noscroll">
          {tab === 'home' && (
            <HomeTab
              total={totalNet}
              pct={pct}
              stage={stage}
              streak={streak}
              onQuickAdd={(t, v) => addLog(t, v)}
              onCustom={() => setCustomOpen(true)}
              onCapyTap={tapCapy}
              squish={squish}
              hearts={hearts}
              pulseKey={pulseKey}
            />
          )}
          {tab === 'log' && <LogTab logs={logs} totalVol={totalVol} totalNet={totalNet} onUpdate={updateLog} onDelete={deleteLog} onCustom={() => setCustomOpen(true)} />}
          {tab === 'stats' && <AnalyticsTab logs={logs} total={totalNet} pct={pct} mood={mood} onMood={pickMood} onQuickWater={() => addLog('water', 250)} />}
          {tab === 'squad' && <SquadTab members={members} splashing={splashing} nudged={nudged} onSplash={splashFriend} feed={feed} now={now} />}
        </div>

        {/* Bottom nav */}
        <nav className="shrink-0 bg-white border-t border-slate-100 px-2 pt-1.5 pb-2 grid grid-cols-4">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <button key={id} onClick={() => switchTab(id)} className={`flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition ${on ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`} aria-current={on ? 'page' : undefined}>
                <div className={`px-4 py-1 rounded-full transition ${on ? 'bg-sky-50' : ''}`}>
                  <Icon size={20} strokeWidth={on ? 2.5 : 2} />
                </div>
                <span className={`text-xs ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </nav>

        <Toast toast={toast} onAction={runToastAction} position={tab === 'home' ? 'top-16' : 'bottom-24'} />
        <CustomDrawer open={customOpen} onClose={() => setCustomOpen(false)} onAdd={addLog} />
        {confetti > 0 && <Confetti burst={confetti} />}
      </div>
    </div>
  );
}
