import TradingViewEmbed from './TradingViewEmbed'

export default function CompanyProfileWidget({ symbol = 'AAPL' }: { symbol?: string }) {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js"
      configKey={symbol}
      config={{
        width: "100%",
        height: "100%",
        colorTheme: "dark",
        isTransparent: true,
        symbol: `NASDAQ:${symbol}`,
        locale: "en",
      }}
    />
  )
}
