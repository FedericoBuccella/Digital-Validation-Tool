import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Users,
  UserCheck,
  UserX,
  Search
} from 'lucide-react'

interface SystemUser {
  id?: string
  email: string
  full_name: string
  role: 'CREATOR' | 'REVIEWER' | 'APPROVER' | 'ADMIN'
  department: string
  phone: string
  is_active: boolean
  created_at?: string
  updated_at?: string
  password?: string // Solo para creación de nuevos usuarios
}

const roleColors = {
  CREATOR: 'bg-blue-100 text-blue-800',
  REVIEWER: 'bg-yellow-100 text-yellow-800',
  APPROVER: 'bg-green-100 text-green-800',
  ADMIN: 'bg-purple-100 text-purple-800'
}

const roleLabels = {
  CREATOR: 'Creador',
  REVIEWER: 'Revisor',
  APPROVER: 'Aprobador',
  ADMIN: 'Administrador'
}

export default function UserManagement() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [newUser, setNewUser] = useState<SystemUser>({
    email: '',
    full_name: '',
    role: 'CREATOR',
    department: '',
    phone: '',
    is_active: true,
    password: ''
  })

  useEffect(() => {
    fetchUsers()
  }, [user])

  const fetchUsers = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveUser = async () => {
    if (!user || !newUser.email || !newUser.full_name) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos obligatorios",
        variant: "destructive"
      })
      return
    }

    if (!editingUser && (!newUser.password || newUser.password.length < 6)) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive"
      })
      return
    }

    try {
      if (editingUser) {
        // Actualizar usuario existente - solo en system_users
        const { error } = await supabase
          .from('system_users')
          .update({
            email: newUser.email,
            full_name: newUser.full_name,
            role: newUser.role,
            department: newUser.department,
            phone: newUser.phone,
            is_active: newUser.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id)

        if (error) throw error
      } else {
        // Crear nuevo usuario - usar signUp y confirmar automáticamente
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password!,
          options: {
            data: {
              full_name: newUser.full_name
            }
          }
        })

        if (authError) throw authError

        if (!authData.user) {
          throw new Error('No se pudo crear la cuenta de autenticación')
        }

        // Nota: El usuario deberá confirmar su email manualmente
        if (!authData.user.email_confirmed_at) {
          console.info('Usuario creado exitosamente. Deberá confirmar su email para acceder.')
        }

        // Luego crear en system_users con el ID de Supabase Auth
        const { error: dbError } = await supabase
          .from('system_users')
          .insert({
            id: authData.user.id, // Usar el mismo ID de Supabase Auth
            email: newUser.email,
            full_name: newUser.full_name,
            role: newUser.role,
            department: newUser.department,
            phone: newUser.phone,
            is_active: newUser.is_active,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (dbError) throw dbError
      }

      toast({
        title: "Éxito",
        description: `Usuario ${editingUser ? 'actualizado' : 'creado'} correctamente`
      })

      setIsDialogOpen(false)
      setEditingUser(null)
      resetForm()
      fetchUsers()
    } catch (error) {
      console.error('Error saving user:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el usuario",
        variant: "destructive"
      })
    }
  }

  const editUser = (user: SystemUser) => {
    setEditingUser(user)
    setNewUser({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
      phone: user.phone,
      is_active: user.is_active
    })
    setIsDialogOpen(true)
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('system_users')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      toast({
        title: "Éxito",
        description: `Usuario ${!currentStatus ? 'activado' : 'desactivado'} correctamente`
      })

      fetchUsers()
    } catch (error) {
      console.error('Error updating user status:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del usuario",
        variant: "destructive"
      })
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este usuario?')) return

    try {
      const { error } = await supabase
        .from('system_users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Usuario eliminado correctamente"
      })

      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setEditingUser(null)
    setNewUser({
      email: '',
      full_name: '',
      role: 'CREATOR',
      department: '',
      phone: '',
      is_active: true,
      password: ''
    })
  }

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeUsers = users.filter(u => u.is_active).length
  const inactiveUsers = users.filter(u => !u.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Nuevo Usuario</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar' : 'Crear'} Usuario
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Modifica la información del usuario'
                  : 'Agrega un nuevo usuario al sistema'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div>
                <Label htmlFor="full_name">Nombre Completo *</Label>
                <Input
                  id="full_name"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <Label htmlFor="role">Rol *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: SystemUser['role']) => setNewUser(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREATOR">Creador</SelectItem>
                    <SelectItem value="REVIEWER">Revisor</SelectItem>
                    <SelectItem value="APPROVER">Aprobador</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  value={newUser.department}
                  onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Calidad"
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newUser.phone}
                  onChange={(e) => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1234567890"
                />
              </div>
              {!editingUser && (
                <div>
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={newUser.is_active}
                  onChange={(e) => setNewUser(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is_active">Usuario Activo</Label>
              </div>
            </div>
            <div className="flex space-x-2 pt-4 border-t">
              <Button onClick={saveUser} className="flex-1">
                {editingUser ? 'Actualizar' : 'Crear'} Usuario
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
                <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold text-green-600">{activeUsers}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuarios Inactivos</p>
                <p className="text-2xl font-bold text-red-600">{inactiveUsers}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            Gestiona los usuarios del sistema de validación
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
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
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No se encontraron usuarios. Crea el primero.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={roleColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">{user.full_name}</h3>
                      <p className="text-sm text-gray-600 mb-1">{user.email}</p>
                      <div className="text-sm text-gray-500">
                        <p><span className="font-medium">Departamento:</span> {user.department || 'N/A'}</p>
                        <p><span className="font-medium">Teléfono:</span> {user.phone || 'N/A'}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Creado el {new Date(user.created_at!).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserStatus(user.id!, user.is_active)}
                        className={user.is_active ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                      >
                        {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editUser(user)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteUser(user.id!)}
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
    </div>
  )
}