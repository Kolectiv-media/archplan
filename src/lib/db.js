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

// ── COLLABORATION ─────────────────────────────────────────────────────────────
export const inviteToProject = (ownerUid, projectId, projectName, inviterEmail, guestEmail) =>
  set(ref(rtdb, `invitations/${guestEmail.replace(/[@.]/g, '_')}/${projectId}`), {
    projectId, ownerUid, projectName, invitedBy: inviterEmail, guestEmail,
    createdAt: serverTimestamp()
  })

export const listenMyInvitations = (email, cb) =>
  onValue(
    ref(rtdb, `invitations/${email.replace(/[@.]/g, '_')}`),
    snap => {
      const val = snap.val()
      cb(val ? Object.entries(val).map(([pid, d]) => ({ pid, ...d })) : [])
    }
  )

export const acceptInvitation = async (ownerUid, projectId, memberUid, memberEmail, memberName) => {
  await set(ref(rtdb, `projectMembers/${ownerUid}/${projectId}/${memberUid}`), {
    email: memberEmail, name: memberName, role: 'editor', canEdit: true, addedAt: serverTimestamp()
  })
  await set(ref(rtdb, `myCollabs/${memberUid}/${projectId}`), {
    ownerUid, joinedAt: serverTimestamp()
  })
  await remove(ref(rtdb, `invitations/${memberEmail.replace(/[@.]/g, '_')}/${projectId}`))
}

export const declineInvitation = (email, projectId) =>
  remove(ref(rtdb, `invitations/${email.replace(/[@.]/g, '_')}/${projectId}`))

export const listenProjectMembers = (ownerUid, projectId, cb) =>
  onValue(
    ref(rtdb, `projectMembers/${ownerUid}/${projectId}`),
    snap => {
      const val = snap.val()
      cb(val ? Object.entries(val).map(([uid, d]) => ({ uid, ...d })) : [])
    }
  )

export const removeProjectMember = (ownerUid, projectId, memberUid) =>
  remove(ref(rtdb, `projectMembers/${ownerUid}/${projectId}/${memberUid}`))

export const listenCollabProjects = (uid, cb) => {
  const collabRef = ref(rtdb, `myCollabs/${uid}`)
  const projectListeners = new Map()
  const projectData = new Map()
  const notify = () =>
    cb(Array.from(projectData.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
  const collabUnsub = onValue(collabRef, snap => {
    const val = snap.val() || {}
    for (const pid of projectListeners.keys()) {
      if (!val[pid]) { projectListeners.get(pid)(); projectListeners.delete(pid); projectData.delete(pid); }
    }
    for (const [pid, { ownerUid }] of Object.entries(val)) {
      if (!projectListeners.has(pid)) {
        const u = onValue(ref(rtdb, `users/${ownerUid}/projects/${pid}`), psnap => {
          if (psnap.exists()) projectData.set(pid, { id: pid, ownerUid, _isCollab: true, ...psnap.val() })
          else projectData.delete(pid)
          notify()
        })
        projectListeners.set(pid, u)
      }
    }
    if (!Object.keys(val).length) notify()
  })
  return () => { collabUnsub(); projectListeners.forEach(u => u()); }
}
