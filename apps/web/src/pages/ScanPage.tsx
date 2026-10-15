import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Field } from '@/components/Field'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { anypayPath } from '@/lib/scan'

type CameraState = 'starting' | 'scanning' | 'unavailable'

/**
 * The in-app QR scanner, for installed apps that can't hand off to the camera app, and for
 * scanning a voucher at the till. qr-scanner (~16 KB) loads only when this screen opens, and
 * uses the phone's built-in barcode reader where there is one.
 */
export function Component() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>('starting')
  const [pasted, setPasted] = useState('')
  const [notAnyPay, setNotAnyPay] = useState(false)

  const open = useCallback(
    (scanned: string) => {
      const path = anypayPath(scanned)
      if (path) void navigate(path)
      else setNotAnyPay(true)
    },
    [navigate],
  )

  useEffect(() => {
    let stop = () => undefined as void
    let active = true
    void import('qr-scanner')
      .then(async ({ default: QrScanner }) => {
        if (!active || !video.current) return
        const scanner = new QrScanner(video.current, (result) => open(result.data), {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          highlightScanRegion: true,
        })
        stop = () => scanner.destroy()
        await scanner.start()
        if (active) setCamera('scanning')
      })
      .catch(() => {
        if (active) setCamera('unavailable')
      })
    return () => {
      active = false
      stop()
    }
  }, [open])

  function submit(event: FormEvent) {
    event.preventDefault()
    open(pasted)
  }

  return (
    <Page title={t('scan.title')} back="/">
      <div className="relative mt-6 aspect-square w-full overflow-hidden rounded-card bg-black">
        {/* The camera picture; the code's meaning is announced below, not shown in it. */}
        <video
          ref={video}
          muted
          playsInline
          aria-hidden="true"
          className="size-full object-cover"
        />
      </div>
      <p aria-live="polite" className="mt-4 text-center text-muted-foreground">
        {camera === 'starting' && t('scan.starting')}
        {camera === 'scanning' && t('scan.hint')}
        {camera === 'unavailable' && t('scan.noCamera')}
      </p>
      {notAnyPay && (
        <p role="alert" className="mt-4 rounded-card bg-card px-5 py-4 text-destructive">
          {t('scan.notAnyPay')}
        </p>
      )}
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
        <Field
          label={t('scan.pasteLabel')}
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button type="submit" size="lg" variant="secondary" disabled={!pasted.trim()}>
          {t('scan.open')}
        </Button>
      </form>
    </Page>
  )
}
