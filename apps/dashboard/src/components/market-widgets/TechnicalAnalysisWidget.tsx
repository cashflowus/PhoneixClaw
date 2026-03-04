import TradingViewEmbed from './TradingViewEmbed'

export default function TechnicalAnalysisWidget({ symbol = 'AAPL' }: { symbol?: string }) {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
      configKey={symbol}
      config={{
        interval: "1D",
        width: "100%",
        height: "100%",
        isTransparent: true,
        symbol: `NASDAQ:${symbol}`,
        showIntervalTabs: true,
        displayMode: "single",
        colorTheme: "dark",
        locale: "en",
      }}
    />
  )
}
