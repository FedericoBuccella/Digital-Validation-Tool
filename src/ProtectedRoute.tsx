import { useAuth } from '@/contexts/AuthContext'
import Login from './pages/Login'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return <>{children}</>
}