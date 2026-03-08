/**
 * Login page — animated background with floating particles, glowing orbs,
 * value props with staggered entrance, and a glass-morphism login card.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  DollarSign, LineChart, Bot, Cpu, Database, ArrowRight, Eye, EyeOff,
  Sparkles, Zap, Shield, TrendingUp,
} from 'lucide-react'

const VALUE_PROPS = [
  { label: 'Profits & P&L', icon: DollarSign, desc: 'Track and grow your edge', color: 'from-emerald-500 to-green-600' },
  { label: 'Algorithmic Trade', icon: LineChart, desc: 'Systematic execution', color: 'from-blue-500 to-cyan-500' },
  { label: 'Agentic Trading', icon: Bot, desc: 'Multi-agent pipelines', color: 'from-violet-500 to-purple-600' },
  { label: 'Intelligent Bots', icon: Cpu, desc: 'Research \u2192 Technical \u2192 Risk', color: 'from-amber-500 to-orange-500' },
  { label: 'Data everywhere', icon: Database, desc: 'Signals, flow, and metrics', color: 'from-rose-500 to-pink-500' },
]

const FLOATING_ICONS = [Sparkles, Zap, Shield, TrendingUp, Bot, LineChart]

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; pulse: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const count = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 15000))
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.pulse += 0.02
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const o = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(96, 165, 250, ${o})`
        ctx.fill()
      })

      // connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(96, 165, 250, ${0.06 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
}

function GlowingLogo() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring */}
      <div className="absolute w-24 h-24 rounded-full bg-blue-500/20 animate-[login-pulse_3s_ease-in-out_infinite]" />
      <div className="absolute w-20 h-20 rounded-full bg-blue-500/10 animate-[login-pulse_3s_ease-in-out_infinite_0.5s]" />
      {/* Logo */}
      <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 backdrop-blur-sm flex items-center justify-center animate-[login-float_6s_ease-in-out_infinite]">
        <img src="/phoenix-logo.png" alt="" className="h-12 w-12 object-contain" aria-hidden />
      </div>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
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
    <div className="login-page dark min-h-screen flex flex-col lg:flex-row items-stretch relative overflow-hidden"
      style={{ background: 'hsl(222.2 84% 3%)' }}
    >
      {/* Animated particles canvas */}
      <FloatingParticles />

      {/* Animated gradient orbs */}
      <div className="login-orb login-orb-1" aria-hidden />
      <div className="login-orb login-orb-2" aria-hidden />
      <div className="login-orb login-orb-3" aria-hidden />
      <div className="login-orb login-orb-4" aria-hidden />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsla(217.2, 91.2%, 59.8%, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, hsla(217.2, 91.2%, 59.8%, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Scanning light beam */}
      <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
        <div className="login-scan-beam" />
      </div>

      {/* Mobile: value props strip */}
      <div className="lg:hidden flex flex-wrap justify-center gap-2 px-4 pt-6 pb-2 relative z-10 order-first">
        {VALUE_PROPS.map(({ label, icon: Icon, color }, i) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-medium text-white/90"
            style={{ animation: `login-item-enter 0.5s ease-out ${i * 0.1}s backwards` }}
          >
            <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${color} flex items-center justify-center`}>
              <Icon className="h-3 w-3 text-white" />
            </div>
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>

      {/* Left panel: value props */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-12 xl:px-20 relative z-10">
        <div className="max-w-lg">
          <div className="mb-10" style={{ animation: 'login-item-enter 0.6s ease-out backwards' }}>
            <h2 className="text-3xl xl:text-4xl font-bold text-white tracking-tight leading-tight">
              Multi-agent
              <br />
              <span className="login-gradient-text">trading platform</span>
            </h2>
            <p className="text-white/50 text-sm mt-3 max-w-sm">
              From research to execution, all in one place. Deploy autonomous agents that trade for you 24/7.
            </p>
          </div>

          <ul className="space-y-3">
            {VALUE_PROPS.map(({ label, icon: Icon, desc, color }, i) => (
              <li
                key={label}
                className="login-value-card group flex items-center gap-4 rounded-xl p-3 border border-transparent hover:border-white/10 hover:bg-white/[0.03] transition-all cursor-default"
                style={{ animation: `login-item-enter 0.5s ease-out ${0.2 + i * 0.1}s backwards` }}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="font-semibold text-white text-sm">{label}</p>
                  <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors">{desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/0 group-hover:text-white/40 ml-auto transition-all group-hover:translate-x-1" />
              </li>
            ))}
          </ul>

          {/* Floating micro-icons */}
          <div className="absolute top-20 right-10 opacity-20 pointer-events-none hidden xl:block">
            {FLOATING_ICONS.map((Icon, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  top: `${(i * 60) % 200}px`,
                  left: `${(i * 80) % 150}px`,
                  animation: `login-float ${4 + i}s ease-in-out ${i * 0.5}s infinite`,
                }}
              >
                <Icon className="h-5 w-5 text-blue-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: login card */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-md mx-auto" style={{ animation: 'login-card-enter 0.7s ease-out backwards' }}>
          {/* Glass card */}
          <div className="relative rounded-2xl border border-white/[0.08] p-6 sm:p-8 shadow-2xl shadow-black/40 overflow-hidden"
            style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(24px)' }}
          >
            {/* Card inner glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-20 bg-blue-500/5 blur-2xl pointer-events-none" />

            <div className="relative flex flex-col items-center gap-4 text-center mb-8">
              <GlowingLogo />
              <div>
                <h1 className="text-2xl font-bold text-white">Phoenix Claw</h1>
                <p className="mt-1 text-sm text-white/40">Sign in to your dashboard</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70 text-xs font-medium uppercase tracking-wider">Email</Label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'email' ? 'login-input-glow' : ''}`}>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70 text-xs font-medium uppercase tracking-wider">Password</Label>
                <div className={`relative rounded-xl transition-all duration-300 ${focused === 'password' ? 'login-input-glow' : ''}`}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    required
                    autoComplete="current-password"
                    className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400 animate-[login-shake_0.4s_ease-in-out]">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-sm relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="login-spinner" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
                {/* Button shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>
            </form>

            <div className="relative mt-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <p className="mt-4 text-center text-sm text-white/40">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-medium text-blue-400 hover:text-blue-300 transition-colors hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          {/* Card shadow reflection */}
          <div className="w-4/5 h-4 mx-auto mt-1 rounded-b-xl bg-blue-500/5 blur-xl" />
        </div>
      </div>
    </div>
  )
}
