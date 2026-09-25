import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchShopifyProducts, testShopifyConnection } from './shopify'

describe('Shopify Commerce Integration', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('queries Shopify products.json with limit=250 to batch fetch all store items', async () => {
    let capturedUrl = ''

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/admin/api/2024-01/shop.json')) {
        return {
          ok: true,
          json: async () => ({ shop: { name: 'Test Shop', currency: 'EUR' } }),
        } as Response
      }

      if (url.includes('/admin/api/2024-01/products.json')) {
        capturedUrl = url
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            products: [
              {
                id: 101,
                title: 'Draft Product',
                handle: 'draft-product',
                status: 'draft',
                variants: [{ id: 201, price: '29.99', sku: 'SKU-DRAFT', inventory_quantity: 10 }],
                images: [{ id: 301, src: 'https://cdn.shopify.com/draft.jpg' }],
              },
            ],
          }),
        } as unknown as Response
      }

      return { ok: false, status: 404 } as Response
    })

    const res = await fetchShopifyProducts({
      shopDomain: 'myshop.myshopify.com',
      accessToken: 'shpat_test_token',
    })

    expect(capturedUrl).toContain('limit=250')
    expect(res.products).toHaveLength(1)
    expect(res.products[0].title).toBe('Draft Product')
    expect(res.products[0].currency).toBe('EUR')
    expect(res.products[0].price).toBe(29.99)
  })

  it('normalizes multi-variant products into individual items for WhatsApp catalog', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('shop.json')) {
        return {
          ok: true,
          json: async () => ({ shop: { name: 'Apparel Co', currency: 'USD' } }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          products: [
            {
              id: 500,
              title: 'Classic T-Shirt',
              handle: 'classic-tshirt',
              status: 'active',
              images: [
                { id: 901, src: 'https://cdn.shopify.com/black.jpg' },
                { id: 902, src: 'https://cdn.shopify.com/white.jpg' },
              ],
              variants: [
                {
                  id: 701,
                  title: 'Black / M',
                  price: '25.00',
                  sku: 'TS-BLK-M',
                  inventory_quantity: 5,
                  image_id: 901,
                },
                {
                  id: 702,
                  title: 'White / L',
                  price: '28.00',
                  sku: 'TS-WHT-L',
                  inventory_quantity: 0,
                  image_id: 902,
                },
              ],
            },
          ],
        }),
      } as unknown as Response
    })

    const res = await fetchShopifyProducts({
      shopDomain: 'apparel.myshopify.com',
      accessToken: 'shpat_token',
    })

    expect(res.products).toHaveLength(2)

    // Variant 1 (In stock)
    expect(res.products[0].retailer_id).toBe('TS-BLK-M')
    expect(res.products[0].title).toBe('Classic T-Shirt - Black / M')
    expect(res.products[0].price).toBe(25)
    expect(res.products[0].availability).toBe('in stock')
    expect(res.products[0].image_url).toBe('https://cdn.shopify.com/black.jpg')
    expect(res.products[0].url).toContain('variant=701')

    // Variant 2 (Out of stock)
    expect(res.products[1].retailer_id).toBe('TS-WHT-L')
    expect(res.products[1].title).toBe('Classic T-Shirt - White / L')
    expect(res.products[1].price).toBe(28)
    expect(res.products[1].availability).toBe('out of stock')
    expect(res.products[1].image_url).toBe('https://cdn.shopify.com/white.jpg')
    expect(res.products[1].url).toContain('variant=702')
  })

  it('prevents duplicate retailer_id collisions when SKUs are identical or missing', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('shop.json')) {
        return {
          ok: true,
          json: async () => ({ shop: { name: 'Collisions Store', currency: 'USD' } }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          products: [
            {
              id: 1,
              title: 'Product 1',
              handle: 'prod-1',
              status: 'active',
              variants: [{ id: 11, price: '10', sku: 'SAME-SKU' }],
            },
            {
              id: 2,
              title: 'Product 2',
              handle: 'prod-2',
              status: 'active',
              variants: [{ id: 22, price: '20', sku: 'SAME-SKU' }], // duplicate SKU
            },
            {
              id: 3,
              title: 'Product 3',
              handle: 'prod-3',
              status: 'active',
              variants: [{ id: 33, price: '30', sku: '' }], // empty SKU
            },
          ],
        }),
      } as unknown as Response
    })

    const res = await fetchShopifyProducts({
      shopDomain: 'store.myshopify.com',
      accessToken: 'token',
    })

    expect(res.products).toHaveLength(3)
    const ids = res.products.map((p) => p.retailer_id)
    // Guarantee all 3 have distinct IDs
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(3)
    expect(ids[0]).toBe('SAME-SKU')
    expect(ids[1]).toBe('shopify_2_22')
    expect(ids[2]).toBe('shopify_3_33')
  })

  it('paginates through Link header rel="next" to fetch all pages', async () => {
    let callCount = 0

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('shop.json')) {
        return {
          ok: true,
          json: async () => ({ shop: { name: 'Big Store', currency: 'USD' } }),
        } as Response
      }

      callCount++
      if (callCount === 1) {
        const headers = new Headers()
        headers.set(
          'link',
          '<https://bigstore.myshopify.com/admin/api/2024-01/products.json?limit=250&page_info=page2_cursor>; rel="next"'
        )
        return {
          ok: true,
          status: 200,
          headers,
          json: async () => ({
            products: [{ id: 1, title: 'Page 1 Product', variants: [{ id: 10, price: '10' }] }],
          }),
        } as unknown as Response
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          products: [{ id: 2, title: 'Page 2 Product', variants: [{ id: 20, price: '20' }] }],
        }),
      } as unknown as Response
    })

    const res = await fetchShopifyProducts({
      shopDomain: 'bigstore.myshopify.com',
      accessToken: 'token',
    })

    expect(res.products).toHaveLength(2)
    expect(res.products[0].title).toBe('Page 1 Product')
    expect(res.products[1].title).toBe('Page 2 Product')
  })
})
