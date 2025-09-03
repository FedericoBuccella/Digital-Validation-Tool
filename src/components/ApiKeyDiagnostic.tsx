import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Key,
  RefreshCw,
  Save,
  TestTube
} from 'lucide-react'

interface ApiKeyConfig {
  openai: string
  anthropic: string
  gemini: string
}

interface ApiKeyStatus {
  openai: 'valid' | 'invalid' | 'untested'
  anthropic: 'valid' | 'invalid' | 'untested'
  gemini: 'valid' | 'invalid' | 'untested'
}

export default function ApiKeyDiagnostic() {
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({
    openai: '',
    anthropic: '',
    gemini: ''
  })
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    openai: 'untested',
    anthropic: 'untested',
    gemini: 'untested'
  })
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    gemini: false
  })
  const [testing, setTesting] = useState({
    openai: false,
    anthropic: false,
    gemini: false
  })
  const [saving, setSaving] = useState(false)

  // Load API keys from localStorage on component mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('apiKeys')
    if (savedKeys) {
      try {
        const parsedKeys = JSON.parse(savedKeys)
        setApiKeys(parsedKeys)
      } catch (error) {
        console.error('Error loading API keys:', error)
      }
    }
  }, [])

  const saveApiKeys = async () => {
    setSaving(true)
    try {
      localStorage.setItem('apiKeys', JSON.stringify(apiKeys))
      toast({
        title: "Éxito",
        description: "Claves API guardadas correctamente"
      })
    } catch (error) {
      console.error('Error saving API keys:', error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las claves API",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const testApiKey = async (provider: keyof ApiKeyConfig) => {
    if (!apiKeys[provider]) {
      toast({
        title: "Error",
        description: `Por favor ingresa una clave API para ${provider.toUpperCase()}`,
        variant: "destructive"
      })
      return
    }

    setTesting(prev => ({ ...prev, [provider]: true }))
    
    try {
      // Simulate API key testing (in a real app, you'd make actual API calls)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock validation logic - in reality, you'd test the actual API
      const isValid = apiKeys[provider].length > 20 && apiKeys[provider].startsWith(getExpectedPrefix(provider))
      
      setApiKeyStatus(prev => ({
        ...prev,
        [provider]: isValid ? 'valid' : 'invalid'
      }))

      toast({
        title: isValid ? "Éxito" : "Error",
        description: isValid 
          ? `Clave API de ${provider.toUpperCase()} válida`
          : `Clave API de ${provider.toUpperCase()} inválida`,
        variant: isValid ? "default" : "destructive"
      })
    } catch (error) {
      console.error(`Error testing ${provider} API key:`, error)
      setApiKeyStatus(prev => ({
        ...prev,
        [provider]: 'invalid'
      }))
      toast({
        title: "Error",
        description: `Error al probar la clave API de ${provider.toUpperCase()}`,
        variant: "destructive"
      })
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }))
    }
  }

  const getExpectedPrefix = (provider: keyof ApiKeyConfig): string => {
    switch (provider) {
      case 'openai':
        return 'sk-'
      case 'anthropic':
        return 'sk-ant-'
      case 'gemini':
        return 'AIza'
      default:
        return ''
    }
  }

  const getStatusIcon = (status: 'valid' | 'invalid' | 'untested') => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'untested':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: 'valid' | 'invalid' | 'untested') => {
    switch (status) {
      case 'valid':
        return <Badge variant="default" className="bg-green-100 text-green-800">Válida</Badge>
      case 'invalid':
        return <Badge variant="destructive">Inválida</Badge>
      case 'untested':
        return <Badge variant="secondary">Sin probar</Badge>
    }
  }

  const toggleKeyVisibility = (provider: keyof ApiKeyConfig) => {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }))
  }

  const maskApiKey = (key: string, show: boolean): string => {
    if (!key) return ''
    if (show) return key
    if (key.length <= 8) return '*'.repeat(key.length)
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4)
  }

  const testAllKeys = async () => {
    const providers = Object.keys(apiKeys) as (keyof ApiKeyConfig)[]
    for (const provider of providers) {
      if (apiKeys[provider]) {
        await testApiKey(provider)
        // Add a small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <CardTitle>Configuración de Claves API</CardTitle>
          </div>
          <CardDescription>
            Configura y valida las claves API necesarias para el análisis de procesos con IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Las claves API se almacenan localmente en tu navegador y no se envían a ningún servidor externo.
            </AlertDescription>
          </Alert>

          {/* OpenAI Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                {getStatusIcon(apiKeyStatus.openai)}
                {getStatusBadge(apiKeyStatus.openai)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleKeyVisibility('openai')}
                >
                  {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey('openai')}
                  disabled={testing.openai || !apiKeys.openai}
                >
                  {testing.openai ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Input
              id="openai-key"
              type={showKeys.openai ? "text" : "password"}
              value={showKeys.openai ? apiKeys.openai : maskApiKey(apiKeys.openai, false)}
              onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
              placeholder="sk-..."
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              Obtén tu clave API desde <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a>
            </p>
          </div>

          {/* Anthropic Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                {getStatusIcon(apiKeyStatus.anthropic)}
                {getStatusBadge(apiKeyStatus.anthropic)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleKeyVisibility('anthropic')}
                >
                  {showKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey('anthropic')}
                  disabled={testing.anthropic || !apiKeys.anthropic}
                >
                  {testing.anthropic ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Input
              id="anthropic-key"
              type={showKeys.anthropic ? "text" : "password"}
              value={showKeys.anthropic ? apiKeys.anthropic : maskApiKey(apiKeys.anthropic, false)}
              onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
              placeholder="sk-ant-..."
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              Obtén tu clave API desde <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Anthropic Console</a>
            </p>
          </div>

          {/* Google Gemini Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                {getStatusIcon(apiKeyStatus.gemini)}
                {getStatusBadge(apiKeyStatus.gemini)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleKeyVisibility('gemini')}
                >
                  {showKeys.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testApiKey('gemini')}
                  disabled={testing.gemini || !apiKeys.gemini}
                >
                  {testing.gemini ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Input
              id="gemini-key"
              type={showKeys.gemini ? "text" : "password"}
              value={showKeys.gemini ? apiKeys.gemini : maskApiKey(apiKeys.gemini, false)}
              onChange={(e) => setApiKeys(prev => ({ ...prev, gemini: e.target.value }))}
              placeholder="AIza..."
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              Obtén tu clave API desde <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>
            </p>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t">
            <Button onClick={saveApiKeys} disabled={saving} className="flex items-center space-x-2">
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Guardar Configuración</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={testAllKeys}
              disabled={Object.values(testing).some(t => t)}
              className="flex items-center space-x-2"
            >
              <TestTube className="h-4 w-4" />
              <span>Probar Todas</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado del Sistema</CardTitle>
          <CardDescription>
            Resumen del estado de configuración de las APIs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">OpenAI</p>
                <p className="text-sm text-gray-500">GPT-4, GPT-3.5</p>
              </div>
              {getStatusIcon(apiKeyStatus.openai)}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Anthropic</p>
                <p className="text-sm text-gray-500">Claude</p>
              </div>
              {getStatusIcon(apiKeyStatus.anthropic)}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Google</p>
                <p className="text-sm text-gray-500">Gemini Pro</p>
              </div>
              {getStatusIcon(apiKeyStatus.gemini)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}