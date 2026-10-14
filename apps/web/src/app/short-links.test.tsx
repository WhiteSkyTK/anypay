// @vitest-environment happy-dom
import { waitFor } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { shortLinkRoutes } from './short-links'

async function landsOn(path: string): Promise<string> {
  const router = createMemoryRouter(
    [
      ...shortLinkRoutes,
      { path: 'shop/:shopId/pay', element: null },
      { path: 'merchant/new', element: null },
    ],
    { initialEntries: [path] },
  )
  await waitFor(() => expect(router.state.initialized).toBe(true))
  await waitFor(() => expect(router.state.navigation.state).toBe('idle'))
  return router.state.location.pathname
}

describe('short links', () => {
  it.each([
    ['/s/7KQM4XPA', '/shop/7KQM4XPA/pay'],
    ['/shop/7KQM4XPA', '/shop/7KQM4XPA/pay'],
    ['/start', '/merchant/new'],
  ])('%s opens %s', async (path, target) => {
    expect(await landsOn(path)).toBe(target)
  })

  it('keeps the long pay link that printed posters already carry', async () => {
    expect(await landsOn('/shop/7KQM4XPA/pay')).toBe('/shop/7KQM4XPA/pay')
  })
})
