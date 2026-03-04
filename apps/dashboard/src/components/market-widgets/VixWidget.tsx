import TradingViewEmbed from './TradingViewEmbed'

export default function VixWidget({ symbol = 'SPY' }: { symbol?: string }) {
  const tvSymbol = symbol === 'SPY' ? 'CBOE:VIX' : `NASDAQ:${symbol}`
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
      configKey={tvSymbol}
      config={{
        symbols: [[`${tvSymbol}|1D`]],
        chartOnly: false,
        width: "100%",
        height: "100%",
        locale: "en",
        colorTheme: "dark",
        autosize: true,
        showVolume: false,
        showMA: false,
        hideDateRanges: false,
        hideMarketStatus: false,
        hideSymbolLogo: false,
        scalePosition: "right",
        scaleMode: "Normal",
        fontFamily: "inherit",
        fontSize: "10",
        noTimeScale: false,
        valuesTracking: "1",
        changeMode: "price-and-percent",
        chartType: "area",
        lineWidth: 2,
        lineType: 0,
        dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
      }}
    />
  )
}
