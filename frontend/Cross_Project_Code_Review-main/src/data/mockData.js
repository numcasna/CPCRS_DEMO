// All dummy data lives here. Edit this file to change what shows up in the app.

export const users = [
  { id: 'u1', name: 'Sachin Jain', role: 'Lead Reviewer', initials: 'SA', color: '#7c3aed' },
  { id: 'u2', name: 'Aarav Sharma', role: 'Backend Engineer', initials: 'AS', color: '#7c3aed' },
  { id: 'u3', name: 'Daniel Kim', role: 'Engineer', initials: 'DK', color: '#db2777' },
  { id: 'u4', name: 'Mia Torres', role: 'Tech Lead', initials: 'MT', color: '#7c3aed' },
  { id: 'u5', name: 'James Okafor', role: 'Engineer', initials: 'JO', color: '#dc2626' },
  { id: 'u6', name: 'Lucas Chen', role: 'Frontend Engineer', initials: 'LC', color: '#2563eb' },
  { id: 'u7', name: 'Priya Nair', role: 'QA Engineer', initials: 'PN', color: '#7c3aed' },
  { id: 'u8', name: 'Sofia Reyes', role: 'Engineer', initials: 'SR', color: '#db2777' },
]

export const projects = [
  {
    id: 'phoenix',
    name: 'Phoenix Platform',
    description: 'Core microservices infrastructure powering the Phoenix product suite.',
    status: 'Active',
    lead: 'u4',
    members: ['u2', 'u4', 'u6', 'u7'],
    repositories: [
      { name: 'phoenix-core', findings: 0 },
      { name: 'phoenix-api', findings: 2 },
      { name: 'phoenix-ui', findings: 1 },
      { name: 'phoenix-worker', findings: 0 },
    ],
  },
  {
    id: 'atlas',
    name: 'Atlas Analytics',
    description: 'Real-time analytics pipeline and reporting platform for enterprise clients.',
    status: 'Active',
    lead: 'u3',
    members: ['u2', 'u3', 'u7'],
    repositories: [
      { name: 'atlas-backend', findings: 2 },
      { name: 'atlas-frontend', findings: 2 },
    ],
  },
  {
    id: 'nexus',
    name: 'Nexus Gateway',
    description: 'API gateway and identity management layer for service-to-service communication.',
    status: 'Active',
    lead: 'u8',
    members: ['u2', 'u8'],
    repositories: [{ name: 'nexus-auth', findings: 4 }],
  },
  {
    id: 'ember',
    name: 'Ember Commerce',
    description: 'E-commerce platform with catalog management, checkout, and order fulfillment.',
    status: 'On Hold',
    lead: 'u5',
    members: ['u5'],
    repositories: [
      { name: 'ember-checkout', findings: 2 },
      { name: 'ember-catalog', findings: 1 },
    ],
  },
]

export const DEFAULT_FINDING_LABELS = [
  'SQL Injection',
  'AWS / Cloud Problem',
  'DB Problem',
  'Authentication',
  'Authorization',
  'Performance',
  'Data Exposure',
  'Configuration',
  'Other',
]

export const findingLabels = DEFAULT_FINDING_LABELS

