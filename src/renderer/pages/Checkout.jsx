import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { cuid } from '../utils/cuid'
import {
  PAYMENT_METHODS,
  calcCartTotal,
  calcCartDiscount,
  calcTotalPaid,
  calcRemaining,
  calcFillAmount,
  validatePayment,
  splitCashChange,
} from '../utils/paymentLogic'
import {
  cartAddItem,
  cartUpdateQuantity,
  cartSetQuantity,
  cartSetAddonFee,
  cartSetDiscount,
  cartRemoveItem,
  buildCustomItem,
} from '../utils/cartLogic'

export default function Checkout() {
  const [products, setProducts] = useState([])
  const [quickSelectIds, setQuickSelectIds] = useState([])
  const [cart, setCart] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [error, setError] = useState('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [payments, setPayments] = useState({ '現金': '', 'Linepay': '', '街口支付': '', '銀行轉帳': '' })

  const barcodeRef = useRef(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    supabase
      .from('Product')
      .select('id, name, price, barcode')
      .eq('visible', true)
      .order('sortOrder', { ascending: true })
      .then(({ data }) => setProducts(data || []))
      .catch(() => {})
    window.api.quickSelect.getAll().then(setQuickSelectIds).catch(() => {})
    barcodeRef.current?.focus()
  }, [])

  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 3000) }

  const addToCart = useCallback((product) => {
    setCart(prev => cartAddItem(prev, product))
  }, [])

  const lookupByBarcode = useCallback(async (code) => {
    const found = products.find(p => p.barcode === code || p.id === code)
    if (found) { addToCart(found); return }
    const { data } = await supabase
      .from('Product')
      .select('id, name, price, barcode')
      .or(`barcode.eq.${code},id.eq.${code}`)
      .eq('visible', true)
      .maybeSingle()
    if (data) {
      setProducts(prev => prev.some(p => p.id === data.id) ? prev : [...prev, data])
      addToCart(data)
    } else {
      showError(`找不到條碼「${code}」對應的商品`)
    }
  }, [products, addToCart])

  const handleBarcodeKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const code = barcodeBuffer.current.trim() || barcodeInput.trim()
      if (barcodeTimer.current) { clearTimeout(barcodeTimer.current); barcodeTimer.current = null }
      barcodeBuffer.current = ''
      if (!code) return
      setBarcodeInput('')
      lookupByBarcode(code)
    }
  }, [barcodeInput, lookupByBarcode])

  const handleBarcodeChange = useCallback((e) => {
    const val = e.target.value
    setBarcodeInput(val)
    barcodeBuffer.current = val
    if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
    barcodeTimer.current = setTimeout(() => {
      const code = barcodeBuffer.current.trim()
      if (code.length >= 3) { lookupByBarcode(code); setBarcodeInput(''); barcodeBuffer.current = '' }
    }, 80)
  }, [lookupByBarcode])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const q = searchQuery.toLowerCase()
    const local = products.filter(p => p.name.toLowerCase().includes(q))
    if (local.length > 0) { setSearchResults(local); return }
    supabase.from('Product').select('id, name, price, barcode')
      .ilike('name', `%${searchQuery.trim()}%`).eq('visible', true).limit(10)
      .then(({ data }) => setSearchResults(data || []))
  }, [searchQuery, products])

  const handleSelectSearchResult = (product) => {
    addToCart(product); setSearchQuery(''); setSearchResults([]); setShowSearch(false); barcodeRef.current?.focus()
  }

  const updateQuantity = (productId, delta) => setCart(prev => cartUpdateQuantity(prev, productId, delta))
  const setQuantity = (productId, qty) => setCart(prev => cartSetQuantity(prev, productId, qty))
  const setAddonFee = (productId, fee) => setCart(prev => cartSetAddonFee(prev, productId, fee))
  const setCashDiscount = (productId, val) => setCart(prev => cartSetDiscount(prev, productId, val))

  const addCustomItem = () => {
    const { item, error } = buildCustomItem({ name: customName, price: customPrice, qty: customQty, id: 'custom_' + cuid() })
    if (error) { showError(error); return }
    setCart(prev => [...prev, item])
    setCustomName('')
    setCustomPrice('')
    setCustomQty('1')
    setShowCustomForm(false)
    barcodeRef.current?.focus()
  }

  const removeFromCart = (productId) => setCart(prev => cartRemoveItem(prev, productId))
  const quickSelectProducts = products.filter(p => quickSelectIds.includes(p.id))
  const total = calcCartTotal(cart)
  const totalAddon = cart.reduce((sum, item) => sum + (item.addonFee || 0), 0)
  const totalDiscount = calcCartDiscount(cart)

  const totalPaid = calcTotalPaid(payments)
  const remaining = calcRemaining(total, totalPaid)

  const handleMethodFill = (method) => {
    const fillAmt = calcFillAmount(payments, total, method)
    if (fillAmt > 0) setPayments(prev => ({ ...prev, [method]: String(fillAmt) }))
  }

  const handleCheckout = () => {
    const err = validatePayment({ cart, remaining, payments, total })
    if (err) { showError(err); return }
    confirmCheckout()
  }

  const confirmCheckout = async () => {
    setIsCheckingOut(true)
    try {
      const rawPayments = PAYMENT_METHODS
        .filter(m => (parseFloat(payments[m]) || 0) > 0)
        .map(m => ({ method: m, amount: parseFloat(payments[m]) }))
      const { payments: activePayments, change } = splitCashChange(rawPayments, total)
      const paymentMethodLabel = activePayments.length === 0 ? '未指定'
        : activePayments.length === 1 ? activePayments[0].method
        : activePayments.map(p => p.method).join(' + ')
      const transaction = {
        id: cuid(), date: new Date().toISOString(), items: cart, total,
        payments: activePayments, paymentMethod: paymentMethodLabel,
        ...(change > 0 ? { change } : {}),
      }
      await window.api.transactions.save(transaction)
      setLastTransaction(transaction)
      setCart([])
      setPayments({ '現金': '', 'Linepay': '', '街口支付': '', '銀行轉帳': '' })
      setCheckoutSuccess(true)
      setTimeout(() => setCheckoutSuccess(false), 5000)
      barcodeRef.current?.focus()
    } catch {
      showError('結帳失敗，請再試一次')
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <>
    <div className="max-w-7xl mx-auto flex gap-5 h-full">
      {/* Left: input + cart */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-500 text-sm tracking-wide flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {checkoutSuccess && lastTransaction && (
          <div className="px-4 py-4 bg-brand-50 border border-brand-200 text-brand-700">
            <div className="flex items-center gap-2 text-sm tracking-wider mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              結帳完成
            </div>
            <p className="text-xs text-brand-500 tracking-wide">
              NT$ {lastTransaction.total.toLocaleString()} · {lastTransaction.items.length} 種商品 · {lastTransaction.paymentMethod}
            </p>
          </div>
        )}

        {/* Barcode input */}
        <div className="bg-white border border-neutral-500/20 shadow-sm p-4">
          <label className="block text-xs tracking-widest uppercase text-neutral-400 mb-3">掃描條碼 / QR Code</label>
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={handleBarcodeChange}
            onKeyDown={handleBarcodeKeyDown}
            placeholder="請掃描條碼或輸入商品編號，按 Enter 加入"
            autoFocus
            className="w-full border border-neutral-500/30 px-4 py-3 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300 text-sm font-light"
          />
        </div>

        {/* Name search */}
        <div className="bg-white border border-neutral-500/20 shadow-sm p-4">
          <label className="block text-xs tracking-widest uppercase text-neutral-400 mb-3">依商品名稱搜尋</label>
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
              onFocus={() => setShowSearch(true)}
              placeholder="輸入商品名稱..."
              className="w-full border border-neutral-500/30 px-4 py-2.5 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300 text-sm font-light"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-px bg-white border border-neutral-500/20 shadow-md z-10 max-h-48 overflow-y-auto">
                {searchResults.map(p => (
                  <button key={p.id} onMouseDown={() => handleSelectSearchResult(p)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-50 text-sm text-left transition-colors border-b border-neutral-500/10 last:border-0">
                    <span className="font-light text-[#2d2d2d] tracking-wide">{p.name}</span>
                    <span className="text-brand-600 text-xs tracking-wider">NT$ {Number(p.price).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
            {showSearch && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-px bg-white border border-neutral-500/20 shadow-md z-10 px-4 py-3 text-xs text-neutral-400 tracking-wide">
                找不到符合「{searchQuery}」的商品
              </div>
            )}
          </div>
        </div>

        {/* Custom item */}
        <div className="bg-white border border-neutral-500/20 shadow-sm">
          <button
            onClick={() => setShowCustomForm(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs tracking-widest uppercase text-neutral-400 hover:text-brand-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              自訂商品
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform duration-200 ${showCustomForm ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showCustomForm && (
            <div className="px-4 pb-4 border-t border-neutral-500/10">
              <div className="flex gap-3 mt-3">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-400 tracking-wider mb-1">商品名稱</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                    placeholder="輸入商品名稱"
                    className="w-full border border-neutral-500/30 px-3 py-2 text-sm font-light focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300"
                    autoFocus
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-neutral-400 tracking-wider mb-1">單價 (NT$)</label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full border border-neutral-500/30 px-3 py-2 text-sm font-light focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs text-neutral-400 tracking-wider mb-1">數量</label>
                  <input
                    type="number"
                    value={customQty}
                    onChange={e => setCustomQty(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                    placeholder="1"
                    min="1"
                    step="1"
                    className="w-full border border-neutral-500/30 px-3 py-2 text-sm font-light focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addCustomItem}
                    className="px-4 py-2 bg-brand-600 text-white text-xs tracking-widest uppercase hover:bg-brand-700 transition-colors whitespace-nowrap"
                  >
                    加入
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white border border-neutral-500/20 shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-500/10 flex items-center justify-between">
            <span className="text-xs tracking-widest uppercase text-neutral-500">
              購物車
              {cart.length > 0 && <span className="ml-2 text-brand-500">{cart.reduce((s, i) => s + i.quantity, 0)} 件</span>}
            </span>
            {cart.length > 0 && (
              <button onClick={() => setCart([])}
                className="text-xs text-neutral-400 hover:text-red-400 tracking-wider uppercase transition-colors">
                清空
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-300 py-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-xs tracking-widest uppercase">購物車是空的</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-xs font-light tracking-widest text-neutral-400 uppercase">商品名稱</th>
                    <th className="px-4 py-2.5 text-right text-xs font-light tracking-widest text-neutral-400 uppercase">單價</th>
                    <th className="px-4 py-2.5 text-center text-xs font-light tracking-widest text-neutral-400 uppercase">折扣</th>
                    <th className="px-4 py-2.5 text-center text-xs font-light tracking-widest text-neutral-400 uppercase">數量</th>
                    <th className="px-4 py-2.5 text-center text-xs font-light tracking-widest text-neutral-400 uppercase">加購費用</th>
                    <th className="px-4 py-2.5 text-right text-xs font-light tracking-widest text-neutral-400 uppercase">小計</th>
                    <th className="px-4 py-2.5 text-center text-xs font-light tracking-widest text-neutral-400 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-500/10">
                  {cart.map(item => (
                    <tr key={item.productId} className="hover:bg-brand-50/30 transition-colors">
                      <td className="px-5 py-3 font-light text-[#2d2d2d] tracking-wide">{item.name}</td>
                      <td className="px-4 py-3 text-right text-neutral-500 font-light">NT$ {Number(item.price).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-neutral-400">NT$</span>
                          <input
                            type="number"
                            value={item.discountCash || ''}
                            onChange={e => setCashDiscount(item.productId, e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1"
                            className="w-16 text-center border border-neutral-300 py-0.5 text-sm focus:outline-none focus:border-brand-500 font-light placeholder-neutral-300"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => updateQuantity(item.productId, -1)}
                            className="w-6 h-6 border border-neutral-300 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors text-xs">−</button>
                          <input type="number" value={item.quantity} onChange={e => setQuantity(item.productId, e.target.value)} min="1"
                            className="w-10 text-center border border-neutral-300 py-0.5 text-sm focus:outline-none focus:border-brand-500 font-light" />
                          <button onClick={() => updateQuantity(item.productId, 1)}
                            className="w-6 h-6 border border-neutral-300 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors text-xs">＋</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-neutral-400">NT$</span>
                          <input
                            type="number"
                            value={item.addonFee || ''}
                            onChange={e => setAddonFee(item.productId, e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1"
                            className="w-20 text-center border border-neutral-300 py-0.5 text-sm focus:outline-none focus:border-brand-500 font-light placeholder-neutral-300"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-light text-[#2d2d2d]">
                        NT$ {Number(item.subtotal).toLocaleString()}
                        {item.discountCash > 0 && (
                          <div className="text-xs text-orange-400 mt-0.5">
                            折現 −NT$ {Number(item.discountCash).toLocaleString()}
                          </div>
                        )}
                        {item.addonFee > 0 && (
                          <div className="text-xs text-brand-400 mt-0.5">含加購 +{Number(item.addonFee).toLocaleString()}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removeFromCart(item.productId)}
                          className="text-neutral-300 hover:text-red-400 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right: summary + quick select */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-4 min-h-0">
        {/* Summary */}
        <div className="bg-white border border-neutral-500/20 shadow-sm p-5">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-4">結帳摘要</p>
          <div className="space-y-2 text-xs text-neutral-500 tracking-wide mb-5">
            <div className="flex justify-between">
              <span>商品種類</span>
              <span className="text-[#2d2d2d]">{cart.length} 種</span>
            </div>
            <div className="flex justify-between">
              <span>商品總數</span>
              <span className="text-[#2d2d2d]">{cart.reduce((s, i) => s + i.quantity, 0)} 件</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between">
                <span>折扣優惠</span>
                <span className="text-orange-500">−NT$ {Math.round(totalDiscount).toLocaleString()}</span>
              </div>
            )}
            {totalAddon > 0 && (
              <div className="flex justify-between">
                <span>加購費用</span>
                <span className="text-brand-500">NT$ {totalAddon.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="border-t border-neutral-500/10 pt-4 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs tracking-widest uppercase text-neutral-400">商品金額</span>
              <span className="text-xl font-light text-brand-600">NT$ {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white border border-neutral-500/20 shadow-sm p-4">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-3">付款方式</p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(method => (
              <div key={method} className="flex items-center gap-2">
                <button
                  onClick={() => handleMethodFill(method)}
                  title="點擊填入剩餘金額"
                  className="w-16 flex-shrink-0 text-xs tracking-wide text-left text-neutral-600 hover:text-brand-600 transition-colors truncate"
                >
                  {method}
                </button>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-neutral-400 flex-shrink-0">NT$</span>
                  <input
                    type="number"
                    value={payments[method]}
                    onChange={e => setPayments(prev => ({ ...prev, [method]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleCheckout()}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full border border-neutral-300 px-2 py-1.5 text-xs font-light focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 text-right"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-neutral-500/10 flex justify-between items-center text-xs tracking-wide">
            {Math.abs(remaining) < 0.5 ? (
              <span className="text-brand-600">已付清</span>
            ) : remaining > 0 ? (
              <><span className="text-neutral-500">未付金額</span><span className="text-red-500">NT$ {Math.round(remaining).toLocaleString()}</span></>
            ) : (
              <><span className="text-neutral-500">超付</span><span className="text-orange-500">NT$ {Math.round(Math.abs(remaining)).toLocaleString()}</span></>
            )}
          </div>
        </div>

        {/* Checkout button */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || isCheckingOut || Math.round(remaining) > 0}
          className="w-full py-4 bg-brand-600 text-white text-xs tracking-widest uppercase font-light hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
        >
          {isCheckingOut ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />處理中</>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              確認結帳
            </>
          )}
        </button>

        {/* Quick select */}
        <div className="bg-white border border-neutral-500/20 shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-500/10 flex items-center gap-1.5 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm tracking-widest uppercase text-neutral-400">商品快選</p>
          </div>
          <div className="overflow-y-auto flex-1 p-3">
            {quickSelectProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-neutral-300 py-8 px-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M7 3h5.586a1 1 0 01.707.293l6.414 6.414a1 1 0 010 1.414l-8.586 8.586a1 1 0 01-1.414 0l-6.414-6.414A1 1 0 013 12.586V7a4 4 0 014-4z" />
                </svg>
                <p className="text-sm text-center tracking-wider">尚無快選商品，請至商品管理設定</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {quickSelectProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-neutral-500/15 bg-white px-3.5 py-4 text-left transition-all duration-150 hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm active:scale-[0.96] active:bg-brand-100"
                  >
                    <span className="text-base font-medium text-[#2d2d2d] tracking-wide leading-snug line-clamp-2 min-h-[2.5rem]">
                      {p.name}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-brand-50 group-hover:bg-white px-2.5 py-1 text-xs font-medium text-brand-600 tracking-wide transition-colors">
                      NT$ {Number(p.price).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    </>
  )
}
