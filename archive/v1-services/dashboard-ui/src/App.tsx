import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppShell from './components/AppShell'
import ChatWidget from './components/ChatWidget'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import DataSources from './pages/DataSources'
import TradingAccounts from './pages/TradingAccounts'
import RawMessages from './pages/RawMessages'
import Analytics from './pages/Analytics'
import Positions from './pages/Positions'
import Backtesting from './pages/Backtesting'
import TradePipelines from './pages/TradePipelines'
import PipelineDetail from './pages/PipelineDetail'
import System from './pages/System'
import Admin from './pages/Admin'
import AccessManagement from './pages/AccessManagement'
import SprintBoard from './pages/SprintBoard'
import TaskDetail from './pages/TaskDetail'
import Notifications from './pages/Notifications'
import TickerSentiment from './pages/TickerSentiment'
import TrendingNews from './pages/TrendingNews'
import AIDecisions from './pages/AIDecisions'
import AdvancedPipelines from './pages/AdvancedPipelines'
import PipelineEditorPage from './pages/PipelineEditor'
import StrategyBuilder from './pages/StrategyBuilder'
import ModelHub from './pages/ModelHub'
import MarketCommandCenter from './pages/MarketCommandCenter'
import VerifyEmail from './pages/VerifyEmail'
import MFASetup from './pages/MFASetup'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <>
              <AppShell />
              <ChatWidget />
            </>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="market" element={<MarketCommandCenter />} />
        <Route path="sources" element={<DataSources />} />
        <Route path="accounts" element={<TradingAccounts />} />
        <Route path="positions" element={<Positions />} />
        <Route path="backtest" element={<Backtesting />} />
        <Route path="pipelines" element={<TradePipelines />} />
        <Route path="pipelines/:pipelineId" element={<PipelineDetail />} />
        <Route path="sentiment" element={<TickerSentiment />} />
        <Route path="news" element={<TrendingNews />} />
        <Route path="ai-decisions" element={<AIDecisions />} />
        <Route path="advanced-pipelines" element={<AdvancedPipelines />} />
        <Route path="advanced-pipelines/:pipelineId" element={<PipelineEditorPage />} />
        <Route path="strategies" element={<StrategyBuilder />} />
        <Route path="model-hub" element={<ModelHub />} />
        <Route path="messages" element={<RawMessages />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="system" element={<System />} />
        <Route path="admin" element={<Admin />} />
        <Route path="access" element={<AccessManagement />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="mfa-setup" element={<MFASetup />} />
        <Route path="board" element={<SprintBoard />} />
        <Route path="board/:taskId" element={<TaskDetail />} />
      </Route>
    </Routes>
  )
}
