import { Star } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useWatchlist } from '../hooks/useWatchlist'
import { cn } from '@/lib/utils'

interface WatchlistButtonProps {
  ticker: string
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'ghost' | 'outline' | 'default'
  showLabel?: boolean
  className?: string
}

export default function WatchlistButton({
  ticker,
  size = 'icon',
  variant = 'ghost',
  showLabel = false,
  className,
}: WatchlistButtonProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, isAdding, isRemoving } = useWatchlist()
  const active = isInWatchlist(ticker)
  const loading = isAdding || isRemoving

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (loading) return
    if (active) {
      await removeFromWatchlist(ticker.toUpperCase())
    } else {
      await addToWatchlist({ ticker: ticker.toUpperCase() })
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={loading}
          className={cn(
            active && 'text-yellow-500 hover:text-yellow-600',
            className,
          )}
        >
          <Star
            className={cn('h-4 w-4', active && 'fill-current')}
          />
          {showLabel && (
            <span className="ml-1.5 text-xs">
              {active ? 'Watching' : 'Watch'}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {active ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      </TooltipContent>
    </Tooltip>
  )
}
