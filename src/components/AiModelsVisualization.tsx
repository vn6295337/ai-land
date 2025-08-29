import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink, Filter, X, Moon, Sun, ChevronUp } from 'lucide-react';

const AiModelsVisualization = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [darkMode, setDarkMode] = useState(true);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [columnFilters, setColumnFilters] = useState({
    inferenceProvider: new Set<string>(),
    modelProvider: new Set<string>(), 
    modelName: new Set<string>(),
    modelProviderCountry: new Set<string>(),
    inputModalities: new Set<string>(),
    outputModalities: new Set<string>(),
    license: new Set<string>(),
    rateLimits: new Set<string>(),
    apiAccess: new Set<string>()
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const fetchModelData = async () => {
    try {
      console.log('Fetching model data from ai_models_main...');
      const response = await supabase
        .from('ai_models_main')
        .select('*')
        .order('id', { ascending: true });

      console.log('Supabase response:', response);

      if (response.error) {
        console.error('Supabase error:', response.error);
        throw new Error(`Supabase error: ${response.error.message}`);
      }

      if (!response.data || response.data.length === 0) {
        console.warn('No data returned from Supabase');
        throw new Error('No data available from ai_models_main table');
      }

      console.log(`Successfully fetched ${response.data.length} records`);
      console.log('Sample record:', response.data[0]);
      console.log('Sample record fields:', Object.keys(response.data[0]));
      return response.data;
    } catch (err) {
      console.error('Error fetching data:', err);
      throw err;
    }
  };

  const [models, setModels] = useState<any[]>([]);

  // Get unique values for each column based on current filters (relational filtering)
  const getUniqueValues = (columnKey: keyof typeof columnFilters) => {
    const values = new Set<string>();
    
    // Get data that matches all OTHER filters (excluding the current column being filtered)
    const relevantData = models.filter(model => {
      const inferenceProvider = model.inference_provider || 'Unknown';
      const modelProvider = model.model_provider || 'Unknown';
      const modelName = model.human_readable_name || 'Unknown';
      const modelProviderCountry = model.model_provider_country || 'Unknown';
      const officialUrl = model.official_url || 'N/A';
      const inputModalities = standardizeModalities(model.input_modalities);
      const outputModalities = standardizeModalities(model.output_modalities);
      const license = model.license_name || 'N/A';
      const rateLimits = model.rate_limits || 'N/A';
      const apiAccess = model.provider_api_access || 'N/A';

      return (
        (columnKey === 'inferenceProvider' || columnFilters.inferenceProvider.size === 0 || columnFilters.inferenceProvider.has(inferenceProvider)) &&
        (columnKey === 'modelProvider' || columnFilters.modelProvider.size === 0 || columnFilters.modelProvider.has(modelProvider)) &&
        (columnKey === 'modelName' || columnFilters.modelName.size === 0 || columnFilters.modelName.has(modelName)) &&
        (columnKey === 'modelProviderCountry' || columnFilters.modelProviderCountry.size === 0 || columnFilters.modelProviderCountry.has(modelProviderCountry)) &&
        (columnKey === 'inputModalities' || columnFilters.inputModalities.size === 0 || columnFilters.inputModalities.has(inputModalities)) &&
        (columnKey === 'outputModalities' || columnFilters.outputModalities.size === 0 || columnFilters.outputModalities.has(outputModalities)) &&
        (columnKey === 'license' || columnFilters.license.size === 0 || columnFilters.license.has(license)) &&
        (columnKey === 'rateLimits' || columnFilters.rateLimits.size === 0 || columnFilters.rateLimits.has(rateLimits)) &&
        (columnKey === 'apiAccess' || columnFilters.apiAccess.size === 0 || columnFilters.apiAccess.has(apiAccess))
      );
    });

    relevantData.forEach(model => {
      let value = '';
      switch(columnKey) {
        case 'inferenceProvider':
          value = model.inference_provider || 'Unknown';
          break;
        case 'modelProvider':
          value = model.model_provider || 'Unknown';
          break;
        case 'modelName':
          value = model.human_readable_name || 'Unknown';
          break;
        case 'modelProviderCountry':
          value = model.model_provider_country || 'Unknown';
          break;
        case 'inputModalities':
          value = standardizeModalities(model.input_modalities);
          break;
        case 'outputModalities':
          value = standardizeModalities(model.output_modalities);
          break;
        case 'license':
          value = model.license_name || 'N/A';
          break;
        case 'rateLimits':
          value = model.rate_limits || 'N/A';
          break;
        case 'apiAccess':
          value = model.provider_api_access || 'N/A';
          break;
      }
      values.add(value);
    });
    return Array.from(values).sort();
  };

  // Sort function
  const handleSort = (columnKey: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === columnKey && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnKey, direction });
  };

  // Get sortable value for a model based on column key
  const getSortValue = (model: any, columnKey: string) => {
    switch(columnKey) {
      case 'inferenceProvider': return model.inference_provider || 'Unknown';
      case 'modelProvider': return model.model_provider || 'Unknown';
      case 'modelName': return model.human_readable_name || 'Unknown';
      case 'modelProviderCountry': return model.model_provider_country || 'Unknown';
      case 'inputModalities': return standardizeModalities(model.input_modalities);
      case 'outputModalities': return standardizeModalities(model.output_modalities);
      case 'license': return model.license_name || 'N/A';
      case 'rateLimits': return model.rate_limits || 'N/A';
      case 'apiAccess': return model.provider_api_access || 'N/A';
      default: return '';
    }
  };

  // Filter models based on current filters
  const filteredModels = models.filter(model => {
    const inferenceProvider = model.inference_provider || 'Unknown';
    const modelProvider = model.model_provider || 'Unknown';
    const modelName = model.human_readable_name || 'Unknown';
    const modelProviderCountry = model.model_provider_country || 'Unknown';
    const inputModalities = standardizeModalities(model.input_modalities);
    const outputModalities = standardizeModalities(model.output_modalities);
    const license = model.license_name || 'N/A';
    const rateLimits = model.rate_limits || 'N/A';
    const apiAccess = model.provider_api_access || 'N/A';

    // Filter out Dolphin models from Cognitive Computations
    if (modelProvider === 'Cognitive Computations' && modelName.toLowerCase().includes('dolphin')) {
      return false;
    }

    return (
      (columnFilters.inferenceProvider.size === 0 || columnFilters.inferenceProvider.has(inferenceProvider)) &&
      (columnFilters.modelProvider.size === 0 || columnFilters.modelProvider.has(modelProvider)) &&
      (columnFilters.modelName.size === 0 || columnFilters.modelName.has(modelName)) &&
      (columnFilters.modelProviderCountry.size === 0 || columnFilters.modelProviderCountry.has(modelProviderCountry)) &&
      (columnFilters.inputModalities.size === 0 || columnFilters.inputModalities.has(inputModalities)) &&
      (columnFilters.outputModalities.size === 0 || columnFilters.outputModalities.has(outputModalities)) &&
      (columnFilters.license.size === 0 || columnFilters.license.has(license)) &&
      (columnFilters.rateLimits.size === 0 || columnFilters.rateLimits.has(rateLimits)) &&
      (columnFilters.apiAccess.size === 0 || columnFilters.apiAccess.has(apiAccess))
    );
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    
    const aValue = getSortValue(a, sortConfig.key);
    const bValue = getSortValue(b, sortConfig.key);
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
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
        setModels(rawData);
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

  // Standardize input/output modality formatting
  const standardizeModalities = (modalities: string | null | undefined): string => {
    if (!modalities || modalities === 'Unknown') return 'Unknown';
    
    // Split by common separators and normalize
    const parts = modalities
      .split(/[,&]+/)
      .map(part => part.trim())
      .map(part => {
        // Capitalize first letter and make rest lowercase
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .filter(part => part.length > 0);
    
    // Remove duplicates and sort
    const uniqueParts = Array.from(new Set(parts)).sort();
    
    // Join with comma and space
    return uniqueParts.join(', ');
  };

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
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-lg ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Loading AI models data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!loading && models.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>No data available</div>
      </div>
    );
  }

  // Complex license mapping removed - now using database fields directly

  // Update official URL for Kimi/Moonshot models
  const getOfficialUrl = (model: any) => {
    const modelName = model.human_readable_name || '';
    if (modelName.includes('Moonshot') || modelName.includes('Kimi')) {
      return 'https://www.moonshot.ai/';
    }
    return model.official_url;
  };

  return (
    <div className={`min-h-screen py-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-4 relative">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`absolute right-0 top-0 p-2 rounded-lg ${
              darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100'
            } transition-colors`}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Free AI Models Tracker <span className="text-lg font-normal">beta</span>
          </h1>
          <p className={`text-sm mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Listed models are free to use with free inferencing and API accessible for commercial purposes<a href="#legal-disclaimer" className={`${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>*</a>
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {/* Model Count Row */}
          <div className={`text-sm text-center ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
            <p className="mt-1">
              Total: {filteredModels.length} models | By inference provider: {(() => {
                const providerCounts = filteredModels.reduce((acc: {[key: string]: number}, model) => {
                  const provider = model.inference_provider || 'Unknown';
                  acc[provider] = (acc[provider] || 0) + 1;
                  return acc;
                }, {});
                return Object.entries(providerCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([provider, count]) => `${provider}: ${count}`)
                  .join(', ');
              })()} | Top model providers: {(() => {
                const modelProviderCounts = filteredModels.reduce((acc: {[key: string]: number}, model) => {
                  const provider = model.model_provider || 'Unknown';
                  acc[provider] = (acc[provider] || 0) + 1;
                  return acc;
                }, {});
                return Object.entries(modelProviderCounts)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 3)
                  .map(([provider, count]) => `${provider}: ${count}`)
                  .join(', ');
              })()} 
            </p>
          </div>

          {/* Last Updated Row */}
          <div className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p className="mt-2">
              Last updated: August 28, 2025
            </p>
          </div>

          {/* Clear Filters Button */}
          {Object.values(columnFilters).some(set => set.size > 0) && (
            <div className="flex justify-center">
              <button
                onClick={() => setColumnFilters({
                  inferenceProvider: new Set<string>(),
                  modelProvider: new Set<string>(),
                  modelName: new Set<string>(),
                  modelProviderCountry: new Set<string>(),
                  inputModalities: new Set<string>(),
                  outputModalities: new Set<string>(),
                  license: new Set<string>(),
                  rateLimits: new Set<string>(),
                  apiAccess: new Set<string>()
                })}
                className={`px-4 py-2 rounded-md transition-colors font-medium ${
                  darkMode 
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Clear All Filters
              </button>
            </div>
          )}

          {/* Simple Structured Table */}
          <div className={`p-6 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                    <th className={`text-left py-3 px-4 font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>#</th>
                    {[
                      { key: 'inferenceProvider', label: 'Inference Provider', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'modelProvider', label: 'Model Provider', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'modelName', label: 'Model Name', className: 'min-w-[200px] max-w-[300px]' },
                      { key: 'modelProviderCountry', label: 'Country of Origin', className: 'min-w-[120px] max-w-[150px]' },
                      { key: 'inputModalities', label: 'Input Type', className: 'min-w-[100px] max-w-[130px]' },
                      { key: 'outputModalities', label: 'Output Type', className: 'min-w-[100px] max-w-[130px]' },
                      { key: 'license', label: 'License', className: 'min-w-[80px] max-w-[100px]' },
                      { key: 'rateLimits', label: 'Rate Limits', className: 'min-w-[180px] max-w-[250px]' },
                      { key: 'apiAccess', label: 'API Access', className: 'min-w-[100px] max-w-[120px]' }
                    ].map((column) => (
                      <th key={column.key} className={`text-left py-3 px-4 font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} relative ${column.className || ''}`}>
                        <div className="flex items-center justify-between">
                          <button 
                            onClick={() => handleSort(column.key)}
                            className={`flex items-center space-x-1 hover:${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                          >
                            <span>{column.label}</span>
                            {sortConfig?.key === column.key && (
                              sortConfig.direction === 'asc' ? 
                                <ChevronUp className="w-4 h-4" /> : 
                                <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenFilter(openFilter === column.key ? null : column.key)}
                              className={`filter-button ml-2 p-1 rounded hover:bg-opacity-20 ${
                                columnFilters[column.key as keyof typeof columnFilters].size > 0
                                  ? 'text-blue-600'
                                  : darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              <Filter className="w-4 h-4" />
                            </button>
                            
                            {openFilter === column.key && (
                              <div className={`filter-dropdown absolute top-full ${
                                ['inferenceProvider', 'modelProvider'].includes(column.key) ? 'left-0' : 'right-0'
                              } ${column.key === 'apiAccess' ? 'right-0' : ''} mt-1 w-64 max-h-80 overflow-y-auto ${
                                darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                              } border rounded-lg shadow-lg z-50`}>
                                <div className="p-2">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Filter {column.label}</span>
                                    <button
                                      onClick={() => clearColumnFilter(column.key as keyof typeof columnFilters)}
                                      className={`text-xs px-2 py-1 rounded ${
                                        darkMode 
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
                                        <span className={`text-sm truncate ${darkMode ? 'text-gray-300' : 'text-gray-800'}`} title={value}>
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
                    return (
                      <tr key={index} className={`border-b ${darkMode ? 'border-gray-600' : 'border-gray-200'} ${index % 2 === 0 
                        ? darkMode ? 'bg-gray-800/50' : 'bg-gray-50/50'
                        : darkMode ? 'bg-gray-900' : 'bg-white'
                      } ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'} transition-colors`}>
                        <td className={`py-3 px-4 text-sm font-mono ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{index + 1}</td>
                        <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} min-w-[100px] max-w-[120px] truncate`}>{model.inference_provider || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm min-w-[100px] max-w-[120px] truncate`}>
                          {(() => {
                            const officialUrl = getOfficialUrl(model);
                            const providerName = model.model_provider || 'Unknown';
                            return officialUrl && officialUrl.startsWith('http') ? (
                              <a 
                                href={officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} hover:underline`}
                              >
                                {providerName}
                              </a>
                            ) : (
                              <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{providerName}</span>
                            );
                          })()} 
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'} min-w-[200px] max-w-[300px]`}>{model.human_readable_name || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} min-w-[120px] max-w-[150px] truncate`}>{model.model_provider_country || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} min-w-[100px] max-w-[130px] truncate`}>{standardizeModalities(model.input_modalities)}</td>
                        <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} min-w-[100px] max-w-[130px] truncate`}>{standardizeModalities(model.output_modalities)}</td>
                        <td className="py-3 px-4 text-sm min-w-[80px] max-w-[100px]">
                          <div className="text-center">
                            {/* Top line: Info text with URL */}
                            {model.license_info_text && (
                              model.license_info_url ? (
                                <a
                                  href={model.license_info_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} hover:underline block`}
                                >
                                  {model.license_info_text}
                                </a>
                              ) : (
                                <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} block`}>{model.license_info_text}</span>
                              )
                            )}
                            {/* Bottom line: License name with URL */}
                            {model.license_name && (
                              model.license_url ? (
                                <a
                                  href={model.license_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} hover:underline block`}
                                >
                                  {model.license_name}
                                </a>
                              ) : (
                                <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} block`}>{model.license_name}</span>
                              )
                            )}
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} min-w-[180px] max-w-[250px]`}>{model.rate_limits || 'N/A'}</td>
                        <td className="py-3 px-4 text-center min-w-[100px] max-w-[120px]">
                          {model.provider_api_access && model.provider_api_access.startsWith('http') ? (
                            <a 
                              href={model.provider_api_access}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Get API Key"
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                darkMode 
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2m-2-2h.01M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </a>
                          ) : (
                            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{model.provider_api_access || 'N/A'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredModels.length === 0 && models.length > 0 && (
                <div className="flex items-center justify-center py-12 text-gray-600">
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
              <div className="mt-4 p-3 rounded-lg border-l-4 bg-blue-50 border-blue-500 text-blue-800">
                <span className="text-sm">
                  Showing {filteredModels.length} of {models.length} models with active filters
                </span>
              </div>
            )}
            
            {/* Model Count */}
            <div className="mt-4 text-center text-sm text-gray-600">
              Total Models: {filteredModels.length}
            </div>
          </div>
        </div>

        {/* Version Notice */}
        <div className={`mt-6 p-4 rounded-lg border ${
          darkMode 
            ? 'bg-blue-900/20 border-blue-600' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <p className={`text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
            <strong>beta:</strong> Expanded to include additional Google models. Removed Groq preview models.
            <br/>
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div id="legal-disclaimer" className={`mt-8 pt-6 border-t rounded-lg p-4 ${
          darkMode 
            ? 'border-gray-600 bg-gray-800' 
            : 'border-gray-300 bg-gray-50'
        }`}>
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <h4 className={`font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Important Legal Disclaimer</h4>
            <div className="space-y-2">
              <p>
                <strong>For informational purposes only:</strong> This dashboard provides real-time information about AI models and their
                availability.
                Model information is sourced from provider APIs and documentation. All data is provided "as-is" without warranties of any
                kind.
              </p>
              <p>
                <strong>No liability:</strong> We are not responsible for model accuracy, availability, pricing changes, rate limit
                modifications,
                license changes, or any issues arising from using these models. Users must verify all information independently.
              </p>
              <p>
                <strong>Terms compliance:</strong> Users are responsible for complying with each provider's terms of service, usage
                policies,
                and applicable laws. Some models may have restrictions on commercial use, data processing, or geographic availability.
              </p>
              <p>
                <strong>Rate limits:</strong> Displayed rate limits are for free tier usage and may change without notice.
                Actual limits may vary based on account status, usage history, and provider policies.
              </p>
              <p>
                <strong>License verification:</strong> Always verify license terms directly with the model provider before use in
                production.
                License information displayed is for reference only and may not reflect the most current terms.
              </p>
            </div>
            <p className="font-medium mt-4">
              © 2025 Free AI Models Tracker - Interactive API-accessible model discovery platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiModelsVisualization;