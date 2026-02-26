import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'

interface Props {
  node: Node | null
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}

export function NodeConfigPanel({ node, onUpdate, onClose }: Props) {
  if (!node) return null

  const data = node.data as Record<string, unknown>

  const update = (key: string, value: unknown) => {
    onUpdate(node.id, { ...data, [key]: value })
  }

  return (
    <div className="w-64 border-l bg-muted/30 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold">Configure Node</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-3 space-y-4 overflow-auto flex-1">
        <div className="space-y-2">
          <Label className="text-xs">Label</Label>
          <Input
            value={String(data.label || '')}
            onChange={e => update('label', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {node.type === 'dataSource' && (
          <div className="space-y-2">
            <Label className="text-xs">Source Type</Label>
            <Select value={String(data.subtype || 'discord')} onValueChange={v => update('subtype', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="discord">Discord</SelectItem>
                <SelectItem value="sentiment">Sentiment</SelectItem>
                <SelectItem value="news">News Feed</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {node.type === 'aiModel' && (
          <div className="space-y-2">
            <Label className="text-xs">Model</Label>
            <Select value={String(data.subtype || 'mistral')} onValueChange={v => update('subtype', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mistral">Mistral 7B</SelectItem>
                <SelectItem value="llama">Llama 3.1</SelectItem>
                <SelectItem value="option_analyzer">Option Chain Analyzer</SelectItem>
                <SelectItem value="trade_recommender">AI Trade Recommender</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {node.type === 'broker' && (
          <div className="space-y-2">
            <Label className="text-xs">Broker</Label>
            <Select value={String(data.subtype || 'alpaca')} onValueChange={v => update('subtype', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alpaca">Alpaca</SelectItem>
                <SelectItem value="ibkr">Interactive Brokers</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Label className="text-xs">Paper Mode</Label>
              <Select value={data.paper_mode ? 'true' : 'false'} onValueChange={v => update('paper_mode', v === 'true')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Paper</SelectItem>
                  <SelectItem value="false">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {node.type === 'control' && data.subtype === 'condition' && (
          <div className="space-y-2">
            <Label className="text-xs">Condition Expression</Label>
            <Input
              value={String(data.expression || '')}
              onChange={e => update('expression', e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder="e.g. sentiment_score > 0.5"
            />
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-[10px] text-muted-foreground">
            Node ID: {node.id}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Type: {node.type}
          </p>
        </div>
      </div>
    </div>
  )
}
