import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Save,
  Download,
  Upload,
  Square,
  Circle,
  ArrowRight,
  Trash2,
  Move,
  Edit2
} from 'lucide-react'

interface ProcessStep {
  id: string
  type: 'process' | 'decision' | 'start' | 'end'
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
}

interface ProcessMap {
  id?: string
  title: string
  description: string
  steps: ProcessStep[]
  connections: Array<{ from: string; to: string }>
}

export default function ProcessMapping() {
  const { user } = useAuth()
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedTool, setSelectedTool] = useState<'select' | 'start' | 'end' | 'process' | 'decision' | 'arrow'>('select')
  const [processMap, setProcessMap] = useState<ProcessMap>({
    title: '',
    description: '',
    steps: [],
    connections: []
  })
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [savedMaps, setSavedMaps] = useState<ProcessMap[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSavedMaps()
    drawCanvas()
  }, [processMap])

  const fetchSavedMaps = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('process_maps')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const maps = data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        steps: item.diagram_data?.steps || [],
        connections: item.diagram_data?.connections || []
      }))

      setSavedMaps(maps)
    } catch (error) {
      console.error('Error fetching process maps:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los mapas de proceso",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 1
    for (let i = 0; i < canvas.width; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvas.height)
      ctx.stroke()
    }
    for (let i = 0; i < canvas.height; i += 20) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvas.width, i)
      ctx.stroke()
    }

    // Draw connections
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 2
    processMap.connections.forEach(connection => {
      const fromStep = processMap.steps.find(s => s.id === connection.from)
      const toStep = processMap.steps.find(s => s.id === connection.to)
      
      if (fromStep && toStep) {
        ctx.beginPath()
        ctx.moveTo(fromStep.x + fromStep.width / 2, fromStep.y + fromStep.height / 2)
        ctx.lineTo(toStep.x + toStep.width / 2, toStep.y + toStep.height / 2)
        ctx.stroke()
        
        // Draw arrow head
        const angle = Math.atan2(toStep.y - fromStep.y, toStep.x - fromStep.x)
        ctx.beginPath()
        ctx.moveTo(toStep.x + toStep.width / 2, toStep.y + toStep.height / 2)
        ctx.lineTo(
          toStep.x + toStep.width / 2 - 10 * Math.cos(angle - Math.PI / 6),
          toStep.y + toStep.height / 2 - 10 * Math.sin(angle - Math.PI / 6)
        )
        ctx.moveTo(toStep.x + toStep.width / 2, toStep.y + toStep.height / 2)
        ctx.lineTo(
          toStep.x + toStep.width / 2 - 10 * Math.cos(angle + Math.PI / 6),
          toStep.y + toStep.height / 2 - 10 * Math.sin(angle + Math.PI / 6)
        )
        ctx.stroke()
      }
    })

    // Draw steps
    processMap.steps.forEach(step => {
      ctx.fillStyle = selectedStep === step.id ? '#3b82f6' : step.color
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2

      if (step.type === 'decision') {
        // Draw diamond
        ctx.beginPath()
        ctx.moveTo(step.x + step.width / 2, step.y)
        ctx.lineTo(step.x + step.width, step.y + step.height / 2)
        ctx.lineTo(step.x + step.width / 2, step.y + step.height)
        ctx.lineTo(step.x, step.y + step.height / 2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      } else if (step.type === 'start' || step.type === 'end') {
        // Draw circle
        ctx.beginPath()
        ctx.arc(step.x + step.width / 2, step.y + step.height / 2, step.width / 2, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
      } else {
        // Draw rectangle
        ctx.fillRect(step.x, step.y, step.width, step.height)
        ctx.strokeRect(step.x, step.y, step.width, step.height)
      }

      // Draw text
      ctx.fillStyle = '#000'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(step.text, step.x + step.width / 2, step.y + step.height / 2 + 4)
    })
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (selectedTool === 'select') {
      // Select step
      const clickedStep = processMap.steps.find(step =>
        x >= step.x && x <= step.x + step.width &&
        y >= step.y && y <= step.y + step.height
      )
      setSelectedStep(clickedStep ? clickedStep.id : null)
    } else if (['process', 'decision', 'start', 'end'].includes(selectedTool)) {
      // Add new step
      const newStep: ProcessStep = {
        id: Date.now().toString(),
        type: selectedTool as ProcessStep['type'],
        x: Math.round(x / 20) * 20,
        y: Math.round(y / 20) * 20,
        width: selectedTool === 'start' || selectedTool === 'end' ? 80 : 120,
        height: 60,
        text: selectedTool === 'start' ? 'Inicio' : selectedTool === 'end' ? 'Fin' : 'Nuevo Paso',
        color: selectedTool === 'decision' ? '#fbbf24' : selectedTool === 'start' ? '#10b981' : selectedTool === 'end' ? '#ef4444' : '#60a5fa'
      }

      setProcessMap(prev => ({
        ...prev,
        steps: [...prev.steps, newStep]
      }))
    }
  }

  const saveProcessMap = async () => {
    if (!user || !processMap.title) {
      toast({
        title: "Error",
        description: "Por favor ingrese un título para el mapa de proceso",
        variant: "destructive"
      })
      return
    }

    try {
      const diagramData = {
        steps: processMap.steps,
        connections: processMap.connections
      }

      if (processMap.id) {
        // Update existing
        const { error } = await supabase
          .from('process_maps')
          .update({
            title: processMap.title,
            description: processMap.description,
            diagram_data: diagramData
          })
          .eq('id', processMap.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('process_maps')
          .insert({
            title: processMap.title,
            description: processMap.description,
            diagram_data: diagramData,
            user_id: user.id
          })

        if (error) throw error
      }

      toast({
        title: "Éxito",
        description: "Mapa de proceso guardado correctamente"
      })

      fetchSavedMaps()
    } catch (error) {
      console.error('Error saving process map:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar el mapa de proceso",
        variant: "destructive"
      })
    }
  }

  const loadProcessMap = (map: ProcessMap) => {
    setProcessMap(map)
    setSelectedStep(null)
  }

  const deleteStep = () => {
    if (selectedStep) {
      setProcessMap(prev => ({
        ...prev,
        steps: prev.steps.filter(step => step.id !== selectedStep),
        connections: prev.connections.filter(conn => 
          conn.from !== selectedStep && conn.to !== selectedStep
        )
      }))
      setSelectedStep(null)
    }
  }

  const updateStepText = (text: string) => {
    if (selectedStep) {
      setProcessMap(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.id === selectedStep ? { ...step, text } : step
        )
      }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Mapeo de Procesos</h1>
        <Button onClick={saveProcessMap} className="flex items-center space-x-2">
          <Save className="h-4 w-4" />
          <span>Guardar Mapa</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Editor de Procesos</CardTitle>
                  <CardDescription>
                    Crea diagramas de flujo para mapear procesos de validación
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant={selectedTool === 'select' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('select')}
                  >
                    <Move className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === 'process' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('process')}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === 'decision' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('decision')}
                  >
                    ◇
                  </Button>
                  <Button
                    variant={selectedTool === 'start' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('start')}
                  >
                    <Circle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === 'arrow' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTool('arrow')}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <canvas
                ref={canvasRef}
                width={800}
                height={500}
                className="border border-gray-300 rounded-lg cursor-crosshair"
                onClick={handleCanvasClick}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Propiedades del Mapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={processMap.title}
                  onChange={(e) => setProcessMap(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                  placeholder="Nombre del proceso"
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={processMap.description}
                  onChange={(e) => setProcessMap(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="Descripción del proceso"
                  rows={3}
                />
              </div>
              {selectedStep && (
                <div className="border-t pt-4">
                  <Label htmlFor="stepText">Texto del Paso Seleccionado</Label>
                  <Input
                    id="stepText"
                    value={processMap.steps.find(s => s.id === selectedStep)?.text || ''}
                    onChange={(e) => updateStepText(e.target.value)}
                    placeholder="Texto del paso"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={deleteStep}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Paso
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapas Guardados</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : savedMaps.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay mapas guardados</p>
              ) : (
                <div className="space-y-2">
                  {savedMaps.map(map => (
                    <div
                      key={map.id}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => loadProcessMap(map)}
                    >
                      <div className="font-medium text-sm">{map.title}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {map.description || 'Sin descripción'}
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        {map.steps.length} pasos
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}