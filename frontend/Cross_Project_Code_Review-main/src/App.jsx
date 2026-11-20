
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminLayout from './layouts/AdminLayout'
import UserLayout from './layouts/UserLayout'
import AdminFindings from './pages/admin/AdminFindings'
import FindingDetail from './pages/admin/FindingDetail'
import CreateFinding from './pages/admin/CreateFinding'
import AdminProjects from './pages/admin/AdminProjects'
import ProjectDetail from './pages/admin/ProjectDetail'
import UserFindings from './pages/user/UserFindings'
import UserFindingDetail from './pages/user/UserFindingDetail'
import UserProjects from './pages/user/UserProjects'
import UserProjectDetail from './pages/user/UserProjectDetail'
import Settings from './pages/Settings'
import DeveloperProfile from './pages/admin/DeveloperProfile'

function RequireRole({ role, children }) {
  const { currentUser } = useAuth()

  if (!currentUser) return <Navigate to="/" replace />

  if (currentUser.role !== role) {
    return (
      <Navigate
        to={currentUser.role === 'admin' ? '/admin' : '/user'}
        replace
      />
    )
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="findings" replace />} />
        <Route path="findings" element={<AdminFindings />} />
        <Route path="findings/new" element={<CreateFinding />} />
        <Route path="findings/:id" element={<FindingDetail />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="users/:id" element={<DeveloperProfile />} />
      </Route>

      <Route
        path="/user"
        element={
          <RequireRole role="user">
            <UserLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="findings" replace />} />
        <Route path="projects" element={<UserProjects />} />
        <Route path="projects/:id" element={<UserProjectDetail />} />
        <Route path="findings" element={<UserFindings />} />
        <Route path="findings/:id" element={<UserFindingDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="users/:id" element={<DeveloperProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}


