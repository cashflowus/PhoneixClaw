/**
 * Admin page — user management, API keys, audit log, roles.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FlexCard } from '@/components/ui/FlexCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Key, Shield, RotateCw, Eye, EyeOff } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: string
  last_login: string
}

interface ApiKey {
  id: string
  name: string
  masked: string
  last_used: string
}

interface AuditEntry {
  id: string
  user: string
  action: string
  resource: string
  timestamp: string
}

const ROLES = ['admin', 'manager', 'trader', 'viewer']
const MOCK_USERS: User[] = [
  { id: '1', email: 'admin@phoenix.io', name: 'Admin User', role: 'admin', last_login: '2025-03-03T10:00:00Z' },
  { id: '2', email: 'trader@phoenix.io', name: 'Trader One', role: 'trader', last_login: '2025-03-03T09:30:00Z' },
]
const MOCK_KEYS: ApiKey[] = [
  { id: '1', name: 'Dashboard API', masked: 'phx_••••••••••••abc1', last_used: '2025-03-03T10:15:00Z' },
  { id: '2', name: 'Webhook', masked: 'phx_••••••••••••def2', last_used: '2025-03-02T18:00:00Z' },
]
const MOCK_AUDIT: AuditEntry[] = [
  { id: '1', user: 'admin@phoenix.io', action: 'LOGIN', resource: 'auth', timestamp: '2025-03-03T10:00:00Z' },
  { id: '2', user: 'trader@phoenix.io', action: 'CREATE_TRADE', resource: 'trades', timestamp: '2025-03-03T09:45:00Z' },
]

const userColumns: Column<User>[] = [
  { id: 'name', header: 'Name', accessor: 'name' },
  { id: 'email', header: 'Email', accessor: 'email' },
  { id: 'role', header: 'Role', cell: (r) => <Badge variant="outline">{r.role}</Badge> },
  { id: 'last_login', header: 'Last Login', cell: (r) => new Date(r.last_login).toLocaleString() },
]
const auditColumns: Column<AuditEntry>[] = [
  { id: 'timestamp', header: 'Time', cell: (r) => new Date(r.timestamp).toLocaleString() },
  { id: 'user', header: 'User', accessor: 'user' },
  { id: 'action', header: 'Action', accessor: 'action' },
  { id: 'resource', header: 'Resource', accessor: 'resource' },
]

export default function AdminPage() {
  const [keyVisibility, setKeyVisibility] = useState<Record<string, boolean>>({})

  const { data: users = MOCK_USERS } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/admin/users')
        return res.data
      } catch {
        return MOCK_USERS
      }
    },
  })

  const { data: apiKeys = MOCK_KEYS } = useQuery<ApiKey[]>({
    queryKey: ['admin-api-keys'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/admin/api-keys')
        return res.data
      } catch {
        return MOCK_KEYS
      }
    },
  })

  const { data: audit = MOCK_AUDIT } = useQuery<AuditEntry[]>({
    queryKey: ['admin-audit'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/admin/audit')
        return res.data
      } catch {
        return MOCK_AUDIT
      }
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin</h2>
        <p className="text-muted-foreground">User management, API keys, and audit log</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Users" value={users.length} />
        <MetricCard title="API Keys" value={apiKeys.length} />
        <MetricCard title="Roles" value={ROLES.length} />
        <MetricCard title="Audit Events" value={audit.length} />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="keys">API Key Vault</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <DataTable columns={userColumns} data={users as (User & Record<string, unknown>)[]} emptyMessage="No users" />
        </TabsContent>

        <TabsContent value="keys" className="mt-4">
          <div className="space-y-4">
            {apiKeys.map((k) => (
              <FlexCard
                key={k.id}
                title={k.name}
                action={
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setKeyVisibility((v) => ({ ...v, [k.id]: !v[k.id] }))}>
                      {keyVisibility[k.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost"><RotateCw className="h-4 w-4" /></Button>
                  </div>
                }
              >
                <div className="flex items-center gap-2 font-mono text-sm">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  {keyVisibility[k.id] ? k.masked.replace('••••', 'xxxx') : k.masked}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Last used: {new Date(k.last_used).toLocaleString()}</p>
              </FlexCard>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <DataTable columns={auditColumns} data={audit as (AuditEntry & Record<string, unknown>)[]} emptyMessage="No audit entries" />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <FlexCard key={r} className="w-48">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-medium capitalize">{r}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Manage permissions</p>
              </FlexCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
