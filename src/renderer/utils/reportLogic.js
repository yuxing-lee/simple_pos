/** 依篩選條件計算日期區間（本地時區），'custom' 由呼叫端另行處理 */
export function getDateRange(filter, now = new Date()) {
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

export const localDateKey = (d) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 依篩選條件（today/week/month/custom）過濾交易，custom 用 customStart/customEnd（YYYY-MM-DD） */
export function filterTransactionsByRange(transactions, { filter, customStart, customEnd, now = new Date() }) {
  return transactions.filter(tx => {
    const txDate = new Date(tx.date)
    if (filter === 'custom') {
      if (!customStart && !customEnd) return true
      const start = customStart ? new Date(customStart + 'T00:00:00') : null
      const end = customEnd ? new Date(customEnd + 'T23:59:59') : null
      if (start && txDate < start) return false
      if (end && txDate > end) return false
      return true
    }
    const range = getDateRange(filter, now)
    if (!range) return true
    return txDate >= range.start && txDate <= range.end
  })
}

/** 排除已取消的交易 */
export const getActiveTransactions = (transactions) => transactions.filter(tx => !tx.cancelled)

/** 總營業額 / 銷售商品件數，對缺漏或壞資料（total/quantity 非數字）防呆為 0 */
export function calcSummary(activeTx) {
  const totalRevenue = activeTx.reduce((sum, tx) => sum + (Number(tx.total) || 0), 0)
  const totalItems = activeTx.reduce(
    (sum, tx) => sum + (tx.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    0
  )
  return { totalRevenue, totalItems }
}

/** 依付款方式彙總筆數與金額；tx.payments 缺漏時 fallback 到 tx.paymentMethod + tx.total */
export function aggregatePaymentData(activeTx) {
  const map = {}
  activeTx.forEach(tx => {
    if (Array.isArray(tx.payments) && tx.payments.length > 0) {
      tx.payments.forEach(p => {
        const method = p.method || '未指定'
        if (!map[method]) map[method] = { name: method, count: 0, amount: 0 }
        map[method].count++
        map[method].amount += Number(p.amount) || 0
      })
    } else {
      const method = tx.paymentMethod || '未指定'
      if (!map[method]) map[method] = { name: method, count: 0, amount: 0 }
      map[method].count++
      map[method].amount += Number(tx.total) || 0
    }
  })
  return Object.values(map).sort((a, b) => b.amount - a.amount)
}

/** 依篩選條件彙總每小時（today）或每日（week/month/custom）營收 */
export function aggregateDailyData(activeTx, filter, now = new Date()) {
  if (activeTx.length === 0) return []

  if (filter === 'today') {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      label: String(i).padStart(2, '0'), revenue: 0, count: 0
    }))
    activeTx.forEach(tx => {
      const h = new Date(tx.date).getHours()
      hours[h].revenue += Number(tx.total) || 0
      hours[h].count++
    })
    const nonZeroIdx = hours.reduce((acc, h, i) => h.revenue > 0 ? [...acc, i] : acc, [])
    if (nonZeroIdx.length === 0) return []
    return hours.slice(Math.max(0, nonZeroIdx[0] - 1), Math.min(23, nonZeroIdx[nonZeroIdx.length - 1] + 1) + 1)
  }

  if (filter === 'week') {
    const diffToMon = now.getDay() === 0 ? 6 : now.getDay() - 1
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - diffToMon + i)
      return { key: localDateKey(d), label: ['一', '二', '三', '四', '五', '六', '日'][i], revenue: 0, count: 0 }
    })
    activeTx.forEach(tx => {
      const key = localDateKey(tx.date)
      const day = days.find(d => d.key === key)
      if (day) { day.revenue += Number(tx.total) || 0; day.count++ }
    })
    return days
  }

  if (filter === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
      return { key: localDateKey(d), label: String(i + 1), revenue: 0, count: 0 }
    })
    activeTx.forEach(tx => {
      const key = localDateKey(tx.date)
      const day = days.find(d => d.key === key)
      if (day) { day.revenue += Number(tx.total) || 0; day.count++ }
    })
    return days
  }

  // custom：只列有交易的日期，超過 62 天時圖表不顯示（避免長條圖過度密集）
  const map = {}
  activeTx.forEach(tx => {
    const key = localDateKey(tx.date)
    if (!map[key]) map[key] = { key, label: key.slice(5).replace('-', '/'), revenue: 0, count: 0 }
    map[key].revenue += Number(tx.total) || 0
    map[key].count++
  })
  const result = Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  return result.length <= 62 ? result : []
}

/** 熱銷商品（依數量排序）取前 limit 名，缺漏 tx.items 時視為空陣列 */
export function aggregateTopProducts(activeTx, limit = 5) {
  const map = {}
  activeTx.forEach(tx => {
    (tx.items || []).forEach(item => {
      if (!map[item.name]) map[item.name] = { name: item.name, quantity: 0, revenue: 0 }
      map[item.name].quantity += Number(item.quantity) || 0
      map[item.name].revenue += Number(item.subtotal) || 0
    })
  })
  return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, limit)
}
