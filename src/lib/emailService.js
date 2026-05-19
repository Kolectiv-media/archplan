// src/lib/emailService.js — notificări email via Cloudflare Worker + SendGrid
// Client → Cloudflare Worker (workers/notify/) → SendGrid API
//
// Setează VITE_NOTIFY_WORKER_URL în Cloudflare Pages → Settings → Environment variables
// cu URL-ul worker-ului deploiat (ex: https://archplan-notify.<cont>.workers.dev)

import { getAuth } from 'firebase/auth'

const WORKER_URL = import.meta.env.VITE_NOTIFY_WORKER_URL

export async function sendAccessRequestEmail({ requesterName, requesterEmail }) {
  if (!WORKER_URL) return

  try {
    const user = getAuth().currentUser
    if (!user) return

    const token = await user.getIdToken()

    const res = await fetch(WORKER_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ type: 'access_request', requesterName, requesterEmail }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? `HTTP ${res.status}`)
    }
  } catch (err) {
    console.warn('Access request email failed (non-critical):', err.message)
  }
}

export async function sendInvitationEmail({ toEmail, inviterName, inviterEmail, projectName }) {
  if (!WORKER_URL) return
  try {
    const user = getAuth().currentUser
    if (!user) return
    const token = await user.getIdToken()
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: 'invitation', toEmail, inviterName, inviterEmail, projectName }),
    })
  } catch (err) {
    console.warn('Invitation email failed (non-critical):', err.message)
  }
}

export async function sendMentionEmail(params) {
  if (!WORKER_URL) return

  try {
    const user = getAuth().currentUser
    if (!user) return

    const token = await user.getIdToken()

    const res = await fetch(WORKER_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? `HTTP ${res.status}`)
    }
  } catch (err) {
    // Non-blocking — chat-ul funcționează și fără email
    console.warn('Email mention notification failed (non-critical):', err.message)
  }
}
