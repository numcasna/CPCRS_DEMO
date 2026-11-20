import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import FeedbackThread from '../../components/FeedbackThread'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { projectById, userById } from '../../data/mockData'

const DECISIONS = ['Reopen', 'Reject', 'Close']

export default function Resolver() {
  const { findings, updateFindingStatus } = useData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [decisions, setDecisions] = useState({})
  const [feedback, setFeedback] = useState({})
  const [errors, setErrors] = useState({})

  const pending = findings.filter((f) => f.status === 'Resolved')

  function confirmDecision(finding) {
    const decision = decisions[finding.id] || 'Reopen'
    const note = (feedback[finding.id] || '').trim()
    if (!note) {
      setErrors((prev) => ({ ...prev, [finding.id]: 'Admin feedback is required before confirming this decision.' }))
      return
    }

    updateFindingStatus(finding.id, decision, currentUser?.name || 'Admin', note, [], 'admin')
    setErrors((prev) => ({ ...prev, [finding.id]: '' }))
    setFeedback((prev) => ({ ...prev, [finding.id]: '' }))
  }

  return (
    <div>
      <Topbar title="Reopened / Resolver" />
      <div className="p-8">
        <div className="mb-5">
          <p className="text-sm text-gray-500">
            Resolved findings waiting for reviewer validation. Each decision requires mandatory admin feedback.
          </p>
        </div>

        <div className="space-y-5">
          {pending.map((finding) => (
            <div key={finding.id} className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-accent font-medium text-sm">{finding.id}</span>
                    <SeverityBadge severity={finding.severity} />
                    <StatusBadge status={finding.status} />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/findings/${finding.id}`, { state: { from: '/admin/reopened', backLabel: 'Back to Reopened' } })}
                    className="text-left text-base font-semibold text-accent hover:underline"
                  >
                    {finding.title}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    {projectById(finding.project)?.name || finding.project || '—'} · {finding.repository || '—'} · Assigned to {userById(finding.assignee)?.name || 'Unassigned'}
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  Due {finding.dueDate || '—'}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Finding Description</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{finding.description || '—'}</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                  <p className="text-xs font-medium text-accent-dark uppercase mb-2">User Feedback</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {finding.feedback || finding.history?.filter((h) => h.to === 'Resolved').at(-1)?.feedback || 'No user feedback submitted.'}
                  </p>
                </div>
              </div>

              <div className="resolver-thread">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Feedback & History</p>
                <FeedbackThread finding={finding} compact />
              </div>

              {finding.attachments?.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">User Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {finding.attachments.map((a) => (
                      <a
                        key={a.name}
                        href={a.dataUrl}
                        download={a.name}
                        className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-accent hover:border-accent/40"
                      >
                        📎 {a.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 items-start">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Decision</label>
                    <select
                      value={decisions[finding.id] || 'Reopen'}
                      onChange={(e) => setDecisions((prev) => ({ ...prev, [finding.id]: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    >
                      {DECISIONS.map((decision) => <option key={decision} value={decision}>{decision}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Admin Feedback *</label>
                    <textarea
                      value={feedback[finding.id] || ''}
                      onChange={(e) => {
                        setFeedback((prev) => ({ ...prev, [finding.id]: e.target.value }))
                        if (e.target.value.trim()) setErrors((prev) => ({ ...prev, [finding.id]: '' }))
                      }}
                      rows={2}
                      placeholder="Explain the reason for this decision..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    {errors[finding.id] && <p className="text-xs text-red-500 mt-1">{errors[finding.id]}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => confirmDecision(finding)}
                    className="sm:mt-5 bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          ))}

          {pending.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              No resolved findings are waiting for review.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
