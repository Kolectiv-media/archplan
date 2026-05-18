import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyA7N1i5B_2P6_n1XrNjbTqVwHpJQQblSDY",
  authDomain: "archplan-kolectiv.firebaseapp.com",
  projectId: "archplan-kolectiv",
  storageBucket: "archplan-kolectiv.firebasestorage.app",
  messagingSenderId: "808417198301",
  appId: "1:808417198301:web:96d692121a9d460b761b34",
  measurementId: "G-KSRQ3K2TEF"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// persistentLocalCache: data survives page refresh via IndexedDB — projects
// never disappear on reload. persistentMultipleTabManager: each tab/device
// maintains its own live Firestore connection for real-time cross-device sync.
// experimentalAutoDetectLongPolling: tries WebSocket first, falls back to
// HTTP long-poll automatically — avoids the force-longpoll bug that prevented
// the server connection from ever being established.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
export const messaging = null
export async function requestPushPermission() { return null }
export function onPushMessage() { return () => {} }

export async function forceFirestoreSync() {
  try {
    await disableNetwork(db)
    await enableNetwork(db)
  } catch (e) {
    console.warn('forceFirestoreSync:', e)
  }
}
