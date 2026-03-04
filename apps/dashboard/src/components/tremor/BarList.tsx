import React from "react"
import { cn } from "@/lib/utils"

interface BarListItem {
  name: string
  value: number
  icon?: React.ReactNode
  href?: string
}

interface BarListProps {
  data: BarListItem[]
  className?: string
  valueFormatter?: (value: number) => string
  color?: string
}

export function BarList({
  data,
  className,
  valueFormatter = (v) => `${v}`,
  color = "bg-primary",
}: BarListProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className={cn("space-y-2", className)}>
      {data.map((item) => (
        <div key={item.name} className="group">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 truncate">
              {item.icon}
              {item.href ? (
                <a href={item.href} className="truncate hover:underline">{item.name}</a>
              ) : (
                <span className="truncate">{item.name}</span>
              )}
            </div>
            <span className="font-medium tabular-nums text-foreground">
              {valueFormatter(item.value)}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", color)}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
