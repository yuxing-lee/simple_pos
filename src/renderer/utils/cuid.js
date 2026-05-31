// Minimal CUID v1 generator — browser/renderer safe, no dependencies.
// 產生與 cliu-studio (Prisma @default(cuid)) 相容的 ID，可通過其 zod .cuid() 驗證。
// 格式：'c' + 24 字元 (base36)，共 25 字元，例如 cmik239ih0001rf9buykfky6l
const BLOCK = 4
const BASE = 36
const DISCRETE = Math.pow(BASE, BLOCK) // 1,679,616

const pad = (str, size) => ('000000000' + str).slice(-size)
const randomBlock = () =>
  pad(Math.floor(Math.random() * DISCRETE).toString(BASE), BLOCK)

// 每個 session 固定的 fingerprint
const fingerprint = randomBlock()

let counter = 0

export function cuid() {
  const timestamp = Date.now().toString(BASE)
  counter = counter < DISCRETE ? counter : 0
  const count = pad((counter++).toString(BASE), BLOCK)
  return 'c' + timestamp + count + fingerprint + randomBlock()
}
