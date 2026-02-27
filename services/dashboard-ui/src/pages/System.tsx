import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Activity, Bell, CheckCircle2, XCircle, ShieldAlert, Power, Loader2, MessageCircle, Save, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface NotifPrefs {
  email_enabled: boolean
  whatsapp_enabled: boolean
  whatsapp_phone_number_id: string
  whatsapp_access_token: string
  whatsapp_to_number: string
}

export default function System() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [killMsg, setKillMsg] = useState<string | null>(null)
  const [notifForm, setNotifForm] = useState<NotifPrefs>({
    email_enabled: true,
    whatsapp_enabled: false,
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    whatsapp_to_number: '',
  })
  const [notifSaved, setNotifSaved] = useState(false)

  const { data: notifPrefs } = useQuery<NotifPrefs>({
    queryKey: ['notification-prefs'],
    queryFn: () => axios.get('/api/v1/notifications/preferences').then(r => r.data),
  })

  useEffect(() => {
    if (notifPrefs) {
      setNotifForm(prev => ({
        ...prev,
        email_enabled: notifPrefs.email_enabled,
        whatsapp_enabled: notifPrefs.whatsapp_enabled,
        whatsapp_phone_number_id: notifPrefs.whatsapp_phone_number_id || '',
        whatsapp_to_number: notifPrefs.whatsapp_to_number || '',
        whatsapp_access_token: '',
      }))
    }
  }, [notifPrefs])

  const saveNotifMut = useMutation({
    mutationFn: (data: Partial<NotifPrefs>) => axios.patch('/api/v1/notifications/preferences', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] })
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 2000)
    },
  })

  const { data: health, isLoading: healthLoading, isError: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => axios.get('/api/v1/system/health').then((r) => r.data),
    refetchInterval: 10000,
  })
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => axios.get('/api/v1/notifications?limit=10').then((r) => r.data),
  })
  const { data: systemConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => axios.get('/api/v1/system/config').then((r) => r.data),
  })

  const killMut = useMutation({
    mutationFn: () => axios.post('/api/v1/system/kill-switch'),
    onSuccess: (res) => {
      const active = res.data.kill_switch_active
      setKillMsg(active ? 'Kill switch ACTIVATED — trading disabled' : 'Trading RE-ENABLED')
      qc.invalidateQueries({ queryKey: ['system-config'] })
      setTimeout(() => setKillMsg(null), 3000)
    },
  })

  const tradingEnabled = systemConfig?.enable_trading?.value ?? true

  return (
    <div className="space-y-6">
      {killMsg && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-yellow-600 text-sm">
          {killMsg}
        </div>
      )}

      <Card className={!tradingEnabled ? 'border-red-500/50' : ''}>
        <CardHeader className="flex flex-row items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base">Kill Switch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Trading Status</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tradingEnabled
                  ? 'Trading is active. Press to disable all trade execution.'
                  : 'Trading is DISABLED. Press to re-enable.'}
              </p>
            </div>
            <Button
              variant={tradingEnabled ? 'destructive' : 'default'}
              onClick={() => killMut.mutate()}
              disabled={killMut.isPending}
            >
              <Power className="h-4 w-4 mr-2" />
              {tradingEnabled ? 'Disable Trading' : 'Enable Trading'}
            </Button>
          </div>
          {!tradingEnabled && (
            <Badge variant="destructive" className="mt-3">KILL SWITCH ACTIVE</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.mfa_enabled
                  ? 'MFA is enabled. Your account is secured with an authenticator app.'
                  : 'Add an extra layer of security with an authenticator app.'}
              </p>
              {user?.mfa_enabled && (
                <Badge variant="success" className="mt-1.5 text-[10px]">Enabled</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/mfa-setup')}>
              {user?.mfa_enabled ? 'Manage' : 'Set Up'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-500" />
          <CardTitle className="text-base">Notification Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Daily trade reports at market close</p>
            </div>
            <Switch
              checked={notifForm.email_enabled}
              onCheckedChange={v => {
                setNotifForm(f => ({ ...f, email_enabled: v }))
                saveNotifMut.mutate({ email_enabled: v })
              }}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">WhatsApp Trade Alerts</p>
                <p className="text-xs text-muted-foreground">Get instant alerts when trades are executed</p>
              </div>
              <Switch
                checked={notifForm.whatsapp_enabled}
                onCheckedChange={v => {
                  setNotifForm(f => ({ ...f, whatsapp_enabled: v }))
                  saveNotifMut.mutate({ whatsapp_enabled: v })
                }}
              />
            </div>

            {notifForm.whatsapp_enabled && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Configure your WhatsApp Business Cloud API credentials. You need a Meta Business account with WhatsApp Business API access.
                </p>
                <div className="space-y-2">
                  <Label className="text-xs">Phone Number ID</Label>
                  <Input
                    value={notifForm.whatsapp_phone_number_id}
                    onChange={e => setNotifForm(f => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
                    placeholder="e.g. 123456789012345"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Access Token</Label>
                  <Input
                    type="password"
                    value={notifForm.whatsapp_access_token}
                    onChange={e => setNotifForm(f => ({ ...f, whatsapp_access_token: e.target.value }))}
                    placeholder={notifPrefs?.whatsapp_access_token ? '••••  (already set, leave blank to keep)' : 'Enter your access token'}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Recipient Phone Number</Label>
                  <Input
                    value={notifForm.whatsapp_to_number}
                    onChange={e => setNotifForm(f => ({ ...f, whatsapp_to_number: e.target.value }))}
                    placeholder="e.g. 14155238886"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Include country code without + sign</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={saveNotifMut.isPending}
                  onClick={() => {
                    const payload: Partial<NotifPrefs> = {
                      whatsapp_enabled: notifForm.whatsapp_enabled,
                      whatsapp_phone_number_id: notifForm.whatsapp_phone_number_id,
                      whatsapp_to_number: notifForm.whatsapp_to_number,
                    }
                    if (notifForm.whatsapp_access_token) {
                      payload.whatsapp_access_token = notifForm.whatsapp_access_token
                    }
                    saveNotifMut.mutate(payload)
                  }}
                >
                  {saveNotifMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : notifSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
                  {notifSaved ? 'Saved' : 'Save WhatsApp Settings'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Service Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {health?.services &&
              Object.entries(health.services).map(([name, status]) => {
                const healthy = (status as string) === 'healthy'
                return (
                  <div
                    key={name}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    {healthy ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <Badge variant={healthy ? 'success' : 'destructive'} className="mt-1 text-[10px]">
                        {status as string}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            {healthLoading && (
              <div className="flex justify-center py-4 col-span-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            )}
            {healthError && (
              <div className="col-span-full text-center py-4">
                <p className="text-sm text-destructive">Failed to load health data</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchHealth()}>Retry</Button>
              </div>
            )}
            {!healthLoading && !healthError && !health?.services && (
              <p className="text-sm text-muted-foreground col-span-full">No service data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {(!notifications || notifications.length === 0) ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {(notifications || []).map(
                  (n: { id: number; title: string; body: string; created_at?: string }) => (
                    <div key={n.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.created_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
                    </div>
                  ),
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
