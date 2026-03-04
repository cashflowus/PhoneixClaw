import TradingViewEmbed from './TradingViewEmbed'

export default function EconomicCalendarWidget() {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
      config={{
        colorTheme: "dark",
        isTransparent: true,
        width: "100%",
        height: "100%",
        locale: "en",
        importanceFilter: "0,1",
        countryFilter: "us",
      }}
    />
  )
}
