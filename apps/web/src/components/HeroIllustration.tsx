import { cn } from '@/lib/utils'

const QR_ORIGIN = { x: 44, y: 64 }
const MODULE = 12
// A 9×9 QR-like grid; '#' is a dark module. The three corner finder squares are drawn separately.
const QR_ROWS = [
  '...#.#...',
  '....##...',
  '...#.#...',
  '#.#.#..##',
  '.##.#.#.#',
  '#..##.##.',
  '...#.##.#',
  '....#..#.',
  '...##.#.#',
] as const

const modules = QR_ROWS.flatMap((row, y) =>
  [...row].flatMap((cell, x) => (cell === '#' ? [{ x, y }] : [])),
)
const finders = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 0, y: 6 },
]

interface HeroIllustrationProps {
  className?: string
}

/**
 * The whole product in one picture: a shop's QR poster and a customer's phone confirming the
 * payment. Drawn with theme tokens, so it is about 1 KB and needs no image download.
 */
export function HeroIllustration({ className }: Readonly<HeroIllustrationProps>) {
  return (
    <svg viewBox="0 0 280 248" aria-hidden="true" className={cn('overflow-visible', className)}>
      <g>
        <rect
          x="20"
          y="8"
          width="156"
          height="212"
          rx="20"
          strokeWidth="2"
          className="fill-card stroke-border"
        />
        <rect x="40" y="28" width="20" height="20" rx="6" fill="#1f4d3a" />
        <rect
          x="68"
          y="33"
          width="56"
          height="10"
          rx="5"
          className="fill-muted-foreground"
          opacity="0.6"
        />
        {finders.map(({ x, y }) => (
          <g key={`${x}-${y}`}>
            <rect
              x={QR_ORIGIN.x + x * MODULE + 2.5}
              y={QR_ORIGIN.y + y * MODULE + 2.5}
              width="31"
              height="31"
              rx="8"
              fill="none"
              strokeWidth="5"
              className="stroke-foreground"
            />
            <rect
              x={QR_ORIGIN.x + x * MODULE + 11}
              y={QR_ORIGIN.y + y * MODULE + 11}
              width="14"
              height="14"
              rx="3"
              className="fill-foreground"
            />
          </g>
        ))}
        {modules.map(({ x, y }) => (
          <rect
            key={`${x}-${y}`}
            x={QR_ORIGIN.x + x * MODULE + 1}
            y={QR_ORIGIN.y + y * MODULE + 1}
            width="10"
            height="10"
            rx="2.5"
            className="fill-foreground"
          />
        ))}
        <rect x="44" y="188" width="108" height="10" rx="5" className="fill-muted" />
      </g>

      <g className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <rect
          x="156"
          y="92"
          width="104"
          height="152"
          rx="24"
          strokeWidth="3"
          className="fill-background stroke-foreground"
        />
        <rect
          x="190"
          y="104"
          width="36"
          height="6"
          rx="3"
          className="fill-foreground"
          opacity="0.4"
        />
        <g className="origin-center animate-in zoom-in-50 delay-300 duration-500 [transform-box:fill-box]">
          <circle cx="208" cy="152" r="24" className="fill-primary" />
          <path
            d="m196 152 8 8 16-17"
            fill="none"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-primary-foreground"
          />
        </g>
        <rect x="180" y="192" width="56" height="12" rx="6" className="fill-foreground" />
        <rect x="190" y="212" width="36" height="8" rx="4" className="fill-muted-foreground" />
      </g>
    </svg>
  )
}
