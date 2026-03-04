/**
 * Register page. Phoenix Claw branding, animated background, glass card.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')
  const { register, error: contextError } = useAuth()
  const navigate = useNavigate()
  const error = contextError ?? localError

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    try {
      await register(email, password, name)
      navigate('/', { replace: true })
    } catch {
      setLocalError('Registration failed. Try again.')
    }
  }

  return (
    <div className="auth-bg dark min-h-screen flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md mx-auto animate-fade-in relative z-10">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-4 text-center">
            <img src="/phoenix-logo.png" alt="" className="h-14 w-14" aria-hidden />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Phoenix Claw</h1>
              <p className="mt-1 text-sm text-muted-foreground">Create your account</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
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
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="default" className="w-full">
              Create account
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
