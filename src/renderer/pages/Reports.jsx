import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

function getDateRange(filter) {
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  if (filter === 'today') return { start: startOfDay(now), end: endOfDay(now) }
  if (filter === 'week') {
    const day = now.getDay()
    const diffToMon = day === 0 ? 6 : day - 1
    const mon = new Date(now)
    mon.setDate(now.getDate() - diffToMon)
    return { start: startOfDay(mon), end: endOfDay(now) }
  }
  if (filter === 'month') {
    return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOfDay(now) }
  }
  return null
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

const localDateKey = (d) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const PAYMENT_COLORS = ['#8d5f4d', '#b79483', '#c9b3a3', '#d4c4b0', '#e3dbd3']

function PaymentTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pct = total > 0 ? ((d.amount / total) * 100).toFixed(1) : 0
  return (
    <div className="bg-white border border-neutral-500/20 shadow-sm px-3 py-2 text-xs">
      <p className="text-[#2d2d2d] font-medium mb-1">{d.name}</p>
      <p className="text-neutral-500">{d.count} 筆（{pct}%）</p>
      <p className="text-brand-600">NT$ {d.amount.toLocaleString()}</p>
    </div>
  )
}

function DailyTooltip({ active, payload, label, filter }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-neutral-500/20 shadow-sm px-3 py-2 text-xs">
      <p className="text-neutral-500 mb-1">{filter === 'today' ? `${label}:00` : label}</p>
      <p className="text-brand-600">NT$ {d.revenue.toLocaleString()}</p>
      {d.count > 0 && <p className="text-neutral-400">{d.count} 筆</p>}
    </div>
  )
}

function ProductTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-neutral-500/20 shadow-sm px-3 py-2 text-xs">
      <p className="text-[#2d2d2d] font-medium mb-1">{d.name}</p>
      <p className="text-neutral-500">{d.quantity} 件</p>
      <p className="text-brand-600">NT$ {d.revenue.toLocaleString()}</p>
    </div>
  )
}

