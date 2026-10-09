import { eq } from 'drizzle-orm'
import type { Database } from '../db/database'
import { shops } from '../db/schema'

export type ShopRecord = typeof shops.$inferSelect
export type NewShop = Omit<ShopRecord, 'createdAt'>

export class ShopRepository {
  readonly #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  async create(shop: NewShop): Promise<ShopRecord> {
    const [created] = await this.#db.insert(shops).values(shop).returning()
    if (!created) throw new Error('Shop insert returned no row')
    return created
  }

  async findById(id: string): Promise<ShopRecord | undefined> {
    const [shop] = await this.#db.select().from(shops).where(eq(shops.id, id))
    return shop
  }
}
