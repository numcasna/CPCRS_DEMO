
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const items = [
  { to: '/user/projects', label: 'Projects', icon: 'projects' },
  { to: '/user/findings', label: 'Findings', icon: 'findings' },
  { to: '/user/settings', label: 'Settings', icon: 'settings' },
]

export default function UserLayout() {
  return (
    <div className="app-shell">
      <Sidebar
        title="Cross Project Review"
        subtitle="User workspace"
        items={items}
      />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
