#!/usr/bin/env node

/**
 * Script to fetch OpenAI-compatible providers from models.dev API
 * and generate a TypeScript file with provider configurations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchProviders() {
  console.log('Fetching providers from models.dev API...');

  try {
    const response = await fetch('https://models.dev/api.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching providers:', error);
    throw error;
  }
}

function generateProviderRegistry(providers) {
  const openAICompatibleProviders = {};

  // Filter providers that use @ai-sdk/openai-compatible
  for (const [providerId, provider] of Object.entries(providers)) {
    if (provider.npm === '@ai-sdk/openai-compatible') {
      // Extract the API URL and environment variable
      const envVar = Array.isArray(provider.env) ? provider.env[0] : provider.env;

      // Replace dashes with underscores in provider IDs for valid JS identifiers
      const safeProviderId = providerId.replace(/-/g, '_');

      // Fix URL construction - check if it already ends with /v1 or /v1/
      let url;
      if (provider.api) {
        if (provider.api.endsWith('/v1/')) {
          url = `${provider.api}chat/completions`;
        } else if (provider.api.endsWith('/v1')) {
          url = `${provider.api}/chat/completions`;
        } else {
          url = `${provider.api}/v1/chat/completions`;
        }
      }

      openAICompatibleProviders[safeProviderId] = {
        url,
        apiKeyEnvVar: envVar,
        apiKeyHeader: 'Authorization',
        name: provider.name,
        models: Object.keys(provider.models || {}),
      };
    }
  }

  // Add any custom providers that might not be in models.dev but we know are OpenAI-compatible
  const additionalProviders = {
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      apiKeyHeader: 'Authorization',
      name: 'OpenAI',
      models: [], // Will be populated from API if available
    },
    anthropic: {
      // Anthropic offers an OpenAI-compatible endpoint at /v1/chat/completions
      url: 'https://api.anthropic.com/v1/chat/completions',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      apiKeyHeader: 'x-api-key',
      name: 'Anthropic',
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
      models: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        // Latest models
        'claude-3-7-sonnet-20250219',
        'claude-opus-4-1-20250805',
      ],
    },
    groq: {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKeyEnvVar: 'GROQ_API_KEY',
      apiKeyHeader: 'Authorization',
      name: 'Groq',
      models: [],
    },
    together: {
      url: 'https://api.together.xyz/v1/chat/completions',
      apiKeyEnvVar: 'TOGETHER_API_KEY',
      apiKeyHeader: 'Authorization',
      name: 'Together AI',
      models: [],
    },
    perplexity: {
      url: 'https://api.perplexity.ai/chat/completions',
      apiKeyEnvVar: 'PERPLEXITY_API_KEY',
      apiKeyHeader: 'Authorization',
      name: 'Perplexity',
      models: [],
    },
  };

  // Check if these providers exist in the API data and update them
  for (const [providerId, config] of Object.entries(additionalProviders)) {
    if (providers[providerId]) {
      const provider = providers[providerId];
      config.name = provider.name || config.name;
      config.models = Object.keys(provider.models || {});
      if (provider.api) {
        // Fix URL construction - check if it already ends with /v1 or /v1/
        if (provider.api.endsWith('/v1/')) {
          config.url = `${provider.api}chat/completions`;
        } else if (provider.api.endsWith('/v1')) {
          config.url = `${provider.api}/chat/completions`;
        } else {
          config.url = `${provider.api}/v1/chat/completions`;
        }
      }
      if (provider.env) {
        config.apiKeyEnvVar = Array.isArray(provider.env) ? provider.env[0] : provider.env;
      }
    }
    // Add to the registry if not already present
    if (!openAICompatibleProviders[providerId]) {
      openAICompatibleProviders[providerId] = config;
    }
  }

  return openAICompatibleProviders;
}

function generateTypeScriptFile(providerRegistry) {
  const modelsList = {};
  const allModelStrings = [];

  for (const [providerId, config] of Object.entries(providerRegistry)) {
    if (config.models && config.models.length > 0) {
      modelsList[providerId] = config.models;
      // Add provider/model format strings
      for (const model of config.models) {
        allModelStrings.push(`${providerId}/${model}`);
      }
    }
  }

  const tsContent = `/**
 * Auto-generated provider registry from models.dev API
 * Generated on: ${new Date().toISOString()}
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated by scripts/generate-providers.mjs
 */

export interface ProviderConfig {
  url: string;
  defaultHeaders?: Record<string, string>;
  apiKeyEnvVar?: string;
  apiKeyHeader?: string;
  name?: string;
  models?: string[];
}

/**
 * Registry of OpenAI-compatible providers
 */
export const PROVIDER_REGISTRY: Record<string, ProviderConfig> = ${JSON.stringify(providerRegistry, null, 2)} as const;

/**
 * Available models for each provider
 */
export const PROVIDER_MODELS: Record<string, string[]> = ${JSON.stringify(modelsList, null, 2)} as const;

/**
 * All available model strings in provider/model format
 */
export type OpenAICompatibleModelId = 
${allModelStrings.map(m => `  | '${m}'`).join('\n')};

/**
 * Get provider configuration by provider ID
 */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY[providerId];
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(providerId: string): boolean {
  return providerId in PROVIDER_REGISTRY;
}

/**
 * Get all registered provider IDs
 */
export function getRegisteredProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

/**
 * Parse a model string to extract provider and model ID
 * Examples:
 *   "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 *   "chutes/Qwen/Qwen3-235B" -> { provider: "chutes", modelId: "Qwen/Qwen3-235B" }
 *   "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export function parseModelString(modelString: string): { provider: string | null; modelId: string } {
  const firstSlashIndex = modelString.indexOf('/');
  
  if (firstSlashIndex !== -1) {
    // Has at least one slash - extract provider and rest as model ID
    const provider = modelString.substring(0, firstSlashIndex);
    const modelId = modelString.substring(firstSlashIndex + 1);
    
    if (provider && modelId) {
      return {
        provider,
        modelId,
      };
    }
  }
  
  // No slash or invalid format
  return {
    provider: null,
    modelId: modelString,
  };
}
`;

  return tsContent;
}

async function main() {
  try {
    // Fetch providers from API
    const providers = await fetchProviders();
    console.log(`Fetched ${Object.keys(providers).length} providers from models.dev`);

    // Generate provider registry
    const providerRegistry = generateProviderRegistry(providers);
    console.log(`Found ${Object.keys(providerRegistry).length} OpenAI-compatible providers`);

    // Generate TypeScript file
    const tsContent = generateTypeScriptFile(providerRegistry);

    // Write to file
    const outputPath = path.join(__dirname, '..', 'src', 'llm', 'model', 'provider-registry.generated.ts');

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, tsContent, 'utf-8');
    console.log(`✅ Generated provider registry at: ${outputPath}`);

    // Log summary
    console.log('\nRegistered providers:');
    for (const [providerId, config] of Object.entries(providerRegistry)) {
      console.log(`  - ${providerId}: ${config.name} (${config.models?.length || 0} models)`);
    }
  } catch (error) {
    console.error('Failed to generate provider registry:', error);
    process.exit(1);
  }
}

// Run the script
main();
