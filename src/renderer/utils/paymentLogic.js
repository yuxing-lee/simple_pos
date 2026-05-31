export const PAYMENT_METHODS = ['現金', 'Linepay', '街口支付', '銀行轉帳']

/**
 * 計算商品小計
 * - discountType 'percent'：discount 以 10 為滿分（10 = 全額，8 = 八折）
 * - discountType 'cash'：discountCash 為固定折現金額（NT$）
 */
export const calcSubtotal = (price, quantity, addonFee = 0, discount = 10, discountType = 'percent', discountCash = 0) => {
  if (discountType === 'cash') {
    return Math.max(0, price * quantity - discountCash) + (addonFee || 0)
  }
  return price * (discount / 10) * quantity + (addonFee || 0)
}

/** 購物車商品金額總計（折扣後） */
export const calcCartTotal = (cart) =>
  cart.reduce((sum, item) => sum + item.subtotal, 0)

/** 購物車折扣金額總計 */
export const calcCartDiscount = (cart) =>
  cart.reduce((sum, item) => {
    if (item.discountType === 'cash') {
      return sum + Math.min(item.discountCash || 0, item.price * item.quantity)
    }
    const d = item.discount ?? 10
    return sum + item.price * item.quantity * (1 - d / 10)
  }, 0)

/** 各付款方式已填入金額合計 */
export const calcTotalPaid = (payments) =>
  PAYMENT_METHODS.reduce((sum, m) => sum + (parseFloat(payments[m]) || 0), 0)

/** 未付餘額（負數 = 超付） */
export const calcRemaining = (total, totalPaid) => total - totalPaid

/**
 * 現金實際應付金額：總額扣除非現金付款，最少為 0
 * cashDue = max(0, total − nonCashTotal) = max(0, remaining + cashAmount)
 */
export const calcCashDue = (remaining, cashAmount) =>
  Math.max(0, remaining + cashAmount)

/**
 * 應找零金額（null 表示不需找零）
 * - 若已填入「客付現金」：cashReceivedAmt − cashDue
 * - 若未填入但現金超付：Math.round(cashAmount − cashDue)
 * - 其他情況：null
 */
export const calcCashChange = (cashAmount, cashReceivedAmt, cashDue, cashReceived) => {
  if (cashAmount <= 0) return null
  if (cashReceived !== '') return cashReceivedAmt - cashDue
  return cashAmount > cashDue ? Math.round(cashAmount - cashDue) : null
}

/**
 * 結帳前驗證，回傳錯誤訊息字串；無誤回傳 null
 */
export const validatePayment = ({ cart, remaining, cashAmount, cashReceivedAmt, cashReceived, cashDue }) => {
  if (cart.length === 0) return '購物車是空的，請先加入商品'
  if (Math.round(remaining) > 0) return '付款金額合計未達應付總額'
  if (cashAmount > 0 && cashReceived !== '' && cashReceivedAmt < cashDue) return '現金收款金額不足'
  return null
}
