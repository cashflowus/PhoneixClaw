import { ScrollArea } from '@/components/ui/scroll-area'
import { ExternalLink, Rss } from 'lucide-react'

const RSS_FEEDS = [
  { title: 'MarketWatch Top Stories', url: 'https://www.marketwatch.com/rss/topstories' },
  { title: 'Reuters Business', url: 'https://www.reutersagency.com/feed/' },
  { title: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
]

export default function RSSFeedWidget() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <p className="text-[10px] text-muted-foreground">Financial news from curated RSS sources</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {RSS_FEEDS.map(feed => (
            <div key={feed.url} className="rounded-lg border p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Rss className="h-3 w-3 text-orange-500" />
                <span className="text-[11px] font-medium">{feed.title}</span>
              </div>
              <a
                href={feed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-purple-500 hover:underline"
              >
                Open feed <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground text-center py-2">
            RSS feeds update every 5 minutes
          </p>
        </div>
      </ScrollArea>
    </div>
  )
}
