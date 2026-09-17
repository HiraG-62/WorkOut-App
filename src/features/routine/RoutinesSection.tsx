import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Play, SquarePlay } from 'lucide-react'
import { db } from '../../db/db'
import { setRoutineFavorite, startRoutine } from '../../db/repo'
import { isAiConfigured } from '../../lib/ai'
import { favRank } from '../../lib/favorite'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Section } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { FavoriteButton } from '../../components/ui/FavoriteButton'
import { useToast } from '../../components/ui/Toast'
import type { Exercise, Routine } from '../../types'
import { RoutineEditorSheet } from './RoutineEditorSheet'
import { RoutineImportSheet } from './RoutineImportSheet'
import { summarizeRoutine } from './routineUtils'
import './RoutinesSection.css'

interface RoutinesSectionProps {
  exercises: Exercise[]
  /** 進行中のワークアウトがあるときは開始できない */
  canStart: boolean
}

type SheetKind = 'new' | 'edit' | 'import' | null

/** 筋トレ画面のセットメニュー一覧（開始 / 作成 / 編集 / YouTube 取り込み） */
export function RoutinesSection({ exercises, canStart }: RoutinesSectionProps) {
  const navigate = useNavigate()
  const settings = useSettings()
  const toast = useToast()
  const guard = useBusy()
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [editing, setEditing] = useState<Routine | null>(null)
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const aiReady = isAiConfigured(settings.ai)

  // お気に入り → よく使う順 → 新しい順
  const sorted = useMemo(
    () => [...(routines ?? [])].sort((a, b) => favRank(a) - favRank(b) || b.lastUsedAt - a.lastUsedAt || b.createdAt - a.createdAt),
    [routines],
  )

  const start = (r: Routine) =>
    guard(async () => {
      if (!canStart) {
        toast.show('進行中のワークアウトを終了してから始めてください', 'info')
        return
      }
      const w = await startRoutine(r)
      if (!w) {
        toast.show('このメニューの種目はすべて削除されています', 'error')
        return
      }
      navigate(`/workout/${w.id}`)
    })

  if (routines === undefined) return null

  return (
    <Section title="メニュー">
      {sorted.length > 0 && (
        <ul className="rs__list">
          {sorted.map((r) => (
            <li key={r.id} className="rs__item">
              <button
                type="button"
                className="rs__body"
                onClick={() => {
                  setEditing(r)
                  setSheet('edit')
                }}
              >
                <span className="rs__name">
                  {r.name}
                  {r.source === 'youtube' && <SquarePlay size={14} className="rs__yt" role="img" aria-label="YouTube から取り込み" />}
                </span>
                <span className="rs__summary">
                  {r.items.length}種目 · {r.items.reduce((a, i) => a + i.sets, 0)}セット · {summarizeRoutine(r.items, exerciseMap) || '種目なし'}
                </span>
                <span className="sr-only">を編集</span>
              </button>
              <FavoriteButton name={r.name} favorite={r.favorite} onToggle={() => void setRoutineFavorite(r.id, !r.favorite)} className="rs__fav" size={18} />
              <button type="button" className={`rs__play ${canStart ? '' : 'rs__play--off'}`} onClick={() => void start(r)} aria-label={`${r.name} を開始`} aria-disabled={!canStart}>
                <Play size={18} fill="currentColor" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rs__actions">
        <Button block icon={<ListChecks size={18} aria-hidden />} onClick={() => setSheet('new')}>
          メニューを作る
        </Button>
        <Button block variant={aiReady ? 'accent-soft' : 'secondary'} icon={<SquarePlay size={18} aria-hidden />} onClick={() => setSheet('import')} disabled={!aiReady}>
          YouTube から
        </Button>
      </div>
      {!canStart && sorted.length > 0 && <p className="faint rs__note">進行中のワークアウトを終了すると、メニューから開始できます</p>}
      {!aiReady && <p className="faint rs__note">設定で AI の API キーを登録すると YouTube の動画からメニューを取り込めます</p>}
      {sorted.length === 0 && <p className="faint rs__note">よくやる組み合わせをメニューにすると、1タップで始められます。ワークアウトの記録画面からも保存できます</p>}

      <RoutineEditorSheet open={sheet === 'new' || sheet === 'edit'} onClose={() => setSheet(null)} exercises={exercises} routine={sheet === 'edit' ? editing : null} />
      <RoutineImportSheet open={sheet === 'import'} onClose={() => setSheet(null)} exercises={exercises} />
    </Section>
  )
}
