import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */
const RArea = Area as any
const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RGrid = CartesianGrid as any
const RTooltip = Tooltip as any
const RLegend = Legend as any
const RContainer = ResponsiveContainer as any
const RChart = RechartsAreaChart as any

interface AreaChartProps {
  data: Record<string, unknown>[]
  index: string
  categories: string[]
  colors?: string[]
  className?: string
  showLegend?: boolean
  showGrid?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  valueFormatter?: (value: number) => string
  yAxisWidth?: number
  curveType?: "linear" | "monotone" | "natural" | "step"
  connectNulls?: boolean
  stack?: boolean
}

const defaultColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function AreaChart({
  data,
  index,
  categories,
  colors = defaultColors,
  className,
  showLegend = true,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  valueFormatter = (v) => `${v}`,
  yAxisWidth = 56,
  curveType = "monotone",
  connectNulls = false,
  stack = false,
}: AreaChartProps) {
  return (
    <div className={cn("h-72 w-full", className)}>
      <RContainer width="100%" height="100%">
        <RChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          {showGrid && <RGrid strokeDasharray="3 3" className="stroke-border" />}
          {showXAxis && (
            <RXAxis dataKey={index} className="text-xs fill-muted-foreground" tickLine={false} axisLine={false} />
          )}
          {showYAxis && (
            <RYAxis
              width={yAxisWidth}
              className="text-xs fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => valueFormatter(v)}
            />
          )}
          <RTooltip
            content={({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; name?: string; value?: unknown }>; label?: string }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <p className="text-[0.70rem] uppercase text-muted-foreground">{label}</p>
                  {payload.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                      <span className="text-xs font-medium">{entry.name}:</span>
                      <span className="text-xs text-muted-foreground">
                        {valueFormatter(entry.value as number)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {showLegend && <RLegend iconType="circle" iconSize={8} />}
          {categories.map((cat, i) => (
            <RArea
              key={cat}
              type={curveType}
              dataKey={cat}
              stackId={stack ? "stack" : undefined}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.1}
              strokeWidth={2}
              connectNulls={connectNulls}
            />
          ))}
        </RChart>
      </RContainer>
    </div>
  )
}
