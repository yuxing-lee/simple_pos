import { describe, it, expect } from 'vitest'
import {
  getDateRange,
  localDateKey,
  filterTransactionsByRange,
  getActiveTransactions,
  calcSummary,
  aggregatePaymentData,
  aggregateDailyData,
  aggregateTopProducts,
} from './reportLogic'

const tx = (overrides = {}) => ({
  id: 't1', date: '2026-08-18T10:00:00.000Z', total: 100,
  items: [{ name: '玫瑰', quantity: 1, subtotal: 100 }],
  payments: [{ method: '現金', amount: 100 }], paymentMethod: '現金',
  ...overrides,
})

// ─── getDateRange ─────────────────────────────────────────────────────────────

describe('getDateRange', () => {
  it('today：本地時區當日 00:00:00.000 ~ 23:59:59.999', () => {
    const now = new Date(2026, 7, 18, 15, 30, 0) // 2026-08-18 (二)
    const { start, end } = getDateRange('today', now)
    expect(start).toEqual(new Date(2026, 7, 18, 0, 0, 0, 0))
    expect(end).toEqual(new Date(2026, 7, 18, 23, 59, 59, 999))
  })

  it('week：週一到「現在」，非到週日', () => {
    const now = new Date(2026, 7, 18, 15, 0, 0) // 週二
    const { start, end } = getDateRange('week', now)
    expect(start).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0)) // 週一 8/17
    expect(end).toEqual(new Date(2026, 7, 18, 23, 59, 59, 999)) // 到今天，不是到週日
  })

  it('week：星期日時應算入「上週一」到今天（跨週交界）', () => {
    const now = new Date(2026, 7, 23, 12, 0, 0) // 2026-08-23 是週日
    const { start } = getDateRange('week', now)
    expect(start).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0)) // 同一週的週一 8/17
  })

  it('week：星期一時，週一當天本身就是區間起點', () => {
    const now = new Date(2026, 7, 17, 9, 0, 0) // 週一
    const { start, end } = getDateRange('week', now)
    expect(start).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0))
    expect(end).toEqual(new Date(2026, 7, 17, 23, 59, 59, 999))
  })

  it('month：月初到「現在」', () => {
    const now = new Date(2026, 7, 18, 15, 0, 0)
    const { start, end } = getDateRange('month', now)
    expect(start).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0))
    expect(end).toEqual(new Date(2026, 7, 18, 23, 59, 59, 999))
  })

  it('month：月初第一天時，起訖同一天', () => {
    const now = new Date(2026, 7, 1, 9, 0, 0)
    const { start, end } = getDateRange('month', now)
    expect(start).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0))
    expect(end).toEqual(new Date(2026, 7, 1, 23, 59, 59, 999))
  })

  it('custom 回傳 null（由呼叫端另行處理）', () => {
    expect(getDateRange('custom', new Date())).toBeNull()
  })
})

// ─── localDateKey ─────────────────────────────────────────────────────────────

