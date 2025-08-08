import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Dashboard from '@/pages/Dashboard'
import ProcessMapping from '@/pages/ProcessMapping'
import UserRequirements from '@/pages/UserRequirements'
import RiskAnalysis from '@/pages/RiskAnalysis'
import ValidationProtocols from '@/pages/ValidationProtocols'
import TraceabilityMatrix from '@/pages/TraceabilityMatrix'
import ValidationReports from '@/pages/ValidationReports'
import { AuthProvider } from '@/contexts/AuthContext'
import './App.css'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
          <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
            <Header setSidebarOpen={setSidebarOpen} />
            <main className="p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/process-mapping" element={<ProcessMapping />} />
                <Route path="/user-requirements" element={<UserRequirements />} />
                <Route path="/risk-analysis" element={<RiskAnalysis />} />
                <Route path="/validation-protocols" element={<ValidationProtocols />} />
                <Route path="/traceability-matrix" element={<TraceabilityMatrix />} />
                <Route path="/validation-reports" element={<ValidationReports />} />
              </Routes>
            </main>
          </div>
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App