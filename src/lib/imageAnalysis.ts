import { ProcessMapAnalysis } from '@/types/requirements'

interface ColorAnalysis {
  hasOrange: boolean
  hasGray: boolean
  colorVariety: number
}

export async function analyzeImageCharacteristics(file: File): Promise<ProcessMapAnalysis> {
  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      
      // Basic image analysis
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData?.data || new Uint8ClampedArray()
      
      // Analyze colors and patterns
      const colorAnalysis = analyzeColors(data)
      const sizeAnalysis = analyzeSizeComplexity(img.width, img.height)
      
      // Determine process type based on filename and characteristics
      const processType = determineProcessType(file.name, colorAnalysis)
      const complexity = determineComplexity(sizeAnalysis, colorAnalysis)
      
      resolve({
        processType,
        complexity,
        elements: generateElementsFromAnalysis(processType, complexity),
        suggestedCategories: getSuggestedCategories(processType)
      })
    }
    
    img.onerror = () => {
      // Fallback analysis based on filename only
      resolve({
        processType: determineProcessTypeFromName(file.name),
        complexity: 'medium',
        elements: ['Proceso principal', 'Puntos de control', 'Validaciones'],
        suggestedCategories: ['Funcional', 'Regulatory', 'Seguridad']
      })
    }
    
    img.src = URL.createObjectURL(file)
  })
}

function analyzeColors(data: Uint8ClampedArray): ColorAnalysis {
  let orangePixels = 0
  let grayPixels = 0
  const colors = new Set<string>()
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    // Detect orange-ish colors
    if (r > 200 && g > 100 && g < 200 && b < 100) {
      orangePixels++
    }
    
    // Detect gray-ish colors
    if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) {
      grayPixels++
    }
    
    // Track color variety
    const colorKey = `${Math.floor(r/50)}-${Math.floor(g/50)}-${Math.floor(b/50)}`
    colors.add(colorKey)
  }
  
  return {
    hasOrange: orangePixels > data.length * 0.01, // More than 1% orange pixels
    hasGray: grayPixels > data.length * 0.1, // More than 10% gray pixels
    colorVariety: colors.size
  }
}

function analyzeSizeComplexity(width: number, height: number): 'low' | 'medium' | 'high' {
  const totalPixels = width * height
  if (totalPixels < 500000) return 'low' // Less than 500k pixels
  if (totalPixels < 2000000) return 'medium' // Less than 2M pixels
  return 'high'
}

function determineProcessType(filename: string, colorAnalysis: ColorAnalysis): ProcessMapAnalysis['processType'] {
  const name = filename.toLowerCase()
  
  if (name.includes('manufactur') || name.includes('produc')) return 'manufacturing'
  if (name.includes('quality') || name.includes('calidad')) return 'quality'
  if (name.includes('regulatory') || name.includes('compliance') || name.includes('gxp')) return 'regulatory'
  if (colorAnalysis.hasOrange && colorAnalysis.hasGray) return 'regulatory' // GXP-style processes
  
  return 'general'
}

function determineProcessTypeFromName(filename: string): ProcessMapAnalysis['processType'] {
  const name = filename.toLowerCase()
  
  if (name.includes('manufactur') || name.includes('produc')) return 'manufacturing'
  if (name.includes('quality') || name.includes('calidad')) return 'quality'
  if (name.includes('regulatory') || name.includes('compliance') || name.includes('gxp')) return 'regulatory'
  
  return 'unknown'
}

function determineComplexity(sizeAnalysis: string, colorAnalysis: ColorAnalysis): ProcessMapAnalysis['complexity'] {
  if (sizeAnalysis === 'high' || colorAnalysis.colorVariety > 20) return 'high'
  if (sizeAnalysis === 'low' && colorAnalysis.colorVariety < 10) return 'low'
  return 'medium'
}

function generateElementsFromAnalysis(processType: ProcessMapAnalysis['processType'], complexity: ProcessMapAnalysis['complexity']): string[] {
  const baseElements = ['Proceso principal', 'Puntos de decisión', 'Controles de calidad']
  
  switch (processType) {
    case 'manufacturing':
      return [...baseElements, 'Equipos de producción', 'Materiales', 'Procedimientos operativos']
    case 'quality':
      return [...baseElements, 'Inspecciones', 'Pruebas', 'Criterios de aceptación']
    case 'regulatory':
      return [...baseElements, 'Validaciones', 'Documentación', 'Auditorías', 'Cumplimiento normativo']
    default:
      return baseElements
  }
}

function getSuggestedCategories(processType: ProcessMapAnalysis['processType']): string[] {
  switch (processType) {
    case 'manufacturing':
      return ['Funcional', 'Rendimiento', 'Seguridad', 'Mantenimiento']
    case 'quality':
      return ['Funcional', 'No Funcional', 'Usabilidad', 'Compatibilidad']
    case 'regulatory':
      return ['Regulatory', 'Seguridad', 'Funcional', 'Mantenimiento']
    default:
      return ['Funcional', 'No Funcional', 'Usabilidad']
  }
}