import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/Button'
import { EmptyState } from './ui/EmptyState'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** 画面の描画エラーで全体が真っ黒になるのを防ぎ、再読み込みの導線を出す */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page">
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="表示中にエラーが起きました"
          description={this.state.error.message}
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          }
        />
      </div>
    )
  }
}
