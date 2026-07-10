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

/**
 * 結帳前驗證，回傳錯誤訊息字串；無誤回傳 null
 */
export const validatePayment = ({ cart, remaining }) => {
  if (cart.length === 0) return '購物車是空的，請先加入商品'
  if (Math.round(remaining) > 0) return '付款金額合計未達應付總額'
  return null
}
