/**
 * PageHeader: consistent page header with icon in gradient circle, title, and description.
 */
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function PageHeader({ icon: Icon, title, description, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="mt-4 flex items-center gap-2 sm:mt-0">{children}</div>}
    </div>
  )
}
