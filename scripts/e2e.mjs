// 開発サーバーに対してスマホ相当の画面で主要フローを操作し、スクリーンショットとコンソールエラーを収集する
// 使い方: node scripts/e2e.mjs [baseUrl] [outDir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:5199/'
const OUT = process.argv[3] ?? 'e2e-shots'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--lang=ja'],
})
const page = await browser.newPage()
await page.setViewport(VIEWPORT)
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')

const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`[${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.name}: ${err.message}
${err.stack ?? ''}`))

let shotIndex = 0
async function shot(name) {
  shotIndex += 1
  const file = join(OUT, `${String(shotIndex).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('shot', file)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** テキストを含むボタンをクリックする */
async function clickText(text, { tag = 'button', index = 0, timeout = 4000, exact = false } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const ok = await page.evaluate(
      (t, tg, idx, ex) => {
        const norm = (e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        const els = [...document.querySelectorAll(tg)].filter((e) => (ex ? norm(e) === t : norm(e).includes(t)) && !e.disabled)
        const el = els[idx]
        if (!el) return false
        el.scrollIntoView({ block: 'center' })
        el.click()
        return true
      },
      text,
      tag,
      index,
      exact,
    )
    if (ok) return
    await sleep(100)
  }
  throw new Error(`button not found: ${text}`)
}

/** 種目ピッカーで名前が完全一致する行を選ぶ */
async function pickExercise(name) {
  const ok = await page.evaluate((n) => {
    const span = [...document.querySelectorAll('.ep__name')].find((e) => e.textContent?.trim() === n)
    const btn = span?.closest('button')
    if (!btn || btn.disabled) return false
    btn.scrollIntoView({ block: 'center' })
    btn.click()
    return true
  }, name)
  if (!ok) throw new Error(`exercise not found: ${name}`)
}

async function clickLabel(label, { timeout = 4000 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const ok = await page.evaluate((l) => {
      const el = document.querySelector(`[aria-label="${l}"]`)
      if (!el || el.disabled) return false
      el.scrollIntoView({ block: 'center' })
      if (el.classList.contains('stepper__btn')) {
        // ステッパーは pointerdown/up で動く
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }))
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', isPrimary: true }))
        return true
      }
      el.click()
      return true
    }, label)
    if (ok) return
    await sleep(100)
  }
  throw new Error(`aria-label not found: ${label}`)
}

async function typeInto(selector, value) {
  await page.waitForSelector(selector, { timeout: 4000 })
  await page.click(selector, { clickCount: 3 })
  await page.type(selector, value)
}

async function textOf(selector) {
  return page.$eval(selector, (e) => e.textContent?.trim() ?? '')
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
  console.log('ok  ', msg)
}

try {
  // 1. ホーム（初回）
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(400)
  await shot('home-fresh')
  assert((await textOf('.hp__title')) === '今日', 'ホームが表示される')

  // 2. 体重を +0.3 して自動保存
  await clickLabel('体重を0.1kg増やす')
  await clickLabel('体重を0.1kg増やす')
  await clickLabel('体重を0.1kg増やす')
  await sleep(900)
  const wqStatus = await textOf('.wq__status')
  assert(wqStatus.includes('保存') || wqStatus.includes('今日'), `体重が自動保存される (${wqStatus})`)
  await shot('home-weight-saved')

  // 3. ワークアウト開始（種目を選ぶ）
  await clickText('トレ', { tag: 'a' })
  await sleep(400)
  await shot('workout-empty')
  await clickText('種目を選んで開始')
  await sleep(400)
  await shot('exercise-picker')
  await pickExercise('腕立て伏せ')
  await pickExercise('スクワット')
  await pickExercise('プランク')
  await clickText('3種目を選んで開始')
  await sleep(600)
  await shot('session-start')
  assert(page.url().includes('#/workout/'), 'セッション画面に遷移')

  // 4. セット完了 → 休憩タイマー
  await clickLabel('腕立て伏せ セット1を完了')
  await sleep(400)
  await shot('session-set1-timer')
  const timerVisible = await page.$('.rest-bar')
  assert(timerVisible !== null, '休憩タイマーが表示される')
  await clickLabel('腕立て伏せの回数を1回増やす')
  await clickLabel('腕立て伏せ セット2を完了')
  await sleep(300)
  const doneSets = await page.$$eval('.xb__set--done', (els) => els.length)
  assert(doneSets === 2, `2セット記録された (${doneSets})`)
  await clickLabel('休憩をスキップ')
  await sleep(200)

  // 時間種目: プランクの計測スタート → ストップ
  await clickText('タイマーで計測して記録')
  await sleep(1300)
  await shot('session-timing')
  await clickLabel('計測を止めて記録する')
  await sleep(400)
  await shot('session-after-plank')

  // 5. 終了
  await clickText('終了')
  await sleep(600)
  await shot('workout-done')
  assert((await page.$('.wp__today')) !== null, '今日のワークアウトカードが出る')

  // 6. 食事: フード登録 → ワンタップ記録
  await clickText('食事', { tag: 'a' })
  await sleep(400)
  await shot('meals-empty')
  await clickText('フード登録')
  await sleep(300)
  await typeInto('.sheet input[placeholder*="鶏むね肉"]', '鶏むね肉 100g')
  await typeInto('.sheet input[placeholder="0"]', '110')
  const pfcInputs = await page.$$('.ff__pfc input')
  await pfcInputs[0].type('23')
  await pfcInputs[1].type('1.5')
  await pfcInputs[2].type('0')
  await shot('food-form')
  await clickText('保存')
  await sleep(400)
  await clickText('鶏むね肉 100g', { index: 0 })
  await sleep(500)
  await shot('meals-logged')
  const entryCount = await page.$$eval('.mel__row', (els) => els.length)
  assert(entryCount === 1, `食事が1件記録された (${entryCount})`)

  // シート表示中でもトーストの「取り消す」が押せる（inert の巻き込み防止）
  await clickText('登録済み')
  await sleep(300)
  await clickText('鶏むね肉 100g', { index: 0 })
  await sleep(300)
  await shot('picker-with-toast')
  await clickText('取り消す')
  await sleep(300)
  await clickLabel('閉じる')
  await sleep(300)
  const afterUndo = await page.$$eval('.mel__row', (els) => els.length)
  assert(afterUndo === 1, `シート上で取り消しできる (${afterUndo})`)

  // ざっくり記録
  await clickText('ざっくり')
  await sleep(300)
  await shot('quick-meal')
  await clickText('記録する')
  await sleep(400)
  const entryCount2 = await page.$$eval('.mel__row', (els) => els.length)
  assert(entryCount2 === 2, `ざっくり記録が追加された (${entryCount2})`)

  // 記録をタップして分量変更
  await page.click('.mel__row')
  await sleep(300)
  await shot('meal-edit')
  await clickLabel('分量を0.5倍増やす')
  await clickText('保存')
  await sleep(300)
  const qtyText = await page.$eval('.mel__row', (e) => e.textContent ?? '')
  assert(qtyText.includes('×1.5'), `分量が1.5倍に更新 (${qtyText.slice(0, 40)})`)

  // 7. 記録ページ
  await clickText('記録', { tag: 'a' })
  await sleep(500)
  await shot('log')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(300)
  await shot('log-bottom')

  // 8. 設定ページ
  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await shot('settings')
  await clickText('自動計算')
  await sleep(400)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(300)
  await shot('settings-bottom')

  // 8b. AIキーを設定すると「写真」「AIに話す」が出て、話すシートに入力欄がある（通信はしない）
  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await typeInto('input[type="password"]', 'sk-dummy-for-e2e')
  await sleep(700)
  await page.goto(`${BASE}#/meals`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await clickText('AIに話す')
  await sleep(400)
  await page.waitForSelector('.am__text', { timeout: 3000 })
  await page.type('.am__text', '牛丼の並盛とサラダ')
  await shot('ai-talk')
  const estimateEnabled = await page.$eval('.sheet__footer .btn', (b) => !b.disabled)
  assert(estimateEnabled, 'AIに話す: 入力すると推定ボタンが有効になる')
  await clickLabel('閉じる')
  await sleep(300)

  // フード登録フォームに AI 推定ボタンが出る（名前を入れると有効）
  await clickText('フード登録')
  await sleep(300)
  const aiFillDisabled = await page.$eval('.ff__ai .btn', (b) => b.disabled)
  assert(aiFillDisabled, 'フード登録: 名前が空だと AI 推定は無効')
  await typeInto('.sheet input[placeholder*="鶏むね肉"]', 'セブンのサラダチキン')
  const aiFillEnabled = await page.$eval('.ff__ai .btn', (b) => !b.disabled)
  assert(aiFillEnabled, 'フード登録: 名前を入れると AI 推定が有効')
  await shot('food-form-ai')
  await clickLabel('閉じる')
  await sleep(300)

  // 9. ホーム（データあり）
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(500)
  await shot('home-with-data')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(300)
  await shot('home-with-data-bottom')

  // 10. 2回目のワークアウト: 前回と同じで開始 → 残りを一括完了
  await page.evaluate(async () => {
    // 今日のワークアウトを「昨日」に付け替えて、前回扱いにする
    const req = indexedDB.open('workout-app')
    await new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const dbx = req.result
        const tx = dbx.transaction('workouts', 'readwrite')
        const store = tx.objectStore('workouts')
        const getAll = store.getAll()
        getAll.onsuccess = () => {
          for (const w of getAll.result) {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            w.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            w.startedAt -= 86400000
            w.endedAt -= 86400000
            store.put(w)
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(500)
  await shot('home-repeat')
  await clickText('前回と同じで開始')
  await sleep(600)
  await shot('session-prefilled')
  const ghost = await page.$$eval('.xb__set--ghost', (els) => els.length)
  assert(ghost >= 3, `前回のセットがプリセット表示される (${ghost})`)
  await clickText('前回と同じで一括記録')
  await sleep(500)
  const bulkDone = await page.$$eval('.xb__set--done', (els) => els.length)
  assert(bulkDone === 3, `一括記録で3セット記録 (${bulkDone})`)
  await shot('session-bulk-done')

  // 種目メニュー → 次のレベル
  await clickLabel('スクワット のメニュー')
  await sleep(300)
  await shot('exercise-menu')
  await clickText('次のレベル')
  await sleep(400)
  const names = await page.$$eval('.xb__name', (els) => els.map((e) => e.textContent))
  assert(names.includes('ブルガリアンスクワット'), `進化先に切り替わる (${names.join(',')})`)
  await shot('session-progressed')
} catch (e) {
  console.error('FAILED:', e.message)
  await shot('failure')
  process.exitCode = 1
} finally {
  console.log('\n--- console errors/warnings ---')
  const filtered = errors.filter((e) => !e.includes('React DevTools') && !e.includes('Download the React'))
  for (const e of filtered) console.log(e)
  if (filtered.length === 0) console.log('(none)')
  await browser.close()
}
