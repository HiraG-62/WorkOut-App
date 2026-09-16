// v1 の DB（order 無し）を用意してからアプリを開き、v2 マイグレーションで order が付くことを確認する
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://localhost:5199/'
const CHROME = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// 同一オリジンの空ページで v1 DB を作る（アプリの JS は読み込まない）
await page.goto(`${BASE}favicon.svg`, { waitUntil: 'load' })
await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('workout-app', 1)
      req.onupgradeneeded = () => {
        const dbx = req.result
        const stores = {
          exercises: 'id',
          workouts: 'id',
          sets: 'id',
          foods: 'id',
          meals: 'id',
          mealSets: 'id',
          weights: 'id',
          settings: 'id',
        }
        for (const [name, key] of Object.entries(stores)) dbx.createObjectStore(name, { keyPath: key })
      }
      req.onsuccess = () => {
        const dbx = req.result
        const tx = dbx.transaction('exercises', 'readwrite')
        tx.objectStore('exercises').put({ id: 'ex_squat', name: 'スクワット', type: 'reps', bodyPart: 'legs', useWeight: false, isCustom: false, archived: false, createdAt: 0 })
        tx.objectStore('exercises').put({ id: 'custom1', name: '自作種目', type: 'reps', bodyPart: 'full', useWeight: false, isCustom: true, archived: false, createdAt: 1 })
        tx.oncomplete = () => {
          dbx.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    }),
)

await page.goto(BASE, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 800))
const result = await page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('workout-app')
      req.onsuccess = () => {
        const dbx = req.result
        const tx = dbx.transaction('exercises', 'readonly')
        const getAll = tx.objectStore('exercises').getAll()
        getAll.onsuccess = () => resolve({ version: dbx.version, rows: getAll.result.map((r) => ({ id: r.id, order: r.order })) })
        getAll.onerror = () => reject(getAll.error)
      }
      req.onerror = () => reject(req.error)
    }),
)
const squat = result.rows.find((r) => r.id === 'ex_squat')
const custom = result.rows.find((r) => r.id === 'custom1')
console.log('db version:', result.version)
console.log('ex_squat order:', squat?.order, '| custom1 order:', custom?.order)
console.log('errors:', errors.length ? errors : 'none')
// Dexie は内部バージョンを 10 倍で保持する
const DEXIE_VERSION_SCALE = 10
const ok = result.version === 2 * DEXIE_VERSION_SCALE && typeof squat?.order === 'number' && custom?.order === undefined && errors.length === 0
console.log(ok ? 'MIGRATION OK' : 'MIGRATION FAILED')
process.exitCode = ok ? 0 : 1
await browser.close()
