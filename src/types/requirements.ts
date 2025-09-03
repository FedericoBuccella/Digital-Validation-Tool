export interface UserRequirement {
  id?: string
  email?: string
  requirement: string
  category: string
  prefix?: string
  number?: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  created_at?: string
  source?: 'manual' | 'ai_generated'
}

export interface ProcessMapAnalysis {
  processType: 'manufacturing' | 'quality' | 'regulatory' | 'general' | 'unknown'
  complexity: 'low' | 'medium' | 'high'
  elements: string[]
  suggestedCategories: string[]
}

export const CATEGORIES = [
  'Funcional',
  'No Funcional',
  'Seguridad',
  'Rendimiento',
  'Usabilidad',
  'Compatibilidad',
  'Mantenimiento',
  'Regulatory'
] as const

export const PRIORITY_COLORS = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-green-100 text-green-800'
} as const