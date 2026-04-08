import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import api from '../config/api'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      onLogin()
      navigate('/')
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">FinsurgeENRIMS</h1>
          <p className="text-slate-500 text-sm mt-1">Enterprise Risk Management System</p>
          <p className="text-slate-400 text-xs mt-1">Finsurge National Bank</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs font-medium text-slate-500 mb-2">Demo Credentials</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
            <span className="font-mono">admin</span><span className="text-slate-400">System Admin</span>
            <span className="font-mono">sunita.krishnan</span><span className="text-slate-400">Compliance</span>
            <span className="font-mono">deepa.venkatesh</span><span className="text-slate-400">Analyst</span>
            <span className="font-mono">pradeep.mohan</span><span className="text-slate-400">Investigator</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Password: <span className="font-mono">Demo@2026</span></p>
        </div>
      </div>
    </div>
  )
}