export function getCustomLabels() {
  try {
    const raw = localStorage.getItem('cpcr_custom_finding_labels')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomLabel(label) {
  if (!label || !label.trim()) return getCustomLabels()
  const trimmed = label.trim()
  try {
    const existing = getCustomLabels()
    if (!existing.includes(trimmed) && !DEFAULT_FINDING_LABELS.includes(trimmed)) {
      const updated = [...existing, trimmed]
      localStorage.setItem('cpcr_custom_finding_labels', JSON.stringify(updated))
      window.dispatchEvent(new Event('cpcr_custom_labels_updated'))
      return updated
    }
    return existing
  } catch {
    return getCustomLabels()
  }
}

export function removeCustomLabel(label) {
  try {
    const existing = getCustomLabels()
    const updated = existing.filter((item) => item !== label)
    localStorage.setItem('cpcr_custom_finding_labels', JSON.stringify(updated))
    window.dispatchEvent(new Event('cpcr_custom_labels_updated'))
    return updated
  } catch {
    return getCustomLabels()
  }
}

export function getAllFindingLabels(findings = []) {
  const custom = getCustomLabels()
  const fromFindings = (findings || [])
    .map((f) => f.category || f.label)
    .filter(Boolean)
  return Array.from(new Set([...DEFAULT_FINDING_LABELS, ...fromFindings, ...custom]))
}

export const findings = [
  {
    id: 'CR-001', title: 'SQL Injection vulnerability in user search endpoint',
    project: 'phoenix', repository: 'phoenix-api', assignee: 'u2', reviewer: 'u4',
    severity: 'Critical', status: 'In Progress', created: '2026-09-10', assignedDate: '2026-09-12', acceptedDate: '2026-09-12', dueDate: '2026-09-20',
    label: 'SQL Injection',
    description: "The /api/users/search endpoint constructs SQL queries via string concatenation using unvalidated user input. An attacker can manipulate the 'q' parameter to extract arbitrary data or corrupt the database.",
    recommendation: "Replace string concatenation with parameterized queries using the existing db.query() helper. Add input length validation at the middleware layer.",
    history: [{ from: 'Open', to: 'In Progress', by: 'Mia Torres', date: '2026-09-12' }],
  },
  {
    id: 'CR-002', title: 'Hardcoded AWS credentials in config file',
    project: 'atlas', repository: 'atlas-backend', assignee: 'u3', reviewer: 'u4',
    severity: 'Critical', status: 'Open', created: '2026-09-11', assignedDate: '2026-09-11', dueDate: '2026-09-18',
    label: 'AWS / Cloud Problem',
    description: 'AWS access key and secret are committed in plaintext inside config/settings.py, exposing production infrastructure credentials in version control history.',
    recommendation: 'Rotate the exposed keys immediately, move secrets to environment variables or a secrets manager, and purge the credentials from git history.',
    history: [],
  },
  {
    id: 'CR-003', title: 'Missing rate limiting on authentication endpoint',
    project: 'nexus', repository: 'nexus-auth', assignee: 'u2', reviewer: 'u8',
    severity: 'High', status: 'In Progress', created: '2026-09-12', assignedDate: '2026-09-12', acceptedDate: '2026-09-12', dueDate: '2026-09-25',
    label: 'Authentication',
    description: 'The /auth/login endpoint has no rate limiting, allowing unlimited login attempts and making the service vulnerable to brute-force and credential-stuffing attacks.',
    recommendation: 'Add IP and account-based rate limiting with exponential backoff, and log repeated failures for monitoring.',
    history: [],
  },
  {
    id: 'CR-004', title: 'Unhandled promise rejection in checkout flow',
    project: 'ember', repository: 'ember-checkout', assignee: 'u5', reviewer: 'u4',
    severity: 'High', status: 'Resolved', created: '2026-09-08', assignedDate: '2026-09-08', dueDate: '2026-09-20',
    label: 'Other',
    description: 'The payment confirmation call in checkout.js has no .catch() handler, so a failed request leaves the UI stuck on a loading spinner with no error shown to the user.',
    recommendation: 'Wrap the async call in try/catch, show an error state, and add a retry action.',
    feedback: 'I added the missing error handling and verified the retry path locally.',
    attachments: [{ name: 'checkout-fix.txt', type: 'text/plain', size: 42, dataUrl: 'data:text/plain;charset=utf-8,Error handling fix verified.' }],
    history: [{ from: 'Open', to: 'Resolved', by: 'James Okafor', date: '2026-09-19' }],
  },
  {
    id: 'CR-005', title: 'Excessive bundle size due to unused lodash imports',
    project: 'phoenix', repository: 'phoenix-ui', assignee: 'u6', reviewer: 'u4',
    severity: 'Medium', status: 'Open', created: '2026-09-13', assignedDate: '2026-09-13', dueDate: '2026-10-05',
    label: 'Performance',
    description: "Several files import the full lodash library instead of individual functions, adding roughly 70KB of unused code to the production bundle.",
    recommendation: 'Switch to lodash-es with named imports, or replace usages with native array/object methods where possible.',
    history: [],
  },
  {
    id: 'CR-006', title: 'N+1 query pattern in product catalog listing',
    project: 'ember', repository: 'ember-catalog', assignee: null, reviewer: 'u4',
    severity: 'Medium', status: 'Open', created: '2026-09-14', assignedDate: null, acceptedDate: null, dueDate: '2026-10-08',
    label: 'DB Problem',
    description: 'Fetching the catalog page triggers a separate database query per product to load its category, resulting in hundreds of queries for large listings.',
    recommendation: 'Use a join or batched loader (e.g. DataLoader pattern) to fetch categories in a single query.',
    history: [],
  },
  {
    id: 'CR-007', title: 'Inconsistent error boundary handling',
    project: 'atlas', repository: 'atlas-frontend', assignee: 'u7', reviewer: 'u4',
    severity: 'Low', status: 'Resolved', created: '2026-09-07', assignedDate: '2026-09-07', dueDate: '2026-09-22',
    label: 'Configuration',
    description: 'Some route-level components are wrapped in an ErrorBoundary while others are not, leading to a blank white screen on unexpected errors in a few sections.',
    recommendation: 'Wrap all top-level route components consistently and add a shared fallback UI.',
    feedback: 'All route-level components are now covered by the shared error boundary.',
    history: [{ from: 'Open', to: 'Resolved', by: 'Priya Nair', date: '2026-09-21' }],
  },
  {
    id: 'CR-008', title: 'JWT tokens stored in localStorage',
    project: 'nexus', repository: 'nexus-auth', assignee: 'u8', reviewer: 'u4',
    severity: 'High', status: 'Open', created: '2026-09-15', assignedDate: '2026-09-15', dueDate: '2026-09-22',
    label: 'Authentication',
    description: 'Access and refresh tokens are stored in localStorage, making them readable by any script and vulnerable to theft via XSS.',
    recommendation: 'Move tokens to httpOnly, secure cookies and add CSRF protection for state-changing requests.',
    history: [],
  },
  {
    id: 'CR-009', title: 'Missing index on frequently queried column',
    project: 'atlas', repository: 'atlas-backend', assignee: 'u2', reviewer: 'u4',
    severity: 'Low', status: 'Closed', created: '2026-09-09', assignedDate: '2026-09-09', dueDate: '2026-09-15',
    label: 'DB Problem',
    description: 'The findings.status column is filtered on in nearly every dashboard query but has no index, slowing down list and report pages as data grows.',
    recommendation: 'Add a b-tree index on the status column and re-run the query planner to confirm the improvement.',
    history: [
      { from: 'Open', to: 'Resolved', by: 'Aarav Sharma', date: '2026-09-13' },
      { from: 'Resolved', to: 'Closed', by: 'Sarah Abdi', date: '2026-09-15' },
    ],
  },
  {
    id: 'CR-010', title: 'API responses exposing internal stack traces',
    project: 'nexus', repository: 'nexus-auth', assignee: 'u5', reviewer: 'u4',
    severity: 'High', status: 'Resolved', created: '2026-09-10', assignedDate: '2026-09-10', dueDate: '2026-09-18',
    label: 'Data Exposure',
    description: 'Unhandled exceptions return the full Python stack trace in the API response body, leaking internal file paths and library versions to clients.',
    recommendation: 'Add a global exception handler that logs the full trace server-side and returns a generic error message to the client.',
    feedback: 'The API now returns a generic error response while retaining the stack trace only in server logs.',
    history: [{ from: 'Open', to: 'Resolved', by: 'James Okafor', date: '2026-09-17' }],
  },
  {
    id: 'CR-011', title: 'Insecure direct object reference in file download API',
    project: 'phoenix', repository: 'phoenix-api', assignee: 'u4', reviewer: 'u4',
    severity: 'High', status: 'Open', created: '2026-09-19', assignedDate: '2026-09-19', dueDate: '2026-09-19',
    label: 'Authorization',
    description: 'The /files/{id}/download endpoint does not verify that the requesting user owns or has access to the file, allowing any authenticated user to download any file by guessing its ID.',
    recommendation: 'Add an ownership/permission check before streaming the file, and return 404 rather than 403 to avoid leaking existence.',
    history: [],
  },
  {
    id: 'CR-012', title: 'Missing CSRF protection on state-changing form',
    project: 'atlas', repository: 'atlas-frontend', assignee: 'u2', reviewer: 'u4',
    severity: 'Medium', status: 'Open', created: '2026-09-20', assignedDate: '2026-09-20', dueDate: '2026-09-28',
    label: 'Authentication',
    description: 'The settings-update form submits via a plain POST with no CSRF token, allowing a malicious site to trigger unwanted changes on behalf of a logged-in user.',
    recommendation: 'Add CSRF tokens to all state-changing forms and validate them server-side.',
    history: [],
  },
  {
    id: 'CR-013', title: 'Cleartext logging of sensitive user data',
    project: 'ember', repository: 'ember-checkout', assignee: null, reviewer: 'u4',
    severity: 'Critical', status: 'Open', created: '2026-09-21', assignedDate: null, dueDate: '2026-09-21',
    label: 'Data Exposure',
    description: 'Application logs include full customer email addresses and shipping addresses in plaintext, which then flow into a third-party log aggregation service.',
    recommendation: 'Mask or redact personally identifiable information before logging, and review retention policy on the log aggregator.',
    history: [],
  },
  {
    id: 'CR-014', title: 'Race condition in concurrent finding status updates',
    project: 'nexus', repository: 'nexus-auth', assignee: 'u2', reviewer: 'u4',
    severity: 'Medium', status: 'Reopened', created: '2026-09-16', assignedDate: '2026-09-18', acceptedDate: '2026-09-18', dueDate: '2026-09-16',
    label: 'DB Problem',
    description: 'Two simultaneous status updates on the same record can overwrite each other silently because updates are not wrapped in a transaction with optimistic locking.',
    recommendation: 'Add a version column and check-and-set logic, or wrap the update in a serializable transaction.',
    history: [
      { from: 'Open', to: 'Resolved', by: 'Aarav Sharma', byId: 'u2', byRole: 'user', date: '2026-09-18', feedback: 'I applied the locking changes and verified the concurrent update path locally.' },
      { from: 'Resolved', to: 'Reopened', by: 'Sarah Abdi', date: '2026-09-20', feedback: 'The finding is being reopened because the submitted fix does not fully protect concurrent status updates. Please add the version check to the write path and include a regression test.' },
    ],
  },
]

export const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Informational']
export const statusOrder = ['Open', 'In Progress', 'Resolved', 'Reopened', 'Rejected', 'Closed']

export function userById(id) {
  return users.find((u) => u.id === id) || null
}

export function projectById(id) {
  return projects.find((p) => p.id === id) || null
}
