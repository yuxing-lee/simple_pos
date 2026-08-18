import { describe, it, expect } from 'vitest'
import {
  calcSubtotal,
  calcCartTotal,
  calcCartDiscount,
  calcTotalPaid,
  calcRemaining,
  calcFillAmount,
  validatePayment,
  splitCashChange,
} from './paymentLogic'

// ─── calcSubtotal ───────────────────────────────────────────────────────────

describe('calcSubtotal', () => {
  it('無折現金（全額）', () => {
    expect(calcSubtotal(100, 1)).toBe(100)
  })

  it('數量 > 1', () => {
    expect(calcSubtotal(50, 3)).toBe(150)
  })

  it('含加購費用', () => {
    expect(calcSubtotal(100, 1, 50)).toBe(150)
  })

  it('折現金 50 元', () => {
    expect(calcSubtotal(200, 1, 0, 50)).toBe(150)
  })

  it('多件商品折現金', () => {
    expect(calcSubtotal(100, 3, 0, 50)).toBe(250)
  })

  it('折現金 + 加購費用', () => {
    expect(calcSubtotal(200, 1, 30, 50)).toBe(180) // 200-50+30
  })

  it('折現金超過商品金額時小計為加購費用', () => {
    expect(calcSubtotal(100, 1, 20, 200)).toBe(20) // max(0,100-200)+20
  })

  it('單價為 0', () => {
    expect(calcSubtotal(0, 5)).toBe(0)
  })

  it('addonFee 為 undefined 時視為 0', () => {
    expect(calcSubtotal(100, 1, undefined, 0)).toBe(100)
  })

  it('discountCash 為 0 時，重複加入商品數量不應被錯誤折扣', () => {
    // 模擬 addToCart 重複掃碼：discountCash=0，數量從 1 增為 2
    expect(calcSubtotal(100, 2, 0, 0)).toBe(200)
  })
})

// ─── calcCartTotal ───────────────────────────────────────────────────────────

describe('calcCartTotal', () => {
  it('空購物車回傳 0', () => {
    expect(calcCartTotal([])).toBe(0)
  })

  it('單一商品', () => {
    expect(calcCartTotal([{ subtotal: 200 }])).toBe(200)
  })

  it('多個商品加總', () => {
    const cart = [{ subtotal: 100 }, { subtotal: 250 }, { subtotal: 50 }]
    expect(calcCartTotal(cart)).toBe(400)
  })
})

// ─── calcCartDiscount ────────────────────────────────────────────────────────

describe('calcCartDiscount', () => {
  it('無折現金回傳 0', () => {
    const cart = [{ price: 100, quantity: 1, discountCash: 0 }]
    expect(calcCartDiscount(cart)).toBe(0)
  })

  it('未設 discountCash 欄位預設為 0', () => {
    const cart = [{ price: 100, quantity: 2 }]
    expect(calcCartDiscount(cart)).toBe(0)
  })

  it('單筆折現金', () => {
    const cart = [{ price: 200, quantity: 1, discountCash: 50 }]
    expect(calcCartDiscount(cart)).toBe(50)
  })

  it('折現金超過商品金額，折扣上限為商品金額', () => {
    const cart = [{ price: 100, quantity: 1, discountCash: 300 }]
    expect(calcCartDiscount(cart)).toBe(100)
  })

  it('多筆折現金加總', () => {
    const cart = [
      { price: 100, quantity: 2, discountCash: 30 },
      { price: 200, quantity: 1, discountCash: 50 },
    ]
    expect(calcCartDiscount(cart)).toBe(80)
  })
})

// ─── calcTotalPaid ───────────────────────────────────────────────────────────

describe('calcTotalPaid', () => {
  const empty = { '現金': '', 'Linepay': '', '街口支付': '', '銀行轉帳': '' }

  it('全部空白回傳 0', () => {
    expect(calcTotalPaid(empty)).toBe(0)
  })

  it('只填現金', () => {
    expect(calcTotalPaid({ ...empty, '現金': '500' })).toBe(500)
  })

  it('混合付款方式加總', () => {
    expect(calcTotalPaid({ '現金': '100', 'Linepay': '200', '街口支付': '50', '銀行轉帳': '0' })).toBe(350)
  })

  it('非數字欄位視為 0', () => {
    expect(calcTotalPaid({ ...empty, '現金': 'abc' })).toBe(0)
  })
})

// ─── calcRemaining ───────────────────────────────────────────────────────────

describe('calcRemaining', () => {
  it('精確付款', () => {
    expect(calcRemaining(100, 100)).toBe(0)
  })

  it('未付足（正數）', () => {
    expect(calcRemaining(100, 60)).toBe(40)
  })

  it('超付（負數）', () => {
    expect(calcRemaining(100, 150)).toBe(-50)
  })
})

// ─── validatePayment ─────────────────────────────────────────────────────────

