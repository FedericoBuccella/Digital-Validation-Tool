import { env, validateEnv } from './env';

// Gemini API response types
interface GeminiCandidate {
  content: {
    parts: Array<{
      text: string;
    }>;
    role: string;
  };
  finishReason?: string;
  index: number;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// Message interface for chat
export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

// Generation configuration
interface GenerationConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

// Safety settings
interface SafetySetting {
  category: string;
  threshold: string;
}

// Request payload for Gemini API
interface GeminiRequest {
  contents: ChatMessage[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
}

class GeminiAIService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    validateEnv();
    this.apiKey = env.GEMINI_API_KEY;
    this.baseUrl = env.GEMINI_API_URL;
    this.model = 'gemini-1.5-flash'; // Use vision-capable model
  }

  /**
   * Generate content using Gemini AI
   */
  async generateContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    }
  ): Promise<string> {
    try {
      const requestBody: GeminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: options?.temperature ?? env.TEMPERATURE,
          topK: options?.topK ?? env.TOP_K,
          topP: options?.topP ?? env.TOP_P,
          maxOutputTokens: options?.maxTokens ?? env.MAX_TOKENS,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}. ${
            errorData.error?.message || ''
          }`
        );
      }

      const data: GeminiResponse = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated from Gemini');
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response format from Gemini');
      }

      return candidate.content.parts[0].text;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Analyze image with text prompt using Gemini Vision
   */
  async analyzeImageWithPrompt(
    imageBase64: string,
    prompt: string,
    mimeType: string = 'image/jpeg',
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    }
  ): Promise<string> {
    try {
      const requestBody: GeminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: options?.temperature ?? env.TEMPERATURE,
          topK: options?.topK ?? env.TOP_K,
          topP: options?.topP ?? env.TOP_P,
          maxOutputTokens: options?.maxTokens ?? env.MAX_TOKENS,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}. ${
            errorData.error?.message || ''
          }`
        );
      }

      const data: GeminiResponse = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated from Gemini');
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response format from Gemini');
      }

      return candidate.content.parts[0].text;
    } catch (error) {
      console.error('Error calling Gemini Vision API:', error);
      throw error;
    }
  }

  /**
   * Chat with conversation history
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    }
  ): Promise<string> {
    try {
      // Convert messages to Gemini format
      const geminiMessages: ChatMessage[] = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const requestBody: GeminiRequest = {
        contents: geminiMessages,
        generationConfig: {
          temperature: options?.temperature ?? env.TEMPERATURE,
          topK: options?.topK ?? env.TOP_K,
          topP: options?.topP ?? env.TOP_P,
          maxOutputTokens: options?.maxTokens ?? env.MAX_TOKENS,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}. ${
            errorData.error?.message || ''
          }`
        );
      }

      const data: GeminiResponse = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated from Gemini');
      }

      const candidate = data.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('Invalid response format from Gemini');
      }

      return candidate.content.parts[0].text;
    } catch (error) {
      console.error('Error in Gemini chat:', error);
      throw error;
    }
  }

  /**
   * Stream content generation (simplified implementation)
   * Note: Gemini API supports streaming, but this is a basic implementation
   */
  async *streamContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    }
  ): AsyncGenerator<string, void, unknown> {
    try {
      // For now, we'll simulate streaming by yielding the full response
      // In a real implementation, you'd use the streaming endpoint
      const response = await this.generateContent(prompt, options);
      
      // Simulate streaming by yielding chunks
      const words = response.split(' ');
      for (let i = 0; i < words.length; i++) {
        yield words[i] + (i < words.length - 1 ? ' ' : '');
        // Add a small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error in streaming:', error);
      throw error;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return ['gemini-1.5-flash', 'gemini-1.5-pro']; // Return default models
    }
  }

  /**
   * Check API key validity
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.generateContent('Hello', { maxTokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const geminiAI = new GeminiAIService();

// Export the class for custom instances
export { GeminiAIService };

// Utility functions
export const createGeminiService = (customApiKey?: string) => {
  if (customApiKey) {
    const customEnv = { ...env, GEMINI_API_KEY: customApiKey };
    return new GeminiAIService();
  }
  return geminiAI;
};

// Example usage:
/*
import { geminiAI } from './aiService';

// Simple text generation
const response = await geminiAI.generateContent('Explain quantum computing');

// Image analysis with vision
const imageAnalysis = await geminiAI.analyzeImageWithPrompt(
  base64ImageData, 
  'Describe what you see in this process map'
);

// Chat with history
const chatResponse = await geminiAI.chat([
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi there! How can I help you?' },
  { role: 'user', content: 'Tell me a joke' }
]);

// Streaming response
for await (const chunk of geminiAI.streamContent('Write a short story')) {
  console.log(chunk);
}
*/