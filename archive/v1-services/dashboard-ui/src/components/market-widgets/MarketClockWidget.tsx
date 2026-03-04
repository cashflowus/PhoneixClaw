import { useState, useEffect } from 'react'

const MARKETS = [
  { name: 'New York', tz: 'America/New_York', open: 9.5, close: 16, flag: '🇺🇸' },
  { name: 'London', tz: 'Europe/London', open: 8, close: 16.5, flag: '🇬🇧' },
  { name: 'Tokyo', tz: 'Asia/Tokyo', open: 9, close: 15, flag: '🇯🇵' },
  { name: 'Sydney', tz: 'Australia/Sydney', open: 10, close: 16, flag: '🇦🇺' },
  { name: 'Hong Kong', tz: 'Asia/Hong_Kong', open: 9.5, close: 16, flag: '🇭🇰' },
  { name: 'Frankfurt', tz: 'Europe/Berlin', open: 9, close: 17.5, flag: '🇩🇪' },
]

export default function MarketClockWidget() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-2 space-y-1.5 h-full overflow-auto">
      {MARKETS.map(m => {
        const localTime = new Date(now.toLocaleString('en-US', { timeZone: m.tz }))
        const hours = localTime.getHours() + localTime.getMinutes() / 60
        const isOpen = hours >= m.open && hours < m.close
        const dayOfWeek = localTime.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const status = isWeekend ? 'Weekend' : isOpen ? 'Open' : 'Closed'

        return (
          <div key={m.name} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50">
            <span className="text-sm">{m.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{m.name}</p>
              <p className="text-[9px] text-muted-foreground font-mono">
                {localTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
            <div className={`flex items-center gap-1 text-[9px] font-medium ${
              status === 'Open' ? 'text-green-500' : status === 'Weekend' ? 'text-muted-foreground' : 'text-red-500'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${
                status === 'Open' ? 'bg-green-500 animate-pulse' : status === 'Weekend' ? 'bg-muted-foreground' : 'bg-red-500'
              }`} />
              {status}
            </div>
          </div>
        )
      })}
    </div>
  )
}
