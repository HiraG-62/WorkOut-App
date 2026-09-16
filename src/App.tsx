import { useEffect } from 'react'
import { HashRouter, Route, Routes, Outlet } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { RestTimerBar } from './components/RestTimerBar'
import { ToastProvider } from './components/ui/Toast'
import { RestTimerProvider } from './hooks/useRestTimer'
import { HomePage } from './pages/HomePage'
import { LogPage } from './pages/LogPage'
import { MealsPage } from './pages/MealsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { WorkoutSessionPage } from './pages/WorkoutSessionPage'
import { FiguresDevPage } from './pages/FiguresDevPage'
import { ScrollToTop } from './components/ScrollToTop'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
import { useRestTimer } from './hooks/useRestTimer'

function Shell() {
  const timer = useRestTimer()
  // body 直下に描画するトーストがタイマーの上に乗るよう、状態を body に伝える
  useEffect(() => {
    document.body.classList.toggle('has-timer', timer.running)
    return () => document.body.classList.remove('has-timer')
  }, [timer.running])
  return (
    <div className={`shell ${timer.running ? 'shell--timer' : ''}`}>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <RestTimerBar />
      <BottomNav />
      <UpdateBanner />
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <RestTimerProvider>
          <ScrollToTop />
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/workout" element={<WorkoutPage />} />
              <Route path="/workout/:id" element={<WorkoutSessionPage />} />
              <Route path="/meals" element={<MealsPage />} />
              <Route path="/log" element={<LogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dev/figures" element={<FiguresDevPage />} />
              <Route path="*" element={<HomePage />} />
            </Route>
          </Routes>
        </RestTimerProvider>
      </ToastProvider>
    </HashRouter>
  )
}
