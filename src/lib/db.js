// src/lib/db.js  — Firestore CRUD + real-time listeners
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, getDoc, setDoc, arrayUnion
} from 'firebase/firestore'
import { db } from './firebase.js'

// ── PROJECTS ─────────────────────────────────────────────────────────────────
export const projectsCol = (uid) => collection(db, 'users', uid, 'projects')

export const listenProjects = (uid, cb, onErr) =>
  onSnapshot(
    collection(db, 'users', uid, 'projects'),
    snap => cb(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
               .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)),
      snap.metadata.fromCache
    ),
    err => { console.error('listenProjects:', err.code, err.message); onErr?.(err); }
  )

export const createProject = (uid, data) =>
  addDoc(projectsCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateProject = (uid, projectId, data) =>
  updateDoc(doc(db, 'users', uid, 'projects', projectId), { ...data, updatedAt: serverTimestamp() })

export const deleteProject = (uid, projectId) =>
  deleteDoc(doc(db, 'users', uid, 'projects', projectId))

// ── NOTES / CALENDAR ──────────────────────────────────────────────────────────
export const notesCol = (uid) => collection(db, 'users', uid, 'notes')

export const listenNotes = (uid, cb) =>
  onSnapshot(
    collection(db, 'users', uid, 'notes'),
    snap => cb(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.date||'').localeCompare(b.date||''))),
    err => console.error('listenNotes:', err.code)
  )

export const createNote = (uid, data) =>
  addDoc(notesCol(uid), { ...data, createdAt: serverTimestamp() })

export const deleteNote = (uid, noteId) =>
  deleteDoc(doc(db, 'users', uid, 'notes', noteId))

// ── REMINDERS ─────────────────────────────────────────────────────────────────
export const remindersCol = (uid) => collection(db, 'users', uid, 'reminders')

export const listenReminders = (uid, cb) =>
  onSnapshot(
    collection(db, 'users', uid, 'reminders'),
    snap => cb(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.date||'').localeCompare(b.date||''))),
    err => console.error('listenReminders:', err.code)
  )

export const createReminder = (uid, data) =>
  addDoc(remindersCol(uid), { ...data, createdAt: serverTimestamp() })

export const updateReminder = (uid, remId, data) =>
  updateDoc(doc(db, 'users', uid, 'reminders', remId), data)

export const deleteReminder = (uid, remId) =>
  deleteDoc(doc(db, 'users', uid, 'reminders', remId))

// ── USER PROFILE ──────────────────────────────────────────────────────────────
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'))
  return snap.exists() ? snap.data() : {}
}

export const saveUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid, 'profile', 'main'), data, { merge: true })

// ── CHAT MESSAGES ─────────────────────────────────────────────────────────────
export const messagesCol = (uid, projectId, channel='general') =>
  collection(db, 'users', uid, 'projects', projectId, 'channels', channel, 'messages')

export const listenMessages = (uid, projectId, channel='general', cb) =>
  onSnapshot(
    query(messagesCol(uid, projectId, channel), orderBy('createdAt', 'asc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )

export const sendMessage = (uid, projectId, channel='general', data) =>
  addDoc(messagesCol(uid, projectId, channel), { ...data, createdAt: serverTimestamp() })

export const deleteMessage = (uid, projectId, channel='general', msgId) =>
  deleteDoc(doc(db, 'users', uid, 'projects', projectId, 'channels', channel, 'messages', msgId))

// ── PROJECT MEMBERS ───────────────────────────────────────────────────────────
export const membersCol = (uid, projectId) =>
  collection(db, 'users', uid, 'projects', projectId, 'members')

export const listenMembers = (uid, projectId, cb) =>
  onSnapshot(membersCol(uid, projectId), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const addMember = (uid, projectId, data) =>
  addDoc(membersCol(uid, projectId), { ...data, addedAt: serverTimestamp() })

export const removeMember = (uid, projectId, memberId) =>
  deleteDoc(doc(db, 'users', uid, 'projects', projectId, 'members', memberId))

// ── ACCESS CONTROL ────────────────────────────────────────────────────────────
const accessRef = doc(db, 'settings', 'accessControl')

export const checkAccess = async (email) => {
  const snap = await getDoc(accessRef)
  if (!snap.exists()) return 'first_user'
  const { approvedEmails = [] } = snap.data()
  return approvedEmails.includes(email) ? 'approved' : 'not_approved'
}

export const initAccessControl = (ownerEmail) =>
  setDoc(accessRef, { approvedEmails: [ownerEmail], ownerEmail }, { merge: true })

export const requestAccess = (email, name) =>
  setDoc(doc(db, 'accessRequests', email.replace(/[@.]/g, '_')), {
    email, name, requestedAt: serverTimestamp(), status: 'pending'
  })

export const approveAccess = async (email) => {
  await updateDoc(accessRef, { approvedEmails: arrayUnion(email) })
  await updateDoc(doc(db, 'accessRequests', email.replace(/[@.]/g, '_')), { status: 'approved' })
}

export const rejectAccess = (email) =>
  updateDoc(doc(db, 'accessRequests', email.replace(/[@.]/g, '_')), { status: 'rejected' })

export const getOwnerEmail = async () => {
  const snap = await getDoc(accessRef)
  return snap.exists() ? (snap.data().ownerEmail || null) : null
}

export const listenPendingRequests = (cb) =>
  onSnapshot(query(collection(db, 'accessRequests'), where('status', '==', 'pending')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

export const listenApprovedUsers = (cb) =>
  onSnapshot(query(collection(db, 'accessRequests'), where('status', '==', 'approved')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

// ── SHARE LINKS ───────────────────────────────────────────────────────────────
export const createShareLink = async (ownerUid, projectId, config, projectSnapshot) => {
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  await setDoc(doc(db, 'sharedProjects', token), {
    ownerUid, projectId, config,
    project: projectSnapshot,
    createdAt: serverTimestamp()
  })
  return token
}

export const getSharedProject = async (token) => {
  const snap = await getDoc(doc(db, 'sharedProjects', token))
  if (!snap.exists()) return null
  const { project, config } = snap.data()
  if (!project) return null
  return { project, config }
}

export const deleteShareLink = (token) =>
  deleteDoc(doc(db, 'sharedProjects', token))
