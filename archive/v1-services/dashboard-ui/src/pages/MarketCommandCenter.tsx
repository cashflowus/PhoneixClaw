import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ResponsiveGridLayout, useContainerWidth, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Plus, X, Pencil, Check, Copy } from 'lucide-react'

import WidgetCatalog, { WIDGET_DEFINITIONS, type WidgetDef } from '@/components/market-widgets/WidgetCatalog'
import WidgetWrapper from '@/components/market-widgets/WidgetWrapper'
import WidgetSettingsDialog from '@/components/market-widgets/WidgetSettingsDialog'
import FearGreedWidget from '@/components/market-widgets/FearGreedWidget'
import VixWidget from '@/components/market-widgets/VixWidget'
import Mag7Widget from '@/components/market-widgets/Mag7Widget'
import MarketHeatmapWidget from '@/components/market-widgets/MarketHeatmapWidget'
import TrendingVideosWidget from '@/components/market-widgets/TrendingVideosWidget'
import BreakingNewsWidget from '@/components/market-widgets/BreakingNewsWidget'
import SocialFeedWidget from '@/components/market-widgets/SocialFeedWidget'
import GlobalIndicesWidget from '@/components/market-widgets/GlobalIndicesWidget'
import CryptoWidget from '@/components/market-widgets/CryptoWidget'
import SectorPerformanceWidget from '@/components/market-widgets/SectorPerformanceWidget'
import EconomicCalendarWidget from '@/components/market-widgets/EconomicCalendarWidget'
import EarningsCalendarWidget from '@/components/market-widgets/EarningsCalendarWidget'
import MarketBreadthWidget from '@/components/market-widgets/MarketBreadthWidget'
import FuturesWidget from '@/components/market-widgets/FuturesWidget'
import CommoditiesWidget from '@/components/market-widgets/CommoditiesWidget'
import ForexWidget from '@/components/market-widgets/ForexWidget'
import BondYieldsWidget from '@/components/market-widgets/BondYieldsWidget'
import TopMoversWidget from '@/components/market-widgets/TopMoversWidget'
import PlatformSentimentWidget from '@/components/market-widgets/PlatformSentimentWidget'
import TradingViewChartWidget from '@/components/market-widgets/TradingViewChartWidget'
import RSSFeedWidget from '@/components/market-widgets/RSSFeedWidget'
import MarketClockWidget from '@/components/market-widgets/MarketClockWidget'
import StockScreenerWidget from '@/components/market-widgets/StockScreenerWidget'
import ForexCrossRatesWidget from '@/components/market-widgets/ForexCrossRatesWidget'
import CryptoScreenerWidget from '@/components/market-widgets/CryptoScreenerWidget'
import TechnicalAnalysisWidget from '@/components/market-widgets/TechnicalAnalysisWidget'
import SymbolInfoWidget from '@/components/market-widgets/SymbolInfoWidget'
import MiniChartWidget from '@/components/market-widgets/MiniChartWidget'
import HotlistsWidget from '@/components/market-widgets/HotlistsWidget'
import PutCallRatioWidget from '@/components/market-widgets/PutCallRatioWidget'
import IPOCalendarWidget from '@/components/market-widgets/IPOCalendarWidget'
import RelativeVolumeWidget from '@/components/market-widgets/RelativeVolumeWidget'
import FiftyTwoWeekWidget from '@/components/market-widgets/FiftyTwoWeekWidget'
import SectorRotationWidget from '@/components/market-widgets/SectorRotationWidget'
import OptionsExpiryWidget from '@/components/market-widgets/OptionsExpiryWidget'
import TradingChecklistWidget from '@/components/market-widgets/TradingChecklistWidget'
import QuickNotesWidget from '@/components/market-widgets/QuickNotesWidget'
import TickerTapeWidget from '@/components/market-widgets/TickerTapeWidget'
import TopStoriesWidget from '@/components/market-widgets/TopStoriesWidget'
import FundamentalDataWidget from '@/components/market-widgets/FundamentalDataWidget'
import CompanyProfileWidget from '@/components/market-widgets/CompanyProfileWidget'
import CryptoHeatmapWidget from '@/components/market-widgets/CryptoHeatmapWidget'
import ETFHeatmapWidget from '@/components/market-widgets/ETFHeatmapWidget'
import GammaExposureWidget from '@/components/market-widgets/GammaExposureWidget'
import MarketInternalsWidget from '@/components/market-widgets/MarketInternalsWidget'
import VixTermStructureWidget from '@/components/market-widgets/VixTermStructureWidget'
import PremarketGapWidget from '@/components/market-widgets/PremarketGapWidget'
import SpxKeyLevelsWidget from '@/components/market-widgets/SpxKeyLevelsWidget'
import OptionsFlowWidget from '@/components/market-widgets/OptionsFlowWidget'
import CorrelationMatrixWidget from '@/components/market-widgets/CorrelationMatrixWidget'
import VolatilityDashboardWidget from '@/components/market-widgets/VolatilityDashboardWidget'
import PremarketMoversWidget from '@/components/market-widgets/PremarketMoversWidget'
import DayTradePnlWidget from '@/components/market-widgets/DayTradePnlWidget'
import PositionSizeCalcWidget from '@/components/market-widgets/PositionSizeCalcWidget'
import RiskRewardWidget from '@/components/market-widgets/RiskRewardWidget'
import TradingSessionWidget from '@/components/market-widgets/TradingSessionWidget'
import KeyboardShortcutsWidget from '@/components/market-widgets/KeyboardShortcutsWidget'

