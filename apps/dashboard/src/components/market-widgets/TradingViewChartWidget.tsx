import TradingViewEmbed from './TradingViewEmbed'

export default function TradingViewChartWidget({ symbol = 'AAPL' }: { symbol?: string }) {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
      configKey={symbol}
      config={{
        autosize: true,
        symbol: `NASDAQ:${symbol}`,
        interval: "D",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        allow_symbol_change: true,
        calendar: false,
        support_host: "https://www.tradingview.com",
      }}
    />
  )
}
