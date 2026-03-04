import TradingViewEmbed from './TradingViewEmbed'

export default function FuturesWidget() {
  return (
    <TradingViewEmbed
      scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
      config={{
        symbols: [
          { proName: "CME_MINI:ES1!", title: "S&P 500" },
          { proName: "CME_MINI:NQ1!", title: "Nasdaq" },
          { proName: "CME_MINI:YM1!", title: "Dow" },
          { proName: "CME_MINI:RTY1!", title: "Russell" },
          { proName: "COMEX:GC1!", title: "Gold" },
          { proName: "NYMEX:CL1!", title: "Crude Oil" },
          { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
          { proName: "CBOE:VIX", title: "VIX" },
        ],
        showSymbolLogo: true,
        isTransparent: true,
        displayMode: "adaptive",
        colorTheme: "dark",
        locale: "en",
      }}
    />
  )
}
