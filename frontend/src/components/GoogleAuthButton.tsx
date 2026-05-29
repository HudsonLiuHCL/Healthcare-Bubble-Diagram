import { useState } from 'react'
import { GoogleLogin, googleLogout } from '@react-oauth/google'
import { useAuthStore } from '../store/authStore'

/**
 * Inline header widget — drop into any page's top-right controls.
 * Signed in: circular avatar with the first initial; click to reveal sign-out.
 * Signed out: compact Google one-tap button.
 */
export default function GoogleAuthButton() {
  const { email, setAuth, clear } = useAuthStore()
  const [open, setOpen] = useState(false)

  if (email) {
    const initial = email[0].toUpperCase()
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          title={email}
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: '1.5px solid rgba(139,92,246,0.5)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {initial}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: 36, right: 0, zIndex: 2000,
              background: '#111827', border: '1px solid #374151', borderRadius: 8,
              padding: '8px 0', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '4px 12px 8px', borderBottom: '1px solid #374151' }}>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Signed in as</div>
              <div style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600, marginTop: 2 }}>{email}</div>
            </div>
            <button
              onClick={() => { googleLogout(); clear(); setOpen(false) }}
              style={{
                width: '100%', padding: '8px 12px', textAlign: 'left',
                background: 'transparent', border: 'none',
                color: '#f87171', fontSize: 12, cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <GoogleLogin
      onSuccess={(cr) => {
        const token = cr.credential
        if (token) setAuth(token, decodeEmail(token))
      }}
      onError={() => console.error('Google sign-in failed')}
      size="small"
      shape="circle"
      type="icon"
    />
  )
}

function decodeEmail(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(decodeURIComponent(escape(atob(payload))))
    return typeof claims.email === 'string' ? claims.email : null
  } catch {
    return null
  }
}
