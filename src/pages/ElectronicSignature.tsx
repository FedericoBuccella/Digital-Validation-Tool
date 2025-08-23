import React, { useState, useEffect } from 'react'
import { supabase, SignatureRequest, ElectronicSignature as ElectronicSignatureType, ValidationReport, SystemUser } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/use-toast'
import jsPDF from 'jspdf'
import {
  PenTool,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  FileSignature,
  Send,
  Users,
  History,
  Lock,
  Loader2,
  FileText
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SIGNED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800'
}

const statusIcons = {
  PENDING: Clock,
  SIGNED: CheckCircle,
  REJECTED: XCircle,
  EXPIRED: AlertTriangle
}

const roleLabels = {
  CREATOR: 'Creador',
  REVIEWER: 'Revisor',
  APPROVER: 'Aprobador'
}

interface ExtendedSignatureRequest extends SignatureRequest {
  validation_reports?: ValidationReport
}

interface ExtendedElectronicSignature extends ElectronicSignatureType {
  validation_reports?: ValidationReport
}

export default function ElectronicSignature() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [signatureRequests, setSignatureRequests] = useState<ExtendedSignatureRequest[]>([])
  const [signatures, setSignatures] = useState<ExtendedElectronicSignature[]>([])
  const [reports, setReports] = useState<ValidationReport[]>([])
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ExtendedSignatureRequest | null>(null)
  const [signatureComments, setSignatureComments] = useState('')
  const [signerName, setSignerName] = useState('')
  
  // Password authentication states
  const [signerPassword, setSignerPassword] = useState('')
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  
  // New signature request form
  const [newRequest, setNewRequest] = useState({
    report_id: '',
    signer_email: '',
    signer_role: 'CREATOR' as 'CREATOR' | 'REVIEWER' | 'APPROVER'
  })

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch validation reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('validation_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (reportsError) throw reportsError

      // Fetch signature requests with report details - show all requests but highlight current user's
      const { data: requestsData, error: requestsError } = await supabase
        .from('signature_requests')
        .select(`
          *,
          validation_reports (
            title,
            content,
            status
          )
        `)
        .order('created_at', { ascending: false })

      if (requestsError) throw requestsError

      // Fetch electronic signatures with report details - show all signatures
      const { data: signaturesData, error: signaturesError } = await supabase
        .from('electronic_signatures')
        .select(`
          *,
          validation_reports (
            title,
            content,
            status
          )
        `)
        .order('signed_at', { ascending: false })

      if (signaturesError) throw signaturesError

      // Fetch system users
      const { data: usersData, error: usersError } = await supabase
        .from('system_users')
        .select('*')
        .eq('is_active', true)
        .order('full_name')

      if (usersError) throw usersError

      setReports(reportsData || [])
      setSignatureRequests(requestsData || [])
      setSignatures(signaturesData || [])
      setUsers(usersData || [])
    } catch (error) {
      console.error('Error fetching signature data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de firmas",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const verifyUserPassword = async (password: string): Promise<boolean> => {
    if (!user?.email) return false

    try {
      // Create a temporary sign-in to verify password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      })

      return !error
    } catch (error) {
      console.error('Password verification failed:', error)
      return false
    }
  }

  const sendSignatureRequest = async () => {
    if (!user || !newRequest.report_id || !newRequest.signer_email) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos obligatorios",
        variant: "destructive"
      })
      return
    }

    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

      const { error } = await supabase
        .from('signature_requests')
        .insert({
          report_id: newRequest.report_id,
          requester_id: user.id,
          signer_email: newRequest.signer_email,
          signer_role: newRequest.signer_role,
          token: token,
          expires_at: expiresAt.toISOString(),
          status: 'PENDING'
        })

      if (error) throw error

      toast({
        title: "Éxito",
        description: `Solicitud de firma enviada a ${newRequest.signer_email}`
      })

      setIsRequestDialogOpen(false)
      setNewRequest({
        report_id: '',
        signer_email: '',
        signer_role: 'CREATOR'
      })
      fetchData()
    } catch (error) {
      console.error('Error sending signature request:', error)
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud de firma",
        variant: "destructive"
      })
    }
  }

  const signDocument = async () => {
    if (!selectedRequest || !signerName.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese su nombre para firmar",
        variant: "destructive"
      })
      return
    }

    if (!signerPassword.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese su contraseña para confirmar la firma",
        variant: "destructive"
      })
      return
    }

    setIsVerifyingPassword(true)
    setPasswordError('')

    try {
      // Verify password before proceeding with signature
      const isPasswordValid = await verifyUserPassword(signerPassword)

      if (!isPasswordValid) {
        setPasswordError('Contraseña incorrecta')
        toast({
          title: "Error de Autenticación",
          description: "Contraseña incorrecta. Verifique sus credenciales.",
          variant: "destructive"
        })
        return
      }

      // Create document hash (simplified for demo)
      const documentContent = JSON.stringify(selectedRequest.validation_reports)
      const documentHash = btoa(documentContent).substring(0, 32)
      
      // Create signature hash
      const signatureContent = `${selectedRequest.id}-${signerName}-${new Date().toISOString()}`
      const signatureHash = btoa(signatureContent).substring(0, 32)

      // Get user's IP address (simplified approach)
      let ipAddress = null
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipResponse.json()
        ipAddress = ipData.ip
      } catch (ipError) {
        console.warn('Could not fetch IP address:', ipError)
      }

      // Insert electronic signature
      const { data: signatureData, error: signatureError } = await supabase
        .from('electronic_signatures')
        .insert({
          signature_request_id: selectedRequest.id,
          report_id: selectedRequest.report_id,
          signer_email: selectedRequest.signer_email,
          signer_name: signerName,
          role: selectedRequest.signer_role,
          signature_hash: signatureHash,
          document_hash: documentHash,
          comments: signatureComments || null,
          ip_address: ipAddress,
          user_agent: navigator.userAgent
        })
        .select()

      if (signatureError) throw signatureError

      // Update signature request status
      const { error: updateError } = await supabase
        .from('signature_requests')
        .update({
          status: 'SIGNED',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRequest.id)

      if (updateError) throw updateError

      // Create audit trail for electronic signature
      if (user && signatureData && signatureData[0]) {
        await supabase.from('audit_trail').insert({
          user_id: user.id,
          action: 'CREATE',
          entity: 'electronic_signatures',
          entity_id: signatureData[0].id,
          details: {
            new_data: {
              report_title: selectedRequest.validation_reports?.title || 'Reporte sin título',
              signer_name: signerName,
              signer_email: selectedRequest.signer_email,
              role: selectedRequest.signer_role,
              signature_hash: signatureHash,
              document_hash: documentHash,
              comments: signatureComments || null,
              ip_address: ipAddress,
              authentication_method: 'Password Verified'
            },
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
        description: "Documento firmado electrónicamente con autenticación verificada"
      })

      setIsSignDialogOpen(false)
      setSelectedRequest(null)
      setSignatureComments('')
      setSignerName('')
      setSignerPassword('') // Clear password for security
      setPasswordError('')
      fetchData()
    } catch (error) {
      console.error('Error signing document:', error)
      toast({
        title: "Error",
        description: "No se pudo firmar el documento",
        variant: "destructive"
      })
    } finally {
      setIsVerifyingPassword(false)
    }
  }

  const rejectSignature = async (requestId: string) => {
    if (!confirm('¿Está seguro de rechazar esta firma?')) return

    try {
      // First, get the request details for audit trail
      const { data: requestData, error: fetchError } = await supabase
        .from('signature_requests')
        .select(`
          *,
          validation_reports (
            title,
            content,
            status
          )
        `)
        .eq('id', requestId)
        .single()

      if (fetchError) throw fetchError

      const { error } = await supabase
        .from('signature_requests')
        .update({
          status: 'REJECTED',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      // Create audit trail for signature rejection
      if (user && requestData) {
        await supabase.from('audit_trail').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity: 'signature_requests',
          entity_id: requestId,
          details: {
            changes: {
              status: { old: 'PENDING', new: 'REJECTED' }
            },
            report_title: requestData.validation_reports?.title || 'Reporte sin título',
            signer_email: requestData.signer_email,
            signer_role: requestData.signer_role,
            action_performed: 'Signature Rejected',
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
        description: "Solicitud de firma rechazada"
      })

      fetchData()
    } catch (error) {
      console.error('Error rejecting signature:', error)
      toast({
        title: "Error",
        description: "No se pudo rechazar la solicitud",
        variant: "destructive"
      })
    }
  }

  const downloadSignatureReport = (signature: ExtendedElectronicSignature) => {
    const reportData = {
      signature_id: signature.id,
      report_title: signature.validation_reports?.title,
      signer: {
        name: signature.signer_name,
        email: signature.signer_email,
        role: signature.role
      },
      signed_at: signature.signed_at,
      signature_hash: signature.signature_hash,
      document_hash: signature.document_hash,
      comments: signature.comments,
      ip_address: signature.ip_address,
      user_agent: signature.user_agent,
      verification: {
        timestamp: new Date().toISOString(),
        status: 'VERIFIED',
        authentication_method: 'Password Verified'
      }
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `signature-report-${signature.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadPDFSignatureReport = (signature: ExtendedElectronicSignature) => {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 20
    let yPos = margin

    // Title
    pdf.setFontSize(20)
    pdf.setFont(undefined, 'bold')
    pdf.text('Reporte de Firma Electrónica', pageWidth / 2, yPos, { align: 'center' })
    yPos += 20

    // Report information
    pdf.setFontSize(14)
    pdf.setFont(undefined, 'bold')
    pdf.text('Información del Documento:', margin, yPos)
    yPos += 10

    pdf.setFontSize(10)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Título del Reporte: ${signature.validation_reports?.title || 'Sin título'}`, margin, yPos)
    yPos += 8
    pdf.text(`ID de Firma: ${signature.id}`, margin, yPos)
    yPos += 8
    pdf.text(`Hash del Documento: ${signature.document_hash}`, margin, yPos)
    yPos += 15

    // Signer information
    pdf.setFontSize(14)
    pdf.setFont(undefined, 'bold')
    pdf.text('Información del Firmante:', margin, yPos)
    yPos += 10

    pdf.setFontSize(10)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Nombre: ${signature.signer_name}`, margin, yPos)
    yPos += 8
    pdf.text(`Email: ${signature.signer_email}`, margin, yPos)
    yPos += 8
    pdf.text(`Rol: ${roleLabels[signature.role as keyof typeof roleLabels] || signature.role}`, margin, yPos)
    yPos += 8
    pdf.text(`Fecha de Firma: ${new Date(signature.signed_at).toLocaleString('es-ES')}`, margin, yPos)
    yPos += 15

    // Signature details
    pdf.setFontSize(14)
    pdf.setFont(undefined, 'bold')
    pdf.text('Detalles de la Firma:', margin, yPos)
    yPos += 10

    pdf.setFontSize(10)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Hash de Firma: ${signature.signature_hash}`, margin, yPos)
    yPos += 8
    if (signature.ip_address) {
      pdf.text(`Dirección IP: ${signature.ip_address}`, margin, yPos)
      yPos += 8
    }
    if (signature.comments) {
      pdf.text('Comentarios:', margin, yPos)
      yPos += 6
      const splitComments = pdf.splitTextToSize(signature.comments, pageWidth - 2 * margin)
      pdf.text(splitComments, margin, yPos)
      yPos += splitComments.length * 6 + 8
    }

    // Verification details
    pdf.setFontSize(14)
    pdf.setFont(undefined, 'bold')
    pdf.text('Verificación:', margin, yPos)
    yPos += 10

    pdf.setFontSize(10)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Estado: VERIFICADO`, margin, yPos)
    yPos += 8
    pdf.text(`Método de Autenticación: Contraseña Verificada`, margin, yPos)
    yPos += 8
    pdf.text(`Timestamp de Verificación: ${new Date().toLocaleString('es-ES')}`, margin, yPos)
    yPos += 15

    // Footer
    pdf.setFontSize(8)
    pdf.setTextColor(100)
    pdf.text('Este documento es una evidencia digital de la firma electrónica autenticada.', pageWidth / 2, pdf.internal.pageSize.getHeight() - 20, { align: 'center' })

    // Save PDF
    pdf.save(`firma-electronica-${signature.id}.pdf`)
  }

  const getSignaturesByReportId = (reportId: string) => {
    return signatures.filter(sig => sig.report_id === reportId)
  }

  const getRequestsByReportId = (reportId: string) => {
    return signatureRequests.filter(req => req.report_id === reportId)
  }

  const isReportFullySigned = (reportId: string) => {
    const reportRequests = getRequestsByReportId(reportId)
    const reportSignatures = getSignaturesByReportId(reportId)
    
    // Check if all requests for this report have been signed
    return reportRequests.length > 0 && 
           reportRequests.every(req => req.status === 'SIGNED') &&
           reportSignatures.length === reportRequests.length
  }

  const downloadCompletedReportPDF = (reportId: string) => {
    const report = reports.find(r => r.id === reportId)
    const reportSignatures = getSignaturesByReportId(reportId)
    const reportRequests = getRequestsByReportId(reportId)

    if (!report || reportSignatures.length === 0) {
      toast({
        title: "Error",
        description: "No se encontraron firmas para este reporte",
        variant: "destructive"
      })
      return
    }

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 20
    let yPos = margin

    // Title
    pdf.setFontSize(20)
    pdf.setFont(undefined, 'bold')
    pdf.text('Reporte Completo de Firmas Electrónicas', pageWidth / 2, yPos, { align: 'center' })
    yPos += 20

    // Report information
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text('Información del Reporte:', margin, yPos)
    yPos += 12

    pdf.setFontSize(12)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Título: ${report.title}`, margin, yPos)
    yPos += 10
    pdf.text(`ID del Reporte: ${report.id}`, margin, yPos)
    yPos += 10
    pdf.text(`Estado: ${report.status}`, margin, yPos)
    yPos += 10
    pdf.text(`Fecha de Creación: ${new Date(report.created_at).toLocaleString('es-ES')}`, margin, yPos)
    yPos += 15

    // Summary
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text('Resumen de Firmas:', margin, yPos)
    yPos += 12

    pdf.setFontSize(12)
    pdf.setFont(undefined, 'normal')
    pdf.text(`Total de Firmas Requeridas: ${reportRequests.length}`, margin, yPos)
    yPos += 8
    pdf.text(`Total de Firmas Completadas: ${reportSignatures.length}`, margin, yPos)
    yPos += 8
    pdf.text(`Estado del Proceso: ${isReportFullySigned(reportId) ? 'COMPLETADO' : 'PENDIENTE'}`, margin, yPos)
    yPos += 20

    // Individual signatures
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text('Detalle de Firmas:', margin, yPos)
    yPos += 15

    reportSignatures.forEach((signature, index) => {
      // Check if we need a new page
      if (yPos > pdf.internal.pageSize.getHeight() - 60) {
        pdf.addPage()
        yPos = margin
      }

      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text(`Firma ${index + 1}:`, margin, yPos)
      yPos += 10

      pdf.setFontSize(10)
      pdf.setFont(undefined, 'normal')
      pdf.text(`Firmante: ${signature.signer_name} (${signature.signer_email})`, margin + 5, yPos)
      yPos += 7
      pdf.text(`Rol: ${roleLabels[signature.role as keyof typeof roleLabels] || signature.role}`, margin + 5, yPos)
      yPos += 7
      pdf.text(`Fecha: ${new Date(signature.signed_at).toLocaleString('es-ES')}`, margin + 5, yPos)
      yPos += 7
      pdf.text(`Hash de Firma: ${signature.signature_hash}`, margin + 5, yPos)
      yPos += 7
      if (signature.ip_address) {
        pdf.text(`IP: ${signature.ip_address}`, margin + 5, yPos)
        yPos += 7
      }
      if (signature.comments) {
        pdf.text(`Comentarios: ${signature.comments}`, margin + 5, yPos)
        yPos += 7
      }
      yPos += 10
    })

    // Footer
    pdf.setFontSize(8)
    pdf.setTextColor(100)
    const footerY = pdf.internal.pageSize.getHeight() - 20
    pdf.text('Este documento contiene todas las firmas electrónicas autenticadas para el reporte especificado.', pageWidth / 2, footerY, { align: 'center' })
    pdf.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, footerY + 8, { align: 'center' })

    // Save PDF
    pdf.save(`reporte-completo-firmas-${report.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`)
  }

  const handleSignDialogClose = () => {
    setIsSignDialogOpen(false)
    setSignerPassword('') // Clear password when closing dialog
    setPasswordError('')
    setIsVerifyingPassword(false)
  }

  // Filter pending requests for current user only (for actions)
  const pendingRequests = signatureRequests.filter(r => r.status === 'PENDING' && r.signer_email === user?.email)
  const totalSignatures = signatures.length
  
  // All pending requests (for display purposes)
  const allPendingRequests = signatureRequests.filter(r => r.status === 'PENDING')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Firmas Electrónicas</h1>
        <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Send className="h-4 w-4" />
              <span>Solicitar Firma</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Solicitar Firma Electrónica</DialogTitle>
              <DialogDescription>
                Envía una solicitud de firma para un reporte de validación
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="report">Reporte de Validación *</Label>
                <Select value={newRequest.report_id} onValueChange={(value) => setNewRequest(prev => ({ ...prev, report_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar reporte" />
                  </SelectTrigger>
                  <SelectContent>
                    {reports.map((report) => (
                      <SelectItem key={report.id} value={report.id}>
                        {report.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="signer_email">Email del Firmante *</Label>
                <Select value={newRequest.signer_email} onValueChange={(value) => setNewRequest(prev => ({ ...prev, signer_email: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.email}>
                        {user.full_name} ({user.email}) - {roleLabels[user.role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="signer_role">Rol del Firmante *</Label>
                <Select value={newRequest.signer_role} onValueChange={(value) => setNewRequest(prev => ({ ...prev, signer_role: value as 'CREATOR' | 'REVIEWER' | 'APPROVER' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREATOR">Creador</SelectItem>
                    <SelectItem value="REVIEWER">Revisor</SelectItem>
                    <SelectItem value="APPROVER">Aprobador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex space-x-2 pt-4 border-t">
              <Button onClick={sendSignatureRequest} className="flex-1">
                Enviar Solicitud
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsRequestDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mis Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Firmadas</p>
                <p className="text-2xl font-bold text-green-600">{totalSignatures}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rechazadas</p>
                <p className="text-2xl font-bold text-red-600">
                  {signatureRequests.filter(r => r.status === 'REJECTED').length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Solicitudes</p>
                <p className="text-2xl font-bold">{signatureRequests.length}</p>
              </div>
              <FileSignature className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mis Solicitudes Pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Mis Solicitudes Pendientes</span>
          </CardTitle>
          <CardDescription>
            Documentos asignados a ti que esperan firma electrónica con autenticación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No tienes solicitudes de firma pendientes
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => {
                const StatusIcon = statusIcons[request.status]
                return (
                  <div key={request.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={statusColors[request.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {request.status === 'PENDING' ? 'Pendiente' : request.status}
                          </Badge>
                          <Badge variant="secondary">
                            {roleLabels[request.signer_role]}
                          </Badge>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">
                          {request.validation_reports?.title || 'Reporte sin título'}
                        </h3>
                        <div className="text-sm text-gray-600 mb-2">
                          <p><span className="font-medium">Firmante:</span> {request.signer_email}</p>
                          <p><span className="font-medium">Rol:</span> {roleLabels[request.signer_role]}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          Solicitado el {new Date(request.created_at).toLocaleString('es-ES')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Expira el {new Date(request.expires_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request)
                            setIsSignDialogOpen(true)
                          }}
                        >
                          <PenTool className="h-4 w-4 mr-1" />
                          Firmar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rejectSignature(request.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
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

      {/* Todas las Solicitudes Pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Todas las Solicitudes Pendientes</span>
          </CardTitle>
          <CardDescription>
            Vista completa de todas las solicitudes de firma pendientes en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allPendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No hay solicitudes de firma pendientes en el sistema
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allPendingRequests.map((request) => {
                const StatusIcon = statusIcons[request.status]
                const isMyRequest = request.signer_email === user?.email
                return (
                  <div key={request.id} className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
                    isMyRequest ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={statusColors[request.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {request.status === 'PENDING' ? 'Pendiente' : request.status}
                          </Badge>
                          <Badge variant="secondary">
                            {roleLabels[request.signer_role]}
                          </Badge>
                          {isMyRequest && (
                            <Badge className="bg-blue-100 text-blue-800">
                              Asignado a ti
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">
                          {request.validation_reports?.title || 'Reporte sin título'}
                        </h3>
                        <div className="text-sm text-gray-600 mb-2">
                          <p><span className="font-medium">Firmante:</span> {request.signer_email}</p>
                          <p><span className="font-medium">Rol:</span> {roleLabels[request.signer_role]}</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          Solicitado el {new Date(request.created_at).toLocaleString('es-ES')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Expira el {new Date(request.expires_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {isMyRequest ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request)
                                setIsSignDialogOpen(true)
                              }}
                            >
                              <PenTool className="h-4 w-4 mr-1" />
                              Firmar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => rejectSignature(request.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Asignado a otro usuario
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de Firmas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Historial de Firmas</span>
          </CardTitle>
          <CardDescription>
            Trazabilidad completa de firmas electrónicas autenticadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <div className="text-center py-8">
              <FileSignature className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No hay firmas electrónicas registradas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {signatures.map((signature) => (
                <div key={signature.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Firmado
                        </Badge>
                        <Badge variant="secondary">
                          {roleLabels[signature.role as keyof typeof roleLabels] || signature.role}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800">
                          <Lock className="h-3 w-3 mr-1" />
                          Autenticado
                        </Badge>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        {signature.validation_reports?.title || 'Reporte sin título'}
                      </h3>
                      <div className="text-sm text-gray-600 mb-2">
                        <p><span className="font-medium">Firmante:</span> {signature.signer_name} ({signature.signer_email})</p>
                        <p><span className="font-medium">Hash de Firma:</span> {signature.signature_hash}</p>
                        {signature.ip_address && (
                          <p><span className="font-medium">IP:</span> {signature.ip_address}</p>
                        )}
                        {signature.comments && (
                          <p><span className="font-medium">Comentarios:</span> {signature.comments}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Firmado el {new Date(signature.signed_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4"> 
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadPDFSignatureReport(signature)}
                        title="Descargar PDF individual de firma"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reportes Completamente Firmados */}
      {(() => {
        const completedReports = reports.filter(report => isReportFullySigned(report.id))
        return completedReports.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Reportes Completamente Firmados</span>
              </CardTitle>
              <CardDescription>
                Reportes que han sido firmados por todos los firmantes requeridos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completedReports.map((report) => {
                  const reportSignatures = getSignaturesByReportId(report.id)
                  return (
                    <div key={report.id} className="p-4 border border-green-200 bg-green-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completo
                            </Badge>
                            <Badge variant="secondary">
                              {reportSignatures.length} firma{reportSignatures.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <h3 className="font-medium text-gray-900 mb-1">
                            {report.title}
                          </h3>
                          <div className="text-sm text-gray-600 mb-2">
                            <p><span className="font-medium">Estado:</span> {report.status}</p>
                            <p><span className="font-medium">Firmantes:</span></p>
                            <ul className="ml-4 list-disc">
                              {reportSignatures.map((sig, idx) => (
                                <li key={idx}>
                                  {sig.signer_name} ({roleLabels[sig.role as keyof typeof roleLabels]}) - {new Date(sig.signed_at).toLocaleDateString('es-ES')}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs text-gray-500">
                            Reporte creado el {new Date(report.created_at).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => downloadCompletedReportPDF(report.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Descargar PDF Completo
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : null
      })()}

      {/* Dialog para Firmar con Autenticación */}
      <Dialog open={isSignDialogOpen} onOpenChange={handleSignDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Firmar Documento con Autenticación</span>
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.validation_reports?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Se requiere autenticación con contraseña para confirmar la firma electrónica.
              </AlertDescription>
            </Alert>
            
            <div>
              <Label htmlFor="signer_name">Nombre Completo *</Label>
              <Input
                id="signer_name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Su nombre completo"
                disabled={isVerifyingPassword}
              />
            </div>

            <div>
              <Label htmlFor="signer_password">Contraseña de su cuenta *</Label>
              <Input
                id="signer_password"
                type="password"
                value={signerPassword}
                onChange={(e) => {
                  setSignerPassword(e.target.value)
                  setPasswordError('') // Clear error when user types
                }}
                placeholder="Su contraseña"
                className={passwordError ? 'border-red-500' : ''}
                disabled={isVerifyingPassword}
              />
              {passwordError && (
                <p className="text-sm text-red-500 mt-1 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {passwordError}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="comments">Comentarios (Opcional)</Label>
              <Textarea
                id="comments"
                value={signatureComments}
                onChange={(e) => setSignatureComments(e.target.value)}
                placeholder="Comentarios adicionales sobre la firma"
                rows={3}
                disabled={isVerifyingPassword}
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Firmante:</span> {selectedRequest?.signer_email}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Rol:</span> {selectedRequest && roleLabels[selectedRequest.signer_role]}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Fecha:</span> {new Date().toLocaleString('es-ES')}
              </p>
            </div>
          </div>
          <div className="flex space-x-2 pt-4 border-t">
            <Button 
              onClick={signDocument} 
              className="flex-1" 
              disabled={isVerifyingPassword || !signerName.trim() || !signerPassword.trim()}
            >
              {isVerifyingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4 mr-2" />
                  Firmar Documento
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleSignDialogClose}
              disabled={isVerifyingPassword}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}