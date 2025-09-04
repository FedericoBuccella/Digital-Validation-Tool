import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Recuperar sesión de sessionStorage al recargar página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      // Limpiar cualquier sesión anterior
      await supabase.auth.signOut()
      
      // Validar que email y password no estén vacíos
      if (!email || !password) {
        return { error: { message: 'Email y contraseña son requeridos' } }
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return { error: { message: 'Formato de email inválido' } }
      }

      console.log('Intentando autenticar con:', email)
      
      // Autenticar con Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password: password 
      })
      
      if (error) {
        console.error('Error de autenticación:', error)
        
        // Manejar diferentes tipos de errores
        if (error.message.includes('Invalid login credentials')) {
          return { error: { message: 'Credenciales incorrectas. Verifique su email y contraseña.' } }
        } else if (error.message.includes('Email not confirmed')) {
          return { error: { message: 'Email no confirmado. Revise su bandeja de entrada.' } }
        } else if (error.message.includes('Too many requests')) {
          return { error: { message: 'Demasiados intentos. Espere unos minutos antes de intentar nuevamente.' } }
        } else {
          return { error: { message: `Error de autenticación: ${error.message}` } }
        }
      }
      
      if (data.user) {
        console.log('Usuario autenticado:', data.user.id)
        console.log('Email del usuario:', data.user.email)
        
        // Primero, intentar consultar sin .single() para ver si existen registros
        console.log('Consultando system_users para ID:', data.user.id)
        
        const { data: systemUsers, error: queryError } = await supabase
          .from('system_users')
          .select('id, is_active, full_name, role, email')
          .eq('id', data.user.id)
        
        console.log('Resultado de consulta system_users:', systemUsers)
        console.log('Error de consulta:', queryError)
        
        if (queryError) {
          console.error('Error consultando system_users:', queryError)
          await supabase.auth.signOut()
          return { error: { message: `Error de base de datos: ${queryError.message}` } }
        }
        
        // Si no hay registros, intentar buscar por email como alternativa
        if (!systemUsers || systemUsers.length === 0) {
          console.log('No se encontró por ID, intentando buscar por email:', data.user.email)
          
          const { data: systemUsersByEmail, error: emailQueryError } = await supabase
            .from('system_users')
            .select('id, is_active, full_name, role, email')
            .eq('email', data.user.email)
          
          console.log('Resultado de consulta por email:', systemUsersByEmail)
          
          if (emailQueryError) {
            console.error('Error consultando por email:', emailQueryError)
            await supabase.auth.signOut()
            return { error: { message: `Error de base de datos: ${emailQueryError.message}` } }
          }
          
          if (!systemUsersByEmail || systemUsersByEmail.length === 0) {
            await supabase.auth.signOut()
            return { error: { message: 'Usuario no encontrado en system_users. Verifique que el usuario esté registrado correctamente en el sistema.' } }
          }
          
          // Usar el primer resultado encontrado por email
          const systemUser = systemUsersByEmail[0]
          
          if (!systemUser.is_active) {
            await supabase.auth.signOut()
            return { error: { message: 'Usuario inactivo. Contacte al administrador.' } }
          }
          
          console.log('Usuario encontrado por email y verificado:', systemUser)
          
        } else {
          // Usuario encontrado por ID
          const systemUser = systemUsers[0]
          
          if (!systemUser.is_active) {
            await supabase.auth.signOut()
            return { error: { message: 'Usuario inactivo. Contacte al administrador.' } }
          }
          
          console.log('Usuario encontrado por ID y verificado:', systemUser)
        }
      }
      
      return { data, error: null }
      
    } catch (err) {
      console.error('Error inesperado durante el login:', err)
      return { error: { message: 'Error inesperado. Intente nuevamente.' } }
    }
  }

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('Error during sign out:', error)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}