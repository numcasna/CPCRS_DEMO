import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Icon from './Icon'

export default function Sidebar({ title, subtitle, items }) {
  const { currentUser, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <button
          type="button"
          className="hamburger-button"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name="menu" size={20} />
        </button>
        {!collapsed && <div className="sidebar-brand-copy"><strong>{title}</strong><span>{subtitle}</span></div>}
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon name={item.icon} size={18} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar user={currentUser} size={32} />
          {!collapsed && <div className="sidebar-user-copy"><strong>{currentUser?.name}</strong><span>{currentUser?.role === 'admin' ? 'Lead Reviewer' : 'Backend Engineer'}</span></div>}
        </div>
        <button type="button" onClick={logout} title={collapsed ? 'Logout' : undefined} className="sidebar-link sidebar-logout">
          <Icon name="logout" size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
