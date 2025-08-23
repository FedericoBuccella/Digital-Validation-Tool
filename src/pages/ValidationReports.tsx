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
  Edit2,
  Trash2,
  FileText,
  CheckCircle,
  Clock,
  Send
} from 'lucide-react'

interface ValidationReport {
  id?: string
  title: string
  content: any
  status: 'DRAFT' | 'FINAL'
  created_at?: string
}

interface ReportSection {
  id: string
  title: string
  content: string
  order: number
}

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  FINAL: 'bg-green-100 text-green-800'
}

const statusIcons = {
  DRAFT: Clock,
  FINAL: CheckCircle
}

const defaultSections: ReportSection[] = [
  { id: '1', title: 'Resumen Ejecutivo', content: '', order: 1 },
  { id: '2', title: 'Introducción y Objetivos', content: '', order: 2 },
  { id: '3', title: 'Alcance de la Validación', content: '', order: 3 },
  { id: '4', title: 'Metodología de Validación', content: '', order: 4 },
  { id: '5', title: 'Resultados de las Pruebas', content: '', order: 5 },
  { id: '6', title: 'Análisis de Riesgos', content: '', order: 6 },
  { id: '7', title: 'Desviaciones y Acciones Correctivas', content: '', order: 7 },
  { id: '8', title: 'Conclusiones', content: '', order: 8 },
  { id: '9', title: 'Recomendaciones', content: '', order: 9 },
  { id: '10', title: 'Anexos', content: '', order: 10 }
]

