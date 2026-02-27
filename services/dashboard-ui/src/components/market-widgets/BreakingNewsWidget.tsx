import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, ExternalLink } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

export default function BreakingNewsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['market', 'news'],
    queryFn: () => axios.get('/api/v1/news?limit=20').then(r => r.data).catch(() => []),
    refetchInterval: 120_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const articles = Array.isArray(data) ? data : data?.articles || []

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {articles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No news available</p>
        ) : articles.map((article: any, i: number) => (
          <a
            key={i}
            href={article.url || article.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-2 py-1.5 rounded hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium line-clamp-2 group-hover:text-purple-500 transition-colors">
                  {article.title || article.headline}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground">
                    {article.source || article.publisher || ''}
                  </span>
                  {article.sentiment_label && (
                    <Badge variant="outline" className="text-[7px] px-1">
                      {article.sentiment_label}
                    </Badge>
                  )}
                </div>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
            </div>
          </a>
        ))}
      </div>
    </ScrollArea>
  )
}
