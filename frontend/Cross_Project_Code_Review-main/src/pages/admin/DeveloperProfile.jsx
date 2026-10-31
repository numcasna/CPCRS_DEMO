
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../../api/client'

export default function DeveloperProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [contributions, setContributions] = useState(null)
  const [contributionsError, setContributionsError] = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(currentUser?.role === 'admin' ? '/admin/projects' : '/user/projects')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setLoading(true)
      setError('')
      setContributionsError('')
      setProfile(null)
      setContributions(null)

      try {
        const result = await apiRequest(`/users/${id}`)

        if (!cancelled) {
          setProfile(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load user profile')
        }
      }

      try {
        const contributionResult = await apiRequest(
          `/users/${id}/contributions`
        )

        if (!cancelled) {
          setContributions(contributionResult)
        }
      } catch (err) {
        if (!cancelled) {
          setContributionsError(
            err.message || 'Could not load contribution data'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div>
        <Topbar title="Developer Profile" search="" onSearchChange={() => {}} />
        <div className="p-8">Loading profile...</div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div>
        <Topbar title="Developer Profile" search="" onSearchChange={() => {}} />
        <div className="p-8">
          <button
            onClick={handleBack}
            className="text-blue-600 mb-4 hover:underline"
          >
            ← Back
          </button>
          <p className="text-red-600">{error || 'User not found'}</p>
        </div>
      </div>
    )
  }

  const openFinding = (findingId) => {
    if (findingId) {
      const isAdmin = currentUser?.role === 'admin'
      const targetBase = isAdmin ? '/admin/findings' : '/user/findings'
      const fromBase = isAdmin ? `/admin/users/${id}` : `/user/users/${id}`
      navigate(`${targetBase}/${findingId}`, {
        state: {
          from: fromBase,
          backLabel: 'Back to Developer Profile',
        },
      })
    }
  }

  const statusNames = [
    'Open',
    'In Progress',
    'Resolved',
    'Reopened',
    'Rejected',
    'Closed',
  ]

  return (
    <div>
      <Topbar
        title="Developer Profile"
        search=""
        onSearchChange={() => {}}
      />

      <div className="p-8 space-y-6">
        <button
          onClick={handleBack}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back
        </button>

        {/* Developer details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {profile.name}
          </h2>
          <p className="text-gray-500 mt-1">{profile.email}</p>
          <p className="text-sm text-gray-500 mt-2 capitalize">
            {profile.role}
          </p>
        </section>

        {contributionsError && (
          <section className="rounded-xl border border-red-200 bg-white p-5">
            <p className="text-sm text-red-600">
              Could not load contribution data: {contributionsError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          </section>
        )}

        {!contributionsError && contributions && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Developer Contributions
            </h2>

            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Currently Assigned</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {contributions.workload?.currently_assigned ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Overdue Findings</p>
                <p className="mt-2 text-3xl font-bold text-red-600">
                  {contributions.workload?.overdue ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">
                  Unique Findings Resolved
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {contributions.resolution_summary?.unique_findings_resolved ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Resolution Events</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {contributions.resolution_summary?.resolution_events ?? 0}
                </p>
              </div>
            </div>

            {/* Current assigned findings by status */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">
                Current Assigned Findings by Status
              </h3>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {statusNames.map((status) => (
                  <div key={status} className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">{status}</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      {contributions.workload?.status_counts?.[status] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Overdue findings */}
            {(contributions.workload?.overdue_findings?.length ?? 0) > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-4 font-semibold text-gray-900">
                  Overdue Findings
                </h3>

                <div className="space-y-3">
                  {contributions.workload.overdue_findings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-4"
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => openFinding(finding.finding_id)}
                          className="text-left font-medium text-blue-600 hover:underline"
                        >
                          {finding.finding_code || 'Finding'} — {finding.title}
                        </button>
                        <p className="mt-1 text-sm text-gray-500">
                          Status: {finding.status}
                        </p>
                      </div>
                      <p className="text-sm text-red-600">
                        Due: {finding.due_date || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Resolution history */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">
                Resolution History
              </h3>

              {(contributions.resolution_summary?.events?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500">
                  No recorded resolution events for this developer.
                </p>
              ) : (
                <div className="space-y-4">
                  {contributions.resolution_summary.events.map((event, index) => (
                    <div
                      key={`${event.finding_id}-${event.resolved_at}-${index}`}
                      className="rounded-lg border border-gray-100 p-4"
                    >
                      <button
                        type="button"
                        onClick={() => openFinding(event.finding_id)}
                        className="text-left font-medium text-blue-600 hover:underline"
                      >
                        {event.finding_code} — {event.title}
                      </button>

                      <p className="mt-1 text-sm text-gray-500">
                        Resolved: {new Date(event.resolved_at).toLocaleString()}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        Creation to resolution: {event.resolution_time_days} days
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Activity timeline */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">
                Activity Timeline
              </h3>

              {(contributions.timeline?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500">
                  No recorded activity yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {contributions.timeline.map((item, index) => (
                    <div
                      key={`${item.type}-${item.finding_id}-${item.timestamp}-${index}`}
                      className="border-l-2 border-gray-200 pl-4"
                    >
                      <button
                        type="button"
                        onClick={() => openFinding(item.finding_id)}
                        className="text-left font-medium text-blue-600 hover:underline"
                      >
                        {item.finding_code || 'Finding'} — {item.title}
                      </button>

                      <p className="mt-1 text-sm text-gray-600">
                        {item.type === 'status_change'
                          ? `Status: ${item.old_status || 'Created'} → ${item.new_status}`
                          : item.type === 'work_history'
                            ? `Work history: ${item.entry_type}`
                            : item.type === 'feedback'
                              ? 'Feedback added'
                              : item.type === 'attachment'
                                ? `Attachment uploaded: ${item.filename}`
                                : item.type}
                      </p>

                      {item.body && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                          {item.body}
                        </p>
                      )}

                      {item.reason && (
                        <p className="mt-1 text-sm text-gray-500">
                          Reason: {item.reason}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
