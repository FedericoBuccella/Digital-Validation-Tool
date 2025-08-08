import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Edit2,
  Trash2,
  FileCheck,
  Settings,
  PlayCircle,
  CheckCircle,
  Clock,
  Download
} from 'lucide-react'

interface ValidationProtocol {
  id?: string
  protocol_type: 'IQ' | 'OQ' | 'PQ'
  title: string
  content: any
  status: 'DRAFT' | 'APPROVED' | 'EXECUTED'
  created_at?: string
}

interface TestCase {
  id: string
  description: string
  expected_result: string
  actual_result?: string
  status: 'PENDING' | 'PASSED' | 'FAILED'
  requirement_id?: string
  annex?: string
}

const protocolTypeLabels = {
  IQ: 'Instalación (IQ)',
  OQ: 'Operación (OQ)',
  PQ: 'Rendimiento (PQ)'
}

const protocolTypeColors = {
  IQ: 'bg-blue-100 text-blue-800',
  OQ: 'bg-green-100 text-green-800',
  PQ: 'bg-purple-100 text-purple-800'
}

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  EXECUTED: 'bg-green-100 text-green-800'
}

const statusIcons = {
  DRAFT: Clock,
  APPROVED: CheckCircle,
  EXECUTED: PlayCircle
}

export default function ValidationProtocols() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [protocols, setProtocols] = useState<ValidationProtocol[]>([])
  const [requirements, setRequirements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState<ValidationProtocol | null>(null)
  const [newProtocol, setNewProtocol] = useState<ValidationProtocol>({
    protocol_type: 'IQ',
    title: '',
    content: {
      description: '',
      test_cases: []
    },
    status: 'DRAFT'
  })
  const [currentTestCase, setCurrentTestCase] = useState<TestCase>({
    id: '',
    description: '',
    expected_result: '',
    status: 'PENDING'
  })

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch protocols
      const { data: protocolsData, error: protocolsError } = await supabase
        .from('app_a06fa33f4c_validation_protocols')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (protocolsError) throw protocolsError

      setProtocols(protocolsData || [])

      // Fetch requirements
      const { data: requirementsData, error: requirementsError } = await supabase
        .from('app_a06fa33f4c_user_requirements')
        .select('*')
        .eq('user_id', user.id)

      if (requirementsError) throw requirementsError

      setRequirements(requirementsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los protocolos de validación",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveProtocol = async () => {
    if (!user || !newProtocol.title) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive"
      })
      return
    }

    try {
      if (editingProtocol) {
        // Update existing
        const { error } = await supabase
          .from('app_a06fa33f4c_validation_protocols')
          .update({
            protocol_type: newProtocol.protocol_type,
            title: newProtocol.title,
            content: newProtocol.content,
            status: newProtocol.status
          })
          .eq('id', editingProtocol.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('app_a06fa33f4c_validation_protocols')
          .insert({
            protocol_type: newProtocol.protocol_type,
            title: newProtocol.title,
            content: newProtocol.content,
            status: newProtocol.status,
            user_id: user.id
          })

        if (error) throw error
      }

      toast({
        title: "Éxito",
        description: `Protocolo ${editingProtocol ? 'actualizado' : 'creado'} correctamente`
      })

      setIsDialogOpen(false)
      setEditingProtocol(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving protocol:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar el protocolo",
        variant: "destructive"
      })
    }
  }

  const editProtocol = (protocol: ValidationProtocol) => {
    setEditingProtocol(protocol)
    setNewProtocol({
      protocol_type: protocol.protocol_type,
      title: protocol.title,
      content: protocol.content || { description: '', test_cases: [] },
      status: protocol.status
    })
    setIsDialogOpen(true)
  }

  const deleteProtocol = async (id: string) => {
    try {
      const { error } = await supabase
        .from('app_a06fa33f4c_validation_protocols')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Protocolo eliminado correctamente"
      })

      fetchData()
    } catch (error) {
      console.error('Error deleting protocol:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el protocolo",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setEditingProtocol(null)
    setNewProtocol({
      protocol_type: 'IQ',
      title: '',
      content: {
        description: '',
        test_cases: []
      },
      status: 'DRAFT'
    })
    setCurrentTestCase({
      id: '',
      description: '',
      expected_result: '',
      status: 'PENDING'
    })
  }

  const addTestCase = () => {
    if (!currentTestCase.description || !currentTestCase.expected_result) {
      toast({
        title: "Error",
        description: "Por favor complete la descripción y resultado esperado",
        variant: "destructive"
      })
      return
    }

    const testCaseWithId = {
      ...currentTestCase,
      id: Date.now().toString()
    }

    setNewProtocol(prev => ({
      ...prev,
      content: {
        ...prev.content,
        test_cases: [...(prev.content.test_cases || []), testCaseWithId]
      }
    }))

    setCurrentTestCase({
      id: '',
      description: '',
      expected_result: '',
      status: 'PENDING'
    })
  }

  const removeTestCase = (testCaseId: string) => {
    setNewProtocol(prev => ({
      ...prev,
      content: {
        ...prev.content,
        test_cases: prev.content.test_cases.filter((tc: TestCase) => tc.id !== testCaseId)
      }
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Protocolos de Validación</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nuevo Protocolo</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProtocol ? 'Editar' : 'Crear'} Protocolo de Validación
              </DialogTitle>
              <DialogDescription>
                {editingProtocol
                  ? 'Modifica el protocolo de validación existente'
                  : 'Crea un nuevo protocolo de validación (IQ, OQ, o PQ)'}
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="test-cases">Casos de Prueba</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="protocol_type">Tipo de Protocolo</Label>
                    <Select
                      value={newProtocol.protocol_type}
                      onValueChange={(value: 'IQ' | 'OQ' | 'PQ') => setNewProtocol(prev => ({
                        ...prev,
                        protocol_type: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IQ">Instalación (IQ)</SelectItem>
                        <SelectItem value="OQ">Operación (OQ)</SelectItem>
                        <SelectItem value="PQ">Rendimiento (PQ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Estado</Label>
                    <Select
                      value={newProtocol.status}
                      onValueChange={(value: 'DRAFT' | 'APPROVED' | 'EXECUTED') => setNewProtocol(prev => ({
                        ...prev,
                        status: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Borrador</SelectItem>
                        <SelectItem value="APPROVED">Aprobado</SelectItem>
                        <SelectItem value="EXECUTED">Ejecutado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="title">Título del Protocolo</Label>
                  <Input
                    id="title"
                    value={newProtocol.title}
                    onChange={(e) => setNewProtocol(prev => ({
                      ...prev,
                      title: e.target.value
                    }))}
                    placeholder="Ej: Protocolo IQ - Sistema de Gestión de Calidad"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newProtocol.content.description}
                    onChange={(e) => setNewProtocol(prev => ({
                      ...prev,
                      content: { ...prev.content, description: e.target.value }
                    }))}
                    placeholder="Descripción detallada del protocolo de validación..."
                    rows={4}
                  />
                </div>
              </TabsContent>

              <TabsContent value="test-cases" className="space-y-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Agregar Nuevo Caso de Prueba</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label htmlFor="test-description">Descripción del Caso</Label>
                      <Input
                        id="test-description"
                        value={currentTestCase.description}
                        onChange={(e) => setCurrentTestCase(prev => ({
                          ...prev,
                          description: e.target.value
                        }))}
                        placeholder="Descripción del caso de prueba"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expected-result">Resultado Esperado</Label>
                      <Input
                        id="expected-result"
                        value={currentTestCase.expected_result}
                        onChange={(e) => setCurrentTestCase(prev => ({
                          ...prev,
                          expected_result: e.target.value
                        }))}
                        placeholder="Resultado esperado del caso de prueba"
                      />
                    </div>
                    <div>
                      <Label htmlFor="requirement">Requerimiento Asociado (Opcional)</Label>
                      <Select
                        value={currentTestCase.requirement_id || ''}
                        onValueChange={(value) => setCurrentTestCase(prev => ({
                          ...prev,
                          requirement_id: value || undefined
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar requerimiento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ninguno</SelectItem>
                          {requirements.map(req => (
                            <SelectItem key={req.id} value={req.id}>
                              {req.requirement_text.substring(0, 50)}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addTestCase} className="w-full">
                      Agregar Caso de Prueba
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Casos de Prueba Definidos ({newProtocol.content.test_cases?.length || 0})</h4>
                  {newProtocol.content.test_cases?.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay casos de prueba definidos</p>
                  ) : (
                    <div className="space-y-2">
                      {newProtocol.content.test_cases.map((testCase: TestCase, index: number) => (
                        <div key={testCase.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">Caso {index + 1}</div>
                              <div className="text-sm text-gray-600 mt-1">{testCase.description}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="font-medium">Esperado:</span> {testCase.expected_result}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTestCase(testCase.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex space-x-2 pt-4 border-t">
              <Button onClick={saveProtocol} className="flex-1">
                {editingProtocol ? 'Actualizar' : 'Crear'} Protocolo
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Protocolos IQ</p>
                <p className="text-2xl font-bold">
                  {protocols.filter(p => p.protocol_type === 'IQ').length}
                </p>
              </div>
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Protocolos OQ</p>
                <p className="text-2xl font-bold">
                  {protocols.filter(p => p.protocol_type === 'OQ').length}
                </p>
              </div>
              <PlayCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Protocolos PQ</p>
                <p className="text-2xl font-bold">
                  {protocols.filter(p => p.protocol_type === 'PQ').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Protocolos</CardTitle>
          <CardDescription>
            Protocolos de validación IQ, OQ y PQ del sistema
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
          ) : protocols.length === 0 ? (
            <div className="text-center py-8">
              <FileCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No hay protocolos de validación creados. Crea el primero.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {protocols.map((protocol) => {
                const StatusIcon = statusIcons[protocol.status]
                return (
                  <div key={protocol.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={protocolTypeColors[protocol.protocol_type]}>
                            {protocolTypeLabels[protocol.protocol_type]}
                          </Badge>
                          <Badge className={statusColors[protocol.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {protocol.status === 'DRAFT' ? 'Borrador' : 
                             protocol.status === 'APPROVED' ? 'Aprobado' : 'Ejecutado'}
                          </Badge>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-2">{protocol.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {protocol.content?.description || 'Sin descripción'}
                        </p>
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">Casos de prueba:</span> {protocol.content?.test_cases?.length || 0}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Creado el {new Date(protocol.created_at!).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editProtocol(protocol)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProtocol(protocol.id!)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}