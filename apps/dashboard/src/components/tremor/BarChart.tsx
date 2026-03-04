import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */
const RBar = Bar as any
const RXAxis = XAxis as any
const RYAxis = YAxis as any
const RGrid = CartesianGrid as any
const RTooltip = Tooltip as any
const RLegend = Legend as any
const RContainer = ResponsiveContainer as any
const RChart = RechartsBarChart as any

interface BarChartProps {
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
  layout?: "horizontal" | "vertical"
  stack?: boolean
  barCategoryGap?: string | number
}

const defaultColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function BarChart({
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
  layout = "horizontal",
  stack = false,
  barCategoryGap = "10%",
}: BarChartProps) {
  return (
    <div className={cn("h-72 w-full", className)}>
      <RContainer width="100%" height="100%">
        <RChart data={data} layout={layout} barCategoryGap={barCategoryGap} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          {showGrid && <RGrid strokeDasharray="3 3" className="stroke-border" />}
          {showXAxis && (
            <RXAxis
              dataKey={layout === "horizontal" ? index : undefined}
              type={layout === "horizontal" ? "category" : "number"}
              className="text-xs fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
          )}
          {showYAxis && (
            <RYAxis
              dataKey={layout === "vertical" ? index : undefined}
              type={layout === "vertical" ? "category" : "number"}
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
            <RBar key={cat} dataKey={cat} stackId={stack ? "stack" : undefined} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </RChart>
      </RContainer>
    </div>
  )
}
