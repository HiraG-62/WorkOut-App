import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, UtensilsCrossed, LineChart } from 'lucide-react'
import './BottomNav.css'

const ITEMS = [
  { to: '/', label: 'ホーム', Icon: Home, end: true },
  { to: '/workout', label: 'トレ', Icon: Dumbbell, end: false },
  { to: '/meals', label: '食事', Icon: UtensilsCrossed, end: false },
  { to: '/log', label: '記録', Icon: LineChart, end: false },
] as const

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
        >
          <Icon size={22} strokeWidth={2.2} aria-hidden />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
