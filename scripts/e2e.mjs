// 開発サーバーに対してスマホ相当の画面で主要フローを操作し、スクリーンショットとコンソールエラーを収集する
// 使い方: node scripts/e2e.mjs [baseUrl] [outDir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:5199/'
const OUT = process.argv[3] ?? 'e2e-shots'
const CHROME = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')
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

  // フォームガイド: 図をタップするとポイントと図のシートが開く
  await clickLabel('腕立て伏せ のフォームを見る')
  await sleep(400)
  await shot('form-guide')
  const tipCount = await page.$$eval('.eg__tips li', (els) => els.length)
  assert(tipCount >= 3, `フォームのポイントが表示される (${tipCount})`)
  await clickLabel('閉じる')
  await sleep(300)

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

  // 4b. 推定消費カロリーがセッションのメタ行に出る
  const burnText = await textOf('.ws__burn')
  assert(/kcal/.test(burnText), `セッションに推定消費カロリーが出る (${burnText})`)

  // 4c. セッション画面から「メニューとして保存」（進行中の毎秒更新で入力が消えないこと）
  await clickText('メニューとして保存')
  await sleep(400)
  await page.click('.sheet input[placeholder*="朝の全身"]')
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type('.sheet input[placeholder*="朝の全身"]', '今日のやつ')
  await sleep(1500)
  const keptName = await page.$eval('.sheet input[placeholder*="朝の全身"]', (i) => i.value)
  assert(keptName === '今日のやつ', `保存シートの入力が保持される (${keptName})`)
  const fromSession = await page.$$eval('.re__item', (els) => els.length)
  assert(fromSession === 2, `記録した2種目がメニューに入る (${fromSession})`)
  // 背面の「メニューとして保存」と区別するため完全一致で押す
  await clickText('保存', { exact: true })
  await sleep(500)

  // 5. 終了
  await clickText('終了')
  await sleep(600)
  await shot('workout-done')
  assert((await page.$('.wp__today')) !== null, '今日のワークアウトカードが出る')

  // 5b. セットメニュー: 作成 → 開始 → 計画どおりのプリセット → 0セットで終了（履歴には残らない）
  await clickText('メニューを作る')
  await sleep(400)
  await typeInto('.sheet input[placeholder*="朝の全身"]', 'テストメニュー')
  await clickText('種目を追加')
  await sleep(400)
  await pickExercise('腕立て伏せ')
  await pickExercise('プランク')
  await clickText('メニューに追加')
  await sleep(400)
  const routineItems = await page.$$eval('.re__item', (els) => els.length)
  assert(routineItems === 2, `メニューに2種目入る (${routineItems})`)
  await clickLabel('腕立て伏せのセット数を1set増やす')
  await shot('routine-editor')
  await clickText('保存')
  await sleep(500)
  const routineRow = await page.$$eval('.rs__item', (els) => els.map((e) => e.textContent ?? ''))
  assert(routineRow.some((t) => t.includes('テストメニュー') && t.includes('腕立て伏せ 4×10回')), `メニュー一覧に出る (${routineRow.join('|')})`)
  assert(routineRow.some((t) => t.includes('今日のやつ') && t.includes('腕立て伏せ 2×11回') && t.includes('プランク 1×')), `セッションから保存したメニューが出る (${routineRow.join('|')})`)
  await clickLabel('テストメニュー を開始')
  await sleep(600)
  await shot('session-from-routine')
  const planGhost = await page.$$eval('.xb__set--ghost', (els) => els.length)
  assert(planGhost === 7, `メニューの計画（4+3）がゴースト行になる (${planGhost})`)
  const planLabel = await textOf('.xb__sub')
  assert(planLabel.includes('メニュー 4×10回'), `見出しにメニューの計画が出る (${planLabel})`)
  await clickText('終了')
  await sleep(600)

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

  // 8c. OpenAI をモックして、推定結果を「1つのメニュー」として登録→記録する流れを通す
  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await clickText('ChatGPT')
  await sleep(200)
  await typeInto('input[type="password"]', 'sk-dummy-openai')
  await sleep(700)
  await page.setRequestInterception(true)
  const mockEstimate = {
    items: [
      { name: '鶏むね肉', amount: '200g', kcal: 216, protein: 46, fat: 3, carbs: 0 },
      { name: 'ブロッコリー', amount: '100g', kcal: 33, protein: 4.3, fat: 0.5, carbs: 5.2 },
      { name: '玄米', amount: '150g', kcal: 248, protein: 4.2, fat: 1.5, carbs: 53 },
    ],
    confidence: 'high',
    note: 'モックの推定結果です',
  }
  const mockLabel = {
    productName: 'サラダチキン プレーン',
    basis: '1袋(110g)あたり',
    kcal: 121,
    protein: 26.4,
    fat: 1.3,
    carbs: 0.9,
    source: 'label',
    confidence: 'high',
    note: 'モックの読み取り結果です',
  }
  const mockWeekly = {
    summary: '今週はトレ1日、3セット。まずは記録が始まったのが何より。',
    advice: '来週はトレを2日に増やしてみよう。',
    changeTargets: true,
    suggestedTargets: { kcal: 2300, protein: 135, fat: 60, carbs: 300 },
  }
  const mockClassify = {
    type: 'reps',
    bodyPart: 'chest',
    useWeight: false,
    formFamily: 'pushup',
    met: 4.5,
    restSec: 60,
    tips: ['腰を反らせない', '胸を床すれすれまで下ろす', '肩甲骨を寄せてから押す'],
    avoid: '肘が外に開きすぎる',
    description: '腕立て伏せの派生で胸と体幹を使う種目',
  }
  const mockVideo = {
    name: '10分 全身自重',
    items: [
      { name: '腕立て伏せ', sets: 3, reps: 12, seconds: 0, type: 'reps', bodyPart: 'chest', useWeight: false, formFamily: 'pushup', met: 3.8 },
      { name: 'ベアクロール', sets: 3, reps: 0, seconds: 30, type: 'time', bodyPart: 'full', useWeight: false, formFamily: 'none', met: 5 },
    ],
    confidence: 'medium',
    note: 'モックの読み取り結果です',
  }
  const mockCoach = {
    summary: '直近14日で食事の記録は3日、タンパク質は1日平均で目標の6割にとどまっています。',
    advice: ['朝にゆで卵を2個足す', '夜の主食を半分にして豆腐を1丁足す'],
    mealIdeas: [
      {
        name: 'レンジ蒸し鶏とブロッコリー',
        howTo: 'コンビニのサラダチキンを割いて、冷凍ブロッコリーと一緒にレンジで2分。',
        unitLabel: '1人前',
        kcal: 230,
        protein: 34,
        fat: 6,
        carbs: 8,
        reason: 'タンパク質が足りていないので、1工程で30g足せます',
      },
      {
        name: '納豆キムチ丼',
        howTo: 'ごはんに納豆とキムチをのせるだけ。',
        unitLabel: '1杯',
        kcal: 420,
        protein: 18,
        fat: 8,
        carbs: 66,
        reason: '夜の記録が多いので、手早く作れる主食にしました',
      },
    ],
    hasWorkoutIdea: true,
    workoutIdea: {
      name: '時短 全身メニュー',
      items: [
        { name: 'スクワット', sets: 3, reps: 15, seconds: 0, type: 'reps', bodyPart: 'legs', useWeight: false, formFamily: 'squat', met: 5 },
        { name: 'ヒップリフト', sets: 3, reps: 15, seconds: 0, type: 'reps', bodyPart: 'legs', useWeight: false, formFamily: 'glute_bridge', met: 3 },
      ],
    },
    followUps: ['コンビニだけで揃う献立は？', '週3日に増やすなら何をする？'],
  }
  const mockOpenAi = (req) => {
    if (req.url().startsWith('https://noembed.com/')) {
      req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ title: '【10分】全身自重トレ' }) })
      return
    }
    if (req.url().startsWith('https://api.openai.com/')) {
      // system prompt に「パッケージ」が含まれていれば成分表の読み取り、それ以外は食事の推定
      const body = req.postData() ?? ''
      const isLabel = body.includes('nutrition_label')
      const isWeekly = body.includes('weekly_review')
      const content = body.includes('coach_answer')
        ? mockCoach
        : body.includes('exercise_classification')
          ? mockClassify
          : body.includes('video_workout')
            ? mockVideo
            : isWeekly
              ? mockWeekly
              : isLabel
                ? mockLabel
                : mockEstimate
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
      })
      return
    }
    req.continue()
  }
  page.on('request', mockOpenAi)
  await page.goto(`${BASE}#/meals`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await clickText('AIに話す')
  await sleep(400)
  await page.waitForSelector('.am__text', { timeout: 3000 })
  await page.type('.am__text', '鶏むね肉200g、ブロッコリー、玄米150g')
  await clickText('ChatGPT で推定する')
  await page.waitForSelector('.am__items', { timeout: 8000 })
  const itemCount = await page.$$eval('.am__item', (els) => els.length)
  assert(itemCount === 3, `AI 推定結果が3品目表示される (${itemCount})`)
  await page.click('.am__menu-toggle input')
  await sleep(200)
  await page.type('.am__menu-body input', 'いつもの夕食')
  await shot('ai-menu-register')
  await clickText('「いつもの夕食」を登録して記録する')
  await sleep(600)
  const menuLogged = await page.$$eval('.mel__row', (els) => els.some((e) => e.textContent?.includes('いつもの夕食')))
  assert(menuLogged, 'メニューとして登録した1食が今日の記録に入る')
  const menuChip = await page.$$eval('.qf__chip', (els) => els.some((e) => e.textContent?.includes('いつもの夕食')))
  assert(menuChip, '登録したメニューが「よく食べるもの」に出る')

  // 8d. 成分表を撮る → 読み取り結果を登録して記録
  // ボタンを押すと OS の写真選択が直接開く（ページ側の file input）。E2E では直接ファイルを投入する
  const labelInput = await page.$('input[aria-label="成分表・原材料の写真を選ぶ"]')
  await labelInput.uploadFile('public/icons/icon-192.png')
  await sleep(600)
  await clickText('ChatGPT で読み取る')
  await page.waitForSelector('.nl__pfc', { timeout: 8000 })
  const labelName = await page.$eval('.sheet input[placeholder="商品名"]', (e) => e.value)
  assert(labelName === 'サラダチキン プレーン', `成分表の商品名が入る (${labelName})`)
  await shot('label-result')
  await clickText('登録して 1 食分を記録する')
  await sleep(600)
  const labelLogged = await page.$$eval('.mel__row', (els) => els.some((e) => e.textContent?.includes('サラダチキン')))
  assert(labelLogged, '成分表から登録した食品が今日の記録に入る')

  // 8e2. フードのお気に入り: 登録済みピッカーで2件目のフードの星を押すと先頭に来る
  await clickText('登録済み')
  await sleep(300)
  const foodNamesBefore = await page.$$eval('.fp__name', (els) => els.map((e) => e.textContent?.trim() ?? ''))
  assert(foodNamesBefore.length >= 2, `お気に入りテスト用に2件以上のフードが登録済み (${foodNamesBefore.join('|')})`)
  assert(new Set(foodNamesBefore).size === foodNamesBefore.length, `フード名が重複していない (${foodNamesBefore.join('|')})`)
  const secondFoodName = foodNamesBefore[1]
  await clickLabel(`${secondFoodName} をお気に入りに追加`)
  await sleep(200)
  const favPressed = await page.$eval(`[aria-label="${secondFoodName} をお気に入りから外す"]`, (e) => e.getAttribute('aria-pressed'))
  assert(favPressed === 'true', `フードの星を押すと aria-pressed が true になる (${secondFoodName})`)
  await clickLabel('閉じる')
  await sleep(300)
  await clickText('登録済み')
  await sleep(300)
  const foodNamesAfter = await page.$$eval('.fp__name', (els) => els.map((e) => e.textContent?.trim() ?? ''))
  assert(foodNamesAfter[0] === secondFoodName, `お気に入りにしたフードが一覧の先頭に来る (${foodNamesAfter.join('|')})`)
  await clickLabel('閉じる')
  await sleep(300)

  // 8f. 種目の追加: 名前から AI で判定 → フォームが埋まる → 保存
  await page.goto(`${BASE}#/workout`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await clickText('今日もう1回始める')
  await sleep(400)
  await page.click('.ep__new')
  await sleep(400)
  await typeInto('.sheet input[placeholder*="リュック加重"]', 'ヒンズープッシュアップ')
  await clickText('名前から ChatGPT で判定')
  await page.waitForSelector('.xf__guide', { timeout: 8000 })
  const classifiedPart = await page.$eval('.sheet select', (s) => s.value)
  assert(classifiedPart === 'chest', `AI 判定で部位が入る (${classifiedPart})`)
  const classifiedMet = await page.$eval('.sheet input[placeholder="3.8"], .sheet input[placeholder="4"]', (i) => i.value).catch(() => null)
  assert(classifiedMet === '4.5', `AI 判定で MET が入る (${classifiedMet})`)
  await shot('exercise-ai-classify')
  await clickText('保存')
  await sleep(500)
  const inPicker = await page.$$eval('.ep__name', (els) => els.some((e) => e.textContent === 'ヒンズープッシュアップ'))
  assert(inPicker, 'AI 判定した種目がピッカーに出る')
  await clickLabel('ヒンズープッシュアップ のフォームを見る')
  await sleep(400)
  const guideTips = await page.$$eval('.eg__tips li', (els) => els.length)
  assert(guideTips === 3, `自作種目にもフォームのコツが出る (${guideTips})`)
  await clickLabel('閉じる')
  await sleep(300)
  await clickLabel('閉じる')
  await sleep(300)

  // 8g. YouTube からメニューを取り込む（noembed と OpenAI をモック）
  await clickText('YouTube から')
  await sleep(400)
  await typeInto('.sheet input[type="url"]', 'https://youtu.be/dQw4w9WgXcQ')
  await page.type('.ri__text', '0:30 腕立て伏せ 12回×3')
  await clickText('ChatGPT で読み取る')
  await page.waitForSelector('.ri__items', { timeout: 8000 })
  const importedItems = await page.$$eval('.ri__item', (els) => els.length)
  assert(importedItems === 2, `動画から2種目読み取る (${importedItems})`)
  const mappedFirst = await page.$eval('.ri__item select', (s) => s.value)
  assert(mappedFirst === 'ex_pushup', `既存種目に名寄せされる (${mappedFirst})`)
  const mappedSecond = await page.$$eval('.ri__item select', (els) => els[1]?.value)
  assert(mappedSecond === '__new__', `未知の種目は新規作成になる (${mappedSecond})`)
  await shot('routine-import')
  await clickText('メニューとして保存')
  await sleep(600)
  const importedRow = await page.$$eval('.rs__item', (els) => els.map((e) => e.textContent ?? ''))
  assert(importedRow.some((t) => t.includes('10分 全身自重') && t.includes('ベアクロール 3×30秒')), `取り込んだメニューが一覧に出る (${importedRow.join('|')})`)

  // 8h. AI コーチ: ホームから相談 → 料理の提案を今日に記録 → 追加質問 → メニュー保存
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(500)
  await clickText('相談する')
  await sleep(400)
  await page.waitForSelector('.co__log', { timeout: 4000 })
  await shot('coach-empty')
  await clickText('簡単でバランスの良い献立')
  await page.waitForSelector('.co__answer', { timeout: 8000 })
  const coachSummary = await textOf('.co__summary')
  assert(coachSummary.includes('タンパク質は1日平均で目標の6割'), `AI コーチの回答が表示される (${coachSummary})`)
  const coachAdvice = await page.$$eval('.co__advice li', (els) => els.length)
  assert(coachAdvice === 2, `アドバイスが2件出る (${coachAdvice})`)
  const coachIdeas = await page.$$eval('.co__idea', (els) => els.length)
  assert(coachIdeas === 2, `料理の提案が2件出る (${coachIdeas})`)
  await shot('coach-answer')
  await clickText('登録して今日に記録')
  await sleep(700)
  const coachIdeaDone = await page.$$eval('.co__idea', (els) => els[0]?.textContent?.includes('登録済み') ?? false)
  assert(coachIdeaDone, '記録した料理の提案が「登録済み」になる')
  // followUp チップで会話を続ける（回答カードが 2 枚になるまで待つ）
  await clickText('コンビニだけで揃う献立は？')
  await sleep(300)
  await page.waitForFunction(() => document.querySelectorAll('.co__answer').length === 2, { timeout: 8000 })
  const coachBubbles = await page.$$eval('.co__bubble--user', (els) => els.length)
  assert(coachBubbles === 2, `追加質問で会話が2往復になる (${coachBubbles})`)
  await shot('coach-followup')
  // 2 ターン目のトレメニューの提案を保存
  await clickText('メニューとして保存', { index: 1 })
  await sleep(700)
  const coachWorkoutDone = await page.$$eval('.co__workout', (els) => els[1]?.textContent?.includes('保存済み') ?? false)
  assert(coachWorkoutDone, '保存したトレメニューの提案が「保存済み」になる')
  // 過去の相談一覧 → 同じスレッドを開き直す
  await clickLabel('過去の相談')
  await sleep(400)
  const coachThreads = await page.$$eval('.co__thread', (els) => els.length)
  assert(coachThreads === 1, `過去の相談にスレッドが1件ある (${coachThreads})`)
  const coachThreadMeta = await textOf('.co__thread-meta')
  assert(coachThreadMeta.includes('ChatGPT') && coachThreadMeta.includes('今日'), `相談一覧にプロバイダと日付が出る (${coachThreadMeta})`)
  await shot('coach-threads')
  await clickText('簡単でバランスの良い献立')
  await sleep(500)
  const coachHistoryClosed = (await page.$('.co__thread')) === null
  assert(coachHistoryClosed, 'スレッドを選ぶと過去の相談が閉じる')
  await clickLabel('閉じる')
  await sleep(400)
  // 読み込み直しても登録済み/保存済みが残る（ターンに書き戻して保存している）
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(500)
  await clickText('前回:')
  await sleep(600)
  await page.waitForSelector('.co__answer', { timeout: 4000 })
  const coachStillDone = await page.$$eval('.co__idea', (els) => els[0]?.textContent?.includes('登録済み') ?? false)
  assert(coachStillDone, '読み込み直しても料理の提案が「登録済み」のまま')
  const coachStillSaved = await page.$$eval('.co__workout', (els) => els[1]?.textContent?.includes('保存済み') ?? false)
  assert(coachStillSaved, '読み込み直してもトレメニューの提案が「保存済み」のまま')
  // 開いているスレッドを消して取り消すと、会話が戻る
  await clickLabel('過去の相談')
  await sleep(400)
  await clickLabel('簡単でバランスの良い献立 を消す')
  await sleep(400)
  const coachAfterDelete = await page.$$eval('.co__thread', (els) => els.length)
  assert(coachAfterDelete === 0, `相談を消すと一覧から消える (${coachAfterDelete})`)
  await clickText('元に戻す')
  await sleep(600)
  const coachRestored = await page.$$eval('.co__thread', (els) => els.length)
  assert(coachRestored === 1, `取り消すと相談が一覧に戻る (${coachRestored})`)
  await clickText('簡単でバランスの良い献立')
  await sleep(500)
  const coachAnswersBack = await page.$$eval('.co__answer', (els) => els.length)
  assert(coachAnswersBack === 2, `取り消した相談の会話が戻る (${coachAnswersBack})`)
  await clickLabel('閉じる')
  await sleep(400)
  // 提案から登録した料理が今日の記録に入っている
  await page.goto(`${BASE}#/meals`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const coachMealLogged = await page.$$eval('.mel__row', (els) => els.some((e) => e.textContent?.includes('レンジ蒸し鶏')))
  assert(coachMealLogged, 'コーチの提案から登録した料理が今日の記録に入る')
  // 提案から保存したメニューがトレページに出る
  await page.goto(`${BASE}#/workout`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const coachRoutines = await page.$$eval('.rs__item', (els) => els.map((e) => e.textContent ?? ''))
  assert(coachRoutines.some((t) => t.includes('時短 全身メニュー') && t.includes('スクワット 3×15回')), `コーチの提案から保存したメニューが一覧に出る (${coachRoutines.join('|')})`)

  // 8e. 記録タブ: 週の振り返り → AI の一言 → 目標提案を反映
  await page.goto(`${BASE}#/log`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const weekStats = await textOf('.wr__stats')
  assert(/1日/.test(weekStats) && /セット/.test(weekStats) && /約[0-9]+kcal/.test(weekStats), `週の集計にトレ日数と消費カロリーが出る (${weekStats.slice(0, 60)})`)
  await shot('weekly-stats')
  await clickText('ChatGPT に来週の一言をもらう')
  await page.waitForSelector('.wr__advice', { timeout: 8000 })
  const advice = await textOf('.wr__advice')
  assert(advice.includes('2日に増やして'), `AI の一言が保存・表示される (${advice})`)
  await shot('weekly-ai')
  await clickText('目標に反映')
  await sleep(500)
  const targetsApplied = await page.evaluate(async () => {
    const req = indexedDB.open('workout-app')
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const get = req.result.transaction('settings').objectStore('settings').get('app')
        get.onsuccess = () => resolve(get.result?.targets?.kcal)
      }
    })
  })
  assert(targetsApplied === 2300, `提案した目標が設定に反映される (${targetsApplied})`)
  // 前の週へ移動しても壊れない
  await clickLabel('前の週')
  await sleep(300)
  const prevLabel = await textOf('.wr__range-label')
  assert(prevLabel === '先週', `前の週に移動できる (${prevLabel})`)
  assert((await page.$('.wr__empty')) !== null, '記録のない週は空表示')
  await clickLabel('次の週')
  await sleep(300)
  assert((await textOf('.wr__range-label')) === '今週', '今週に戻れる')

  page.off('request', mockOpenAi)
  await page.setRequestInterception(false)
  await page.goto(`${BASE}#/meals`, { waitUntil: 'networkidle0' })
  await sleep(400)

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

  // 9. ホーム（データあり）: 消費カロリーの行が出る。設定で目標に加算すると表示が変わる
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(500)
  await shot('home-with-data')
  const homeBurn = await textOf('.nutri__burn')
  assert(/トレで約/.test(homeBurn) && !homeBurn.includes('加算中'), `ホームに消費カロリーが出る (${homeBurn})`)
  const ringBefore = await page.$eval('.nutri svg[role="img"]', (e) => e.getAttribute('aria-label'))
  await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await clickText('トレの消費カロリーを目標に加算', { tag: 'label' })
  await sleep(500)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(500)
  const homeBurnOn = await textOf('.nutri__burn')
  const ringAfter = await page.$eval('.nutri svg[role="img"]', (e) => e.getAttribute('aria-label'))
  assert(homeBurnOn.includes('加算中') && ringBefore !== ringAfter, `加算ONで目標が増える (${ringBefore} → ${ringAfter})`)
  await shot('home-burn-added')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(300)
  await shot('home-with-data-bottom')

  // 9b. 種目のお気に入り: 種目ピッカーで「プランク」の星を押すと「すべて」フィルタで先頭に来る
  await page.goto(`${BASE}#/workout`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await clickText('今日もう1回始める')
  await sleep(400)
  await clickText('すべて', { tag: 'button' })
  await sleep(200)
  await clickLabel('プランク をお気に入りに追加')
  await sleep(200)
  const exFavPressed = await page.$eval('[aria-label="プランク をお気に入りから外す"]', (e) => e.getAttribute('aria-pressed'))
  assert(exFavPressed === 'true', '種目の星を押すと aria-pressed が true になる（プランク）')
  const exNamesAfterFav = await page.$$eval('.ep__name', (els) => els.map((e) => e.textContent ?? ''))
  assert(exNamesAfterFav[0] === 'プランク', `お気に入りにした種目が「すべて」の先頭に来る (${exNamesAfterFav.slice(0, 3).join('|')})`)
  await clickLabel('閉じる')
  await sleep(300)

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
