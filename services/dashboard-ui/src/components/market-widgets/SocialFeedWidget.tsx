import { ScrollArea } from '@/components/ui/scroll-area'

const ACCOUNTS = [
  { handle: '@realDonaldTrump', name: 'Donald Trump', platform: 'Truth Social' },
  { handle: '@elonmusk', name: 'Elon Musk', platform: 'X' },
  { handle: '@POTUS', name: 'POTUS', platform: 'X' },
  { handle: '@federalreserve', name: 'Federal Reserve', platform: 'X' },
]

export default function SocialFeedWidget() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <iframe
          src="https://syndication.twitter.com/srv/timeline-list/widget/update?dnt=true&embedId=twitter-widget-0&frame=false&hideBorder=true&hideFooter=true&hideHeader=true&hideScrollBar=false&lang=en&maxHeight=600&origin=https%3A%2F%2Fpublish.twitter.com&showHeader=false&showReplies=false&transparent=true&theme=dark"
          className="w-full h-full border-0"
          title="Social Feed"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onError={() => {}}
        />
      </div>
      <div className="px-2 py-1.5 border-t bg-muted/30">
        <p className="text-[9px] text-muted-foreground text-center">
          Tracking: {ACCOUNTS.map(a => a.handle).join(', ')}
        </p>
      </div>
    </div>
  )
}
