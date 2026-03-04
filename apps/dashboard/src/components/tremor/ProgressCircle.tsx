import React from "react"
import { cn } from "@/lib/utils"

interface ProgressCircleProps {
  value: number
  max?: number
  size?: "sm" | "md" | "lg"
  color?: string
  className?: string
  showLabel?: boolean
  children?: React.ReactNode
}

const sizeMap = {
  sm: { dim: 40, stroke: 4 },
  md: { dim: 64, stroke: 5 },
  lg: { dim: 96, stroke: 6 },
}

export function ProgressCircle({
  value,
  max = 100,
  size = "md",
  color = "stroke-primary",
  className,
  showLabel = true,
  children,
}: ProgressCircleProps) {
  const { dim, stroke } = sizeMap[size]
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(Math.max(value / max, 0), 1)
  const offset = circumference * (1 - pct)

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: dim, height: dim }}>
      <svg viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90" width={dim} height={dim}>
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {(children || showLabel) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children ?? (
            <span className={cn("font-semibold tabular-nums", size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base")}>
              {Math.round(pct * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
