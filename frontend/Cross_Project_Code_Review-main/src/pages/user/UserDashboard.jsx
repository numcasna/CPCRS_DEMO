import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { projectById } from '../../data/mockData'

export default function UserDashboard() {
  const { currentUser } = useAuth()
  const { findings } = useData()
  const navigate = useNavigate()

  const mine = findings.filter((f) => f.assignee === currentUser?.userId)
  const open = mine.filter((f) => f.status === 'Open').length
  const inProgress = mine.filter((f) => f.status === 'In Progress').length
  const resolved = mine.filter((f) => f.status === 'Resolved').length
  const overdue = mine.filter((f) => new Date(f.dueDate) < new Date('2026-09-27') && !['Closed', 'Rejected'].includes(f.status)).length
  const active = open + inProgress

  const stats = [
    { label: 'My Total', value: mine.length },
    { label: 'Open', value: open },
    { label: 'In Progress', value: inProgress },
    { label: 'Resolved', value: resolved },
    { label: 'Overdue', value: overdue },
  ]
  const colors = ['bg-accent', 'bg-indigo-500', 'bg-blue-500', 'bg-green-600', 'bg-red-600']

  return (
    <div>
      <Topbar title="My Dashboard" />
      <div className="p-8">
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-gray-800">Welcome back, {currentUser?.name?.split(' ')[0]}!</p>
          <p className="text-sm text-gray-500">You have {active} active finding{active !== 1 ? 's' : ''} requiring attention.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {stats.map((s, i) => (
            <div key={s.label} className={`${colors[i]} rounded-xl p-4 text-white`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs opacity-90">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">My Recent Findings</p>
            <button onClick={() => navigate('/user/findings')} className="text-xs text-accent font-medium hover:underline">View all →</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="px-5 py-2 font-medium">ID</th>
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-5 py-2 font-medium">Project</th>
                <th className="px-5 py-2 font-medium">Severity</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((f) => (
                <tr key={f.id} onClick={() => navigate('/user/findings')} className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <td className="px-5 py-2.5 text-accent font-medium">{f.id}</td>
                  <td className="px-5 py-2.5 text-gray-700 max-w-[220px] truncate">{f.title}</td>
                  <td className="px-5 py-2.5 text-gray-500">{projectById(f.project)?.name}</td>
                  <td className="px-5 py-2.5"><SeverityBadge severity={f.severity} /></td>
                  <td className="px-5 py-2.5"><StatusBadge status={f.status} /></td>
                  <td className="px-5 py-2.5 text-gray-500">{f.dueDate}</td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No findings assigned to you yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
