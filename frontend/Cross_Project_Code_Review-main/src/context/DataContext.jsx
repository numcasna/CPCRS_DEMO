
import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import { useAuth } from './AuthContext'
import {
  DEFAULT_FINDING_LABELS,
  getCustomLabels,
  saveCustomLabel,
  removeCustomLabel,
} from '../data/mockData'

const DataContext = createContext(null)

function today() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeProject(project) {
  return {
    ...project,
    id: project.id,
    lead: project.project_lead_id,
    is_active: project.is_active !== false,
    deleted_at: project.deleted_at || null,
    status: project.deleted_at ? 'Deleted' : (project.is_active === false ? 'Inactive' : 'Active'),
    members: project.members?.map((member) => member.user_id) || [],
    repositories: project.repositories || [],
  }
}

function normalizeFinding(finding) {
  return {
    ...finding,
    id: finding.finding_code,
    backendId: finding.id,
    projectId: finding.project_id,
    project: finding.project_id,
    repositoryId: finding.repository_id,
    repository: finding.repository_id,
    assigneeId: finding.assignee_id,
    assignee: finding.assignee_id,
    reviewerId: finding.reviewer_id,
    reviewer: finding.reviewer_id,
    created: finding.created_at?.slice(0, 10) || today(),
    dueDate: finding.due_date,
    acceptedDate:
      finding.accepted_at ||
      finding.accepted_date ||
      finding.acceptedDate ||
      (finding.status_history || finding.statusHistory || []).find(
        (h) => (h.new_status || h.status) === 'In Progress' || (h.new_status || h.status) === 'in_progress'
      )?.changed_at ||
      (['In Progress', 'in_progress', 'In Review', 'in_review', 'Resolved', 'resolved', 'Closed', 'closed'].includes(finding.status)
        ? (finding.updated_at || finding.created_at)
        : null),
    status: finding.status,
    severity: finding.severity,
    history: finding.status_history || [],
    statusHistory: finding.status_history || [],
    attachments: finding.attachments || [],
    feedback: finding.feedback || '',
  }
}

