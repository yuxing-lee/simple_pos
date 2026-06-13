import { describe, it, expect } from 'vitest'
import { cartAddItem, cartUpdateQuantity, cartSetQuantity, cartSetAddonFee, cartSetDiscount } from './cartLogic'

const item = (overrides = {}) => ({
  productId: 'p1', name: '玫瑰花束', price: 200, quantity: 1, addonFee: 0, discountCash: 0, subtotal: 200,
  ...overrides,
})

const product = (overrides = {}) => ({
  id: 'p1', name: '玫瑰花束', price: 200,
  ...overrides,
})

// ─── cartAddItem ─────────────────────────────────────────────────────────────

describe('cartAddItem', () => {
  it('空購物車加入新商品，初始數量為 1', () => {
    const result = cartAddItem([], product())
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ productId: 'p1', quantity: 1, addonFee: 0, discountCash: 0, subtotal: 200 })
  })

  it('新商品 subtotal = price × 1', () => {
    const result = cartAddItem([], product({ price: 350 }))
    expect(result[0].subtotal).toBe(350)
  })

  it('重複加入同一商品，數量 +1', () => {
    const cart = [item()]
    const result = cartAddItem(cart, product())
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(2)
  })

  it('重複加入時 subtotal 正確重算', () => {
    const cart = [item({ price: 200, quantity: 1, subtotal: 200 })]
    const result = cartAddItem(cart, product({ price: 200 }))
    expect(result[0].subtotal).toBe(400)
  })

  it('重複加入時保留原有的 addonFee', () => {
    const cart = [item({ addonFee: 50, subtotal: 250 })]
    const result = cartAddItem(cart, product())
    // qty=2, addonFee=50: (200*2) + 50 = 450
    expect(result[0].quantity).toBe(2)
    expect(result[0].subtotal).toBe(450)
  })

  it('重複加入時保留原有的 discountCash', () => {
    const cart = [item({ discountCash: 30, subtotal: 170 })]
    const result = cartAddItem(cart, product())
    // qty=2, discount=30: max(0, 200*2 - 30) = 370
    expect(result[0].quantity).toBe(2)
    expect(result[0].subtotal).toBe(370)
  })

  it('加入不同商品，各自獨立', () => {
    const cart = [item()]
    const result = cartAddItem(cart, product({ id: 'p2', name: '百合', price: 300 }))
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ productId: 'p2', quantity: 1, subtotal: 300 })
  })
})

// ─── cartUpdateQuantity ───────────────────────────────────────────────────────

describe('cartUpdateQuantity', () => {
  it('+1 正確增加數量', () => {
    const result = cartUpdateQuantity([item()], 'p1', 1)
    expect(result[0].quantity).toBe(2)
  })

  it('+1 正確更新 subtotal', () => {
    const result = cartUpdateQuantity([item({ price: 200 })], 'p1', 1)
    expect(result[0].subtotal).toBe(400)
  })

  it('-1 正確減少數量', () => {
    const result = cartUpdateQuantity([item({ quantity: 3, subtotal: 600 })], 'p1', -1)
    expect(result[0].quantity).toBe(2)
    expect(result[0].subtotal).toBe(400)
  })

  it('數量為 1 時 -1 應移除該商品', () => {
    const result = cartUpdateQuantity([item()], 'p1', -1)
    expect(result).toHaveLength(0)
  })

  it('數量 -2 超過現有數量時也應移除', () => {
    const result = cartUpdateQuantity([item()], 'p1', -2)
    expect(result).toHaveLength(0)
  })

  it('只影響指定 productId，其他商品不變', () => {
    const cart = [item(), item({ productId: 'p2', name: '百合', price: 300, subtotal: 300 })]
    const result = cartUpdateQuantity(cart, 'p1', 1)
    expect(result.find(i => i.productId === 'p2').quantity).toBe(1)
  })

  it('+1 時保留 addonFee 並正確計算 subtotal', () => {
    const cart = [item({ addonFee: 50, subtotal: 250 })]
    const result = cartUpdateQuantity(cart, 'p1', 1)
    // qty=2, addonFee=50: (200*2) + 50 = 450
    expect(result[0].subtotal).toBe(450)
  })

  it('+1 時保留 discountCash 並正確計算 subtotal', () => {
    const cart = [item({ discountCash: 50, subtotal: 150 })]
    const result = cartUpdateQuantity(cart, 'p1', 1)
    // qty=2, discount=50: max(0, 200*2 - 50) = 350
    expect(result[0].subtotal).toBe(350)
  })
})

// ─── cartSetQuantity ──────────────────────────────────────────────────────────

