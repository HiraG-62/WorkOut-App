// Dexie が作る v1 相当の IndexedDB（データ入り）を用意してからアプリを開き、
// 現行スキーマまでのマイグレーションで「テーブル・インデックスが揃い、既存データが壊れず、upgrade の変換が効く」ことを確認する
// 使い方: node scripts/migration-check.mjs [baseUrl]
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://localhost:5199/'
const CHROME = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')

// Dexie は内部バージョンを 10 倍で保持する
const DEXIE_VERSION_SCALE = 10
// 期待値は src/db/db.ts から読む（手写しだとスキーマを足したときに検証が漏れる）
const DB_SOURCE = readFileSync(new URL('../src/db/db.ts', import.meta.url), 'utf-8')
/** 現在のスキーマバージョン（this.version(n) の最大値） */
const SCHEMA_VERSION = Math.max(...[...DB_SOURCE.matchAll(/this\.version\((\d+)\)/g)].map((m) => Number(m[1])))
/** 現行スキーマの全テーブル（各 .stores({...}) のキーを集める） */
const EXPECTED_STORES = [...new Set([...DB_SOURCE.matchAll(/\.stores\(\{([^}]*)\}\)/g)].flatMap((m) => [...m[1].matchAll(/(\w+):\s*'/g)].map((x) => x[1])))]
if (!Number.isFinite(SCHEMA_VERSION) || EXPECTED_STORES.length === 0) {
  throw new Error('src/db/db.ts からスキーマを読み取れませんでした（正規表現を見直してください）')
}
/** アプリ起動後、DB が現行バージョンまで上がるのを待つ上限と間隔 */
const UPGRADE_TIMEOUT_MS = 10000
const UPGRADE_POLL_MS = 200

/**
 * v1 のテーブルとインデックス（src/db/db.ts の version(1).stores と同じ）。
 * Dexie のインデックス名は & を除いたスキーマ文字列で、複合は "[a+b]" のまま
 */
const V1_STORES = {
  exercises: ['name', 'bodyPart', 'archived'],
  workouts: ['date', 'startedAt'],
  sets: ['workoutId', 'exerciseId', '[workoutId+exerciseId]', 'completedAt'],
  foods: ['name', 'lastUsedAt', 'useCount', 'archived'],
  meals: ['date', 'createdAt', 'foodId'],
  mealSets: ['name'],
  weights: ['&date'],
  settings: [],
}
// インデックス名の規則。下の page.evaluate 内（ブラウザ側）にも同じ規則を書いているので、直すときは両方
const indexNameOf = (spec) => (spec.startsWith('&') ? spec.slice(1) : spec)
const isUniqueSpec = (spec) => spec.startsWith('&')

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
const notFound = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (msg) => {
  // 404 などのリソース読み込み失敗は下の response で URL ごとに拾う（dev サーバーには SW が無い）
  if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(`[console] ${msg.text()}`)
})
page.on('response', (res) => {
  if (res.status() >= 400) notFound.push(`${res.status()} ${res.url()}`)
})

// 同一オリジンの空ページで v1 DB を作る（アプリの JS は読み込まない）
await page.goto(`${BASE}favicon.svg`, { waitUntil: 'load' })
await page.evaluate(
  (dexieVersion, stores) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('workout-app', dexieVersion)
      req.onupgradeneeded = () => {
        const dbx = req.result
        for (const [name, indexes] of Object.entries(stores)) {
          const store = dbx.createObjectStore(name, { keyPath: 'id' })
          for (const spec of indexes) {
            // indexNameOf / isUniqueSpec と同じ規則（ブラウザ側には関数を渡せないので書き写している）
            const unique = spec.startsWith('&')
            const source = unique ? spec.slice(1) : spec
            const keyPath = source.startsWith('[') ? source.slice(1, -1).split('+') : source
            store.createIndex(source, keyPath, { unique })
          }
        }
      }
      req.onsuccess = () => {
        const dbx = req.result
        const tx = dbx.transaction(['exercises', 'workouts', 'sets', 'foods', 'meals', 'weights', 'settings'], 'readwrite')
        const ex = tx.objectStore('exercises')
        ex.put({ id: 'ex_squat', name: 'スクワット', type: 'reps', bodyPart: 'legs', useWeight: false, isCustom: false, archived: false, createdAt: 0 })
        ex.put({ id: 'custom1', name: '自作種目', type: 'reps', bodyPart: 'full', useWeight: false, isCustom: true, archived: false, createdAt: 1 })
        // v5 で初期種目のクランチは体幹→腹筋に移る
        ex.put({ id: 'ex_crunch', name: 'クランチ', type: 'reps', bodyPart: 'core', useWeight: false, isCustom: false, archived: false, createdAt: 0 })
        // 既存データが upgrade を通っても残ることの確認用（v1 当時の型に合わせる。以下のフィールドは初期実装から存在する）
        tx.objectStore('workouts').put({ id: 'w1', date: '2025-01-01', startedAt: 1735700000000, endedAt: 1735701800000, exerciseIds: ['ex_squat'] })
        tx.objectStore('sets').put({ id: 's1', workoutId: 'w1', exerciseId: 'ex_squat', order: 0, reps: 10, completedAt: 1735700100000 })
        tx.objectStore('foods').put({ id: 'f1', name: 'ゆで卵', unitLabel: '1個', kcal: 76, protein: 6, fat: 5, carbs: 0, useCount: 1, lastUsedAt: 1735700000000, slotCounts: [1, 0, 0, 0], source: 'manual', archived: false, createdAt: 0 })
        tx.objectStore('meals').put({ id: 'm1', date: '2025-01-01', foodId: 'f1', name: 'ゆで卵', quantity: 1, kcal: 76, protein: 6, fat: 5, carbs: 0, createdAt: 1735700000000 })
        tx.objectStore('weights').put({ id: 'wt1', date: '2025-01-01', kg: 65.0, createdAt: 1735700000000 })
        // v3 で addBurnToTarget が既定値 false で補われる（v1 の設定行には無い）
        tx.objectStore('settings').put({
          id: 'app',
          profile: { sex: 'male', age: 30, heightCm: 170, activity: 'light', goal: 'maintain' },
          targets: { kcal: 2000, protein: 120, fat: 55, carbs: 250 },
          defaultRestSec: 90,
          sound: true,
          vibration: true,
          ai: { provider: 'claude', keys: { claude: '', openai: '', gemini: '' }, models: { claude: '', openai: '', gemini: '' } },
          onboarded: true,
        })
        tx.oncomplete = () => {
          dbx.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
      }
      req.onerror = () => reject(req.error)
    }),
  1 * DEXIE_VERSION_SCALE,
  V1_STORES,
)

// アプリを開くと Dexie が現行スキーマまで上げる。ホームが描画されるところまで待つ（クエリ時の SchemaError も拾うため）
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.waitForSelector('.hp__title', { timeout: 5000 })

/** DB の全テーブルをそのまま読む（バージョン・テーブル名・インデックス・全行） */
async function readDb() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('workout-app')
        req.onsuccess = () => {
          const dbx = req.result
          // アプリ側の upgrade と重なったときにこちらが邪魔しないよう、要求されたらすぐ閉じる
          dbx.onversionchange = () => dbx.close()
          const storeNames = [...dbx.objectStoreNames]
          const out = { version: dbx.version, storeNames, counts: {}, indexes: {}, rows: {} }
          if (storeNames.length === 0) {
            dbx.close()
            resolve(out)
            return
          }
          const tx = dbx.transaction(storeNames, 'readonly')
          let pending = storeNames.length
          for (const name of storeNames) {
            const store = tx.objectStore(name)
            out.indexes[name] = [...store.indexNames].map((i) => ({ name: i, unique: store.index(i).unique }))
            const getAll = store.getAll()
            getAll.onsuccess = () => {
              out.counts[name] = getAll.result.length
              out.rows[name] = getAll.result
              pending -= 1
              if (pending === 0) {
                dbx.close()
                resolve(out)
              }
            }
            getAll.onerror = () => reject(getAll.error)
          }
        }
        req.onerror = () => reject(req.error)
      }),
  )
}

