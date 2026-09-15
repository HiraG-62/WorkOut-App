import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  action?: ReactNode
  back?: boolean
}

export function PageHeader({ title, eyebrow, action, back = false }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      {back && (
        <button type="button" className="page-header__back" onClick={() => navigate(-1)} aria-label="戻る">
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
