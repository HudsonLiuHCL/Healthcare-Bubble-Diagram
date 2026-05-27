import { create } from 'zustand'

/**
 * Google sign-in state. `idToken` is the Google ID token (a JWT) returned by the
 * GoogleLogin button — it is exactly what the backend (/publish) and the Revit
 * agent verify. `email` is decoded from the token for display only.
 */
interface AuthStore {
  idToken: string | null
  email: string | null
  setAuth: (idToken: string, email: string | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  idToken: null,
  email: null,
  setAuth: (idToken, email) => set({ idToken, email }),
  clear: () => set({ idToken: null, email: null }),
}))
