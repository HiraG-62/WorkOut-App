import { ExerciseFigure } from '../features/workout/ExerciseFigure'
import { FORM_FAMILIES, type FormFamily } from '../features/workout/formGuide'
import { PageHeader } from '../components/ui/PageHeader'

/** 開発用: 全種類のフォーム図を一覧で確認する（#/dev/figures） */
export function FiguresDevPage() {
  return (
    <div className="page">
      <PageHeader title="フォーム図一覧" back />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {(Object.keys(FORM_FAMILIES) as FormFamily[]).map((f) => (
          <div key={f} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <ExerciseFigure family={f} width={150} animate={false} />
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {FORM_FAMILIES[f]} <span className="faint">({f})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