// 固定待ちではなく、DB が現行バージョンまで上がるまで読み直す（上がらなければ最後の状態でチェックに進み、そこで落ちる）
let result = await readDb()
const upgradeDeadline = Date.now() + UPGRADE_TIMEOUT_MS
while (result.version !== SCHEMA_VERSION * DEXIE_VERSION_SCALE && Date.now() < upgradeDeadline) {
  await new Promise((r) => setTimeout(r, UPGRADE_POLL_MS))
  result = await readDb()
}

const checks = []
function check(cond, label) {
  checks.push({ ok: !!cond, label })
  console.log(cond ? 'ok  ' : 'NG  ', label)
}

const byId = (table, id) => result.rows[table]?.find((r) => r.id === id)
const hasIndex = (table, name, unique) => result.indexes[table]?.some((i) => i.name === name && (unique === undefined || i.unique === unique))

check(result.version === SCHEMA_VERSION * DEXIE_VERSION_SCALE, `DB バージョンが v${SCHEMA_VERSION} になる (${result.version / DEXIE_VERSION_SCALE})`)
check(
  EXPECTED_STORES.every((s) => result.storeNames.includes(s)),
  `全テーブルが揃う (欠け: ${EXPECTED_STORES.filter((s) => !result.storeNames.includes(s)).join(',') || 'なし'})`,
)
// v2: 初期種目に order、自作種目には付けない（行そのものが消えていないことも見る）
const customRow = byId('exercises', 'custom1')
check(typeof byId('exercises', 'ex_squat')?.order === 'number', 'v2: 初期種目に order が付く')
check(customRow !== undefined && customRow.order === undefined, 'v2: 自作種目には order を付けない')
// v3: 設定の新フィールドを既定値で補う。既存の値は変えない
check(byId('settings', 'app')?.addBurnToTarget === false, 'v3: settings.addBurnToTarget が false で補われる')
check(byId('settings', 'app')?.defaultRestSec === 90, 'v3: 既存の設定値（休憩 90 秒）はそのまま')
check(result.storeNames.includes('weeklyReviews'), 'v3: weeklyReviews テーブルができる')
// v4 / v6 / v7: 新テーブルとインデックス
check(result.storeNames.includes('routines'), 'v4: routines テーブルができる')
check(byId('exercises', 'ex_crunch')?.bodyPart === 'abs', 'v5: 初期種目のクランチが体幹→腹筋に移る')
check(customRow?.bodyPart === 'full', 'v5: 自作種目の部位は変えない')
check(hasIndex('coachThreads', 'updatedAt', false), 'v6: coachThreads に updatedAt インデックスがある')
check(hasIndex('dailyMetrics', 'date', true), 'v7: dailyMetrics に date のユニークインデックスがある')
// 既存データが残る
check(
  result.counts.workouts === 1 && result.counts.sets === 1 && result.counts.foods === 1 && result.counts.meals === 1 && result.counts.weights === 1,
  `既存データが残る (workouts:${result.counts.workouts} sets:${result.counts.sets} foods:${result.counts.foods} meals:${result.counts.meals} weights:${result.counts.weights})`,
)
check(result.counts.exercises === 3, `既存の種目が populate で上書きされない (${result.counts.exercises})`)
// v1 のインデックスが全部残る（Dexie が作った DB と同じ形で始めたので、そのまま維持されるはず）
for (const [table, specs] of Object.entries(V1_STORES)) {
  for (const spec of specs) check(hasIndex(table, indexNameOf(spec), isUniqueSpec(spec)), `v1: ${table}.${spec} のインデックスが残る`)
}
check(errors.length === 0, `ページエラーなし ${errors.length ? JSON.stringify(errors) : ''}`)
if (notFound.length) console.log('読み込みに失敗したリソース（参考）:', notFound.join(', '))

const ok = checks.every((c) => c.ok)
console.log(ok ? 'MIGRATION OK' : `MIGRATION FAILED (${checks.filter((c) => !c.ok).length} 件)`)
process.exitCode = ok ? 0 : 1
await browser.close()
