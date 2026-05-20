// src/MobileApp.jsx — Mobile-optimized React app for ArchPlan
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Layers, Building2, User, ArrowLeft, MoreVertical, Plus, Search,
  Send, Check, X, ChevronRight, LogOut, Sun, Moon, Monitor,
  CheckCircle, Clock, Circle, AlertCircle, FileText, Trash2,
  UserPlus, Users, Bell, CalendarDays, Share2, BarChart2,
  Zap, Flame, Droplets, Radio, Leaf, Map, MoreHorizontal
} from 'lucide-react'
import { useAuth } from './hooks/useAuth.jsx'
import { useTheme } from './hooks/useTheme.jsx'
import LoginPage from './pages/LoginPage.jsx'
import {
  listenProjects, updateProject, createProject,
  listenMessages, sendMessage as dbSendMsg, deleteMessage as dbDeleteMsg,
  checkAccess, initAccessControl, requestAccess,
  listenPendingRequests, listenApprovedUsers, listenConnected,
  listenMyInvitations, acceptInvitation, declineInvitation,
  listenProjectMembers, listenCollabProjects,
  approveAccess, rejectAccess, revokeAccess,
  publishClientView, clientToken, encodeShareToken,
  inviteToProject
} from './lib/db.js'
import { sendMentionEmail } from './lib/emailService.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8)
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const TODAY = localDate()
const parseDate = (d) => {
  if (!d) return null
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + 'T12:00:00')
  return new Date(d)
}
const fmt = d => { const p = parseDate(d); return p ? p.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }
const fmtS = d => { const p = parseDate(d); return p ? p.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) : '—' }
const fmtT = d => d instanceof Date ? d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—'
const diffD = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)
const pctOf = phases => phases.length ? Math.round(phases.filter(p => p.status === 'approved').length / phases.length * 100) : 0
const AVATAR_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f0883e', '#39d353', '#ff7b72', '#79c0ff']
const avatarColor = str => AVATAR_COLORS[String(str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
const slugify = str => String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'proiect'
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d) }
const addWorkDays = (dateStr, n) => {
  if (!dateStr) return dateStr
  const d = new Date(dateStr + 'T12:00:00')
  let added = 0
  while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++ }
  return localDate(d)
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROJECT_TYPES = [
  { id: 'arhitectura', label: 'Arhitectură', color: '#f85149' },
  { id: 'urbanism', label: 'Urbanism', color: '#3fb950' },
  { id: 'design', label: 'Design Interior', color: '#bc8cff' },
]
const projTypeColor = type => PROJECT_TYPES.find(t => t.id === type)?.color || '#58a6ff'
const projTypeLabel = type => PROJECT_TYPES.find(t => t.id === type)?.label || 'Arhitectură'

const PHASE_CYCLE = ['pending', 'in_progress', 'submitted', 'approved']
const cyclePhaseStatus = current => PHASE_CYCLE[(PHASE_CYCLE.indexOf(current) + 1) % PHASE_CYCLE.length]
const PHASE_COLORS = { pending: '#484f58', in_progress: '#d29922', submitted: '#58a6ff', approved: '#3fb950', rejected: '#f85149' }
const PHASE_LABELS = { pending: 'WIP', in_progress: 'În lucru', submitted: 'Depus', approved: 'Finalizat', rejected: 'Respins' }

const AVIZ_STATUSES = [
  { id: 'pending', label: 'De obținut', color: '#484f58' },
  { id: 'in_progress', label: 'În lucru', color: '#58a6ff' },
  { id: 'blocked', label: 'Blocat', color: '#f85149' },
  { id: 'ready', label: 'Se poate ridica', color: '#d29922' },
  { id: 'approved', label: 'Obținut', color: '#3fb950' },
  { id: 'picked_up', label: 'Ridicat', color: '#bc8cff' },
]
const AVIZ_CYCLE = ['pending', 'in_progress', 'blocked', 'ready', 'approved', 'picked_up']
const cycleAvizStatus = current => AVIZ_CYCLE[(AVIZ_CYCLE.indexOf(current) + 1) % AVIZ_CYCLE.length]
const avizMeta = id => AVIZ_STATUSES.find(s => s.id === id) || AVIZ_STATUSES[0]

const SPEC_CYCLE = ['pending', 'in_progress', 'done']
const cycleSpecStatus = current => SPEC_CYCLE[(SPEC_CYCLE.indexOf(current) + 1) % SPEC_CYCLE.length]
const SPEC_COLORS = { pending: '#484f58', in_progress: '#d29922', done: '#3fb950' }
const SPEC_LABELS = { pending: 'De realizat', in_progress: 'În lucru', done: 'Finalizat' }

const SPECIALITATI_LIST = [
  { id: 'geotehnic', label: 'Studiu geotehnic', color: '#8b949e' },
  { id: 'topografic', label: 'Studiu topografic', color: '#58a6ff' },
  { id: 'cadastral', label: 'Studiu cadastral', color: '#3fb950' },
  { id: 'oportunitate', label: 'Studiu de oportunitate', color: '#d29922' },
  { id: 'expertiza', label: 'Expertiză tehnică', color: '#f85149' },
  { id: 'audit', label: 'Audit energetic', color: '#f0883e' },
  { id: 'hidrologic', label: 'Studiu hidrologic', color: '#79c0ff' },
  { id: 'mediu_spec', label: 'Studiu de mediu', color: '#56d364' },
  { id: 'pud_puz', label: 'PUD / PUZ', color: '#bc8cff' },
  { id: 'rezistenta', label: 'Proiect rezistență', color: '#ff7b72' },
  { id: 'instalatii', label: 'Instalații', color: '#ffa657' },
  { id: 'isu', label: 'ISU — Securitate incendiu', color: '#f85149' },
]

const CHANNELS = [
  { id: 'general', label: 'General' },
  { id: 'cu', label: 'CU' },
  { id: 'avize', label: 'Avize' },
  { id: 'pt', label: 'PT' },
  { id: 'ac', label: 'Dosar AC' },
]

const INST = [
  { id: 'electrica', name: 'Electrica / E.ON / CEZ', short: 'Electrică', Icon: Zap,      color: '#d29922', validity: 24 },
  { id: 'gaz',       name: 'Distrigaz / E.ON Gaz',   short: 'Gaz',       Icon: Flame,    color: '#f0883e', validity: 24 },
  { id: 'apa',       name: 'Apă-Canal (RAJAC)',        short: 'Apă-Canal', Icon: Droplets, color: '#58a6ff', validity: 12 },
  { id: 'telecom',   name: 'Telecom',                  short: 'Telecom',   Icon: Radio,    color: '#bc8cff', validity: 24 },
  { id: 'mediu',     name: 'APM — Mediu',              short: 'Mediu',     Icon: Leaf,     color: '#3fb950', validity: 12 },
  { id: 'drumuri',   name: 'DRDP / Drumuri',           short: 'Drumuri',   Icon: Map,      color: '#8b949e', validity: 12 },
]
const instMeta = id => INST.find(i => i.id === id) || { name: id, short: id, Icon: Building2, color: '#8b949e', validity: 12 }

