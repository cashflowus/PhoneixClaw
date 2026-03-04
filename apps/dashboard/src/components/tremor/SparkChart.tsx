import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */
const RArea = Area as any
const RContainer = ResponsiveContainer as any
const RChart = AreaChart as any

interface SparkAreaChartProps {
  data: Record<string, unknown>[]
  index: string
  categories: string[]
  colors?: string[]
  className?: string
}

const defaultColors = ["hsl(var(--chart-1))"]

export function SparkAreaChart({
  data,
  categories,
  colors = defaultColors,
  className,
}: SparkAreaChartProps) {
  return (
    <div className={cn("h-10 w-24", className)}>
      <RContainer width="100%" height="100%">
        <RChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          {categories.map((cat, i) => (
            <RArea
              key={cat}
              type="monotone"
              dataKey={cat}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </RChart>
      </RContainer>
    </div>
  )
}
