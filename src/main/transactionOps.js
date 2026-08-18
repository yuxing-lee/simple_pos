/**
 * 依 id 標記交易為已取消/已恢復。以 tx.id === id 比對，
 * 若交易 id 產生時發生碰撞（重複），會同時套用到所有相同 id 的交易，
 * 因此交易 id 必須具備高唯一性（見 Checkout.jsx 使用 cuid() 產生 id）。
 */
export const applyCancel = (transactions, id) =>
  transactions.map(tx => tx.id === id ? { ...tx, cancelled: true } : tx)

export const applyRestore = (transactions, id) =>
  transactions.map(tx => tx.id === id ? { ...tx, cancelled: false } : tx)