describe('localDateKey', () => {
  it('接受 Date 物件，回傳本地日期字串', () => {
    expect(localDateKey(new Date(2026, 7, 5))).toBe('2026-08-05')
  })

  it('接受 ISO 字串', () => {
    expect(localDateKey('2026-01-09T00:00:00')).toBe('2026-01-09')
  })

  it('月份與日期補零', () => {
    expect(localDateKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

// ─── filterTransactionsByRange ─────────────────────────────────────────────────

describe('filterTransactionsByRange', () => {
  const now = new Date(2026, 7, 18, 15, 0, 0) // 2026-08-18 週二

  it('today：只留當日交易，跨午夜前後的交易正確排除', () => {
    const transactions = [
      tx({ id: 'a', date: new Date(2026, 7, 18, 0, 0, 1).toISOString() }), // 今天剛過午夜
      tx({ id: 'b', date: new Date(2026, 7, 18, 23, 59, 58).toISOString() }), // 今天快結束
      tx({ id: 'c', date: new Date(2026, 7, 17, 23, 59, 59).toISOString() }), // 昨天最後一秒
      tx({ id: 'd', date: new Date(2026, 7, 19, 0, 0, 0).toISOString() }), // 明天剛開始
    ]
    const result = filterTransactionsByRange(transactions, { filter: 'today', now })
    expect(result.map(t => t.id)).toEqual(['a', 'b'])
  })

  it('week：只留本週（週一起）交易', () => {
    const transactions = [
      tx({ id: 'mon', date: new Date(2026, 7, 17, 8, 0).toISOString() }),
      tx({ id: 'lastSun', date: new Date(2026, 7, 16, 23, 59).toISOString() }), // 上週日，不算
      tx({ id: 'today', date: new Date(2026, 7, 18, 8, 0).toISOString() }),
    ]
    const result = filterTransactionsByRange(transactions, { filter: 'week', now })
    expect(result.map(t => t.id).sort()).toEqual(['mon', 'today'])
  })

  it('month：只留本月交易', () => {
    const transactions = [
      tx({ id: 'first', date: new Date(2026, 7, 1, 0, 0, 1).toISOString() }),
      tx({ id: 'lastMonth', date: new Date(2026, 6, 31, 23, 59).toISOString() }),
      tx({ id: 'today', date: new Date(2026, 7, 18, 8, 0).toISOString() }),
    ]
    const result = filterTransactionsByRange(transactions, { filter: 'month', now })
    expect(result.map(t => t.id).sort()).toEqual(['first', 'today'])
  })

  it('custom：起訖皆空時回傳全部', () => {
    const transactions = [tx({ id: 'a' }), tx({ id: 'b', date: '2020-01-01T00:00:00Z' })]
    const result = filterTransactionsByRange(transactions, { filter: 'custom', customStart: '', customEnd: '', now })
    expect(result).toHaveLength(2)
  })

  it('custom：只填起始日，為開放區間（無上限）', () => {
    const transactions = [
      tx({ id: 'before', date: '2026-08-01T00:00:00' }),
      tx({ id: 'after', date: '2026-08-20T00:00:00' }),
    ]
    const result = filterTransactionsByRange(transactions, { filter: 'custom', customStart: '2026-08-10', customEnd: '', now })
    expect(result.map(t => t.id)).toEqual(['after'])
  })

  it('custom：只填結束日，為開放區間（無下限）', () => {
    const transactions = [
      tx({ id: 'before', date: '2026-08-01T00:00:00' }),
      tx({ id: 'after', date: '2026-08-20T00:00:00' }),
    ]
    const result = filterTransactionsByRange(transactions, { filter: 'custom', customStart: '', customEnd: '2026-08-10', now })
    expect(result.map(t => t.id)).toEqual(['before'])
  })

  it('custom：起訖同一天，涵蓋當天全部交易', () => {
    const transactions = [
      tx({ id: 'morning', date: '2026-08-10T00:00:01' }),
      tx({ id: 'night', date: '2026-08-10T23:59:58' }),
      tx({ id: 'nextDay', date: '2026-08-11T00:00:01' }),
    ]
    const result = filterTransactionsByRange(transactions, { filter: 'custom', customStart: '2026-08-10', customEnd: '2026-08-10', now })
    expect(result.map(t => t.id).sort()).toEqual(['morning', 'night'])
  })

  it('未知 filter（無 range）時回傳全部交易', () => {
    const transactions = [tx({ id: 'a' }), tx({ id: 'b' })]
    expect(filterTransactionsByRange(transactions, { filter: 'unknown', now })).toHaveLength(2)
  })
})

// ─── getActiveTransactions ─────────────────────────────────────────────────────

describe('getActiveTransactions', () => {
  it('排除 cancelled 為 true 的交易', () => {
    const transactions = [tx({ id: 'a' }), tx({ id: 'b', cancelled: true }), tx({ id: 'c' })]
    expect(getActiveTransactions(transactions).map(t => t.id)).toEqual(['a', 'c'])
  })

  it('cancelled 欄位缺漏時視為未取消', () => {
    const transactions = [tx({ id: 'a', cancelled: undefined })]
    expect(getActiveTransactions(transactions)).toHaveLength(1)
  })
})

// ─── calcSummary ────────────────────────────────────────────────────────────────

describe('calcSummary', () => {
  it('正常交易正確加總 totalRevenue 與 totalItems', () => {
    const activeTx = [
      tx({ total: 100, items: [{ name: 'A', quantity: 2 }] }),
      tx({ total: 250, items: [{ name: 'B', quantity: 1 }, { name: 'C', quantity: 3 }] }),
    ]
    const { totalRevenue, totalItems } = calcSummary(activeTx)
    expect(totalRevenue).toBe(350)
    expect(totalItems).toBe(6)
  })

  it('空陣列回傳 0', () => {
    expect(calcSummary([])).toEqual({ totalRevenue: 0, totalItems: 0 })
  })

  it('tx.total 為 undefined 時視為 0，不污染成 NaN', () => {
    const activeTx = [tx({ total: undefined }), tx({ total: 100 })]
    expect(calcSummary(activeTx).totalRevenue).toBe(100)
  })

  it('tx.total 為 null 時視為 0', () => {
    const activeTx = [tx({ total: null }), tx({ total: 50 })]
    expect(calcSummary(activeTx).totalRevenue).toBe(50)
  })

  it('tx.items 缺漏時 totalItems 不噴錯，視為 0 件', () => {
    const activeTx = [tx({ items: undefined, total: 100 })]
    const { totalRevenue, totalItems } = calcSummary(activeTx)
    expect(totalRevenue).toBe(100)
    expect(totalItems).toBe(0)
  })

  it('item.quantity 為非數字時視為 0', () => {
    const activeTx = [tx({ items: [{ name: 'A', quantity: undefined }] })]
    expect(calcSummary(activeTx).totalItems).toBe(0)
  })
})

// ─── aggregatePaymentData ─────────────────────────────────────────────────────

describe('aggregatePaymentData', () => {
  it('單一付款方式正確彙總', () => {
    const activeTx = [tx({ payments: [{ method: '現金', amount: 100 }] })]
    const result = aggregatePaymentData(activeTx)
    expect(result).toEqual([{ name: '現金', count: 1, amount: 100 }])
  })

  it('多筆交易同付款方式加總金額與筆數', () => {
    const activeTx = [
      tx({ payments: [{ method: '現金', amount: 100 }] }),
      tx({ payments: [{ method: '現金', amount: 200 }] }),
    ]
    const result = aggregatePaymentData(activeTx)
    expect(result).toEqual([{ name: '現金', count: 2, amount: 300 }])
  })

  it('單筆交易混合多種付款方式，各自累計', () => {
    const activeTx = [
      tx({ payments: [{ method: '現金', amount: 40 }, { method: 'Linepay', amount: 60 }] }),
    ]
    const result = aggregatePaymentData(activeTx)
    const byName = Object.fromEntries(result.map(r => [r.name, r]))
    expect(byName['現金']).toEqual({ name: '現金', count: 1, amount: 40 })
    expect(byName['Linepay']).toEqual({ name: 'Linepay', count: 1, amount: 60 })
  })

  it('依金額由大到小排序', () => {
    const activeTx = [
      tx({ payments: [{ method: '現金', amount: 50 }] }),
      tx({ payments: [{ method: 'Linepay', amount: 200 }] }),
    ]
    const result = aggregatePaymentData(activeTx)
    expect(result.map(r => r.name)).toEqual(['Linepay', '現金'])
  })

  it('沒有 payments 陣列時 fallback 到 paymentMethod + total', () => {
    const activeTx = [tx({ payments: [], paymentMethod: '銀行轉帳', total: 150 })]
    const result = aggregatePaymentData(activeTx)
    expect(result).toEqual([{ name: '銀行轉帳', count: 1, amount: 150 }])
  })

  it('payments 不是陣列（極舊資料）時也走 fallback', () => {
    const activeTx = [tx({ payments: undefined, paymentMethod: '現金', total: 80 })]
    const result = aggregatePaymentData(activeTx)
    expect(result).toEqual([{ name: '現金', count: 1, amount: 80 }])
  })

  it('付款方式分佈加總應等於總營業額（不變式，防止找零 bug 回歸）', () => {
    const activeTx = [
      tx({ total: 140, payments: [{ method: '現金', amount: 140 }] }),
      tx({ total: 200, payments: [{ method: 'Linepay', amount: 100 }, { method: '現金', amount: 100 }] }),
    ]
    const { totalRevenue } = calcSummary(activeTx)
    const paymentTotal = aggregatePaymentData(activeTx).reduce((s, p) => s + p.amount, 0)
    expect(paymentTotal).toBe(totalRevenue)
  })

  it('method 缺漏時歸類為「未指定」', () => {
    const activeTx = [tx({ payments: [{ amount: 100 }] })]
    expect(aggregatePaymentData(activeTx)[0].name).toBe('未指定')
  })

  it('p.amount 為非數字時視為 0，不污染成 NaN', () => {
    const activeTx = [tx({ payments: [{ method: '現金', amount: undefined }] })]
    expect(aggregatePaymentData(activeTx)[0].amount).toBe(0)
  })
})

// ─── aggregateDailyData ────────────────────────────────────────────────────────

describe('aggregateDailyData', () => {
  it('空交易回傳空陣列', () => {
    expect(aggregateDailyData([], 'today')).toEqual([])
  })

  it('today：依小時彙總，只保留有交易的小時範圍（前後各留一格）', () => {
    const activeTx = [
      tx({ date: new Date(2026, 7, 18, 10, 0).toISOString(), total: 100 }),
      tx({ date: new Date(2026, 7, 18, 12, 0).toISOString(), total: 200 }),
    ]
    const result = aggregateDailyData(activeTx, 'today')
    expect(result[0].label).toBe('09')
    expect(result[result.length - 1].label).toBe('13')
    const byLabel = Object.fromEntries(result.map(r => [r.label, r]))
    expect(byLabel['10'].revenue).toBe(100)
    expect(byLabel['12'].revenue).toBe(200)
  })

  it('today：全部交易都在同一小時內，全部沒有交易的小時回傳空陣列', () => {
    const activeTx = [tx({ date: new Date(2026, 7, 18, 5, 30).toISOString(), total: 0 })]
    // total 為 0，nonZeroIdx 為空 → 回傳空陣列
    expect(aggregateDailyData(activeTx, 'today')).toEqual([])
  })

  it('week：週一到週日固定 7 天，正確標記中文星期', () => {
    const now = new Date(2026, 7, 18, 12, 0) // 週二
    const activeTx = [tx({ date: new Date(2026, 7, 17, 10, 0).toISOString(), total: 100 })] // 週一
    const result = aggregateDailyData(activeTx, 'week', now)
    expect(result).toHaveLength(7)
    expect(result.map(d => d.label)).toEqual(['一', '二', '三', '四', '五', '六', '日'])
    expect(result[0].revenue).toBe(100)
  })

  it('month：天數依當月實際天數產生（例如 2 月）', () => {
    const now = new Date(2026, 1, 10) // 2026-02（非閏年 28 天）
    const result = aggregateDailyData([], 'month', now)
    // activeTx 為空時直接回傳 []（由 aggregateDailyData 開頭的空陣列判斷決定）
    expect(result).toEqual([])
  })

  it('month：有交易時，天數對應當月天數', () => {
    const now = new Date(2026, 1, 10) // 2026-02
    const activeTx = [tx({ date: new Date(2026, 1, 5, 9, 0).toISOString(), total: 100 })]
    const result = aggregateDailyData(activeTx, 'month', now)
    expect(result).toHaveLength(28)
    expect(result[4].revenue).toBe(100) // 2/5 → index 4
  })

  it('month：跨月交界，月底最後一天與下月 1 號不互相污染', () => {
    const now = new Date(2026, 7, 18) // 2026-08
    const activeTx = [
      tx({ id: 'lastMonth', date: new Date(2026, 6, 31, 23, 0).toISOString(), total: 999 }),
      tx({ id: 'thisMonth', date: new Date(2026, 7, 1, 0, 0).toISOString(), total: 50 }),
    ]
    const result = aggregateDailyData(activeTx, 'month', now)
    expect(result[0].revenue).toBe(50) // 8/1，只有本月那筆
  })

  it('custom：只列出有交易的日期，依日期排序', () => {
    const activeTx = [
      tx({ date: '2026-08-05T10:00:00', total: 100 }),
      tx({ date: '2026-08-01T10:00:00', total: 50 }),
    ]
    const result = aggregateDailyData(activeTx, 'custom')
    expect(result.map(r => r.key)).toEqual(['2026-08-01', '2026-08-05'])
  })

  it('custom：超過 62 天時回傳空陣列（圖表隱藏，但不影響總計）', () => {
    const activeTx = Array.from({ length: 63 }, (_, i) =>
      tx({ id: `t${i}`, date: new Date(2026, 0, 1 + i).toISOString(), total: 10 })
    )
    expect(aggregateDailyData(activeTx, 'custom')).toEqual([])
  })

  it('custom：恰好 62 天時仍正常回傳', () => {
    const activeTx = Array.from({ length: 62 }, (_, i) =>
      tx({ id: `t${i}`, date: new Date(2026, 0, 1 + i).toISOString(), total: 10 })
    )
    expect(aggregateDailyData(activeTx, 'custom')).toHaveLength(62)
  })
})

// ─── aggregateTopProducts ──────────────────────────────────────────────────────

describe('aggregateTopProducts', () => {
  it('依商品名稱彙總數量與營收', () => {
    const activeTx = [
      tx({ items: [{ name: '玫瑰', quantity: 2, subtotal: 200 }] }),
      tx({ items: [{ name: '玫瑰', quantity: 1, subtotal: 100 }] }),
    ]
    const result = aggregateTopProducts(activeTx)
    expect(result).toEqual([{ name: '玫瑰', quantity: 3, revenue: 300 }])
  })

  it('依數量由大到小排序，取前 5 名', () => {
    const activeTx = [
      tx({ items: [
        { name: 'A', quantity: 1, subtotal: 10 },
        { name: 'B', quantity: 5, subtotal: 50 },
        { name: 'C', quantity: 3, subtotal: 30 },
        { name: 'D', quantity: 4, subtotal: 40 },
        { name: 'E', quantity: 2, subtotal: 20 },
        { name: 'F', quantity: 6, subtotal: 60 },
      ] }),
    ]
    const result = aggregateTopProducts(activeTx)
    expect(result).toHaveLength(5)
    expect(result.map(r => r.name)).toEqual(['F', 'B', 'D', 'C', 'E'])
  })

  it('可自訂 limit', () => {
    const activeTx = [tx({ items: [
      { name: 'A', quantity: 1, subtotal: 10 },
      { name: 'B', quantity: 2, subtotal: 20 },
    ] })]
    expect(aggregateTopProducts(activeTx, 1)).toHaveLength(1)
  })

  it('全部商品加總 revenue 不超過總營業額', () => {
    const activeTx = [
      tx({ total: 300, items: [{ name: 'A', quantity: 1, subtotal: 100 }, { name: 'B', quantity: 1, subtotal: 200 }] }),
    ]
    const { totalRevenue } = calcSummary(activeTx)
    const productRevenue = aggregateTopProducts(activeTx, 100).reduce((s, p) => s + p.revenue, 0)
    expect(productRevenue).toBeLessThanOrEqual(totalRevenue)
  })

  it('tx.items 缺漏時不噴錯', () => {
    expect(aggregateTopProducts([tx({ items: undefined })])).toEqual([])
  })

  it('空交易回傳空陣列', () => {
    expect(aggregateTopProducts([])).toEqual([])
  })
})
