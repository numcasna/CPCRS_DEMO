import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/Topbar'
import { useData } from '../../context/DataContext'

const FILTERS = ['All current', 'Active', 'Inactive', 'Deleted']

export default function AdminProjects() {
  const {
    projects, findings, projectsLoading, projectsError,
    updateProjectStatus, softDeleteProject, restoreProject,
  } = useData()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All current')
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')

  const visibleProjects = useMemo(() => projects.filter((project) => {
    const deleted = Boolean(project.deleted_at)
    const active = project.is_active !== false
    const matchesFilter = filter === 'All current' ? !deleted
      : filter === 'Active' ? !deleted && active
      : filter === 'Inactive' ? !deleted && !active
      : deleted
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || [project.name, project.description, project.id]
      .some((value) => String(value || '').toLowerCase().includes(q))
    return matchesFilter && matchesSearch
  }), [projects, filter, search])

  async function runAction(project, action) {
    setActionError('')
    setBusyId(project.id)
    try {
      if (action === 'deactivate') await updateProjectStatus(project.id, false)
      if (action === 'activate') await updateProjectStatus(project.id, true)
      if (action === 'delete') {
        const confirmed = window.confirm(`Soft delete “${project.name}”? The project and its findings will remain in the database and can be restored.`)
        if (confirmed) await softDeleteProject(project.id)
      }
      if (action === 'restore') await restoreProject(project.id)
    } catch (error) {
      setActionError(error.message || 'The project action could not be completed.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <Topbar title="Projects" search={search} onSearchChange={setSearch} />
      <div className="p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Manage project access, lifecycle status, and deleted projects.</p>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)}
                className={`rounded-lg border px-3 py-2 text-sm ${filter === item ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>

        {projectsLoading && <p className="mb-4 text-sm text-gray-500">Loading projects...</p>}
        {projectsError && <p className="mb-4 text-sm text-red-600">{projectsError}</p>}
        {actionError && <p role="alert" className="mb-4 text-sm text-red-600">{actionError}</p>}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {visibleProjects.map((project) => {
            const deleted = Boolean(project.deleted_at)
            const active = project.is_active !== false
            const count = findings.filter((finding) => String(finding.project) === String(project.id)).length
            const statusLabel = deleted ? 'Deleted' : active ? 'Active' : 'Inactive'
            const statusStyle = deleted ? 'bg-red-100 text-red-700' : active ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            return (
              <article key={project.id} className="rounded-xl border border-gray-100 bg-white p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <button type="button" onClick={() => navigate(`/admin/projects/${project.id}`)} className="text-left font-semibold text-gray-800 hover:text-blue-700">
                    {project.name}
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle}`}>{statusLabel}</span>
                </div>
                <p className="mb-3 text-sm text-gray-500">{project.description || 'No description'}</p>
                <p className="mb-4 text-xs text-gray-400">{project.repositories?.length || 0} repos · {project.members?.length || 0} members · {count} findings</p>
                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {!deleted && (active
                    ? <button disabled={busyId === project.id} onClick={() => runAction(project, 'deactivate')} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-50">Set inactive</button>
                    : <button disabled={busyId === project.id} onClick={() => runAction(project, 'activate')} className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 disabled:opacity-50">Set active</button>)}
                  {!deleted && <button disabled={busyId === project.id} onClick={() => runAction(project, 'delete')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">Soft delete</button>}
                  {deleted && <button disabled={busyId === project.id} onClick={() => runAction(project, 'restore')} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50">Restore project</button>}
                  {busyId === project.id && <span className="self-center text-xs text-gray-400">Saving...</span>}
                </div>
              </article>
            )
          })}
        </div>
        {!projectsLoading && visibleProjects.length === 0 && <p className="mt-4 text-sm text-gray-500">No projects match this filter.</p>}
      </div>
    </div>
  )
}
