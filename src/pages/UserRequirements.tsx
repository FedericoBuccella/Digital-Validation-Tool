import { useState, useEffect } from 'react'
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
  ClipboardList,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Brain,
  PenTool,
  Sparkles
} from 'lucide-react'

import ProcessMapAnalyzer from '@/components/ui/ProcessMapAnalyzer'

export interface UserRequirement {
  id?: string
  email?: string
  requirement: string
  category: string
  prefix?: string
  number?: string
  source?: 'manual' | 'ai-generated'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  created_at?: string
}

const categories = [
  'Funcional',
  'No Funcional',
  'Seguridad',
  'Rendimiento',
  'Usabilidad',
  'Compatibilidad',
  'Mantenimiento',
  'Regulatory'
]

const priorityColors = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800'
}

const priorityIcons = {
  HIGH: AlertTriangle,
  MEDIUM: Clock,
  LOW: CheckCircle
}

export default function UserRequirements() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [requirements, setRequirements] = useState<UserRequirement[]>([])
  const [filteredRequirements, setFilteredRequirements] = useState<UserRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<UserRequirement | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('manual')
  const [newRequirement, setNewRequirement] = useState<UserRequirement>({
    requirement: '',
    category: '',
    priority: 'MEDIUM'
  })

  useEffect(() => {
    fetchRequirements()
  }, [user])

  useEffect(()=>{
    setNewRequirement(prev => ({...prev, email: user?.email}))
  }, [user])

  useEffect(() => {
    applyFilters()
  }, [requirements, filterCategory, filterPriority])

  useEffect(() => {
    if (user && user.email) {
      setNewRequirement(prev => ({
        ...prev,
        email: user.email
      }));
    }
  }, [user]);

  // Custom sorting function for requirements by number
  const sortRequirementsByNumber = (reqs: UserRequirement[]): UserRequirement[] => {
    return [...reqs].sort((a, b) => {
      // First sort by prefix
      const prefixA = a.prefix || 'ZZZ'
      const prefixB = b.prefix || 'ZZZ'
      
      if (prefixA !== prefixB) {
        return prefixA.localeCompare(prefixB)
      }
      
      // Then sort by number (convert to number for proper numeric sorting)
      const numberA = parseInt(a.number || '999999', 10)
      const numberB = parseInt(b.number || '999999', 10)
      
      return numberA - numberB
    })
  }

  const fetchRequirements = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_requirements')
        .select('*')
        .order('prefix', { ascending: true })
        .order('number', { ascending: true })

      if (error) throw error

      // Apply custom sorting to ensure proper numeric ordering
      const sortedData = sortRequirementsByNumber(data || [])
      setRequirements(sortedData)
    } catch (error) {
      console.error('Error fetching requirements:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los requerimientos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Function to get the next sequential number for AI-generated requirements
  const getNextSequentialNumber = async (prefix: string = 'URS'): Promise<string> => {
    try {
      // Get all requirements with the same prefix, ordered by number
      const { data, error } = await supabase
        .from('user_requirements')
        .select('number, prefix')
        .eq('prefix', prefix)
        .not('number', 'is', null)
        .order('number', { ascending: false })

      if (error) {
        console.error('Error fetching requirements for numbering:', error)
        return '001' // Default fallback
      }

      if (!data || data.length === 0) {
        return '001' // First requirement
      }

      // Find the highest numeric number
      let highestNumber = 0
      data.forEach(req => {
        if (req.number) {
          const numericValue = parseInt(req.number, 10)
          if (!isNaN(numericValue) && numericValue > highestNumber) {
            highestNumber = numericValue
          }
        }
      })

      // Return next number with proper padding
      const nextNumber = highestNumber + 1
      return nextNumber.toString().padStart(3, '0')

    } catch (error) {
      console.error('Error in getNextSequentialNumber:', error)
      return '001' // Fallback
    }
  }

  const applyFilters = () => {
    let filtered = requirements

    if (filterCategory !== 'all') {
      filtered = filtered.filter(req => req.category === filterCategory)
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(req => req.priority === filterPriority)
    }

    // Apply sorting to filtered results
    const sortedFiltered = sortRequirementsByNumber(filtered)
    setFilteredRequirements(sortedFiltered)
  }

  const saveRequirement = async () => {
    if (!user || !newRequirement.requirement || !newRequirement.category) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive"
      })
      return
    }

    try {
      const userEmail = user.email || '' 

      if (editingRequirement) {
        // Update existing
        const { data: oldData, error: oldError } = await supabase
          .from('user_requirements')
          .select('*')
          .eq('id', editingRequirement.id)
          .single()

        if (oldError) throw oldError

        const newData = {
          requirement: newRequirement.requirement,
          category: newRequirement.category,
          priority: newRequirement.priority,
          email: userEmail
        };

        const { error } = await supabase
          .from('user_requirements')
          .update({
            requirement: newRequirement.requirement,
            category: newRequirement.category,
            priority: newRequirement.priority,
            email: userEmail
          })
          .eq('id', editingRequirement.id)

        if (error) throw error

        function getChangedFields(oldObj: any, newObj: any) {
          const changed: any = {};
          for (const key in newObj) {
            if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
              changed[key] = { old: oldObj[key], new: newObj[key] };
            }
          }
          return changed;
        }

        const changes = getChangedFields(oldData, newData);

        await supabase.from('audit_trail').insert({
            user_id: user.id,
            action: 'UPDATE',
            entity: 'user_requirement',
            entity_id: editingRequirement.id,
            details: {changes,
              timestamp: new Date().toISOString(),
              performed_by: {
                id: user.id,
                email: userEmail
              }
            }})
      } else {
        // Create new - for manual creation, use provided number or get next sequential
        let finalNumber = newRequirement.number
        if (!finalNumber) {
          finalNumber = await getNextSequentialNumber(newRequirement.prefix || 'URS')
        }

        const { data, error } = await supabase
          .from('user_requirements')
          .insert({
            requirement: newRequirement.requirement,
            category: newRequirement.category,
            priority: newRequirement.priority,
            prefix: newRequirement.prefix || 'URS',
            number: finalNumber,
            source: 'manual',
            email: userEmail,
            user_id: user.id
          })
          .select()

        if (error) throw error

        if (user && data && data[0]) {
          await supabase.from('audit_trail').insert({
            user_id: user.id,
            action: 'CREATE',
            entity: 'user_requirement',
            entity_id: data[0].id,
            details: {
              new_data: {
                ...newRequirement,
                number: finalNumber,
                source: 'manual',
                email: userEmail
              },
              timestamp: new Date().toISOString(),
              performed_by: {
                id: user.id,
                email: userEmail
            } }
          })
        }
      }

      toast({
        title: "Éxito",
        description: `Requerimiento ${editingRequirement ? 'actualizado' : 'creado'} correctamente`
      })

      setIsDialogOpen(false)
      setEditingRequirement(null)
      setNewRequirement({
        requirement: '',
        category: '',
        priority: 'MEDIUM'
      })
      fetchRequirements()
    } catch (error) {
      console.error('Error saving requirement:', error)
      toast({
        title: "Error",
        description: `No se pudo guardar el requerimiento ${newRequirement.prefix}-${newRequirement.number || ''}. El id ${newRequirement.prefix}-${newRequirement.number|| ''} ya existe.`,
        variant: "destructive"
      })
    }
  }

  // Handle requirements generated from AI - ENHANCED: Now uses sequential numbering
  const handleRequirementsGenerated = async (aiRequirements: Omit<UserRequirement, 'id' | 'source' | 'createdAt'>[]) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado para guardar requerimientos",
        variant: "destructive"
      })
      return
    }

    try {
      const userEmail = user.email || ''
      
      // Get the starting number for sequential numbering
      const startingNumber = await getNextSequentialNumber('URS')
      let currentNumber = parseInt(startingNumber, 10)

      // Prepare requirements for database insertion with sequential numbering
      const requirementsToInsert = aiRequirements.map((req, index) => {
        const sequentialNumber = (currentNumber + index).toString().padStart(3, '0')
        
        return {
          requirement: req.requirement,
          category: req.category,
          priority: req.priority,
          prefix: 'URS', // Standard prefix for AI-generated requirements
          number: sequentialNumber,
          source: 'ai-generated' as const,
          email: userEmail,
          user_id: user.id
        }
      })

      console.log('AI Requirements with sequential numbering:', requirementsToInsert)

      // Insert all requirements into the database
      const { data, error } = await supabase
        .from('user_requirements')
        .insert(requirementsToInsert)
        .select()

      if (error) {
        console.error('Error inserting AI requirements:', error)
        throw error
      }

      // Create audit trail entries for each inserted requirement
      if (data && data.length > 0) {
        const auditEntries = data.map(req => ({
          user_id: user.id,
          action: 'CREATE',
          entity: 'user_requirement',
          entity_id: req.id,
          details: {
            new_data: {
              ...req,
              source: 'ai-generated'
            },
            timestamp: new Date().toISOString(),
            performed_by: {
              id: user.id,
              email: userEmail
            }
          }
        }))

        await supabase.from('audit_trail').insert(auditEntries)
      }

      // Refresh the requirements list
      await fetchRequirements()
      
      toast({
        title: "¡Requerimientos generados con IA guardados!",
        description: `Se han guardado ${aiRequirements.length} requerimientos con numeración secuencial desde URS-${startingNumber}`,
      })

    } catch (error) {
      console.error('Error saving AI requirements:', error)
      toast({
        title: "Error",
        description: "No se pudieron guardar los requerimientos generados por IA en la base de datos",
        variant: "destructive"
      })
      
      // Fallback: Add to local state only if database save fails
      const newRequirements: UserRequirement[] = aiRequirements.map(req => ({
        ...req,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        source: 'ai-generated',
        created_at: new Date().toISOString()
      }))

      setRequirements(prev => [...prev, ...newRequirements])
      
      toast({
        title: "Requerimientos agregados localmente",
        description: `Se agregaron ${newRequirements.length} requerimientos al estado local (no guardados en BD)`,
        variant: "destructive"
      })
    }
  }


  const editRequirement = (requirement: UserRequirement) => {
    setEditingRequirement(requirement)
    setNewRequirement({
      requirement: requirement.requirement,
      category: requirement.category,
      priority: requirement.priority
    })
    setIsDialogOpen(true)
  }

  const deleteRequirement = async (id: string) => {
    try {
      // First, fetch the data before deleting
      const { data: oldData, error: fetchError } = await supabase
        .from('user_requirements')
        .select('*')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError
      
      // Then delete the data
      const { error } = await supabase
        .from('user_requirements')
        .delete()
        .eq('id', id)

      if (error) throw error

      if (user) {
        // Create a filtered version of oldData with only the required fields
        const filteredData = {
          prefix: oldData.prefix,
          number: oldData.number,
          category: oldData.category,
          requirement: oldData.requirement
        };
        
        await supabase.from('audit_trail').insert({
          user_id: user.id,
          action: 'DELETE',
          entity: 'user_requirement',
          entity_id: id,
          details: {
            deleted_data: filteredData,
            timestamp: new Date().toISOString(),
            performed_by: {
              id: user.id,
              email: user.email
            }
          }  
    })}

      toast({
        title: "Éxito",
        description: "Requerimiento eliminado correctamente"
      })
      
      fetchRequirements()
    } catch (error) {
      console.error('Error deleting requirement:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el requerimiento",
        variant: "destructive"
      })
    }
  }

  const resetDialog = () => {
    setEditingRequirement(null)
    setNewRequirement({
      requirement: '',
      category: '',
      priority: 'MEDIUM',
      email: user?.email || ''
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Requerimientos de Usuario</h1>
      </div>

      {/* Tabs for Manual vs AI Generation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" className="flex items-center space-x-2">
            <PenTool className="h-4 w-4" />
            <span>Generación Manual</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span>Generación con IA</span>
          </TabsTrigger>
        </TabsList>

        {/* Manual Generation Tab */}
        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PenTool className="h-5 w-5 text-blue-600" />
                <span>Crear Requerimiento Manual</span>
              </CardTitle>
              <CardDescription>
                Crea requerimientos de usuario de forma manual con control total sobre cada campo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetDialog} className="flex items-center space-x-2" size="lg">
                      <Plus className="h-5 w-5" />
                      <span>Nuevo Requerimiento Manual</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <PenTool className="h-5 w-5" />
                        <span>{editingRequirement ? 'Editar' : 'Crear'} Requerimiento</span>
                      </DialogTitle>
                      <DialogDescription>
                        {editingRequirement
                          ? 'Modifica los detalles del requerimiento'
                          : 'Crea un nuevo requerimiento de usuario para el sistema'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="prefix">Prefijo</Label>
                          <Select
                            value={newRequirement.prefix || ''}
                            onValueChange={value => setNewRequirement(prev => ({ ...prev, prefix: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un prefijo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="URS">URS</SelectItem>
                              <SelectItem value="FI">FI</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="number">Número (opcional)</Label>
                          <Input
                            id="number"
                            type="text"
                            value={newRequirement.number || ''}
                            onChange={e => setNewRequirement(prev => ({ ...prev, number: e.target.value }))}
                            placeholder="Ej: 001 (auto si se deja vacío)"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="requirement">Descripción del Requerimiento</Label>
                        <Textarea
                          id="requirement"
                          value={newRequirement.requirement}
                          onChange={(e) => setNewRequirement(prev => ({
                            ...prev,
                            requirement: e.target.value
                          }))}
                          placeholder="Describe el requerimiento funcional o no funcional..."
                          rows={4}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="category">Categoría</Label>
                          <Select
                            value={newRequirement.category}
                            onValueChange={(value) => setNewRequirement(prev => ({
                              ...prev,
                              category: value
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(category => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="priority">Prioridad</Label>
                          <Select
                            value={newRequirement.priority}
                            onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') => setNewRequirement(prev => ({
                              ...prev,
                              priority: value
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
                      <div className="flex space-x-2 pt-4">
                        <Button onClick={saveRequirement} className="flex-1">
                          {editingRequirement ? 'Actualizar' : 'Crear'} Requerimiento
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Generation Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <span>Generación Automática con IA</span>
              </CardTitle>
              <CardDescription>
                Sube una imagen de tu mapa de proceso y deja que la IA genere requerimientos automáticamente con numeración secuencial
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProcessMapAnalyzer onRequirementsGenerated={handleRequirementsGenerated} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Requirements List - Shared between both tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Requerimientos (Ordenados por Número)</CardTitle>
              <CardDescription>
                Gestiona los requerimientos funcionales y no funcionales del sistema - Ordenados de menor a mayor
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="LOW">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 border rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredRequirements.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {requirements.length === 0
                  ? 'No hay requerimientos creados. Crea el primero.'
                  : 'No se encontraron requerimientos con los filtros aplicados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequirements.map((requirement) => {
                const PriorityIcon = priorityIcons[requirement.priority]
                return (
                  <div key={requirement.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">{requirement.category}</Badge>
                          <Badge className={priorityColors[requirement.priority]}>
                            <PriorityIcon className="h-3 w-3 mr-1" />
                            {requirement.priority === 'HIGH' ? 'Alta' : requirement.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                          </Badge>
                          {requirement.prefix && requirement.number && (
                            <Badge variant="outline" className="font-mono">
                              {requirement.prefix}-{requirement.number}
                            </Badge>
                          )}
                          {requirement.source === 'ai-generated' ? (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Sparkles className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800">
                              <PenTool className="h-3 w-3 mr-1" />
                              Manual
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-900 mb-2">{requirement.requirement}</p>
                        <p className="text-xs text-gray-500">
                          Creado el {new Date(requirement.created_at!).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editRequirement(requirement)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRequirement(requirement.id!)}
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

      {/* Statistics - Shared between both tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {requirements.filter(r => r.priority === 'HIGH').length}
              </div>
              <div className="text-sm text-gray-500">Prioridad Alta</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {requirements.filter(r => r.priority === 'MEDIUM').length}
              </div>
              <div className="text-sm text-gray-500">Prioridad Media</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {requirements.filter(r => r.priority === 'LOW').length}
              </div>
              <div className="text-sm text-gray-500">Prioridad Baja</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {requirements.filter(r => r.source === 'ai-generated').length}
              </div>
              <div className="text-sm text-gray-500">Generados por IA</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}