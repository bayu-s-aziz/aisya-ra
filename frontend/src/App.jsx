import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PropTypes from 'prop-types'
import { AppProvider } from './contexts/AppContext'
import api from './lib/api'

const AppLayout = lazy(() => import('./components/Layout/AppLayout'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))

function RouteLoadingFallback() {
  return (
    <div className="auth-shell min-h-screen px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-[#d7dbe2] bg-white/92 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.09)]">
          <div className="space-y-3">
            <div className="page-skeleton h-4 w-40 rounded-full" />
            <div className="page-skeleton h-12 w-full rounded-2xl" />
            <div className="page-skeleton h-12 w-full rounded-2xl" />
            <div className="page-skeleton h-12 w-1/3 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function isLikelyJwtToken(token) {
  if (!token || typeof token !== 'string') return false
  return token.split('.').length === 3
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('aisya_access_token')
  const [isChecking, setIsChecking] = useState(Boolean(token))
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    let active = true

    const validate = async () => {
      if (!token) {
        if (active) {
          setIsValid(false)
          setIsChecking(false)
        }
        return
      }

      if (!isLikelyJwtToken(token)) {
        localStorage.removeItem('aisya_access_token')
        localStorage.removeItem('aisya_refresh_token')
        if (active) {
          setIsValid(false)
          setIsChecking(false)
        }
        return
      }

      try {
        await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (active) {
          setIsValid(true)
        }
      } catch {
        localStorage.removeItem('aisya_access_token')
        localStorage.removeItem('aisya_refresh_token')
        if (active) {
          setIsValid(false)
        }
      } finally {
        if (active) {
          setIsChecking(false)
        }
      }
    }

    validate()
    return () => {
      active = false
    }
  }, [token])

  if (isChecking) {
    return <div className="min-h-screen bg-[#f0f2f5]" />
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!isValid) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicOnly({ children }) {
  const token = localStorage.getItem('aisya_access_token')
  const [isChecking, setIsChecking] = useState(Boolean(token))
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    let active = true

    const validate = async () => {
      if (!token) {
        if (active) {
          setIsValid(false)
          setIsChecking(false)
        }
        return
      }

      if (!isLikelyJwtToken(token)) {
        localStorage.removeItem('aisya_access_token')
        localStorage.removeItem('aisya_refresh_token')
        if (active) {
          setIsValid(false)
          setIsChecking(false)
        }
        return
      }

      try {
        await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (active) {
          setIsValid(true)
        }
      } catch {
        localStorage.removeItem('aisya_access_token')
        localStorage.removeItem('aisya_refresh_token')
        if (active) {
          setIsValid(false)
        }
      } finally {
        if (active) {
          setIsChecking(false)
        }
      }
    }

    validate()
    return () => {
      active = false
    }
  }, [token])

  if (isChecking) {
    return <div className="min-h-screen bg-[#f0f2f5]" />
  }

  if (isValid) {
    return <Navigate to="/" replace />
  }

  return children
}

RequireAuth.propTypes = {
  children: PropTypes.node.isRequired,
}

PublicOnly.propTypes = {
  children: PropTypes.node.isRequired,
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={(
          <RequireAuth>
            <AppProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
                <AppLayout />
              </Suspense>
            </AppProvider>
          </RequireAuth>
        )}
      />
      <Route
        path="/login"
        element={(
          <PublicOnly>
            <Suspense fallback={<RouteLoadingFallback />}>
              <LoginPage />
            </Suspense>
          </PublicOnly>
        )}
      />
      <Route
        path="/register-school"
        element={(
          <PublicOnly>
            <Suspense fallback={<RouteLoadingFallback />}>
              <RegisterPage />
            </Suspense>
          </PublicOnly>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
