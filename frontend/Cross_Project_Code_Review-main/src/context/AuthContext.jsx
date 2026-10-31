
import { createContext, useContext, useState } from 'react'
import { apiRequest } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user_profile')
      return saved ? JSON.parse(saved) : null
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

    const profile = {
      ...user,
      userId: user.id,
      username: user.email || username,
      name: user.name || user.email || username,
      role: role === 'developer' ? 'user' : role,
      backendRole: role,
      color: '#8250df',
    }

    localStorage.setItem('user_profile', JSON.stringify(profile))
    setCurrentUser(profile)
    return profile
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_profile')
    setCurrentUser(null)
  }

  function updateProfilePicture(avatar) {
    setCurrentUser((prev) => {
      const next = prev ? { ...prev, avatar } : prev
      if (next) {
        try {
          localStorage.setItem('user_profile', JSON.stringify(next))
        } catch {}
      }
      return next
    })
  }

  function changePassword() {
    return {
      ok: false,
      message: 'Password changes are not connected to the backend yet.',
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
