import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Link,
  Filter
} from 'lucide-react'

interface TraceabilityEntry {
  id?: string
  requirement_id: string
  test_case_id: string
  prefix?: string
  number?: number
  protocol_id: string
  status: 'PASSED' | 'FAILED' | 'PENDING'
  created_at?: string
  updated_at?: string
  auto_created?: boolean
  requirement?: {
    requirement: string
    category: string
    prefix?: string
    number?: string
  }
  protocol?: {
    title: string
    protocol_type: string
  }
}

interface UserRequirement {
  id: string
  requirement: string
  category: string
  prefix?: string
  number?: string
}

interface ValidationProtocol {
  id: string
  title: string
  protocol_type: string
  content: any
}

const statusColors = {
  PASSED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800'
}

const statusIcons = {
  PASSED: CheckCircle,
  FAILED: XCircle,
  PENDING: Clock
}

export default function TraceabilityMatrix() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [traceabilityEntries, setTraceabilityEntries] = useState<TraceabilityEntry[]>([])
  const [requirements, setRequirements] = useState<UserRequirement[]>([])
  const [protocols, setProtocols] = useState<ValidationProtocol[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TraceabilityEntry | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterProtocol, setFilterProtocol] = useState<string>('all')
  const [newEntry, setNewEntry] = useState<TraceabilityEntry>({
    requirement_id: '',
    test_case_id: '',
    protocol_id: '',
    status: 'PENDING'
  })

  useEffect(() => {
    fetchData()
  }, [user])

  // Set up real-time sync when component mounts
  useEffect(() => {
    if (!user) return

    // Only listen to traceability_matrix changes to avoid triggering sync loops
    const matrixSubscription = supabase
      .channel('traceability_matrix_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'traceability_matrix'
        }, 
        (payload) => {
          console.log('Traceability matrix changed:', payload)
          // Refresh data when matrix changes (without sync)
          fetchDataWithoutSync()
        }
      )
      .subscribe()

    return () => {
      matrixSubscription.unsubscribe()
    }
  }, [user])

  // Function to fetch data without triggering sync (to avoid loops)
  const fetchDataWithoutSync = async () => {
    if (!user) return

    try {
      // Fetch traceability entries with related data
      const { data: entriesData, error: entriesError } = await supabase
        .from('traceability_matrix')
        .select(`
          *,
          user_requirements!inner(id, requirement, category, prefix, number),
          validation_protocols!inner(title, type)
        `)
        .order('created_at', { ascending: false })

      if (entriesError && entriesError.code !== 'PGRST116') {
        console.error('Error fetching traceability entries:', entriesError)
        setTraceabilityEntries([])
      } else {
        // Map the data with proper relationships
        const entriesWithDetails = (entriesData || []).map((entry: any) => ({
          ...entry,
          requirement: entry.user_requirements || null,
          protocol: entry.validation_protocols ? {
            ...entry.validation_protocols,
            protocol_type: entry.validation_protocols.type
          } : null
        }))

        setTraceabilityEntries(entriesWithDetails)
      }

      // Fetch available requirements with prefix and number
      const { data: requirementsData, error: requirementsError } = await supabase
        .from('user_requirements')
        .select('id, requirement, category, prefix, number')

      if (requirementsError) throw requirementsError

      setRequirements(requirementsData || [])

      // Fetch available protocols
      const { data: protocolsData, error: protocolsError } = await supabase
        .from('validation_protocols')
        .select('id, title, type, content')

      if (protocolsError && protocolsError.code !== 'PGRST116') {
        console.error('Error fetching protocols:', protocolsError)
      }

      // Map type to protocol_type for consistency
      const mappedProtocols = (protocolsData || []).map((p: any) => ({
        ...p,
        protocol_type: p.type
      }))

      setProtocols(mappedProtocols)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de trazabilidad",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const syncExecutionResults = async () => {
    if (!user) return

    try {
      // Fetch all protocol executions
      const { data: executionsData, error: executionsError } = await supabase
        .from('protocol_executions')
        .select('*')

      if (executionsError && executionsError.code !== 'PGRST116') {
        console.error('Error fetching executions:', executionsError)
        return
      }

      if (!executionsData || executionsData.length === 0) return

      // For each execution, check if there's a corresponding traceability entry
      for (const execution of executionsData) {
        // Check if traceability entry already exists with exact match
        const { data: existingEntries, error: existingError } = await supabase
          .from('traceability_matrix')
          .select('*')
          .eq('protocol_id', execution.protocol_id)
          .eq('test_case_id', execution.test_case_id)

        if (existingError && existingError.code !== 'PGRST116') {
          console.error('Error checking existing entry:', existingError)
          continue
        }

        // If no existing entries, create a new one (only for current user's executions)
        if (!existingEntries || existingEntries.length === 0) {
          if (execution.executed_by === user.id) {
            // First, verify that the protocol exists
            const { data: protocolExists, error: protocolError } = await supabase
              .from('validation_protocols')
              .select('id')
              .eq('id', execution.protocol_id)
              .single()

            if (protocolError || !protocolExists) {
              console.log(`Protocol ${execution.protocol_id} not found, skipping traceability entry creation`)
              continue
            }

            // Try to find a matching requirement for this protocol/test case
            const { data: requirementsData, error: reqError } = await supabase
              .from('user_requirements')
              .select('id')
              .limit(1)

            if (reqError && reqError.code !== 'PGRST116') {
              console.error('Error fetching requirements:', reqError)
              continue
            }

            if (requirementsData && requirementsData.length > 0) {
              // Create new traceability entry
              const { error: insertError } = await supabase
                .from('traceability_matrix')
                .insert({
                  requirement_id: requirementsData[0].id,
                  test_case_id: execution.test_case_id,
                  protocol_id: execution.protocol_id,
                  status: execution.status,
                  user_id: execution.executed_by,
                  auto_created: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })

              if (insertError && insertError.code !== 'PGRST116') {
                console.error('Error creating traceability entry:', insertError)
              }
            }
          }
        } else {
          // Update existing entry with latest execution status
          const existingEntry = existingEntries[0]
          const existingDate = new Date(existingEntry.updated_at || existingEntry.created_at)
          const executionDate = new Date(execution.executed_at || execution.created_at)
          
          if (executionDate >= existingDate) {
            await supabase
              .from('traceability_matrix')
              .update({
                status: execution.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingEntry.id)
          }
        }
      }
    } catch (error) {
      console.error('Error syncing execution results:', error)
    }
  }

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch traceability entries with related data (remove user_id filter so all users can see all records)
      const { data: entriesData, error: entriesError } = await supabase
        .from('traceability_matrix')
        .select(`
          *,
          user_requirements!inner(id, requirement, category, prefix, number),
          validation_protocols!inner(title, type)
        `)
        .order('created_at', { ascending: false })

      if (entriesError && entriesError.code !== 'PGRST116') {
        console.error('Error fetching traceability entries:', entriesError)
        setTraceabilityEntries([])
      } else {
        // Map the data with proper relationships
        const entriesWithDetails = (entriesData || []).map((entry: any) => ({
          ...entry,
          requirement: entry.user_requirements || null,
          protocol: entry.validation_protocols ? {
            ...entry.validation_protocols,
            protocol_type: entry.validation_protocols.type
          } : null
        }))

        setTraceabilityEntries(entriesWithDetails)
      }

      // Fetch available requirements with prefix and number
      const { data: requirementsData, error: requirementsError } = await supabase
        .from('user_requirements')
        .select('id, requirement, category, prefix, number')

      if (requirementsError) throw requirementsError

      setRequirements(requirementsData || [])

      // Fetch available protocols
      const { data: protocolsData, error: protocolsError } = await supabase
        .from('validation_protocols')
        .select('id, title, type, content')

      if (protocolsError && protocolsError.code !== 'PGRST116') {
        console.error('Error fetching protocols:', protocolsError)
      }

      // Map type to protocol_type for consistency
      const mappedProtocols = (protocolsData || []).map((p: any) => ({
        ...p,
        protocol_type: p.type
      }))

      setProtocols(mappedProtocols)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de trazabilidad",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveEntry = async () => {
    if (!user || !newEntry.requirement_id || !newEntry.protocol_id || !newEntry.test_case_id) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive"
      })
      return
    }

    try {
      // First, verify that the protocol exists
      const { data: protocolExists, error: protocolError } = await supabase
        .from('validation_protocols')
        .select('id')
        .eq('id', newEntry.protocol_id)
        .single()

      if (protocolError || !protocolExists) {
        toast({
          title: "Error",
          description: "El protocolo seleccionado no existe o ha sido eliminado",
          variant: "destructive"
        })
        return
      }

      // Verify that the requirement exists
      const { data: requirementExists, error: requirementError } = await supabase
        .from('user_requirements')
        .select('id')
        .eq('id', newEntry.requirement_id)
        .single()

      if (requirementError || !requirementExists) {
        toast({
          title: "Error",
          description: "El requerimiento seleccionado no existe o ha sido eliminado",
          variant: "destructive"
        })
        return
      }

      if (editingEntry) {
        // Update existing
        const { error } = await supabase
          .from('traceability_matrix')
          .update({
            requirement_id: newEntry.requirement_id,
            test_case_id: newEntry.test_case_id,
            protocol_id: newEntry.protocol_id,
            status: newEntry.status
          })
          .eq('id', editingEntry.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('traceability_matrix')
          .insert({
            requirement_id: newEntry.requirement_id,
            test_case_id: newEntry.test_case_id,
            protocol_id: newEntry.protocol_id,
            status: newEntry.status,
            user_id: user.id
          })

        if (error) throw error
      }

      toast({
        title: "Éxito",
        description: `Entrada de trazabilidad ${editingEntry ? 'actualizada' : 'creada'} correctamente`
      })

      setIsDialogOpen(false)
      setEditingEntry(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving entry:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar la entrada de trazabilidad",
        variant: "destructive"
      })
    }
  }

  const editEntry = (entry: TraceabilityEntry) => {
    setEditingEntry(entry)
    setNewEntry({
      requirement_id: entry.requirement_id,
      test_case_id: entry.test_case_id,
      protocol_id: entry.protocol_id,
      status: entry.status
    })
    setIsDialogOpen(true)
  }

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('traceability_matrix')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Entrada de trazabilidad eliminada correctamente"
      })

      fetchData()
    } catch (error) {
      console.error('Error deleting entry:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la entrada de trazabilidad",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setEditingEntry(null)
    setNewEntry({
      requirement_id: '',
      test_case_id: '',
      protocol_id: '',
      status: 'PENDING'
    })
  }

  const getTestCasesForProtocol = (protocolId: string) => {
    const protocol = protocols.find(p => p.id === protocolId)
    return protocol?.content?.test_cases || []
  }

  const filteredEntries = traceabilityEntries.filter(entry => {
    const statusMatch = filterStatus === 'all' || entry.status === filterStatus
    const protocolMatch = filterProtocol === 'all' || entry.protocol_id === filterProtocol
    return statusMatch && protocolMatch
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Matriz de Trazabilidad</h1>
          <p className="text-sm text-gray-600 mt-1">
            Las ejecuciones de pruebas se sincronizan automáticamente desde los protocolos ejecutados
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => {
              syncExecutionResults().then(() => fetchData())
            }} 
            variant="outline"
            className="flex items-center space-x-2"
          >
            <span>Sincronizar</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Nueva Trazabilidad</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Editar' : 'Crear'} Entrada de Trazabilidad
                </DialogTitle>
                <DialogDescription>
                  {editingEntry
                    ? 'Modifica la entrada de trazabilidad existente'
                    : 'Crea una nueva relación entre requerimiento, protocolo y caso de prueba'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="requirement_id">Requerimiento</Label>
                  <Select
                    value={newEntry.requirement_id}
                    onValueChange={(value) => setNewEntry(prev => ({
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
                            <span className="truncate max-w-md">{req.requirement}</span>
                            <Badge variant="secondary" className="w-fit text-xs">
                              {req.category}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="protocol_id">Protocolo de Validación</Label>
                  <Select
                    value={newEntry.protocol_id}
                    onValueChange={(value) => setNewEntry(prev => ({
                      ...prev,
                      protocol_id: value,
                      test_case_id: '' // Reset test case when protocol changes
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un protocolo" />
                    </SelectTrigger>
                    <SelectContent>
                      {protocols.map(protocol => (
                        <SelectItem key={protocol.id} value={protocol.id}>
                          <div className="flex flex-col">
                            <span>{protocol.title}</span>
                            <Badge variant="secondary" className="w-fit text-xs">
                              {protocol.protocol_type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newEntry.protocol_id && (
                  <div>
                    <Label htmlFor="test_case_id">Caso de Prueba</Label>
                    <Select
                      value={newEntry.test_case_id}
                      onValueChange={(value) => setNewEntry(prev => ({
                        ...prev,
                        test_case_id: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un caso de prueba" />
                      </SelectTrigger>
                      <SelectContent>
                        {getTestCasesForProtocol(newEntry.protocol_id).map((testCase: any) => (
                          <SelectItem key={testCase.id} value={testCase.id}>
                            <span className="truncate max-w-md">{testCase.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={newEntry.status}
                    onValueChange={(value: 'PASSED' | 'FAILED' | 'PENDING') => setNewEntry(prev => ({
                      ...prev,
                      status: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pendiente</SelectItem>
                      <SelectItem value="PASSED">Aprobado</SelectItem>
                      <SelectItem value="FAILED">Fallido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button onClick={saveEntry} className="flex-1">
                    {editingEntry ? 'Actualizar' : 'Crear'} Trazabilidad
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Trazabilidades</p>
                <p className="text-2xl font-bold">{traceabilityEntries.length}</p>
              </div>
              <Link className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Casos Aprobados</p>
                <p className="text-2xl font-bold text-green-600">
                  {traceabilityEntries.filter(e => e.status === 'PASSED').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Casos Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {traceabilityEntries.filter(e => e.status === 'PENDING').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Casos Fallidos</p>
                <p className="text-2xl font-bold text-red-600">
                  {traceabilityEntries.filter(e => e.status === 'FAILED').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Matriz de Trazabilidad</CardTitle>
              <CardDescription>
                Relación entre requerimientos, protocolos y casos de prueba
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendientes</SelectItem>
                  <SelectItem value="PASSED">Aprobados</SelectItem>
                  <SelectItem value="FAILED">Fallidos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProtocol} onValueChange={setFilterProtocol}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Protocolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {protocols.map(protocol => (
                    <SelectItem key={protocol.id} value={protocol.id}>
                      {protocol.protocol_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <Link className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {traceabilityEntries.length === 0
                  ? 'No hay entradas de trazabilidad creadas. Crea la primera.'
                  : 'No se encontraron entradas con los filtros aplicados.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requerimiento</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Caso de Prueba</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const StatusIcon = statusIcons[entry.status]
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {(() => {
                          const protocol = protocols.find(p => p.id === entry.protocol_id)
                          const testCase = protocol?.content?.test_cases?.find(
                            (tc: any) => tc.id === entry.test_case_id
                          )

                          const requirement = testCase
                            ? requirements.find(r => r.id === testCase.requirement_id)
                            : entry.requirement

                          return (
                            <div>
                              <div className="text-sm text-gray-600 truncate">
                                {requirement?.requirement || 'N/A'}
                              </div>
                              <div className="flex items-center space-x-1 mt-1">
                                <Badge variant="outline">
                                  <div className="font-medium text-blue-600 mb-1">
                                    {requirement?.prefix || testCase?.prefix || 'REQ'}-{requirement?.number || testCase?.number || '001'}
                                  </div>
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {requirement?.category || 'N/A'}
                                </Badge>
                              </div>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">
                            {entry.protocol?.title || 'N/A'}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {entry.protocol?.protocol_type || 'N/A'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm truncate">
                          {(() => {
                            const protocol = protocols.find(p => p.id === entry.protocol_id)
                            const testCase = protocol?.content?.test_cases?.find((tc: any) => tc.id === entry.test_case_id)
                            return testCase?.description || 'N/A'
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[entry.status]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {entry.status === 'PASSED' ? 'Aprobado' : 
                           entry.status === 'FAILED' ? 'Fallido' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editEntry(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEntry(entry.id!)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}