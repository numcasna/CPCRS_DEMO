
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { severityOrder, findingLabels } from '../../data/mockData'

const PAGE_SIZE = 5

function isOverdue(finding) {
  const dueDate = finding.dueDate || finding.due_date

  return Boolean(
    dueDate &&
      new Date(dueDate) < new Date() &&
      !['Closed', 'Rejected', 'Resolved'].includes(finding.status),
  )
}

function getAssigneeId(finding) {
  return (
    finding.assigneeId ||
    finding.assignee_id ||
    (typeof finding.assignee === 'object'
      ? finding.assignee?.id || finding.assignee?.user_id
      : finding.assignee)
  )
}

function getProjectId(finding) {
  return finding.projectId || finding.project_id || finding.project
}

function getFindingLabel(finding) {
  return finding.category || finding.label || ''
}

export default function UserFindings() {
  const { currentUser } = useAuth()
  const {
    findings,
    projects,
    findingsLoading,
    findingsError,
    allFindingLabels,
  } = useData()

  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [label, setLabel] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage] = useState(1)

  const currentUserId = currentUser?.userId || currentUser?.id

  // The backend already limits this list to projects the developer belongs to.
  // Show every finding in those projects, including findings assigned to teammates.
  const filtered = findings.filter(
    (finding) =>
      (!search.trim() || [finding.title, finding.id, finding.backendId, getProjectName(finding), getFindingLabel(finding)]
        .some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))) &&
      (!status || finding.status === status) &&
      (!severity || finding.severity === severity) &&
      (!label || getFindingLabel(finding) === label) &&
      (!overdueOnly || isOverdue(finding)),
  )

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE),
  )

  const safePage = Math.min(page, pageCount)

  const rows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  useEffect(() => {
    setPage(1)
  }, [search, status, severity, label, overdueOnly])

  function getProjectName(finding) {
    const projectId = getProjectId(finding)

    const project = projects.find(
      (item) => String(item.id) === String(projectId),
    )

    return project?.name || finding.project_name || '—'
  }

  return (
    <div>
      <Topbar title="Findings" search={search} onSearchChange={setSearch} />

      <div className="page-container">
        <div className="page-header">
          <div>
            <p className="eyebrow">YOUR PROJECTS</p>
            <h2>Findings</h2>
            <p>
              Review findings across every project you belong to, including items
              assigned to teammates. Status transitions are controlled by the workflow.
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All Statuses</option>
            {[
              'Open',
              'In Progress',
              'In Review',
              'Resolved',
              'Reopened',
              'Rejected',
              'Closed',
            ].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="">All Severities</option>
            {severityOrder.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          >
            <option value="">All Labels</option>
            {(allFindingLabels || findingLabels).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
            />{' '}
            Overdue only
          </label>
        </div>

        {findingsError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            Could not load findings: {findingsError}
          </p>
        )}

        <section className="table-card">
          <div className="table-heading">
            <div>
              <h3>
                {filtered.length} project finding
                {filtered.length !== 1 ? 's' : ''}
              </h3>
              <p>
                Page {safePage} of {pageCount}
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Finding</th>
                  <th>Project</th>
                  <th>Label</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Assigned Date</th>
                  <th>Accepted Date</th>
                  <th>Due Date</th>
                </tr>
              </thead>

              <tbody>
                {findingsLoading ? (
                  <tr>
                    <td colSpan="9" className="empty-cell">
                      Loading findings...
                    </td>
                  </tr>
                ) : rows.length > 0 ? (
                  rows.map((finding) => {
                    const dueDate =
                      finding.dueDate || finding.due_date

                    return (
                      <tr key={finding.backendId || finding.id}>
                        <td className="muted-strong">
                          {finding.id}
                        </td>

                        <td>
                          <button
                            className="table-link"
                            onClick={() =>
                              navigate(
                                `/user/findings/${finding.backendId || finding.id}`,
                                {
                                  state: {
                                    from: '/user/findings',
                                    backLabel: 'Back to Findings',
                                  },
                                },
                              )
                            }
                          >
                            {finding.title}
                          </button>
                        </td>

                        <td>{getProjectName(finding)}</td>

                        <td>{getFindingLabel(finding) || '—'}</td>

                        <td>
                          <SeverityBadge severity={finding.severity} />
                        </td>

                        <td>
                          <StatusBadge status={finding.status} />
                        </td>

                        <td>
                          {finding.assignedDate && !isNaN(new Date(finding.assignedDate).getTime())
                            ? new Date(finding.assignedDate).toLocaleDateString()
                            : (finding.created || '—')}
                        </td>

                        <td>
                          {finding.acceptedDate && !isNaN(new Date(finding.acceptedDate).getTime())
                            ? new Date(finding.acceptedDate).toLocaleString()
                            : 'Not accepted'}
                        </td>

                        <td
                          className={
                            isOverdue(finding) ? 'overdue-text' : ''
                          }
                        >
                          {dueDate || '—'}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="empty-cell">
                      {findingsError
                        ? 'Findings could not be loaded.'
                        : findings.length === 0
                          ? 'No findings are currently assigned to you.'
                          : 'No findings match these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              disabled={safePage === 1}
              onClick={() =>
                setPage((previous) => Math.max(1, previous - 1))
              }
            >
              Previous
            </button>

            <span>
              Page {safePage} of {pageCount}
            </span>

            <button
              disabled={safePage === pageCount}
              onClick={() =>
                setPage((previous) =>
                  Math.min(pageCount, previous + 1),
                )
              }
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
