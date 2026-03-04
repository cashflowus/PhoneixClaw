import TradingViewEmbed from './TradingViewEmbed'

export default function ForexWidget() {
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
        tabs: [{
          title: "Forex",
          symbols: [
            { s: "FX_IDC:EURUSD", d: "EUR/USD" },
            { s: "FX_IDC:GBPUSD", d: "GBP/USD" },
            { s: "FX_IDC:USDJPY", d: "USD/JPY" },
            { s: "FX_IDC:USDCHF", d: "USD/CHF" },
            { s: "FX_IDC:AUDUSD", d: "AUD/USD" },
            { s: "FX_IDC:USDCAD", d: "USD/CAD" },
          ],
        }],
      }}
    />
  )
}
