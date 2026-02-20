import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Database, Wallet, BarChart3, Settings } from 'lucide-react'

const items = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/sources', icon: Database, label: 'Sources' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/system', icon: Settings, label: 'System' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'}`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
