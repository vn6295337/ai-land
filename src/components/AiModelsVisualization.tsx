import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink, Filter, X, ChevronUp } from 'lucide-react';

const AiModelsVisualization = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState({
    inferenceProvider: new Set<string>(),
    modelProvider: new Set<string>(), 
    modelName: new Set<string>(),
    modelProviderCountry: new Set<string>(),
    officialUrl: new Set<string>(),
    inputModalities: new Set<string>(),
    outputModalities: new Set<string>(),
    license: new Set<string>(),
    rateLimits: new Set<string>(),
    apiAccess: new Set<string>()
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

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
      const inputModalities = model.input_modalities || 'Unknown';
      const outputModalities = model.output_modalities || 'Unknown';
      const license = model.license || 'N/A';
      const rateLimits = model.rate_limits || 'N/A';
      const apiAccess = model.provider_api_access || 'N/A';

      return (
        (columnKey === 'inferenceProvider' || columnFilters.inferenceProvider.size === 0 || columnFilters.inferenceProvider.has(inferenceProvider)) &&
        (columnKey === 'modelProvider' || columnFilters.modelProvider.size === 0 || columnFilters.modelProvider.has(modelProvider)) &&
        (columnKey === 'modelName' || columnFilters.modelName.size === 0 || columnFilters.modelName.has(modelName)) &&
        (columnKey === 'modelProviderCountry' || columnFilters.modelProviderCountry.size === 0 || columnFilters.modelProviderCountry.has(modelProviderCountry)) &&
        (columnKey === 'officialUrl' || columnFilters.officialUrl.size === 0 || columnFilters.officialUrl.has(officialUrl)) &&
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
        case 'officialUrl':
          value = model.official_url || 'N/A';
          break;
        case 'inputModalities':
          value = model.input_modalities || 'Unknown';
          break;
        case 'outputModalities':
          value = model.output_modalities || 'Unknown';
          break;
        case 'license':
          value = model.license || 'N/A';
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
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted models
  const getSortedModels = (modelsToSort: any[]) => {
    if (!sortConfig) return modelsToSort;

    return [...modelsToSort].sort((a, b) => {
      let aValue = '';
      let bValue = '';

      switch (sortConfig.key) {
        case 'inferenceProvider':
          aValue = a.inference_provider || '';
          bValue = b.inference_provider || '';
          break;
        case 'modelProvider':
          aValue = a.model_provider || '';
          bValue = b.model_provider || '';
          break;
        case 'modelName':
          aValue = a.human_readable_name || '';
          bValue = b.human_readable_name || '';
          break;
        case 'modelProviderCountry':
          aValue = a.model_provider_country || '';
          bValue = b.model_provider_country || '';
          break;
        case 'inputModalities':
          aValue = a.input_modalities || '';
          bValue = b.input_modalities || '';
          break;
        case 'outputModalities':
          aValue = a.output_modalities || '';
          bValue = b.output_modalities || '';
          break;
        case 'license':
          aValue = a.license || '';
          bValue = b.license || '';
          break;
        case 'rateLimits':
          aValue = a.rate_limits || '';
          bValue = b.rate_limits || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  // Filter models based on current filters
  const filteredModels = models.filter(model => {
    const inferenceProvider = model.inference_provider || 'Unknown';
    const modelProvider = model.model_provider || 'Unknown';
    const modelName = model.human_readable_name || 'Unknown';
    const modelProviderCountry = model.model_provider_country || 'Unknown';
    const officialUrl = model.official_url || 'N/A';
    const inputModalities = model.input_modalities || 'Unknown';
    const outputModalities = model.output_modalities || 'Unknown';
    const license = model.license || 'N/A';
    const rateLimits = model.rate_limits || 'N/A';
    const apiAccess = model.provider_api_access || 'N/A';

    return (
      (columnFilters.inferenceProvider.size === 0 || columnFilters.inferenceProvider.has(inferenceProvider)) &&
      (columnFilters.modelProvider.size === 0 || columnFilters.modelProvider.has(modelProvider)) &&
      (columnFilters.modelName.size === 0 || columnFilters.modelName.has(modelName)) &&
      (columnFilters.modelProviderCountry.size === 0 || columnFilters.modelProviderCountry.has(modelProviderCountry)) &&
      (columnFilters.officialUrl.size === 0 || columnFilters.officialUrl.has(officialUrl)) &&
      (columnFilters.inputModalities.size === 0 || columnFilters.inputModalities.has(inputModalities)) &&
      (columnFilters.outputModalities.size === 0 || columnFilters.outputModalities.has(outputModalities)) &&
      (columnFilters.license.size === 0 || columnFilters.license.has(license)) &&
      (columnFilters.rateLimits.size === 0 || columnFilters.rateLimits.has(rateLimits)) &&
      (columnFilters.apiAccess.size === 0 || columnFilters.apiAccess.has(apiAccess))
    );
  });

  // Apply sorting to filtered models
  const sortedAndFilteredModels = getSortedModels(filteredModels);

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

  // Select all filters for a column
  const selectAllColumnFilter = (columnKey: keyof typeof columnFilters) => {
    const allValues = getUniqueValues(columnKey);
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: new Set(allValues)
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
            <span className={`text-sm font-normal ml-2 px-2 py-1 rounded ${
              isDarkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-700'
            }`}>
              v2.1
            </span>
          </h1>
          <p className={`text-lg mt-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Interactive tracker of API-accessible and publicly available models
          </p>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-yellow-300' : 'text-orange-600'
          }`}>
            🔄 Update: Removed Together AI models - they now require paid credits
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
              <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className={`border-b ${
                    isDarkMode ? 'border-gray-600' : 'border-gray-300'
                  }`}>
                    <th className={`text-left py-3 px-4 font-semibold ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>#</th>
                    {[
                      { key: 'inferenceProvider', label: 'Inference Provider', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'modelProvider', label: 'Model Provider', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'modelName', label: 'Model Name', className: 'min-w-[200px] max-w-[300px]' },
                      { key: 'modelProviderCountry', label: 'Country of Origin', className: 'min-w-[120px] max-w-[150px]' },
                      { key: 'officialUrl', label: 'Official URL', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'inputModalities', label: 'Input Type', className: 'min-w-[100px] max-w-[130px]' },
                      { key: 'outputModalities', label: 'Output Type', className: 'min-w-[100px] max-w-[130px]' },
                      { key: 'license', label: 'License', className: 'min-w-[120px]' },
                      { key: 'rateLimits', label: 'Rate Limits', className: 'min-w-[180px] max-w-[250px]' },
                      { key: 'apiAccess', label: 'API Access', className: 'min-w-[100px] max-w-[120px]' }
                    ].map((column) => (
                      <th key={column.key} className={`text-left py-3 px-4 font-semibold ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-900'
                      } relative ${column.className || ''}`}>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleSort(column.key)}
                            className={`flex items-center space-x-1 hover:${
                              isDarkMode ? 'text-blue-400' : 'text-blue-600'
                            } transition-colors`}
                          >
                            <span>{column.label}</span>
                            {sortConfig?.key === column.key && (
                              sortConfig.direction === 'asc' 
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
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
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => selectAllColumnFilter(column.key as keyof typeof columnFilters)}
                                        className={`text-xs px-2 py-1 rounded ${
                                          isDarkMode 
                                            ? 'bg-green-600 hover:bg-green-500 text-white' 
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                      >
                                        Select All
                                      </button>
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
                  {sortedAndFilteredModels.map((model, index) => {
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
                        } min-w-[100px] max-w-[120px] truncate`}>{model.inference_provider || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        } min-w-[100px] max-w-[120px] truncate`}>{model.model_provider || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm font-medium ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        } min-w-[200px] max-w-[300px]`}>{model.human_readable_name || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        } min-w-[120px] max-w-[150px] truncate`}>{model.model_provider_country || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm min-w-[100px] max-w-[120px]">
                          {model.official_url && model.official_url.startsWith('http') ? (
                            <a 
                              href={model.official_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Visit Official Page"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors bg-green-600 hover:bg-green-700 text-white"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>{model.official_url || 'N/A'}</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        } min-w-[100px] max-w-[130px] truncate`}>{model.input_modalities || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        } min-w-[100px] max-w-[130px] truncate`}>{model.output_modalities || 'Unknown'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        } min-w-[120px] whitespace-nowrap`}>{model.license || 'N/A'}</td>
                        <td className={`py-3 px-4 text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        } min-w-[180px] max-w-[250px]`}>{model.rate_limits || 'N/A'}</td>
                        <td className="py-3 px-4 text-center min-w-[100px] max-w-[120px]">
                          {model.provider_api_access && model.provider_api_access.startsWith('http') ? (
                            <a 
                              href={model.provider_api_access}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Get API Key"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2m-2-2h.01M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </a>
                          ) : (
                            <span className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>{model.provider_api_access || 'N/A'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {sortedAndFilteredModels.length === 0 && models.length > 0 && (
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
                  ? 'bg-blue-900/50 border-blue-400 text-blue-200' 
                  : 'bg-blue-50 border-blue-500 text-blue-800'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm">
                    Showing {sortedAndFilteredModels.length} of {models.length} models with active filters
                  </span>
                  <button
                    onClick={() => setColumnFilters({
                      inferenceProvider: new Set<string>(),
                      modelProvider: new Set<string>(),
                      modelName: new Set<string>(),
                      modelProviderCountry: new Set<string>(),
                      officialUrl: new Set<string>(),
                      inputModalities: new Set<string>(),
                      outputModalities: new Set<string>(),
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
              Total Models: {sortedAndFilteredModels.length}
            </div>
          </div>
        </div>

        {/* License Explanations */}
        <div className={`mt-8 p-6 rounded-lg shadow-lg ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>License Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className={`font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>Open Source Licenses:</h4>
              <ul className={`space-y-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <li><strong>Apache 2.0:</strong> Permissive license allowing commercial use</li>
                <li><strong>MIT:</strong> Very permissive, allows almost unrestricted use</li>
                <li><strong>Llama:</strong> Meta's custom license for Llama models</li>
                <li><strong>Gemma:</strong> Google's custom license for Gemma models</li>
              </ul>
            </div>
            <div>
              <h4 className={`font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>Proprietary Licenses:</h4>
              <ul className={`space-y-1 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <li><strong>Google ToS:</strong> Subject to Google's Terms of Service</li>
                <li><strong>Proprietary:</strong> Custom licensing terms apply</li>
              </ul>
            </div>
          </div>
          <p className={`mt-4 text-sm font-medium ${
            isDarkMode ? 'text-blue-300' : 'text-blue-700'
          }`}>
            Note: You need to register with each provider and generate an API key to use these models.
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className={`mt-8 pt-6 border-t rounded-lg p-4 ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800/50' 
            : 'border-gray-300 bg-gray-50'
        }`}>
          <div className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <h4 className={`font-semibold mb-3 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Important Legal Disclaimer</h4>
            <div className="space-y-2">
              <p>
                <strong>For informational purposes only:</strong> This dashboard provides real-time information about AI models and their availability. 
                Model information is sourced from provider APIs and documentation. All data is provided "as-is" without warranties of any kind.
              </p>
              <p>
                <strong>No liability:</strong> We are not responsible for model accuracy, availability, pricing changes, rate limit modifications, 
                license changes, or any issues arising from using these models. Users must verify all information independently.
              </p>
              <p>
                <strong>Terms compliance:</strong> Users are responsible for complying with each provider's terms of service, usage policies, 
                and applicable laws. Some models may have restrictions on commercial use, data processing, or geographic availability.
              </p>
              <p>
                <strong>Rate limits:</strong> Displayed rate limits are for free tier usage and may change without notice. 
                Actual limits may vary based on account status, usage history, and provider policies.
              </p>
              <p>
                <strong>License verification:</strong> Always verify license terms directly with the model provider before use in production. 
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