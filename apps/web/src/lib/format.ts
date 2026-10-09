// Fixed to en-ZA like amounts, so times read the same on the shop's and the customer's phone.
const time = new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' })

export const formatTime = (iso: string) => time.format(new Date(iso))

/** Local midnight: "today" for the shop's feed and totals is the shop's own day. */
export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** A file download from a Blob, e.g. the CSV export. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
