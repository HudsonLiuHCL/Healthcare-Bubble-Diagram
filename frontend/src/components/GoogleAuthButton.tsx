import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { useAuthStore } from '../store/authStore'

/**
 * Fixed top-right "Sign in with Google" control, mounted globally in App.
 *
 * The `credential` GoogleLogin hands back IS the ID token (a JWT) our backends
 * verify; we stash it in the auth store for the "Send to Revit" publish call and
 * decode the email locally just for the signed-in label.
 *
 * Needs VITE_GOOGLE_CLIENT_ID (a Web-application OAuth client id) — see
 * HealthcareArchitecture/docs/bubble-diagram-handoff.md. Until that's set the
 * Google button renders but won't complete sign-in.
 */
export default function GoogleAuthButton() {
  const { email, setAuth, clear } = useAuthStore()

  return (
    <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}>
      {email ? (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(17,24,39,0.9)', color: '#e5e7eb',
            border: '1px solid #374151', borderRadius: 8,
            padding: '6px 10px', fontSize: 12,
          }}
        >
          <span>Signed in as <strong>{email}</strong></span>
          <button
            onClick={() => { googleLogout(); clear() }}
            style={{
              background: 'transparent', color: '#9ca3af',
              border: '1px solid #374151', borderRadius: 6,
              padding: '2px 8px', cursor: 'pointer', fontSize: 12,
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <GoogleLogin
          onSuccess={(cr) => {
            const token = cr.credential
            if (token) setAuth(token, decodeEmail(token))
          }}
          onError={() => console.error('Google sign-in failed')}
        />
      )}
    </div>
  )
}

/** Decode the `email` claim from a Google ID token (JWT) without verifying it —
 *  verification happens server-side; this is display-only. */
function decodeEmail(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(decodeURIComponent(escape(atob(payload))))
    return typeof claims.email === 'string' ? claims.email : null
  } catch {
    return null
  }
}
