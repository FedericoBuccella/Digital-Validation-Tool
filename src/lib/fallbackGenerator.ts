import { UserRequirement, ProcessMapAnalysis } from '@/types/requirements'

export function generateVariableFallbacks(analysis: ProcessMapAnalysis): UserRequirement[] {
  const baseRequirements = getBaseRequirementsByType(analysis.processType)
  const complexityRequirements = getComplexityRequirements(analysis.complexity)
  const elementRequirements = getElementBasedRequirements(analysis.elements)
  
  // Combine and randomize requirements
  const allRequirements = [
    ...baseRequirements,
    ...complexityRequirements,
    ...elementRequirements
  ]
  
  // Select 4-8 requirements randomly and add sequence numbers
  const selectedCount = Math.floor(Math.random() * 5) + 4 // 4-8 requirements
  const selectedRequirements = shuffleArray(allRequirements)
    .slice(0, selectedCount)
    .map((req, index) => ({
      ...req,
      prefix: 'URS',
      number: String(10 + index).padStart(3, '0')
    }))
  
  return selectedRequirements
}

function getBaseRequirementsByType(processType: ProcessMapAnalysis['processType']): Omit<UserRequirement, 'prefix' | 'number'>[] {
  switch (processType) {
    case 'manufacturing':
      return [
        {
          requirement: "El sistema debe controlar y monitorear los parámetros críticos del proceso de manufactura en tiempo real",
          category: "Funcional",
          priority: "HIGH"
        },
        {
          requirement: "La aplicación debe validar que todos los materiales cumplan con las especificaciones antes de su uso",
          category: "Seguridad",
          priority: "HIGH"
        },
        {
          requirement: "El sistema debe generar alertas automáticas cuando los parámetros excedan los límites establecidos",
          category: "Funcional",
          priority: "MEDIUM"
        },
        {
          requirement: "La aplicación debe mantener un registro completo de la trazabilidad de lotes",
          category: "Regulatory",
          priority: "HIGH"
        }
      ]
    
    case 'quality':
      return [
        {
          requirement: "El sistema debe permitir la definición y ejecución de planes de inspección personalizados",
          category: "Funcional",
          priority: "MEDIUM"
        },
        {
          requirement: "La aplicación debe registrar automáticamente los resultados de todas las pruebas de calidad",
          category: "Funcional",
          priority: "HIGH"
        },
        {
          requirement: "El sistema debe generar reportes estadísticos de control de calidad",
          category: "Funcional",
          priority: "MEDIUM"
        },
        {
          requirement: "La aplicación debe permitir la calibración y verificación de equipos de medición",
          category: "Mantenimiento",
          priority: "MEDIUM"
        }
      ]
    
    case 'regulatory':
      return [
        {
          requirement: "El sistema debe mantener un registro de auditoría completo e inmutable de todas las actividades",
          category: "Regulatory",
          priority: "HIGH"
        },
        {
          requirement: "La aplicación debe implementar controles de acceso basados en roles y permisos",
          category: "Seguridad",
          priority: "HIGH"
        },
        {
          requirement: "El sistema debe generar reportes de cumplimiento normativo de forma automática",
          category: "Regulatory",
          priority: "HIGH"
        },
        {
          requirement: "La aplicación debe permitir la firma electrónica de documentos críticos",
          category: "Seguridad",
          priority: "MEDIUM"
        }
      ]
    
    default:
      return [
        {
          requirement: "El sistema debe proporcionar una interfaz intuitiva para la gestión de procesos",
          category: "Usabilidad",
          priority: "MEDIUM"
        },
        {
          requirement: "La aplicación debe permitir la configuración flexible de flujos de trabajo",
          category: "Funcional",
          priority: "MEDIUM"
        },
        {
          requirement: "El sistema debe generar notificaciones automáticas para eventos importantes",
          category: "Funcional",
          priority: "LOW"
        },
        {
          requirement: "La aplicación debe mantener un historial completo de cambios y modificaciones",
          category: "Funcional",
          priority: "MEDIUM"
        }
      ]
  }
}

function getComplexityRequirements(complexity: ProcessMapAnalysis['complexity']): Omit<UserRequirement, 'prefix' | 'number'>[] {
  switch (complexity) {
    case 'high':
      return [
        {
          requirement: "El sistema debe manejar múltiples procesos concurrentes sin degradación del rendimiento",
          category: "Rendimiento",
          priority: "HIGH"
        },
        {
          requirement: "La aplicación debe implementar mecanismos avanzados de recuperación ante fallos",
          category: "Seguridad",
          priority: "HIGH"
        }
      ]
    
    case 'low':
      return [
        {
          requirement: "El sistema debe proporcionar una interfaz simplificada para usuarios básicos",
          category: "Usabilidad",
          priority: "MEDIUM"
        }
      ]
    
    default:
      return [
        {
          requirement: "La aplicación debe balancear funcionalidad y simplicidad en su diseño",
          category: "Usabilidad",
          priority: "MEDIUM"
        }
      ]
  }
}

function getElementBasedRequirements(elements: string[]): Omit<UserRequirement, 'prefix' | 'number'>[] {
  const requirements: Omit<UserRequirement, 'prefix' | 'number'>[] = []
  
  elements.forEach(element => {
    switch (element.toLowerCase()) {
      case 'validaciones':
        requirements.push({
          requirement: "El sistema debe ejecutar validaciones automáticas en puntos críticos del proceso",
          category: "Funcional",
          priority: "HIGH"
        })
        break
      
      case 'documentación':
        requirements.push({
          requirement: "La aplicación debe generar y mantener documentación técnica actualizada",
          category: "Mantenimiento",
          priority: "MEDIUM"
        })
        break
      
      case 'auditorías':
        requirements.push({
          requirement: "El sistema debe facilitar la preparación y ejecución de auditorías internas",
          category: "Regulatory",
          priority: "MEDIUM"
        })
        break
      
      case 'equipos de producción':
        requirements.push({
          requirement: "La aplicación debe monitorear el estado y rendimiento de equipos críticos",
          category: "Mantenimiento",
          priority: "HIGH"
        })
        break
    }
  })
  
  return requirements
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}