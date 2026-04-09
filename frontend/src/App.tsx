import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
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
// KYC module hidden — fraud-focused system
import RulesPage from './pages/RulesPage'
import NetworkPage from './pages/NetworkPage'
import ReportsPage from './pages/ReportsPage'
import WatchlistPage from './pages/WatchlistPage'
import AdminPage from './pages/AdminPage'
import IntegrationsPage from './pages/IntegrationsPage'
import InternalFraudPage from './pages/InternalFraudPage'
import FraudScenariosPage from './pages/FraudScenariosPage'
import AIAgentPage from './pages/AIAgentPage'
import MISReportsPage from './pages/MISReportsPage'
import ComplianceSARPage from './pages/ComplianceSARPage'
import FraudDetectionPage from './pages/FraudDetectionPage'
import AlertTuningPage from './pages/AlertTuningPage'
import SLABurndownPage from './pages/SLABurndownPage'
import PoliceFIRPage from './pages/PoliceFIRPage'
import NotificationRulesPage from './pages/NotificationRulesPage'
import SystemMonitoringPage from './pages/SystemMonitoringPage'
import RulesManagementPage from './pages/RulesManagementPage'
// Day 4-5 features
import RiskHeatmapPage from './pages/RiskHeatmapPage'
import RiskAppetitePage from './pages/RiskAppetitePage'
import BoardReportPage from './pages/BoardReportPage'
import ComplianceScorecardPage from './pages/ComplianceScorecardPage'
import FilingDeadlinePage from './pages/FilingDeadlinePage'
import AuditTrailPage from './pages/AuditTrailPage'
import UserActivityPage from './pages/UserActivityPage'
import InvestigationCopilotPage from './pages/InvestigationCopilotPage'

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
    <ErrorBoundary>
      <Routes>
        <Route element={<DashboardLayout onLogout={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setIsAuthenticated(false) }} />}>
          <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/transactions" element={<ErrorBoundary><TransactionsPage /></ErrorBoundary>} />
          <Route path="/alerts" element={<ErrorBoundary><AlertsPage /></ErrorBoundary>} />
          <Route path="/alerts/:id" element={<ErrorBoundary><AlertDetailPage /></ErrorBoundary>} />
          <Route path="/cases" element={<ErrorBoundary><CasesPage /></ErrorBoundary>} />
          <Route path="/cases/:id" element={<ErrorBoundary><CaseDetailPage /></ErrorBoundary>} />
          <Route path="/customers" element={<ErrorBoundary><CustomersPage /></ErrorBoundary>} />
          <Route path="/customers/:id/360" element={<ErrorBoundary><Customer360Page /></ErrorBoundary>} />
          {/* KYC route hidden */}
          <Route path="/rules" element={<ErrorBoundary><RulesPage /></ErrorBoundary>} />
          <Route path="/network" element={<ErrorBoundary><NetworkPage /></ErrorBoundary>} />
          <Route path="/reports" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
          <Route path="/watchlists" element={<ErrorBoundary><WatchlistPage /></ErrorBoundary>} />
          <Route path="/integrations" element={<ErrorBoundary><IntegrationsPage /></ErrorBoundary>} />
          <Route path="/fraud-detection" element={<ErrorBoundary><FraudDetectionPage /></ErrorBoundary>} />
          <Route path="/internal-fraud" element={<ErrorBoundary><InternalFraudPage /></ErrorBoundary>} />
          <Route path="/fraud-scenarios" element={<ErrorBoundary><FraudScenariosPage /></ErrorBoundary>} />
          <Route path="/ai-agent" element={<ErrorBoundary><AIAgentPage /></ErrorBoundary>} />
          <Route path="/mis-reports" element={<ErrorBoundary><MISReportsPage /></ErrorBoundary>} />
          <Route path="/compliance-sar" element={<ErrorBoundary><ComplianceSARPage /></ErrorBoundary>} />
          <Route path="/alert-tuning" element={<ErrorBoundary><AlertTuningPage /></ErrorBoundary>} />
          <Route path="/sla-burndown" element={<ErrorBoundary><SLABurndownPage /></ErrorBoundary>} />
          <Route path="/police-fir" element={<ErrorBoundary><PoliceFIRPage /></ErrorBoundary>} />
          <Route path="/notification-rules" element={<ErrorBoundary><NotificationRulesPage /></ErrorBoundary>} />
          <Route path="/system-monitoring" element={<ErrorBoundary><SystemMonitoringPage /></ErrorBoundary>} />
          <Route path="/rules-management" element={<ErrorBoundary><RulesManagementPage /></ErrorBoundary>} />
          {/* Day 4-5 features */}
          <Route path="/risk-heatmap" element={<ErrorBoundary><RiskHeatmapPage /></ErrorBoundary>} />
          <Route path="/risk-appetite" element={<ErrorBoundary><RiskAppetitePage /></ErrorBoundary>} />
          <Route path="/board-report" element={<ErrorBoundary><BoardReportPage /></ErrorBoundary>} />
          <Route path="/compliance-scorecard" element={<ErrorBoundary><ComplianceScorecardPage /></ErrorBoundary>} />
          <Route path="/filing-deadlines" element={<ErrorBoundary><FilingDeadlinePage /></ErrorBoundary>} />
          <Route path="/audit-trail" element={<ErrorBoundary><AuditTrailPage /></ErrorBoundary>} />
          <Route path="/user-activity" element={<ErrorBoundary><UserActivityPage /></ErrorBoundary>} />
          <Route path="/investigation-copilot" element={<ErrorBoundary><InvestigationCopilotPage /></ErrorBoundary>} />
          <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
        </Route>
        <Route path="/login" element={<Navigate to="/" />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
