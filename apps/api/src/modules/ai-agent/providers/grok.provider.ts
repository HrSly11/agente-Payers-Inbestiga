import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AIProvider, ChatMessage, ToolDefinition, AIProviderResponse } from '../ai-provider.interface';

@Injectable()
export class GrokProvider implements AIProvider {
  private readonly logger = new Logger('OpenAiCompatibleProvider');

  async generarRespuesta(
    mensajes: ChatMessage[],
    herramientas: ToolDefinition[],
    temperatura = 0.7,
    modeloDeseado?: string,
    proveedorDeseado?: string,
  ): Promise<AIProviderResponse> {
    // 1. Determinar el proveedor activo (GROQ, OPENROUTER, GROK)
    const providerName = (
      proveedorDeseado ||
      process.env.AI_PROVIDER ||
      (process.env.GROQ_API_KEY ? 'GROQ' : 'OPENROUTER')
    ).toUpperCase();

    let apiKey = '';
    let baseUrl = '';
    let defaultModel = '';

    if (providerName === 'GROQ' || (providerName !== 'OPENROUTER' && process.env.GROQ_API_KEY)) {
      apiKey = process.env.GROQ_API_KEY || '';
      baseUrl = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
      defaultModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    } else if (providerName === 'OPENROUTER') {
      apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTE_API_KEY || '';
      baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
      defaultModel = process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free';
    } else {
      apiKey = process.env.GROK_API_KEY || '';
      baseUrl = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
      defaultModel = process.env.GROK_MODEL || 'grok-2-mini';
    }

    // Usar modelo seleccionado en UI si no es el placeholder de Gemini
    const activeModel =
      modeloDeseado && !modeloDeseado.includes('gemini') ? modeloDeseado : defaultModel;

    if (!apiKey || apiKey.length < 15) {
      this.logger.debug(`[${providerName}] Clave no configurada. Delegando a respuesta estructurada.`);
      return {
        content:
          'Hola, soy el negociador de INBESTIGA.TESIS. Con gusto podemos evaluar las facilidades de cuotas y el descuento institucional para tu investigación.',
      };
    }

    try {
      this.logger.log(`Consultando ${providerName} (${baseUrl}) con modelo: ${activeModel}`);

      const formattedTools = herramientas.map((h) => ({
        type: 'function',
        function: {
          name: h.name,
          description: h.description,
          parameters: h.parameters,
        },
      }));

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      if (baseUrl.includes('openrouter')) {
        headers['HTTP-Referer'] = 'http://localhost:3000';
        headers['X-Title'] = 'INBESTIGA.TESIS';
      }

      let response: any;
      try {
        response = await axios.post(
          `${baseUrl}/chat/completions`,
          {
            model: activeModel,
            messages: mensajes,
            tools: formattedTools.length > 0 ? formattedTools : undefined,
            temperature: temperatura,
          },
          {
            headers,
            timeout: 25000,
          },
        );
      } catch (postErr: any) {
        if (postErr.response?.status === 429) {
          const fallbackModel = activeModel === 'openai/gpt-oss-20b' ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-20b';
          this.logger.warn(`Límite transitorio/tokens en ${providerName} (${activeModel}). Conmutando inmediatamente a modelo con cuota: ${fallbackModel}...`);
          try {
            response = await axios.post(
              `${baseUrl}/chat/completions`,
              {
                model: fallbackModel,
                messages: mensajes,
                tools: formattedTools.length > 0 ? formattedTools : undefined,
                temperature: temperatura,
              },
              {
                headers,
                timeout: 25000,
              },
            );
          } catch (retryErr: any) {
            throw retryErr;
          }
        } else {
          throw postErr;
        }
      }

      const choice = response.data?.choices?.[0]?.message;

      if (choice?.tool_calls && choice.tool_calls.length > 0) {
        return {
          content: choice.content || '',
          toolCalls: choice.tool_calls.map((tc: any) => {
            let parsedArgs = {};
            if (typeof tc.function?.arguments === 'string') {
              try {
                parsedArgs = JSON.parse(tc.function.arguments || '{}');
              } catch (e) {
                parsedArgs = {};
              }
            } else if (tc.function?.arguments) {
              parsedArgs = tc.function.arguments;
            }
            return {
              id: tc.id || `call_${Date.now()}`,
              name: tc.function?.name,
              arguments: parsedArgs,
            };
          }),
        };
      }

      return {
        content: choice?.content || 'Estimado estudiante, en INBESTIGA estamos listos para acompañarte en tu investigación.',
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.warn(`Error llamando a ${providerName} API (${errorMsg}). Delegando a failover.`);
      throw error;
    }
  }
}