describe('cartSetQuantity', () => {
  it('設定正整數，更新數量與 subtotal', () => {
    const result = cartSetQuantity([item()], 'p1', '5')
    expect(result[0].quantity).toBe(5)
    expect(result[0].subtotal).toBe(1000)
  })

  it('設定為 0，購物車不變', () => {
    const cart = [item()]
    expect(cartSetQuantity(cart, 'p1', '0')).toStrictEqual(cart)
  })

  it('設定為 -1，購物車不變', () => {
    const cart = [item()]
    expect(cartSetQuantity(cart, 'p1', '-1')).toStrictEqual(cart)
  })

  it('設定為空字串，購物車不變', () => {
    const cart = [item()]
    expect(cartSetQuantity(cart, 'p1', '')).toStrictEqual(cart)
  })

  it('設定為非數字字串，購物車不變', () => {
    const cart = [item()]
    expect(cartSetQuantity(cart, 'p1', 'abc')).toStrictEqual(cart)
  })

  it('小數字串（2.9）parseInt 後視為 2', () => {
    const result = cartSetQuantity([item()], 'p1', '2.9')
    expect(result[0].quantity).toBe(2)
    expect(result[0].subtotal).toBe(400)
  })

  it('只影響指定 productId', () => {
    const cart = [item(), item({ productId: 'p2', name: '百合', price: 300, subtotal: 300 })]
    const result = cartSetQuantity(cart, 'p1', '3')
    expect(result.find(i => i.productId === 'p2').quantity).toBe(1)
  })

  it('設定數量時保留 addonFee', () => {
    const cart = [item({ addonFee: 50, subtotal: 250 })]
    const result = cartSetQuantity(cart, 'p1', '3')
    // qty=3, addonFee=50: (200*3) + 50 = 650
    expect(result[0].subtotal).toBe(650)
  })
})

// ─── cartSetAddonFee ──────────────────────────────────────────────────────────

describe('cartSetAddonFee', () => {
  it('設定加購費用，更新 addonFee 與 subtotal', () => {
    const result = cartSetAddonFee([item()], 'p1', '80')
    expect(result[0].addonFee).toBe(80)
    expect(result[0].subtotal).toBe(280)
  })

  it('加購費用設為 0', () => {
    const cart = [item({ addonFee: 50, subtotal: 250 })]
    const result = cartSetAddonFee(cart, 'p1', '0')
    expect(result[0].addonFee).toBe(0)
    expect(result[0].subtotal).toBe(200)
  })

  it('小數四捨五入', () => {
    const result = cartSetAddonFee([item()], 'p1', '30.6')
    expect(result[0].addonFee).toBe(31)
  })

  it('負數不更新，購物車不變', () => {
    const cart = [item()]
    expect(cartSetAddonFee(cart, 'p1', '-50')).toStrictEqual(cart)
  })

  it('只影響指定 productId', () => {
    const cart = [item(), item({ productId: 'p2', name: '百合', price: 300, subtotal: 300 })]
    const result = cartSetAddonFee(cart, 'p1', '100')
    expect(result.find(i => i.productId === 'p2').addonFee).toBe(0)
  })

  it('保留既有 discountCash 計算 subtotal', () => {
    const cart = [item({ discountCash: 30, subtotal: 170 })]
    const result = cartSetAddonFee(cart, 'p1', '50')
    // max(0, 200-30) + 50 = 220
    expect(result[0].subtotal).toBe(220)
  })
})

// ─── cartSetDiscount ──────────────────────────────────────────────────────────

describe('cartSetDiscount', () => {
  it('設定折扣金額，更新 discountCash 與 subtotal', () => {
    const result = cartSetDiscount([item()], 'p1', '50')
    expect(result[0].discountCash).toBe(50)
    expect(result[0].subtotal).toBe(150)
  })

  it('折扣設為 0', () => {
    const cart = [item({ discountCash: 50, subtotal: 150 })]
    const result = cartSetDiscount(cart, 'p1', '0')
    expect(result[0].discountCash).toBe(0)
    expect(result[0].subtotal).toBe(200)
  })

  it('折扣超過商品金額，subtotal 為 0（不含加購費用）', () => {
    const result = cartSetDiscount([item()], 'p1', '999')
    expect(result[0].subtotal).toBe(0)
  })

  it('折扣超過商品金額但有加購費用，subtotal 等於加購費用', () => {
    const cart = [item({ addonFee: 30, subtotal: 230 })]
    const result = cartSetDiscount(cart, 'p1', '999')
    expect(result[0].subtotal).toBe(30)
  })

  it('小數四捨五入', () => {
    const result = cartSetDiscount([item()], 'p1', '20.5')
    expect(result[0].discountCash).toBe(21)
  })

  it('負數不更新，購物車不變', () => {
    const cart = [item()]
    expect(cartSetDiscount(cart, 'p1', '-10')).toStrictEqual(cart)
  })

  it('只影響指定 productId', () => {
    const cart = [item(), item({ productId: 'p2', name: '百合', price: 300, subtotal: 300 })]
    const result = cartSetDiscount(cart, 'p1', '50')
    expect(result.find(i => i.productId === 'p2').discountCash).toBe(0)
  })

  it('保留既有 addonFee 計算 subtotal', () => {
    const cart = [item({ addonFee: 50, subtotal: 250 })]
    const result = cartSetDiscount(cart, 'p1', '30')
    // max(0, 200-30) + 50 = 220
    expect(result[0].subtotal).toBe(220)
  })
})
