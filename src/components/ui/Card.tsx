import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** 強調（アクセント枠） */
  accent?: boolean
  padded?: boolean
}

export function Card({ children, accent = false, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div
      className={['card', accent ? 'card--accent' : '', padded ? 'card--padded' : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

interface SectionProps {
  title: string
  action?: ReactNode
  children: ReactNode
}

export function Section({ title, action, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
