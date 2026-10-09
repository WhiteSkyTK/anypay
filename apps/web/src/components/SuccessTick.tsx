import { m, useReducedMotion } from 'motion/react'

/** The "paid" moment: a springy circle and a drawn tick, still and instant with reduced motion. */
export function SuccessTick() {
  const reduce = useReducedMotion() ?? false
  return (
    <m.svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className="size-24"
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
    >
      <circle cx="48" cy="48" r="44" className="fill-primary" />
      <m.path
        d="M28 49l13 13 27-29"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.15, duration: 0.3, ease: 'easeOut' }}
      />
    </m.svg>
  )
}