// --- Widget component registry (no config props) ---
const STATIC_WIDGETS: Record<string, React.ComponentType> = {
  'fear-greed': FearGreedWidget,
  'mag7': Mag7Widget,
  'trending-videos': TrendingVideosWidget,
  'breaking-news': BreakingNewsWidget,
  'social-feed': SocialFeedWidget,
  'global-indices': GlobalIndicesWidget,
  'crypto': CryptoWidget,
  'sector-perf': SectorPerformanceWidget,
  'econ-cal': EconomicCalendarWidget,
  'earnings-cal': EarningsCalendarWidget,
  'market-breadth': MarketBreadthWidget,
  'futures': FuturesWidget,
  'commodities': CommoditiesWidget,
  'forex': ForexWidget,
  'bond-yields': BondYieldsWidget,
  'top-movers': TopMoversWidget,
  'platform-sentiment': PlatformSentimentWidget,
  'rss-feed': RSSFeedWidget,
  'market-clock': MarketClockWidget,
  'stock-screener': StockScreenerWidget,
  'forex-cross-rates': ForexCrossRatesWidget,
  'crypto-screener': CryptoScreenerWidget,
  'hotlists': HotlistsWidget,
  'ipo-calendar': IPOCalendarWidget,
  'rvol': RelativeVolumeWidget,
  '52week': FiftyTwoWeekWidget,
  'sector-rotation': SectorRotationWidget,
  'options-expiry': OptionsExpiryWidget,
  'trading-checklist': TradingChecklistWidget,
  'quick-notes': QuickNotesWidget,
  'ticker-tape': TickerTapeWidget,
  'top-stories': TopStoriesWidget,
  'crypto-heatmap': CryptoHeatmapWidget,
  'etf-heatmap': ETFHeatmapWidget,
  'market-internals': MarketInternalsWidget,
  'vix-term': VixTermStructureWidget,
  'premarket-gaps': PremarketGapWidget,
  'premarket-movers': PremarketMoversWidget,
  'day-pnl': DayTradePnlWidget,
  'position-calc': PositionSizeCalcWidget,
  'risk-reward': RiskRewardWidget,
  'session-timer': TradingSessionWidget,
  'keyboard-shortcuts': KeyboardShortcutsWidget,
  'correlations': CorrelationMatrixWidget,
  'heatmap': MarketHeatmapWidget,
}

