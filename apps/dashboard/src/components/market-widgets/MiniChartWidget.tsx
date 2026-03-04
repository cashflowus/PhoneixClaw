import TradingViewEmbed from './TradingViewEmbed'

export default function MiniChartWidget({ symbol = 'SPY' }: { symbol?: string }) {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js"
      configKey={symbol}
      config={{
        symbol: `AMEX:${symbol}`,
        width: "100%",
        height: "100%",
        locale: "en",
        dateRange: "1D",
        colorTheme: "dark",
        isTransparent: true,
        autosize: true,
        largeChartUrl: "",
        chartOnly: false,
      }}
    />
  )
}
