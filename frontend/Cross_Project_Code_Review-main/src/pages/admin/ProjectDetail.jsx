import { useParams, useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import Avatar from '../../components/Avatar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import { useData } from '../../context/DataContext'
import { userById } from '../../data/mockData'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects, findings, users } = useData()
  const project = projects.find((p) => String(p.id) === String(id))

  if (!project) {
    return (
      <div>
        <Topbar title="Project" />
        <div className="p-8">Project not found.</div>
      </div>
    )
  }

  const findUser = (userId) => {
    if (!userId) return null
    return (
      users.find((u) => String(u.id || u.user_id) === String(userId)) ||
      userById(userId)
    )
  }

  const projectFindings = findings.filter(
    (f) => String(f.projectId || f.project_id || f.project) === String(id)
  )
  const counts = ['Open', 'In Progress', 'Resolved', 'Rejected', 'Closed'].map((s) => ({
    label: s,
    count: projectFindings.filter((f) => f.status === s).length,
  }))
  const lead = findUser(project.lead || project.project_lead_id)

  return (
    <div>
      <Topbar title={project.name} />
      <div className="p-8">
        <button onClick={() => navigate('/admin/projects')} className="back-link">← Back to Projects</button>

        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex items-start justify-between mb-1">
            <p className="text-lg font-semibold text-gray-800">{project.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${project.deleted_at ? 'bg-red-100 text-red-700' : project.is_active === false ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{project.deleted_at ? 'Deleted' : project.is_active === false ? 'Inactive' : 'Active'}</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">{project.description}</p>
          {lead && <p className="text-xs text-gray-400">Project Lead: <span className="text-gray-700 font-medium">{lead.name}</span></p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Repositories ({project.repositories.length})</p>
            <ul className="space-y-2">
              {project.repositories.map((r) => {
                const repoFindingCount = projectFindings.filter(
                  (f) => String(f.repositoryId || f.repository_id || f.repository) === String(r.id || r.name)
                ).length
                return (
                  <li key={r.id || r.name} className="flex items-center justify-between text-sm">
                    <span className="text-accent flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" />{r.name}</span>
                    <span className="text-gray-400 text-xs">{repoFindingCount} findings</span>
                  </li>
                )
              })}
              {project.repositories.length === 0 && <p className="text-sm text-gray-400">No repositories yet.</p>}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Members ({project.members.length})</p>
            <ul className="space-y-3">
              {(project.members || []).map((memberEntry) => {
                const memberId =
                  typeof memberEntry === 'string'
                    ? memberEntry
                    : memberEntry?.user_id || memberEntry?.id

                const member = findUser(memberId)

                return (
                  <button
                    key={memberId}
                    onClick={() => navigate(`/admin/users/${memberId}`)}
                    className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {member?.name || memberId}
                      </p>
                      <p className="text-sm text-gray-500">
                        {member?.email || ''}
                      </p>
                    </div>

                    <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                      {member?.role || 'member'}
                    </span>
                  </button>
                )
              })}
              {project.members.length === 0 && <p className="text-sm text-gray-400">No members yet.</p>}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-3">Project Findings ({projectFindings.length})</p>
            <div className="flex flex-wrap gap-6">
              {counts.map((c) => (
                <div key={c.label} className="text-center">
                  <p className="text-lg font-semibold text-gray-800">{c.count}</p>
                  <p className="text-xs text-gray-400">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="px-5 py-2 font-medium">ID</th>
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-5 py-2 font-medium">Severity</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {projectFindings.map((f) => (
                <tr key={f.id || f.backendId} onClick={() => navigate(`/admin/findings/${f.backendId || f.id}`, { state: { from: `/admin/projects/${id}`, backLabel: 'Back to Project' } })} className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <td className="px-5 py-2.5 text-accent font-medium">{f.id}</td>
                  <td className="px-5 py-2.5 text-gray-700">{f.title}</td>
                  <td className="px-5 py-2.5"><SeverityBadge severity={f.severity} /></td>
                  <td className="px-5 py-2.5"><StatusBadge status={f.status} /></td>
                  <td className="px-5 py-2.5 text-gray-500">{findUser(f.assigneeId || f.assignee_id || f.assignee)?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
