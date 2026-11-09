
import { createContext, useContext, useState } from 'react'
import { apiRequest } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user_profile')
      if (!saved) return null
      const parsed = JSON.parse(saved)
      const uId = parsed.id || parsed.userId
      if (uId && !parsed.avatar) {
        const storedAvatar = localStorage.getItem(`user_avatar_${uId}`)
        if (storedAvatar) parsed.avatar = storedAvatar
      }
      return parsed
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

    localStorage.setItem('access_token', result.access_token)

    const user = result.user
    const role = String(user.role || '').toLowerCase()
    const savedAvatar = user.avatar || localStorage.getItem(`user_avatar_${user.id}`) || null

    const profile = {
      ...user,
      userId: user.id,
      username: user.email || username,
      name: user.name || user.email || username,
      role: role === 'developer' ? 'user' : role,
      backendRole: role,
      color: '#8250df',
      avatar: savedAvatar,
    }

    localStorage.setItem('user_profile', JSON.stringify(profile))
    if (savedAvatar) {
      try {
        localStorage.setItem(`user_avatar_${user.id}`, savedAvatar)
      } catch {}
    }
    setCurrentUser(profile)
    return profile
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_profile')
    setCurrentUser(null)
  }

  async function updateProfilePicture(avatar) {
    const userId = currentUser?.id || currentUser?.userId

    setCurrentUser((prev) => {
      const next = prev ? { ...prev, avatar } : prev
      if (next) {
        try {
          localStorage.setItem('user_profile', JSON.stringify(next))
          if (userId) {
            localStorage.setItem(`user_avatar_${userId}`, avatar)
          }
        } catch {}
      }
      return next
    })

    try {
      const res = await apiRequest('/auth/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar }),
      })
      if (res?.avatar) {
        setCurrentUser((prev) => {
          const next = prev ? { ...prev, avatar: res.avatar } : prev
          try {
            localStorage.setItem('user_profile', JSON.stringify(next))
            if (userId) {
              localStorage.setItem(`user_avatar_${userId}`, res.avatar)
            }
          } catch {}
          return next
        })
      }
      return { ok: true, avatar: res?.avatar || avatar }
    } catch (err) {
      console.warn('Backend avatar save notice:', err)
      return { ok: true, avatar }
    }
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
