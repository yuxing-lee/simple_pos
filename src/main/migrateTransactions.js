/**
 * 修正舊資料中「超付未扣除找零」的交易紀錄：
 * 若現金付款金額仍包含找零（payments 加總 > total），將超額部分從現金金額扣除，
 * 並記錄為 change，使 payments 加總等於 total。已修正過或無現金付款的交易維持不變。
 */
export const migrateOverpaidTransactions = (transactions) => {
  let changed = false
  const migrated = transactions.map(tx => {
    if (!Array.isArray(tx.payments) || tx.payments.length === 0) return tx
    if (typeof tx.total !== 'number') return tx
    const cashPayment = tx.payments.find(p => p.method === '現金')
    if (!cashPayment) return tx

    const nonCashTotal = tx.payments
      .filter(p => p.method !== '現金')
      .reduce((sum, p) => sum + p.amount, 0)
    const requiredCash = Math.max(0, tx.total - nonCashTotal)
    const change = Math.max(0, cashPayment.amount - requiredCash)
    if (change === 0) return tx

    changed = true
    return {
      ...tx,
      payments: tx.payments.map(p =>
        p.method === '現金' ? { ...p, amount: p.amount - change } : p
      ),
      change: (tx.change || 0) + change,
    }
  })
  return { migrated, changed }
}
