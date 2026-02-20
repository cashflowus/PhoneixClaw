import { Outlet, NavLink } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useAuth } from '../hooks/useAuth'
import BottomNav from './BottomNav'
import { LayoutDashboard, Database, Wallet, BarChart3, Settings, LogOut } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sources', icon: Database, label: 'Data Sources' },
  { to: '/accounts', icon: Wallet, label: 'Trading Accounts' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/system', icon: Settings, label: 'System' },
]

export default function AppShell() {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const { logout } = useAuth()

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">CopyTrader</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:text-red-600 w-full"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </aside>
      )}
      <main className={`flex-1 overflow-auto ${isMobile ? 'pb-16' : ''}`}>
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      {isMobile && <BottomNav />}
    </div>
  )
}
