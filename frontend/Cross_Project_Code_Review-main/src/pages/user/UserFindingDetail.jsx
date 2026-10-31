
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import Icon from '../../components/Icon'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { apiRequest, apiRequestBlob } from '../../api/client'

const USER_ALLOWED_STATUSES = ['In Progress', 'Reopened']

function getFindingId(finding) {
  return finding.backendId || finding.id
}

function getProjectId(finding) {
  return finding.projectId || finding.project_id || finding.project
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

function getReviewerId(finding) {
  return (
    finding.reviewerId ||
    finding.reviewer_id ||
    (typeof finding.reviewer === 'object'
      ? finding.reviewer?.id || finding.reviewer?.user_id
      : finding.reviewer)
  )
}

function isOverdue(finding) {
  const dueDate = finding.dueDate || finding.due_date

  return Boolean(
    dueDate &&
      new Date(dueDate) < new Date() &&
      !['Closed', 'Rejected', 'Resolved'].includes(finding.status),
  )
}

export default function UserFindingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    findings,
    projects,
    users,
    updateFindingStatus,
  } = useData()

  const { currentUser } = useAuth()

  const currentUserId = currentUser?.userId || currentUser?.id

  // The route can contain either the backend UUID or finding code.
  const finding = findings.find(
    (item) =>
      String(item.backendId || '') === String(id) ||
      String(item.id || '') === String(id),
  )

  const projectId = finding ? getProjectId(finding) : null

  const project = finding
    ? projects.find(
        (item) => String(item.id) === String(projectId),
      ) || null
    : null

  // Project members may be UUID strings or member objects.
  const isProjectMember = Boolean(
    project &&
      project.members?.some((member) => {
        const memberId =
          typeof member === 'object'
            ? member.user_id || member.id
            : member

        return String(memberId) === String(currentUserId)
      }),
  )

  const assigneeId = finding ? getAssigneeId(finding) : null
  const reviewerId = finding ? getReviewerId(finding) : null

  const isAssignee =
    Boolean(finding) &&
    String(assigneeId) === String(currentUserId)

  const repositoryId = finding
    ? finding.repositoryId ||
      finding.repository_id ||
      finding.repository?.id
    : null

  const repository = project?.repositories?.find(
    (item) => String(item.id) === String(repositoryId),
  )

  const assigneeUser = users.find(
    (user) => String(user.id || user.user_id) === String(assigneeId),
  )

  const reviewerUser = users.find(
    (user) => String(user.id || user.user_id) === String(reviewerId),
  )

  const [feedback, setFeedback] = useState('')
  const [activityItems, setActivityItems] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploadedAttachments, setUploadedAttachments] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [previewItem, setPreviewItem] = useState(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const backendFindingId = finding?.backendId || (
    finding?.id && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(finding.id))
      ? finding.id
      : null
  )

  useEffect(() => {
    let cancelled = false

    async function loadActivity() {
      if (!backendFindingId || !isProjectMember) {
        setActivityItems([])
        setActivityLoading(false)
        return
      }

      setActivityLoading(true)
      setActivityError('')
      const results = await Promise.allSettled([
        apiRequest(`/findings/${backendFindingId}/feedback`),
        apiRequest(`/findings/${backendFindingId}/work-history`),
        apiRequest(`/findings/${backendFindingId}/history`),
      ])

      if (cancelled) return

      const [feedbackResult, workResult, statusResult] = results
      const combined = []
      let failed = false

      if (feedbackResult.status === 'fulfilled' && Array.isArray(feedbackResult.value)) {
        feedbackResult.value.forEach((item) => combined.push({
          id: `feedback-${item.id}`,
          kind: 'Feedback',
          actorId: item.author_id,
          body: item.body,
          timestamp: item.created_at,
          reply: Boolean(item.parent_feedback_id),
        }))
      } else failed = true

      if (workResult.status === 'fulfilled' && Array.isArray(workResult.value)) {
        workResult.value.forEach((item) => combined.push({
          id: `work-${item.id}`,
          kind: item.entry_type || 'Work history',
          actorId: item.author_id,
          body: item.body,
          timestamp: item.created_at,
          reply: false,
        }))
      } else failed = true

      if (statusResult.status === 'fulfilled' && Array.isArray(statusResult.value)) {
        statusResult.value.forEach((item) => combined.push({
          id: `status-${item.id}`,
          kind: 'Status change',
          actorId: item.changed_by,
          body: `${item.old_status || 'Created'} → ${item.new_status}${item.reason ? ` — ${item.reason}` : ''}`,
          timestamp: item.changed_at,
          reply: false,
        }))
      } else failed = true

      combined.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
      setActivityItems(combined)
      if (failed) setActivityError('Some activity could not be loaded. Please refresh and try again.')
      setActivityLoading(false)
    }

    loadActivity()
    return () => { cancelled = true }
  }, [backendFindingId, isProjectMember, finding?.status])

  useEffect(() => {
    let cancelled = false

    async function loadAttachments() {
      if (!backendFindingId || !isProjectMember) return
      try {
        const result = await apiRequest(
          `/findings/${backendFindingId}/attachments`,
        )
        if (!cancelled) {
          setUploadedAttachments(Array.isArray(result) ? result : [])
          setAttachmentError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setAttachmentError(loadError.message || 'Could not load attachments.')
        }
      }
    }

    loadAttachments()
    return () => {
      cancelled = true
    }
  }, [backendFindingId, isProjectMember, finding?.status])

  async function openPreviewModal(item) {
    setPreviewItem(item)
    setPreviewLoading(true)
    setPreviewError('')
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl)
      setPreviewBlobUrl(null)
    }
    try {
      const blob = await apiRequestBlob(
        item.download_url || `/findings/${backendFindingId}/attachments/${item.id}/download`,
      )
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

  async function downloadAttachment(attachment) {
    try {
      const blob = await apiRequestBlob(
        attachment.download_url || `/findings/${backendFindingId}/attachments/${attachment.id}/download`,
      )
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = attachment.original_filename || attachment.filename || 'attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (downloadError) {
      setAttachmentError(downloadError.message || 'Could not download attachment.')
    }
  }

  if (!finding || !isProjectMember) {
    return (
      <div>
        <Topbar title="Finding Details" />
        <div className="page-container">
          <div className="empty-state">
            This finding is not available to your account.
          </div>
        </div>
      </div>
    )
  }

  const canResolve =
    isAssignee && USER_ALLOWED_STATUSES.includes(finding.status)

  const canAccept = isAssignee && finding.status === 'Open'
  const overdue = isOverdue(finding)

  const backTarget = location.state?.from
  const backLabel = location.state?.backLabel || 'Back'

  function goBack() {
    if (backTarget) {
      navigate(backTarget)
    } else {
      navigate(-1)
    }
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || [])
    files.forEach((file) => {
      setAttachments((previous) => [
        ...previous,
        {
          name: file.name,
          type: file.type,
          size: file.size,
          file: file,
        },
      ])
    })
    event.target.value = ''
  }

  function acceptFinding() {
    updateFindingStatus(
      getFindingId(finding),
      'In Progress',
      currentUser?.name || currentUser?.email || 'Developer',
      '',
      [],
      'user',
    )
  }

  async function resolveFinding() {
    const note = feedback.trim()

    if (!note) {
      setError(
        'Please add feedback describing the work completed before submitting this finding.',
      )
      return
    }

    try {
      setActionBusy(true)
      setError('')

      for (const item of attachments) {
        if (item.file) {
          const formData = new FormData()
          formData.append('file', item.file)
          formData.append('attachment_kind', 'resolution')
          await apiRequest(`/findings/${backendFindingId}/attachments`, {
            method: 'POST',
            body: formData,
          })
        }
      }

      await updateFindingStatus(
        getFindingId(finding),
        'In Review',
        currentUser?.name || currentUser?.email || 'Developer',
        note,
        [],
        'user',
      )

      setFeedback('')
      setAttachments([])
      const refreshed = await apiRequest(`/findings/${backendFindingId}/attachments`)
      setUploadedAttachments(Array.isArray(refreshed) ? refreshed : [])
    } catch (err) {
      setError(err.message || 'Could not submit finding for review.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleUserDirectUpload(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setActionBusy(true)
    setAttachmentError('')
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('attachment_kind', 'resolution')
        await apiRequest(`/findings/${backendFindingId}/attachments`, {
          method: 'POST',
          body: formData,
        })
      }
      const refreshed = await apiRequest(`/findings/${backendFindingId}/attachments`)
      setUploadedAttachments(Array.isArray(refreshed) ? refreshed : [])
    } catch (uploadErr) {
      setAttachmentError(uploadErr.message || 'Could not upload attachment.')
    } finally {
      setActionBusy(false)
      event.target.value = ''
    }
  }

  const findingLabel = finding.category || finding.label || '—'
  const dueDate = finding.dueDate || finding.due_date
  const createdDate = finding.created || finding.created_at?.slice(0, 10) || '—'

  const isResolutionAttachment = (item) => {
    if (item.attachment_kind === 'resolution') return true
    if (item.uploader_role === 'developer' || item.uploader_role === 'user') return true
    const uploader = users?.find((u) => String(u.id || u.user_id) === String(item.uploaded_by))
    return uploader?.role === 'developer'
  }

  const userAttachments = uploadedAttachments.filter(isResolutionAttachment)
  const adminAttachments = uploadedAttachments.filter((item) => !isResolutionAttachment(item))

  const renderAttachmentRow = (item) => {
    const isImage = isImageFile(item)
    const sizeKB = Math.max(1, Math.round((item.size_bytes || 0) / 1024))
    const uploader = users?.find((u) => String(u.id || u.user_id) === String(item.uploaded_by))
    const uploaderName = item.uploader_name || uploader?.name || 'Team member'

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
        <button className="back-link" onClick={goBack}>
          ← {backLabel}
        </button>

        <section className="detail-card">
          <div className="detail-title-row">
            <div>
              <div className="finding-id-line">
                <span>{finding.id}</span>
                {overdue && (
                  <span className="overdue-badge">Overdue</span>
                )}
              </div>

              <h2>{finding.title}</h2>
            </div>

            <SeverityBadge severity={finding.severity} />
          </div>

          {!isAssignee && (
            <div className="read-only-notice">
              You are viewing a teammate's finding. Project membership
              gives you view access only; assignment, severity, label,
              status and admin actions cannot be changed here.
            </div>
          )}

          <div className="info-grid finding-info">
            <div>
              <span>Project</span>
              <strong>{project?.name || '—'}</strong>
            </div>

            <div>
              <span>Repository</span>
              <strong>
                {repository?.name ||
                  finding.repository_name ||
                  (typeof finding.repository === 'string'
                    ? finding.repository
                    : '—')}
              </strong>
            </div>

            <div>
              <span>Finding Label</span>
              <strong>{findingLabel}</strong>
            </div>

            <div>
              <span>Assigned To</span>
              <strong>
                {assigneeUser?.name ||
                  assigneeUser?.full_name ||
                  assigneeUser?.email ||
                  'Assigned user'}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                <StatusBadge status={finding.status} />
              </strong>
            </div>
          </div>

          <div className="info-grid finding-info">
            <div>
              <span>Created Date</span>
              <strong>{createdDate}</strong>
            </div>

            <div>
              <span>Accepted Date</span>
              <strong>
                {finding.acceptedDate && !isNaN(new Date(finding.acceptedDate).getTime())
                  ? new Date(finding.acceptedDate).toLocaleString()
                  : 'Not accepted'}
              </strong>
            </div>

            <div>
              <span>Due Date</span>
              <strong className={overdue ? 'overdue-text' : ''}>
                {dueDate || '—'}
              </strong>
            </div>

            <div>
              <span>Reviewer</span>
              <strong>
                {reviewerUser?.name ||
                  reviewerUser?.full_name ||
                  reviewerUser?.email ||
                  '—'}
              </strong>
            </div>
          </div>

          {canAccept && (
            <div className="action-banner">
              <div>
                <strong>Ready to start?</strong>
                <span>
                  Accepting this finding moves it from Open to In
                  Progress and records the Accepted Date.
                </span>
              </div>

              <button
                className="btn btn-primary"
                onClick={acceptFinding}
              >
                <Icon name="check" size={16} /> Accept
              </button>
            </div>
          )}
        </section>

        <section className="detail-card detail-section-card">
          <h3>Finding Description</h3>
          <p className="detail-copy">
            {finding.description || '—'}
          </p>
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
              <h3>Feedback Thread</h3>
              <p className="helper">
                Chronological feedback, status decisions, responses and
                associated attachments.
              </p>
            </div>
          </div>

          {activityLoading ? (
            <p className="detail-copy">Loading shared feedback and history...</p>
          ) : (
            <>
              {activityError && <p role="alert" className="mb-3 text-sm text-red-600">{activityError}</p>}
              {activityItems.length === 0 ? (
                <p className="detail-copy">No feedback or history recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {activityItems.map((item) => {
                    const author = users.find((user) => String(user.id || user.user_id) === String(item.actorId))
                    const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Date unavailable'
                    return (
                      <article key={item.id} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>{item.kind}{item.reply ? ' · Reply' : ''}</strong>
                          <span className="text-xs text-gray-500">{timestamp}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{author?.name || author?.full_name || author?.email || item.actorId || 'System'}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.body}</p>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {canResolve && (
          <section className="detail-card detail-section-card">
            <h3>Submit for Review</h3>

            <p className="helper">
              Add comments and optional attachments explaining the fix
              before submitting it for review.
            </p>

            <textarea
              value={feedback}
              onChange={(event) => {
                setFeedback(event.target.value)
                if (event.target.value.trim()) setError('')
              }}
              rows={4}
              placeholder="Describe the fix, validation, test results, or remaining context..."
              className="field-textarea"
            />

            <label className="file-input-label">
              Attachments
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
              />
            </label>

            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`}>
                    <Icon name="file" size={16} />
                    <span>{attachment.name}</span>

                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((previous) =>
                          previous.filter(
                            (_, attachmentIndex) =>
                              attachmentIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <button
              className="btn btn-primary"
              type="button"
              onClick={resolveFinding}
            >
              Submit for Review
            </button>
          </section>
        )}

        {/* Admin Attachments */}
        <section className="detail-card detail-section-card">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Admin Attachments</h3>
              <p className="text-xs text-gray-500">Initial issue attachments and files provided by admin</p>
            </div>
            <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-medium">
              {adminAttachments.length}
            </span>
          </div>
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
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                {userAttachments.length}
              </span>
              <label className="text-xs text-accent font-semibold px-2.5 py-1 rounded border border-accent/20 hover:bg-purple-50 cursor-pointer transition">
                + Add Attachment
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="sr-only"
                  onChange={handleUserDirectUpload}
                />
              </label>
            </div>
          </div>
          {attachmentError && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {attachmentError}
            </p>
          )}
          {userAttachments.length === 0 ? (
            <p className="detail-copy text-xs text-gray-400">No user attachments uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {userAttachments.map(renderAttachmentRow)}
            </div>
          )}
        </section>
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
                  {previewItem.uploader_name || users.find((u) => String(u.id || u.user_id) === String(previewItem.uploaded_by))?.name || 'Team member'}
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
                className="btn btn-secondary"
                onClick={() => downloadAttachment(previewItem)}
              >
                Download File
              </button>
              <button
                type="button"
                className="btn btn-primary"
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
