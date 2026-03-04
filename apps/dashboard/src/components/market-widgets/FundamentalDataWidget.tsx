import TradingViewEmbed from './TradingViewEmbed'

export default function FundamentalDataWidget({ symbol = 'AAPL' }: { symbol?: string }) {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-financials.js"
      configKey={symbol}
      config={{
        colorTheme: "dark",
        isTransparent: true,
        largeChartUrl: "",
        displayMode: "regular",
        width: "100%",
        height: "100%",
        symbol: `NASDAQ:${symbol}`,
        locale: "en",
      }}
    />
  )
}
