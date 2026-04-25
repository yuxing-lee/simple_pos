import React, { useState } from 'react'
import ProductManagement from './pages/ProductManagement.jsx'
import Checkout from './pages/Checkout.jsx'
import Reports from './pages/Reports.jsx'

const NAV_ITEMS = [
  {
    id: 'checkout',
    label: '結帳',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    id: 'products',
    label: '商品管理',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    id: 'reports',
    label: '報表',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  }
]

export default function App() {
  const [currentPage, setCurrentPage] = useState('checkout')

  const renderPage = () => {
    switch (currentPage) {
      case 'products': return <ProductManagement />
      case 'checkout': return <Checkout />
      case 'reports':  return <Reports />
      default:         return <Checkout />
    }
  }

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-52 bg-brand-900 flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-brand-800">
          <h1 className="text-brand-100 text-base tracking-widest font-light">心藝花禮</h1>
          <p className="text-brand-400 text-xs mt-1 tracking-wider">收銀系統</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs tracking-widest uppercase text-left transition-all duration-300 ${
                currentPage === item.id
                  ? 'bg-brand-600 text-white'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-brand-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-800">
          <p className="text-brand-600 text-xs tracking-wider">CLiu Florist Studio</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-neutral-500/20 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm tracking-widest uppercase text-[#2d2d2d] font-light">
            {NAV_ITEMS.find(i => i.id === currentPage)?.label}
          </h2>
          <div className="flex items-center gap-2 text-xs text-neutral-500 tracking-wider">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
