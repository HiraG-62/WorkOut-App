// 本番ビルドで「新バージョン → 更新バナー → 再読み込み」の流れを確認する
// 使い方: vite preview(4173) を起動した状態で node scripts/update-check.mjs
import { execSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://localhost:4173/'
const CHROME = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// 1. 現在のビルドを開いて SW を有効化
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(2000)
const before = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? null)
console.log('sw before:', before)

// 2. 別バージョンをビルド（BUILD_ID を変えると index.html の meta が変わり precache が変わる）
execSync('npm run build', { stdio: 'ignore', env: { ...process.env, BUILD_ID: `upd-${Date.now()}` } })

// 3. 更新チェック → バナー表示
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  await reg?.update()
})
let bannerShown = false
for (let i = 0; i < 30; i++) {
  if (await page.$('.upd')) {
    bannerShown = true
    break
  }
  await sleep(500)
}
console.log('update banner:', bannerShown ? 'shown' : 'not shown')

// 4. 「更新」で再読み込みされる
let reloaded = false
if (bannerShown) {
  // ページにマーカーを置き、再読み込みで消えることを確認する
  await page.evaluate(() => {
    window.__updateMarker = true
  })
  await page.click('.upd__btn')
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    const marker = await page.evaluate(() => window.__updateMarker === true).catch(() => false)
    if (!marker) {
      reloaded = true
      break
    }
  }
  await sleep(800)
}
console.log('reloaded:', reloaded)
const title = await page.$eval('.hp__title', (e) => e.textContent).catch(() => null)
console.log('after reload title:', title)
console.log('errors:', errors.length ? errors : 'none')
const ok = before === 'activated' && bannerShown && reloaded && title === '今日' && errors.length === 0
console.log(ok ? 'UPDATE FLOW OK' : 'UPDATE FLOW FAILED')
process.exitCode = ok ? 0 : 1
await browser.close()
