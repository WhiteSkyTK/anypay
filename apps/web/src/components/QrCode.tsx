import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface QrCodeProps {
  value: string
  /** Accessible name, e.g. "QR code to pay Mama T Spaza". */
  label: string
  className?: string
}

interface Matrix {
  size: number
  path: string
}

const QUIET_ZONE = 4 // modules of white border the QR spec asks for

/** One SVG path per row of dark modules: small markup, crisp at any print size. */
function toPath(size: number, data: Uint8Array): string {
  let path = ''
  for (let y = 0; y < size; y++) {
    let x = 0
    while (x < size) {
      if (!data[y * size + x]) {
        x++
        continue
      }
      const start = x
      while (x < size && data[y * size + x]) x++
      path += `M${start} ${y}h${x - start}v1h-${x - start}z`
    }
  }
  return path
}

/**
 * The shop's QR code. Always black on white, whatever the theme: cheap cameras read that most
 * reliably. The QR library loads only on the poster screen, keeping it out of the main bundle.
 */
export function QrCode({ value, label, className }: Readonly<QrCodeProps>) {
  const [matrix, setMatrix] = useState<Matrix | null>(null)

  useEffect(() => {
    let active = true
    void import('qrcode').then(({ default: QR }) => {
      // Level M survives a scuffed or slightly folded poster.
      const { modules } = QR.create(value, { errorCorrectionLevel: 'M' })
      if (active) setMatrix({ size: modules.size, path: toPath(modules.size, modules.data) })
    })
    return () => {
      active = false
    }
  }, [value])

  if (!matrix) {
    return (
      <div aria-hidden="true" className={cn('aspect-square animate-pulse bg-muted', className)} />
    )
  }
  const extent = matrix.size + QUIET_ZONE * 2
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#ffffff" />
      <path d={matrix.path} fill="#000000" />
    </svg>
  )
}