export default function ValidationReports() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reports, setReports] = useState<ValidationReport[]>([])
  const [statistics, setStatistics] = useState<any>({})
  const [systemUsers, setSystemUsers] = useState<any[]>([])
  const [signatureRequests, setSignatureRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<ValidationReport | null>(null)
  const [newReport, setNewReport] = useState<ValidationReport>({
    title: '',
    content: {
      sections: defaultSections,
      metadata: {
        created_by: '',
        reviewed_by: '',
        approved_by: '',
        version: '1.0'
      }
    },
    status: 'DRAFT'
  })
  const [activeSection, setActiveSection] = useState<string>('1')

  useEffect(() => {
    fetchData()
    fetchSystemUsers()
  }, [user])

  const fetchSystemUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('id, full_name, email') // Ajusta según las columnas de tu tabla

      if (error) throw error
      setSystemUsers(data || [])
    } catch (error) {
      console.error("Error cargando usuarios del sistema:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios del sistema",
        variant: "destructive"
      })
    }
  }

  const fetchData = async () => {
    if (!user) return

    try {
      // Remove user_id filter so all users can see all reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('validation_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (reportsError) throw reportsError

      // Fetch signature requests to check which reports already have requests
      const { data: signatureRequestsData, error: signatureRequestsError } = await supabase
        .from('signature_requests')
        .select('report_id, status')

      if (signatureRequestsError) throw signatureRequestsError

      setReports(reportsData || [])
      setSignatureRequests(signatureRequestsData || [])

      // Remove user_id filters from statistics queries so they show global data
      const [requirementsResult, protocolsResult, traceabilityResult, riskAnalysesResult] = await Promise.all([
        supabase.from('user_requirements').select('*', { count: 'exact' }),
        supabase.from('validation_protocols').select('*', { count: 'exact' }),
        supabase.from('traceability_matrix').select('*'),
        supabase.from('risk_analysis').select('*')
      ])

      const traceabilityStats = {
        total: traceabilityResult.data?.length || 0,
        passed: traceabilityResult.data?.filter(t => t.status === 'PASSED').length || 0,
        failed: traceabilityResult.data?.filter(t => t.status === 'FAILED').length || 0,
        pending: traceabilityResult.data?.filter(t => t.status === 'PENDING').length || 0
      }

      const riskStats = {
        total: riskAnalysesResult.data?.length || 0,
        high: riskAnalysesResult.data?.filter(r => r.risk_level === 'HIGH').length || 0,
        medium: riskAnalysesResult.data?.filter(r => r.risk_level === 'MEDIUM').length || 0,
        low: riskAnalysesResult.data?.filter(r => r.risk_level === 'LOW').length || 0
      }

      setStatistics({
        requirements: requirementsResult.count || 0,
        protocols: protocolsResult.count || 0,
        traceability: traceabilityStats,
        risks: riskStats
      })
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los reportes de validación",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveReport = async () => {
    if (!user || !newReport.title) {
      toast({
        title: "Error",
        description: "Por favor ingrese un título para el reporte",
        variant: "destructive"
      })
      return
    }

    try {
      const updatedReport = {
        ...newReport,
        content: {
          ...newReport.content,
          metadata: {
            ...newReport.content.metadata,
            created_by: newReport.content.metadata.created_by || user.email
          }
        }
      }

      if (editingReport) {
        // Fetch old data for audit trail
        const { data: oldData, error: oldError } = await supabase
          .from('validation_reports')
          .select('*')
          .eq('id', editingReport.id)
          .single()

        if (oldError) throw oldError

        // Update existing
        const { error } = await supabase
          .from('validation_reports')
          .update({
            title: updatedReport.title,
            content: updatedReport.content,
            status: updatedReport.status
          })
          .eq('id', editingReport.id)

        if (error) throw error

        // Create changes object for audit
        function getChangedFields(oldObj: any, newObj: any) {
          const changed: any = {};
          
          // Check title changes
          if (oldObj.title !== newObj.title) {
            changed.title = { old: oldObj.title, new: newObj.title };
          }
          
          // Check status changes
          if (oldObj.status !== newObj.status) {
            changed.status = { old: oldObj.status, new: newObj.status };
          }
          
          // Check metadata changes
          const oldMetadata = oldObj.content?.metadata || {};
          const newMetadata = newObj.content?.metadata || {};
          
          if (oldMetadata.created_by !== newMetadata.created_by) {
            changed.created_by = { old: oldMetadata.created_by, new: newMetadata.created_by };
          }
          if (oldMetadata.reviewed_by !== newMetadata.reviewed_by) {
            changed.reviewed_by = { old: oldMetadata.reviewed_by, new: newMetadata.reviewed_by };
          }
          if (oldMetadata.approved_by !== newMetadata.approved_by) {
            changed.approved_by = { old: oldMetadata.approved_by, new: newMetadata.approved_by };
          }
          if (oldMetadata.version !== newMetadata.version) {
            changed.version = { old: oldMetadata.version, new: newMetadata.version };
          }
          
          // Check if sections content changed
          const oldSections = oldObj.content?.sections || [];
          const newSections = newObj.content?.sections || [];
          
          if (JSON.stringify(oldSections) !== JSON.stringify(newSections)) {
            changed.content_sections = { 
              old: `${oldSections.length} secciones`, 
              new: `${newSections.length} secciones` 
            };
          }
          
          return changed;
        }

        const changes = getChangedFields(oldData, updatedReport);

        // Only create audit trail if there are actual changes
        if (Object.keys(changes).length > 0) {
          await supabase.from('audit_trail').insert({
            user_id: user.id,
            action: 'UPDATE',
            entity: 'validation_reports',
            entity_id: editingReport.id,
            details: {
              changes,
              report_title: updatedReport.title,
              timestamp: new Date().toISOString(),
              performed_by: {
                id: user.id,
                email: user.email
              }
            }
          });
        }
      } else {
        // Create new
        const { data, error } = await supabase
          .from('validation_reports')
          .insert({
            title: updatedReport.title,
            content: updatedReport.content,
            status: updatedReport.status,
            user_id: user.id
          })
          .select()

        if (error) throw error

        if (data && data[0]) {
          await supabase.from('audit_trail').insert({
            user_id: user.id,
            action: 'CREATE',
            entity: 'validation_reports',
            entity_id: data[0].id,
            details: {
              new_data: {
                title: updatedReport.title,
                status: updatedReport.status,
                created_by: updatedReport.content.metadata.created_by,
                reviewed_by: updatedReport.content.metadata.reviewed_by,
                approved_by: updatedReport.content.metadata.approved_by,
                version: updatedReport.content.metadata.version,
                sections_count: updatedReport.content.sections.length
              },
              timestamp: new Date().toISOString(),
              performed_by: {
                id: user.id,
                email: user.email
              }
            }
          })
        }
      }

      toast({
        title: "Éxito",
        description: `Reporte ${editingReport ? 'actualizado' : 'creado'} correctamente`
      })

      setIsDialogOpen(false)
      setEditingReport(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving report:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar el reporte",
        variant: "destructive"
      })
    }
  }

  const editReport = (report: ValidationReport) => {
    setEditingReport(report)
    setNewReport({
      title: report.title,
      content: {
        sections: report.content?.sections ?? defaultSections,
        metadata: {
          created_by: report.content?.metadata?.created_by ?? '',
          reviewed_by: report.content?.metadata?.reviewed_by ?? '',
          approved_by: report.content?.metadata?.approved_by ?? '',
          version: report.content?.metadata?.version ?? '1.0'
        }
      },
      status: report.status
    })
    setIsDialogOpen(true)
  }

  const deleteReport = async (id: string) => {
    try {
      // First, fetch the data before deleting
      const { data: oldData, error: fetchError } = await supabase
        .from('validation_reports')
        .select('*')
        .eq('id', id)
        .single()
      
      if (fetchError) throw fetchError
      
      // Then delete the data
      const { error } = await supabase
        .from('validation_reports')
        .delete()
        .eq('id', id)

      if (error) throw error

      if (user) {
        // Create a filtered version of oldData with only the required fields
        const filteredData = {
          title: oldData.title,
          status: oldData.status,
          created_by: oldData.content?.metadata?.created_by,
          reviewed_by: oldData.content?.metadata?.reviewed_by,
          approved_by: oldData.content?.metadata?.approved_by,
          version: oldData.content?.metadata?.version,
          sections_count: oldData.content?.sections?.length || 0,
          created_at: oldData.created_at
        };
        
        await supabase.from('audit_trail').insert({
          user_id: user.id,
          action: 'DELETE',
          entity: 'validation_reports',
          entity_id: id,
          details: {
            deleted_data: filteredData,
            timestamp: new Date().toISOString(),
            performed_by: {
              id: user.id,
              email: user.email
            }
          }  
        })
      }

      toast({
        title: "Éxito",
        description: "Reporte eliminado correctamente"
      })

      fetchData()
    } catch (error) {
      console.error('Error deleting report:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el reporte",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setEditingReport(null)
    setNewReport({
      title: '',
      content: {
        sections: defaultSections,
        metadata: {
          created_by: '',
          reviewed_by: '',
          approved_by: '',
          version: '1.0'
        }
      },
      status: 'DRAFT'
    })
    setActiveSection('1')
  }

  const updateSection = (sectionId: string, content: string) => {
    setNewReport(prev => ({
      ...prev,
      content: {
        ...prev.content,
        sections: prev.content.sections.map((section: ReportSection) =>
          section.id === sectionId ? { ...section, content } : section
        )
      }
    }))
  }

  const updateMetadata = (field: string, value: string) => {
    setNewReport(prev => ({
      ...prev,
      content: {
        ...prev.content,
        metadata: {
          ...prev.content.metadata,
          [field]: value
        }
      }
    }))
  }

  // Check if a report already has signature requests
  const hasSignatureRequests = (reportId: string) => {
    return signatureRequests.some(req => req.report_id === reportId)
  }

  const requestSignatures = async (reportId: string, reportContent: any) => {
    if (!user) return

    // Check if signatures have already been requested for this report
    if (hasSignatureRequests(reportId)) {
      toast({
        title: "Información",
        description: "Las firmas ya han sido solicitadas para este reporte",
        variant: "default"
      })
      return
    }

    try {
      const metadata = reportContent?.metadata || {}
      const signatureRequestsToInsert = []

      // Crear solicitudes de firma para cada usuario asignado
      if (metadata.created_by) {
        const creatorUser = systemUsers.find(u => u.full_name === metadata.created_by)
        if (creatorUser) {
          signatureRequestsToInsert.push({
            report_id: reportId,
            requester_id: user.id,
            signer_email: creatorUser.email,
            signer_role: 'CREATOR',
            token: crypto.randomUUID(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
            status: 'PENDING'
          })
        }
      }

      if (metadata.reviewed_by) {
        const reviewerUser = systemUsers.find(u => u.full_name === metadata.reviewed_by)
        if (reviewerUser) {
          signatureRequestsToInsert.push({
            report_id: reportId,
            requester_id: user.id,
            signer_email: reviewerUser.email,
            signer_role: 'REVIEWER',
            token: crypto.randomUUID(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
            status: 'PENDING'
          })
        }
      }

      if (metadata.approved_by) {
        const approverUser = systemUsers.find(u => u.full_name === metadata.approved_by)
        if (approverUser) {
          signatureRequestsToInsert.push({
            report_id: reportId,
            requester_id: user.id,
            signer_email: approverUser.email,
            signer_role: 'APPROVER',
            token: crypto.randomUUID(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
            status: 'PENDING'
          })
        }
      }

      if (signatureRequestsToInsert.length === 0) {
        toast({
          title: "Información",
          description: "No hay usuarios asignados para solicitar firmas",
          variant: "default"
        })
        return
      }

      // Insertar todas las solicitudes de firma
      const { data: insertedRequests, error } = await supabase
        .from('signature_requests')
        .insert(signatureRequestsToInsert)
        .select()

      if (error) throw error

      // Create audit trail for signature requests
      if (user && insertedRequests) {
        const reportTitle = reports.find(r => r.id === reportId)?.title || 'Reporte sin título';
        
        await supabase.from('audit_trail').insert({
          user_id: user.id,
          action: 'CREATE',
          entity: 'signature_requests',
          entity_id: reportId, // Using report ID as the main entity
          details: {
            new_data: {
              report_title: reportTitle,
              signature_requests_created: signatureRequestsToInsert.length,
              signers: signatureRequestsToInsert.map(req => ({
                email: req.signer_email,
                role: req.signer_role
              })),
              expires_at: signatureRequestsToInsert[0].expires_at
            },
            action_performed: 'Signature Requests Sent',
            timestamp: new Date().toISOString(),
            performed_by: {
              id: user.id,
              email: user.email
            }
          }
        })
      }

      toast({
        title: "Éxito",
        description: `Se enviaron ${signatureRequestsToInsert.length} solicitudes de firma electrónica`
      })

      // Refresh data to update the button state
      fetchData()
    } catch (error) {
      console.error('Error requesting signatures:', error)
      toast({
        title: "Error",
        description: "No se pudieron enviar las solicitudes de firma",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reportes de Validación</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nuevo Reporte</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingReport ? 'Editar' : 'Crear'} Reporte de Validación
              </DialogTitle>
              <DialogDescription>
                {editingReport
                  ? 'Modifica el reporte de validación existente'
                  : 'Crea un nuevo reporte de validación completo'}
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="metadata" className="space-y-4">
              <TabsList>
                <TabsTrigger value="metadata">Metadatos</TabsTrigger>
                <TabsTrigger value="content">Contenido</TabsTrigger>
                <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="metadata" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Título del Reporte</Label>
                    <Input
                      id="title"
                      value={newReport.title}
                      onChange={(e) => setNewReport(prev => ({
                        ...prev,
                        title: e.target.value
                      }))}
                      placeholder="Ej: Reporte de Validación GxP - Sistema de Calidad v1.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Estado</Label>
                    <Select
                      value={newReport.status}
                      onValueChange={(value: 'DRAFT' | 'FINAL') => setNewReport(prev => ({
                        ...prev,
                        status: value
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Borrador</SelectItem>
                        <SelectItem value="FINAL">Final</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* 🔹 Creado por */}
              <div>
                <Label htmlFor="created_by">Creado por</Label>
                <Select
                  value={newReport.content.metadata.created_by}
                  onValueChange={(value) => updateMetadata('created_by', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.full_name}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 🔹 Revisado por */}
              <div>
                <Label htmlFor="reviewed_by">Revisado por</Label>
                <Select
                  value={newReport.content.metadata.reviewed_by}
                  onValueChange={(value) => updateMetadata('reviewed_by', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.full_name}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 🔹 Aprobado por */}
              <div>
                <Label htmlFor="approved_by">Aprobado por</Label>
                <Select
                  value={newReport.content.metadata.approved_by}
                  onValueChange={(value) => updateMetadata('approved_by', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.full_name}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                </div>

                <div>
                  <Label htmlFor="version">Versión</Label>
                  <Input
                    id="version"
                    value={newReport.content.metadata.version}
                    onChange={(e) => updateMetadata('version', e.target.value)}
                    placeholder="Ej: 1.0, 2.1"
                    className="w-32"
                  />
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                <div className="grid grid-cols-4 gap-6">
                  <div className="col-span-1">
                    <Label>Secciones del Reporte</Label>
                    <div className="space-y-1 mt-2">
                      {newReport.content.sections.map((section: ReportSection) => (
                        <Button
                          key={section.id}
                          variant={activeSection === section.id ? "default" : "ghost"}
                          className="w-full justify-start text-sm"
                          onClick={() => setActiveSection(section.id)}
                        >
                          {section.order}. {section.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-3">
                    {newReport.content.sections.map((section: ReportSection) => (
                      activeSection === section.id && (
                        <div key={section.id}>
                          <Label htmlFor={`section-${section.id}`}>
                            {section.order}. {section.title}
                          </Label>
                          <Textarea
                            id={`section-${section.id}`}
                            value={section.content}
                            onChange={(e) => updateSection(section.id, e.target.value)}
                            placeholder={`Escribe el contenido para: ${section.title}`}
                            rows={15}
                            className="mt-2"
                          />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="statistics" className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Resumen del Proyecto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Requerimientos:</span>
                          <Badge variant="secondary">{statistics.requirements || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Protocolos:</span>
                          <Badge variant="secondary">{statistics.protocols || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Trazabilidades:</span>
                          <Badge variant="secondary">{statistics.traceability?.total || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Análisis de Riesgo:</span>
                          <Badge variant="secondary">{statistics.risks?.total || 0}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Estado de las Pruebas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Casos Aprobados:</span>
                          <Badge className="bg-green-100 text-green-800">
                            {statistics.traceability?.passed || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Casos Fallidos:</span>
                          <Badge className="bg-red-100 text-red-800">
                            {statistics.traceability?.failed || 0}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Casos Pendientes:</span>
                          <Badge className="bg-yellow-100 text-yellow-800">
                            {statistics.traceability?.pending || 0}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Distribución de Riesgos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {statistics.risks?.high || 0}
                        </div>
                        <div className="text-sm text-gray-500">Riesgo Alto</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {statistics.risks?.medium || 0}
                        </div>
                        <div className="text-sm text-gray-500">Riesgo Medio</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {statistics.risks?.low || 0}
                        </div>
                        <div className="text-sm text-gray-500">Riesgo Bajo</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex space-x-2 pt-4 border-t">
              <Button onClick={saveReport} className="flex-1">
                {editingReport ? 'Actualizar' : 'Crear'} Reporte
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
                <p className="text-sm font-medium text-gray-600">Total Reportes</p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Reportes Finales</p>
                <p className="text-2xl font-bold text-green-600">
                  {reports.filter(r => r.status === 'FINAL').length}
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
                <p className="text-sm font-medium text-gray-600">Borradores</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {reports.filter(r => r.status === 'DRAFT').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Reportes</CardTitle>
          <CardDescription>
            Reportes de validación generados para el sistema GxP
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
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No hay reportes de validación creados. Crea el primero.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => {
                const StatusIcon = statusIcons[report.status]
                return (
                  <div key={report.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={statusColors[report.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {report.status === 'DRAFT' ? 'Borrador' : 'Final'}
                          </Badge>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-2">{report.title}</h3>
                        <div className="text-sm text-gray-600 mb-2">
                          <p><span className="font-medium">Creado por:</span> {report.content?.metadata?.created_by || 'N/A'}</p>
                          <p><span className="font-medium">Versión:</span> {report.content?.metadata?.version || 'N/A'}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          Creado el {new Date(report.created_at!).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {report.content?.metadata?.created_by || 
                         report.content?.metadata?.reviewed_by || 
                         report.content?.metadata?.approved_by ? (
                          hasSignatureRequests(report.id!) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="text-green-600 border-green-200 bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Firmas Solicitadas
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => requestSignatures(report.id!, report.content)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Solicitar Firmas
                            </Button>
                          )
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editReport(report)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReport(report.id!)}
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