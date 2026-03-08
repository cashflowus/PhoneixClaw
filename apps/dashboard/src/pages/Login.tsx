/**
 * Login page — enterprise animated background, value props, Phoenix Claw branding.
 * Highlights: Profits P&L, Algorithmic Trade, Agentic Trading, Intelligent Bots, Data everywhere.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DollarSign, LineChart, Bot, Cpu, Database } from 'lucide-react'

const VALUE_PROPS = [
  { label: 'Profits & P&L', icon: DollarSign, desc: 'Track and grow your edge' },
  { label: 'Algorithmic Trade', icon: LineChart, desc: 'Systematic execution' },
  { label: 'Agentic Trading', icon: Bot, desc: 'Multi-agent pipelines' },
  { label: 'Intelligent Bots', icon: Cpu, desc: 'Research → Technical → Risk' },
  { label: 'Data everywhere', icon: Database, desc: 'Signals, flow, and metrics' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, error: contextError } = useAuth()
  const navigate = useNavigate()
  const error = localError || contextError

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Try again.'
      setLocalError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg dark min-h-screen flex flex-col lg:flex-row items-stretch">
      {/* Animated orbs */}
      <div className="auth-orb auth-orb-1" aria-hidden />
      <div className="auth-orb auth-orb-2" aria-hidden />
      <div className="auth-orb auth-orb-3" aria-hidden />

      {/* Mobile: value props strip above card */}
      <div className="lg:hidden flex flex-wrap justify-center gap-2 sm:gap-3 px-4 pt-6 sm:pt-8 pb-2 relative z-10 order-first">
        {VALUE_PROPS.map(({ label, icon: Icon }) => (
          <span
            key={label}
            className="auth-value-item inline-flex items-center gap-1.5 rounded-lg bg-card/80 border border-border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-foreground"
          >
            <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>

      {/* Left: value props — hidden on small, visible lg+ */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-12 xl:px-20 relative z-10">
        <div className="max-w-md space-y-2 mb-10">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Multi-agent trading platform
          </h2>
          <p className="text-muted-foreground text-sm">
            From research to execution, all in one place.
          </p>
        </div>
        <ul className="space-y-4">
          {VALUE_PROPS.map(({ label, icon: Icon, desc }) => (
            <li key={label} className="auth-value-item flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: login card */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-md mx-auto animate-fade-in">
          <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <img
                src="/phoenix-logo.png"
                alt=""
                className="h-16 w-16 object-contain"
                aria-hidden
              />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Phoenix Claw</h1>
                <p className="mt-1 text-sm text-muted-foreground">Sign in to your dashboard</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="rounded-xl"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" variant="default" className="w-full rounded-xl" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
