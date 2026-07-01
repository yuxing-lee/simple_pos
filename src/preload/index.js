import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll'),
    save: (product) => ipcRenderer.invoke('products:save', product),
    delete: (id) => ipcRenderer.invoke('products:delete', id)
  },
  transactions: {
    save: (transaction) => ipcRenderer.invoke('transactions:save', transaction),
    getAll: () => ipcRenderer.invoke('transactions:getAll'),
    cancel: (id) => ipcRenderer.invoke('transactions:cancel', id),
    restore: (id) => ipcRenderer.invoke('transactions:restore', id)
  },
  quickSelect: {
    getAll: () => ipcRenderer.invoke('quickSelect:getAll'),
    toggle: (id) => ipcRenderer.invoke('quickSelect:toggle', id)
  },
  app: {
    getDataPath: () => ipcRenderer.invoke('app:getDataPath')
  }
})
