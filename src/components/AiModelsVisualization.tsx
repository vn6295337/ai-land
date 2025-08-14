import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

const AiModelsVisualization = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Use shared Supabase client instance (with fallbacks for Lovable deployment)

  // Task types mapping with explanations
  const TASK_TYPE_MAPPING = {
    'others': 'embedding',
    'chat': 'conversational'
  };

  const TASK_TYPE_EXPLANATIONS = {
    'conversational': 'Interactive conversations',
    'text_generation': 'Text completion and generation', 
    'code_generation': 'Specialized for coding tasks',
    'multimodal': 'Processes text and images',
    'embedding': 'Convert texts into numerical representations',
    'fill_mask': 'Predicts missing words',
    'text2text_generation': 'Structured text transformation',
    'image': 'Image processing',
    'moderation': 'Content safety',
    'audio': 'Audio processing',
    'rerank': 'Search optimization',
    'language': 'Language detection',
    'transcribe': 'Speech to text',
    'asr': 'Speech recognition',
    'tts': 'Text to speech'
  };

  const formatTaskType = (taskType: string): string => {
    return taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Professional color palette
  const COLORS = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1'];

  const fetchModelData = async () => {
    try {
      console.log('Fetching model data...');
      const response = await supabase
        .from('ai_models_discovery')
        .select('*')
        .order('id', { ascending: false });

      console.log('Supabase response:', response);

      if (response.error) {
        console.error('Supabase error:', response.error);
        throw response.error;
      }

      if (!response.data || response.data.length === 0) {
        console.warn('No data returned from Supabase');
        return [];
      }

      console.log(`Successfully fetched ${response.data.length} records`);
      console.log('Sample record:', response.data[0]);
      return response.data;
    } catch (err) {
      console.error('Error fetching data:', err);
      throw err;
    }
  };

  const normalizeCompanyName = (name: string): string => {
    // Official company names mapping
    const companyMapping: Record<string, string> = {
      'meta-llama': 'Meta',
      'mistralai': 'Mistral', 
      'google-bert': 'Google',
      'google-t5': 'Google',
      'openai': 'OpenAI',
      'nvidia': 'NVIDIA',
      'microsoft': 'Microsoft',
      'anthropic': 'Anthropic',
      'cohere': 'Cohere',
      'together': 'Together AI',
      'huggingface': 'Hugging Face',
      'openrouter': 'OpenRouter',
      'google': 'Google',
      'mistral': 'Mistral',
      'meta': 'Meta'
    };
    
    return companyMapping[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1);
  };

  const normalizeOriginator = (originator: string): string => {
    return normalizeCompanyName(originator);
  };

  const processData = (rawData: any[]) => {
    // Apply task type mapping and normalize originators
    const processedData = rawData.map(item => ({
      ...item,
      task_type: TASK_TYPE_MAPPING[item.task_type as keyof typeof TASK_TYPE_MAPPING] || item.task_type,
      model_originator: normalizeOriginator(item.model_originator || item.provider || 'unknown')
    }));

    // Group by provider and task_type
    const grouped: Record<string, Record<string, number>> = {};
    processedData.forEach(item => {
      const { provider, task_type } = item;
      if (!grouped[provider]) grouped[provider] = {};
      if (!grouped[provider][task_type]) grouped[provider][task_type] = 0;
      grouped[provider][task_type]++;
    });

    // Group models by provider and originator for collapsible menu
    const modelsByProviderAndOriginator: Record<string, Record<string, any[]>> = {};
    processedData.forEach(item => {
      const { provider, model_originator, model_name, task_type } = item;
      if (!modelsByProviderAndOriginator[provider]) {
        modelsByProviderAndOriginator[provider] = {};
      }
      if (!modelsByProviderAndOriginator[provider][model_originator]) {
        modelsByProviderAndOriginator[provider][model_originator] = [];
      }
      modelsByProviderAndOriginator[provider][model_originator].push({
        model_name,
        task_type,
        ...item
      });
    });

    // Sort models within each originator by model name
    Object.keys(modelsByProviderAndOriginator).forEach(provider => {
      Object.keys(modelsByProviderAndOriginator[provider]).forEach(originator => {
        modelsByProviderAndOriginator[provider][originator].sort((a, b) => 
          a.model_name.localeCompare(b.model_name)
        );
      });
    });

    // Group models by task type for dropdown functionality
    const modelsByTaskType: Record<string, Array<{model_name: string, provider: string}>> = {};
    processedData.forEach(item => {
      const { model_name, provider, task_type } = item;
      if (!modelsByTaskType[task_type]) {
        modelsByTaskType[task_type] = [];
      }
      modelsByTaskType[task_type].push({ model_name, provider });
    });

    // Sort models within each task type by provider then by model name
    Object.keys(modelsByTaskType).forEach(taskType => {
      modelsByTaskType[taskType].sort((a, b) => {
        if (a.provider !== b.provider) {
          return a.provider.localeCompare(b.provider);
        }
        return a.model_name.localeCompare(b.model_name);
      });
    });

    // Convert to array format and calculate totals
    const providers = Object.keys(grouped);
    const taskTypes = [...new Set(processedData.map(item => item.task_type))];
    
    // Calculate provider totals and sort
    const providerTotals = providers.map(provider => ({
      provider,
      total: Object.values(grouped[provider]).reduce((sum: number, count: number) => sum + count, 0)
    })).sort((a, b) => b.total - a.total);

    const sortedProviders = providerTotals.map(p => p.provider);

    // Calculate task type totals and sort
    const taskTypeTotals: Record<string, number> = {};
    taskTypes.forEach(taskType => {
      taskTypeTotals[taskType] = providers.reduce((sum: number, provider) => {
        return sum + (grouped[provider][taskType] || 0);
      }, 0);
    });

    const sortedTaskTypes = Object.entries(taskTypeTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([taskType]) => taskType);

    return {
      grouped,
      sortedProviders,
      sortedTaskTypes,
      providerTotals: providerTotals.reduce((acc: Record<string, number>, p) => {
        acc[p.provider] = p.total;
        return acc;
      }, {}),
      taskTypeTotals,
      modelsByTaskType,
      modelsByProviderAndOriginator
    };
  };


  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const rawData = await fetchModelData();
        console.log('Raw data length:', rawData.length);
        
        // Process data and set models for table display
        const processedData = processData(rawData);
        setModels(rawData.map(item => ({
          ...item,
          task_type: TASK_TYPE_MAPPING[item.task_type as keyof typeof TASK_TYPE_MAPPING] || item.task_type,
          model_originator: normalizeOriginator(item.model_originator || item.provider || 'unknown')
        })));

        // Update last refresh timestamp
        setLastRefresh(new Date());

      } catch (err: any) {
        console.error('Load data error:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);



  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`text-lg ${
          isDarkMode ? 'text-gray-100' : 'text-gray-900'
        }`}>Loading AI models data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!loading && models.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className={`text-gray-600 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>No data available</div>
      </div>
    );
  }

  return (
    <div className={`h-screen py-4 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        {/* Header with Dark Mode Toggle */}
        <div className="text-center mb-4 relative">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`absolute top-0 right-0 p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            title="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          <h1 className={`text-2xl font-bold ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>
            Free to use models
          </h1>
          <p className={`text-lg mt-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Interactive tracker of API-accessible and publicly available models
          </p>
          <div className="mt-4">
            <a 
              href="/executive"
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isDarkMode 
                  ? 'bg-[#38BDF8] hover:bg-[#0EA5E9] text-black' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Executive Dashboard
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          {/* Last Updated */}
          <p className={`text-xs text-center ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC • Auto-refreshes every 5 minutes
          </p>

          {/* Simple Structured Table */}
          <div className={`p-6 rounded-lg shadow-lg ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={`border-b ${
                    isDarkMode ? 'border-gray-600' : 'border-gray-300'
                  }`}>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Inference Provider</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Model Provider</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Model Name</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Model Type</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>License</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Pricing</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Last Updated</th>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>Rate Limits</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model, index) => {
                    // If provider and model_originator are same, show only provider
                    const modelProvider = normalizeOriginator(model.model_originator || model.provider || 'unknown');
                    const inferenceProvider = normalizeCompanyName(model.provider);
                    const displayModelProvider = (modelProvider === inferenceProvider) ? '' : modelProvider;
                    
                    return (
                      <tr key={index} className={`border-b ${
                        isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
                      } transition-colors`}>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{inferenceProvider}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{displayModelProvider}</td>
                        <td className={`py-3 px-4 text-sm font-medium ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>{model.model_name}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{formatTaskType(model.task_type)}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{model.license || 'N/A'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          model.pricing?.toLowerCase().includes('free') 
                            ? 'text-green-600 font-medium' 
                            : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{model.pricing || 'N/A'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{model.last_updated || model.updated_at || 'N/A'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{model.rate_limits || 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Status Notice */}
        <div className={`mt-6 p-3 rounded-lg ${
          isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'
        } border`}>
          <p className={`text-sm ${
            isDarkMode ? 'text-blue-200' : 'text-blue-800'
          }`}>
            ℹ️ <strong>Filter Applied:</strong> Only stable models from North American and European companies are displayed. 
            Beta, deprecated, and active status models are filtered out to ensure production-ready options.
          </p>
        </div>

        {/* Legal Disclaimer & Licensing - Footer */}
        <div className={`mt-8 pt-6 border-t rounded-lg p-4 ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-gray-300 bg-gray-50'
        }`}>
          <div className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <h4 className={`font-semibold mb-3 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Legal Disclaimer & Licensing</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p>
                  <strong>Educational Purpose:</strong> This dashboard is provided for educational and research purposes only. 
                  Model information is aggregated from publicly available APIs and sources.
                </p>
                <p>
                  <strong>Model Attribution:</strong> All model names, descriptions, and metadata remain property of their respective creators and providers. 
                  This project does not claim ownership of any listed models or their intellectual property.
                </p>
                <p>
                  <strong>Dashboard Attribution:</strong> If you use, reference, or derive from this dashboard, you must provide attribution: 
                  "Data visualization powered by AI Models Discovery Dashboard - Deployed on Vercel"
                </p>
              </div>
              <div className="space-y-2">
                <p>
                  <strong>Accuracy Disclaimer:</strong> While we strive for accuracy, model availability, pricing, and specifications may change. 
                  Users should verify current information directly with providers before making decisions.
                </p>
                <p>
                  <strong>No Warranty:</strong> This information is provided "as-is" without warranties of any kind. 
                  Use of this information is at your own risk.
                </p>
                <p className="font-medium">
                  © 2025 AI Models Discovery Dashboard - Licensed under MIT License for educational use only
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiModelsVisualization;