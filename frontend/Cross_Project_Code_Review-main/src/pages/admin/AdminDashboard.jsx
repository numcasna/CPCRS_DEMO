import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import { useData } from '../../context/DataContext'
import { userById, statusOrder } from '../../data/mockData'

export default function AdminDashboard() {
  const { findings } = useData()
  const navigate = useNavigate()
  const counts = Object.fromEntries(statusOrder.map((status) => [status, findings.filter((f) => f.status === status).length]))
  const stats = statusOrder.map((status) => ({ label: status, value: counts[status] || 0 }))
  const recent = [...findings].sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0)).slice(0, 5)

  return <div><Topbar title="Dashboard"/><div className="page-container">
    <div className="page-header"><div><p className="eyebrow">ADMIN OVERVIEW</p><h2>Finding Statistics</h2><p>Current finding counts and the five most recently created findings.</p></div></div>
    <section className="dashboard-stat-grid">{stats.map((stat) => <div className="dashboard-stat-card" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</section>

    <section className="table-card dashboard-recent-card"><div className="table-heading"><div><h3>Recent 5 Findings</h3><p>Newest findings by creation date.</p></div><button onClick={() => navigate('/admin/findings')} className="text-button">View all →</button></div>
      <div className="table-wrap"><table><thead><tr><th>ID</th><th>Finding</th><th>Severity</th><th>Status</th><th>Assignee</th><th>Created</th></tr></thead><tbody>
        {recent.map((f) => <tr key={f.id}><td className="muted-strong">{f.id}</td><td><button className="table-link" onClick={() => navigate(`/admin/findings/${f.id}`, { state: { from: '/admin', backLabel: 'Back to Dashboard' } })}>{f.title}</button></td><td><SeverityBadge severity={f.severity}/></td><td><StatusBadge status={f.status}/></td><td>{userById(f.assignee)?.name || 'Unassigned'}</td><td>{f.created || '—'}</td></tr>)}
      </tbody></table></div>
    </section>
  </div></div>
}
