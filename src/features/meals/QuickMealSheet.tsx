import { useEffect, useState } from 'react'
import { deleteMeal, logQuickMeal } from '../../db/repo'
import { tapHaptic } from '../../lib/feedback'
import { Sheet } from '../../components/ui/Sheet'
import { Stepper } from '../../components/ui/Stepper'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import './QuickMealSheet.css'

const KCAL_STEP = 50
const KCAL_MAX = 5000
const KCAL_PRESETS = [300, 500, 700, 1000] as const
const G_STEP = 5
const G_MAX = 500
const DEFAULT_KCAL = 500
const DEFAULT_PROTEIN = 20
const DEFAULT_NAME = 'ざっくり記録'
const UNDO_MS = 5000

interface QuickMealSheetProps {
  open: boolean
  onClose: () => void
  date: string
}

/** 食品名なしで「だいたい○kcal・P○g」だけ記録する */
export function QuickMealSheet({ open, onClose, date }: QuickMealSheetProps) {
  const toast = useToast()
  const [kcal, setKcal] = useState(DEFAULT_KCAL)
  const [protein, setProtein] = useState(DEFAULT_PROTEIN)
  const [fat, setFat] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [detail, setDetail] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    setKcal(DEFAULT_KCAL)
    setProtein(DEFAULT_PROTEIN)
    setFat(0)
    setCarbs(0)
    setDetail(false)
    setName('')
  }, [open])

  const save = async () => {
    const entry = await logQuickMeal({ name: name.trim() || DEFAULT_NAME, kcal, protein, fat, carbs }, date)
    toast.show('記録しました', 'success', { label: '取り消す', onClick: () => void deleteMeal(entry.id) }, UNDO_MS)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ざっくり記録"
      footer={
        <Button variant="primary" size="lg" block onClick={() => void save()}>
          記録する
        </Button>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <p className="muted qm__lead">細かいことは気にせず、目安だけ残しておきましょう。</p>
        <div className="qm__presets" role="group" aria-label="カロリーの目安">
          {KCAL_PRESETS.map((k) => (
            <button
              key={k}
              type="button"
              className={`qm__preset ${kcal === k ? 'qm__preset--on' : ''}`}
              onClick={() => {
                tapHaptic()
                setKcal(k)
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="qm__grid">
          <Stepper value={kcal} onChange={setKcal} step={KCAL_STEP} max={KCAL_MAX} unit="kcal" label="カロリー" size="lg" />
          <Stepper value={protein} onChange={setProtein} step={G_STEP} max={G_MAX} unit="g" label="タンパク質" />
        </div>
        {detail ? (
          <div className="qm__grid qm__grid--pair">
            <Stepper value={fat} onChange={setFat} step={G_STEP} max={G_MAX} unit="g" label="脂質" />
            <Stepper value={carbs} onChange={setCarbs} step={G_STEP} max={G_MAX} unit="g" label="炭水化物" />
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setDetail(true)}>
            脂質・炭水化物も入力する
          </Button>
        )}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="メモ（任意）例: コンビニ弁当" aria-label="メモ" enterKeyHint="done" />
      </form>
    </Sheet>
  )
}
