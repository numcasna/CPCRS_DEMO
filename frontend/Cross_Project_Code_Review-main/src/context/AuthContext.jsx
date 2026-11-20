
import { createContext, useContext, useState } from 'react'
import { apiRequest } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user_profile')
      if (!saved) return null
      return JSON.parse(saved)
    } catch {
      return null
    }
  })

  async function login({ username, password }) {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: username.trim(),
        password,
      }),
    })

    sessionStorage.setItem('access_token', result.access_token)

    const user = result.user
    const role = String(user.role || '').toLowerCase()

    const profile = {
      ...user,
      userId: user.id,
      username: user.email || username,
      name: user.name || user.email || username,
      role: role === 'developer' ? 'user' : role,
      backendRole: role,
      color: '#8250df',
      avatar: user.avatar || null,
    }

    sessionStorage.setItem('user_profile', JSON.stringify(profile))
    setCurrentUser(profile)
    return profile
  }

  function logout() {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('user_profile')
    setCurrentUser(null)
  }

  async function updateProfilePicture(avatar) {
    const res = await apiRequest('/auth/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar }),
    })
    const savedAvatar = res?.avatar
    if (!savedAvatar) {
      throw new Error('Server did not return an updated avatar URL.')
    }

    setCurrentUser((prev) => {
      const next = prev ? { ...prev, avatar: savedAvatar } : prev
      if (next) {
        try {
          sessionStorage.setItem('user_profile', JSON.stringify(next))
        } catch {}
      }
      return next
    })

    return { ok: true, avatar: savedAvatar }
  }

  async function changePassword(currentPassword, newPassword) {
    try {
      const response = await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })
      return {
        ok: true,
        message: response?.message || 'Password changed successfully.',
      }
    } catch (err) {
      return {
        ok: false,
        message: err.message || 'Could not change password.',
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        logout,
        updateProfilePicture,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
