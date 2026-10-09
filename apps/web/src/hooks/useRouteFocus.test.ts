// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { focusHeadingWhenReady } from './useRouteFocus'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

function addHeading(main: HTMLElement): HTMLElement {
  const heading = document.createElement('h1')
  heading.tabIndex = -1
  main.append(heading)
  return heading
}

describe('focusHeadingWhenReady', () => {
  let stop = () => undefined as void

  afterEach(() => {
    stop()
    document.body.replaceChildren()
  })

  function setUp(): HTMLElement {
    const main = document.createElement('main')
    document.body.append(main)
    return main
  }

  it('focuses a heading that is already there', () => {
    const heading = addHeading(setUp())
    stop = focusHeadingWhenReady()
    expect(document.activeElement).toBe(heading)
  })

  it('waits for a page that renders its heading after loading data', async () => {
    const main = setUp()
    stop = focusHeadingWhenReady()
    const heading = addHeading(main)
    await tick()
    expect(document.activeElement).toBe(heading)
  })

  it('leaves focus alone once the user has moved it into the page', async () => {
    const main = setUp()
    stop = focusHeadingWhenReady()
    const input = document.createElement('input')
    main.append(input)
    input.focus()
    await tick()
    addHeading(main)
    await tick()
    expect(document.activeElement).toBe(input)
  })
})
