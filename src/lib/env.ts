// Environment configuration for Gemini AI
export const env = {
  // Gemini API Key - Get your free API key from https://makersuite.google.com/app/apikey
  GEMINI_API_KEY: import.meta.env?.VITE_GEMINI_API_KEY || 'AIzaSyDY96hTj-qvNUNXmzDatJarZ2hgGzYOGq0',
  
  // Gemini API Base URL
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta',
  
  // Default model to use
  GEMINI_MODEL: 'gemini-1.5-flash', // Free tier model with vision capabilities
  
  // Alternative models available:
  // 'gemini-1.5-pro' - More capable but with lower rate limits
  // 'gemini-1.5-flash' - Faster and more cost-effective with vision
  
  // Request timeout in milliseconds
  REQUEST_TIMEOUT: 30000,
  
  // Max tokens for generation
  MAX_TOKENS: 8192,
  
  // Temperature for response creativity (0-2)
  TEMPERATURE: 0.7,
  
  // Top P for nucleus sampling (0-1)
  TOP_P: 0.8,
  
  // Top K for token selection
  TOP_K: 40,

  // Environment detection
  isDevelopment: import.meta.env?.DEV || process.env.NODE_ENV === 'development',
  isProduction: import.meta.env?.PROD || process.env.NODE_ENV === 'production'
};

// Debug function for environment variables
export function debugEnvironment(): void {
  console.group('🔍 Environment Variables Debug');
  console.log('All import.meta.env:', import.meta.env);
  console.log('VITE_GEMINI_API_KEY:', import.meta.env?.VITE_GEMINI_API_KEY);
  console.log('VITE_GEMINI_API_KEY type:', typeof import.meta.env?.VITE_GEMINI_API_KEY);
  console.log('VITE_GEMINI_API_KEY length:', import.meta.env?.VITE_GEMINI_API_KEY?.length);
  console.log('env.GEMINI_API_KEY:', env.GEMINI_API_KEY);
  console.log('isDevelopment:', env.isDevelopment);
  console.log('isProduction:', env.isProduction);
  console.groupEnd();
}

// Validate required environment variables
export function validateEnvironment(): { isValid: boolean; missingVars: string[]; details: Record<string, any> } {
  const missingVars: string[] = []
  const details: Record<string, any> = {}
  
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
    missingVars.push('VITE_GEMINI_API_KEY')
    details.VITE_GEMINI_API_KEY = {
      value: import.meta.env?.VITE_GEMINI_API_KEY,
      type: typeof import.meta.env?.VITE_GEMINI_API_KEY,
      length: import.meta.env?.VITE_GEMINI_API_KEY?.length || 0,
      isEmpty: !import.meta.env?.VITE_GEMINI_API_KEY,
      isUndefined: import.meta.env?.VITE_GEMINI_API_KEY === undefined
    }
  } else {
    details.VITE_GEMINI_API_KEY = {
      status: 'OK',
      length: env.GEMINI_API_KEY.length,
      preview: env.GEMINI_API_KEY.substring(0, 10) + '...'
    }
  }
  
  return {
    isValid: missingVars.length === 0,
    missingVars,
    details
  }
}

// Validation function
export const validateEnv = () => {
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
    throw new Error(
      'GEMINI_API_KEY is required. Get your free API key from https://makersuite.google.com/app/apikey'
    );
  }
};

// Get Gemini API key with validation
export function getGeminiKey(): string {
  const validation = validateEnvironment()
  
  if (!validation.isValid) {
    console.error('Environment validation failed:', validation)
    throw new Error(`Gemini API key not configured. Details: ${JSON.stringify(validation.details, null, 2)}`)
  }
  
  return env.GEMINI_API_KEY
}

// Legacy function for compatibility (redirects to Gemini)
export function getOpenAIKey(): string {
  console.warn('getOpenAIKey() is deprecated. Use getGeminiKey() instead.');
  return getGeminiKey();
}