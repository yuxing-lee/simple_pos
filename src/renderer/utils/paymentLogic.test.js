import { describe, it, expect } from 'vitest'
import {
  calcSubtotal,
  calcCartTotal,
  calcCartDiscount,
  calcTotalPaid,
  calcRemaining,
  calcCashDue,
  calcCashChange,
  validatePayment,
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

// ─── calcCashDue ─────────────────────────────────────────────────────────────

describe('calcCashDue', () => {
  it('僅現金付款，精確付款', () => {
    // total=100, cashAmount=100, remaining=0
    expect(calcCashDue(0, 100)).toBe(100)
  })

  it('現金 + 其他方式分攤', () => {
    // total=100, Linepay=20, 現金=80, remaining=0
    expect(calcCashDue(0, 80)).toBe(80)
  })

  it('其他方式部分超付，現金實際應付減少', () => {
    // total=100, Linepay=50, 現金=80, totalPaid=130, remaining=-30
    expect(calcCashDue(-30, 80)).toBe(50) // max(0, -30+80)
  })

  it('非現金已全額支付，cashDue 為 0', () => {
    // total=100, Linepay=150, 現金=50, remaining=-100
    expect(calcCashDue(-100, 50)).toBe(0) // max(0, -100+50) = max(0,-50) = 0
  })

  it('現金超付（無其他方式）', () => {
    // total=100, 現金=150, remaining=-50
    expect(calcCashDue(-50, 150)).toBe(100) // max(0, -50+150)
  })

  it('截圖情境：多方式付款 + 現金大額超付', () => {
    // total=3448, 現金=4000, Linepay=100, 街口=200, 銀行=200
    // totalPaid=4500, remaining=-1052
    expect(calcCashDue(-1052, 4000)).toBe(2948) // max(0, -1052+4000)
  })
})

// ─── calcCashChange ──────────────────────────────────────────────────────────

describe('calcCashChange', () => {
  it('cashAmount 為 0，回傳 null', () => {
    expect(calcCashChange(0, 0, 0, '')).toBeNull()
  })

  it('精確付款且未填客付現金，回傳 null（不需找零）', () => {
    // cashAmount=100, cashDue=100
    expect(calcCashChange(100, 0, 100, '')).toBeNull()
  })

  it('現金超付（未填客付現金）', () => {
    // total=100, 現金=150, cashDue=100
    expect(calcCashChange(150, 0, 100, '')).toBe(50)
  })

  it('現金超付，浮點數邊界：remaining=-0.5 應回傳 1 而非 0', () => {
    // total=4.5, 現金=5, cashDue=4.5, cashAmount=5 > cashDue=4.5
    // Math.round(5 - 4.5) = Math.round(0.5) = 1
    expect(calcCashChange(5, 0, 4.5, '')).toBe(1)
  })

  it('已填客付現金，找零含浮點數時應四捨五入', () => {
    // cashDue 因浮點加購費而帶小數：1000 - 649.5 = 350.5 → 應 round 為 351
    expect(calcCashChange(649.5, 1000, 649.5, '1000')).toBe(351)
  })

  it('已填客付現金，精確給付', () => {
    expect(calcCashChange(100, 100, 100, '100')).toBe(0)
  })

  it('已填客付現金，給大鈔', () => {
    // 現金=100, 客付=500, cashDue=100
    expect(calcCashChange(100, 500, 100, '500')).toBe(400)
  })

  it('已填客付現金且不足（負數）', () => {
    // 客付 80 < cashDue 100
    expect(calcCashChange(100, 80, 100, '80')).toBe(-20)
  })

  it('截圖情境：多方式付款 + 客付現金 5000', () => {
    // cashAmount=4000, cashReceivedAmt=5000, cashDue=2948
    expect(calcCashChange(4000, 5000, 2948, '5000')).toBe(2052)
  })

  it('非現金完全覆蓋，客付現金全額退還', () => {
    // total=100, Linepay=150, 現金=50, cashDue=0
    // 客付現金=50
    expect(calcCashChange(50, 50, 0, '50')).toBe(50)
  })
})

// ─── validatePayment ─────────────────────────────────────────────────────────

describe('validatePayment', () => {
  const mockItem = { productId: '1', name: '商品', price: 100, quantity: 1, subtotal: 100 }
  const base = {
    cart: [mockItem],
    remaining: 0,
    cashAmount: 100,
    cashReceivedAmt: 0,
    cashReceived: '',
    cashDue: 100,
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
    expect(validatePayment({ ...base, remaining: -50, cashDue: 100 })).toBeNull()
  })

  it('已填客付現金且不足', () => {
    expect(validatePayment({
      ...base,
      cashReceived: '80',
      cashReceivedAmt: 80,
      cashDue: 100,
    })).toBe('現金收款金額不足')
  })

  it('已填客付現金且充足（>= cashDue 但 < cashAmount）應允許結帳', () => {
    // Bug 修正驗證：cashReceivedAmt=3500 >= cashDue=2948，但 < cashAmount=4000
    expect(validatePayment({
      cart: [mockItem],
      remaining: -1052,
      cashAmount: 4000,
      cashReceivedAmt: 3500,
      cashReceived: '3500',
      cashDue: 2948,
    })).toBeNull()
  })

  it('未填客付現金不觸發現金不足驗證', () => {
    expect(validatePayment({ ...base, cashReceived: '', cashReceivedAmt: 0 })).toBeNull()
  })
})
