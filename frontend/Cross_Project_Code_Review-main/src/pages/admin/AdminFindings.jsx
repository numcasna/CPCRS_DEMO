
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import Avatar from '../../components/Avatar'
import { useData } from '../../context/DataContext'
import { findingLabels, severityOrder, statusOrder } from '../../data/mockData'

const PAGE_SIZE = 5

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value
        const label = typeof option === 'string' ? option : option.label

        return (
          <option key={value} value={value}>
            {label}
          </option>
        )
      })}
    </select>
  )
}

function getAssigneeId(finding) {
  return (
    finding.assigneeId ||
    finding.assignee_id ||
    (typeof finding.assignee === 'object'
      ? finding.assignee?.id || finding.assignee?.user_id
      : finding.assignee) ||
    null
  )
}

function getProjectId(finding) {
  return (
    finding.projectId ||
    finding.project_id ||
    (typeof finding.project === 'object'
      ? finding.project?.id
      : finding.project) ||
    null
  )
}

function getFindingLabel(finding) {
  return finding.category || finding.label || ''
}

function isOverdue(finding) {
  const dueDate = finding.dueDate || finding.due_date

  return Boolean(
    dueDate &&
      new Date(dueDate) < new Date() &&
      !['Closed', 'Rejected', 'Resolved'].includes(finding.status),
  )
}

function findUser(users, userId) {
  if (!userId) return null

  return (
    users.find(
      (user) =>
        String(user.id || user.user_id) === String(userId),
    ) || null
  )
}

