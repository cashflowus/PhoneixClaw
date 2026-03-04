/**
 * AI-assist control: input/textarea with magic wand that opens a popover to expand short text via Ollama.
 */
import { useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

export interface AiAssistPopoverProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  multiline?: boolean
  /** Optional context sent to the API (e.g. "agent description", "agent name") */
  context?: string
}

export function AiAssistPopover({
  value,
  onChange,
  placeholder,
  label,
  multiline = false,
  context,
}: AiAssistPopoverProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    const p = prompt.trim()
    if (!p) {
      setError('Enter a brief summary first')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<{ text: string }>('/api/v2/ai/expand', {
        prompt: p,
        ...(context ? { context } : {}),
      })
      const text = res.data?.text?.trim()
      if (text) {
        onChange(text)
        setOpen(false)
        setPrompt('')
        toast.success('Description expanded')
      } else {
        setError('Empty response from AI')
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e && typeof (e as { response: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (e as { response: { data: { detail: string } } }).response.data.detail
          : 'AI assist unavailable. Start Ollama and pull a model (see docs/OLLAMA_AI_ASSIST.md).'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const Field = multiline ? Textarea : Input

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Field
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0"
          rows={multiline ? 3 : undefined}
        />
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null) }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Expand with AI (Ollama)"
              aria-label="Expand with AI"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="space-y-3">
              <p className="text-sm font-medium">Brief summary</p>
              <p className="text-xs text-muted-foreground">
                Enter a short note; the local Ollama model will expand it into a full description.
              </p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. SPY scalper from Discord signals"
                className="min-h-[80px] resize-none"
                disabled={loading}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                size="sm"
                className="w-full"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : 'Generate'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
