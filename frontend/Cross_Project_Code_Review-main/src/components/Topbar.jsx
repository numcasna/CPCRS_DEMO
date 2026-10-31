import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Icon from './Icon'

export default function Topbar({ title, search, onSearchChange, actions }) {
  const { currentUser } = useAuth()
  return (
    <header className="topbar">
      <div className="topbar-title-wrap">
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        {search !== undefined && (
          <label className="search-box">
            <Icon name="search" size={16} />
            <input value={search} onChange={(e) => onSearchChange?.(e.target.value)} placeholder="Search..." />
          </label>
        )}
        {actions}
        <div className="topbar-user"><Avatar user={currentUser} size={32} /><div><strong>{currentUser?.name}</strong><span>{currentUser?.role}</span></div></div>
      </div>
    </header>
  )
}
