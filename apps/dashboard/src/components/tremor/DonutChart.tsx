import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */
const RPie = Pie as any
const RCell = Cell as any
const RTooltip = Tooltip as any
const RLegend = Legend as any
const RContainer = ResponsiveContainer as any
const RPieChart = PieChart as any

interface DonutChartProps {
  data: { name: string; value: number; [key: string]: unknown }[]
  category?: string
  index?: string
  colors?: string[]
  className?: string
  showLegend?: boolean
  valueFormatter?: (value: number) => string
  showLabel?: boolean
  label?: string
}

const defaultColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function DonutChart({
  data,
  category = "value",
  index = "name",
  colors = defaultColors,
  className,
  showLegend = true,
  valueFormatter = (v) => `${v}`,
  showLabel = true,
  label,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + (d[category] as number), 0)

  return (
    <div className={cn("h-72 w-full", className)}>
      <RContainer width="100%" height="100%">
        <RPieChart>
          <RPie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            dataKey={category}
            nameKey={index}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_entry, i) => (
              <RCell key={i} fill={colors[i % colors.length]} />
            ))}
          </RPie>
          <RTooltip
            content={({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: unknown; payload?: { fill?: string } }> }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: item.payload?.fill }} />
                    <span className="text-xs font-medium">{item.name}:</span>
                    <span className="text-xs text-muted-foreground">
                      {valueFormatter(item.value as number)}
                    </span>
                  </div>
                </div>
              )
            }}
          />
          {showLegend && <RLegend iconType="circle" iconSize={8} />}
          {showLabel && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-2xl font-bold"
            >
              {label ?? valueFormatter(total)}
            </text>
          )}
        </RPieChart>
      </RContainer>
    </div>
  )
}
