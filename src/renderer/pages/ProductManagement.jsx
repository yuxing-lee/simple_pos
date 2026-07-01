import React, { useState, useEffect, useRef, useCallback } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { supabase } from '../utils/supabase'
import { cuid } from '../utils/cuid'

function BarcodeImage({ value }) {
  const svgRef = useRef(null)
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, String(value), {
          format: 'CODE128', width: 1.5, height: 40,
          displayValue: true, fontSize: 10, margin: 4,
          background: '#ffffff', lineColor: '#2d2d2d'
        })
      } catch (e) { console.error(e) }
    }
  }, [value])
  return <div className="flex justify-center"><svg ref={svgRef} /></div>
}

function QRCodeImage({ value }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    if (value) {
      QRCode.toDataURL(String(value), { width: 80, margin: 1, color: { dark: '#2d2d2d', light: '#ffffff' } })
        .then(setDataUrl).catch(console.error)
    }
  }, [value])
  if (!dataUrl) return <div className="w-20 h-20 bg-neutral-100 animate-pulse" />
  return <img src={dataUrl} alt={`QR ${value}`} className="w-20 h-20" />
}

function ProductCard({ product, onDelete, isQuickSelect, onToggleQuickSelect }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const barcodeValue = product.barcode || product.id
  const hasImage = product.image && (product.image.startsWith('http://') || product.image.startsWith('https://') || product.image.startsWith('/'))

  return (
    <div className={`bg-white border shadow-sm hover:shadow-md transition-all duration-500 flex flex-col ${isQuickSelect ? 'border-brand-400' : 'border-neutral-500/20'}`}>
      {hasImage ? (
        <img src={product.image} alt={product.name}
          className="w-full h-36 object-cover bg-neutral-100"
          onError={e => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div className="w-full h-36 bg-brand-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-brand-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-light text-[#2d2d2d] text-sm tracking-wide truncate">{product.name}</h3>
            <p className="text-brand-600 font-light text-base mt-0.5">NT$ {Number(product.price).toLocaleString()}</p>
          </div>
          {!showConfirm ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onToggleQuickSelect(product.id)}
                title={isQuickSelect ? '取消快選' : '設為快選商品'}
                className={`p-1 transition-colors ${isQuickSelect ? 'text-brand-500 hover:text-brand-600' : 'text-neutral-300 hover:text-brand-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill={isQuickSelect ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
              <button onClick={() => setShowConfirm(true)}
                className="p-1 text-neutral-400 hover:text-red-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => { onDelete(product.id); setShowConfirm(false) }}
                className="px-2 py-1 bg-red-400 text-white text-xs tracking-wider hover:bg-red-500 transition-colors">確認</button>
              <button onClick={() => setShowConfirm(false)}
                className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs tracking-wider hover:bg-neutral-200 transition-colors">取消</button>
            </div>
          )}
        </div>

        <p className="text-xs text-neutral-400 font-mono truncate">{barcodeValue}</p>

        <div className="flex flex-col gap-2">
          <div className="bg-neutral-50 border border-neutral-500/10 p-2">
            <p className="text-xs text-neutral-400 mb-1 tracking-wider uppercase">Barcode</p>
            <BarcodeImage value={barcodeValue} />
          </div>
          <div className="bg-neutral-50 border border-neutral-500/10 p-2 flex flex-col items-center">
            <p className="text-xs text-neutral-400 mb-1 tracking-wider uppercase self-start">QR Code</p>
            <QRCodeImage value={barcodeValue} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductManagement() {
  const [products, setProducts] = useState([])
  const [quickSelectIds, setQuickSelectIds] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const nameRef = useRef(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('Product')
      .select('id, name, price, barcode, image, visible')
      .order('createdAt', { ascending: false })
    if (err) setError('載入商品失敗：' + err.message)
    else setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
    window.api.quickSelect.getAll().then(setQuickSelectIds).catch(() => {})
  }, [loadProducts])

  const toggleQuickSelect = async (id) => {
    const updated = await window.api.quickSelect.toggle(id)
    setQuickSelectIds(updated)
  }

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 3000) }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const parsedPrice = parseFloat(price)
    if (!trimmedName) { showError('請輸入商品名稱'); return }
    if (isNaN(parsedPrice) || parsedPrice < 0) { showError('請輸入有效的商品價格'); return }

    setSaving(true)
    const id = cuid()
    const barcode = String(Date.now())
    const now = new Date().toISOString()
    const { data: newProduct, error: err } = await supabase
      .from('Product')
      .insert({ id, name: trimmedName, price: parsedPrice, barcode, image: '', description: '', visible: true, featured: false, sortOrder: 0, createdAt: now, updatedAt: now })
      .select('id, name, price, barcode, image, visible')
      .single()

    if (err) showError('新增商品失敗：' + err.message)
    else { setProducts(prev => [newProduct, ...prev]); setName(''); setPrice(''); showSuccess(`「${trimmedName}」新增成功`); nameRef.current?.focus() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    const { error: err } = await supabase.from('Product').delete().eq('id', id)
    if (err) showError('刪除失敗：' + err.message)
    else { setProducts(prev => prev.filter(p => p.id !== id)); showSuccess('商品已刪除') }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {success && (
        <div className="mb-5 px-4 py-3 bg-brand-50 border border-brand-200 text-brand-700 text-sm tracking-wide flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm tracking-wide flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Add product form */}
      <div className="bg-white border border-neutral-500/20 shadow-sm p-6 mb-6">
        <h3 className="text-xs font-light tracking-widest uppercase text-neutral-500 mb-5">新增商品</h3>
        <form onSubmit={handleAddProduct} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs tracking-wider text-neutral-500 mb-2 uppercase">商品名稱</label>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="請輸入商品名稱" disabled={saving}
              className="w-full border border-neutral-500/30 px-4 py-2.5 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300 text-sm font-light" />
          </div>
          <div className="w-44">
            <label className="block text-xs tracking-wider text-neutral-500 mb-2 uppercase">單筆金額 (NT$)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0" min="0" step="1" disabled={saving}
              className="w-full border border-neutral-500/30 px-4 py-2.5 bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all duration-300 text-sm font-light" />
          </div>
          <button type="submit" disabled={saving}
            className="px-8 py-2.5 bg-brand-600 text-white text-xs tracking-widest uppercase font-light hover:bg-brand-700 disabled:opacity-50 transition-all duration-300 flex items-center gap-2">
            {saving ? '新增中...' : '新增商品'}
          </button>
        </form>
      </div>

      {/* Product list header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs tracking-widest uppercase text-neutral-500">
          商品列表 <span className="text-brand-500 ml-1">{products.length}</span>
        </p>
        <button onClick={loadProducts} disabled={loading}
          className="text-xs tracking-wider text-brand-500 hover:text-brand-700 flex items-center gap-1.5 disabled:opacity-50 transition-colors uppercase">
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重新整理
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-xs tracking-widest uppercase">尚無商品</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onDelete={handleDelete}
              isQuickSelect={quickSelectIds.includes(product.id)}
              onToggleQuickSelect={toggleQuickSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
