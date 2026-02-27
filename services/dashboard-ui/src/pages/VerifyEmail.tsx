import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }

    axios
      .post('/auth/verify-email', { token })
      .then((res) => {
        setStatus('success')
        setMessage(res.data.message || 'Your email has been verified!')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.detail || 'Verification failed. The link may be expired or invalid.')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <Card className="w-full max-w-md relative border-border/50 shadow-2xl">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Verifying your email...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Email Verified</h2>
                <p className="text-sm text-muted-foreground mt-2">{message}</p>
              </div>
              <Link to="/login">
                <Button className="mt-2">Continue to Login</Button>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Verification Failed</h2>
                <p className="text-sm text-muted-foreground mt-2">{message}</p>
              </div>
              <div className="space-y-2 pt-2">
                <Link to="/login">
                  <Button variant="outline">Go to Login</Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
