import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  Network,
  ClipboardList,
  AlertTriangle,
  FileCheck,
  Table,
  FileText,
  TrendingUp,
  CheckCircle,
  CircuitBoard,
  NotebookPen
} from 'lucide-react'

interface DashboardStats {
  processMaps: number
  userRequirements: number
  riskAnalysis: number
  validationProtocols: number
  executionProtocols: number
  traceabilityEntries: number
  validationReports: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    processMaps: 0,
    userRequirements: 0,
    riskAnalysis: 0,
    validationProtocols: 0,
    executionProtocols: 0,
    traceabilityEntries: 0,
    validationReports: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [user])

  const fetchDashboardStats = async () => {
    if (!user) return

    try {
      const [
        processMapsResult,
        userRequirementsResult,
        riskAnalysisResult,
        validationProtocolsResult,
        traceabilityResult,
        validationReportsResult
      ] = await Promise.all([
        supabase.from('process_maps').select('id', { count: 'exact' }),//.eq('user_id', user.id),
        supabase.from('user_requirements').select('id', { count: 'exact' }),//.eq('user_id', user.id),
        supabase.from('risk_analysis').select('id', { count: 'exact' }),//.eq('user_id', user.id),
        supabase.from('validation_protocols').select('id', { count: 'exact' }),//.eq('user_id', user.id),
        supabase.from('traceability_matrix').select('id', { count: 'exact' }),//.eq('user_id', user.id),
        supabase.from('validation_reports').select('id', { count: 'exact' }),//.eq('user_id', user.id)
      ])

      setStats({
        processMaps: processMapsResult.count || 0,
        userRequirements: userRequirementsResult.count || 0,
        riskAnalysis: riskAnalysisResult.count || 0,
        validationProtocols: validationProtocolsResult.count || 0,
        executionProtocols: validationProtocolsResult.count || 0,
        traceabilityEntries: traceabilityResult.count || 0,
        validationReports: validationReportsResult.count || 0
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const dashboardCards = [
    {
      title: 'Mapeo de Procesos',
      value: stats.processMaps,
      icon: Network,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Requerimientos de Usuario',
      value: stats.userRequirements,
      icon: ClipboardList,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Análisis de Riesgo',
      value: stats.riskAnalysis,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      title: 'Protocolos de Validación',
      value: stats.validationProtocols,
      icon: FileCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
     {
      title: 'Protocolos Ejecutados',
      value: stats.executionProtocols,
      icon: CircuitBoard,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      title: 'Matriz de Trazabilidad',
      value: stats.traceabilityEntries,
      icon: Table,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    {
      title: 'Reportes de Validación',
      value: stats.validationReports,
      icon: FileText,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!user) {
  return (
    <div className="flex flex-col items-center justify-center h-96">
      <h2 className="text-xl font-semibold mb-2">No has iniciado sesión</h2>
      <p className="text-gray-500">Por favor, inicia sesión para ver el dashboard.</p>
    </div>
  )
}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Badge variant="outline" className="flex items-center space-x-1">
          <CheckCircle className="h-4 w-4" />
          <span>Sistema GxP Validado</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardCards.map((card, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                Elementos registrados
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Proceso de Validación</CardTitle>
            <CardDescription>
              Estado actual del proceso de validación GxP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Mapeo de Procesos</span>
              <Badge variant={stats.processMaps > 0 ? "default" : "secondary"}>
                {stats.processMaps > 0 ? "Completado" : "Pendiente"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Requerimientos de Usuario</span>
              <Badge variant={stats.userRequirements > 0 ? "default" : "secondary"}>
                {stats.userRequirements > 0 ? "En Progreso" : "Pendiente"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Análisis de Riesgo</span>
              <Badge variant={stats.riskAnalysis > 0 ? "default" : "secondary"}>
                {stats.riskAnalysis > 0 ? "Completado" : "Pendiente"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Protocolos de Validación</span>
              <Badge variant={stats.validationProtocols > 0 ? "default" : "secondary"}>
                {stats.validationProtocols > 0 ? "En Progreso" : "Pendiente"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Acciones frecuentes del sistema de validación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-sm">Crear Nuevo Proceso</div>
              <div className="text-xs text-gray-500">Iniciar mapeo de un nuevo proceso</div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-sm">Agregar Requerimiento</div>
              <div className="text-xs text-gray-500">Definir nuevo requerimiento de usuario</div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="font-medium text-sm">Generar Reporte</div>
              <div className="text-xs text-gray-500">Crear reporte de validación</div>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}