// ── Phase/Aviz builders ───────────────────────────────────────────────────────
const mkPhases = (start) => [
  { phaseId: 'ph_cu_doc', name: 'Documentație CU', group: 'CU', status: 'pending', startDate: start, endDate: addDays(start, 14) },
  { phaseId: 'ph_cu_dep', name: 'Depunere CU', group: 'CU', status: 'pending', startDate: addDays(start, 14), endDate: addDays(start, 17) },
  { phaseId: 'ph_cu_emit', name: 'Emitere CU', group: 'CU', status: 'pending', startDate: addDays(start, 17), endDate: addDays(start, 47) },
  { phaseId: 'ph_av_doc', name: 'Documentație avize', group: 'Avize', status: 'pending', startDate: addDays(start, 47), endDate: addDays(start, 68) },
  { phaseId: 'ph_av_dep', name: 'Depunere avize', group: 'Avize', status: 'pending', startDate: addDays(start, 68), endDate: addDays(start, 73) },
  { phaseId: 'ph_av_obt', name: 'Obținere avize', group: 'Avize', status: 'pending', startDate: addDays(start, 73), endDate: addDays(start, 103) },
  { phaseId: 'ph_pt_doc', name: 'Proiect tehnic', group: 'PT', status: 'pending', startDate: addDays(start, 103), endDate: addDays(start, 110) },
  { phaseId: 'ph_pt_ver', name: 'Verificare PT', group: 'PT', status: 'pending', startDate: addDays(start, 110), endDate: addDays(start, 117) },
  { phaseId: 'ph_ac_dep', name: 'Depunere AC', group: 'AC', status: 'pending', startDate: addDays(start, 117), endDate: addDays(start, 120) },
  { phaseId: 'ph_ac_emit', name: 'Emitere AC', group: 'AC', status: 'pending', startDate: addDays(start, 120), endDate: addDays(start, 150) },
]
const mkAvize = (start = TODAY) => INST.map(inst => ({
  instId: inst.id,
  avizId: `av_${inst.id}`,
  status: 'pending',
  dosarNr: '',
  submissionDate: null,
  estimatedDate: null,
  emissionDate: null,
  expiryDate: null,
  attachments: [],
}))

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name = '?', email = '', size = 32, style = {} }) => {
  const initials = String(name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const bg = avatarColor(email || name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0, ...style
    }}>{initials}</div>
  )
}

// ── MsgRow ────────────────────────────────────────────────────────────────────
const MsgRow = ({ msg, currentUser, T, onDelete }) => {
  const isMine = msg.uid === currentUser?.uid
  const [showDel, setShowDel] = useState(false)
  const ts = msg.createdAt ? new Date(msg.createdAt) : null

  return (
    <div
      onContextMenu={e => { e.preventDefault(); if (isMine) setShowDel(s => !s) }}
      onLongPress={() => { if (isMine) setShowDel(s => !s) }}
      style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}
    >
      {!isMine && <Avatar name={msg.displayName || '?'} size={28} />}
      <div style={{ maxWidth: '75%' }}>
        {!isMine && <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2 }}>{msg.displayName || '?'}</div>}
        <div style={{
          background: isMine ? T.accent : T.panel,
          color: isMine ? '#fff' : T.text,
          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '8px 12px', fontSize: 13, lineHeight: 1.45,
          border: isMine ? 'none' : `1px solid ${T.border}`
        }}>{msg.text}</div>
        <div style={{ fontSize: 9, color: T.textDim, marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
          {ts instanceof Date && !isNaN(ts) ? ts.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
        {showDel && isMine && (
          <button
            onClick={() => { onDelete(msg.id); setShowDel(false) }}
            style={{
              display: 'block', marginTop: 4, marginLeft: 'auto',
              background: '#f85149', border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit'
            }}
          >Șterge</button>
        )}
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, T }) => (
  <div style={{
    position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: '10px 18px', fontSize: 13, color: T.text, zIndex: 200,
    boxShadow: T.shadow, whiteSpace: 'nowrap', maxWidth: '90vw',
    overflow: 'hidden', textOverflow: 'ellipsis'
  }}>{msg}</div>
)

// ── StatusChip ────────────────────────────────────────────────────────────────
const Chip = ({ label, color, onClick, small }) => (
  <button
    onClick={onClick}
    style={{
      background: color + '22', border: `1px solid ${color}55`,
      borderRadius: 20, padding: small ? '2px 8px' : '4px 10px',
      fontSize: small ? 10 : 11, fontWeight: 600, color,
      cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
      whiteSpace: 'nowrap', minHeight: 24
    }}
  >{label}</button>
)

// ── ProgressBar ───────────────────────────────────────────────────────────────
const ProgressBar = ({ pct, T, height = 4 }) => (
  <div style={{ height, background: T.border, borderRadius: height, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? T.green : T.accent, borderRadius: height, transition: 'width .3s' }} />
  </div>
)

// ── Input helper ──────────────────────────────────────────────────────────────
const inp = T => ({
  width: '100%', background: T.bg, border: `1px solid ${T.borderLt}`,
  borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 14,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
})

// ════════════════════════════════════════════════════════════════════════════
// SCREENS
// ════════════════════════════════════════════════════════════════════════════

// ── ProjectList ───────────────────────────────────────────────────────────────
function ProjectList({ projects, collabProjects, myInvitations, onSelect, onNew, user, T, toast, onAcceptInv, onDeclineInv, onInvite, onShare }) {
  const [q, setQ] = useState('')
  const [menuProjId, setMenuProjId] = useState(null)

  const all = [
    ...projects,
    ...collabProjects.map(p => ({ ...p, _isCollab: true }))
  ]
  const filtered = q
    ? all.filter(p => (p.name + p.client + p.location).toLowerCase().includes(q.toLowerCase()))
    : all

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
      {/* Search */}
      <div style={{ padding: '12px 16px 8px', position: 'sticky', top: 0, background: '#0d0f12', zIndex: 10, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 12px' }}>
          <Search size={16} color={T.textDim} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Caută proiect…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: 14, fontFamily: 'inherit' }}
          />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} color={T.textDim} /></button>}
        </div>
      </div>

      {/* Invitation banner */}
      {myInvitations.length > 0 && (
        <div style={{ margin: '12px 16px 0', background: T.accentBg, border: `1px solid ${T.accent}44`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.accent, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bell size={14} /> {myInvitations.length} invitație{myInvitations.length > 1 ? 'i' : ''} la proiect
          </div>
          {myInvitations.map(inv => (
            <div key={inv.pid} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, fontSize: 12, color: T.text }}>
                <span style={{ fontWeight: 600 }}>{inv.projectName}</span>
                <span style={{ color: T.textDim }}> — {inv.invitedBy}</span>
              </div>
              <button onClick={() => onAcceptInv(inv)} style={{ background: T.green + '22', border: `1px solid ${T.green}55`, borderRadius: 6, color: T.green, fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
              <button onClick={() => onDeclineInv(inv)} style={{ background: T.redBg, border: `1px solid ${T.red}55`, borderRadius: 6, color: T.red, fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Refuz</button>
            </div>
          ))}
        </div>
      )}

      {/* Project cards */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.textDim, fontSize: 14 }}>
            {q ? 'Niciun proiect găsit' : 'Nu ai proiecte încă. Apasă + pentru a crea unul.'}
          </div>
        )}
        {filtered.map(p => {
          const phases = Array.isArray(p.phases) ? p.phases : []
          const pct = pctOf(phases)
          const typeColor = projTypeColor(p.type)
          const isMenuOpen = menuProjId === p.id
          return (
            <div
              key={p.id}
              style={{
                background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12,
                overflow: 'hidden', position: 'relative'
              }}
            >
              <div style={{ height: 3, background: typeColor }} />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onSelect(p)}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: T.textMd }}>{p.client}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {p._isCollab && <Chip label="Colaborator" color={T.purple} small />}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setMenuProjId(isMenuOpen ? null : p.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: T.textDim }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {isMenuOpen && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', background: T.panel, border: `1px solid ${T.border}`,
                          borderRadius: 10, boxShadow: T.shadow, zIndex: 50, minWidth: 160, overflow: 'hidden'
                        }}>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setMenuProjId(null)
                              onShare(p)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', color: T.text, fontSize: 13, textAlign: 'left', fontFamily: 'inherit' }}
                          >
                            <Share2 size={13} color={T.accent} /> Link client
                          </button>
                          {!p._isCollab && (
                            <button
                              onClick={e => { e.stopPropagation(); setMenuProjId(null); onInvite(p) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', color: T.text, fontSize: 13, textAlign: 'left', fontFamily: 'inherit' }}
                            >
                              <UserPlus size={13} color={T.accent} /> Invită colaborator
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ cursor: 'pointer' }} onClick={() => onSelect(p)}>
                  {p.location && <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>{p.location}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProgressBar pct={pct} T={T} height={4} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? T.green : T.textMd, whiteSpace: 'nowrap' }}>{pct}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: T.textDim }}>{phases.length} faze</span>
                    <span style={{ fontSize: 10, color: T.textDim }}>·</span>
                    <span style={{ fontSize: 10, color: T.textDim }}>{phases.filter(ph => ph.status === 'approved').length} finalizate</span>
                    <span style={{ fontSize: 10, color: T.textDim }}>·</span>
                    <span style={{ fontSize: 10, color: typeColor }}>{projTypeLabel(p.type)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* FAB */}
      <button
        onClick={onNew}
        style={{
          position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom) + 14px)', right: 16,
          width: 40, height: 40, borderRadius: '50%', background: T.accent,
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 3px 12px ${T.accent}55`, zIndex: 20
        }}
      >
        <Plus size={18} color="#fff" />
      </button>
    </div>
  )
}

// ── NewProjectSheet ───────────────────────────────────────────────────────────
function NewProjectSheet({ T, onClose, onSave }) {
  const [form, setForm] = useState({ type: 'arhitectura', name: '', client: '', location: '', startDate: TODAY })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} />
      <div style={{ position: 'relative', background: T.panel, borderRadius: '16px 16px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, flex: 1 }}>Proiect nou</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={T.textDim} /></button>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tip proiect</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PROJECT_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => set('type', t.id)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${form.type === t.id ? t.color : T.border}`,
                  background: form.type === t.id ? t.color + '22' : 'transparent',
                  color: form.type === t.id ? t.color : T.textMd, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {[
          { k: 'name', label: 'Nume proiect', placeholder: 'ex. Locuință P+1E' },
          { k: 'client', label: 'Client', placeholder: 'ex. Familia Popescu' },
          { k: 'location', label: 'Locație', placeholder: 'ex. Cluj-Napoca' },
        ].map(({ k, label, placeholder }) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            <input
              value={form[k]} onChange={e => set(k, e.target.value)}
              placeholder={placeholder} style={inp(T)}
            />
          </div>
        ))}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dată start</div>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inp(T)} />
        </div>

        <button
          onClick={save} disabled={saving || !form.name.trim()}
          style={{
            width: '100%', background: T.accent, border: 'none', borderRadius: 10,
            padding: '13px', color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !form.name.trim() ? 0.6 : 1, fontFamily: 'inherit'
          }}
        >{saving ? 'Se creează…' : 'Creează proiect'}</button>
      </div>
    </div>
  )
}

