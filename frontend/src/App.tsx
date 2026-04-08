import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './layouts/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import AlertsPage from './pages/AlertsPage'
import AlertDetailPage from './pages/AlertDetailPage'
import CasesPage from './pages/CasesPage'
import CaseDetailPage from './pages/CaseDetailPage'
import CustomersPage from './pages/CustomersPage'
import Customer360Page from './pages/Customer360Page'
import KYCPage from './pages/KYCPage'
import RulesPage from './pages/RulesPage'
import NetworkPage from './pages/NetworkPage'
import ReportsPage from './pages/ReportsPage'
import WatchlistPage from './pages/WatchlistPage'
import AdminPage from './pages/AdminPage'
import IntegrationsPage from './pages/IntegrationsPage'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    const handleStorage = () => setIsAuthenticated(!!localStorage.getItem('token'))
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={() => setIsAuthenticated(true)} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<DashboardLayout onLogout={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setIsAuthenticated(false) }} />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:id" element={<CaseDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id/360" element={<Customer360Page />} />
        <Route path="/kyc" element={<KYCPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/watchlists" element={<WatchlistPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App
