import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../utils/supabase'

export default function Checkout() {
  const [products, setProducts] = useState([])
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
    barcodeRef.current?.focus()
  }, [])

  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 3000) }

  const calcSubtotal = (price, quantity, addonFee) => price * quantity + (addonFee || 0)

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        const newQty = existing.quantity + 1
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: newQty, subtotal: calcSubtotal(item.price, newQty, item.addonFee) }
            : item
        )
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, addonFee: 0, subtotal: product.price }]
    })
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

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item
      const newQty = item.quantity + delta
      if (newQty <= 0) return null
      return { ...item, quantity: newQty, subtotal: calcSubtotal(item.price, newQty, item.addonFee) }
    }).filter(Boolean))
  }

  const setQuantity = (productId, qty) => {
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 1) return
    setCart(prev => prev.map(item =>
      item.productId === productId ? { ...item, quantity: n, subtotal: calcSubtotal(item.price, n, item.addonFee) } : item
    ))
  }

  const setAddonFee = (productId, fee) => {
    const n = parseFloat(fee) || 0
    if (n < 0) return
    setCart(prev => prev.map(item =>
      item.productId === productId ? { ...item, addonFee: n, subtotal: calcSubtotal(item.price, item.quantity, n) } : item
    ))
  }

  const addCustomItem = () => {
    const name = customName.trim()
    const price = parseFloat(customPrice)
    const qty = parseInt(customQty, 10)
    if (!name) { showError('請輸入商品名稱'); return }
    if (isNaN(price) || price < 0) { showError('請輸入有效的單價'); return }
    if (isNaN(qty) || qty < 1) { showError('數量至少為 1'); return }
    const customId = 'custom_' + Date.now()
    setCart(prev => [...prev, { productId: customId, name, price, quantity: qty, addonFee: 0, subtotal: calcSubtotal(price, qty, 0) }])
    setCustomName('')
    setCustomPrice('')
    setCustomQty('1')
    setShowCustomForm(false)
    barcodeRef.current?.focus()
  }

  const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.productId !== productId))
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const totalAddon = cart.reduce((sum, item) => sum + (item.addonFee || 0), 0)

  const handleCheckout = async () => {
    if (cart.length === 0) { showError('購物車是空的，請先加入商品'); return }
    setIsCheckingOut(true)
    try {
      const transaction = { id: String(Date.now()), date: new Date().toISOString(), items: cart, total }
      await window.api.transactions.save(transaction)
      setLastTransaction(transaction)
      setCart([])
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
            <p className="text-xs text-brand-500 tracking-wide">NT$ {lastTransaction.total.toLocaleString()} · {lastTransaction.items.length} 種商品</p>
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
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
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
            {totalAddon > 0 && (
              <div className="flex justify-between">
                <span>加購費用</span>
                <span className="text-brand-500">NT$ {totalAddon.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="border-t border-neutral-500/10 pt-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs tracking-widest uppercase text-neutral-400">總金額</span>
              <span className="text-xl font-light text-brand-600">NT$ {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Checkout button */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || isCheckingOut}
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
        <div className="bg-white border border-neutral-500/20 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-500/10">
            <p className="text-xs tracking-widest uppercase text-neutral-400">商品快選</p>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {products.length === 0 ? (
              <p className="text-xs text-neutral-300 text-center py-4 tracking-wider">尚無商品</p>
            ) : (
              <div className="space-y-0.5">
                {products.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-50 text-left transition-colors">
                    <span className="text-xs text-[#2d2d2d] font-light tracking-wide truncate">{p.name}</span>
                    <span className="text-xs text-brand-500 ml-2 flex-shrink-0">NT$ {Number(p.price).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