// ── FazeTab ───────────────────────────────────────────────────────────────────
function FazeTab({ project, ownerUid, T, toast }) {
  const phases = Array.isArray(project.phases) ? project.phases : []

  const togglePhase = async (ph) => {
    const next = cyclePhaseStatus(ph.status)
    const updated = phases.map(p => p.phaseId === ph.phaseId ? { ...p, status: next } : p)
    await updateProject(ownerUid, project.id, { phases: updated })
    toast(`${ph.name}: ${PHASE_LABELS[next]}`)
  }

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
      {phases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: T.textDim }}>Nicio fază definită</div>
      )}
      {phases.map(ph => {
        const overdue = ph.endDate && ph.endDate < TODAY && ph.status !== 'approved'
        return (
          <div key={ph.phaseId} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: `1px solid ${T.border}`
          }}>
            {/* Status circle tap */}
            <button
              onClick={() => togglePhase(ph)}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: `2px solid ${PHASE_COLORS[ph.status] || '#484f58'}`,
                background: ph.status === 'approved' ? PHASE_COLORS[ph.status] : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0
              }}
            >
              {ph.status === 'approved' && <Check size={14} color="#fff" />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: overdue ? T.red : T.text, marginBottom: 2 }}>{ph.name}</div>
              <div style={{ fontSize: 11, color: T.textDim }}>
                {fmtS(ph.startDate)} – {fmtS(ph.endDate)}
                {overdue && <span style={{ color: T.red, marginLeft: 6 }}>· Întârziat</span>}
              </div>
            </div>
            <Chip
              label={PHASE_LABELS[ph.status] || ph.status}
              color={PHASE_COLORS[ph.status] || '#484f58'}
              onClick={() => togglePhase(ph)}
              small
            />
          </div>
        )
      })}
    </div>
  )
}

