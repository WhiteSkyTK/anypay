interface LogoMarkProps {
  className?: string
}

/** The AnyPay mark (same artwork as public/favicon.svg). Brand colours, so it isn't themed. */
export function LogoMark({ className }: Readonly<LogoMarkProps>) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
      <rect width="512" height="512" rx="120" fill="#1f4d3a" />
      <path
        d="M160 376 256 136l96 240M196 296h120"
        fill="none"
        stroke="#f5f2ea"
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
