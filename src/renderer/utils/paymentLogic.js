export const PAYMENT_METHODS = ['現金', 'Linepay', '街口支付', '銀行轉帳']

/**
 * 計算商品小計，discountCash 為固定折現金額（NT$）
 */
export const calcSubtotal = (price, quantity, addonFee = 0, discountCash = 0) =>
  Math.max(0, price * quantity - discountCash) + (addonFee || 0)

/** 購物車商品金額總計（折扣後） */
export const calcCartTotal = (cart) =>
  cart.reduce((sum, item) => sum + item.subtotal, 0)

/** 購物車折扣金額總計 */
export const calcCartDiscount = (cart) =>
  cart.reduce((sum, item) =>
    sum + Math.min(item.discountCash || 0, item.price * item.quantity)
  , 0)

/** 各付款方式已填入金額合計 */
export const calcTotalPaid = (payments) =>
  PAYMENT_METHODS.reduce((sum, m) => sum + (parseFloat(payments[m]) || 0), 0)

/** 未付餘額（負數 = 超付） */
export const calcRemaining = (total, totalPaid) => total - totalPaid

/** 點擊「填入剩餘金額」時，指定付款方式應填入的金額（其餘方式已付金額扣除後的餘額，下限為 0） */
export const calcFillAmount = (payments, total, method) => {
  const othersTotal = PAYMENT_METHODS
    .filter(m => m !== method)
    .reduce((sum, m) => sum + (parseFloat(payments[m]) || 0), 0)
  return Math.max(0, total - othersTotal)
}

/**
 * 將超付金額從現金付款中扣除，回傳找零金額，確保 payments 加總等於訂單總額。
 * 非現金付款方式（Linepay、街口支付、銀行轉帳等）視為實收金額，不產生找零。
 */
export const splitCashChange = (activePayments, total) => {
  const nonCashTotal = activePayments
    .filter(p => p.method !== '現金')
    .reduce((sum, p) => sum + p.amount, 0)
  const cashPayment = activePayments.find(p => p.method === '現金')

  if (!cashPayment) return { payments: activePayments, change: 0 }

  const requiredCash = Math.max(0, total - nonCashTotal)
  const change = Math.max(0, cashPayment.amount - requiredCash)

  if (change === 0) return { payments: activePayments, change: 0 }

  const payments = activePayments.map(p =>
    p.method === '現金' ? { ...p, amount: p.amount - change } : p
  )
  return { payments, change }
}

/**
 * 結帳前驗證，回傳錯誤訊息字串；無誤回傳 null。
 * 超付僅能透過現金找零吸收（見 splitCashChange），非現金付款方式無法退款，
 * 因此若非現金付款合計已超過應付總額（不論現金是否有填），一律擋下結帳。
 */
export const validatePayment = ({ cart, remaining, payments, total }) => {
  if (cart.length === 0) return '購物車是空的，請先加入商品'
  if (Math.round(remaining) > 0) return '付款金額合計未達應付總額'
  if (payments && total != null) {
    const nonCashTotal = PAYMENT_METHODS
      .filter(m => m !== '現金')
      .reduce((sum, m) => sum + (parseFloat(payments[m]) || 0), 0)
    if (nonCashTotal > total) return '非現金付款方式合計已超過應付總額，找零僅能以現金退還，請調整金額'
  }
  return null
}
