import { Star } from 'lucide-react'
import { favoriteLabel } from '../../lib/favorite'
import { tapHaptic } from '../../lib/feedback'

interface FavoriteButtonProps {
  /** aria-label に使う対象の名前（フード名・種目名など） */
  name: string
  favorite?: boolean
  onToggle: () => void
  /** 呼び出し側でタップ領域のサイズ・配置を指定するためのクラス（例: fp__fav） */
  className?: string
  size?: number
}

/** お気に入りの星ボタン（フード・種目・食事セット・メニューの一覧行で共通利用） */
export function FavoriteButton({ name, favorite, onToggle, className = '', size = 16 }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      className={`fav-btn ${favorite ? 'fav-btn--on' : ''} ${className}`}
      aria-label={favoriteLabel(name, favorite)}
      aria-pressed={!!favorite}
      onClick={() => {
        tapHaptic()
        onToggle()
      }}
    >
      <Star size={size} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}
