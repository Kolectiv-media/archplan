// src/lib/db.js — Firebase Realtime Database CRUD + real-time listeners
import { ref, onValue, push, set, update, remove, get, serverTimestamp } from 'firebase/database'
import { rtdb } from './firebase.js'

const toArr = v => !v ? [] : Array.isArray(v) ? v : Object.values(v)

// ── CONNECTION STATUS ─────────────────────────────────────────────────────────
export const listenConnected = (cb) =>
  onValue(ref(rtdb, '.info/connected'), snap => cb(snap.val() === true))

// ── PROJECTS ─────────────────────────────────────────────────────────────────
export const listenProjects = (uid, cb, onErr) =>
  onValue(
    ref(rtdb, `users/${uid}/projects`),
    snap => {
      const val = snap.val()
      const ps = val
        ? Object.entries(val).map(([id, d]) => ({ id, ...d }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : []
      cb(ps)
    },
    err => { console.error('listenProjects:', err); onErr?.(err) }
  )

export const createProject = async (uid, data) => {
  const r = push(ref(rtdb, `users/${uid}/projects`))
  await set(r, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return r
}

export const updateProject = (uid, projectId, data) =>
  update(ref(rtdb, `users/${uid}/projects/${projectId}`), { ...data, updatedAt: serverTimestamp() })

export const deleteProject = (uid, projectId) =>
  remove(ref(rtdb, `users/${uid}/projects/${projectId}`))

// ── NOTES / CALENDAR ─────────────────────────────────────────────────────────
export const listenNotes = (uid, cb) =>
  onValue(
    ref(rtdb, `users/${uid}/notes`),
    snap => {
      const val = snap.val()
      const notes = val
        ? Object.entries(val).map(([id, d]) => ({ id, ...d }))
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        : []
      cb(notes)
    },
    err => console.error('listenNotes:', err)
  )

export const createNote = async (uid, data) => {
  const r = push(ref(rtdb, `users/${uid}/notes`))
  await set(r, { ...data, createdAt: serverTimestamp() })
  return r
}

export const deleteNote = (uid, noteId) =>
  remove(ref(rtdb, `users/${uid}/notes/${noteId}`))

// ── REMINDERS ─────────────────────────────────────────────────────────────────
export const listenReminders = (uid, cb) =>
  onValue(
    ref(rtdb, `users/${uid}/reminders`),
    snap => {
      const val = snap.val()
      const reminders = val
        ? Object.entries(val).map(([id, d]) => ({ id, ...d }))
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        : []
      cb(reminders)
    },
    err => console.error('listenReminders:', err)
  )

export const createReminder = async (uid, data) => {
  const r = push(ref(rtdb, `users/${uid}/reminders`))
  await set(r, { ...data, createdAt: serverTimestamp() })
  return r
}

export const updateReminder = (uid, remId, data) =>
  update(ref(rtdb, `users/${uid}/reminders/${remId}`), data)

export const deleteReminder = (uid, remId) =>
  remove(ref(rtdb, `users/${uid}/reminders/${remId}`))

// ── USER PROFILE ──────────────────────────────────────────────────────────────
export const getUserProfile = async (uid) => {
  const snap = await get(ref(rtdb, `users/${uid}/profile`))
  return snap.val() || {}
}

export const saveUserProfile = (uid, data) =>
  update(ref(rtdb, `users/${uid}/profile`), data)

// ── CHAT MESSAGES ─────────────────────────────────────────────────────────────
export const listenMessages = (uid, projectId, channel = 'general', cb) =>
  onValue(
    ref(rtdb, `users/${uid}/projects/${projectId}/channels/${channel}/messages`),
    snap => {
      const val = snap.val()
      const msgs = val
        ? Object.entries(val).map(([id, d]) => ({ id, ...d }))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        : []
      cb(msgs)
    }
  )

export const sendMessage = async (uid, projectId, channel = 'general', data) => {
  const r = push(ref(rtdb, `users/${uid}/projects/${projectId}/channels/${channel}/messages`))
  await set(r, { ...data, createdAt: serverTimestamp() })
  return r
}

export const deleteMessage = (uid, projectId, channel = 'general', msgId) =>
  remove(ref(rtdb, `users/${uid}/projects/${projectId}/channels/${channel}/messages/${msgId}`))

// ── PROJECT MEMBERS ───────────────────────────────────────────────────────────
export const listenMembers = (uid, projectId, cb) =>
  onValue(
    ref(rtdb, `users/${uid}/projects/${projectId}/members`),
    snap => {
      const val = snap.val()
      cb(val ? Object.entries(val).map(([id, d]) => ({ id, ...d })) : [])
    }
  )

export const addMember = async (uid, projectId, data) => {
  const r = push(ref(rtdb, `users/${uid}/projects/${projectId}/members`))
  await set(r, { ...data, addedAt: serverTimestamp() })
  return r
}

export const removeMember = (uid, projectId, memberId) =>
  remove(ref(rtdb, `users/${uid}/projects/${projectId}/members/${memberId}`))

// ── ACCESS CONTROL ────────────────────────────────────────────────────────────
export const checkAccess = async (email) => {
  const snap = await get(ref(rtdb, 'settings/accessControl'))
  if (!snap.exists()) return 'first_user'
  const { approvedEmails } = snap.val()
  return toArr(approvedEmails).includes(email) ? 'approved' : 'not_approved'
}

export const initAccessControl = (ownerEmail) =>
  update(ref(rtdb, 'settings/accessControl'), {
    approvedEmails: [ownerEmail],
    ownerEmail
  })

export const requestAccess = (email, name) =>
  set(ref(rtdb, `accessRequests/${email.replace(/[@.]/g, '_')}`), {
    email, name, requestedAt: serverTimestamp(), status: 'pending'
  })

export const approveAccess = async (email) => {
  const snap = await get(ref(rtdb, 'settings/accessControl'))
  const current = snap.val() || {}
  const existing = toArr(current.approvedEmails)
  if (!existing.includes(email)) {
    await update(ref(rtdb, 'settings/accessControl'), {
      approvedEmails: [...existing, email]
    })
  }
  await update(ref(rtdb, `accessRequests/${email.replace(/[@.]/g, '_')}`), { status: 'approved' })
}

export const rejectAccess = (email) =>
  update(ref(rtdb, `accessRequests/${email.replace(/[@.]/g, '_')}`), { status: 'rejected' })

export const getOwnerEmail = async () => {
  const snap = await get(ref(rtdb, 'settings/accessControl'))
  return snap.exists() ? (snap.val().ownerEmail || null) : null
}

export const listenPendingRequests = (cb) =>
  onValue(
    ref(rtdb, 'accessRequests'),
    snap => {
      const val = snap.val()
      const reqs = val
        ? Object.entries(val)
            .map(([id, d]) => ({ id, ...d }))
            .filter(r => r.status === 'pending')
        : []
      cb(reqs)
    }
  )

export const listenApprovedUsers = (cb) =>
  onValue(
    ref(rtdb, 'accessRequests'),
    snap => {
      const val = snap.val()
      const reqs = val
        ? Object.entries(val)
            .map(([id, d]) => ({ id, ...d }))
            .filter(r => r.status === 'approved')
        : []
      cb(reqs)
    }
  )

// ── SHARE LINKS ───────────────────────────────────────────────────────────────
export const createShareLink = async (ownerUid, projectId, config, projectSnapshot) => {
  const r = push(ref(rtdb, 'sharedProjects'))
  await set(r, {
    ownerUid, projectId, config,
    project: projectSnapshot,
    createdAt: serverTimestamp()
  })
  return r.key
}

export const getSharedProject = async (token) => {
  const snap = await get(ref(rtdb, `sharedProjects/${token}`))
  if (!snap.exists()) return null
  const { project, config } = snap.val()
  if (!project) return null
  return { project, config }
}

export const deleteShareLink = (token) =>
  remove(ref(rtdb, `sharedProjects/${token}`))
