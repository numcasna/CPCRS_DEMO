
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import { useData } from '../../context/DataContext'
import { projectById } from '../../data/mockData'
import { apiRequest, apiRequestBlob } from '../../api/client'

function isOverdue(finding) {
  const dueDate = finding.dueDate || finding.due_date

  return Boolean(
    dueDate &&
    new Date(dueDate) < new Date() &&
    !['Closed', 'Rejected', 'Resolved'].includes(finding.status)
  )
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function FindingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { findings, projects, users, refreshFindings } = useData()

  const [finding, setFinding] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [workHistory, setWorkHistory] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [attachmentItems, setAttachmentItems] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [reassignFeedback, setReassignFeedback] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [previewItem, setPreviewItem] = useState(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const loadFinding = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await apiRequest(`/findings/${id}`)
      const assignedAt =
        result.assigned_at ||
        result.assignedDate ||
        result.created_at ||
        null
      const acceptedAt =
        result.accepted_at ||
        result.acceptedDate ||
        (result.status_history || []).find(
          (h) =>
            (h.new_status || h.status) === 'In Progress' ||
            (h.new_status || h.status) === 'in_progress',
        )?.changed_at ||
        (['In Progress', 'in_progress', 'In Review', 'in_review', 'Resolved', 'resolved', 'Closed', 'closed'].includes(result.status)
          ? (result.updated_at || result.created_at)
          : null)

      setFinding({
        ...result,
        id: result.id,
        code: result.finding_code,
        project: result.project_id,
        project_name: result.project_name,
        repository: result.repository_name || result.repository_id,
        repository_name: result.repository_name,
        label: result.category,
        assignee: result.assignee_id,
        reviewer: result.reviewer_id,
        created: result.created_at,
        dueDate: result.due_date,
        assignedDate: assignedAt,
        acceptedDate: acceptedAt,
        attachments: result.attachments || [],
      })
    } catch (err) {
      const existing = findings.find(
        (item) => String(item.id) === String(id)
      )

      if (existing) {
        setFinding(existing)
      } else {
        setError(err.message || 'Could not load finding')
      }
    } finally {
      setLoading(false)
    }
  }, [id, findings])

  useEffect(() => {
    loadFinding()
  }, [loadFinding])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')

    const requests = await Promise.allSettled([
      apiRequest(`/findings/${id}/feedback`),
      apiRequest(`/findings/${id}/work-history`),
      apiRequest(`/findings/${id}/history`),
    ])

    const [feedbackResult, workResult, statusResult] = requests
    let hadError = false

    if (feedbackResult.status === 'fulfilled') {
      setFeedback(Array.isArray(feedbackResult.value) ? feedbackResult.value : [])
    } else {
      setFeedback([])
      hadError = true
    }

    if (workResult.status === 'fulfilled') {
      setWorkHistory(Array.isArray(workResult.value) ? workResult.value : [])
    } else {
      setWorkHistory([])
      hadError = true
    }

    if (statusResult.status === 'fulfilled') {
      setStatusHistory(Array.isArray(statusResult.value) ? statusResult.value : [])
    } else {
      setStatusHistory([])
      hadError = true
    }

    if (hadError) {
      setHistoryError(
        'Some history could not be loaded. Check your project access and API response.'
      )
    }

    setHistoryLoading(false)
  }, [id])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    let cancelled = false
    async function loadAttachments() {
      try {
        const items = await apiRequest(`/findings/${id}/attachments`)
        if (!cancelled) setAttachmentItems(Array.isArray(items) ? items : [])
      } catch (err) {
        if (!cancelled) setAttachmentError(err.message || 'Could not load attachments')
      }
    }
    loadAttachments()
    return () => { cancelled = true }
  }, [id])

  async function openPreviewModal(item) {
    setPreviewItem(item)
    setPreviewLoading(true)
    setPreviewError('')
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl)
      setPreviewBlobUrl(null)
    }
    try {
      const blob = await apiRequestBlob(`/findings/${id}/attachments/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      setPreviewBlobUrl(url)
    } catch (err) {
      setPreviewError(err.message || 'Could not load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  function closePreviewModal() {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl)
      setPreviewBlobUrl(null)
    }
    setPreviewItem(null)
    setPreviewError('')
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') closePreviewModal()
    }
    if (previewItem) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [previewItem, previewBlobUrl])

  async function downloadAttachment(item) {
    try {
      const blob = await apiRequestBlob(`/findings/${id}/attachments/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = item.original_filename || item.filename || 'attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setAttachmentError(err.message || 'Download failed')
    }
  }

  async function handleAdminUpload(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setActionBusy(true)
    setAttachmentError('')
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('attachment_kind', 'evidence')
        await apiRequest(`/findings/${id}/attachments`, {
          method: 'POST',
          body: formData,
        })
      }
      const items = await apiRequest(`/findings/${id}/attachments`)
      setAttachmentItems(Array.isArray(items) ? items : [])
    } catch (err) {
      setAttachmentError(err.message || 'Could not upload attachment')
    } finally {
      setActionBusy(false)
      event.target.value = ''
    }
  }

  async function adminStatusAction(status) {
    setActionBusy(true)
    setError('')
    try {
      const updated = await apiRequest(`/findings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason: null }),
      })
      setFinding((current) => ({ ...current, ...updated, status: updated.status }))
      await loadHistory()
      if (refreshFindings) await refreshFindings()
    } catch (err) {
      setError(err.message || `Could not set status to ${status}`)
    } finally {
      setActionBusy(false)
    }
  }

  async function reassignFinding() {
    if (!reassignTo) {
      setError('Select a developer to reassign this finding to.')
      return
    }
    setActionBusy(true)
    setError('')
    try {
      const updated = await apiRequest(`/findings/${id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          assignee_id: reassignTo,
          feedback: reassignFeedback.trim() || undefined,
        }),
      })
      setFinding((current) => ({
        ...current,
        ...updated,
        status: updated.status || 'Open',
        assignee: updated.assignee_id,
        assignee_id: updated.assignee_id,
      }))
      setReassignTo('')
      setReassignFeedback('')
      await loadHistory()
      if (refreshFindings) await refreshFindings()
    } catch (err) {
      setError(err.message || 'Could not reassign finding')
    } finally {
      setActionBusy(false)
    }
  }

  const backTarget = location.state?.from
  const backLabel = location.state?.backLabel || 'Back'

  const goBack = () => {
    if (backTarget) navigate(backTarget)
    else navigate(-1)
  }

  if (loading && !finding) {
    return (
      <div>
        <Topbar title="Finding Details" />
        <div className="page-container">
          <p className="text-gray-500">Loading finding...</p>
        </div>
      </div>
    )
  }

  if (!finding) {
    return (
      <div>
        <Topbar title="Finding Details" />
        <div className="page-container">
          <p className="text-gray-500">
            {error || `Finding ${id} was not found.`}
          </p>
          <button onClick={goBack} className="back-link">
            ← {backLabel}
          </button>
        </div>
      </div>
    )
  }

  const overdue = isOverdue(finding)
  const project =
    projects?.find((item) => String(item.id) === String(finding.project)) ||
    projectById(finding.project)

  const projectMemberIds = new Set(
    (project?.members || []).map((m) =>
      typeof m === 'string' ? m : m?.user_id || m?.id
    )
  )

  const developerOptions = (users || []).filter((u) => {
    const uid = String(u.id || u.user_id)
    const isMember = projectMemberIds.size === 0 || projectMemberIds.has(uid)
    const isDev = u.role === 'developer' || !u.role
    return isMember && isDev
  })
  const selectableDevelopers = developerOptions.length > 0 ? developerOptions : (users || [])

  const findUserName = (userId) => {
    if (!userId) return '—'

    const user = users?.find(
      (item) => String(item.id) === String(userId)
    )

    return user?.name || user?.email || String(userId)
  }

  const timeline = [
    ...statusHistory.map((item) => ({
      type: 'Status change',
      id: item.id,
      timestamp: item.changed_at,
      actor: item.changed_by,
      text: `${item.old_status || 'Created'} → ${item.new_status}`,
      body: item.reason,
    })),
    ...workHistory.map((item) => ({
      type: item.entry_type || 'Work history',
      id: item.id,
      timestamp: item.created_at,
      actor: item.author_id,
      text: item.body,
      body: '',
    })),
    ...feedback.map((item) => ({
      type: 'Feedback',
      id: item.id,
      timestamp: item.created_at,
      actor: item.author_id,
      text: item.body,
      body: item.parent_feedback_id ? 'Reply to another feedback entry' : '',
    })),
  ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

  const isImageFile = (item) => {
    const name = item?.original_filename || item?.filename || ''
    return Boolean(
      item?.media_type?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)
    )
  }

  const isPdfFile = (item) => {
    const name = item?.original_filename || item?.filename || ''
    return Boolean(
      item?.media_type === 'application/pdf' ||
      /\.pdf$/i.test(name)
    )
  }

  const isResolutionAttachment = (item) => {
    if (item.attachment_kind === 'resolution') return true
    if (item.uploader_role === 'developer' || item.uploader_role === 'user') return true
    const uploader = users?.find((u) => String(u.id || u.user_id) === String(item.uploaded_by))
    return uploader?.role === 'developer'
  }

  const userAttachments = attachmentItems.filter(isResolutionAttachment)
  const adminAttachments = attachmentItems.filter((item) => !isResolutionAttachment(item))

  const renderAttachmentRow = (item) => {
    const isImage = isImageFile(item)
    const sizeKB = Math.max(1, Math.round((item.size_bytes || 0) / 1024))
    const uploader = users?.find((u) => String(u.id || u.user_id) === String(item.uploaded_by))
    const uploaderName = item.uploader_name || uploader?.name || 'Uploader'

    return (
      <div
        key={item.id}
        className="attachment-card-item"
        onClick={() => openPreviewModal(item)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 text-accent font-semibold text-xs">
            {isImage ? 'IMG' : 'DOC'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {item.original_filename || item.filename || 'Attachment'}
            </p>
            <p className="text-xs text-gray-500">
              {sizeKB} KB · {uploaderName} · {item.created_at ? new Date(item.created_at).toLocaleString() : 'Uploaded'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-accent font-semibold px-3 py-1.5 rounded-md hover:bg-purple-50 transition border border-accent/20"
          onClick={(e) => {
            e.stopPropagation()
            openPreviewModal(item)
          }}
        >
          View Attachment
        </button>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="Finding Details" />

      <div className="page-container" style={{ maxWidth: 1040 }}>
        <button onClick={goBack} className="back-link">
          ← {backLabel}
        </button>

        <section className="detail-card">
          <div className="detail-title-row">
            <div>
              <div className="finding-id-line">
                <span>{finding.code || finding.finding_code || finding.id}</span>
                <span className="muted-date">
                  Created {formatDate(finding.created)}
                </span>
                {overdue && <span className="overdue-badge">Overdue</span>}
              </div>
              <h2>{finding.title}</h2>
            </div>
            <SeverityBadge severity={finding.severity} />
          </div>

          <div className="info-grid finding-info">
            <div>
              <span>Project</span>
              <strong>
                {finding.project_name || project?.name || '—'}
              </strong>
            </div>
            <div>
              <span>Repository</span>
              <strong>
                {finding.repository_name ||
                  project?.repositories?.find(
                    (repo) => String(repo.id) === String(finding.repository)
                  )?.name ||
                  finding.repository ||
                  '—'}
              </strong>
            </div>
            <div>
              <span>Finding Label</span>
              <strong>{finding.label || '—'}</strong>
            </div>
            <div>
              <span>Assignee</span>
              <strong>{findUserName(finding.assignee) === '—'
                ? 'Unassigned'
                : findUserName(finding.assignee)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong><StatusBadge status={finding.status} /></strong>
            </div>
          </div>

          <div className="info-grid finding-info">
            <div>
              <span>Assigned Date</span>
              <strong>
                {finding.assignedDate
                  ? formatDate(finding.assignedDate)
                  : formatDate(finding.created)}
              </strong>
            </div>
            <div>
              <span>Accepted Date</span>
              <strong>
                {finding.acceptedDate
                  ? formatDate(finding.acceptedDate)
                  : 'Not accepted yet'}
              </strong>
            </div>
            <div>
              <span>Due Date</span>
              <strong className={overdue ? 'overdue-text' : ''}>
                {finding.dueDate || '—'}
              </strong>
            </div>
            <div>
              <span>Reviewer</span>
              <strong>{findUserName(finding.reviewer)}</strong>
            </div>
          </div>
        </section>

        <section className="detail-card detail-section-card">
          <h3>Finding Description</h3>
          <p className="detail-copy">{finding.description || '—'}</p>
        </section>

        <section className="detail-card detail-section-card recommendation">
          <h3>Feedback / Recommendation</h3>
          <p className="detail-copy">
            {finding.recommendation || '—'}
          </p>
        </section>

        <section className="detail-card detail-section-card">
          <div className="section-heading">
            <div>
              <h3>Feedback & History</h3>
              <p className="helper">
                Chronological discussion, status decisions and work-history entries.
              </p>
            </div>
          </div>

          {historyLoading ? (
            <p className="detail-copy">Loading feedback and history...</p>
          ) : (
            <>
              {historyError && (
                <p className="mb-3 text-sm text-red-600">{historyError}</p>
              )}

              {timeline.length === 0 ? (
                <p className="detail-copy">No feedback or history recorded.</p>
              ) : (
                <div className="space-y-4 mt-4">
                  {timeline.map((item, index) => (
                    <div
                      key={`${item.type}-${item.id || index}`}
                      className="border-l-2 border-gray-200 pl-4 py-1"
                    >
                      <p className="font-medium text-gray-900">{item.type}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {item.text || '—'}
                      </p>
                      {item.body && (
                        <p className="text-sm text-gray-500 mt-1">
                          {item.body}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(item.timestamp)}
                        {' · '}
                        {findUserName(item.actor)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Admin Attachments */}
        <section className="detail-card detail-section-card">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Admin Attachments</h3>
              <p className="text-xs text-gray-500">Initial issue attachments and files provided by admin</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-medium">
                {adminAttachments.length}
              </span>
              <label className="text-xs text-accent font-semibold px-2.5 py-1 rounded border border-accent/20 hover:bg-purple-50 cursor-pointer transition">
                + Add Attachment
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="sr-only"
                  onChange={handleAdminUpload}
                />
              </label>
            </div>
          </div>
          {attachmentError && <p className="text-sm text-red-600 mb-2">{attachmentError}</p>}
          {adminAttachments.length === 0 ? (
            <p className="detail-copy text-xs text-gray-400">No admin attachments uploaded.</p>
          ) : (
            <div className="space-y-2">
              {adminAttachments.map(renderAttachmentRow)}
            </div>
          )}
        </section>

        {/* User Attachments */}
        <section className="detail-card detail-section-card">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">User Attachments</h3>
              <p className="text-xs text-gray-500">Fix validation and evidence submitted by developers</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
              {userAttachments.length}
            </span>
          </div>
          {userAttachments.length === 0 ? (
            <p className="detail-copy text-xs text-gray-400">No user attachments uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {userAttachments.map(renderAttachmentRow)}
            </div>
          )}
        </section>

        {!['closed', 'rejected'].includes(String(finding.status).toLowerCase()) && (
          <section className="detail-card detail-section-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-1">Admin review & assignment</h3>
            <p className="detail-copy text-xs text-gray-500 mb-3">
              Manage status transitions and developer assignments for this finding.
            </p>

            {['in review', 'resolved'].includes(String(finding.status).toLowerCase()) && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <p className="text-xs text-gray-600 mb-2 font-medium">
                  This finding is ready for final review.
                </p>
                <button
                  type="button"
                  disabled={actionBusy}
                  className="primary-button"
                  onClick={() => adminStatusAction('Closed')}
                >
                  {actionBusy ? 'Saving…' : 'Close Finding'}
                </button>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Reassign Finding</p>
              <p className="text-xs text-gray-400 mb-2">
                Reassign to any project developer (including the current assignee). The status will reset to Open.
              </p>
              <div className="space-y-3">
                <select
                  value={reassignTo}
                  onChange={(event) => setReassignTo(event.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select project developer to assign...</option>
                  {selectableDevelopers.map((user) => {
                    const uid = String(user.id || user.user_id)
                    const isCurrent = uid === String(finding.assignee_id || finding.assignee)
                    return (
                      <option key={uid} value={uid}>
                        {user.full_name || user.name || user.email || uid}
                        {isCurrent ? ' (Current Assignee)' : ''}
                      </option>
                    )
                  })}
                </select>

                <textarea
                  value={reassignFeedback}
                  onChange={(e) => setReassignFeedback(e.target.value)}
                  placeholder="Feedback / reason for reassignment (explaining what needs further work)..."
                  rows={2}
                  className="field-textarea"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionBusy || !reassignTo}
                    className="secondary-button"
                    onClick={reassignFinding}
                  >
                    {actionBusy ? 'Reassigning…' : 'Reassign Finding'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      {/* Attachment Preview Modal */}
      {previewItem && (
        <div className="modal-backdrop" onClick={closePreviewModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0 pr-4">
                <h3>{previewItem.original_filename || previewItem.filename}</h3>
                <p>
                  {!isResolutionAttachment(previewItem)
                    ? 'Admin Attachment'
                    : 'User Attachment'}
                  {' · '}
                  {previewItem.uploader_name || findUserName(previewItem.uploaded_by)}
                  {' · '}
                  {Math.max(1, Math.round((previewItem.size_bytes || 0) / 1024))} KB
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closePreviewModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <span className="text-sm">Loading attachment preview…</span>
                </div>
              ) : previewError ? (
                <div className="text-center text-red-600 text-sm p-4">
                  <p>{previewError}</p>
                </div>
              ) : isImageFile(previewItem) && previewBlobUrl ? (
                <img
                  src={previewBlobUrl}
                  alt={previewItem.original_filename || 'Attachment preview'}
                  style={{ maxHeight: '68vh', maxWidth: '100%', objectFit: 'contain' }}
                  className="rounded shadow-sm"
                />
              ) : isPdfFile(previewItem) && previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewItem.original_filename}
                  style={{ width: '100%', height: '68vh', border: 'none' }}
                  className="rounded"
                />
              ) : (
                <div className="text-center p-8">
                  <p className="text-sm font-medium text-gray-700">Preview not supported for this file type.</p>
                  <p className="text-xs text-gray-400 mt-1">Click Download File below to view it.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => downloadAttachment(previewItem)}
              >
                Download File
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={closePreviewModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
