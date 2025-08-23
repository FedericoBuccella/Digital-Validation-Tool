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
    // Get initial session
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
    // Primero autenticar con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) return { error }
    
    if (data.user) {
      // Verificar que el usuario exista y esté activo en system_users
      const { data: systemUser, error: systemError } = await supabase
        .from('system_users')
        .select('is_active, full_name, role')
        .eq('id', data.user.id)
        .single()
      
      if (systemError || !systemUser) {
        // Si no existe en system_users, cerrar sesión y retornar error
        await supabase.auth.signOut()
        return { error: { message: 'Usuario no encontrado en el sistema' } }
      }
      
      if (!systemUser.is_active) {
        // Si el usuario está inactivo, cerrar sesión y retornar error
        await supabase.auth.signOut()
        return { error: { message: 'Usuario inactivo. Contacte al administrador.' } }
      }
    }
    
    return { data, error }
  }

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
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