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
  Play,
  Search,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Eye,
  Edit2,
  Filter,
  BarChart3,
  AlertTriangle,
  Trash2,
  Camera,
  Upload,
  X,
  FolderOpen,
  Lock
} from 'lucide-react'

interface ValidationProtocol {
  id: string
  title: string
  protocol_type: 'IQ' | 'OQ' | 'PQ'
  content: {
    description: string
    test_cases: TestCase[]
    metadata?: any
  }
  status: string
  created_at: string
}

interface TestCase {
  id: string
  title: string
  description: string
  expected_result: string
  test_steps: string[]
  acceptance_criteria: string
}

interface ProtocolExecution {
  id?: string
  protocol_id: string
  test_case_id: string
  status: 'PASSED' | 'FAILED' | 'PENDING'
  comments?: string
  executed_by: string
  executed_at: string
  observations?: string
  actual_result?: string
  evidence_files?: string[]
}

interface ExecutionSession {
  id?: string
  protocol_id: string
  session_name: string
  started_at: string
  completed_at?: string
  executed_by: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED'
  executions: ProtocolExecution[]
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

export default function ProtocolExecution() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // State management
  const [protocols, setProtocols] = useState<ValidationProtocol[]>([])
  const [selectedProtocol, setSelectedProtocol] = useState<ValidationProtocol | null>(null)
  const [executionSessions, setExecutionSessions] = useState<ExecutionSession[]>([])
  const [currentSession, setCurrentSession] = useState<ExecutionSession | null>(null)
  const [executions, setExecutions] = useState<ProtocolExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isExecutionDialogOpen, setIsExecutionDialogOpen] = useState(false)
  const [activeTestCase, setActiveTestCase] = useState<TestCase | null>(null)
  const [executionResult, setExecutionResult] = useState<ProtocolExecution>({
    protocol_id: '',
    test_case_id: '',
    status: 'PENDING',
    comments: '',
    executed_by: '',
    executed_at: '',
    observations: '',
    actual_result: '',
    evidence_files: []
  })
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false)
  const [statistics, setStatistics] = useState<any>({})
  const [showTestCasesDialog, setShowTestCasesDialog] = useState(false)
  const [isProtocolClosed, setIsProtocolClosed] = useState(false)

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch validation protocols
      const { data: protocolsData, error: protocolsError } = await supabase
        .from('validation_protocols')
        .select('*')
        .order('created_at', { ascending: false })

      if (protocolsError) throw protocolsError
      
      console.log('Protocols fetched:', protocolsData)
      protocolsData?.forEach((protocol, index) => {
        console.log(`Protocol ${index + 1}:`, protocol.title)
        console.log(`Protocol type:`, protocol.type)
        console.log(`Protocol description:`, protocol.content?.description)
        console.log(`Test cases count:`, protocol.content?.test_cases?.length || 0)
      })
      
      // Map the database 'type' field to 'protocol_type' to match our interface
      setProtocols(
        (protocolsData || []).map((p: any) => ({
          ...p,
          protocol_type: p.type // Map 'type' from DB to 'protocol_type' in interface
        }))
      )

      // Fetch execution sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('protocol_execution_sessions')
        .select('*')
        .order('started_at', { ascending: false })

      if (sessionsError && sessionsError.code !== 'PGRST116') {
        console.error('Error fetching sessions:', sessionsError)
      }
      setExecutionSessions(sessionsData || [])

      // Fetch individual executions
      const { data: executionsData, error: executionsError } = await supabase
        .from('protocol_executions')
        .select('*')
        .order('executed_at', { ascending: false })

      if (executionsError && executionsError.code !== 'PGRST116') {
        console.error('Error fetching executions:', executionsError)
      }
      setExecutions(executionsData || [])

      // Calculate statistics
      calculateStatistics(executionsData || [])

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

  const calculateStatistics = (executionsData: ProtocolExecution[]) => {
    const stats = {
      total: protocols.length,
      passed: executionsData.filter(e => e.status === 'PASSED').length,
      failed: executionsData.filter(e => e.status === 'FAILED').length,
      pending: executionsData.filter(e => e.status === 'PENDING').length,
      protocols_executed: new Set(executionsData.map(e => e.protocol_id)).size
    }
    setStatistics(stats)
  }

  const startProtocolExecution = async (protocol: ValidationProtocol) => {
    try {
      console.log('Starting protocol execution:', protocol)
      console.log('Test cases found:', protocol.content?.test_cases?.length || 0)
      
      // Load existing executions for this protocol
      const { data: existingExecutions, error: executionsError } = await supabase
        .from('protocol_executions')
        .select('*')
        .eq('protocol_id', protocol.id)
        //.eq('executed_by', user!.id)
        .order('executed_at', { ascending: false })

      if (executionsError && executionsError.code !== 'PGRST116') {
        console.error('Error loading existing executions:', executionsError)
      }

      // Debug: Log existing executions with evidence
      console.log('Existing executions loaded:', existingExecutions)
      existingExecutions?.forEach((exec, index) => {
        console.log(`Execution ${index + 1}:`, {
          test_case_id: exec.test_case_id,
          status: exec.status,
          evidence_files: exec.evidence_files,
          evidence_count: exec.evidence_files?.length || 0,
          evidence_type: typeof exec.evidence_files,
          evidence_is_array: Array.isArray(exec.evidence_files)
        })
      })

      // Update the global executions state with the loaded data
      setExecutions(prev => {
        // Remove existing executions for this protocol and add the fresh ones
        const filtered = prev.filter(e => e.protocol_id !== protocol.id)
        return [...filtered, ...(existingExecutions || [])]
      })

      const sessionName = `Ejecución ${protocol.title} - ${new Date().toLocaleString('es-ES')}`
      
      const newSession: ExecutionSession = {
        protocol_id: protocol.id,
        session_name: sessionName,
        started_at: new Date().toISOString(),
        executed_by: user!.id,
        status: 'IN_PROGRESS',
        executions: existingExecutions || [] // Load existing executions into the session
      }

      // Create session in database (if table exists)
      const { data: sessionData, error: sessionError } = await supabase
        .from('protocol_execution_sessions')
        .insert({
          protocol_id: protocol.id,
          session_name: sessionName,
          started_at: newSession.started_at,
          executed_by: user!.id,
          status: 'IN_PROGRESS',
          user_id: user!.id
        })
        .select()
        .single()

      if (sessionError && sessionError.code !== 'PGRST116') {
        throw sessionError
      }

      if (sessionData) {
        newSession.id = sessionData.id
      }

      setCurrentSession(newSession)
      setSelectedProtocol(protocol)
      // Check if protocol is already completed
      setIsProtocolClosed(protocol.status === 'COMPLETED')
      
      console.log('Session started with existing executions:', existingExecutions?.length || 0)
      
      toast({
        title: "Éxito",
        description: `Sesión de ejecución iniciada correctamente${existingExecutions?.length ? ` (${existingExecutions.length} ejecuciones previas cargadas)` : ''}`
      })

    } catch (error) {
      console.error('Error starting execution:', error)
      toast({
        title: "Error",
        description: "No se pudo iniciar la ejecución del protocolo",
        variant: "destructive"
      })
    }
  }

  const executeTestCase = (testCase: TestCase) => {
    if (isProtocolClosed) {
      // If protocol is closed, only allow viewing
      console.log('Protocol is closed, opening in view-only mode')
    } else {
      console.log('Executing test case:', testCase.id)
    }
    
    setActiveTestCase(testCase)
    
    // Check if there's already an execution result for this test case
    const existingExecution = currentSession?.executions.find(e => e.test_case_id === testCase.id) ||
                             executions.find(e => e.test_case_id === testCase.id && e.protocol_id === selectedProtocol?.id)
    
    console.log('Found existing execution for test case:', testCase.id, existingExecution)
    console.log('Evidence files in existing execution:', existingExecution?.evidence_files)
    
    if (existingExecution) {
      // Ensure evidence_files is properly loaded
      const evidenceFiles = existingExecution.evidence_files || []
      console.log('Setting execution result with evidence:', evidenceFiles)
      
      setExecutionResult({
        ...existingExecution,
        evidence_files: evidenceFiles
      })
      setEvidenceFiles([])
    } else {
      setExecutionResult({
        protocol_id: selectedProtocol!.id,
        test_case_id: testCase.id,
        status: 'PENDING',
        comments: '',
        executed_by: user!.id,
        executed_at: new Date().toISOString(),
        observations: '',
        actual_result: '',
        evidence_files: []
      })
      setEvidenceFiles([])
    }
    
    setIsExecutionDialogOpen(true)
  }

  const TestCasesVisualizationDialog = () => (
    <Dialog open={showTestCasesDialog} onOpenChange={setShowTestCasesDialog}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Casos de Prueba y Evidencias
          </DialogTitle>
          <DialogDescription>
            Visualización completa de todos los casos de prueba y sus evidencias
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[60vh] pr-2">
          <div className="space-y-4">
            {selectedProtocol?.content?.test_cases?.map((testCase, index) => {
              const execution = currentSession?.executions.find(e => e.test_case_id === testCase.id) ||
                               executions.find(e => e.test_case_id === testCase.id && e.protocol_id === selectedProtocol?.id)
              const status = execution?.status || 'PENDING'
              const StatusIcon = statusIcons[status as keyof typeof statusIcons]
              
              return (
                <Card key={testCase.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Caso #{index + 1}: {testCase.title}
                      </CardTitle>
                      <Badge className={statusColors[status as keyof typeof statusColors]}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status === 'PASSED' ? 'Aprobado' : 
                         status === 'FAILED' ? 'Fallido' : 'Pendiente'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Descripción:</Label>
                      <p className="text-sm text-muted-foreground mt-1">{testCase.description}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Resultado Esperado:</Label>
                      <p className="text-sm text-muted-foreground mt-1">{testCase.expected_result}</p>
                    </div>

                    {testCase.test_steps && testCase.test_steps.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Pasos de Prueba:</Label>
                        <ol className="list-decimal list-inside text-sm text-muted-foreground mt-1 space-y-1">
                          {testCase.test_steps.map((step, stepIndex) => (
                            <li key={stepIndex}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {testCase.acceptance_criteria && (
                      <div>
                        <Label className="text-sm font-medium">Criterios de Aceptación:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{testCase.acceptance_criteria}</p>
                      </div>
                    )}

                    {execution?.actual_result && (
                      <div>
                        <Label className="text-sm font-medium">Resultado Actual:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{execution.actual_result}</p>
                      </div>
                    )}

                    {execution?.comments && (
                      <div>
                        <Label className="text-sm font-medium">Comentarios:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{execution.comments}</p>
                      </div>
                    )}

                    {execution?.observations && (
                      <div>
                        <Label className="text-sm font-medium">Observaciones:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{execution.observations}</p>
                      </div>
                    )}

                    {execution?.evidence_files && Array.isArray(execution.evidence_files) && execution.evidence_files.length > 0 ? (
                      <div>
                        <Label className="text-sm font-medium">Evidencias ({execution.evidence_files.length}):</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {execution.evidence_files.map((url, evidenceIndex) => (
                            <div
                                key={evidenceIndex}
                                className="relative group cursor-pointer"
                                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                                >
                                <img
                                    src={url}
                                    alt={`Evidencia ${evidenceIndex + 1}`}
                                    className="w-full h-20 object-cover rounded border hover:opacity-80 transition-opacity"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all duration-200 flex items-center justify-center">
                                    <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>

                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay evidencias disponibles</p>
                      </div>
                    )}

                    {execution?.executed_at && (
                      <div className="text-xs text-gray-500 pt-2 border-t">
                        Ejecutado el {new Date(execution.executed_at).toLocaleString('es-ES', {
                          year: 'numeric',
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  const saveExecution = async () => {
    if (isProtocolClosed) {
      toast({
        title: "Protocolo Cerrado",
        description: "El protocolo está cerrado y no se puede modificar",
        variant: "destructive"
      })
      return
    }
    
    if (!activeTestCase || !executionResult.status) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive"
      })
      return
    }
    
    try {
      // Upload evidence files first
      const evidenceUrls = await uploadEvidenceFiles()

      const executionData = {
        ...executionResult,
        executed_at: new Date().toISOString(),
        evidence_files: evidenceUrls
      }

      // Check if this is an update to an existing execution
      const existingExecution = currentSession?.executions.find(e => e.test_case_id === activeTestCase.id) ||
                               executions.find(e => e.test_case_id === activeTestCase.id && e.protocol_id === selectedProtocol?.id)

      if (existingExecution && existingExecution.id) {
        // Update existing execution
        const { error } = await supabase
          .from('protocol_executions')
          .update({
            status: executionData.status,
            comments: executionData.comments,
            executed_at: executionData.executed_at,
            observations: executionData.observations,
            actual_result: executionData.actual_result,
            evidence_files: executionData.evidence_files
          })
          .eq('id', existingExecution.id)

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        // Update the execution data with the existing ID
        executionData.id = existingExecution.id

        // Update current session executions
        if (currentSession) {
          const updatedExecutions = currentSession.executions.map(e => 
            e.test_case_id === activeTestCase.id ? executionData : e
          )
          setCurrentSession({
            ...currentSession,
            executions: updatedExecutions
          })
        }

        // Update local executions
        setExecutions(prev => prev.map(e => 
          e.test_case_id === activeTestCase.id && e.protocol_id === selectedProtocol?.id ? executionData : e
        ))
      } else {
        // Save new execution to database
        const { data: savedExecution, error } = await supabase
          .from('protocol_executions')
          .insert({
            protocol_id: executionData.protocol_id,
            test_case_id: executionData.test_case_id,
            status: executionData.status,
            comments: executionData.comments,
            executed_by: executionData.executed_by,
            executed_at: executionData.executed_at,
            observations: executionData.observations,
            actual_result: executionData.actual_result,
            evidence_files: executionData.evidence_files,
            user_id: user!.id
          })
          .select()
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        if (savedExecution) {
          executionData.id = savedExecution.id
        }

        // Update current session
        if (currentSession) {
          const updatedExecutions = [...currentSession.executions, executionData]
          setCurrentSession({
            ...currentSession,
            executions: updatedExecutions
          })
        }

        // Update local executions
        setExecutions(prev => [...prev, executionData])
      }

      calculateStatistics([...executions, executionData])

      // Update or create traceability matrix entry
      await updateTraceabilityMatrix(executionData)

      toast({
        title: "Éxito",
        description: "Resultado de ejecución guardado correctamente"
      })

      setIsExecutionDialogOpen(false)
      setActiveTestCase(null)
      setEvidenceFiles([])

    } catch (error) {
      console.error('Error saving execution:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar el resultado de ejecución",
        variant: "destructive"
      })  
    }
  }

  const completeSession = async () => {
    if (!currentSession) return

    // Check if all test cases have been executed (passed or failed)
    const allTestCases = selectedProtocol?.content?.test_cases || []
    const executedCases = currentSession.executions.filter(e => e.status === 'PASSED' || e.status === 'FAILED')
    
    if (executedCases.length !== allTestCases.length) {
      toast({
        title: "Error",
        description: "Debe completar todos los casos de prueba antes de finalizar la sesión",
        variant: "destructive"
      })
      return
    }

    try {
      if (currentSession.id) {
        const { error } = await supabase
          .from('protocol_execution_sessions')
          .update({
            completed_at: new Date().toISOString(),
            status: 'COMPLETED'
          })
          .eq('id', currentSession.id)

        if (error && error.code !== 'PGRST116') {
          throw error
        }
      }

      // Update protocol status to COMPLETED in database
      if (selectedProtocol?.id) {
        const { error: updateError } = await supabase
          .from('validation_protocols')
          .update({ 
            status: 'COMPLETED',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedProtocol.id)

        if (updateError) {
          console.error('Error updating protocol status:', updateError)
          throw updateError
        }
      }



      // Close the protocol
      setIsProtocolClosed(true)
      setCurrentSession(null)
      fetchData()

      toast({
        title: "Éxito",
        description: "Sesión de ejecución completada. El protocolo ha sido cerrado y ya no se puede modificar."
      })

    } catch (error) {
      console.error('Error completing session:', error)
      toast({
        title: "Error",
        description: "No se pudo completar la sesión",
        variant: "destructive"
      })
    }
  }

  const deleteProtocol = async (protocol: ValidationProtocol) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el protocolo "${protocol.title}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      // Delete related executions first
      const { error: executionsError } = await supabase
        .from('protocol_executions')
        .delete()
        .eq('protocol_id', protocol.id)

      if (executionsError && executionsError.code !== 'PGRST116') {
        console.error('Error deleting executions:', executionsError)
      }

      // Delete related execution sessions
      const { error: sessionsError } = await supabase
        .from('protocol_execution_sessions')
        .delete()
        .eq('protocol_id', protocol.id)

      if (sessionsError && sessionsError.code !== 'PGRST116') {
        console.error('Error deleting sessions:', sessionsError)
      }

      // Delete the protocol
      const { error: protocolError } = await supabase
        .from('validation_protocols')
        .delete()
        .eq('id', protocol.id)
        .eq('user_id', user!.id)

      if (protocolError) {
        throw protocolError
      }

      // Update local state
      setProtocols(prev => prev.filter(p => p.id !== protocol.id))
      setExecutions(prev => prev.filter(e => e.protocol_id !== protocol.id))
      setExecutionSessions(prev => prev.filter(s => s.protocol_id !== protocol.id))

      toast({
        title: "Éxito",
        description: "Protocolo eliminado correctamente"
      })

    } catch (error) {
      console.error('Error deleting protocol:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el protocolo",
        variant: "destructive"
      })
    }
  }

  const handleEvidenceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isProtocolClosed) {
      toast({
        title: "Protocolo Cerrado",
        description: "El protocolo está cerrado y no se puede modificar",
        variant: "destructive"
      })
      return
    }
    
    const files = Array.from(event.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "Advertencia",
        description: "Solo se permiten archivos de imagen como evidencia",
        variant: "destructive"
      })
    }
    
    setEvidenceFiles(prev => [...prev, ...imageFiles])
  }

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateTraceabilityMatrix = async (executionData: ProtocolExecution) => {
    try {
      // First check if the traceability_matrix table exists
      const { data: tableCheck, error: tableError } = await supabase
        .from('traceability_matrix')
        .select('id')
        .limit(1)

      if (tableError) {
        console.log('Traceability matrix table not available, skipping update')
        return
      }

      // Check if traceability entry already exists with simpler query
      const { data: existingEntry, error: existingError } = await supabase
        .from('traceability_matrix')
        .select('id, status')
        .eq('protocol_id', executionData.protocol_id)
        .eq('test_case_id', executionData.test_case_id)
        .eq('user_id', user!.id)
        .maybeSingle()

      if (existingError) {
        console.error('Error checking existing traceability entry:', existingError)
        return
      }

      if (existingEntry) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('traceability_matrix')
          .update({
            status: executionData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEntry.id)

        if (updateError) {
          console.error('Error updating traceability entry:', updateError)
        }
      } else {
        // Try to find a matching requirement for auto-creation
        const { data: requirementsData, error: reqError } = await supabase
          .from('user_requirements')
          .select('id')
          .eq('user_id', user!.id)
          .limit(1)

        if (reqError) {
          console.error('Error fetching requirements:', reqError)
          return
        }

        if (requirementsData && requirementsData.length > 0) {
          // Create new traceability entry
          const { error: insertError } = await supabase
            .from('traceability_matrix')
            .insert({
              requirement_id: requirementsData[0].id,
              test_case_id: executionData.test_case_id,
              protocol_id: executionData.protocol_id,
              status: executionData.status,
              user_id: user!.id,
              auto_created: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (insertError) {
            console.error('Error creating traceability entry:', insertError)
          }
        }
      }
    } catch (error) {
      console.error('Error updating traceability matrix:', error)
      // Don't throw error to avoid interrupting the main execution flow
    }
  }

  const uploadEvidenceFiles = async (): Promise<string[]> => {
    if (evidenceFiles.length === 0) return []

    setIsUploadingEvidence(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of evidenceFiles) {
        const fileName = `evidence_${Date.now()}_${Math.random().toString(36).substring(2)}_${file.name}`
        const filePath = `protocol_evidence/${user!.id}/${fileName}`

        const { data, error } = await supabase.storage
          .from('evidence_files')
          .upload(filePath, file)

        if (error) {
          console.error('Error uploading file:', error)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('evidence_files')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)
      }

      return uploadedUrls
    } catch (error) {
      console.error('Error uploading evidence files:', error)
      toast({
        title: "Error",
        description: "Error al subir archivos de evidencia",
        variant: "destructive"
      })
      return []
    } finally {
      setIsUploadingEvidence(false)
    }
  }

  const filteredProtocols = protocols.filter(protocol => {
    const matchesSearch = protocol.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (protocol.content?.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    if (statusFilter === 'ALL') return matchesSearch
    
    return matchesSearch && protocol.status === statusFilter
  })

  const getTestCaseExecutionStatus = (testCaseId: string) => {
    const execution = currentSession?.executions.find(e => e.test_case_id === testCaseId) ||
                     executions.find(e => e.test_case_id === testCaseId && e.protocol_id === selectedProtocol?.id)
    
    return execution?.status || 'PENDING'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ejecución de Protocolos</h1>
          {isProtocolClosed && selectedProtocol && (
            <div className="flex items-center mt-2 text-red-600">
              <Lock className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Protocolo cerrado - Solo lectura</span>
            </div>
          )}
        </div>
        {currentSession && !isProtocolClosed && (
          <div className="flex items-center space-x-2">
            <Badge className="bg-blue-100 text-blue-800">
              <Play className="h-3 w-3 mr-1" />
              Sesión Activa
            </Badge>
            <Button onClick={completeSession} variant="outline">
              Completar Sesión
            </Button>
          </div>
        )}
        {isProtocolClosed && (
          <div className="flex items-center space-x-2">
            <Badge className="bg-gray-100 text-gray-800">
              <Lock className="h-3 w-3 mr-1" />
              Sesión Completada
            </Badge>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Ejecuciones</p>
                <p className="text-2xl font-bold">{statistics.total || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Casos Aprobados</p>
                <p className="text-2xl font-bold text-green-600">{statistics.passed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Casos Fallidos</p>
                <p className="text-2xl font-bold text-red-600">{statistics.failed || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Protocolos Ejecutados</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.protocols_executed || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {!selectedProtocol ? (
        /* Protocol Selection View */
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Protocolo para Ejecutar</CardTitle>
            <CardDescription>
              Elija un protocolo de validación para iniciar su ejecución
            </CardDescription>
            
            {/* Search and Filter */}
            <div className="flex space-x-4 mt-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar protocolos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los Estados</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="APPROVED">Aprobado</SelectItem>
                  <SelectItem value="EXECUTED">Ejecutado</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            ) : filteredProtocols.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchTerm || statusFilter !== 'ALL' 
                    ? 'No se encontraron protocolos con los filtros aplicados.'
                    : 'No hay protocolos de validación disponibles.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProtocols.map((protocol) => (
                  <div key={protocol.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">{protocol.status}</Badge>
                          <Badge className={protocolTypeColors[protocol.protocol_type]}>
                            {protocolTypeLabels[protocol.protocol_type]}
                          </Badge>
                          <Badge variant="outline">
                            {protocol.content?.test_cases?.length || 0} casos de prueba
                          </Badge>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-2">{protocol.title}</h3>
                        {protocol.content?.description && (
                          <p className="text-sm text-gray-600 mb-2 leading-relaxed">{protocol.content.description}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Creado el {new Date(protocol.created_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          onClick={() => startProtocolExecution(protocol)}
                          disabled={!protocol.content?.test_cases || protocol.content.test_cases.length === 0}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {protocol.status === 'COMPLETED' ? 'Ver Resultados' : 'Ejecutar'}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => deleteProtocol(protocol)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
      ) : (
        /* Protocol Execution View */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ejecutando: {selectedProtocol.title}</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={protocolTypeColors[selectedProtocol.protocol_type]}>
                      {protocolTypeLabels[selectedProtocol.protocol_type]}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2">{selectedProtocol.content?.description}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={() => setShowTestCasesDialog(true)} 
                    variant="outline" 
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Casos y Evidencias
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedProtocol(null)
                      setCurrentSession(null)
                      // Don't reset isProtocolClosed - it should maintain its state
                    }}
                  >
                    Volver a Protocolos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {currentSession?.executions.filter(e => e.status === 'PASSED').length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Aprobados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {currentSession?.executions.filter(e => e.status === 'FAILED').length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Fallidos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(selectedProtocol.content?.test_cases?.length || 0) - (currentSession?.executions.length || 0)}
                  </div>
                  <div className="text-sm text-gray-500">Pendientes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Casos de Prueba</CardTitle>
              <CardDescription>
                Ejecute cada caso de prueba y asigne el resultado correspondiente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProtocol.content?.test_cases && selectedProtocol.content.test_cases.length > 0 ? (
                <div className="space-y-4">
                  {selectedProtocol.content.test_cases.map((testCase, index) => {
                    const status = getTestCaseExecutionStatus(testCase.id)
                    const StatusIcon = statusIcons[status as keyof typeof statusIcons]
                    
                    return (
                      <div key={testCase.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={statusColors[status as keyof typeof statusColors]}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status === 'PASSED' ? 'Aprobado' : 
                                 status === 'FAILED' ? 'Fallido' : 'Pendiente'}
                              </Badge>
                              <span className="text-sm text-gray-500">Caso #{index + 1}</span>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-2">{testCase.title}</h4>
                            <p className="text-sm text-gray-600 mb-2">{testCase.description}</p>
                            <div className="text-xs text-gray-500">
                              <strong>Resultado Esperado:</strong> {testCase.expected_result}
                            </div>
                          </div>
                          <div className="ml-4">
                            <Button
                              onClick={() => executeTestCase(testCase)}
                              variant={status === 'PENDING' ? 'default' : 'outline'}
                            >
                              {status === 'PENDING' ? 'Ejecutar' : 'Ver Resultado'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Este protocolo no tiene casos de prueba definidos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Execution Dialog */}
      <Dialog open={isExecutionDialogOpen} onOpenChange={setIsExecutionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isProtocolClosed ? 'Ver Caso de Prueba' : 'Ejecutar Caso de Prueba'}
            </DialogTitle>
            <DialogDescription>
              {isProtocolClosed 
                ? 'Visualización del caso de prueba y sus resultados (Solo lectura)'
                : 'Complete la información de ejecución para el caso de prueba'
              }
            </DialogDescription>
          </DialogHeader>
          
          {activeTestCase && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{activeTestCase.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Descripción:</Label>
                      <p className="text-sm text-gray-600 mt-1">{activeTestCase.description}</p>
                    </div>
                    
                    {activeTestCase.test_steps && activeTestCase.test_steps.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Pasos de Prueba:</Label>
                        <ol className="list-decimal list-inside text-sm text-gray-600 mt-1 space-y-1">
                          {activeTestCase.test_steps.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm font-medium">Resultado Esperado:</Label>
                      <p className="text-sm text-gray-600 mt-1">{activeTestCase.expected_result}</p>
                    </div>
                    
                    {activeTestCase.acceptance_criteria && (
                      <div>
                        <Label className="text-sm font-medium">Criterios de Aceptación:</Label>
                        <p className="text-sm text-gray-600 mt-1">{activeTestCase.acceptance_criteria}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status">Resultado de la Ejecución *</Label>
                    <Select
                      value={executionResult.status}
                      onValueChange={(value: 'PASSED' | 'FAILED' | 'PENDING') => 
                        setExecutionResult(prev => ({ ...prev, status: value }))
                      }
                      disabled={isProtocolClosed}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASSED">
                          <div className="flex items-center">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Aprobado
                          </div>
                        </SelectItem>
                        <SelectItem value="FAILED">
                          <div className="flex items-center">
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            Fallido
                          </div>
                        </SelectItem>
                        <SelectItem value="PENDING">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-yellow-600" />
                            Pendiente
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="actual_result">Resultado Actual</Label>
                    <Textarea
                      id="actual_result"
                      value={executionResult.actual_result}
                      onChange={(e) => setExecutionResult(prev => ({
                        ...prev,
                        actual_result: e.target.value
                      }))}
                      placeholder="Describa el resultado obtenido durante la ejecución..."
                      rows={4}
                      disabled={isProtocolClosed}
                    />
                  </div>


                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comments">Comentarios</Label>
                    <Textarea
                      id="comments"
                      value={executionResult.comments || ''}
                      onChange={(e) => setExecutionResult(prev => ({
                        ...prev,
                        comments: e.target.value
                      }))}
                      placeholder="Comentarios adicionales sobre la ejecución..."
                      rows={4}
                      disabled={isProtocolClosed}
                    />
                  </div>

                  <div>
                    <Label htmlFor="observations">Observaciones</Label>
                    <Textarea
                      id="observations"
                      value={executionResult.observations || ''}
                      onChange={(e) => setExecutionResult(prev => ({
                        ...prev,
                        observations: e.target.value
                      }))}
                      placeholder="Observaciones importantes o notas especiales..."
                      rows={4}
                      disabled={isProtocolClosed}
                    />
                  </div>

                  <div>
                    <Label>Evidencia Fotográfica</Label>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          id="evidence-upload"
                          multiple
                          accept="image/*"
                          onChange={handleEvidenceFileChange}
                          className="hidden"
                        />
                        {!isProtocolClosed && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('evidence-upload')?.click()}
                            disabled={isUploadingEvidence}
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Agregar Capturas
                          </Button>
                        )}
                        <span className="text-sm text-gray-500">
                          {evidenceFiles.length} archivo(s) seleccionado(s)
                        </span>
                      </div>

                      {evidenceFiles.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {evidenceFiles.map((file, index) => (
                            <div key={index} className="relative group">
                              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                                <FileText className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-700 truncate flex-1">
                                  {file.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeEvidenceFile(index)}
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Display existing evidence files if editing */}
                      {executionResult.evidence_files && Array.isArray(executionResult.evidence_files) && executionResult.evidence_files.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Evidencia Existente ({executionResult.evidence_files?.length || 0}):</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {executionResult.evidence_files.map((url, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={url}
                                  alt={`Evidencia ${index + 1}`}
                                  className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(url, '_blank')}
                                  onError={(e) => {
                                    console.error('Error loading image:', url)
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all duration-200 flex items-center justify-center">
                                  <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Debug information - remove in production */}
                      {process.env.NODE_ENV === 'development' && (
                        <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded">
                          Debug: Evidence files count: {executionResult.evidence_files?.length || 0}
                          {(executionResult.evidence_files?.length || 0) > 0 && (
                            <pre className="mt-1 text-xs">
                              {JSON.stringify(executionResult.evidence_files?.slice(0, 2), null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 pt-4 border-t">
                {!isProtocolClosed && (
                  <Button 
                    onClick={saveExecution} 
                    className="flex-1"
                    disabled={isUploadingEvidence}
                  >
                    {isUploadingEvidence ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                        Subiendo Evidencia...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Resultado
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsExecutionDialogOpen(false)
                    setEvidenceFiles([])
                  }}
                  disabled={isUploadingEvidence}
                  className={isProtocolClosed ? "flex-1" : ""}
                >
                  {isProtocolClosed ? 'Cerrar' : 'Cancelar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Cases Visualization Dialog */}
      <TestCasesVisualizationDialog />
    </div>
  )
}