export function DataProvider({ children }) {
  const [findings, setFindings] = useState([])
  const [findingsLoading, setFindingsLoading] = useState(false)
  const [findingsError, setFindingsError] = useState('')

  const { currentUser } = useAuth()

  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const [customLabels, setCustomLabels] = useState(getCustomLabels())

  useEffect(() => {
    function syncCustomLabels() {
      setCustomLabels(getCustomLabels())
    }
    window.addEventListener('cpcr_custom_labels_updated', syncCustomLabels)
    return () => window.removeEventListener('cpcr_custom_labels_updated', syncCustomLabels)
  }, [])

  const allFindingLabels = Array.from(
    new Set([
      ...DEFAULT_FINDING_LABELS,
      ...(findings || []).map((f) => f.category || f.label).filter(Boolean),
      ...customLabels,
    ])
  )

  async function refreshProjects() {
    const includeDeleted = currentUser?.role === 'admin' ? '?include_deleted=true' : ''
    const result = await apiRequest(`/projects${includeDeleted}`)
    const projectsWithDetails = await Promise.all(
      result.map(async (project) => {
        const [details, repositories] = await Promise.all([
          apiRequest(`/projects/${project.id}`),
          apiRequest(`/projects/${project.id}/repositories`),
        ])
        return normalizeProject({
          ...project,
          ...details,
          repositories: repositories.map((repo) => ({ ...repo, findings: 0 })),
        })
      }),
    )
    setProjects(projectsWithDetails)
    setProjectsError('')
    return projectsWithDetails
  }

  async function refreshFindings() {
    const result = await apiRequest('/findings')
    const normalized = result.map(normalizeFinding)
    setFindings(normalized)
    setFindingsError('')
    return normalized
  }

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setProjectsLoading(true)
      setFindingsLoading(true)
      setProjectsError('')
      setFindingsError('')

      const [projectResult, usersResult, findingResult] =
        await Promise.allSettled([
          apiRequest(currentUser?.role === 'admin' ? '/projects?include_deleted=true' : '/projects'),
          apiRequest('/users/available-for-project'),
          apiRequest('/findings'),
        ])

      if (cancelled) return

      if (projectResult.status === 'fulfilled') {
        try {
          const projectsWithDetails = await Promise.all(
            projectResult.value.map(async (project) => {
              const [details, repositories] = await Promise.all([
                apiRequest(`/projects/${project.id}`),
                apiRequest(`/projects/${project.id}/repositories`),
              ])

              return normalizeProject({
                ...project,
                ...details,
                repositories: repositories.map((repo) => ({
                  ...repo,
                  findings: 0,
                })),
              })
            }),
          )

          if (!cancelled) setProjects(projectsWithDetails)
        } catch (error) {
          if (!cancelled) setProjectsError(error.message || 'Could not load projects.')
        }
      } else {
        setProjectsError(
          projectResult.reason?.message || 'Could not load projects.',
        )
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value)
      }

      if (findingResult.status === 'fulfilled') {
        setFindings(findingResult.value.map(normalizeFinding))
      } else {
        setFindingsError(
          findingResult.reason?.message || 'Could not load findings.',
        )
      }

      if (!cancelled) {
        setProjectsLoading(false)
        setFindingsLoading(false)
      }
    }

    if (currentUser) {
      loadData()
    } else {
      setProjects([])
      setUsers([])
      setFindings([])
      setProjectsLoading(false)
      setFindingsLoading(false)
      setProjectsError('')
      setFindingsError('')
    }

    return () => {
      cancelled = true
    }
  }, [currentUser])

  async function addProject(project) {
    if (!currentUser?.userId) {
      throw new Error('Please log in again before creating a project.')
    }

    if (!project.name?.trim()) {
      throw new Error('Please enter a project name.')
    }

    const repositories = (project.repositories || [])
      .filter((repo) => repo.name?.trim())
      .map((repo) => ({
        name: repo.name.trim(),
        repository_url: repo.repository_url?.trim() || null,
        branch_name: repo.branch_name?.trim() || null,
        technology: repo.technology?.trim() || null,
      }))

    const memberIds = [
      ...new Set((project.member_ids || []).filter(Boolean).map(String)),
    ]

    const projectLeadId =
      project.project_lead_id || currentUser.userId

    const result = await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: project.name.trim(),
        description: project.description?.trim() || null,
        project_lead_id: projectLeadId,
        member_ids: memberIds,
        repositories,
      }),
    })

    const [details, savedRepositories] = await Promise.all([
      apiRequest(`/projects/${result.id}`),
      apiRequest(`/projects/${result.id}/repositories`),
    ])

    const newProject = normalizeProject({
      ...result,
      ...details,
      repositories: savedRepositories.map((repo) => ({
        ...repo,
        findings: 0,
      })),
    })

    setProjects((previous) => [
      newProject,
      ...previous.filter((item) => item.id !== newProject.id),
    ])

    return newProject
  }

  async function updateProjectStatus(projectId, isActive) {
    await apiRequest(`/projects/${projectId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: Boolean(isActive) }),
    })
    await refreshProjects()
  }

  async function softDeleteProject(projectId) {
    await apiRequest(`/projects/${projectId}`, { method: 'DELETE' })
    await refreshProjects()
  }

  async function restoreProject(projectId) {
    await apiRequest(`/projects/${projectId}/restore`, { method: 'POST' })
    await refreshProjects()
  }

  async function addFinding(finding) {
    const projectId = finding.project_id || finding.projectId
    const repositoryId =
      finding.repository_id ||
      finding.repositoryId ||
      finding.repository?.id
    const assigneeId =
      finding.assignee_id ||
      finding.assigneeId ||
      finding.assignee?.id
    const reviewerId =
      finding.reviewer_id ||
      finding.reviewerId ||
      finding.reviewer?.id ||
      null
    const dueDate = finding.due_date || finding.dueDate

    if (!projectId) throw new Error('Please select a project.')
    if (!repositoryId) {
      throw new Error('Please select a repository with a valid ID.')
    }
    if (!assigneeId) throw new Error('Please select an assignee.')
    if (!dueDate) throw new Error('Please select a due date.')

    const payload = {
      title: finding.title?.trim(),
      description: finding.description?.trim(),
      project_id: projectId,
      repository_id: repositoryId,
      branch_name: finding.branch_name || finding.branchName || null,
      severity: finding.severity,
      category: finding.category,
      assignee_id: assigneeId,
      reviewer_id: reviewerId,
      due_date: dueDate,
    }

    const savedFinding = await apiRequest('/findings', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const normalized = normalizeFinding(savedFinding)

    setFindings((previous) => [
      normalized,
      ...previous.filter((item) => item.backendId !== normalized.backendId),
    ])

    return normalized
  }

  // Persist the status in PostgreSQL through the FastAPI endpoint.
  async function updateFindingStatus(
    id,
    newStatus,
    actorName,
    feedback = '',
    attachments = [],
    actorRole = 'user',
  ) {
    const existingFinding = findings.find(
      (item) =>
        String(item.id) === String(id) ||
        String(item.backendId) === String(id),
    )

    const backendId = existingFinding?.backendId || id

    if (!backendId) {
      throw new Error('Could not identify the finding in the database.')
    }

    const updatedFinding = await apiRequest(
      `/findings/${backendId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          reason: feedback?.trim() || null,
        }),
      },
    )

    const normalized = normalizeFinding(updatedFinding)

    setFindings((previous) =>
      previous.map((item) =>
        String(item.backendId) === String(backendId)
          ? {
              ...item,
              ...normalized,
              history: item.history || [],
              statusHistory: item.statusHistory || [],
              attachments:
                normalized.attachments?.length
                  ? normalized.attachments
                  : item.attachments || [],
            }
          : item,
      ),
    )

    // Reload authoritative database state so both portals stay in sync.
    await refreshFindings()

    return normalized
  }

  async function updateFindingAssignment(id, assignee) {
    const existing = findings.find(
      (finding) => String(finding.id) === String(id) || String(finding.backendId) === String(id),
    )
    const backendId = existing?.backendId || id
    const assigneeId = typeof assignee === 'object' ? assignee?.id || assignee?.user_id : assignee

    if (!backendId) throw new Error('Could not identify the finding in the database.')
    if (!assigneeId) throw new Error('Please select an assignee.')

    await apiRequest(`/findings/${backendId}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignee_id: assigneeId }),
    })
    await refreshFindings()
  }

  return (
    <DataContext.Provider
      value={{
        findings,
        findingsLoading,
        findingsError,
        projects,
        projectsLoading,
        projectsError,
        users,
        addFinding,
        addProject,
        updateProjectStatus,
        softDeleteProject,
        restoreProject,
        refreshProjects,
        updateFindingStatus,
        updateFindingAssignment,
        refreshFindings,
        customLabels,
        allFindingLabels,
        saveCustomLabel,
        removeCustomLabel,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
