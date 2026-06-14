import { calcSubtotal } from './paymentLogic'

export const cartAddItem = (cart, product) => {
  const existing = cart.find(item => item.productId === product.id)
  if (existing) {
    const newQty = existing.quantity + 1
    return cart.map(item =>
      item.productId === product.id
        ? { ...item, quantity: newQty, subtotal: calcSubtotal(item.price, newQty, item.addonFee, item.discountCash ?? 0) }
        : item
    )
  }
  return [...cart, { productId: product.id, name: product.name, price: product.price, quantity: 1, addonFee: 0, discountCash: 0, subtotal: product.price }]
}

export const cartUpdateQuantity = (cart, productId, delta) =>
  cart.map(item => {
    if (item.productId !== productId) return item
    const newQty = item.quantity + delta
    if (newQty <= 0) return null
    return { ...item, quantity: newQty, subtotal: calcSubtotal(item.price, newQty, item.addonFee, item.discountCash ?? 0) }
  }).filter(Boolean)

export const cartSetQuantity = (cart, productId, qty) => {
  const n = parseInt(qty, 10)
  if (isNaN(n) || n < 1) return cart
  return cart.map(item =>
    item.productId === productId
      ? { ...item, quantity: n, subtotal: calcSubtotal(item.price, n, item.addonFee, item.discountCash ?? 0) }
      : item
  )
}

export const cartSetAddonFee = (cart, productId, fee) => {
  const n = Math.round(parseFloat(fee) || 0)
  if (n < 0) return cart
  return cart.map(item =>
    item.productId === productId
      ? { ...item, addonFee: n, subtotal: calcSubtotal(item.price, item.quantity, n, item.discountCash ?? 0) }
      : item
  )
}

export const cartSetDiscount = (cart, productId, val) => {
  const n = Math.round(parseFloat(val) || 0)
  if (n < 0) return cart
  return cart.map(item =>
    item.productId === productId
      ? { ...item, discountCash: n, subtotal: calcSubtotal(item.price, item.quantity, item.addonFee, n) }
      : item
  )
}