describe('validatePayment', () => {
  const mockItem = { productId: '1', name: '商品', price: 100, quantity: 1, subtotal: 100 }
  const base = {
    cart: [mockItem],
    remaining: 0,
  }

  it('有效結帳（精確付款）回傳 null', () => {
    expect(validatePayment(base)).toBeNull()
  })

  it('購物車為空', () => {
    expect(validatePayment({ ...base, cart: [] }))
      .toBe('購物車是空的，請先加入商品')
  })

  it('未付足', () => {
    expect(validatePayment({ ...base, remaining: 50 }))
      .toBe('付款金額合計未達應付總額')
  })

  it('超付（remaining < 0）允許結帳', () => {
    expect(validatePayment({ ...base, remaining: -50 })).toBeNull()
  })

  it('現金超付（有 payments/total 時）仍允許結帳，找零由現金吸收', () => {
    const payments = { '現金': '500', 'Linepay': '', '街口支付': '', '銀行轉帳': '' }
    expect(validatePayment({ ...base, remaining: -360, payments, total: 140 })).toBeNull()
  })

  it('混合付款超付，只要非現金合計未超過總額就允許結帳', () => {
    const payments = { '現金': '100', 'Linepay': '100', '街口支付': '', '銀行轉帳': '' }
    expect(validatePayment({ ...base, remaining: -60, payments, total: 140 })).toBeNull()
  })

  it('非現金付款方式合計已超過總額（無現金）擋下結帳', () => {
    const payments = { '現金': '', 'Linepay': '200', '街口支付': '', '銀行轉帳': '' }
    expect(validatePayment({ ...base, remaining: -60, payments, total: 140 }))
      .toBe('非現金付款方式合計已超過應付總額，找零僅能以現金退還，請調整金額')
  })

  it('非現金付款方式合計已超過總額，即使另外還有現金也擋下結帳', () => {
    const payments = { '現金': '50', 'Linepay': '200', '街口支付': '', '銀行轉帳': '' }
    expect(validatePayment({ ...base, remaining: -110, payments, total: 140 }))
      .toBe('非現金付款方式合計已超過應付總額，找零僅能以現金退還，請調整金額')
  })

  it('非現金合計剛好等於總額（無超付）時允許結帳', () => {
    const payments = { '現金': '', 'Linepay': '140', '街口支付': '', '銀行轉帳': '' }
    expect(validatePayment({ ...base, remaining: 0, payments, total: 140 })).toBeNull()
  })
})

// ─── calcFillAmount ──────────────────────────────────────────────────────────

describe('calcFillAmount', () => {
  const empty = { '現金': '', 'Linepay': '', '街口支付': '', '銀行轉帳': '' }

  it('無其他付款時，填入全額', () => {
    expect(calcFillAmount(empty, 140, '現金')).toBe(140)
  })

  it('已有其他付款時，填入剩餘金額', () => {
    expect(calcFillAmount({ ...empty, 'Linepay': '100' }, 140, '現金')).toBe(40)
  })

  it('其他付款已達或超過總額時，填入 0（不會出現負數）', () => {
    expect(calcFillAmount({ ...empty, 'Linepay': '200' }, 140, '現金')).toBe(0)
  })

  it('不計入該方式本身已填的金額', () => {
    expect(calcFillAmount({ ...empty, '現金': '999' }, 140, '現金')).toBe(140)
  })
})

// ─── splitCashChange ─────────────────────────────────────────────────────────

describe('splitCashChange', () => {
  it('精確付款時不產生找零，payments 不變', () => {
    const payments = [{ method: '現金', amount: 140 }]
    expect(splitCashChange(payments, 140)).toEqual({ payments, change: 0 })
  })

  it('現金超付時，從現金金額扣除找零，使總額對應訂單總額', () => {
    const payments = [{ method: '現金', amount: 500 }]
    const result = splitCashChange(payments, 140)
    expect(result.change).toBe(360)
    expect(result.payments).toEqual([{ method: '現金', amount: 140 }])
  })

  it('混合付款：非現金金額照實入帳，超付部分只從現金扣除', () => {
    const payments = [
      { method: 'Linepay', amount: 100 },
      { method: '現金', amount: 100 },
    ]
    const result = splitCashChange(payments, 140)
    expect(result.change).toBe(60)
    expect(result.payments).toEqual([
      { method: 'Linepay', amount: 100 },
      { method: '現金', amount: 40 },
    ])
    expect(result.payments.reduce((s, p) => s + p.amount, 0)).toBe(140)
  })

  it('未使用現金付款時不產生找零', () => {
    const payments = [{ method: 'Linepay', amount: 140 }]
    expect(splitCashChange(payments, 140)).toEqual({ payments, change: 0 })
  })

  it('未付足（無超付）時不產生找零', () => {
    const payments = [{ method: '現金', amount: 60 }]
    expect(splitCashChange(payments, 140)).toEqual({ payments, change: 0 })
  })

  it('現金 + 非現金合計未超過總額時不產生找零', () => {
    const payments = [
      { method: 'Linepay', amount: 100 },
      { method: '現金', amount: 40 },
    ]
    expect(splitCashChange(payments, 140)).toEqual({ payments, change: 0 })
  })
})