// --- Configurable widgets: accept { symbol } prop ---
const CONFIGURABLE_WIDGETS: Record<string, React.ComponentType<{ symbol: string }>> = {
  'tv-chart': TradingViewChartWidget,
  'vix': VixWidget,
  'technical-analysis': TechnicalAnalysisWidget,
  'symbol-info': SymbolInfoWidget,
  'mini-chart': MiniChartWidget,
  'fundamental-data': FundamentalDataWidget,
  'company-profile': CompanyProfileWidget,
  'gex': GammaExposureWidget,
  'spx-levels': SpxKeyLevelsWidget,
  'options-flow': OptionsFlowWidget,
  'put-call-ratio': PutCallRatioWidget,
  'volatility': VolatilityDashboardWidget,
}

const CONFIGURABLE_DEFAULTS: Record<string, string> = {
  'tv-chart': 'AAPL',
  'vix': 'SPY',
  'technical-analysis': 'AAPL',
  'symbol-info': 'AAPL',
  'mini-chart': 'SPY',
  'fundamental-data': 'AAPL',
  'company-profile': 'AAPL',
  'gex': 'SPY',
  'spx-levels': 'SPY',
  'options-flow': 'SPY',
  'put-call-ratio': 'SPY',
  'volatility': 'SPY',
}

function isConfigurable(widgetId: string): boolean {
  return widgetId in CONFIGURABLE_WIDGETS
}

// --- Tab / Canvas data model ---
interface TabData {
  id: string
  name: string
  widgets: string[]
  layouts: LayoutItem[]
  widgetConfigs: Record<string, Record<string, string>>
}

const STORAGE_KEY = 'mcc-tabs-v2'

const DEFAULT_TAB: TabData = {
  id: 'default',
  name: 'Overview',
  widgets: ['fear-greed', 'global-indices', 'top-movers', 'breaking-news', 'mag7', 'sector-perf'],
  layouts: [
    { i: 'fear-greed', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'global-indices', x: 3, y: 0, w: 5, h: 4, minW: 4, minH: 3 },
    { i: 'top-movers', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'breaking-news', x: 0, y: 4, w: 4, h: 5, minW: 3, minH: 4 },
    { i: 'mag7', x: 4, y: 4, w: 4, h: 5, minW: 3, minH: 4 },
    { i: 'sector-perf', x: 8, y: 4, w: 4, h: 5, minW: 3, minH: 4 },
  ],
  widgetConfigs: {},
}

function loadTabs(): TabData[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const tabs = JSON.parse(saved) as TabData[]
      if (Array.isArray(tabs) && tabs.length > 0) return tabs
    }
  } catch {}
  return [DEFAULT_TAB]
}

function saveTabs(tabs: TabData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
}

function getWidgetDef(id: string): WidgetDef | undefined {
  return WIDGET_DEFINITIONS.find(w => w.id === id)
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// --- Tab bar component ---
function TabBar({ tabs, activeTabId, onSelectTab, onAddTab, onRenameTab, onDeleteTab, onDuplicateTab }: {
  tabs: TabData[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onAddTab: () => void
  onRenameTab: (id: string, name: string) => void
  onDeleteTab: (id: string) => void
  onDuplicateTab: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  const startEditing = (tab: TabData) => {
    setEditingId(tab.id)
    setEditName(tab.name)
  }

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRenameTab(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin px-2">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`group flex items-center gap-1 px-3 py-1.5 rounded-t-lg border-b-2 cursor-pointer transition-colors shrink-0 ${
            tab.id === activeTabId
              ? 'bg-card border-purple-500 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
          onClick={() => tab.id !== activeTabId && onSelectTab(tab.id)}
        >
          {editingId === tab.id ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                onBlur={commitRename}
                className="text-xs bg-transparent border-b border-purple-500 outline-none w-24 py-0"
              />
              <button onClick={commitRename} className="text-green-400 hover:text-green-300">
                <Check className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-xs font-medium max-w-[120px] truncate">{tab.name}</span>
              <span className="text-[9px] text-muted-foreground">({tab.widgets.length})</span>
              <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                <button
                  onClick={e => { e.stopPropagation(); startEditing(tab) }}
                  className="text-muted-foreground hover:text-purple-400"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDuplicateTab(tab.id) }}
                  className="text-muted-foreground hover:text-blue-400"
                  title="Duplicate tab"
                >
                  <Copy className="h-2.5 w-2.5" />
                </button>
                {tabs.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteTab(tab.id) }}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ))}
      <button
        onClick={onAddTab}
        className="flex items-center gap-1 px-2 py-1.5 text-muted-foreground hover:text-purple-400 transition-colors shrink-0"
        title="Add new tab"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="text-[10px]">New Tab</span>
      </button>
    </div>
  )
}

