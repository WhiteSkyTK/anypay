import type {
  CreateShopRequest,
  CreateShopResponse,
  Shop,
  WalletLookupResponse,
} from '@anypay/shared'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { AppError } from '../lib/errors'
import type { ShopRecord, ShopRepository } from '../repositories/shop-repository'
import type { WalletAddressResolver } from './wallet-address-resolver'

const hashToken = (token: string) => createHash('sha256').update(token).digest()

export const toShop = (record: ShopRecord): Shop => ({
  id: record.id,
  name: record.name,
  walletAddress: record.walletAddress,
  assetCode: record.assetCode,
  assetScale: record.assetScale,
})

/**
 * Merchant onboarding (Feature 1): check a wallet address, create the shop, and hand the
 * merchant's phone a token for its live feed. Shop ids are public (they're on the QR poster);
 * the token is what proves "this is my shop".
 */
export class ShopService {
  readonly #shops: ShopRepository
  readonly #wallets: Pick<WalletAddressResolver, 'resolve'>

  constructor(shops: ShopRepository, wallets: Pick<WalletAddressResolver, 'resolve'>) {
    this.#shops = shops
    this.#wallets = wallets
  }

  /** Step 1 of onboarding: is this a real, allowed wallet address, and in what currency? */
  async lookupWallet(walletAddress: string): Promise<WalletLookupResponse> {
    const wallet = await this.#wallets.resolve(walletAddress)
    return {
      walletAddress: wallet.id,
      publicName: wallet.publicName,
      assetCode: wallet.assetCode,
      assetScale: wallet.assetScale,
    }
  }

  async createShop(request: CreateShopRequest): Promise<CreateShopResponse> {
    const wallet = await this.#wallets.resolve(request.walletAddress)
    const merchantToken = randomBytes(32).toString('base64url')
    const record = await this.#shops.create({
      // 8 url-safe characters: short enough for a QR code that scans fast on a cheap camera.
      id: randomBytes(6).toString('base64url'),
      name: request.name,
      walletAddress: wallet.id,
      assetCode: wallet.assetCode,
      assetScale: wallet.assetScale,
      merchantTokenHash: hashToken(merchantToken).toString('hex'),
    })
    return { shop: toShop(record), merchantToken }
  }

  async getShop(id: string): Promise<ShopRecord> {
    const shop = await this.#shops.findById(id)
    if (!shop) throw new AppError('shop_not_found', 'No shop with this code', 404)
    return shop
  }

  /** The shop, if `token` is its merchant token; compared in constant time. */
  async authenticateMerchant(shopId: string, token: string | undefined): Promise<ShopRecord> {
    const shop = await this.getShop(shopId)
    const expected = Buffer.from(shop.merchantTokenHash, 'hex')
    const given = token ? hashToken(token) : Buffer.alloc(expected.length)
    if (!token || !timingSafeEqual(expected, given)) {
      throw new AppError('merchant_unauthorized', 'This phone is not signed in to the shop', 401)
    }
    return shop
  }
}
