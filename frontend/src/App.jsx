import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PropTypes from 'prop-types'
import { AppProvider } from './contexts/AppContext'
import api from './lib/api'

const AppLayout = lazy(() => import('./components/Layout/AppLayout'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterSchoolPage = lazy(() => import('./pages/RegisterSchoolPage'))

function RouteLoadingFallback() {
  return <div className="min-h-screen bg-white" />
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
              <RegisterSchoolPage />
            </Suspense>
          </PublicOnly>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
