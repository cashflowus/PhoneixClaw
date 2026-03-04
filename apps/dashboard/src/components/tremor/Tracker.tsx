import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface TrackerBlock {
  key?: string
  color?: string
  tooltip?: string
}

interface TrackerProps {
  data: TrackerBlock[]
  className?: string
}

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  yellow: "bg-amber-500",
  blue: "bg-blue-500",
  gray: "bg-muted",
  default: "bg-muted",
}

export function Tracker({ data, className }: TrackerProps) {
  return (
    <div className={cn("flex w-full items-center gap-0.5", className)}>
      {data.map((block, i) => {
        const bg = block.color ? (colorMap[block.color] || block.color) : colorMap.default
        const bar = (
          <div
            key={block.key ?? i}
            className={cn("h-8 flex-1 rounded-[2px] first:rounded-l last:rounded-r", bg)}
          />
        )
        if (block.tooltip) {
          return (
            <Tooltip key={block.key ?? i}>
              <TooltipTrigger asChild>{bar}</TooltipTrigger>
              <TooltipContent><p className="text-xs">{block.tooltip}</p></TooltipContent>
            </Tooltip>
          )
        }
        return bar
      })}
    </div>
  )
}
