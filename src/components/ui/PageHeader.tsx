import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  action?: ReactNode
  back?: boolean
  /** 履歴が無いときの戻り先 */
  backTo?: string
}

export function PageHeader({ title, eyebrow, action, back = false, backTo = '/' }: PageHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // 直リンクやリロードで履歴が無いときは backTo に戻る
  const goBack = () => (location.key === 'default' ? navigate(backTo, { replace: true }) : navigate(-1))
  return (
    <header className="page-header">
      {back && (
        <button type="button" className="page-header__back" onClick={goBack} aria-label="戻る">
          <ChevronLeft size={24} aria-hidden />
        </button>
      )}
      <div className="page-header__text">
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}</h1>
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  )
}
