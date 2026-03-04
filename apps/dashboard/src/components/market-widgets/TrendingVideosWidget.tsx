import { useState } from 'react'

const TRADING_CHANNELS = [
  { name: 'CNBC Television', channelId: 'UCvJJ_dzjViJCoLf5uKUTwoA' },
  { name: 'Bloomberg TV', channelId: 'UCIALMKvObZNtJ68-rmLjXhA' },
  { name: 'Yahoo Finance', channelId: 'UCEAZeUIeJs0IjQiqTCdVSIg' },
]

export default function TrendingVideosWidget() {
  const [activeChannel, setActiveChannel] = useState(0)
  const ch = TRADING_CHANNELS[activeChannel]

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-2 py-1.5 border-b overflow-x-auto">
        {TRADING_CHANNELS.map((c, i) => (
          <button
            key={c.channelId}
            onClick={() => setActiveChannel(i)}
            className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
              i === activeChannel ? 'bg-purple-500/10 text-purple-500 font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          src={`https://www.youtube.com/embed/live_stream?channel=${ch.channelId}&autoplay=0`}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={ch.name}
        />
      </div>
    </div>
  )
}
