/**
 * Skills page — skill catalog and agent configuration.
 * Tabs: Skill Catalog, Agent Configuration. Sync skills button.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { FlexCard } from '@/components/ui/FlexCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SidePanel } from '@/components/ui/SidePanel'
import { BookOpen, RefreshCw } from 'lucide-react'

const SKILL_CATEGORIES = ['analysis', 'data', 'execution', 'risk', 'all']
const MOCK_SKILLS = [
  { id: '1', name: 'Technical Analysis', category: 'analysis', description: 'RSI, MACD, Bollinger' },
  { id: '2', name: 'Order Execution', category: 'execution', description: 'Limit, market, stop orders' },
  { id: '3', name: 'Risk Manager', category: 'risk', description: 'Position sizing, drawdown limits' },
  { id: '4', name: 'Data Fetcher', category: 'data', description: 'OHLCV, fundamentals' },
]
const MOCK_AGENT_CONFIG = {
  agents_md: '# Agent roles\n- Day Trader\n- Risk Analyzer',
  soul_md: '# SOUL.md\nAgent personality and behavior.',
  tools_md: '# TOOLS.md\nAvailable tools and skills.',
}

export default function SkillsPage() {
  const [category, setCategory] = useState('all')
  const [selectedSkill, setSelectedSkill] = useState<typeof MOCK_SKILLS[0] | null>(null)
  const [syncing, setSyncing] = useState(false)

  const { data: skills = MOCK_SKILLS } = useQuery({
    queryKey: ['skills', category],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v2/skills?category=${category}`)
        return res.data
      } catch {
        return MOCK_SKILLS.filter((s) => category === 'all' || s.category === category)
      }
    },
  })

  const { data: agentConfig = MOCK_AGENT_CONFIG } = useQuery({
    queryKey: ['agent-config'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v2/skills/agent-config')
        return res.data
      } catch {
        return MOCK_AGENT_CONFIG
      }
    },
  })

  const syncSkills = async () => {
    setSyncing(true)
    try {
      await api.post('/api/v2/skills/sync')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Skills</h2>
          <p className="text-muted-foreground">Skill catalog and agent configuration</p>
        </div>
        <Button variant="outline" onClick={syncSkills} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          Sync Skills
        </Button>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Skill Catalog</TabsTrigger>
          <TabsTrigger value="config">Agent Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {SKILL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((s: { id: string; name: string; category: string; description: string }) => (
              <FlexCard key={s.id} className="cursor-pointer hover:border-primary/50">
                <div onClick={() => setSelectedSkill(s)}>
                <div className="flex items-start gap-2">
                  <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{s.name}</span>
                    <Badge variant="outline" className="ml-2">{s.category}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                  </div>
                </div>
              </div>
              </FlexCard>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-4 space-y-4">
          <div className="grid gap-4">
            <FlexCard title="AGENTS.md">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono">{agentConfig.agents_md}</pre>
            </FlexCard>
            <FlexCard title="SOUL.md">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono">{agentConfig.soul_md}</pre>
            </FlexCard>
            <FlexCard title="TOOLS.md">
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono">{agentConfig.tools_md}</pre>
            </FlexCard>
          </div>
        </TabsContent>
      </Tabs>

      <SidePanel open={!!selectedSkill} onOpenChange={() => setSelectedSkill(null)} title={selectedSkill?.name ?? ''} description={selectedSkill?.category ?? ''}>
        {selectedSkill && (
          <div className="space-y-2">
            <p className="text-sm">{selectedSkill.description}</p>
            <Badge variant="outline">{selectedSkill.category}</Badge>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
