// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, setUpPageTests } from '@/testing/fakes'
import { DemoBanner } from './DemoBanner'

setUpPageTests()

describe('DemoBanner', () => {
  // The config is fetched once per page load, so one scenario per file.
  it('warns that the money is not real when the API runs in demo mode', async () => {
    const calls = fakeApi({ 'GET /api/config': { body: { demoMode: true, version: '0.1.0' } } })
    const { container } = render(<DemoBanner />)
    expect(container.textContent).toBe('')
    expect(await screen.findByText('Demo mode · test money only')).toBeTruthy()

    render(<DemoBanner />)
    await waitFor(() => expect(screen.getAllByText('Demo mode · test money only')).toHaveLength(2))
    expect(calls).toHaveLength(1)
  })
})
