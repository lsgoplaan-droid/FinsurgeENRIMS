import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Bell, Briefcase, Users, Shield,
  BookOpen, Network, FileText, Settings, LogOut, ChevronDown, Plug,
  Fingerprint, Brain, BarChart3, ShieldCheck, Layers, Sun, Moon, Radar, Target, Timer,
  Scale, Volume2, Activity, Cog, MapPin, Gauge, FileDown, CheckSquare,
  Clock, Hash, Eye, Sparkles, MessageSquare
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface NavItem {
  path: string
  label: string
  icon: any
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/risk-heatmap', label: 'Risk Heatmap', icon: MapPin },
      { path: '/risk-appetite', label: 'Risk Appetite', icon: Gauge },
      { path: '/board-report', label: 'Board Report', icon: FileDown },
    ],
  },
  {
    title: 'Detection & Investigation',
    items: [
      { path: '/alerts', label: 'Alerts', icon: Bell },
      { path: '/cases', label: 'Cases', icon: Briefcase },
      { path: '/fraud-detection', label: 'Fraud Detection', icon: Radar },
      { path: '/investigation-copilot', label: 'Investigation Copilot', icon: Sparkles },
      { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { path: '/sms-approvals', label: 'SMS Approvals', icon: MessageSquare },
    ],
  },
  {
    title: 'Risk Management',
    items: [
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/rules', label: 'Rules Engine', icon: BookOpen },
      { path: '/rules-management', label: 'Rules Management', icon: Cog },
      { path: '/alert-tuning', label: 'Alert Tuning', icon: Target },
      { path: '/network', label: 'Network Analysis', icon: Network },
      { path: '/sla-burndown', label: 'SLA Burndown', icon: Timer },
    ],
  },
  {
    title: 'Regulatory Documents',
    items: [
      { path: '/compliance-ctr', label: 'CTR Filing', icon: FileText },
      { path: '/compliance-sar', label: 'SAR Filing', icon: ShieldCheck },
      { path: '/compliance-lvtr', label: 'LVTR Filing', icon: FileText },
      { path: '/police-fir', label: 'Police FIR', icon: Scale },
    ],
  },
  {
    title: 'Compliance & Reporting',
    items: [
      { path: '/compliance-scorecard', label: 'Compliance Scorecard', icon: CheckSquare },
      { path: '/filing-deadlines', label: 'Filing Deadlines', icon: Clock },
      { path: '/mis-reports', label: 'MIS Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Fraud Operations',
    items: [
      { path: '/internal-fraud', label: 'Internal Fraud', icon: Fingerprint },
      { path: '/fraud-scenarios', label: 'Fraud Scenarios', icon: Layers },
      { path: '/ai-agent', label: 'AI Agent', icon: Brain },
    ],
  },
  {
    title: 'Audit & Monitoring',
    items: [
      { path: '/audit-trail', label: 'Audit Trail', icon: Hash },
      { path: '/user-activity', label: 'User Activity', icon: Eye },
      { path: '/notification-rules', label: 'Notification Rules', icon: Volume2 },
      { path: '/system-monitoring', label: 'System Monitoring', icon: Activity },
    ],
  },
  {
    title: 'Administration',
    items: [
      { path: '/integrations', label: 'Integrations', icon: Plug },
      { path: '/admin', label: 'Administration', icon: Settings },
    ],
  },
]

// Flat list for title lookup
const allNavItems = navGroups.flatMap(g => g.items)

export default function DashboardLayout({ onLogout }: { onLogout: () => void }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    document.body.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggleGroup = (title: string) => {
    const next = new Set(collapsedGroups)
    if (next.has(title)) next.delete(title)
    else next.add(title)
    setCollapsedGroups(next)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-[#0f172a] text-white flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <img src="/finsurge-logo.png" alt="FinSurge" className="w-10 h-10 object-contain" />
            {!collapsed && <div><div className="font-semibold text-sm">FRIMS</div><div className="text-xs text-slate-400">Enterprise Fraud Risk Management</div></div>}
          </div>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navGroups.map(group => {
            const isGroupCollapsed = collapsedGroups.has(group.title)
            return (
              <div key={group.title} className="mb-1">
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="flex items-center justify-between w-full px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                )}
                {!isGroupCollapsed && group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    {!collapsed && <span className="text-xs">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
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
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-slate-600">
              <ChevronDown size={18} className={collapsed ? '-rotate-90' : 'rotate-0'} />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {allNavItems.find(n => location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path)))?.label || 'FinsurgeFRIMS'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {user.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
              </div>
              <div className="text-sm">
                <div className="font-medium text-slate-700 dark:text-slate-200">{user.full_name || 'User'}</div>
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