// --- Main component ---
export default function MarketCommandCenter() {
  const [tabs, setTabs] = useState<TabData[]>(loadTabs)
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id || 'default')
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null)
  const { width, containerRef, mounted } = useContainerWidth()

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId])

  const updateTab = useCallback((tabId: string, updater: (tab: TabData) => TabData) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === tabId ? updater(t) : t)
      saveTabs(next)
      return next
    })
  }, [])

  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    updateTab(activeTabId, tab => ({ ...tab, layouts: [...newLayout] }))
  }, [activeTabId, updateTab])

  const handleAddWidget = useCallback((widgetId: string) => {
    updateTab(activeTabId, tab => {
      if (tab.widgets.includes(widgetId)) return tab
      const def = getWidgetDef(widgetId)
      if (!def) return tab
      const maxY = tab.layouts.reduce((max, l) => Math.max(max, l.y + l.h), 0)
      const newLayout: LayoutItem = { i: widgetId, x: 0, y: maxY, w: def.defaultW, h: def.defaultH, minW: def.minW, minH: def.minH }
      const newConfigs = { ...tab.widgetConfigs }
      if (isConfigurable(widgetId) && !newConfigs[widgetId]) {
        newConfigs[widgetId] = { symbol: CONFIGURABLE_DEFAULTS[widgetId] || 'SPY' }
      }
      return { ...tab, widgets: [...tab.widgets, widgetId], layouts: [...tab.layouts, newLayout], widgetConfigs: newConfigs }
    })
  }, [activeTabId, updateTab])

  const handleRemoveWidget = useCallback((widgetId: string) => {
    updateTab(activeTabId, tab => ({
      ...tab,
      widgets: tab.widgets.filter(w => w !== widgetId),
      layouts: tab.layouts.filter(l => l.i !== widgetId),
    }))
  }, [activeTabId, updateTab])

  const handleWidgetConfigChange = useCallback((widgetId: string, key: string, value: string) => {
    updateTab(activeTabId, tab => ({
      ...tab,
      widgetConfigs: { ...tab.widgetConfigs, [widgetId]: { ...(tab.widgetConfigs[widgetId] || {}), [key]: value } },
    }))
    setSettingsWidgetId(null)
  }, [activeTabId, updateTab])

  const handleAddTab = useCallback(() => {
    const id = generateId()
    const newTab: TabData = { id, name: `Tab ${tabs.length + 1}`, widgets: [], layouts: [], widgetConfigs: {} }
    const next = [...tabs, newTab]
    setTabs(next)
    saveTabs(next)
    setActiveTabId(id)
  }, [tabs])

  const handleRenameTab = useCallback((id: string, name: string) => {
    updateTab(id, tab => ({ ...tab, name }))
  }, [updateTab])

  const handleDeleteTab = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) next.push(DEFAULT_TAB)
      saveTabs(next)
      if (activeTabId === id) setActiveTabId(next[0].id)
      return next
    })
  }, [activeTabId])

  const handleDuplicateTab = useCallback((id: string) => {
    const source = tabs.find(t => t.id === id)
    if (!source) return
    const newId = generateId()
    const duplicate: TabData = { ...source, id: newId, name: `${source.name} (copy)` }
    const next = [...tabs, duplicate]
    setTabs(next)
    saveTabs(next)
    setActiveTabId(newId)
  }, [tabs])

  const filteredLayouts = useMemo(() => {
    return activeTab.layouts.filter(l => activeTab.widgets.includes(l.i))
  }, [activeTab])

  const getWidgetConfig = useCallback((widgetId: string): Record<string, string> => {
    return activeTab.widgetConfigs[widgetId] || {}
  }, [activeTab])

  const renderWidget = useCallback((widgetId: string) => {
    const config = getWidgetConfig(widgetId)
    const symbol = config.symbol || CONFIGURABLE_DEFAULTS[widgetId] || 'SPY'

    const ConfigurableComponent = CONFIGURABLE_WIDGETS[widgetId]
    if (ConfigurableComponent) {
      return <ConfigurableComponent symbol={symbol} />
    }

    const StaticComponent = STATIC_WIDGETS[widgetId]
    if (StaticComponent) {
      return <StaticComponent />
    }

    return <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">Widget not found</div>
  }, [getWidgetConfig])

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      {/* Tab bar */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-1.5">
          <div>
            <h1 className="text-sm font-semibold">Market Command Center</h1>
            <p className="text-[10px] text-muted-foreground">{activeTab.widgets.length} widgets on "{activeTab.name}"</p>
          </div>
          <WidgetCatalog activeWidgetIds={activeTab.widgets} onAddWidget={handleAddWidget} />
        </div>
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onAddTab={handleAddTab}
          onRenameTab={handleRenameTab}
          onDeleteTab={handleDeleteTab}
          onDuplicateTab={handleDuplicateTab}
        />
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-2" ref={containerRef as React.RefObject<HTMLDivElement>}>
        {activeTab.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm mb-2">No widgets on this tab yet</p>
            <p className="text-xs mb-4">Click "Add Widget" to build your "{activeTab.name}" dashboard</p>
          </div>
        ) : mounted ? (
          <ResponsiveGridLayout
            className="layout"
            width={width}
            layouts={{ lg: filteredLayouts }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={40}
            dragConfig={{ enabled: true, handle: '.drag-handle' }}
            resizeConfig={{ enabled: true }}
            onLayoutChange={handleLayoutChange}
            margin={[8, 8]}
          >
            {activeTab.widgets.map(widgetId => {
              const def = getWidgetDef(widgetId)
              if (!def) return null
              const configurable = isConfigurable(widgetId)
              const config = getWidgetConfig(widgetId)

              return (
                <div key={widgetId}>
                  <WidgetWrapper
                    title={configurable && config.symbol ? `${def.label} (${config.symbol})` : def.label}
                    icon={def.icon}
                    onRemove={() => handleRemoveWidget(widgetId)}
                    hasSettings={configurable}
                    onSettings={() => setSettingsWidgetId(widgetId)}
                  >
                    {renderWidget(widgetId)}
                  </WidgetWrapper>
                </div>
              )
            })}
          </ResponsiveGridLayout>
        ) : null}
      </div>

      {/* Widget settings dialog */}
      {settingsWidgetId && (
        <WidgetSettingsDialog
          widgetId={settingsWidgetId}
          widgetLabel={getWidgetDef(settingsWidgetId)?.label || ''}
          currentSymbol={getWidgetConfig(settingsWidgetId).symbol || CONFIGURABLE_DEFAULTS[settingsWidgetId] || 'SPY'}
          onSave={(symbol) => handleWidgetConfigChange(settingsWidgetId, 'symbol', symbol)}
          onClose={() => setSettingsWidgetId(null)}
        />
      )}
    </div>
  )
}
