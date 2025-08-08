import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hcaavosfjbveoggruxig.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWF2b3NmamJ2ZW9nZ3J1eGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NTczNDMsImV4cCI6MjA3MDEzMzM0M30.85qxIZuQwc7OOGGMpcvY6IyuTGZTp2TXn4wSEC2Pfvk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface ProcessMap {
  id: string
  title: string
  description: string
  diagram_data: any
  created_at: string
  user_id: string
}

export interface UserRequirement {
  id: string
  requirement_text: string
  category: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  created_at: string
  user_id: string
}

export interface RiskAnalysis {
  id: string
  requirement_id: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  probability: 'HIGH' | 'MEDIUM' | 'LOW'
  detectability: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  mitigation_strategy: string
  created_at: string
  user_id: string
}

export interface ValidationProtocol {
  id: string
  protocol_type: 'IQ' | 'OQ' | 'PQ'
  title: string
  content: any
  status: 'DRAFT' | 'APPROVED' | 'EXECUTED'
  created_at: string
  user_id: string
}

export interface TraceabilityMatrix {
  id: string
  requirement_id: string
  test_case_id: string
  protocol_id: string
  status: 'PASSED' | 'FAILED' | 'PENDING'
  created_at: string
  user_id: string
}

export interface ValidationReport {
  id: string
  title: string
  content: any
  status: 'DRAFT' | 'FINAL'
  created_at: string
  user_id: string
}