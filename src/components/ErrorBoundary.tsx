import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n/i18n'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NoteTopia crashed', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>{t('ui.crashTitle')}</h1>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn-tool" onClick={() => this.setState({ error: null })}>
            {t('ui.tryAgain')}
          </button>
          <button
            type="button"
            className="btn-tool"
            onClick={() => {
              localStorage.removeItem('music-world-last-project')
              window.location.reload()
            }}
          >
            {t('ui.resetDemo')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
