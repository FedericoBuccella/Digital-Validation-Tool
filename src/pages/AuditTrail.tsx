import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AuditLog {
  id: string
  created_at: string
  user_id: string
  action: string
  entity: string
  entity_id: string
  details: any
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: logsError } = await supabase
          .from('audit_trail')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)

        if (logsError) throw logsError
        setLogs(data || [])
      } catch (err) {
        console.error('Error al cargar los logs:', err)
        setError('No se pudieron cargar los registros de auditoría')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

const renderDiff = (details: any, action: string) => {

  const parseJSONSafe = (data: any) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return data
      }
    }
    return data
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length} elementos]`
      }
      // Special formatting for validation protocol content
      if (value.description !== undefined && value.test_cases_count !== undefined) {
        const parts = []
        if (value.description) {
          parts.push(`Descripción: "${value.description}"`)
        }
        if (value.test_cases_count !== undefined) {
          parts.push(`Total casos: ${value.test_cases_count}`)
        }
        if (value.test_cases_summary) {
          parts.push(`Casos: ${value.test_cases_summary}`)
        } else if (value.test_cases && Array.isArray(value.test_cases)) {
          const casesText = value.test_cases.map((tc: any, idx: number) => 
            `${idx + 1}. ${tc.description} → ${tc.expected_result}`
          ).join('; ')
          parts.push(`Casos: ${casesText}`)
        }
        return parts.join(' | ')
      }
      // For other objects, show key-value pairs in a readable format
      const entries = Object.entries(value)
      if (entries.length <= 3) {
        return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ')
      }
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  if (!details) return <span>-</span>

  // Handle different data structures based on action type
  const oldData = parseJSONSafe(details.old_data || details.deleted_data || null)
  const newData = parseJSONSafe(details.new_data || null)
  const changes = parseJSONSafe(details.changes || null)

  // CREATE action
  if (action === 'CREATE' || (!oldData && newData)) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-green-600">Datos creados:</div>
        {Object.entries(newData || {}).map(([key, value]) => (
          <div key={key}>
            <span className="font-semibold">{key}: </span>
            <span>{formatValue(value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // DELETE action
  if (action === 'DELETE') {
    // Check for deleted_data structure from your user_requirements.tsx
    if (details.deleted_data) {
      return (
        <div className="space-y-1">
          <div className="font-medium text-red-600">Datos eliminados:</div>
          {Object.entries(details.deleted_data || {}).map(([key, value]) => (
            <div key={key}>
              <span className="font-semibold">{key}: </span>
              <span>{formatValue(value)}</span>
            </div>
          ))}
        </div>
      )
    } 
    
    // Fallback to oldData
    if (oldData) {
      return (
        <div className="space-y-1">
          <div className="font-medium text-red-600">Datos eliminados:</div>
          {Object.entries(oldData || {}).map(([key, value]) => (
            <div key={key}>
              <span className="font-semibold">{key}: </span>
              <span>{formatValue(value)}</span>
            </div>
          ))}
        </div>
      )
    }
    
    // Last resort - show raw details
    return (
      <div className="space-y-1">
        <div className="font-medium text-red-600">Datos eliminados:</div>
        <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(details, null, 2)}</pre>
      </div>
    )
  }
  
  // Legacy check for DELETE-like structure
  if (oldData && !newData) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-red-600">Datos eliminados:</div>
        {Object.entries(oldData || {}).map(([key, value]) => (
          <div key={key}>
            <span className="font-semibold">{key}: </span>
            <span>{formatValue(value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // UPDATE action with changes field
  if (action === 'UPDATE' && changes) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-amber-600">Cambios realizados:</div>
        {Object.entries(changes).map(([key, change]: [string, any]) => (
          <div key={key}>
            <span className="font-semibold">{key}: </span>
            <span style={{textDecoration: 'line-through'}}>
              {formatValue(change.old)}
            </span>
            <span> → {formatValue(change.new)}</span>
          </div>
        ))}
      </div>
    )
  }

  // UPDATE action with old and new data
  if (action === 'UPDATE' || (oldData && newData)) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-amber-600">Cambios realizados:</div>
        {Object.keys({ ...oldData, ...newData }).map((key) => {
          const oldVal = oldData?.[key]
          const newVal = newData?.[key]

          if (oldVal !== newVal) {
            return (
              <div key={key}>
                <span className="font-semibold">{key}: </span>
                <span style={{textDecoration: 'line-through'}}>
                  {formatValue(oldVal)}
                </span>
                <span> → {formatValue(newVal)}</span>
              </div>
            )
          }
          return (
            <div key={key}>
              <span className="font-semibold">{key}: </span>
              <span>{formatValue(newVal)}</span>
            </div>
          )
        })}
      </div>
    )
  }

  // Fallback
  return <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(details, null, 2)}</pre>
}


  if (loading) return <div className="p-6">Cargando registros de auditoría...</div>
  if (error) return <div className="p-6 text-red-500">{error}</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Audit Trail</h1>
      {logs.length === 0 ? (
        <p>No hay registros de auditoría disponibles</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="px-4 py-2 border">Fecha</th>
                <th className="px-4 py-2 border">Usuario</th>
                <th className="px-4 py-2 border">Acción</th>
                <th className="px-4 py-2 border">Entidad</th>
                <th className="px-4 py-2 border">ID</th>
                <th className="px-4 py-2 border">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="px-4 py-2 border">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2 border">{log.details?.performed_by?.email || log.user_id}</td>
                  <td className="px-4 py-2 border">{log.action || '-'}</td>
                  <td className="px-4 py-2 border">{log.entity || '-'}</td>
                  <td className="px-4 py-2 border">{log.entity_id || '-'}</td>
                  <td className="px-4 py-2 border">{renderDiff(log.details, log.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}