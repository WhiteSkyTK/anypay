// The offline store's public face. Loaded as one chunk with loadOffline() (lib/offline-flag.ts):
// Dexie is ~30 KB, so it never sits in a page's first load.
export * from './customer'
export * from './merchant'
export * from './outbox'
export { getDb, resetDb } from './store'
export type { MyTabRow, OutboxRow, OutboxState, ShopTabRow } from './store'
