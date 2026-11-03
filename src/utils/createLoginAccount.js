import { initializeApp, deleteApp, getApp } from 'firebase/app'
import {
  getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

// Nobody ever sees this. The officer sets their own through the email link.
function randomPassword() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export async function createLoginAccount(email) {
  const secondary = initializeApp(getApp().options, `creator-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondary)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword())
    await signOut(secondaryAuth)
    return cred.user.uid
  } finally {
    await deleteApp(secondary)
  }
}

export function sendSetupEmail(email) {
  return sendPasswordResetEmail(auth, email)
}