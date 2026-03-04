/**
 * Settings page — profile, theme, notifications, API config.
 */
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/context/ThemeContext'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Palette } from 'lucide-react'

const TIMEZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo']

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/user/profile')
        return res.data
      } catch {
        return { name: 'User', email: 'user@phoenix.io', timezone: 'America/New_York' }
      }
    },
  })

  const p = profile ?? { name: 'User', email: 'user@phoenix.io', timezone: 'America/New_York' }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Profile, theme, and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <FlexCard title="Profile Settings">
            <div className="space-y-4 max-w-md">
              <div>
                <Label>Name</Label>
                <Input defaultValue={p.name} placeholder="Your name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" defaultValue={p.email} placeholder="email@example.com" />
              </div>
              <div>
                <Label>Timezone</Label>
                <Select defaultValue={p.timezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button>Save</Button>
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="theme" className="mt-4">
          <FlexCard title="Theme">
            <div className="flex items-center justify-between max-w-md">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span>Dark mode</span>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')} />
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <FlexCard title="Notification Preferences">
            <div className="space-y-4 max-w-md">
              <div className="flex items-center justify-between">
                <Label>Trade alerts</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Risk alerts</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label>Agent status</Label>
                <Switch />
              </div>
            </div>
          </FlexCard>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <FlexCard title="API Configuration">
            <div className="space-y-4 max-w-md">
              <div>
                <Label>API Base URL</Label>
                <Input defaultValue={import.meta.env.VITE_API_URL ?? ''} placeholder="https://api.phoenix.io" />
              </div>
              <Button>Save</Button>
            </div>
          </FlexCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
