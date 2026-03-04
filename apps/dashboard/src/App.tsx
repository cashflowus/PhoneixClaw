/**
 * Phoenix v2 Dashboard — root. M1.4+: shell, routes, auth, real pages.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import TradesPage from '@/pages/Trades'
import PositionsPage from '@/pages/Positions'
import AgentsPage from '@/pages/Agents'
import PerformancePage from '@/pages/Performance'
import StrategiesPage from '@/pages/Strategies'
import ConnectorsPage from '@/pages/Connectors'
import SkillsPage from '@/pages/Skills'
import AdminPage from '@/pages/Admin'
import NetworkPage from '@/pages/Network'
import TasksPage from '@/pages/Tasks'
import SettingsPage from '@/pages/Settings'
import MarketPage from '@/pages/Market'
import DevDashboard from '@/pages/DevDashboard'
import AgentLearningPage from '@/pages/AgentLearning'
import DailySignalsPage from '@/pages/DailySignals'
import OnChainFlowPage from '@/pages/OnChainFlow'
import MacroPulsePage from '@/pages/MacroPulse'
import ZeroDteSPXPage from '@/pages/ZeroDteSPX'
import NarrativeSentimentPage from '@/pages/NarrativeSentiment'
import RiskCompliancePage from '@/pages/RiskCompliance'
import { Toaster } from 'sonner'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/trades" replace />} />
        <Route path="trades" element={<TradesPage />} />
        <Route path="positions" element={<PositionsPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="strategies" element={<StrategiesPage />} />
        <Route path="connectors" element={<ConnectorsPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="daily-signals" element={<DailySignalsPage />} />
        <Route path="onchain-flow" element={<OnChainFlowPage />} />
        <Route path="macro-pulse" element={<MacroPulsePage />} />
        <Route path="zero-dte" element={<ZeroDteSPXPage />} />
        <Route path="narrative" element={<NarrativeSentimentPage />} />
        <Route path="risk" element={<RiskCompliancePage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="agent-learning" element={<AgentLearningPage />} />
        <Route path="dev" element={<DevDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
