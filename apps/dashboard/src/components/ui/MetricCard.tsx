/**
 * MetricCard: single metric display with gradient accent, optional icon, and tooltip.
 */
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  /** Optional hover explanation (e.g. "MOC Imbalance: Market-on-Close order imbalance...") */
  tooltip?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
  className?: string
}

export function MetricCard({ title, value, subtitle, tooltip, trend, icon: Icon, className }: MetricCardProps) {
  const card = (
    <Card
      className={cn(
        'relative overflow-hidden min-w-0',
        'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""] before:bg-primary',
        'shadow-lg shadow-black/5 dark:shadow-primary/5',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate mr-1" title={tooltip ?? title}>{title}</p>
        {Icon && (
          <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        )}
      </CardHeader>
      <CardContent className="min-w-0">
        <p
          className={cn(
            'text-base sm:text-lg lg:text-2xl font-semibold tabular-nums tracking-tight truncate',
            trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
            trend === 'down' && 'text-red-600 dark:text-red-400',
            trend === 'neutral' && 'text-foreground',
            !trend && 'text-foreground',
          )}
          title={String(value)}
        >
          {value}
        </p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>}
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }
  return card
}
