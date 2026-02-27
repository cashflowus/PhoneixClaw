import TradingViewEmbed from './TradingViewEmbed'

export default function SymbolInfoWidget({ symbol = 'AAPL' }: { symbol?: string }) {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js"
      configKey={symbol}
      config={{
        symbol: `NASDAQ:${symbol}`,
        width: "100%",
        isTransparent: true,
        colorTheme: "dark",
        locale: "en",
      }}
    />
  )
}
