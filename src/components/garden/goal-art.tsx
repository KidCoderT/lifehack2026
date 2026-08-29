/**
 * Flat artwork for each community goal — the one decorative element in the palette,
 * fenced by the "Goal banner" note in DESIGN.md.
 *
 * The fence that matters: `plot-hot` and `flag` are the app's alarm channel, and this
 * art sits directly above a plot where amber means "wasting energy". Decorative amber
 * here reads as a false positive, so these scenes use ONLY the neutral and growth
 * tokens: surface-muted, surface, plot, plot-edge, foreground, primary, bark, canopy,
 * canopy-deep. No plot-hot, no flag, no hex, no gradients, no opacity.
 *
 * Each scene depicts the REWARD (groups.goal_title), not the group's emoji — Solar
 * Squad gets a rollercoaster, not a sun.
 *
 * To swap in real artwork: drop a square PNG (>=160px) in public/goal-art/ and add the
 * group name to PNG below. Plain <img>, never next/image — same call as ui/Avatar, so
 * next.config.ts needs no images config.
 */

const PNG: Record<string, string> = {
  // "Solar Squad": "/goal-art/solar-squad.png",
};

// Keyed by groups.name, not groups.id: schema.sql joins group vouchers by name
// "to dodge serial-id drift", so the serial is not stable across a reseed.
const SCENES: Record<string, () => React.ReactElement> = {
  "Solar Squad": Coaster,
  "Compost Crew": Padlock,
  "Tide Turners": Wave,
};

/**
 * Universal Studios group discount.
 *
 * The vertical struts are load-bearing, not decoration: without them a curved track
 * reads as a line chart, which is exactly the wrong thing in an app full of charts.
 * Struts + a car with wheels are what make it a rollercoaster.
 */
function Coaster() {
  const track = "M6 30 C 6 18, 24 16, 30 40 C 34 58, 46 60, 54 44 C 58 36, 66 34, 74 40";
  return (
    <>
      {/* scaffolding first, so the track paints over it */}
      <path
        d="M14 21 v41 M30 40 v22 M42 55 v7 M54 44 v18 M66 36 v26"
        strokeWidth={2.5}
        className="stroke-plot-edge"
      />
      <path d="M14 34 L30 47 M54 50 L66 44" strokeWidth={2} className="stroke-plot-edge" />
      <path
        d={track}
        fill="none"
        strokeWidth={3.5}
        strokeLinecap="round"
        className="stroke-foreground"
      />
      {/* car cresting the first drop */}
      <rect
        x={24}
        y={22}
        width={15}
        height={9}
        rx={2.5}
        transform="rotate(28 31.5 26.5)"
        className="fill-primary"
      />
      <circle cx={27} cy={33} r={2.4} className="fill-bark" />
      <circle cx={37} cy={38} r={2.4} className="fill-bark" />
      <rect x={6} y={62} width={68} height={3.5} rx={1.75} className="fill-plot" />
    </>
  );
}

/** Escape room night. */
function Padlock() {
  return (
    <>
      <path
        d="M28 36 v-8 a12 12 0 0 1 24 0 v8"
        fill="none"
        strokeWidth={4}
        strokeLinecap="round"
        className="stroke-foreground"
      />
      <rect x={22} y={36} width={36} height={28} rx={6} className="fill-primary" />
      <circle cx={40} cy={47} r={3.6} className="fill-surface" />
      <path d="M40 49 v6" strokeWidth={3} strokeLinecap="round" className="stroke-surface" />
    </>
  );
}

/** Sentosa beach day. A wave, not a palm — the plot already has 20 trees, a 21st vanishes.
    There is no blue in the palette, so the sea is canopy/canopy-deep. */
function Wave() {
  return (
    <>
      <path
        d="M0 54 C12 46 20 62 32 54 C44 46 52 62 64 54 C70 50 76 52 80 54 L80 80 L0 80 Z"
        className="fill-canopy-deep"
      />
      <path
        d="M0 62 C12 54 20 70 32 62 C44 54 52 70 64 62 C70 58 76 60 80 62 L80 80 L0 80 Z"
        className="fill-canopy"
      />
      <circle cx={20} cy={55} r={2.2} className="fill-surface" />
      <circle cx={46} cy={57} r={2.2} className="fill-surface" />
      <circle cx={66} cy={54} r={2.2} className="fill-surface" />
    </>
  );
}

/** Any group without a scene, so a new community renders instead of crashing. */
function Gift() {
  return (
    <>
      <rect x={18} y={38} width={44} height={26} rx={4} className="fill-primary" />
      <rect x={14} y={30} width={52} height={10} rx={3} className="fill-primary" />
      <path d="M40 30 v34" strokeWidth={4} className="stroke-surface" />
      <circle cx={35} cy={28} r={4} className="fill-primary" />
      <circle cx={45} cy={28} r={4} className="fill-primary" />
    </>
  );
}

export function GoalArt({ group, className = "" }: { group: string; className?: string }) {
  const src = PNG[group];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- static asset, unoptimized on purpose
    return <img src={src} alt="" aria-hidden className={`rounded-2xl object-cover ${className}`} />;
  }

  // Decorative: the goal title is already on screen beside it, so announcing it twice
  // is noise for a screen reader.
  const Scene = SCENES[group] ?? Gift;
  return (
    <svg viewBox="0 0 80 80" aria-hidden className={className}>
      <rect width={80} height={80} rx={16} className="fill-surface-muted" />
      <Scene />
    </svg>
  );
}
