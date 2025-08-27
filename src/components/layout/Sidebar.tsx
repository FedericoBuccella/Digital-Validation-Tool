import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Network,
  ClipboardList,
  AlertTriangle,
  FileCheck,
  Table,
  FileText,
  ChevronLeft,
  CircuitBoard,
  User,
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

const mainNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Mapeo de Procesos', href: '/process-mapping', icon: Network },
  { name: 'Requerimientos de Usuario', href: '/user-requirements', icon: ClipboardList },
  { name: 'Análisis de Riesgo', href: '/risk-analysis', icon: AlertTriangle },
  { name: 'Protocolos de Validación', href: '/validation-protocols', icon: FileCheck },
  { name: 'Ejecución de Protocolos', href: '/protocol-execution', icon: CircuitBoard },
  { name: 'Matriz de Trazabilidad', href: '/traceability-matrix', icon: Table },
  { name: 'Reportes de Validación', href: '/validation-reports', icon: FileText },
  { name: 'Firma Electrónica', href: '/electronicsignature', icon: FileCheck },
]

const userNavigation = [
  { name: 'Usuarios', href: '/usermanagement', icon: User },
  { name: 'Audit Trail', href: '/audittrail', icon: FileText },
]

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()

  return (
    <div className={cn(
      'fixed left-0 top-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300',
      open ? 'w-64' : 'w-16'
    )}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
        {open ? (
          <h1 className="text-xl font-bold text-gray-900">GxP Validation</h1>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center justify-center w-full h-8"
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            <img src="/public/images/logo.png" alt="Logo" className="h-8 w-8 mx-auto" />
          </button>
        )}
        {open && (
          <button
            onClick={() => setOpen(false)}
            className="p-0 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>    
      
      <nav className={cn("mt-8", open ? "px-4" : "px-1")}>
        <ul className="space-y-2">
          {mainNavigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {open && <span>{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* separación con línea */}
        <div className="my-4 border-t border-gray-200" />

        <ul className="space-y-2">
          {userNavigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {open && <span>{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )}
