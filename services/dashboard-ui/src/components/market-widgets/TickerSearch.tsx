import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'

const POPULAR_TICKERS = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'AMD', 'NFLX', 'CRM', 'COIN', 'PLTR', 'BA', 'DIS', 'JPM', 'GS',
  'IWM', 'DIA', 'TLT', 'GLD', 'SLV', 'XLE', 'XLF', 'XLK',
]

interface Props {
  value: string
  onChange: (ticker: string) => void
  label?: string
  placeholder?: string
}

export default function TickerSearch({ value, onChange, label, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query
    ? POPULAR_TICKERS.filter(t => t.toLowerCase().includes(query.toLowerCase()))
    : POPULAR_TICKERS

  const handleSelect = useCallback((ticker: string) => {
    onChange(ticker)
    setQuery('')
    setOpen(false)
  }, [onChange])

  const handleSubmit = useCallback(() => {
    const t = query.trim().toUpperCase()
    if (t) {
      onChange(t)
      setQuery('')
      setOpen(false)
    }
  }, [query, onChange])

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-[9px] text-muted-foreground uppercase mb-0.5 block">{label}</label>}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder={placeholder || `Search ticker (current: ${value})`}
            className="w-full text-xs bg-muted/30 border border-border rounded pl-7 pr-2 py-1.5 outline-none focus:border-purple-500/40"
          />
        </div>
        {value && (
          <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30">
            {value}
          </span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border rounded-lg shadow-lg max-h-40 overflow-auto">
          {filtered.length === 0 && query ? (
            <button onClick={handleSubmit} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50">
              Use "{query.toUpperCase()}"
            </button>
          ) : (
            <div className="p-1 grid grid-cols-4 gap-0.5">
              {filtered.slice(0, 20).map(t => (
                <button
                  key={t}
                  onClick={() => handleSelect(t)}
                  className={`text-[10px] font-mono py-1 px-1.5 rounded text-center transition-colors ${
                    t === value ? 'bg-purple-500/20 text-purple-400 font-bold' : 'hover:bg-muted/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
