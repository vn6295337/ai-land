import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, ExternalLink, Filter, X } from 'lucide-react';

const AiModelsCommitVisualization = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
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

    // Filter out Dolphin models from Cognitive Computations
    if (modelProvider === 'Cognitive Computations' && modelName.toLowerCase().includes('dolphin')) {
      return false;
    }

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-900">Loading AI models commit data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!loading && models.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">No data available</div>
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
    <div className="min-h-screen py-4 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            AI Models Commit Dashboard (Test) v2.2
          </h1>
          <p className="text-lg mt-2 text-gray-600">
            Test version using ai_models_commit table data
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {/* Last Updated */}
          <p className="text-xs text-center text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC • Auto-refreshes every 5 minutes
          </p>

          {/* Clear Filters Button */}
          {Object.values(columnFilters).some(set => set.size > 0) && (
            <div className="flex justify-center">
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
                className="px-4 py-2 rounded-md transition-colors bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}

          {/* Simple Structured Table */}
          <div className="p-6 rounded-lg shadow-lg bg-white">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">#</th>
                    {[
                      { key: 'inferenceProvider', label: 'Inference Provider', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'modelProvider', label: 'Model Provider', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'modelName', label: 'Model Name', className: 'min-w-[200px] max-w-[300px]' },
                      { key: 'modelProviderCountry', label: 'Country of Origin', className: 'min-w-[120px] max-w-[150px]' },
                      { key: 'officialUrl', label: 'Official URL', className: 'min-w-[100px] max-w-[120px]' },
                      { key: 'inputModalities', label: 'Input Type', className: 'min-w-[100px] max-w-[130px]' },
                      { key: 'outputModalities', label: 'Output Type', className: 'min-w-[100px] max-w-[130px]' },
                      { key: 'license', label: 'License', className: 'min-w-[80px] max-w-[100px]' },
                      { key: 'rateLimits', label: 'Rate Limits', className: 'min-w-[180px] max-w-[250px]' },
                      { key: 'apiAccess', label: 'API Access', className: 'min-w-[100px] max-w-[120px]' }
                    ].map((column) => (
                      <th key={column.key} className={`text-left py-3 px-4 font-semibold text-gray-900 relative ${column.className || ''}`}>
                        <div className="flex items-center justify-between">
                          <span>{column.label}</span>
                          <div className="relative">
                            <button
                              onClick={() => setOpenFilter(openFilter === column.key ? null : column.key)}
                              className={`filter-button ml-2 p-1 rounded hover:bg-opacity-20 ${
                                columnFilters[column.key as keyof typeof columnFilters].size > 0
                                  ? 'text-blue-600'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              <Filter className="w-4 h-4" />
                            </button>
                            
                            {openFilter === column.key && (
                              <div className={`filter-dropdown absolute top-full ${
                                ['inferenceProvider', 'modelProvider'].includes(column.key) ? 'left-0' : 'right-0'
                              } ${column.key === 'apiAccess' ? 'right-0' : ''} mt-1 w-64 max-h-80 overflow-y-auto bg-white border-gray-300 border rounded-lg shadow-lg z-50`}>
                                <div className="p-2">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-800">Filter {column.label}</span>
                                    <button
                                      onClick={() => clearColumnFilter(column.key as keyof typeof columnFilters)}
                                      className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
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
                                        <span className="text-sm truncate text-gray-800" title={value}>
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
                      <tr key={index} className={`border-b border-gray-200 ${index % 2 === 0 
                        ? 'bg-gray-50/50'
                        : 'bg-white'
                      } hover:bg-blue-50 transition-colors`}>
                        <td className="py-3 px-4 text-sm font-mono text-gray-500">{index + 1}</td>
                        <td className="py-3 px-4 text-sm text-gray-700 min-w-[100px] max-w-[120px] truncate">{model.inference_provider || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm text-gray-700 min-w-[100px] max-w-[120px] truncate">{model.model_provider || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900 min-w-[200px] max-w-[300px]">{model.human_readable_name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm text-gray-700 min-w-[120px] max-w-[150px] truncate">{model.model_provider_country || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm min-w-[100px] max-w-[120px]">
                          {(() => {
                            const officialUrl = getOfficialUrl(model);
                            return officialUrl && officialUrl.startsWith('http') ? (
                              <a 
                                href={officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Visit Official Page"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors bg-green-600 hover:bg-green-700 text-white"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-sm text-gray-500">{officialUrl || 'N/A'}</span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 min-w-[100px] max-w-[130px] truncate">{model.input_modalities || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm text-gray-700 min-w-[100px] max-w-[130px] truncate">{model.output_modalities || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm min-w-[80px] max-w-[100px]">
                          <div className="text-center">
                            {/* Top line: Info text with URL */}
                            {model.license_info_text && (
                              model.license_info_url ? (
                                <a
                                  href={model.license_info_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline block"
                                >
                                  {model.license_info_text}
                                </a>
                              ) : (
                                <span className="text-gray-700 block">{model.license_info_text}</span>
                              )
                            )}
                            {/* Bottom line: License name with URL */}
                            {model.license_name && (
                              model.license_url ? (
                                <a
                                  href={model.license_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline block"
                                >
                                  {model.license_name}
                                </a>
                              ) : (
                                <span className="text-gray-700 block">{model.license_name}</span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 min-w-[180px] max-w-[250px]">{model.rate_limits || 'N/A'}</td>
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
                            <span className="text-sm text-gray-500">{model.provider_api_access || 'N/A'}</span>
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

        {/* Test Notice */}
        <div className="mt-6 p-3 rounded-lg bg-yellow-50 border-yellow-200 border">
          <p className="text-sm text-yellow-800">
            🧪 <strong>Test Dashboard v2.3:</strong> Enhanced license display with structured hyperlinks. 
            Data includes {models.length} models from ai_models_main table with database-first architecture. 
            🔗 <strong>New:</strong> Two-line license cells with clickable info and license links - no more complex frontend mapping.
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-8 pt-6 border-t rounded-lg p-4 border-gray-300 bg-gray-50">
          <div className="text-xs text-gray-500">
            <h4 className="font-semibold mb-3 text-gray-700">Legal Disclaimer & Testing</h4>
            <p>
              <strong>Test Environment:</strong> This dashboard is provided for testing the ai_models_commit table integration. 
              Model information is sourced from the cleaned and optimized dataset. Use for testing purposes only.
            </p>
            <p className="font-medium mt-2">
              © 2025 AI Models Discovery Dashboard - v2.3 Enhanced License Display
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiModelsCommitVisualization;