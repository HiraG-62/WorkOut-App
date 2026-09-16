/**
 * ソフトウェアキーボード対策。
 * - visualViewport の位置と高さを CSS 変数（--vv-top / --vv-h）と body.kb-open に反映し、
 *   fixed 配置のシートやナビが可視領域に追従できるようにする
 * - 入力欄にフォーカスしたら、キーボードが出た後にその入力欄を可視領域の中央へスクロールする
 *   （iOS のスタンドアロン PWA では fixed なシート内の入力欄が自動では見える位置に来ないため）
 */

const KEYBOARD_THRESHOLD_PX = 120
/** キーボードのアニメーションが落ち着くまでの待ち時間 */
const SCROLL_DELAY_MS = 350
const TEXT_INPUT_SELECTOR = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]), textarea, select, [contenteditable="true"]'

function isTextInput(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(TEXT_INPUT_SELECTOR)
}

function revealActiveInput(): void {
  const el = document.activeElement
  if (!isTextInput(el)) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function setupKeyboardHandling(): void {
  const vv = window.visualViewport
  const root = document.documentElement
  let wasOpen = false
  let scrollTimer = 0

  const scheduleReveal = () => {
    window.clearTimeout(scrollTimer)
    scrollTimer = window.setTimeout(revealActiveInput, SCROLL_DELAY_MS)
  }

  const apply = () => {
    if (!vv) return
    const open = vv.height < window.innerHeight - KEYBOARD_THRESHOLD_PX
    root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`)
    root.style.setProperty('--vv-h', `${Math.round(vv.height)}px`)
    document.body.classList.toggle('kb-open', open)
    if (open && !wasOpen) scheduleReveal()
    wasOpen = open
  }

  vv?.addEventListener('resize', apply)
  vv?.addEventListener('scroll', apply)
  apply()

  document.addEventListener('focusin', (e) => {
    if (!isTextInput(e.target as Element | null)) return
    scheduleReveal()
  })
}
