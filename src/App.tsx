import { lazy, Suspense, useEffect } from 'react'
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
import { ScrollToTop } from './components/ScrollToTop'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
import { useRestTimer } from './hooks/useRestTimer'

/** 開発用ページ（フォーム図の一覧、#/dev/figures）。dev サーバーでだけ読み込み、本番ビルドには含めない */
const FiguresDevPage = import.meta.env.DEV ? lazy(() => import('./pages/FiguresDevPage').then((m) => ({ default: m.FiguresDevPage }))) : null

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
              {FiguresDevPage && (
                <Route
                  path="/dev/figures"
                  element={
                    <Suspense fallback={null}>
                      <FiguresDevPage />
                    </Suspense>
                  }
                />
              )}
              <Route path="*" element={<HomePage />} />
            </Route>
          </Routes>
        </RestTimerProvider>
      </ToastProvider>
    </HashRouter>
  )
}
