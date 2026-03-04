/**
 * Error boundary: catches React render errors and POSTs to /api/v2/error-logs.
 * Renders a fallback UI with retry.
 */
import React from 'react'
import { reportError } from '@/lib/errorLogger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string
}

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState((s) => ({ ...s, componentStack: info.componentStack ?? '' }))
    const component = (info.componentStack ?? '')
      .split('\n')[1]
      ?.trim()
      .replace(/^at\s+/, '') ?? 'Unknown'
    reportError(error, {
      source: 'error_boundary',
      component,
      componentStack: info.componentStack ?? undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: '' })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex min-h-[200px] items-center justify-center p-6">
          <Card className="max-w-md border-destructive/50">
            <CardHeader className="flex flex-row items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">Something went wrong</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This error has been reported. You can try again or refresh the page.
              </p>
              <pre className="max-h-24 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
                {this.state.error.message}
              </pre>
              <Button onClick={this.handleRetry} variant="default">
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
