
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import Icon from '../../components/Icon'

export default function UserProjects() {
  const { currentUser } = useAuth()

  const {
    projects,
    findings,
    users,
    addProject,
    projectsLoading,
    projectsError,
  } = useData()

  const navigate = useNavigate()

  const [showForm, setShowForm] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [leadId, setLeadId] = useState('')
  const [memberIds, setMemberIds] = useState([])
  const [repositories, setRepositories] = useState([
    {
      name: '',
      repository_url: '',
      branch_name: '',
      technology: '',
    },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const mine = useMemo(
    () =>
      projects.filter((project) => {
        const isMine = project.is_active !== false && !project.deleted_at && project.members?.some(
          (memberId) => String(memberId) === String(currentUser?.userId),
        )
        const q = projectSearch.trim().toLowerCase()
        const matchesSearch = !q || [project.name, project.description, project.id]
          .some((value) => String(value || '').toLowerCase().includes(q))
        return isMine && matchesSearch
      }),
    [projects, currentUser, projectSearch],
  )

  const availableUsers = useMemo(
    () =>
      users.filter((user) => user.is_active !== false),
    [users],
  )

  function resetForm() {
    setName('')
    setDescription('')
    setLeadId('')
    setMemberIds([])
    setRepositories([
      {
        name: '',
        repository_url: '',
        branch_name: '',
        technology: '',
      },
    ])
    setError('')
  }

  function toggleMember(userId) {
    setMemberIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    )
  }

  function updateRepository(index, field, value) {
    setRepositories((previous) =>
      previous.map((repository, repositoryIndex) =>
        repositoryIndex === index
          ? { ...repository, [field]: value }
          : repository,
      ),
    )
  }

  function addRepositoryRow() {
    setRepositories((previous) => [
      ...previous,
      {
        name: '',
        repository_url: '',
        branch_name: '',
        technology: '',
      },
    ])
  }

  function removeRepositoryRow(index) {
    setRepositories((previous) =>
      previous.length === 1
        ? [
            {
              name: '',
              repository_url: '',
              branch_name: '',
              technology: '',
            },
          ]
        : previous.filter(
            (_, repositoryIndex) => repositoryIndex !== index,
          ),
    )
  }

  async function handleCreateProject(event) {
    event.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter a project name.')
      return
    }

    if (!currentUser?.userId) {
      setError('Your session has expired. Please log in again.')
      return
    }

    const selectedLeadId = leadId || currentUser.userId

    if (
      !availableUsers.some(
        (user) =>
          String(user.id || user.user_id) === String(selectedLeadId),
      )
    ) {
      setError('Please select a valid project lead.')
      return
    }

    const validRepositories = repositories.filter(
      (repository) => repository.name.trim(),
    )

    const hasIncompleteRepository = repositories.some(
      (repository) =>
        !repository.name.trim() &&
        (repository.repository_url.trim() ||
          repository.branch_name.trim() ||
          repository.technology.trim()),
    )

    if (hasIncompleteRepository) {
      setError(
        'Enter a repository name for each repository row you have started, or clear its other fields.',
      )
      return
    }

    const invalidUrl = validRepositories.find((repository) => {
      if (!repository.repository_url.trim()) return false

      try {
        const url = new URL(repository.repository_url.trim())
        return url.protocol !== 'http:' && url.protocol !== 'https:'
      } catch {
        return true
      }
    })

    if (invalidUrl) {
      setError('Repository URLs must start with https:// or http://.')
      return
    }

    try {
      setSaving(true)

      const project = await addProject({
        name: name.trim(),
        description: description.trim(),
        project_lead_id: selectedLeadId,
        member_ids: memberIds,
        repositories: validRepositories,
      })

      resetForm()
      setShowForm(false)

      navigate(`/user/projects/${project.id}`)
    } catch (err) {
      setError(err.message || 'Unable to create the project.')
    } finally {
      setSaving(false)
    }
  }

  function getLeadName(project) {
    const projectLeadId = project.lead || project.project_lead_id

    const lead = users.find(
      (user) =>
        String(user.id || user.user_id) === String(projectLeadId),
    )

    return lead?.name || lead?.full_name || lead?.email || '—'
  }

  return (
    <div>
      <Topbar title="Projects" search={projectSearch} onSearchChange={setProjectSearch} />

      <div className="page-container">
        <div className="page-header">
          <div>
            <p className="eyebrow">WORKSPACE</p>
            <h2>Your Projects</h2>
            <p>
              Create projects or access projects where you are a member.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm()
              }
              setShowForm((previous) => !previous)
            }}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ Create Project'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateProject}
            className="mb-6 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h3 className="mb-4 text-lg font-semibold">
              Create a new project
            </h3>

            {/* Project name */}
            <div className="mb-4">
              <label
                htmlFor="project-name"
                className="mb-1 block text-sm font-medium"
              >
                Project name *
              </label>

              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter project name"
                maxLength={200}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            {/* Project description */}
            <div className="mb-5">
              <label
                htmlFor="project-description"
                className="mb-1 block text-sm font-medium"
              >
                Description
              </label>

              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe your project"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            {/* Project lead */}
            <div className="mb-5">
              <label
                htmlFor="project-lead"
                className="mb-1 block text-sm font-medium"
              >
                Project lead *
              </label>

              <select
                id="project-lead"
                value={leadId || currentUser?.userId || ''}
                onChange={(event) => setLeadId(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {!availableUsers.some(
                  (user) =>
                    String(user.id || user.user_id) ===
                    String(leadId || currentUser?.userId),
                ) && (
                  <option value="" disabled>
                    Select a project lead
                  </option>
                )}

                {availableUsers.map((user) => {
                  const id = user.id || user.user_id

                  return (
                    <option key={id} value={id}>
                      {user.name || user.full_name || user.email || id}
                      {String(id) === String(currentUser?.userId)
                        ? ' (You)'
                        : ''}
                    </option>
                  )
                })}
              </select>

              <p className="mt-1 text-xs text-gray-500">
                The selected project lead will automatically become a
                project member.
              </p>
            </div>

            {/* Team members */}
            <div className="mb-6">
              <h4 className="mb-2 text-sm font-semibold">
                Team members
              </h4>

              <p className="mb-3 text-xs text-gray-500">
                Select all developers who should have access to this
                project. The creator and project lead are included
                automatically.
              </p>

              {availableUsers.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No active users are available. Check the backend user
                  list and your login session.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
                  {availableUsers.map((user) => {
                    const id = user.id || user.user_id
                    const isCurrentUser =
                      String(id) === String(currentUser?.userId)

                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={
                            memberIds.includes(id) || isCurrentUser
                          }
                          disabled={isCurrentUser}
                          onChange={() => toggleMember(id)}
                          className="h-4 w-4"
                        />

                        <span>
                          {user.name ||
                            user.full_name ||
                            user.email ||
                            id}
                          {isCurrentUser ? ' (You)' : ''}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Repositories */}
            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold">Repositories</h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Add one or more repositories for this project.
                    Repository names are required for each completed row.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addRepositoryRow}
                  className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  + Add repository
                </button>
              </div>

              <div className="space-y-4">
                {repositories.map((repository, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h5 className="text-sm font-medium">
                        Repository {index + 1}
                      </h5>

                      <button
                        type="button"
                        onClick={() => removeRepositoryRow(index)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`repository-name-${index}`}
                          className="mb-1 block text-sm"
                        >
                          Repository name
                        </label>

                        <input
                          id={`repository-name-${index}`}
                          type="text"
                          value={repository.name}
                          onChange={(event) =>
                            updateRepository(
                              index,
                              'name',
                              event.target.value,
                            )
                          }
                          placeholder="e.g. frontend"
                          maxLength={200}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`repository-url-${index}`}
                          className="mb-1 block text-sm"
                        >
                          Repository URL
                        </label>

                        <input
                          id={`repository-url-${index}`}
                          type="url"
                          value={repository.repository_url}
                          onChange={(event) =>
                            updateRepository(
                              index,
                              'repository_url',
                              event.target.value,
                            )
                          }
                          placeholder="https://github.com/org/repo"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`repository-branch-${index}`}
                          className="mb-1 block text-sm"
                        >
                          Branch
                        </label>

                        <input
                          id={`repository-branch-${index}`}
                          type="text"
                          value={repository.branch_name}
                          onChange={(event) =>
                            updateRepository(
                              index,
                              'branch_name',
                              event.target.value,
                            )
                          }
                          placeholder="e.g. main"
                          maxLength={255}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`repository-technology-${index}`}
                          className="mb-1 block text-sm"
                        >
                          Technology
                        </label>

                        <input
                          id={`repository-technology-${index}`}
                          type="text"
                          value={repository.technology}
                          onChange={(event) =>
                            updateRepository(
                              index,
                              'technology',
                              event.target.value,
                            )
                          }
                          placeholder="e.g. React, Python, FastAPI"
                          maxLength={100}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-600">{error}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Project'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && !showForm && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        {projectsError && (
          <p className="mb-4 text-sm text-red-600">{projectsError}</p>
        )}

        {projectsLoading ? (
          <p className="text-sm text-gray-500">Loading projects...</p>
        ) : (
          <div className="project-grid">
            {mine.map((project) => (
              <button
                type="button"
                className="project-card"
                key={project.id}
                onClick={() =>
                  navigate(`/user/projects/${project.id}`)
                }
              >
                <div className="project-card-top">
                  <span className="project-icon">
                    <Icon name="projects" size={18} />
                  </span>

                  <span className="status-dot">
                    {project.status || 'Active'}
                  </span>
                </div>

                <h3>{project.name}</h3>
                <p>{project.description || 'No description'}</p>

                <div className="project-meta">
                  <span>Lead: {getLeadName(project)}</span>

                  <span>
                    {
                      findings.filter(
                        (finding) =>
                          String(finding.project) === String(project.id),
                      ).length
                    }{' '}
                    findings
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  {project.repositories?.length || 0} repositories
                  {' · '}
                  {project.members?.length || 0} members
                </div>
              </button>
            ))}

            {!mine.length && (
              <div className="empty-state">
                You are not a member of any projects yet. Click
                {' '}+ Create Project to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
