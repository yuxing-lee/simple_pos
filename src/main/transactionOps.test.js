import { describe, it, expect } from 'vitest'
import { applyCancel, applyRestore } from './transactionOps'

describe('applyCancel', () => {
  it('將指定 id 的交易標記為已取消', () => {
    const transactions = [{ id: '1', total: 100 }, { id: '2', total: 200 }]
    const result = applyCancel(transactions, '1')
    expect(result[0]).toEqual({ id: '1', total: 100, cancelled: true })
    expect(result[1]).toEqual({ id: '2', total: 200 })
  })

  it('id 不存在時，交易內容不變', () => {
    const transactions = [{ id: '1', total: 100 }]
    expect(applyCancel(transactions, 'not-exist')).toEqual(transactions)
  })

  it('連續取消同一筆交易兩次，結果與取消一次相同（冪等）', () => {
    const transactions = [{ id: '1', total: 100 }]
    const once = applyCancel(transactions, '1')
    const twice = applyCancel(once, '1')
    expect(twice).toEqual(once)
  })

  it('空陣列不噴錯', () => {
    expect(applyCancel([], '1')).toEqual([])
  })

  it('⚠️ id 碰撞時會同時取消所有相同 id 的交易（因此交易 id 必須具備高唯一性）', () => {
    const transactions = [
      { id: 'dup', name: '訂單A', total: 100 },
      { id: 'dup', name: '訂單B', total: 200 },
    ]
    const result = applyCancel(transactions, 'dup')
    expect(result.every(tx => tx.cancelled === true)).toBe(true)
  })
})

describe('applyRestore', () => {
  it('將指定 id 的交易標記為未取消', () => {
    const transactions = [{ id: '1', total: 100, cancelled: true }, { id: '2', total: 200, cancelled: true }]
    const result = applyRestore(transactions, '1')
    expect(result[0]).toEqual({ id: '1', total: 100, cancelled: false })
    expect(result[1]).toEqual({ id: '2', total: 200, cancelled: true })
  })

  it('id 不存在時，交易內容不變', () => {
    const transactions = [{ id: '1', total: 100, cancelled: true }]
    expect(applyRestore(transactions, 'not-exist')).toEqual(transactions)
  })

  it('對未取消的交易恢復，維持未取消狀態', () => {
    const transactions = [{ id: '1', total: 100 }]
    expect(applyRestore(transactions, '1')).toEqual([{ id: '1', total: 100, cancelled: false }])
  })

  it('連續恢復同一筆交易兩次，結果相同（冪等）', () => {
    const transactions = [{ id: '1', total: 100, cancelled: true }]
    const once = applyRestore(transactions, '1')
    const twice = applyRestore(once, '1')
    expect(twice).toEqual(once)
  })

  it('取消後恢復，交易回到未取消狀態且金額不變', () => {
    const transactions = [{ id: '1', total: 100 }]
    const cancelled = applyCancel(transactions, '1')
    const restored = applyRestore(cancelled, '1')
    expect(restored).toEqual([{ id: '1', total: 100, cancelled: false }])
  })
})
