
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import { useData } from '../../context/DataContext'
import { findingLabels, severityOrder } from '../../data/mockData'
import { apiRequest } from '../../api/client'

export default function CreateFinding() {
  const {
    addFinding,
    projects,
    users,
    allFindingLabels,
    saveCustomLabel,
  } = useData()

  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [repository, setRepository] = useState('')
  const [assignee, setAssignee] = useState('')
  const [severity, setSeverity] = useState('')
  const [label, setLabel] = useState('')
  const [isCustomLabel, setIsCustomLabel] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedProject = projects.find(
    (project) => String(project.id) === String(projectId),
  )

  // Get real users who belong to the selected project.
  const projectMembers = (selectedProject?.members || [])
    .map((member) => {
      const memberId =
        typeof member === 'object'
          ? member.user_id || member.id
          : member

      const user = users.find(
        (item) =>
          String(item.id || item.user_id) === String(memberId),
      )

      if (!user) return null

      return {
        ...user,
        id: user.id || user.user_id,
      }
    })
    .filter(Boolean)
    .filter(
      (user, index, list) =>
        list.findIndex(
          (item) => String(item.id) === String(user.id),
        ) === index,
    )

  function handleFileChange(event) {
    const files = Array.from(event.target.files || [])
    setAttachments((previous) => [
      ...previous,
      ...files.filter(
        (file) =>
          !previous.some(
            (existing) =>
              existing.name === file.name &&
              existing.size === file.size &&
              existing.lastModified === file.lastModified,
          ),
      ),
    ])
    event.target.value = ''
  }

  function removeAttachment(name, lastModified) {
    setAttachments((previous) =>
      previous.filter(
        (attachment) =>
          !(attachment.name === name && attachment.lastModified === lastModified),
      ),
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (saving) return

    const finalLabel = (isCustomLabel ? customLabel : label).trim()

    if (
      !title.trim() ||
      !projectId ||
      !repository ||
      !assignee ||
      !severity ||
      !finalLabel ||
      !dueDate ||
      !description.trim()
    ) {
      setError('Please fill in all required fields marked with *.')
      return
    }

    if (!selectedProject) {
      setError('Please select a valid project.')
      return
    }

    const selectedRepository = selectedProject.repositories?.find(
      (item) => String(item.id) === String(repository),
    )

    if (!selectedRepository) {
      setError('Please select a valid repository.')
      return
    }

    const selectedAssignee = projectMembers.find(
      (member) => String(member.id) === String(assignee),
    )

    if (!selectedAssignee) {
      setError('The selected assignee must be a member of this project.')
      return
    }

    if (saveCustomLabel) {
      saveCustomLabel(finalLabel)
    }

    setSaving(true)

    try {
      const newFinding = await addFinding({
        title: title.trim(),
        project_id: projectId,
        repository_id: selectedRepository.id,
        assignee_id: selectedAssignee.id,
        severity,
        category: finalLabel,
        due_date: dueDate,
        description: description.trim(),
        branch_name: selectedRepository.branch_name || null,
      })

      const backendFindingId =
        newFinding.backendId ||
        newFinding.backend_id ||
        newFinding.uuid ||
        (typeof newFinding.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(newFinding.id)
          ? newFinding.id
          : null)

      if (attachments.length && !backendFindingId) {
        throw new Error(
          'The finding was created, but its backend ID was not returned, so attachments could not be uploaded. Please refresh the findings list before trying again.',
        )
      }

      for (const file of attachments) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('attachment_kind', 'evidence')

        await apiRequest(
          `/findings/${backendFindingId}/attachments`,
          {
            method: 'POST',
            body: formData,
          },
        )
      }

      navigate(`/admin/findings/${newFinding.id}`, {
        state: {
          from: '/admin/findings',
          backLabel: 'Back to Findings',
        },
      })
    } catch (submitError) {
      setError(
        submitError.message || 'Could not create the finding.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Topbar title="Create New Finding" />

      <div className="max-w-2xl p-8">
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <p className="mb-6 text-sm text-gray-400">
            Finding ID:{' '}
            <span className="font-medium text-accent">
              Generated when saved
            </span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Finding Title *
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Brief description of the finding"
                maxLength={250}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Project *
                </label>

                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value)
                    setRepository('')
                    setAssignee('')
                  }}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select project...</option>

                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Repository *
                </label>

                <select
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  disabled={!selectedProject}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                >
                  <option value="">
                    {selectedProject
                      ? 'Select repository...'
                      : 'Select project first'}
                  </option>

                  {(selectedProject?.repositories || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Assignee *
                </label>

                <select
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  disabled={!selectedProject}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                >
                  <option value="">
                    {!selectedProject
                      ? 'Select project first'
                      : projectMembers.length
                        ? 'Select assignee...'
                        : 'No project members available'}
                  </option>

                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name ||
                        member.full_name ||
                        member.email ||
                        member.id}
                      {member.email &&
                      member.name &&
                      member.email !== member.name
                        ? ` (${member.email})`
                        : ''}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-gray-400">
                  Only members of the selected project can be assigned.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Severity *
                </label>

                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Select severity...</option>

                  {severityOrder.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Finding Label *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isCustomLabel
                    setIsCustomLabel(next)
                    if (next) {
                      setLabel(customLabel || '')
                    } else {
                      setLabel('')
                    }
                  }}
                  className="text-xs text-accent hover:underline font-semibold cursor-pointer"
                >
                  {isCustomLabel ? '← Choose from standard list' : '+ Type custom label'}
                </button>
              </div>

              {isCustomLabel ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(event) => {
                      setCustomLabel(event.target.value)
                      setLabel(event.target.value)
                    }}
                    placeholder="Type custom finding label (e.g. Memory Leak, Race Condition)..."
                    required
                    maxLength={100}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none bg-white"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400">
                    Type a custom label. It will be saved and available for future findings.
                  </p>
                </div>
              ) : (
                <select
                  value={label}
                  onChange={(event) => {
                    if (event.target.value === '__CUSTOM__') {
                      setIsCustomLabel(true)
                      setLabel(customLabel || '')
                    } else {
                      setLabel(event.target.value)
                    }
                  }}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none bg-white"
                >
                  <option value="">Select finding label...</option>

                  {(allFindingLabels || findingLabels).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value="__CUSTOM__" className="font-semibold text-accent">
                    + Add Custom Label (type your own)...
                  </option>
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Due Date *
              </label>

              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Finding Description *
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Detail the finding, affected code, and potential impact..."
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Feedback / Recommendation
              </label>

              <textarea
                value={recommendation}
                onChange={(event) => setRecommendation(event.target.value)}
                rows={3}
                placeholder="Actionable recommendations for fixing the issue..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />

              <p className="mt-1 text-xs text-gray-400">
                Recommendation persistence is not yet connected to the backend.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Attachments
              </label>

              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20"
              />

              <p className="mt-1 text-xs text-gray-400">
                Files are uploaded securely when you create the finding. Each file must be 10 MB or smaller.
              </p>

              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachments.map((attachment, index) => (
                    <li
                      key={`${attachment.name}-${attachment.lastModified}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {attachment.type?.startsWith('image/') ? (
                          <span className="text-gray-400">🖼️</span>
                        ) : (
                          <span className="text-gray-400">📄</span>
                        )}

                        <span className="truncate text-gray-700">
                          {attachment.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.name, attachment.lastModified)}
                        className="ml-3 shrink-0 text-xs text-gray-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Create Finding'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/findings')}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-500 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
