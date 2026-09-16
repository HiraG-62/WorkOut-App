import { ArrowUpRight, ExternalLink, TriangleAlert } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { ExerciseFigure } from './ExerciseFigure'
import { EXERCISE_GUIDES, resolveFamily, youtubeSearchUrl } from './formGuide'
import { BODY_PARTS, EXERCISE_TYPES, type Exercise } from '../../types'
import './ExerciseGuideSheet.css'

interface ExerciseGuideSheetProps {
  exercise: Exercise | null
  onClose: () => void
  /** 進化先の種目名（あれば表示） */
  progressionName?: string
}

/** 種目の図と正しいフォームのポイントを見るシート。初期種目はガイド付き、自作種目は図のみ */
export function ExerciseGuideSheet({ exercise, onClose, progressionName }: ExerciseGuideSheetProps) {
  const family = resolveFamily(exercise)
  const guide = exercise ? EXERCISE_GUIDES[exercise.id] : undefined
  return (
    <Sheet open={exercise !== null} onClose={onClose} title={exercise?.name ?? ''}>
      {exercise && (
        <div className="eg">
          <p className="eg__meta">
            {BODY_PARTS[exercise.bodyPart]} · {EXERCISE_TYPES[exercise.type]}
            {exercise.useWeight ? ' · 加重あり' : ''}
          </p>
          {family ? (
            <div className="eg__figure">
              <ExerciseFigure family={family} width={240} />
            </div>
          ) : (
            <p className="eg__nofig">この種目には図がありません。編集画面で「動きのタイプ」を選ぶと表示されます。</p>
          )}
          {guide && (
            <>
              <h3 className="section-title">フォームのポイント</h3>
              <ol className="eg__tips">
                {guide.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              {guide.avoid && (
                <p className="eg__avoid">
                  <TriangleAlert size={16} aria-hidden />
                  <span>
                    <span className="eg__avoid-label">NG</span> {guide.avoid}
                  </span>
                </p>
              )}
            </>
          )}
          {progressionName && (
            <p className="eg__next">
              <ArrowUpRight size={16} aria-hidden />
              楽になってきたら次は「{progressionName}」
            </p>
          )}
          <a className="eg__video" href={youtubeSearchUrl(exercise.name)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden />
            YouTube でフォーム動画を探す
          </a>
        </div>
      )}
    </Sheet>
  )
}

