import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// Data directory using userData path for persistence
const getDataDir = () => {
  const dataDir = join(app.getPath('userData'), 'simple-pos-data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  return dataDir
}

const getProductsFile = () => join(getDataDir(), 'products.json')
const getTransactionsFile = () => join(getDataDir(), 'transactions.json')
const getQuickSelectFile = () => join(getDataDir(), 'quickSelect.json')

const readJsonFile = (filePath) => {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify([]), 'utf-8')
    return []
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

const writeJsonFile = (filePath, data) => {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: '簡易收銀系統',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers

ipcMain.handle('products:getAll', () => {
  return readJsonFile(getProductsFile())
})

ipcMain.handle('products:save', (_, product) => {
  const products = readJsonFile(getProductsFile())
  products.push(product)
  writeJsonFile(getProductsFile(), products)
  return product
})

ipcMain.handle('products:delete', (_, id) => {
  const products = readJsonFile(getProductsFile())
  const updated = products.filter(p => p.id !== id)
  writeJsonFile(getProductsFile(), updated)
  return true
})

ipcMain.handle('transactions:save', (_, transaction) => {
  const transactions = readJsonFile(getTransactionsFile())
  transactions.push(transaction)
  writeJsonFile(getTransactionsFile(), transactions)
  return transaction
})

ipcMain.handle('transactions:getAll', () => {
  return readJsonFile(getTransactionsFile())
})

ipcMain.handle('transactions:cancel', (_, id) => {
  const transactions = readJsonFile(getTransactionsFile())
  const updated = transactions.map(tx => tx.id === id ? { ...tx, cancelled: true } : tx)
  writeJsonFile(getTransactionsFile(), updated)
  return true
})

ipcMain.handle('transactions:restore', (_, id) => {
  const transactions = readJsonFile(getTransactionsFile())
  const updated = transactions.map(tx => tx.id === id ? { ...tx, cancelled: false } : tx)
  writeJsonFile(getTransactionsFile(), updated)
  return true
})

ipcMain.handle('quickSelect:getAll', () => {
  return readJsonFile(getQuickSelectFile())
})

ipcMain.handle('quickSelect:toggle', (_, id) => {
  const ids = readJsonFile(getQuickSelectFile())
  const updated = ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]
  writeJsonFile(getQuickSelectFile(), updated)
  return updated
})

ipcMain.handle('app:getDataPath', () => {
  return getDataDir()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