export default function Reports() {
  const [transactions, setTransactions] = useState([])
  const [filter, setFilter] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [confirmCancelId, setConfirmCancelId] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [actionError, setActionError] = useState('')

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.transactions.getAll()
      setTransactions(data)
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  const filteredTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date)
    if (filter === 'custom') {
      if (!customStart && !customEnd) return true
      const start = customStart ? new Date(customStart + 'T00:00:00') : null
      const end = customEnd ? new Date(customEnd + 'T23:59:59') : null
      if (start && txDate < start) return false
      if (end && txDate > end) return false
      return true
    }
    const range = getDateRange(filter)
    if (!range) return true
    return txDate >= range.start && txDate <= range.end
  })

  const activeTx = filteredTransactions.filter(tx => !tx.cancelled)
  const totalRevenue = activeTx.reduce((sum, tx) => sum + tx.total, 0)
  const totalItems = activeTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0)

  const handleCancel = async (id) => {
    setProcessingId(id)
    setActionError('')
    try {
      await window.api.transactions.cancel(id)
      setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, cancelled: true } : tx))
    } catch (e) {
      setActionError('取消失敗：' + (e?.message || '請重新啟動應用程式'))
    } finally {
      setProcessingId(null)
      setConfirmCancelId(null)
    }
  }

  const handleRestore = async (id) => {
    setProcessingId(id)
    setActionError('')
    try {
      await window.api.transactions.restore(id)
      setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, cancelled: false } : tx))
    } catch (e) {
      setActionError('恢復失敗：' + (e?.message || '請重新啟動應用程式'))
    } finally {
      setProcessingId(null)
    }
  }

  // --- Chart data ---

  const paymentData = useMemo(() => {
    const map = {}
    activeTx.forEach(tx => {
      if (Array.isArray(tx.payments) && tx.payments.length > 0) {
        tx.payments.forEach(p => {
          const method = p.method || '未指定'
          if (!map[method]) map[method] = { name: method, count: 0, amount: 0 }
          map[method].count++
          map[method].amount += p.amount
        })
      } else {
        const method = tx.paymentMethod || '未指定'
        if (!map[method]) map[method] = { name: method, count: 0, amount: 0 }
        map[method].count++
        map[method].amount += tx.total
      }
    })
    return Object.values(map).sort((a, b) => b.amount - a.amount)
  }, [activeTx])

  const dailyData = useMemo(() => {
    if (activeTx.length === 0) return []

    if (filter === 'today') {
      const hours = Array.from({ length: 24 }, (_, i) => ({
        label: String(i).padStart(2, '0'), revenue: 0, count: 0
      }))
      activeTx.forEach(tx => {
        const h = new Date(tx.date).getHours()
        hours[h].revenue += tx.total
        hours[h].count++
      })
      const nonZeroIdx = hours.reduce((acc, h, i) => h.revenue > 0 ? [...acc, i] : acc, [])
      if (nonZeroIdx.length === 0) return []
      return hours.slice(Math.max(0, nonZeroIdx[0] - 1), Math.min(23, nonZeroIdx[nonZeroIdx.length - 1] + 1) + 1)
    }

    if (filter === 'week') {
      const now = new Date()
      const diffToMon = now.getDay() === 0 ? 6 : now.getDay() - 1
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(now.getDate() - diffToMon + i)
        return { key: localDateKey(d), label: ['一', '二', '三', '四', '五', '六', '日'][i], revenue: 0, count: 0 }
      })
      activeTx.forEach(tx => {
        const key = localDateKey(tx.date)
        const day = days.find(d => d.key === key)
        if (day) { day.revenue += tx.total; day.count++ }
      })
      return days
    }

    if (filter === 'month') {
      const now = new Date()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
        return { key: localDateKey(d), label: String(i + 1), revenue: 0, count: 0 }
      })
      activeTx.forEach(tx => {
        const key = localDateKey(tx.date)
        const day = days.find(d => d.key === key)
        if (day) { day.revenue += tx.total; day.count++ }
      })
      return days
    }

    // custom: only days with transactions, capped at 62 days
    const map = {}
    activeTx.forEach(tx => {
      const key = localDateKey(tx.date)
      if (!map[key]) map[key] = { key, label: key.slice(5).replace('-', '/'), revenue: 0, count: 0 }
      map[key].revenue += tx.total
      map[key].count++
    })
    const result = Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
    return result.length <= 62 ? result : []
  }, [activeTx, filter])

  const topProducts = useMemo(() => {
    const map = {}
    activeTx.forEach(tx => {
      tx.items.forEach(item => {
        if (!map[item.name]) map[item.name] = { name: item.name, quantity: 0, revenue: 0 }
        map[item.name].quantity += item.quantity
        map[item.name].revenue += item.subtotal
      })
    })
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 5)
  }, [activeTx])

  const showCharts = !loading && activeTx.length > 0
  const showTopProducts = filter !== 'today' && topProducts.length > 0

  const FILTER_BUTTONS = [
    { id: 'today', label: '日報' },
    { id: 'week', label: '週報' },
    { id: 'month', label: '月報' },
    { id: 'custom', label: '自訂' }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Filter bar */}
      <div className="bg-white border border-neutral-500/20 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {FILTER_BUTTONS.map(btn => (
              <button key={btn.id} onClick={() => setFilter(btn.id)}
                className={`px-4 py-2 text-xs tracking-widest uppercase transition-all duration-300 ${
                  filter === btn.id ? 'bg-brand-600 text-white' : 'text-neutral-500 hover:bg-neutral-100'
                }`}>
                {btn.label}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-1.5 border border-neutral-500/30 text-xs focus:outline-none focus:border-brand-500 font-light" />
              <span className="text-neutral-400 text-xs">至</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 border border-neutral-500/30 text-xs focus:outline-none focus:border-brand-500 font-light" />
            </div>
          )}

          <button onClick={loadTransactions}
            className="ml-auto text-xs tracking-wider uppercase text-neutral-400 hover:text-brand-600 flex items-center gap-1.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重新整理
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-500 text-xs tracking-wide flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {actionError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          {
            label: '有效交易筆數',
            value: activeTx.length.toLocaleString(),
            unit: `筆（已取消 ${filteredTransactions.length - activeTx.length} 筆）`,
          },
          {
            label: '總營業額',
            value: `NT$ ${totalRevenue.toLocaleString()}`,
            unit: '元（不含已取消）',
          },
          {
            label: '銷售商品數',
            value: totalItems.toLocaleString(),
            unit: '件（不含已取消）',
          }
        ].map(card => (
          <div key={card.label} className="bg-white border border-neutral-500/20 shadow-sm p-5">
            <p className="text-xs tracking-widest uppercase text-neutral-400 mb-3">{card.label}</p>
            <p className="text-2xl font-light text-[#2d2d2d] tracking-wide">{card.value}</p>
            <p className="text-xs text-neutral-400 mt-1 tracking-wide">{card.unit}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {showCharts && (
        <div className="mb-5 space-y-4">
          {/* Row: payment pie + time bar */}
          <div className="flex gap-4">
            {/* Payment pie */}
            <div className="w-72 flex-shrink-0 bg-white border border-neutral-500/20 shadow-sm p-5">
              <p className="text-xs tracking-widest uppercase text-neutral-400 mb-1">付款方式分佈</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={80}
                    dataKey="amount" nameKey="name"
                    paddingAngle={2}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={(props) => <PaymentTooltip {...props} total={totalRevenue} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {paymentData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                      <span className="text-neutral-600 tracking-wide">{entry.name}</span>
                    </div>
                    <div className="text-right text-neutral-400 tracking-wide">
                      {entry.count} 筆
                      <span className="mx-1 text-neutral-300">·</span>
                      <span className="text-brand-600">NT$ {entry.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily / hourly bar chart */}
            {dailyData.length > 0 && (
              <div className="flex-1 bg-white border border-neutral-500/20 shadow-sm p-5 flex flex-col">
                <p className="text-xs tracking-widest uppercase text-neutral-400 mb-4">
                  {filter === 'today' ? '每小時營業額' :
                   filter === 'week' ? '本週每日營業額' :
                   filter === 'month' ? '本月每日營業額' : '每日營業額'}
                </p>
                <div className="flex-1" style={{ minHeight: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyData}
                      margin={{ top: 4, right: 4, bottom: 0, left: -10 }}
                      barCategoryGap="35%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ede8e3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#c5b9a8' }}
                        axisLine={false} tickLine={false}
                        interval={filter === 'month' ? 4 : 0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#c5b9a8' }}
                        axisLine={false} tickLine={false}
                        width={38}
                        tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v === 0 ? '0' : String(v)}
                      />
                      <Tooltip
                        content={(props) => <DailyTooltip {...props} filter={filter} />}
                        cursor={{ fill: '#f8f5f3' }}
                      />
                      <Bar dataKey="revenue" fill="#8d5f4d" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Top products */}
          {showTopProducts && (
            <div className="bg-white border border-neutral-500/20 shadow-sm p-5">
              <p className="text-xs tracking-widest uppercase text-neutral-400 mb-4">熱銷商品 Top 5</p>
              <ResponsiveContainer width="100%" height={topProducts.length * 40 + 10}>
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 0, right: 56, bottom: 0, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ede8e3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#c5b9a8' }}
                    axisLine={false} tickLine={false}
                    allowDecimals={false}
                    tickFormatter={v => Number.isInteger(v) ? v : ''}
                  />
                  <YAxis
                    type="category" dataKey="name"
                    width={130}
                    tick={{ fontSize: 11, fill: '#73493b' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<ProductTooltip />} cursor={{ fill: '#f8f5f3' }} />
                  <Bar
                    dataKey="quantity"
                    fill="#b79483"
                    radius={[0, 3, 3, 0]}
                    barSize={18}
                    label={{ position: 'right', fontSize: 10, fill: '#a89778', formatter: v => `${v} 件` }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-white border border-neutral-500/20 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-500/10 flex items-center justify-between">
          <p className="text-xs tracking-widest uppercase text-neutral-400">
            交易記錄 <span className="text-brand-500 ml-1">{filteredTransactions.length}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 text-neutral-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-xs tracking-widest uppercase">此期間無交易記錄</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-500/10">
            {[...filteredTransactions].reverse().map(tx => (
              <div key={tx.id} className={`transition-colors ${tx.cancelled ? 'opacity-50' : 'hover:bg-brand-50/20'}`}>
                <div className="px-5 py-4 flex items-center gap-4">
                  <button
                    className="flex-1 flex items-center gap-4 text-left min-w-0"
                    onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                  >
                    <div className="w-36 flex-shrink-0">
                      <p className={`text-xs font-light tracking-wide ${tx.cancelled ? 'text-neutral-400 line-through' : 'text-[#2d2d2d]'}`}>
                        {formatDate(tx.date)}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(tx.date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      {tx.cancelled && (
                        <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-400 text-xs tracking-wider mb-1">已取消</span>
                      )}
                      <p className={`text-xs tracking-wide truncate ${tx.cancelled ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {tx.items.map(i => `${i.name} × ${i.quantity}`).join('、')}
                      </p>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-light tracking-wide ${tx.cancelled ? 'text-neutral-400 line-through' : 'text-brand-600'}`}>
                        NT$ {Number(tx.total).toLocaleString()}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5 tracking-wide">
                        {Array.isArray(tx.payments) && tx.payments.length > 0
                          ? tx.payments.map(p => p.method).join(' + ')
                          : tx.paymentMethod || ''}
                      </p>
                    </div>

                    <svg xmlns="http://www.w3.org/2000/svg"
                      className={`w-3.5 h-3.5 text-neutral-300 flex-shrink-0 transition-transform ${expandedId === tx.id ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Cancel / Restore */}
                  <div className="flex-shrink-0 ml-1">
                    {tx.cancelled ? (
                      <button onClick={() => handleRestore(tx.id)} disabled={processingId === tx.id}
                        className="px-3 py-1.5 text-xs tracking-wider uppercase text-brand-500 border border-brand-300 hover:bg-brand-50 disabled:opacity-50 transition-colors">
                        {processingId === tx.id ? '...' : '恢復'}
                      </button>
                    ) : confirmCancelId === tx.id ? (
                      <div className="flex gap-1.5 items-center">
                        <span className="text-xs text-neutral-400 tracking-wide">確認取消？</span>
                        <button onClick={() => handleCancel(tx.id)} disabled={processingId === tx.id}
                          className="px-2.5 py-1 text-xs tracking-wider bg-red-400 text-white hover:bg-red-500 disabled:opacity-50 transition-colors">
                          {processingId === tx.id ? '...' : '確認'}
                        </button>
                        <button onClick={() => setConfirmCancelId(null)}
                          className="px-2.5 py-1 text-xs tracking-wider bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors">
                          取消
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmCancelId(tx.id)}
                        className="px-3 py-1.5 text-xs tracking-wider uppercase text-neutral-400 border border-neutral-300 hover:border-red-300 hover:text-red-400 transition-colors">
                        取消訂單
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === tx.id && (
                  <div className="px-5 pb-4">
                    <div className="border border-neutral-500/15 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-neutral-50">
                            <th className="px-4 py-2.5 text-left font-light tracking-widest text-neutral-400 uppercase">商品名稱</th>
                            <th className="px-4 py-2.5 text-right font-light tracking-widest text-neutral-400 uppercase">單價</th>
                            <th className="px-4 py-2.5 text-center font-light tracking-widest text-neutral-400 uppercase">數量</th>
                            <th className="px-4 py-2.5 text-right font-light tracking-widest text-neutral-400 uppercase">加購費用</th>
                            <th className="px-4 py-2.5 text-right font-light tracking-widest text-neutral-400 uppercase">小計</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-500/10">
                          {tx.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-light text-[#2d2d2d] tracking-wide">{item.name}</td>
                              <td className="px-4 py-2.5 text-right text-neutral-500 font-light">NT$ {Number(item.price).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-center text-neutral-500 font-light">{item.quantity}</td>
                              <td className="px-4 py-2.5 text-right font-light text-neutral-500">
                                {item.addonFee > 0 ? `NT$ ${Number(item.addonFee).toLocaleString()}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right font-light text-[#2d2d2d]">NT$ {Number(item.subtotal).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-brand-50">
                            <td colSpan={4} className="px-4 py-2.5 text-right font-light tracking-widest text-neutral-500 text-xs uppercase">合計</td>
                            <td className="px-4 py-2.5 text-right font-light text-brand-600">NT$ {Number(tx.total).toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex items-start justify-between mt-2">
                      <div className="text-xs text-neutral-500 tracking-wide space-y-0.5">
                        {Array.isArray(tx.payments) && tx.payments.length > 0 ? (
                          tx.payments.map((p, i) => (
                            <div key={i}>{p.method}：NT$ {Number(p.amount).toLocaleString()}</div>
                          ))
                        ) : tx.paymentMethod ? (
                          <div>付款方式：{tx.paymentMethod}</div>
                        ) : null}
                        {tx.cashChange != null && tx.cashChange > 0 ? (
                          <div className="text-brand-500">
                            找零：NT$ {Number(tx.cashChange).toLocaleString()}
                            {tx.cashReceived != null && <span className="text-neutral-400">（客付 NT$ {Number(tx.cashReceived).toLocaleString()}）</span>}
                          </div>
                        ) : tx.change != null && tx.change > 0 ? (
                          <div className="text-brand-500">找零：NT$ {Number(tx.change).toLocaleString()}</div>
                        ) : null}
                      </div>
                      <p className="text-xs text-neutral-400 tracking-wide flex-shrink-0 ml-4">{formatDateTime(tx.date)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
