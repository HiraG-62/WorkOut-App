import type { Exercise, RoutineItem } from '../../types'

const YOUTUBE_ID_PATTERNS = [
  /[?&]v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/,
]
const OEMBED_ENDPOINT = 'https://noembed.com/embed?url='
const OEMBED_TIMEOUT_MS = 8000
/** 部分一致とみなす最短の（正規化後）文字数 */
const MIN_PARTIAL_MATCH_LENGTH = 3

/** YouTube の URL から動画 ID を取り出す。対応外なら null */
export function extractYoutubeId(input: string): string | null {
  const text = input.trim()
  for (const re of YOUTUBE_ID_PATTERNS) {
    const m = text.match(re)
    if (m) return m[1]
  }
  return null
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

/**
 * 動画タイトルを oEmbed（CORS 対応の noembed 経由）で取得する。
 * YouTube のページ本体はブラウザから読めないため、タイトルだけでも AI の手がかりにする。失敗時は空文字
 */
export async function fetchVideoTitle(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS)
  signal?.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const res = await fetch(`${OEMBED_ENDPOINT}${encodeURIComponent(url)}`, { signal: controller.signal })
    if (!res.ok) return ''
    const data = (await res.json()) as { title?: unknown }
    return typeof data.title === 'string' ? data.title : ''
  } catch {
    return ''
  } finally {
    window.clearTimeout(timeout)
  }
}

/** 例: 腕立て伏せ 3×10回 · プランク 3×30秒 */
export function summarizeRoutine(items: RoutineItem[], exercises: Map<string, Exercise>): string {
  return items
    .map((i) => {
      const ex = exercises.get(i.exerciseId)
      if (!ex) return null
      const target = ex.type === 'time' ? `${i.seconds ?? 0}秒` : `${i.reps ?? 0}回`
      return `${ex.name} ${i.sets}×${target}`
    })
    .filter((s): s is string => s !== null)
    .join(' · ')
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　・･ｰー\-_()（）]/g, '')
    // ひらがな → カタカナ
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/** 名前が一致（正規化後に同一 or 片方がもう片方を含む）する既存種目を探す */
export function findExerciseByName(name: string, exercises: Exercise[]): Exercise | undefined {
  const target = normalizeName(name)
  if (!target) return undefined
  const alive = exercises.filter((e) => !e.archived)
  const exact = alive.find((e) => normalizeName(e.name) === target)
  if (exact) return exact
  const candidates = alive.map((e) => ({ e, n: normalizeName(e.name) })).filter(({ n }) => n.length >= MIN_PARTIAL_MATCH_LENGTH)
  // 読み取り名が種目名を含む（「デクライン腕立て伏せ」⊃「デクライン腕立て」）→ より長く一致する種目を優先
  const contained = candidates.filter(({ n }) => target.includes(n)).sort((a, b) => b.n.length - a.n.length)
  if (contained[0]) return contained[0].e
  // 種目名が読み取り名を含む（「腕立て」⊂「腕立て伏せ」「ダイヤモンド腕立て」）→ 余計な修飾が少ない短い種目を優先
  const containing = candidates.filter(({ n }) => n.includes(target)).sort((a, b) => a.n.length - b.n.length)
  return containing[0]?.e
}
