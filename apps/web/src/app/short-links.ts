import { redirect, type RouteObject } from 'react-router'

const payPath = (shopId = '') => `/shop/${encodeURIComponent(shopId)}/pay`

/**
 * Short links for posters, messages and the GitHub page. A shorter link is a smaller QR code,
 * which cheap cameras read faster; the long forms stay valid for posters already printed.
 */
export const shortLinkRoutes: RouteObject[] = [
  { path: 'start', loader: () => redirect('/merchant/new') },
  { path: 's/:shopId', loader: ({ params }) => redirect(payPath(params.shopId)) },
  { path: 'shop/:shopId', loader: ({ params }) => redirect(payPath(params.shopId)) },
]
