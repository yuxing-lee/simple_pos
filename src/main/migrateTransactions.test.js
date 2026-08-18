import { describe, it, expect } from 'vitest'
import { migrateOverpaidTransactions } from './migrateTransactions'

describe('migrateOverpaidTransactions', () => {
  it('現金超付的舊交易：扣除找零並記錄 change', () => {
    const transactions = [
      { id: '1', total: 140, payments: [{ method: '現金', amount: 500 }] },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(true)
    expect(migrated).toEqual([
      { id: '1', total: 140, payments: [{ method: '現金', amount: 140 }], change: 360 },
    ])
  })

  it('混合付款超付：僅從現金扣除，非現金金額不變', () => {
    const transactions = [
      {
        id: '2', total: 140,
        payments: [{ method: 'Linepay', amount: 100 }, { method: '現金', amount: 100 }],
      },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(true)
    expect(migrated[0].payments).toEqual([
      { method: 'Linepay', amount: 100 },
      { method: '現金', amount: 40 },
    ])
    expect(migrated[0].change).toBe(60)
  })

  it('精確付款的交易維持不變，changed 為 false', () => {
    const transactions = [
      { id: '3', total: 140, payments: [{ method: '現金', amount: 140 }] },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(false)
    expect(migrated).toEqual(transactions)
  })

  it('已修正過的交易（payments 加總已等於 total）不會重複疊加 change', () => {
    const transactions = [
      { id: '4', total: 140, payments: [{ method: '現金', amount: 140 }], change: 360 },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(false)
    expect(migrated[0].change).toBe(360)
  })

  it('沒有現金付款方式時不受影響', () => {
    const transactions = [
      { id: '5', total: 140, payments: [{ method: 'Linepay', amount: 140 }] },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(false)
    expect(migrated).toEqual(transactions)
  })

  it('已取消的交易也一併修正（維持顯示一致性）', () => {
    const transactions = [
      { id: '6', total: 140, cancelled: true, payments: [{ method: '現金', amount: 500 }] },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(true)
    expect(migrated[0].payments).toEqual([{ method: '現金', amount: 140 }])
    expect(migrated[0].change).toBe(360)
  })

  it('沒有 payments 欄位（極舊資料）時不受影響', () => {
    const transactions = [
      { id: '7', total: 140, paymentMethod: '現金' },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(false)
    expect(migrated).toEqual(transactions)
  })

  it('多筆交易中僅修正需要修正的那些', () => {
    const transactions = [
      { id: '8', total: 100, payments: [{ method: '現金', amount: 100 }] },
      { id: '9', total: 50, payments: [{ method: '現金', amount: 200 }] },
    ]
    const { migrated, changed } = migrateOverpaidTransactions(transactions)
    expect(changed).toBe(true)
    expect(migrated[0]).toEqual(transactions[0])
    expect(migrated[1].payments).toEqual([{ method: '現金', amount: 50 }])
    expect(migrated[1].change).toBe(150)
  })
})
