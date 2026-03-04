import TradingViewEmbed from './TradingViewEmbed'

export default function GlobalIndicesWidget() {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
      config={{
        colorTheme: "dark",
        dateRange: "1D",
        showChart: true,
        locale: "en",
        width: "100%",
        height: "100%",
        largeChartUrl: "",
        isTransparent: true,
        showSymbolLogo: true,
        showFloatingTooltip: true,
        plotLineColorGrowing: "rgba(41, 98, 255, 1)",
        plotLineColorFalling: "rgba(255, 77, 92, 1)",
        gridLineColor: "rgba(42, 46, 57, 0)",
        scaleFontColor: "rgba(134, 137, 147, 1)",
        belowLineFillColorGrowing: "rgba(41, 98, 255, 0.12)",
        belowLineFillColorFalling: "rgba(255, 77, 92, 0.12)",
        belowLineFillColorGrowingBottom: "rgba(41, 98, 255, 0)",
        belowLineFillColorFallingBottom: "rgba(255, 77, 92, 0)",
        symbolActiveColor: "rgba(41, 98, 255, 0.12)",
        tabs: [
          {
            title: "US",
            symbols: [
              { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
              { s: "FOREXCOM:NSXUSD", d: "Nasdaq" },
              { s: "FOREXCOM:DJI", d: "Dow Jones" },
              { s: "AMEX:IWM", d: "Russell 2000" },
            ],
          },
          {
            title: "Global",
            symbols: [
              { s: "INDEX:NKY", d: "Nikkei 225" },
              { s: "INDEX:DEU40", d: "DAX" },
              { s: "INDEX:UKX", d: "FTSE 100" },
              { s: "INDEX:HSI", d: "Hang Seng" },
            ],
          },
        ],
      }}
    />
  )
}
