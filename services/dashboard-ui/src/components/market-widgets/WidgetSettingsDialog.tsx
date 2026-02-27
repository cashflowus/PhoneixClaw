import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import TickerSearch from './TickerSearch'

interface Props {
  widgetId: string
  widgetLabel: string
  currentSymbol: string
  onSave: (symbol: string) => void
  onClose: () => void
}

export default function WidgetSettingsDialog({ widgetId, widgetLabel, currentSymbol, onSave, onClose }: Props) {
  const [symbol, setSymbol] = useState(currentSymbol)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Configure {widgetLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <TickerSearch
            value={symbol}
            onChange={setSymbol}
            label="Symbol / Ticker"
            placeholder="Search or type a ticker..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs border rounded hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(symbol)}
              className="px-3 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