// ── AvizeTab ──────────────────────────────────────────────────────────────────
function AvizeTab({ project, ownerUid, T, toast }) {
  const avize = Array.isArray(project.avize) ? project.avize : []
  const [expandedId, setExpandedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const updateAviz = async (avizId, updates) => {
    const updated = avize.map(a => a.avizId === avizId ? { ...a, ...updates } : a)
    await updateProject(ownerUid, project.id, { avize: updated })
  }

  // Mirror browser rule: ready/approved/picked_up → set emissionDate to TODAY if unset;
  // any other status → clear emissionDate
  const cycleStatus = async (e, av) => {
    e.stopPropagation()
    const next = cycleAvizStatus(av.status)
    const upd = { status: next }
    if (['ready', 'approved', 'picked_up'].includes(next)) {
      if (!av.emissionDate) upd.emissionDate = TODAY
    } else {
      upd.emissionDate = null
    }
    await updateAviz(av.avizId, upd)
    toast(`${instMeta(av.instId).short}: ${avizMeta(next).label}`)
  }

  const removeAviz = async (e, avizId) => {
    e.stopPropagation()
    await updateProject(ownerUid, project.id, { avize: avize.filter(a => a.avizId !== avizId) })
    setExpandedId(null)
    toast('Aviz eliminat')
  }

  const addAviz = async (inst) => {
    const newAv = {
      instId: inst.id, avizId: `av_${inst.id}_${uid()}`,
      status: 'pending', dosarNr: '', submissionDate: null,
      estimatedDate: null, emissionDate: null, expiryDate: null, attachments: [],
    }
    await updateProject(ownerUid, project.id, { avize: [...avize, newAv] })
    setShowAdd(false)
    toast(`${inst.short} adăugat`)
  }

  const available = INST.filter(i => !avize.some(a => a.instId === i.id))

  return (
    <div style={{ paddingBottom: 80 }}>
      {avize.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: T.textDim, fontSize: 14 }}>
          Niciun aviz adăugat
        </div>
      )}
      {avize.map(av => {
        const inst = instMeta(av.instId)
        const meta = avizMeta(av.status)
        const isExpanded = expandedId === av.avizId
        const InstIcon = inst.Icon
        const daysLeft = av.expiryDate ? Math.round((new Date(av.expiryDate) - new Date()) / 86400000) : null
        const expiryWarn = daysLeft !== null && daysLeft <= 30
        return (
          <div key={av.avizId} style={{ borderBottom: `1px solid ${T.border}` }}>
            <div
              onClick={() => setExpandedId(isExpanded ? null : av.avizId)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: inst.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <InstIcon size={16} color={inst.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
                <div style={{ fontSize: 11, color: expiryWarn ? '#f85149' : T.textDim }}>
                  {av.submissionDate ? `Dep: ${fmtS(av.submissionDate)}` : ''}
                  {av.submissionDate && av.emissionDate ? ' · ' : ''}
                  {av.emissionDate ? `Emis: ${fmtS(av.emissionDate)}` : ''}
                  {expiryWarn ? ` · ⚠ ${daysLeft < 0 ? 'EXPIRAT' : `exp. ${daysLeft}z`}` : ''}
                  {!av.submissionDate && !av.emissionDate && !expiryWarn ? inst.short : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Chip label={meta.label} color={meta.color} onClick={e => cycleStatus(e, av)} small />
                <ChevronRight size={16} color={T.textDim} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
              </div>
            </div>
            {isExpanded && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Nr. dosar */}
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Nr. dosar</div>
                  <input type="text" value={av.dosarNr || ''} placeholder="ex. 1234/2025"
                    onChange={e => updateAviz(av.avizId, { dosarNr: e.target.value })} style={inp(T)} />
                </div>

                {/* Submission date — auto-computes estimatedDate (+30 working days) */}
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Data depunere documentație</div>
                  <input type="date" value={av.submissionDate || ''}
                    onChange={e => {
                      const sd = e.target.value
                      const upd = { submissionDate: sd }
                      if (sd) upd.estimatedDate = addWorkDays(sd, 30)
                      else upd.estimatedDate = null
                      updateAviz(av.avizId, upd)
                    }} style={inp(T)} />
                </div>

                {/* Estimated date — auto-filled, still editable */}
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Estimare emitere (≈30 zile lucrătoare)
                    {av.submissionDate && !av.estimatedDate && (
                      <button onClick={() => updateAviz(av.avizId, { estimatedDate: addWorkDays(av.submissionDate, 30) })}
                        style={{ fontSize: 10, background: 'none', border: `1px solid ${T.accent}44`, color: T.accent, borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        +30 zile
                      </button>
                    )}
                  </div>
                  <input type="date" value={av.estimatedDate || ''}
                    onChange={e => updateAviz(av.avizId, { estimatedDate: e.target.value })} style={inp(T)} />
                </div>

                {/* Emission date */}
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Data emitere aviz</div>
                  <input type="date" value={av.emissionDate || ''}
                    onChange={e => updateAviz(av.avizId, { emissionDate: e.target.value })} style={inp(T)} />
                </div>

                {/* Expiry date with validity shortcuts and warning */}
                <div>
                  <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, color: expiryWarn ? '#f85149' : T.textDim }}>
                    Data expirare
                    {daysLeft !== null && daysLeft <= 30 && (
                      <span style={{ fontWeight: 700 }}>{daysLeft < 0 ? '⚠ EXPIRAT' : `⚠ ${daysLeft}z`}</span>
                    )}
                  </div>
                  <input type="date" value={av.expiryDate || ''} min={av.emissionDate || undefined}
                    onChange={e => {
                      if (av.emissionDate && e.target.value && e.target.value < av.emissionDate) return
                      updateAviz(av.avizId, { expiryDate: e.target.value })
                    }}
                    style={{ ...inp(T), borderColor: expiryWarn ? '#f85149' : undefined }} />
                  {av.emissionDate && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {[12, 24].map(m => (
                        <button key={m}
                          onClick={() => {
                            const b = new Date(av.emissionDate + 'T12:00:00')
                            b.setMonth(b.getMonth() + m)
                            updateAviz(av.avizId, { expiryDate: localDate(b) })
                          }}
                          style={{ flex: 1, background: 'none', border: `1px solid ${T.borderLt}`, borderRadius: 6, padding: '7px', color: T.textMd, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >+{m} luni</button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={e => removeAviz(e, av.avizId)}
                  style={{ background: 'none', border: '1px solid #f8514944', borderRadius: 8, padding: '8px', color: '#f85149', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Elimină aviz
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Add aviz section */}
      <div style={{ padding: '12px 16px' }}>
        {!showAdd ? (
          available.length > 0 && (
            <button onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: `1px dashed ${T.borderLt}`, borderRadius: 8, padding: '10px 14px', color: T.textMd, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
              <Plus size={15} color={T.textMd} /> Adaugă aviz
            </button>
          )
        ) : (
          <div>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>Selectează instituție:</div>
            {available.map(inst => {
              const InstIcon = inst.Icon
              return (
                <button key={inst.id} onClick={() => addAviz(inst)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', marginBottom: 6, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: inst.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <InstIcon size={13} color={inst.color} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{inst.short}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>{inst.name}</div>
                  </div>
                </button>
              )
            })}
            <button onClick={() => setShowAdd(false)}
              style={{ background: 'none', border: 'none', color: T.textDim, fontSize: 12, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>
              Anulează
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SpecialitatiTab ───────────────────────────────────────────────────────────
function SpecialitatiTab({ project, ownerUid, T, toast }) {
  const specs = Array.isArray(project.specialitati) ? project.specialitati : []
  const [expandedId, setExpandedId] = useState(null)

  const cycleStatus = async (e, sp) => {
    e.stopPropagation()
    const next = cycleSpecStatus(sp.status || 'pending')
    const updated = specs.map(s => s.specId === sp.specId ? { ...s, status: next } : s)
    await updateProject(ownerUid, project.id, { specialitati: updated })
    toast(`${sp.customName || sp.typeId}: ${SPEC_LABELS[next]}`)
  }

  const updateField = async (specId, field, value) => {
    const updated = specs.map(s => s.specId === specId ? { ...s, [field]: value } : s)
    await updateProject(ownerUid, project.id, { specialitati: updated })
  }

  if (specs.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: T.textDim, fontSize: 14 }}>
        Nicio specialitate adăugată
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
      {specs.map(sp => {
        const type = SPECIALITATI_LIST.find(s => s.id === sp.typeId)
        const color = type?.color || '#8b949e'
        const label = sp.customName || type?.label || sp.typeId
        const status = sp.status || 'pending'
        const isExpanded = expandedId === sp.specId
        return (
          <div key={sp.specId} style={{ borderBottom: `1px solid ${T.border}` }}>
            <div
              onClick={() => setExpandedId(isExpanded ? null : sp.specId)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
                {sp.responsible && <div style={{ fontSize: 11, color: T.textDim }}>{sp.responsible}</div>}
                {sp.dueDate && <div style={{ fontSize: 11, color: T.textDim }}>Termen: {fmtS(sp.dueDate)}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Chip label={SPEC_LABELS[status]} color={SPEC_COLORS[status]} onClick={e => cycleStatus(e, sp)} small />
                <ChevronRight size={16} color={T.textDim} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
              </div>
            </div>
            {isExpanded && (
              <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Responsabil</div>
                  <input
                    type="text"
                    value={sp.responsible || ''}
                    placeholder="Nume responsabil"
                    onChange={e => updateField(sp.specId, 'responsible', e.target.value)}
                    style={inp(T)}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Termen</div>
                  <input
                    type="date"
                    value={sp.dueDate || ''}
                    onChange={e => updateField(sp.specId, 'dueDate', e.target.value)}
                    style={inp(T)}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4 }}>Note</div>
                  <textarea
                    value={sp.notes || ''}
                    placeholder="Note…"
                    rows={3}
                    onChange={e => updateField(sp.specId, 'notes', e.target.value)}
                    style={{ ...inp(T), resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── ChatTab ───────────────────────────────────────────────────────────────────
function ChatTab({ project, ownerUid, user, T, toast }) {
  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const unsub = listenMessages(ownerUid, project.id, channel, msgs => {
      setMessages(msgs.map(m => ({
        ...m,
        createdAt: m.createdAt ? new Date(m.createdAt) : null
      })))
    })
    return unsub
  }, [ownerUid, project.id, channel])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  // Detect keyboard open via visual viewport
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => {
      const diff = window.innerHeight - vv.height
      setKbOpen(diff > 150)
    }
    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
  }, [])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await dbSendMsg(ownerUid, project.id, channel, {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        text: text.trim(),
        attachments: [],
      })
      setText('')
    } catch {
      toast('Eroare la trimitere')
    }
    setSending(false)
  }

  const deleteMsg = async (msgId) => {
    try {
      await dbDeleteMsg(ownerUid, project.id, channel, msgId)
    } catch {
      toast('Eroare la ștergere')
    }
  }

  const bottomPad = kbOpen ? 0 : 60 + 'px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Channel selector */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${T.border}`,
        overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0
      }}>
        {CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: `1px solid ${channel === ch.id ? T.accent : T.border}`,
              background: channel === ch.id ? T.accentBg : 'transparent',
              color: channel === ch.id ? T.accent : T.textMd,
              fontSize: 12, fontWeight: channel === ch.id ? 700 : 400,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >{ch.label}</button>
        ))}
      </div>

      {/* Messages */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: T.textDim, fontSize: 13, paddingTop: 32 }}>
            Niciun mesaj în #{CHANNELS.find(c => c.id === channel)?.label || channel}
          </div>
        )}
        {messages.map(msg => (
          <MsgRow key={msg.id} msg={msg} currentUser={user} T={T} onDelete={deleteMsg} />
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        paddingBottom: `calc(10px + ${kbOpen ? '0px' : 'env(safe-area-inset-bottom, 0px)'})`,
        borderTop: `1px solid ${T.border}`, background: T.sidebar, flexShrink: 0
      }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Mesaj…"
          style={{
            flex: 1, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 20,
            padding: '9px 14px', color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit'
          }}
        />
        <button
          onClick={send} disabled={!text.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: '50%', background: T.accent, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: !text.trim() || sending ? 'not-allowed' : 'pointer',
            opacity: !text.trim() || sending ? 0.5 : 1, flexShrink: 0
          }}
        >
          <Send size={16} color="#fff" />
        </button>
      </div>
    </div>
  )
}

// ── ProjectDetail ─────────────────────────────────────────────────────────────
function ProjectDetail({ project, user, T, toast, onBack, onShare }) {
  const [tab, setTab] = useState('faze')
  const [menuOpen, setMenuOpen] = useState(false)

  const ownerUid = project._isCollab ? project.ownerUid : user.uid
  const phases = Array.isArray(project.phases) ? project.phases : []
  const pct = pctOf(phases)

  const TABS = [
    { id: 'faze', label: 'Faze' },
    { id: 'avize', label: 'Avize' },
    { id: 'specialitati', label: 'Specialități' },
    { id: 'chat', label: 'Chat' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sticky header */}
      <div style={{ background: T.sidebar, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
          >
            <ArrowLeft size={22} color={T.text} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
            {project.client && <div style={{ fontSize: 11, color: T.textDim }}>{project.client}</div>}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
            >
              <MoreVertical size={20} color={T.textDim} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', background: T.panel, border: `1px solid ${T.border}`,
                borderRadius: 10, boxShadow: T.shadow, zIndex: 50, minWidth: 160, overflow: 'hidden'
              }}>
                <button
                  onClick={() => { setMenuOpen(false); onShare?.(project) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: T.text, fontSize: 13, textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <Share2 size={14} color={T.accent} />
                  Link client
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Progress */}
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: T.textDim }}>Progres general</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? T.green : T.accent }}>{pct}%</span>
          </div>
          <ProgressBar pct={pct} T={T} height={5} />
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 12px', gap: 4, borderTop: `1px solid ${T.border}` }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? T.accent : 'transparent'}`,
                color: tab === t.id ? T.accent : T.textMd, fontWeight: tab === t.id ? 700 : 400,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: tab === 'chat' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {tab === 'faze' && <FazeTab project={project} ownerUid={ownerUid} T={T} toast={toast} />}
        {tab === 'avize' && <AvizeTab project={project} ownerUid={ownerUid} T={T} toast={toast} />}
        {tab === 'specialitati' && <SpecialitatiTab project={project} ownerUid={ownerUid} T={T} toast={toast} />}
        {tab === 'chat' && <ChatTab project={project} ownerUid={ownerUid} user={user} T={T} toast={toast} />}
      </div>
    </div>
  )
}

// ── TodayScreen ───────────────────────────────────────────────────────────────
function TodayScreen({ projects, collabProjects, T, onSelectProject }) {
  const [ganttProjectId, setGanttProjectId] = useState(null)
  const allProjects = [...projects, ...collabProjects.map(p => ({ ...p, _isCollab: true }))]

  // Collect phases due today or overdue (not approved)
  const NEXT_7 = addDays(TODAY, 7)
  const dueSoon = []
  allProjects.forEach(p => {
    const phases = Array.isArray(p.phases) ? p.phases : []
    phases.forEach(ph => {
      if (ph.status === 'approved') return
      if (!ph.endDate) return
      if (ph.endDate < TODAY || ph.endDate <= NEXT_7) {
        dueSoon.push({ ...ph, projectName: p.name, project: p, overdue: ph.endDate < TODAY })
      }
    })
  })
  dueSoon.sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''))

  // Gantt
  const ganttProj = ganttProjectId ? allProjects.find(p => p.id === ganttProjectId) : null
  const ganttPhases = ganttProj ? (Array.isArray(ganttProj.phases) ? ganttProj.phases : []) : []
  const ganttStart = ganttPhases.length ? ganttPhases.reduce((m, ph) => ph.startDate && ph.startDate < m ? ph.startDate : m, ganttPhases[0].startDate || TODAY) : TODAY
  const ganttEnd = ganttPhases.length ? ganttPhases.reduce((m, ph) => ph.endDate && ph.endDate > m ? ph.endDate : m, ganttPhases[0].endDate || TODAY) : TODAY
  const ganttTotalDays = Math.max(diffD(ganttStart, ganttEnd), 1)
  const groups = ganttPhases.length ? Array.from(new Set(ganttPhases.map(ph => ph.group).filter(Boolean))) : []

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

      {/* ── Due soon ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Azi &amp; Săptămâna aceasta
        </div>
        {dueSoon.length === 0 ? (
          <div style={{ color: T.textDim, fontSize: 13, paddingBottom: 12 }}>Nicio fază scadentă în curând</div>
        ) : (
          dueSoon.slice(0, 12).map((ph, i) => (
            <div
              key={i}
              onClick={() => onSelectProject(ph.project)}
              style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '9px 0', borderBottom: `1px solid ${T.border}`, cursor: 'pointer'
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ph.overdue ? '#f85149' : (PHASE_COLORS[ph.status] || '#484f58'), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: ph.overdue ? '#f85149' : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.name}</div>
                <div style={{ fontSize: 11, color: T.textDim }}>{ph.projectName}</div>
              </div>
              <div style={{ fontSize: 11, color: ph.overdue ? '#f85149' : T.textDim, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {ph.overdue ? 'Întârziat' : fmtS(ph.endDate)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Project progress ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Evoluție proiecte
        </div>
        {allProjects.length === 0 ? (
          <div style={{ color: T.textDim, fontSize: 13 }}>Niciun proiect</div>
        ) : allProjects.map(p => {
          const phases = Array.isArray(p.phases) ? p.phases : []
          const pct = pctOf(phases)
          const avize = Array.isArray(p.avize) ? p.avize : []
          const specs = Array.isArray(p.specialitati) ? p.specialitati : []
          const avizeDone = avize.filter(a => a.status === 'approved' || a.status === 'picked_up').length
          const specsDone = specs.filter(s => s.status === 'done').length
          const typeColor = projTypeColor(p.type)
          return (
            <div key={p.id} style={{
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: '12px 14px', marginBottom: 8, position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: typeColor }} />
              <div style={{ paddingLeft: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: T.textDim }}>Faze finalizate</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? '#3fb950' : T.accent }}>{pct}%</span>
                </div>
                <ProgressBar pct={pct} T={T} height={5} />
                {(avize.length > 0 || specs.length > 0) && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                    {avize.length > 0 && (
                      <div style={{ fontSize: 10, color: T.textDim }}>
                        Avize <span style={{ color: T.text, fontWeight: 600 }}>{avizeDone}/{avize.length}</span>
                      </div>
                    )}
                    {specs.length > 0 && (
                      <div style={{ fontSize: 10, color: T.textDim }}>
                        Specialități <span style={{ color: T.text, fontWeight: 600 }}>{specsDone}/{specs.length}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Gantt / Timeline ── */}
      <div style={{ padding: '20px 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          Timeline / Gantt
        </div>
        {/* Project selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {allProjects.map(p => (
            <button
              key={p.id}
              onClick={() => setGanttProjectId(p.id === ganttProjectId ? null : p.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit',
                border: `1px solid ${ganttProjectId === p.id ? T.accent : T.border}`,
                background: ganttProjectId === p.id ? T.accentBg : 'transparent',
                color: ganttProjectId === p.id ? T.accent : T.textMd, cursor: 'pointer'
              }}
            >{p.name}</button>
          ))}
        </div>
        {!ganttProj && (
          <div style={{ color: T.textDim, fontSize: 13 }}>Selectează un proiect pentru a vedea timeline-ul</div>
        )}
        {ganttProj && ganttPhases.length > 0 && (
          <div>
            {groups.map(group => {
              const gPhases = ganttPhases.filter(ph => ph.group === group)
              return (
                <div key={group} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{group}</div>
                  {gPhases.map(ph => {
                    const startOff = Math.max(diffD(ganttStart, ph.startDate || ganttStart), 0)
                    const duration = Math.max(diffD(ph.startDate || ganttStart, ph.endDate || ganttEnd), 1)
                    const leftPct = (startOff / ganttTotalDays) * 100
                    const widthPct = Math.min((duration / ganttTotalDays) * 100, 100 - leftPct)
                    const color = PHASE_COLORS[ph.status] || '#484f58'
                    const todayPct = TODAY >= ganttStart && TODAY <= ganttEnd
                      ? (diffD(ganttStart, TODAY) / ganttTotalDays) * 100 : null
                    return (
                      <div key={ph.phaseId} style={{ marginBottom: 5 }}>
                        <div style={{ fontSize: 10, color: T.textMd, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.name}</div>
                        <div style={{ height: 16, background: T.border, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, height: '100%', background: color, borderRadius: 3, minWidth: 4, opacity: 0.88 }} />
                          {todayPct !== null && (
                            <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1.5, background: '#f85149', opacity: 0.8 }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: T.textDim }}>{fmtS(ganttStart)}</span>
              <span style={{ fontSize: 9, color: T.textDim }}>{fmtS(ganttEnd)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ShareConfigSheet ─────────────────────────────────────────────────────────
function ShareConfigSheet({ project, ownerUid, user, T, toast, onClose }) {
  const [showPhases, setShowPhases] = useState(true)
  const [showAvize, setShowAvize]   = useState(true)
  const [showSpec, setShowSpec]     = useState(true)
  const [clientNote, setClientNote] = useState(project.clientNote || '')
  const [generatedUrl, setGeneratedUrl] = useState(null)
  const [isPermanent, setIsPermanent] = useState(false)
  const urlInputRef = useRef(null)

  const copyUrl = (url) => {
    // Try modern clipboard API
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => toast('Link copiat!')).catch(() => legacyCopy(url))
    } else {
      legacyCopy(url)
    }
  }

  const legacyCopy = (url) => {
    // Fallback: create a temporary input, select, execCommand
    const el = document.createElement('textarea')
    el.value = url
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.focus(); el.select()
    try { document.execCommand('copy'); toast('Link copiat!') } catch { toast('Copiați manual linkul de sus') }
    document.body.removeChild(el)
  }

  // Synchronous: generate base64url immediately (always works, no network)
  // then try Firestore in background for a short permanent slug URL
  const generate = () => {
    const config = { showPhases, showAvize, showSpec }
    const proj = clientNote.trim() ? { ...project, clientNote: clientNote.trim() } : project

    // Step 1: generate URL instantly (sync, no async, clipboard works)
    const b64Tok = encodeShareToken(proj, config, clientNote)
    const b64Url = `${window.location.origin}/c/${b64Tok}`
    setGeneratedUrl(b64Url)
    setIsPermanent(false)
    copyUrl(b64Url)

    // Step 2: try Firestore in background for short permanent link
    const slugTok = clientToken(project)
    publishClientView(slugTok, ownerUid, project.id, proj, config)
      .then(() => {
        const permUrl = `${window.location.origin}/c/${slugTok}`
        setGeneratedUrl(permUrl)
        setIsPermanent(true)
      })
      .catch(() => {}) // base64 URL already works — ignore Firestore failure
  }

  const Toggle = ({ label, value, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 14, color: T.text }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? T.accent : T.border, position: 'relative', transition: 'background .2s'
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20,
          borderRadius: '50%', background: '#fff', transition: 'left .2s'
        }} />
      </button>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} />
      <div style={{ position: 'relative', background: T.panel, borderRadius: '16px 16px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Link client</div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{project.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={T.textDim} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Secțiuni vizibile</div>
          <Toggle label="Faze proiect" value={showPhases} onChange={setShowPhases} />
          <Toggle label="Avize" value={showAvize} onChange={setShowAvize} />
          <Toggle label="Specialități" value={showSpec} onChange={setShowSpec} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notă pentru client (opțional)</div>
          <textarea
            value={clientNote}
            onChange={e => setClientNote(e.target.value)}
            placeholder="Scrieți un mesaj pentru client…"
            rows={3}
            style={{ ...inp(T), resize: 'vertical', minHeight: 72 }}
          />
        </div>

        {generatedUrl && (
          <div style={{ background: `${T.accent}14`, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isPermanent ? '✓ Link permanent' : 'Link generat'}
              </div>
            </div>
            {/* Selectable input — user can long-press to copy on iOS */}
            <input
              ref={urlInputRef}
              readOnly
              value={generatedUrl}
              onFocus={e => e.target.select()}
              style={{
                width: '100%', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: '8px 10px', fontSize: 11, color: T.text, fontFamily: 'monospace',
                boxSizing: 'border-box', marginBottom: 8
              }}
            />
            <button
              onClick={() => copyUrl(generatedUrl)}
              style={{
                width: '100%', background: T.accent, border: 'none', borderRadius: 6,
                padding: '10px', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Copiază link
            </button>
          </div>
        )}

        <button
          onClick={generate}
          style={{
            width: '100%', background: generatedUrl ? T.border : T.accent, border: 'none', borderRadius: 10,
            padding: '13px', color: generatedUrl ? T.text : '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', fontFamily: 'inherit'
          }}
        >
          <Share2 size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {generatedUrl ? 'Regenerează link' : 'Generează link'}
        </button>
      </div>
    </div>
  )
}

// ── InviteSheet ───────────────────────────────────────────────────────────────
function InviteSheet({ project, user, T, toast, onClose }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!email.trim() || sending) return
    setSending(true)
    try {
      await inviteToProject(user.uid, project.id, project.name, user.email, email.trim().toLowerCase())
      toast('Invitație trimisă!')
      onClose()
    } catch (err) {
      toast('Eroare la trimitere invitație')
    }
    setSending(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} />
      <div style={{ position: 'relative', background: T.panel, borderRadius: '16px 16px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Invită colaborator</div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{project.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={T.textDim} /></button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email colaborator</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="colaborator@exemplu.ro"
            autoFocus
            style={inp(T)}
          />
        </div>
        <button
          onClick={send} disabled={!email.trim() || sending}
          style={{
            width: '100%', background: T.accent, border: 'none', borderRadius: 10,
            padding: '13px', color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: !email.trim() || sending ? 'not-allowed' : 'pointer',
            opacity: !email.trim() || sending ? 0.6 : 1, fontFamily: 'inherit'
          }}
        >{sending ? 'Se trimite…' : 'Trimite invitație'}</button>
      </div>
    </div>
  )
}

// ── ProfileScreen ─────────────────────────────────────────────────────────────
function ProfileScreen({ user, projects, collabProjects, pendingRequests, approvedUsers, T, mode, setMode, logout, toast, onApprove, onReject }) {
  const allProjects = [...projects, ...collabProjects]
  const avizeObtained = allProjects.reduce((n, p) => n + (Array.isArray(p.avize) ? p.avize.filter(a => a.status === 'approved' || a.status === 'picked_up').length : 0), 0)
  const activeProjects = projects.filter(p => {
    const phases = Array.isArray(p.phases) ? p.phases : []
    const pct = pctOf(phases)
    return pct > 0 && pct < 100
  }).length

  const displayName = user.displayName || user.email?.split('@')[0] || 'User'
  const MODES = [
    { id: 'light', label: 'Luminos', Icon: Sun },
    { id: 'dark', label: 'Întunecat', Icon: Moon },
    { id: 'auto', label: 'Auto', Icon: Monitor },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
      {/* Profile header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 20px' }}>
        <Avatar name={displayName} email={user.email || ''} size={72} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{displayName}</div>
        <div style={{ fontSize: 13, color: T.textDim }}>{user.email}</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 0, margin: '0 16px 20px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {[
          { label: 'Proiecte', value: projects.length },
          { label: 'Active', value: activeProjects },
          { label: 'Avize obținute', value: avizeObtained },
        ].map((s, i) => (
          <div key={s.label} style={{
            flex: 1, padding: '16px 8px', textAlign: 'center',
            borderRight: i < 2 ? `1px solid ${T.border}` : 'none'
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.accent }}>{s.value}</div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Theme */}
      <div style={{ margin: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Temă</div>
        <div style={{ display: 'flex', gap: 6, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4 }}>
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px',
                borderRadius: 8, border: 'none',
                background: mode === id ? T.accentBg : 'transparent',
                color: mode === id ? T.accent : T.textDim, cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              <Icon size={16} />
              <span style={{ fontSize: 10, fontWeight: mode === id ? 700 : 400 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pending access requests */}
      {pendingRequests.length > 0 && (
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cereri de acces ({pendingRequests.length})
          </div>
          {pendingRequests.map(req => (
            <div key={req.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8
            }}>
              <Avatar name={req.name || req.email} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{req.name || 'Necunoscut'}</div>
                <div style={{ fontSize: 11, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.email}</div>
              </div>
              <button onClick={() => onApprove(req.email)} style={{ background: T.greenBg, border: `1px solid ${T.green}55`, borderRadius: 6, color: T.green, fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Aprobă</button>
              <button onClick={() => onReject(req.email)} style={{ background: T.redBg, border: `1px solid ${T.red}55`, borderRadius: 6, color: T.red, fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Refuză</button>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      <div style={{ margin: '0 16px 16px' }}>
        <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Utilizatori activi ({approvedUsers.length})
        </div>
        {approvedUsers.length === 0 && (
          <div style={{ fontSize: 12, color: T.textDim, textAlign: 'center', padding: '16px 0' }}>Niciun utilizator aprobat</div>
        )}
        {approvedUsers.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8
          }}>
            <Avatar name={u.name || u.email} email={u.email || ''} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{u.name || u.email?.split('@')[0]}</div>
              <div style={{ fontSize: 11, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div style={{ margin: '0 16px' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '13px', background: T.redBg, border: `1px solid ${T.red}44`,
            borderRadius: 10, color: T.red, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'inherit'
          }}
        >
          <LogOut size={16} />
          Deconectare
        </button>
      </div>
    </div>
  )
}

// ── AccessPending ─────────────────────────────────────────────────────────────
function AccessPending({ user, T, logout }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: T.amberBg, border: `1px solid ${T.amber}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Clock size={28} color={T.amber} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Acces în așteptare</div>
      <div style={{ fontSize: 14, color: T.textDim, textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
        Contul tău ({user?.email}) este în așteptarea aprobării de către administrator. Vei fi notificat prin email.
      </div>
      <button
        onClick={logout}
        style={{
          marginTop: 32, padding: '12px 24px', background: T.redBg, border: `1px solid ${T.red}44`,
          borderRadius: 10, color: T.red, fontWeight: 600, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit'
        }}
      >Deconectare</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN MobileApp
// ════════════════════════════════════════════════════════════════════════════
export default function MobileApp() {
  const { user, loading: authLoading, logout } = useAuth()
  const { T, mode, setMode } = useTheme()

  // Navigation
  const [view, setView] = useState('projects')    // 'projects' | 'project' | 'today' | 'profile'
  const [selProjId, setSelProjId] = useState(null)

  // Data
  const [projects, setProjects] = useState([])
  const [collabProjects, setCollabProjects] = useState([])
  const [myInvitations, setMyInvitations] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [approvedUsers, setApprovedUsers] = useState([])
  const [accessStatus, setAccessStatus] = useState(null)   // null | 'approved' | 'first_user' | 'not_approved'

  // UI
  const [toastMsg, setToastMsg] = useState(null)
  const [showNewProj, setShowNewProj] = useState(false)
  const [inviteProject, setInviteProject] = useState(null)
  const [shareConfigProject, setShareConfigProject] = useState(null)
  const [kbOpen, setKbOpen] = useState(false)

  const toast = useCallback((msg, ms = 3500) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), ms)
  }, [])

  // ── Access check ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setAccessStatus(null); return }
    checkAccess(user.email).then(status => {
      if (status === 'first_user') {
        initAccessControl(user.email).then(() => setAccessStatus('approved'))
      } else {
        setAccessStatus(status)
      }
      if (status === 'not_approved') {
        requestAccess(user.email, user.displayName || user.email.split('@')[0])
      }
    })
  }, [user])

  // ── Data listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || accessStatus !== 'approved') return
    const unsub = listenProjects(user.uid, ps => setProjects(ps))
    return unsub
  }, [user, accessStatus])

  useEffect(() => {
    if (!user || accessStatus !== 'approved') return
    const unsub = listenCollabProjects(user.uid, ps => setCollabProjects(ps))
    return unsub
  }, [user, accessStatus])

  useEffect(() => {
    if (!user || accessStatus !== 'approved') return
    const unsub = listenMyInvitations(user.email, invs => setMyInvitations(invs))
    return unsub
  }, [user, accessStatus])

  useEffect(() => {
    if (!user || accessStatus !== 'approved') return
    const unsub = listenPendingRequests(reqs => setPendingRequests(reqs))
    return unsub
  }, [user, accessStatus])

  useEffect(() => {
    if (!user || accessStatus !== 'approved') return
    const unsub = listenApprovedUsers(u => setApprovedUsers(u))
    return unsub
  }, [user, accessStatus])

  // ── Keyboard detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => {
      const diff = window.innerHeight - vv.height
      setKbOpen(diff > 150)
    }
    vv.addEventListener('resize', handler)
    return () => vv.removeEventListener('resize', handler)
  }, [])

  // ── Invitation handlers ────────────────────────────────────────────────────
  const handleAcceptInv = async (inv) => {
    try {
      await acceptInvitation(inv.ownerUid, inv.projectId, user.uid, user.email, user.displayName || user.email.split('@')[0], inv.invitedBy)
      toast('Invitație acceptată!')
    } catch {
      toast('Eroare la acceptare')
    }
  }

  const handleDeclineInv = async (inv) => {
    try {
      await declineInvitation(user.email, inv.projectId)
      toast('Invitație refuzată')
    } catch {
      toast('Eroare')
    }
  }

  // ── Access request handlers ────────────────────────────────────────────────
  const handleApprove = async (email) => {
    try {
      await approveAccess(email)
      toast(`${email} aprobat`)
    } catch {
      toast('Eroare la aprobare')
    }
  }

  const handleReject = async (email) => {
    try {
      await rejectAccess(email)
      toast(`${email} refuzat`)
    } catch {
      toast('Eroare la refuz')
    }
  }

  // ── New project ────────────────────────────────────────────────────────────
  const handleCreateProject = async (form) => {
    const start = form.startDate || TODAY
    const slug = slugify(form.name)
    const projId = `${slug}-${uid()}`
    const data = {
      type: form.type,
      name: form.name.trim(),
      client: form.client.trim(),
      location: form.location.trim(),
      startDate: start,
      phases: mkPhases(start),
      avize: mkAvize(start),
      specialitati: [],
    }
    try {
      await createProject(user.uid, data)
      toast('Proiect creat cu succes!')
    } catch {
      toast('Eroare la creare')
    }
  }

  // ── Navigate to project ────────────────────────────────────────────────────
  const handleSelectProject = (p) => {
    setSelProjId(p.id)
    setView('project')
  }

  // ── Derive selected project from live state ────────────────────────────────
  const selectedProject = selProjId
    ? ([...projects, ...collabProjects].find(p => p.id === selProjId) || null)
    : null

  // ── Render guards ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${T.border}`, borderTopColor: T.accent,
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <LoginPage T={T} />

  if (accessStatus === null) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${T.border}`, borderTopColor: T.accent,
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (accessStatus === 'not_approved') {
    return <AccessPending user={user} T={T} logout={logout} />
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'projects', label: 'Proiecte', Icon: Layers },
    { id: 'today', label: 'Azi', Icon: CalendarDays },
    { id: 'profile', label: 'Profil', Icon: User },
  ]

  // ── Bottom nav should hide when keyboard open ──────────────────────────────
  const showBottomNav = !kbOpen && view !== 'project'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bg, display: 'flex', flexDirection: 'column',
      fontFamily: "'Geist', 'Helvetica Neue', sans-serif", color: T.text,
      fontSize: 14, overflow: 'hidden'
    }}>
      {/* Toast */}
      {toastMsg && <Toast msg={toastMsg} T={T} />}

      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar (for non-project views) */}
        {view !== 'project' && (
          <div style={{
            background: T.sidebar, borderBottom: `1px solid ${T.border}`,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            paddingTop: `calc(14px + env(safe-area-inset-top, 0px))`
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${T.accent},${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: '-.3px' }}>ArchPlan</div>
            </div>
            {view === 'projects' && (
              <div style={{ fontSize: 11, color: T.textDim }}>
                {projects.length} proiect{projects.length !== 1 ? 'e' : ''}
              </div>
            )}
          </div>
        )}

        {/* Screen content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'project' && selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              user={user}
              T={T}
              toast={toast}
              onBack={() => { setView('projects'); setSelProjId(null) }}
              onShare={(p) => setShareConfigProject(p)}
            />
          ) : view === 'projects' ? (
            <ProjectList
              projects={projects}
              collabProjects={collabProjects}
              myInvitations={myInvitations}
              onSelect={handleSelectProject}
              onNew={() => setShowNewProj(true)}
              user={user}
              T={T}
              toast={toast}
              onAcceptInv={handleAcceptInv}
              onDeclineInv={handleDeclineInv}
              onInvite={(p) => setInviteProject(p)}
              onShare={(p) => setShareConfigProject(p)}
            />
          ) : view === 'today' ? (
            <TodayScreen projects={projects} collabProjects={collabProjects} T={T} onSelectProject={handleSelectProject} />
          ) : view === 'profile' ? (
            <ProfileScreen
              user={user}
              projects={projects}
              collabProjects={collabProjects}
              pendingRequests={pendingRequests}
              approvedUsers={approvedUsers}
              T={T}
              mode={mode}
              setMode={setMode}
              logout={logout}
              toast={toast}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : null}
        </div>
      </div>

      {/* Bottom nav */}
      {showBottomNav && (
        <nav style={{
          position: 'relative', height: `calc(60px + env(safe-area-inset-bottom))`,
          background: T.sidebar, borderTop: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'flex-start', paddingTop: 8, zIndex: 50, flexShrink: 0
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: view === tab.id ? T.accent : T.textDim, padding: '0 4px',
                minHeight: 44, fontFamily: 'inherit'
              }}
            >
              <tab.Icon size={22} />
              <span style={{ fontSize: 10, fontWeight: view === tab.id ? 600 : 400 }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* New project sheet */}
      {showNewProj && (
        <NewProjectSheet T={T} onClose={() => setShowNewProj(false)} onSave={handleCreateProject} />
      )}

      {/* Invite collaborator sheet */}
      {inviteProject && (
        <InviteSheet project={inviteProject} user={user} T={T} toast={toast} onClose={() => setInviteProject(null)} />
      )}

      {/* Share config sheet */}
      {shareConfigProject && (
        <ShareConfigSheet
          project={shareConfigProject}
          ownerUid={shareConfigProject._isCollab ? shareConfigProject.ownerUid : user.uid}
          user={user}
          T={T}
          toast={toast}
          onClose={() => setShareConfigProject(null)}
        />
      )}
    </div>
  )
}
