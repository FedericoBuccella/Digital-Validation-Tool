import React, { useState, useCallback } from 'react';
import { Upload, FileImage, Loader2, CheckCircle, AlertCircle, Download, Eye } from 'lucide-react';
import { geminiAI } from '../../lib/aiService';

// Types for the process map analysis
interface UserRequirement {
  requirement: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  prefix: string;
  number: string;
}

interface AnalysisState {
  isAnalyzing: boolean;
  requirements: UserRequirement[];
  error: string | null;
  analysisComplete: boolean;
  imagePreview: string | null;
}

const ProcessMapAnalyzer: React.FC<{ onRequirementsGenerated: (requirements: UserRequirement[]) => void }> = ({ onRequirementsGenerated }) => {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    requirements: [],
    error: null,
    analysisComplete: false,
    imagePreview: null
  });

  const [dragActive, setDragActive] = useState(false);

  // Convert file to base64 for preview and processing
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }, []);

  // Generate dynamic prompt for Gemini Vision
  const generateVisionPrompt = useCallback((): string => {
    return `Analiza cuidadosamente esta imagen de un mapa de proceso o diagrama de flujo y genera requerimientos de usuario específicos basados en EXACTAMENTE lo que ves.

INSTRUCCIONES CRÍTICAS:
1. EXAMINA CADA ELEMENTO VISUAL: Lee TODO el texto visible en cajas, rectángulos, formas, etiquetas, títulos
2. IDENTIFICA FUNCIONALIDADES: Si ves texto como "Generación de reporte", "Validación de datos", "Autenticación", etc., crea requerimientos específicos para esas funciones
3. ANALIZA FLUJOS: Observa las flechas y conexiones entre elementos para entender el proceso
4. DETECTA DECISIONES: Si hay rombos o puntos de decisión, crea requerimientos para esas validaciones
5. CONSIDERA ACTORES: Si hay roles o usuarios mencionados, incluye requerimientos de permisos/acceso

FORMATO DE REQUERIMIENTOS:
- Para cada función/elemento visible, crea un requerimiento específico
- Usa lenguaje técnico apropiado: "El sistema debe permitir...", "La aplicación debe validar...", etc.
- Categoriza apropiadamente: Funcional, Seguridad, Interfaz, Rendimiento, etc.
- Prioriza según criticidad: HIGH para funciones core, MEDIUM para importantes, LOW para mejoras

EJEMPLO:
Si veo una caja que dice "Generación de Reportes", debo crear:
"El sistema debe permitir la generación de reportes de [tipo específico si se menciona]"

Si veo "Validación de Usuario", debo crear:
"El sistema debe validar las credenciales del usuario antes del acceso"

IMPORTANTE: 
- NO inventes funcionalidades que no veas
- SÉ ESPECÍFICO con lo que realmente aparece en la imagen
- Genera entre 5-12 requerimientos únicos
- Cada requerimiento debe corresponder a elementos visibles

Responde ÚNICAMENTE con un JSON array válido:
[
  {
    "requirement": "descripción específica basada en elementos visibles",
    "category": "categoría apropiada",
    "priority": "HIGH|MEDIUM|LOW",
    "prefix": "URS",
    "number": "número secuencial empezando en 010"
  }
]`;
  }, []);

  // Generate fallback requirements
  const generateFallbackRequirements = useCallback((): UserRequirement[] => {
    return [
      {
        requirement: "El sistema debe permitir la gestión básica de procesos de negocio",
        category: "Funcional",
        priority: "MEDIUM",
        prefix: "URS",
        number: "010"
      },
      {
        requirement: "La aplicación debe proporcionar controles de acceso seguros",
        category: "Seguridad",
        priority: "HIGH",
        prefix: "URS",
        number: "011"
      },
      {
        requirement: "El sistema debe mantener registros de auditoría de actividades",
        category: "Regulatory",
        priority: "MEDIUM",
        prefix: "URS",
        number: "012"
      }
    ];
  }, []);

  // Main analysis function using Gemini Vision
  const analyzeProcessMap = useCallback(async (file: File): Promise<UserRequirement[]> => {
    try {
      console.log('Starting process map analysis with Gemini Vision...');
      
      // Convert image to base64
      const base64Image = await fileToBase64(file);
      console.log('Image converted to base64, size:', base64Image.length);
      
      // Determine MIME type
      const mimeType = file.type || 'image/jpeg';
      console.log('Image MIME type:', mimeType);
      
      // Create the vision prompt
      const prompt = generateVisionPrompt();
      console.log('Generated vision prompt');
      
      // Call Gemini Vision API
      console.log('Calling Gemini Vision API...');
      const response = await geminiAI.analyzeImageWithPrompt(base64Image, prompt, mimeType, {
        temperature: 0.7,
        maxTokens: 3000
      });
      
      console.log('Gemini Vision API response received:', response.substring(0, 200) + '...');

      // Clean the response to ensure it's valid JSON
      let cleanContent = response.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      try {
        const requirements = JSON.parse(cleanContent);
        
        // Validate the response structure
        if (!Array.isArray(requirements)) {
          throw new Error('Response is not an array');
        }
        
        // Validate each requirement object
        const validatedRequirements = requirements.map((req: any, index: number) => {
          if (!req.requirement || !req.category || !req.priority) {
            throw new Error(`Invalid requirement at index ${index}`);
          }
          
          return {
            requirement: String(req.requirement),
            category: String(req.category),
            priority: req.priority as 'HIGH' | 'MEDIUM' | 'LOW',
            prefix: req.prefix || 'URS',
            number: req.number || String(10 + index).padStart(3, '0')
          };
        });
        
        console.log('Gemini Vision Analysis successful:', validatedRequirements.length, 'requirements generated');
        return validatedRequirements;
        
      } catch (parseError) {
        console.error('Error parsing Gemini Vision response:', parseError);
        console.error('Raw response:', response);
        
        // Fallback to basic requirements
        console.log('Using fallback requirements due to parsing error');
        return generateFallbackRequirements();
      }
      
    } catch (error) {
      console.error('Error calling Gemini Vision API:', error);
      
      // Return fallback requirements
      console.log('Using fallback requirements due to API error');
      return generateFallbackRequirements();
    }
  }, [fileToBase64, generateVisionPrompt, generateFallbackRequirements]);

  // Handle file upload and analysis
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnalysisState(prev => ({
        ...prev,
        error: 'Por favor selecciona un archivo de imagen válido.'
      }));
      return;
    }

    setAnalysisState(prev => ({
      ...prev,
      isAnalyzing: true,
      error: null,
      requirements: [],
      analysisComplete: false
    }));

    try {
      // Create image preview
      const imageUrl = URL.createObjectURL(file);
      setAnalysisState(prev => ({ ...prev, imagePreview: imageUrl }));

      // Analyze the process map
      const requirements = await analyzeProcessMap(file);
      
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        requirements,
        analysisComplete: true
      }));

      // Pass requirements to parent component
      onRequirementsGenerated(requirements);

    } catch (error) {
      console.error('Error during analysis:', error);
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Error desconocido durante el análisis'
      }));
    }
  }, [analyzeProcessMap, onRequirementsGenerated]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  // File input change handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }, [handleFileUpload]);

  // Export requirements to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['ID', 'Requerimiento', 'Categoría', 'Prioridad'];
    const csvContent = [
      headers.join(','),
      ...analysisState.requirements.map(req => 
        `${req.prefix}-${req.number},"${req.requirement}",${req.category},${req.priority}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'requerimientos_proceso.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [analysisState.requirements]);

  // Priority color mapping
  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Analizador de Mapas de Proceso con Gemini Vision AI
        </h1>
        <p className="text-gray-600">
          Sube una imagen de tu mapa de proceso y genera requerimientos automáticamente analizando el contenido visual
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="image/*"
            onChange={handleInputChange}
            disabled={analysisState.isAnalyzing}
          />
          
          <div className="space-y-4">
            <div className="flex justify-center">
              {analysisState.isAnalyzing ? (
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              ) : (
                <Upload className="h-12 w-12 text-gray-400" />
              )}
            </div>
            
            <div>
              <label
                htmlFor="file-upload"
                className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  analysisState.isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FileImage className="mr-2 h-4 w-4" />
                {analysisState.isAnalyzing ? 'Analizando con IA...' : 'Seleccionar Imagen'}
              </label>
            </div>
            
            <p className="text-sm text-gray-500">
              O arrastra y suelta una imagen aquí
            </p>
            <p className="text-xs text-gray-400">
              Formatos soportados: JPG, PNG, GIF (máx. 10MB)
            </p>
          </div>
        </div>

        {/* Analysis Progress */}
        {analysisState.isAnalyzing && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-blue-800 font-medium">Analizando imagen con Gemini Vision AI...</span>
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Procesando imagen y extrayendo contenido visual...</p>
              <p>• Identificando elementos, texto y funcionalidades...</p>
              <p>• Generando requerimientos específicos basados en lo observado...</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview */}
      {analysisState.imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Eye className="mr-2 h-5 w-5" />
            Vista Previa de la Imagen
          </h3>
          <div className="flex justify-center">
            <img
              src={analysisState.imagePreview}
              alt="Process Map Preview"
              className="max-w-full max-h-96 object-contain rounded-lg border"
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {analysisState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-700">{analysisState.error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {analysisState.analysisComplete && analysisState.requirements.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Requerimientos Generados ({analysisState.requirements.length})
            </h3>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requerimiento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prioridad
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analysisState.requirements.map((req, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {req.prefix}-{req.number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {req.requirement}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(req.priority)}`}>
                        {req.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Cómo usar el analizador
        </h3>
        <ul className="text-blue-800 space-y-2 text-sm">
          <li>• Sube una imagen clara de tu mapa de proceso (JPG, PNG, GIF)</li>
          <li>• La IA de Gemini analizará automáticamente los elementos visibles y el texto</li>
          <li>• Se generarán requerimientos específicos basados en las funcionalidades identificadas</li>
          <li>• Por ejemplo: si ve "Generación de reporte" creará "El sistema debe permitir la generación de reportes"</li>
          <li>• Puedes exportar los resultados en formato CSV</li>
          <li>• Los requerimientos se categorizan y priorizan automáticamente</li>
        </ul>
      </div>
    </div>
  );
};

export default ProcessMapAnalyzer;