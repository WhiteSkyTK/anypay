import { describe, expect, it } from 'vitest'
import { LANGUAGES } from './languages'
import en from './locales/en.json'
import nso from './locales/nso.json'
import xh from './locales/xh.json'
import zu from './locales/zu.json'

type Tree = { [key: string]: string | Tree }

/** { a: { b: 'x' } } → { 'a.b': 'x' } */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string'
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, path) }
  }, {})
}

const placeholders = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()

const english = flatten(en)
const translations = { nso, xh, zu }

it('has a locale file for every language in the picker', () => {
  const shipped = ['en', ...Object.keys(translations)].sort()
  expect(LANGUAGES.map((language) => language.code).sort()).toEqual(shipped)
})

describe.each(Object.entries(translations))('%s', (_code, locale) => {
  const flat = flatten(locale)

  it('has exactly the English keys', () => {
    expect(Object.keys(flat).sort()).toEqual(Object.keys(english).sort())
  })

  it('has no empty strings', () => {
    expect(Object.entries(flat).filter(([, text]) => text.trim() === '')).toEqual([])
  })

  it('keeps every {{placeholder}}', () => {
    for (const [key, text] of Object.entries(english)) {
      expect(placeholders(flat[key] ?? ''), key).toEqual(placeholders(text))
    }
  })

  it('keeps the brand name', () => {
    expect(flat['app.name']).toBe('AnyPay')
  })
})
