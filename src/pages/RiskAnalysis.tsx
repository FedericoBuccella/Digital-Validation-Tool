import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Eye
} from 'lucide-react'

interface RiskAnalysis {
  id?: string
  requirement_id: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  probability: 'HIGH' | 'MEDIUM' | 'LOW'
  detectability: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  mitigation_strategy: string
  created_at?: string
  requirement?: {
    requirement_text: string
    category: string
  }
}

interface UserRequirement {
  id: string
  requirement_text: string
  category: string
}

const riskColors = {
  HIGH: 'bg-red-100 text-red-800 border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-green-100 text-green-800 border-green-200'
}

const calculateRiskLevel = (
  severity: 'HIGH' | 'MEDIUM' | 'LOW',
  probability: 'HIGH' | 'MEDIUM' | 'LOW',
  detectability: 'HIGH' | 'MEDIUM' | 'LOW'
): 'HIGH' | 'MEDIUM' | 'LOW' => {
  const scores = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  }

  const totalScore = scores[severity] + scores[probability] + scores[detectability]

  if (totalScore >= 8) return 'HIGH'
  if (totalScore >= 5) return 'MEDIUM'
  return 'LOW'
}

export default function RiskAnalysis() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [riskAnalyses, setRiskAnalyses] = useState<RiskAnalysis[]>([])
  const [requirements, setRequirements] = useState<UserRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAnalysis, setEditingAnalysis] = useState<RiskAnalysis | null>(null)
  const [newAnalysis, setNewAnalysis] = useState<RiskAnalysis>({
    requirement_id: '',
    severity: 'MEDIUM',
    probability: 'MEDIUM',
    detectability: 'MEDIUM',
    risk_level: 'MEDIUM',
    mitigation_strategy: ''
  })

  useEffect(() => {
    fetchData()
  }, [user])

  useEffect(() => {
    // Recalculate risk level when severity, probability, or detectability changes
    const newRiskLevel = calculateRiskLevel(
      newAnalysis.severity,
      newAnalysis.probability,
      newAnalysis.detectability
    )
    setNewAnalysis(prev => ({ ...prev, risk_level: newRiskLevel }))
  }, [newAnalysis.severity, newAnalysis.probability, newAnalysis.detectability])

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch risk analyses
      const { data: analysesData, error: analysesError } = await supabase
        .from('app_a06fa33f4c_risk_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (analysesError) throw analysesError

      // Fetch requirements for each analysis
      const analysesWithRequirements = await Promise.all(
        (analysesData || []).map(async (analysis) => {
          const { data: reqData } = await supabase
            .from('app_a06fa33f4c_user_requirements')
            .select('requirement_text, category')
            .eq('id', analysis.requirement_id)
            .single()

          return {
            ...analysis,
            requirement: reqData
          }
        })
      )

      setRiskAnalyses(analysesWithRequirements)

      // Fetch available requirements
      const { data: requirementsData, error: requirementsError } = await supabase
        .from('app_a06fa33f4c_user_requirements')
        .select('id, requirement_text, category')
        .eq('user_id', user.id)

      if (requirementsError) throw requirementsError

      setRequirements(requirementsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los análisis de riesgo",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveAnalysis = async () => {
    if (!user || !newAnalysis.requirement_id || !newAnalysis.mitigation_strategy) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive"
      })
      return
    }

    try {
      if (editingAnalysis) {
        // Update existing
        const { error } = await supabase
          .from('app_a06fa33f4c_risk_analyses')
          .update({
            requirement_id: newAnalysis.requirement_id,
            severity: newAnalysis.severity,
            probability: newAnalysis.probability,
            detectability: newAnalysis.detectability,
            risk_level: newAnalysis.risk_level,
            mitigation_strategy: newAnalysis.mitigation_strategy
          })
          .eq('id', editingAnalysis.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('app_a06fa33f4c_risk_analyses')
          .insert({
            requirement_id: newAnalysis.requirement_id,
            severity: newAnalysis.severity,
            probability: newAnalysis.probability,
            detectability: newAnalysis.detectability,
            risk_level: newAnalysis.risk_level,
            mitigation_strategy: newAnalysis.mitigation_strategy,
            user_id: user.id
          })

        if (error) throw error
      }

      toast({
        title: "Éxito",
        description: `Análisis de riesgo ${editingAnalysis ? 'actualizado' : 'creado'} correctamente`
      })

      setIsDialogOpen(false)
      setEditingAnalysis(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving analysis:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar el análisis de riesgo",
        variant: "destructive"
      })
    }
  }

  const editAnalysis = (analysis: RiskAnalysis) => {
    setEditingAnalysis(analysis)
    setNewAnalysis({
      requirement_id: analysis.requirement_id,
      severity: analysis.severity,
      probability: analysis.probability,
      detectability: analysis.detectability,
      risk_level: analysis.risk_level,
      mitigation_strategy: analysis.mitigation_strategy
    })
    setIsDialogOpen(true)
  }

  const deleteAnalysis = async (id: string) => {
    try {
      const { error } = await supabase
        .from('app_a06fa33f4c_risk_analyses')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Análisis de riesgo eliminado correctamente"
      })

      fetchData()
    } catch (error) {
      console.error('Error deleting analysis:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el análisis de riesgo",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setEditingAnalysis(null)
    setNewAnalysis({
      requirement_id: '',
      severity: 'MEDIUM',
      probability: 'MEDIUM',
      detectability: 'MEDIUM',
      risk_level: 'MEDIUM',
      mitigation_strategy: ''
    })
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'HIGH':
        return <AlertTriangle className="h-4 w-4" />
      case 'MEDIUM':
        return <Activity className="h-4 w-4" />
      case 'LOW':
        return <ShieldCheck className="h-4 w-4" />
      default:
        return <Eye className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Análisis de Riesgo</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nuevo Análisis</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAnalysis ? 'Editar' : 'Crear'} Análisis de Riesgo
              </DialogTitle>
              <DialogDescription>
                {editingAnalysis
                  ? 'Modifica el análisis de riesgo existente'
                  : 'Crea un análisis de riesgo para un requerimiento específico'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="requirement_id">Requerimiento</Label>
                <Select
                  value={newAnalysis.requirement_id}
                  onValueChange={(value) => setNewAnalysis(prev => ({
                    ...prev,
                    requirement_id: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un requerimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    {requirements.map(req => (
                      <SelectItem key={req.id} value={req.id}>
                        <div className="flex flex-col">
                          <span className="truncate max-w-md">{req.requirement_text}</span>
                          <Badge variant="secondary" className="w-fit text-xs">
                            {req.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="severity">Severidad</Label>
                  <Select
                    value={newAnalysis.severity}
                    onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') => setNewAnalysis(prev => ({
                      ...prev,
                      severity: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="LOW">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="probability">Probabilidad</Label>
                  <Select
                    value={newAnalysis.probability}
                    onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') => setNewAnalysis(prev => ({
                      ...prev,
                      probability: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="LOW">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="detectability">Detectabilidad</Label>
                  <Select
                    value={newAnalysis.detectability}
                    onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') => setNewAnalysis(prev => ({
                      ...prev,
                      detectability: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="LOW">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Nivel de Riesgo Calculado</Label>
                <div className="mt-2">
                  <Badge className={`${riskColors[newAnalysis.risk_level]} text-lg px-3 py-1`}>
                    {getRiskIcon(newAnalysis.risk_level)}
                    <span className="ml-2">
                      {newAnalysis.risk_level === 'HIGH' ? 'Alto' : newAnalysis.risk_level === 'MEDIUM' ? 'Medio' : 'Bajo'}
                    </span>
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="mitigation_strategy">Estrategia de Mitigación</Label>
                <Textarea
                  id="mitigation_strategy"
                  value={newAnalysis.mitigation_strategy}
                  onChange={(e) => setNewAnalysis(prev => ({
                    ...prev,
                    mitigation_strategy: e.target.value
                  }))}
                  placeholder="Describe las medidas para mitigar el riesgo identificado..."
                  rows={4}
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button onClick={saveAnalysis} className="flex-1">
                  {editingAnalysis ? 'Actualizar' : 'Crear'} Análisis
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análisis de Riesgos</CardTitle>
          <CardDescription>
            Evaluación de riesgos asociados a cada requerimiento del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : riskAnalyses.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No hay análisis de riesgo creados. Crea el primero.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {riskAnalyses.map((analysis) => (
                <div key={analysis.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary">
                          {analysis.requirement?.category || 'N/A'}
                        </Badge>
                        <Badge className={riskColors[analysis.risk_level]}>
                          {getRiskIcon(analysis.risk_level)}
                          <span className="ml-1">
                            Riesgo {analysis.risk_level === 'HIGH' ? 'Alto' : analysis.risk_level === 'MEDIUM' ? 'Medio' : 'Bajo'}
                          </span>
                        </Badge>
                      </div>
                      <p className="font-medium text-gray-900 mb-2">
                        {analysis.requirement?.requirement_text || 'Requerimiento no encontrado'}
                      </p>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                        <div>
                          <span className="text-gray-500">Severidad:</span>
                          <Badge variant="outline" className="ml-1">
                            {analysis.severity === 'HIGH' ? 'Alta' : analysis.severity === 'MEDIUM' ? 'Media' : 'Baja'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-500">Probabilidad:</span>
                          <Badge variant="outline" className="ml-1">
                            {analysis.probability === 'HIGH' ? 'Alta' : analysis.probability === 'MEDIUM' ? 'Media' : 'Baja'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-gray-500">Detectabilidad:</span>
                          <Badge variant="outline" className="ml-1">
                            {analysis.detectability === 'HIGH' ? 'Alta' : analysis.detectability === 'MEDIUM' ? 'Media' : 'Baja'}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="text-gray-500">Estrategia de Mitigación:</span>
                        <p className="text-gray-900 mt-1">{analysis.mitigation_strategy}</p>
                      </div>

                      <p className="text-xs text-gray-500 mt-2">
                        Creado el {new Date(analysis.created_at!).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editAnalysis(analysis)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAnalysis(analysis.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Riesgos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Riesgo Alto</span>
                </div>
                <Badge className={riskColors.HIGH}>
                  {riskAnalyses.filter(r => r.risk_level === 'HIGH').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Riesgo Medio</span>
                </div>
                <Badge className={riskColors.MEDIUM}>
                  {riskAnalyses.filter(r => r.risk_level === 'MEDIUM').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Riesgo Bajo</span>
                </div>
                <Badge className={riskColors.LOW}>
                  {riskAnalyses.filter(r => r.risk_level === 'LOW').length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriz de Riesgos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              <p className="mb-2">Criterios de evaluación:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Severidad: Impacto del riesgo materializado</li>
                <li>Probabilidad: Posibilidad de ocurrencia</li>
                <li>Detectabilidad: Capacidad de detección temprana</li>
              </ul>
              <p className="mt-3 text-xs">
                El nivel de riesgo se calcula automáticamente basado en la combinación de estos factores.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}