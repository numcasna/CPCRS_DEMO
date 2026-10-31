
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const items = [
  { to: '/admin/projects', label: 'Projects', icon: 'projects' },
  { to: '/admin/findings', label: 'Findings', icon: 'findings' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
]

export default function AdminLayout() {
  return (
    <div className="app-shell">
      <Sidebar
        title="Cross Project Review"
        subtitle="Admin workspace"
        items={items}
      />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