export default function AdminFindings() {
  const { findings, projects, users, findingsLoading, findingsError, allFindingLabels } =
    useData()

  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [project, setProject] = useState('')
  const [severity, setSeverity] = useState('')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage] = useState(1)

  const assigneeOptions = useMemo(() => {
    const ids = [
      ...new Set(findings.map(getAssigneeId).filter(Boolean)),
    ]

    return ids
      .map((id) => findUser(users, id))
      .filter(Boolean)
      .map((user) => ({
        value: String(user.id || user.user_id),
        label: user.name || user.full_name || user.email || 'Unknown user',
      }))
  }, [findings, users])

  const filtered = useMemo(
    () =>
      findings.filter((finding) => {
        const query = search.trim().toLowerCase()
        const findingId = String(finding.id || '')
        const title = String(finding.title || '')
        const projectId = getProjectId(finding)
        const assigneeId = getAssigneeId(finding)
        const findingLabel = getFindingLabel(finding)
        const projectName = projects.find((item) => String(item.id) === String(projectId))?.name || ''
        const assigneeName = findUser(users, assigneeId)?.name || findUser(users, assigneeId)?.email || ''

        if (
          query &&
          ![title, findingId, projectName, findingLabel, assigneeName]
            .some((value) => String(value || '').toLowerCase().includes(query))
        ) {
          return false
        }

        if (project && String(projectId) !== String(project)) return false
        if (severity && finding.severity !== severity) return false
        if (label && findingLabel !== label) return false
        if (status && finding.status !== status) return false

        if (
          assignee &&
          String(assigneeId) !== String(assignee)
        ) {
          return false
        }

        if (overdueOnly && !isOverdue(finding)) return false

        return true
      }),
    [findings, projects, users, search, project, severity, label, status, assignee, overdueOnly],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  const pageFindings = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  useEffect(() => {
    setPage(1)
  }, [search, project, severity, label, status, assignee, overdueOnly])

  return (
    <div>
      <Topbar title="Findings" search={search} onSearchChange={setSearch} />

      <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={project}
              onChange={setProject}
              placeholder="All Projects"
              options={projects.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />

            <Select
              value={severity}
              onChange={setSeverity}
              placeholder="All Severities"
              options={severityOrder}
            />

            <Select
              value={label}
              onChange={setLabel}
              placeholder="All Finding Labels"
              options={allFindingLabels || findingLabels}
            />

            <Select
              value={status}
              onChange={setStatus}
              placeholder="All Statuses"
              options={statusOrder}
            />

            <Select
              value={assignee}
              onChange={setAssignee}
              placeholder="All Assignees"
              options={assigneeOptions}
            />

            <label className="flex items-center gap-1.5 text-sm text-gray-500">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.target.checked)}
              />
              Overdue only
            </label>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/findings/new')}
            className="bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Create New Finding
          </button>
        </div>

        {findingsError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            Could not load findings: {findingsError}
          </p>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <p className="px-5 py-3 text-sm text-gray-400 border-b border-gray-100">
            {findingsLoading
              ? 'Loading findings...'
              : `${filtered.length} finding${filtered.length !== 1 ? 's' : ''} · Page ${safePage} of ${pageCount}`}
          </p>

          <table className="w-full text-sm min-w-[1250px]">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="px-5 py-2 font-medium">ID</th>
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-5 py-2 font-medium">Project</th>
                <th className="px-5 py-2 font-medium">Finding Label</th>
                <th className="px-5 py-2 font-medium">Assignee</th>
                <th className="px-5 py-2 font-medium">Severity</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Assigned Date</th>
                <th className="px-5 py-2 font-medium">Accepted Date</th>
                <th className="px-5 py-2 font-medium">Due Date</th>
              </tr>
            </thead>

            <tbody>
              {pageFindings.map((finding) => {
                const assigneeId = getAssigneeId(finding)
                const assignedUser = findUser(users, assigneeId)
                const projectId = getProjectId(finding)
                const projectItem = projects.find(
                  (item) => String(item.id) === String(projectId),
                )

                const findingLabel = getFindingLabel(finding)
                const createdDate =
                  finding.created ||
                  finding.created_at?.slice(0, 10) ||
                  '—'
                const dueDate = finding.dueDate || finding.due_date || '—'

                return (
                  <tr
                    key={finding.backendId || finding.id}
                    className="border-t border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-5 py-2.5 text-accent font-medium whitespace-nowrap">
                      {finding.id}
                    </td>

                    <td className="px-5 py-2.5 max-w-[260px]">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/admin/findings/${finding.backendId || finding.id}`,
                            {
                              state: {
                                from: '/admin/findings',
                                backLabel: 'Back to Findings',
                              },
                            },
                          )
                        }
                        className="text-accent font-medium text-left hover:underline truncate block max-w-[260px]"
                        title={finding.title}
                      >
                        {finding.title}
                      </button>
                    </td>

                    <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">
                      {projectItem?.name || '—'}
                    </td>

                    <td className="px-5 py-2.5 whitespace-nowrap">
                      {findingLabel ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                          {findingLabel}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-5 py-2.5">
                      {assignedUser ? (
                        <span className="flex items-center gap-2">
                          <Avatar user={assignedUser} size={22} />
                          <span className="text-gray-600 whitespace-nowrap">
                            {assignedUser.name ||
                              assignedUser.full_name ||
                              assignedUser.email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-300">
                          {assigneeId ? 'User not found' : 'Unassigned'}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-2.5">
                      <SeverityBadge severity={finding.severity} />
                    </td>

                    <td className="px-5 py-2.5">
                      <StatusBadge status={finding.status} />
                    </td>

                    <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">
                      {finding.assignedDate
                        ? (typeof finding.assignedDate === 'string' && finding.assignedDate.length > 10 && !isNaN(new Date(finding.assignedDate).getTime())
                            ? new Date(finding.assignedDate).toLocaleDateString()
                            : finding.assignedDate)
                        : (createdDate || '—')}
                    </td>

                    <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">
                      {finding.acceptedDate && !isNaN(new Date(finding.acceptedDate).getTime())
                        ? new Date(finding.acceptedDate).toLocaleString()
                        : 'Not accepted'}
                    </td>

                    <td
                      className={`px-5 py-2.5 whitespace-nowrap ${
                        isOverdue(finding)
                          ? 'text-red-600 font-medium'
                          : 'text-gray-500'
                      }`}
                    >
                      {dueDate}
                    </td>
                  </tr>
                )
              })}

              {!findingsLoading && pageFindings.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    No findings match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-gray-100">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="text-sm font-medium text-gray-600 disabled:text-gray-300"
            >
              Previous
            </button>

            <span className="text-sm text-gray-500">
              Page {safePage} of {pageCount}
            </span>

            <button
              type="button"
              disabled={safePage === pageCount}
              onClick={() =>
                setPage((value) => Math.min(pageCount, value + 1))
              }
              className="text-sm font-medium text-gray-600 disabled:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
