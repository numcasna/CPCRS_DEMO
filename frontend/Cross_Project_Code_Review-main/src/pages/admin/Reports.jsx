import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import { useData } from '../../context/DataContext'
import { severityOrder, statusOrder, userById, projectById } from '../../data/mockData'

const PIE_COLORS = { 'In Progress': '#6d28d9', Open: '#7c3aed', Resolved: '#16a34a', Closed: '#111827', Reopened: '#f97316', Rejected: '#9ca3af' }

function toCSV(rows) {
  const header = ['ID', 'Title', 'Project', 'Assignee', 'Severity', 'Status', 'Due Date']
  const lines = rows.map((f) => [
    f.id,
    `"${f.title.replace(/"/g, '""')}"`,
    projectById(f.project)?.name || '',
    userById(f.assignee)?.name || 'Unassigned',
    f.severity,
    f.status,
    f.dueDate,
  ].join(','))
  return [header.join(','), ...lines].join('\n')
}

export default function Reports() {
  const { findings, projects } = useData()
  const [project, setProject] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sortByDue, setSortByDue] = useState(true)

  let filtered = findings.filter((f) => {
    if (project && f.project !== project) return false
    if (severity && f.severity !== severity) return false
    if (status && f.status !== status) return false
    if (overdueOnly && !(new Date(f.dueDate) < new Date('2026-09-27') && !['Closed', 'Rejected'].includes(f.status))) return false
    return true
  })
  if (sortByDue) filtered = [...filtered].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const total = filtered.length
  const openInProgress = filtered.filter((f) => ['Open', 'In Progress'].includes(f.status)).length
  const resolved = filtered.filter((f) => ['Resolved', 'Closed'].includes(f.status)).length
  const overdue = filtered.filter((f) => new Date(f.dueDate) < new Date('2026-09-27') && !['Closed', 'Rejected'].includes(f.status)).length

  const severityData = severityOrder.map((s) => ({ name: s, count: filtered.filter((f) => f.severity === s).length }))
  const statusCounts = {}
  filtered.forEach((f) => { statusCounts[f.status] = (statusCounts[f.status] || 0) + 1 })
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
  const projectData = projects.map((p) => ({ name: p.name.split(' ')[0], count: filtered.filter((f) => f.project === p.id).length }))
  const assigneeCounts = {}
  filtered.forEach((f) => {
    const name = userById(f.assignee)?.name || 'Unassigned'
    assigneeCounts[name] = (assigneeCounts[name] || 0) + 1
  })
  const assigneeData = Object.entries(assigneeCounts).map(([name, count]) => ({ name, count }))

  function exportCSV() {
    const csv = toCSV(filtered)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'findings-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Topbar title="Reports & Analytics" />
      <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 mr-1">Filters:</span>
            <select value={project} onChange={(e) => setProject(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
              <option value="">All Severities</option>
              {severityOrder.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
              <option value="">All Statuses</option>
              {statusOrder.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-500">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
            </label>
          </div>
          <div className="flex items-center gap-2">
            <select value={sortByDue ? 'due' : 'none'} onChange={(e) => setSortByDue(e.target.value === 'due')} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
              <option value="due">Sort by Due Date</option>
              <option value="none">Default order</option>
            </select>
            <button onClick={exportCSV} className="bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-lg">⬇ Export CSV</button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">{filtered.length} findings match current filters</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-accent rounded-xl p-4 text-white"><p className="text-2xl font-bold">{total}</p><p className="text-xs opacity-90">Total</p></div>
          <div className="bg-indigo-500 rounded-xl p-4 text-white"><p className="text-2xl font-bold">{openInProgress}</p><p className="text-xs opacity-90">Open + In Progress</p></div>
          <div className="bg-green-600 rounded-xl p-4 text-white"><p className="text-2xl font-bold">{resolved}</p><p className="text-xs opacity-90">Resolved</p></div>
          <div className="bg-red-600 rounded-xl p-4 text-white"><p className="text-2xl font-bold">{overdue}</p><p className="text-xs opacity-90">Overdue</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-4">Findings by Severity</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={severityData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityData.map((entry, i) => (<Cell key={i} fill={['#dc2626', '#f97316', '#eab308', '#3b82f6', '#9ca3af'][i]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-4">Findings by Status</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                  {pieData.map((entry, i) => (<Cell key={i} fill={PIE_COLORS[entry.name] || '#a78bfa'} />))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-4">Project-wise Findings</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={projectData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-4">Assignee-wise Findings</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={assigneeData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <p className="px-5 py-3 text-sm font-medium text-gray-700 border-b border-gray-100">Findings Table</p>
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="px-5 py-2 font-medium">ID</th>
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-5 py-2 font-medium">Project</th>
                <th className="px-5 py-2 font-medium">Assignee</th>
                <th className="px-5 py-2 font-medium">Severity</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-t border-gray-50">
                  <td className="px-5 py-2.5 text-accent font-medium">{f.id}</td>
                  <td className="px-5 py-2.5 text-gray-700 max-w-[220px] truncate">{f.title}</td>
                  <td className="px-5 py-2.5 text-gray-500">{projectById(f.project)?.name}</td>
                  <td className="px-5 py-2.5 text-gray-500">{userById(f.assignee)?.name || '—'}</td>
                  <td className="px-5 py-2.5"><SeverityBadge severity={f.severity} /></td>
                  <td className="px-5 py-2.5"><StatusBadge status={f.status} /></td>
                  <td className="px-5 py-2.5 text-gray-500">{f.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
