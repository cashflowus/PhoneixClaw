import { useEffect, useRef } from 'react'

interface Props {
  scriptSrc: string
  config: object
  containerId?: string
}

export default function TradingViewEmbed({ scriptSrc, config, containerId }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!ref.current || initializedRef.current) return
    initializedRef.current = true

    const container = document.createElement('div')
    container.className = 'tradingview-widget-container'
    container.style.height = '100%'
    container.style.width = '100%'

    const innerDiv = document.createElement('div')
    innerDiv.className = 'tradingview-widget-container__widget'
    innerDiv.style.height = 'calc(100% - 32px)'
    innerDiv.style.width = '100%'
    if (containerId) innerDiv.id = containerId
    container.appendChild(innerDiv)

    const script = document.createElement('script')
    script.src = scriptSrc
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify(config)
    container.appendChild(script)

    ref.current.appendChild(container)

    return () => {
      if (ref.current) ref.current.replaceChildren()
      initializedRef.current = false
    }
  }, [])

  return <div ref={ref} className="h-full w-full overflow-hidden" />
}
