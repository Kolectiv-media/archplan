import React from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase.js'
import { getUserProfile, saveUserProfile } from '../lib/db.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        getUserProfile(u.uid)
          .then(prof => setProfile(prof))
          .catch(() => setProfile({}))
      } else {
        setProfile({})
      }
    })
    return unsub
  }, [])

  const loginGoogle = () => signInWithPopup(auth, googleProvider)

  const loginEmail  = (email, password) => signInWithEmailAndPassword(auth, email, password)

  const registerEmail = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    return cred
  }

  const logout = () => signOut(auth)

  const updateMyProfile = async (data) => {
    if (!user) return
    await saveUserProfile(user.uid, data)
    setProfile(prev => ({ ...prev, ...data }))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginGoogle, loginEmail, registerEmail, logout, updateMyProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
