import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink, Filter, X } from 'lucide-react';

const AiModelsVisualization = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState({
    inferenceProvider: new Set<string>(),
    modelProvider: new Set<string>(), 
    modelName: new Set<string>(),
    modelType: new Set<string>(),
    license: new Set<string>(),
    rateLimits: new Set<string>(),
    apiAccess: new Set<string>()
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Use shared Supabase client instance (with fallbacks for Lovable deployment)

  // Task types mapping with explanations
  const TASK_TYPE_MAPPING = {
    'others': 'embedding',
    'chat': 'conversational'
  };

  // Model name to readable interpretation mapping
  const MODEL_INTERPRETATIONS: Record<string, string> = {
    'gemma-3-27b-it': 'Google Gemma 3 (27B) Instruction-Tuned',
    'text-embedding-004': 'Google Text Embeddings v4',
    'gemini-1.5-flash-8b': 'Google Gemini 1.5 Flash (8B)',
    'gemini-1.5-flash': 'Google Gemini 1.5 Flash',
    'gemini-2.0-flash': 'Google Gemini 2.0 Flash',
    'gemini-2.5-pro': 'Google Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Google Gemini 2.5 Flash',
    'meta-llama/Llama-Vision-Free': 'Meta Llama Vision',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free': 'Meta Llama 3.3 (70B) Instruct Turbo',
    'microsoft/mai-ds-r1:free': 'Microsoft MAI Data Science R1',
    'cognitivecomputations/dolphin3.0-mistral-24b:free': 'Dolphin 3.0 (Mistral 24B)',
    'cognitivecomputations/dolphin3.0-r1-mistral-24b:free': 'Dolphin 3.0 R1 (Mistral 24B Enhanced)',
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': 'Dolphin Venice (Mistral 24B)',
    'nousresearch/deephermes-3-llama-3-8b-preview:free': 'DeepHermes 3 (Llama 3 8B Preview)',
    'nvidia/llama-3.1-nemotron-ultra-253b-v1:free': 'NVIDIA Nemotron Ultra (Llama 3.1 253B)',
    'meta-llama/llama-3.1-405b-instruct:free': 'Meta Llama 3.1 (405B) Instruct',
    'meta-llama/llama-3.2-11b-vision-instruct:free': 'Meta Llama 3.2 (11B) Vision-Instruct',
    'meta-llama/llama-3.2-3b-instruct:free': 'Meta Llama 3.2 (3B) Instruct',
    'meta-llama/llama-3.3-70b-instruct:free': 'Meta Llama 3.3 (70B) Instruct',
    'google/gemma-2-9b-it:free': 'Google Gemma 2 (9B) Instruction-Tuned',
    'google/gemini-2.0-flash-exp:free': 'Google Gemini 2.0 Flash Experimental',
    'google/gemma-3-27b-it:free': 'Google Gemma 3 (27B) Instruction-Tuned',
    'google/gemma-3-12b-it:free': 'Google Gemma 3 (12B) Instruction-Tuned',
    'google/gemma-3-4b-it:free': 'Google Gemma 3 (4B) Instruction-Tuned',
    'google/gemma-3n-e4b-it:free': 'Google Gemma 3n Enhanced (4B)',
    'google/gemma-3n-e2b-it:free': 'Google Gemma 3n Enhanced (2B)',
    'mistralai/mistral-7b-instruct:free': 'Mistral 7B Instruct',
    'mistralai/mistral-nemo:free': 'Mistral NeMo',
    'mistralai/mistral-small-24b-instruct-2501:free': 'Mistral Small 24B Instruct (v2501)',
    'mistralai/mistral-small-3.1-24b-instruct:free': 'Mistral Small 3.1 (24B) Instruct',
    'mistralai/devstral-small-2505:free': 'DevStral Small (v2505)',
    'mistralai/mistral-small-3.2-24b-instruct:free': 'Mistral Small 3.2 (24B) Instruct',
    'openai/gpt-oss-20b:free': 'OpenAI GPT-OSS (20B) Open-Weight'
  };

  const formatModelName = (modelName: string): string => {
    return MODEL_INTERPRETATIONS[modelName] || modelName;
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
 
      'google-bert': 'Google',
      'google-t5': 'Google',
      'openai': 'OpenAI',
      'microsoft': 'Microsoft',
      'anthropic': 'Anthropic',
      'cohere': 'Cohere',
      'together': 'Together AI',
      'openrouter': 'OpenRouter',
      'google': 'Google',
      'meta': 'Meta',
      'groq': 'Groq',
      'perplexity': 'Perplexity',
      'fireworks': 'Fireworks',
      'replicate': 'Replicate',
      'ai21': 'AI21',
      'anyscale': 'Anyscale'
    };
    
    return companyMapping[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1);
  };

  const normalizeOriginator = (originator: string): string => {
    return normalizeCompanyName(originator);
  };

  const formatLicense = (license: string, provider: string): string => {
    if (!license || license === 'N/A') return 'N/A';
    
    // Replace "Proprietary" with provider-specific names for Google models
    if (license.toLowerCase() === 'proprietary' && normalizeCompanyName(provider) === 'Google') {
      return 'Google';
    }
    
    return license;
  };

  const getApiAccessLink = (provider: string): string => {
    const apiLinks: Record<string, string> = {
      'OpenAI': 'https://platform.openai.com/api-keys',
      'Google': 'https://aistudio.google.com/apikey',
      'Anthropic': 'https://console.anthropic.com/settings/keys',
      'Cohere': 'https://dashboard.cohere.com/api-keys',
      'OpenRouter': 'https://openrouter.ai/settings/keys',
      'Together AI': 'https://api.together.ai/settings/api-keys',
      'Groq': 'https://console.groq.com/keys',
      'Perplexity': 'https://www.perplexity.ai/settings/api',
      'Fireworks': 'https://fireworks.ai/api-keys',
      'Replicate': 'https://replicate.com/account/api-tokens',
      'AI21': 'https://studio.ai21.com/account/api-key',
      'Anyscale': 'https://console.anyscale.com/credentials',
    };
    
    return apiLinks[provider] || 'https://openrouter.ai/settings/keys';
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

  // Get unique values for each column based on current filters (relational filtering)
  const getUniqueValues = (columnKey: keyof typeof columnFilters) => {
    const values = new Set<string>();
    
    // Get data that matches all OTHER filters (excluding the current column being filtered)
    const relevantData = models.filter(model => {
      const inferenceProvider = normalizeCompanyName(model.provider);
      const modelProvider = normalizeOriginator(model.model_originator || model.provider || 'unknown');
      const modelName = formatModelName(model.model_name);
      const modelType = formatTaskType(model.task_type);
      const license = formatLicense(model.license, model.provider);
      const rateLimits = model.rate_limits || 'N/A';

      // Exclude Hugging Face models from filter options (not free - requires credits)
      if (inferenceProvider === 'Hugging Face' || model.provider === 'huggingface') {
        return false;
      }

      // Exclude NVIDIA models from filter options (requires infrastructure/hardware)
      if (inferenceProvider === 'NVIDIA' || model.provider === 'nvidia') {
        return false;
      }

      // Exclude Mistral models from filter options (unclear free tier, requires billing)
      if (inferenceProvider === 'Mistral' || model.provider === 'mistral' || model.provider === 'mistralai') {
        return false;
      }

      // Exclude Together AI priced models from filter options
      if (inferenceProvider === 'Together AI' && model.pricing && model.pricing.includes('$')) {
        return false;
      }

      return (
        (columnKey === 'inferenceProvider' || columnFilters.inferenceProvider.size === 0 || columnFilters.inferenceProvider.has(inferenceProvider)) &&
        (columnKey === 'modelProvider' || columnFilters.modelProvider.size === 0 || columnFilters.modelProvider.has(modelProvider)) &&
        (columnKey === 'modelName' || columnFilters.modelName.size === 0 || columnFilters.modelName.has(modelName)) &&
        (columnKey === 'modelType' || columnFilters.modelType.size === 0 || columnFilters.modelType.has(modelType)) &&
        (columnKey === 'license' || columnFilters.license.size === 0 || columnFilters.license.has(license)) &&
        (columnKey === 'rateLimits' || columnFilters.rateLimits.size === 0 || columnFilters.rateLimits.has(rateLimits)) &&
        (columnKey === 'apiAccess' || columnFilters.apiAccess.size === 0 || columnFilters.apiAccess.has(getApiAccessLink(inferenceProvider)))
      );
    });

    relevantData.forEach(model => {
      let value = '';
      switch(columnKey) {
        case 'inferenceProvider':
          value = normalizeCompanyName(model.provider);
          break;
        case 'modelProvider':
          value = normalizeOriginator(model.model_originator || model.provider || 'unknown');
          break;
        case 'modelName':
          value = formatModelName(model.model_name);
          break;
        case 'modelType':
          value = formatTaskType(model.task_type);
          break;
        case 'license':
          value = formatLicense(model.license, model.provider);
          break;
        case 'rateLimits':
          value = model.rate_limits || 'N/A';
          break;
        case 'apiAccess':
          value = getApiAccessLink(normalizeCompanyName(model.provider));
          break;
      }
      values.add(value);
    });
    return Array.from(values).sort();
  };

  // Filter models - exclude non-free providers and priced models
  const filteredModels = models.filter(model => {
    const inferenceProvider = normalizeCompanyName(model.provider);
    const modelProvider = normalizeOriginator(model.model_originator || model.provider || 'unknown');
    const modelName = formatModelName(model.model_name);
    const modelType = formatTaskType(model.task_type);
    const license = formatLicense(model.license, model.provider);
    const rateLimits = model.rate_limits || 'N/A';

    // Exclude Hugging Face models (not free - requires credits)
    if (inferenceProvider === 'Hugging Face' || model.provider === 'huggingface') {
      return false;
    }

    // Exclude NVIDIA models (requires infrastructure/hardware)
    if (inferenceProvider === 'NVIDIA' || model.provider === 'nvidia') {
      return false;
    }

    // Exclude Mistral models (unclear free tier, requires billing)
    if (inferenceProvider === 'Mistral' || model.provider === 'mistral' || model.provider === 'mistralai') {
      return false;
    }

    // Exclude Together AI priced models
    if (inferenceProvider === 'Together AI' && model.pricing && model.pricing.includes('$')) {
      return false;
    }

    return (
      (columnFilters.inferenceProvider.size === 0 || columnFilters.inferenceProvider.has(inferenceProvider)) &&
      (columnFilters.modelProvider.size === 0 || columnFilters.modelProvider.has(modelProvider)) &&
      (columnFilters.modelName.size === 0 || columnFilters.modelName.has(modelName)) &&
      (columnFilters.modelType.size === 0 || columnFilters.modelType.has(modelType)) &&
      (columnFilters.license.size === 0 || columnFilters.license.has(license)) &&
      (columnFilters.rateLimits.size === 0 || columnFilters.rateLimits.has(rateLimits)) &&
      (columnFilters.apiAccess.size === 0 || columnFilters.apiAccess.has(getApiAccessLink(inferenceProvider)))
    );
  });

  // Toggle filter value
  const toggleFilterValue = (columnKey: keyof typeof columnFilters, value: string) => {
    setColumnFilters(prev => {
      const newSet = new Set(prev[columnKey]);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return { ...prev, [columnKey]: newSet };
    });
  };

  // Clear all filters for a column
  const clearColumnFilter = (columnKey: keyof typeof columnFilters) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: new Set<string>()
    }));
  };

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

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown') && !target.closest('.filter-button')) {
        setOpenFilter(null);
      }
    };

    if (openFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openFilter]);



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
    <div className={`min-h-screen py-4 ${
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
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={`border-b ${
                    isDarkMode ? 'border-gray-600' : 'border-gray-300'
                  }`}>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      #
                    </th>
                    {[
                      { key: 'inferenceProvider', label: 'Inference Provider' },
                      { key: 'modelProvider', label: 'Model Provider' },
                      { key: 'modelName', label: 'Model Name' },
                      { key: 'modelType', label: 'Model Type' },
                      { key: 'license', label: 'License' },
                      { key: 'rateLimits', label: 'Rate Limits' },
                      { key: 'apiAccess', label: 'API Access' }
                    ].map((column) => (
                      <th key={column.key} className={`text-left py-3 px-4 font-semibold relative ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span>{column.label}</span>
                          <div className="relative">
                            <button
                              onClick={() => setOpenFilter(openFilter === column.key ? null : column.key)}
                              className={`filter-button ml-2 p-1 rounded hover:bg-opacity-20 ${
                                columnFilters[column.key as keyof typeof columnFilters].size > 0
                                  ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                              }`}
                            >
                              <Filter className="w-4 h-4" />
                            </button>
                            
                            {openFilter === column.key && (
                              <div className={`filter-dropdown absolute top-full ${
                                ['inferenceProvider', 'modelProvider'].includes(column.key) ? 'left-0' : 'right-0'
                              } ${column.key === 'apiAccess' ? 'right-0' : ''} mt-1 w-64 max-h-80 overflow-y-auto ${
                                isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                              } border rounded-lg shadow-lg z-50`}>
                                <div className="p-2">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className={`text-sm font-medium ${
                                      isDarkMode ? 'text-gray-200' : 'text-gray-800'
                                    }`}>Filter {column.label}</span>
                                    <button
                                      onClick={() => clearColumnFilter(column.key as keyof typeof columnFilters)}
                                      className={`text-xs px-2 py-1 rounded ${
                                        isDarkMode 
                                          ? 'bg-red-600 hover:bg-red-500 text-white' 
                                          : 'bg-red-600 hover:bg-red-700 text-white'
                                      }`}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    {getUniqueValues(column.key as keyof typeof columnFilters).map((value) => (
                                      <label key={value} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[column.key as keyof typeof columnFilters].has(value)}
                                          onChange={() => toggleFilterValue(column.key as keyof typeof columnFilters, value)}
                                          className="w-4 h-4"
                                        />
                                        <span className={`text-sm truncate ${
                                          isDarkMode ? 'text-gray-200' : 'text-gray-800'
                                        }`} title={value}>
                                          {value}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model, index) => {
                    const modelProvider = normalizeOriginator(model.model_originator || model.provider || 'unknown');
                    const inferenceProvider = normalizeCompanyName(model.provider);
                    
                    return (
                      <tr key={index} className={`border-b ${
                        isDarkMode ? 'border-gray-700' : 'border-gray-200'
                      } ${index % 2 === 0 
                        ? (isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50/50')
                        : (isDarkMode ? 'bg-gray-900/30' : 'bg-white')
                      } hover:${
                        isDarkMode ? 'bg-gray-700' : 'bg-blue-50'
                      } transition-colors`}>
                        <td className={`py-3 px-4 text-sm font-mono ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>{index + 1}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{inferenceProvider}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{modelProvider}</td>
                        <td className={`py-3 px-4 text-sm font-medium ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>{formatModelName(model.model_name)}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{formatTaskType(model.task_type)}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{formatLicense(model.license, model.provider)}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>{model.rate_limits || 'N/A'}</td>
                        <td className={`py-3 px-4 text-center`}>
                          <a 
                            href={getApiAccessLink(inferenceProvider)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Get API Key"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                              isDarkMode 
                                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2m-2-2h.01M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredModels.length === 0 && models.length > 0 && (
                <div className={`flex items-center justify-center py-12 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <div className="text-center">
                    <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No models match the current filters</p>
                    <p className="text-sm mt-2">Try adjusting or clearing some filters to see results</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Filter summary */}
            {Object.values(columnFilters).some(set => set.size > 0) && (
              <div className={`mt-4 p-3 rounded-lg border-l-4 ${
                isDarkMode 
                  ? 'bg-blue-900 border-blue-500 text-blue-200' 
                  : 'bg-blue-50 border-blue-500 text-blue-800'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    Showing {filteredModels.length} of {models.length} models with active filters
                  </span>
                  <button
                    onClick={() => setColumnFilters({
                      inferenceProvider: new Set<string>(),
                      modelProvider: new Set<string>(),
                      modelName: new Set<string>(),
                      modelType: new Set<string>(),
                      license: new Set<string>(),
                      rateLimits: new Set<string>(),
                      apiAccess: new Set<string>()
                    })}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      isDarkMode 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
            
            {/* Model Count */}
            <div className={`mt-4 text-center text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Total Models: {filteredModels.length}
            </div>

            {/* License Explanations */}
            <div className={`mt-6 p-4 rounded-lg ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <h4 className={`font-semibold mb-3 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>📄 License Types Explained</h4>
              <div className="grid lg:grid-cols-2 gap-3 text-sm">
                <div>
                  <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" 
                     className={`font-semibold underline hover:no-underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
                    MIT:
                  </a>
                  <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Permissive license allowing commercial use with attribution
                  </span>
                </div>
                <div>
                  <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer"
                     className={`font-semibold underline hover:no-underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
                    Apache-2.0:
                  </a>
                  <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Commercial-friendly with patent protection
                  </span>
                </div>
                <div>
                  <a href="https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE" target="_blank" rel="noopener noreferrer"
                     className={`font-semibold underline hover:no-underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
                    Llama 3.1/3.2/3.3:
                  </a>
                  <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Custom license permitting commercial use under certain conditions
                  </span>
                </div>
                <div>
                  <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>Google Gemini:</strong>
                  <a href="https://developers.google.com/terms" target="_blank" rel="noopener noreferrer"
                     className={`ml-2 underline hover:no-underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
                    Google API Terms
                  </a>
                  <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    - Google's developer terms for AI services
                  </span>
                </div>
                <div>
                  <strong className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>Google Gemma:</strong>
                  <a href="https://ai.google.dev/gemma/terms" target="_blank" rel="noopener noreferrer"
                     className={`ml-2 underline hover:no-underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
                    Gemma Terms
                  </a>
                  <span className={`ml-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    - Commercial use allowed with distribution restrictions
                  </span>
                </div>
              </div>
              
              {/* Caveats */}
              <div className={`mt-4 p-3 rounded-lg border-l-4 ${
                isDarkMode 
                  ? 'bg-orange-900 border-orange-500 text-orange-200' 
                  : 'bg-orange-50 border-orange-500 text-orange-800'
              }`}>
                <p className="text-sm">
                  <strong>⚠️ Important:</strong> All free models come with usage restrictions such as rate limits, 
                  daily quotas, or require API keys. Always verify current terms with providers before production use.
                </p>
              </div>
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
            ℹ️ <strong>Filters Applied:</strong> Only truly free, hosted API models from North American and European companies are displayed. 
            Excluded: Beta/deprecated models, services requiring infrastructure/hardware, and credit-based APIs.
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