import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Bell, Briefcase, Users, Shield,
  BookOpen, Network, FileText, List, Settings, LogOut, Search, ChevronDown, Plug,
  Fingerprint, Brain, BarChart3, ShieldCheck, Layers, Sun, Moon
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/cases', label: 'Cases', icon: Briefcase },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/kyc', label: 'KYC / CDD', icon: Shield },
  { path: '/rules', label: 'Rules Engine', icon: BookOpen },
  { path: '/network', label: 'Network Analysis', icon: Network },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/watchlists', label: 'Watchlists', icon: List },
  { path: '/internal-fraud', label: 'Internal Fraud', icon: Fingerprint },
  { path: '/fraud-scenarios', label: 'Fraud Scenarios', icon: Layers },
  { path: '/ai-agent', label: 'AI Agent', icon: Brain },
  { path: '/mis-reports', label: 'MIS Reports', icon: BarChart3 },
  { path: '/compliance-sar', label: 'Compliance / SAR', icon: ShieldCheck },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/admin', label: 'Administration', icon: Settings },
]

export default function DashboardLayout({ onLogout }: { onLogout: () => void }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.body.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-[#0f172a] text-white flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">F</div>
            {!collapsed && <div><div className="font-semibold text-sm">FinsurgeENRIMS</div><div className="text-xs text-slate-400">Enterprise Risk Management</div></div>}
          </div>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 text-sm transition-colors">
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-slate-600">
              <ChevronDown size={18} className={collapsed ? '-rotate-90' : 'rotate-0'} />
            </button>
            <h1 className="text-lg font-semibold text-slate-800">
              {navItems.find(n => location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path)))?.label || 'FinsurgeENRIMS'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {user.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
              </div>
              <div className="text-sm">
                <div className="font-medium text-slate-700">{user.full_name || 'User'}</div>
                <div className="text-xs text-slate-400">{user.roles?.join(', ') || ''}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
