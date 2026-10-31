import { useRef, useState } from 'react'
import Topbar from '../components/Topbar'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function Settings() {
  const { currentUser, updateProfilePicture, changePassword } = useAuth()
  const { customLabels, saveCustomLabel, removeCustomLabel } = useData()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(currentUser?.avatar || '')
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [newCustomLabel, setNewCustomLabel] = useState('')
  const [message, setMessage] = useState(null)

  function selectPicture(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)
  }

  function savePicture() {
    if (!preview) {
      setMessage({ type: 'error', text: 'Choose an image first.' })
      return
    }
    updateProfilePicture(preview)
    setMessage({ type: 'success', text: 'Profile picture updated.' })
  }

  function handlePassword(e) {
    e.preventDefault()
    setMessage(null)
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setMessage({ type: 'error', text: 'All password fields are required.' })
      return
    }
    if (passwords.next !== passwords.confirm) {
      setMessage({ type: 'error', text: 'New password and confirmation must match.' })
      return
    }
    const result = changePassword(passwords.current, passwords.next)
    setMessage({ type: result.ok ? 'success' : 'error', text: result.message })
    if (result.ok) setPasswords({ current: '', next: '', confirm: '' })
  }

  function handleAddCustomLabel(e) {
    if (e) e.preventDefault()
    if (!newCustomLabel.trim()) return
    const trimmed = newCustomLabel.trim()
    saveCustomLabel(trimmed)
    setMessage({ type: 'success', text: `Custom label "${trimmed}" added.` })
    setNewCustomLabel('')
  }

  return <div><Topbar title="Settings" /><div className="page-container settings-page">
    <section className="settings-card">
      <div className="section-heading"><div><h2>Profile</h2><p>Manage the profile information used across the workspace.</p></div></div>
      <div className="profile-editor">
        <div className="profile-preview"><Avatar user={{ ...currentUser, avatar: preview }} size={88} /></div>
        <div className="profile-actions"><strong>{currentUser?.name}</strong><span>{currentUser?.role === 'admin' ? 'Lead Reviewer' : 'Backend Engineer'}</span>
          <div className="button-row"><button className="btn btn-secondary" type="button" onClick={() => inputRef.current?.click()}><Icon name="upload" size={16}/> Choose picture</button><button className="btn btn-primary" type="button" onClick={savePicture}>Save picture</button></div>
          <input ref={inputRef} type="file" accept="image/*" onChange={selectPicture} className="sr-only" />
          <small>PNG, JPG or other standard image formats. Preview before saving.</small>
        </div>
      </div>
    </section>

    {currentUser?.role === 'admin' && (
      <section className="settings-card">
        <div className="section-heading">
          <div>
            <h2>Finding Labels Configuration</h2>
            <p>Configure custom finding labels used across code review findings.</p>
          </div>
          <Icon name="plus" size={18} />
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Active Custom Labels ({customLabels?.length || 0})
          </p>
          {(!customLabels || customLabels.length === 0) ? (
            <p className="text-xs text-gray-400">
              No custom labels configured yet. Type a label below to configure one for all findings.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200 font-medium"
                >
                  {lbl}
                  <button
                    type="button"
                    onClick={() => {
                      removeCustomLabel(lbl)
                      setMessage({ type: 'success', text: `Removed custom label "${lbl}".` })
                    }}
                    title="Remove custom label"
                    className="text-purple-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleAddCustomLabel} className="flex gap-2">
          <input
            type="text"
            value={newCustomLabel}
            onChange={(e) => setNewCustomLabel(e.target.value)}
            placeholder="Type new custom label (e.g. Memory Leak, Race Condition, Deserialization)..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none bg-white"
            maxLength={100}
          />
          <button
            type="submit"
            disabled={!newCustomLabel.trim()}
            className="btn btn-primary"
          >
            + Add Custom Label
          </button>
        </form>
      </section>
    )}

    <section className="settings-card">
      <div className="section-heading"><div><h2>Change password</h2><p>Update your mock-auth password. Password values are never displayed.</p></div><Icon name="lock" size={20}/></div>
      <form onSubmit={handlePassword} className="form-grid password-grid">
        <label>Current Password<input type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({...passwords, current:e.target.value})}/></label>
        <label>New Password<input type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({...passwords, next:e.target.value})}/></label>
        <label>Confirm New Password<input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm:e.target.value})}/></label>
        <div className="form-actions"><button className="btn btn-primary" type="submit">Change Password</button></div>
      </form>
    </section>
    {message && <div className={`flash ${message.type}`}>{message.text}</div>}
  </div></div>
}
