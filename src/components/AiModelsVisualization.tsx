import React, { useState, useEffect } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight } from 'lucide-react';

const AiModelsVisualization = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [detailedBreakdown, setDetailedBreakdown] = useState<any>(null);
  const [expandedTaskTypes, setExpandedTaskTypes] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Use shared Supabase client instance (with fallbacks for Lovable deployment)

  // Task types mapping - same as Python version
  const OTHER_TASK_TYPES_MAPPING = {
    'image': 'others',
    'moderation': 'others',
    'audio': 'others',
    'embedding': 'others',
    'rerank': 'others',
    'language': 'others',
    'transcribe': 'others',
    'asr': 'Automatic Speech Recognition',
    'tts': 'Text-to-Speech',
    'chat': 'Conversational Chat'
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

  const processData = (rawData: any[]) => {
    // Apply task type mapping
    const processedData = rawData.map(item => ({
      ...item,
      task_type: OTHER_TASK_TYPES_MAPPING[item.task_type as keyof typeof OTHER_TASK_TYPES_MAPPING] || item.task_type
    }));

    // Group by provider and task_type
    const grouped: Record<string, Record<string, number>> = {};
    processedData.forEach(item => {
      const { provider, task_type } = item;
      if (!grouped[provider]) grouped[provider] = {};
      if (!grouped[provider][task_type]) grouped[provider][task_type] = 0;
      grouped[provider][task_type]++;
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
      modelsByTaskType
    };
  };

  const createTreemapData = (processedData: any) => {
    const { grouped, sortedProviders, sortedTaskTypes, providerTotals, taskTypeTotals } = processedData;

    // Create consistent color mapping for all task types using the same colors
    const colorMapping: Record<string, string> = {};
    sortedTaskTypes.forEach((taskType: string, index: number) => {
      colorMapping[taskType] = COLORS[index % COLORS.length];
    });

    // Create treemap data structure
    const treemapData = sortedProviders.map((provider: string, providerIndex: number) => {
      const providerData = grouped[provider];
      const total = providerTotals[provider];
      
      // Get task types for this provider and sort by count
      const taskTypes = Object.entries(providerData)
        .filter(([_, count]) => (count as number) > 0)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([taskType, count]) => ({
          name: taskType,
          size: count as number,
          fill: colorMapping[taskType] || COLORS[0],
          taskType: taskType
        }));

      return {
        name: provider,
        size: total,
        children: taskTypes,
        fill: COLORS[providerIndex % COLORS.length],
        total: total
      };
    });

    return {
      data: treemapData,
      colorMapping,
      providerTotals,
      taskTypeTotals
    };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const rawData = await fetchModelData();
        console.log('Raw data length:', rawData.length);
        
        const processedData = processData(rawData);
        console.log('Processed data:', processedData);
        
        const treemapConfig = createTreemapData(processedData);
        console.log('Treemap config:', treemapConfig);
        
        setChartData(treemapConfig);

        // Set summary statistics
        setSummaryStats({
          totalProviders: processedData.sortedProviders.length,
          totalTaskTypes: processedData.sortedTaskTypes.length,
          totalModels: Object.values(processedData.providerTotals).reduce((sum: number, count: number) => sum + count, 0)
        });

        // Set detailed breakdown
        setDetailedBreakdown({
          providerBreakdown: processedData.grouped,
          sortedProviders: processedData.sortedProviders,
          sortedTaskTypes: processedData.sortedTaskTypes,
          taskTypeTotals: processedData.taskTypeTotals,
          modelsByTaskType: processedData.modelsByTaskType
        });

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

  const toggleTaskType = (taskType: string) => {
    const newExpanded = new Set(expandedTaskTypes);
    if (newExpanded.has(taskType)) {
      newExpanded.delete(taskType);
    } else {
      newExpanded.add(taskType);
    }
    setExpandedTaskTypes(newExpanded);
  };

  // Custom treemap cell component
  const CustomTreemapCell = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors } = props;
    
    if (depth === 1) {
      // Provider level - show provider name and total
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            style={{
              fill: payload.fill,
              stroke: isDarkMode ? '#374151' : '#FFFFFF',
              strokeWidth: 2,
              strokeOpacity: 1
            }}
          />
          <text
            x={x + width / 2}
            y={y + height / 2 - 10}
            textAnchor="middle"
            fill={isDarkMode ? '#F9FAFB' : '#000000'}
            fontSize="14"
            fontWeight="bold"
          >
            {payload.name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill={isDarkMode ? '#E5E7EB' : '#374151'}
            fontSize="12"
          >
            {payload.total} models
          </text>
        </g>
      );
    }
    
    if (depth === 2) {
      // Task type level - show task type and count
      const showText = width > 60 && height > 30; // Only show text if cell is large enough
      
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            style={{
              fill: payload.fill,
              stroke: isDarkMode ? '#374151' : '#FFFFFF',
              strokeWidth: 1,
              fillOpacity: 0.8
            }}
          />
          {showText && (
            <>
              <text
                x={x + width / 2}
                y={y + height / 2 - 5}
                textAnchor="middle"
                fill={isDarkMode ? '#F9FAFB' : '#000000'}
                fontSize="10"
                fontWeight="600"
              >
                {payload.name}
              </text>
              <text
                x={x + width / 2}
                y={y + height / 2 + 8}
                textAnchor="middle"
                fill={isDarkMode ? '#E5E7EB' : '#374151'}
                fontSize="9"
              >
                {payload.size}
              </text>
            </>
          )}
        </g>
      );
    }
    
    return null;
  };

  // Custom tooltip for treemap
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      
      return (
        <div className={`p-3 rounded-lg shadow-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-600 text-gray-100' 
            : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className="font-semibold">{data.name}</div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {data.size} models
            {data.taskType && ` • ${data.taskType}`}
          </div>
        </div>
      );
    }
    return null;
  };

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

  if (!chartData) {
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
            Free & Open AI Models
          </h1>
          <p className={`text-lg mt-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Interactive tracker of API-accessible and publicly available LLMs/SLMs
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {/* Treemap Container */}
          <div className={`p-4 rounded-lg shadow-lg h-96 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={chartData?.data || []}
                  dataKey="size"
                  aspectRatio={4/3}
                  stroke={isDarkMode ? '#374151' : '#FFFFFF'}
                  strokeWidth={2}
                  content={<CustomTreemapCell />}
                >
                  <Tooltip content={<CustomTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
            
            {/* Legend for Task Types */}
            {chartData?.colorMapping && (
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Task Types:
                </div>
                {Object.entries(chartData.colorMapping).map(([taskType, color]) => (
                  <div key={taskType} className="flex items-center gap-1">
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: color }}
                    />
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {taskType}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Last Updated */}
            <p className={`text-xs mt-3 text-center ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Last updated: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC • Auto-refreshes every 5 minutes
            </p>
          </div>

          {/* Summary Statistics */}
          {summaryStats && (
            <div className={`p-6 rounded-lg shadow-lg ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>📊 Summary Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>{summaryStats.totalProviders}</div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>Total Providers</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`}>{summaryStats.totalTaskTypes}</div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>Task Types</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-600'
                  }`}>{summaryStats.totalModels}</div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>Total Models</div>
                </div>
              </div>
              
            </div>
          )}

          {/* Detailed Breakdown */}
          {detailedBreakdown && (
            <div className={`p-6 rounded-lg shadow-lg ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-bold mb-4 ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>📋 Detailed Breakdown by Provider and Task Type</h3>
              
              {/* Provider breakdown table */}
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full table-auto border-collapse">
                  <thead>
                    <tr className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                      <th className={`border px-4 py-2 text-left ${
                        isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-900'
                      }`}>Provider</th>
                       {detailedBreakdown.sortedTaskTypes.map((taskType: string) => (
                         <th key={taskType} className={`border px-2 py-2 text-center text-xs ${
                           isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-900'
                         }`}>
                           {taskType}
                         </th>
                       ))}
                      <th className={`border px-4 py-2 text-center font-bold ${
                        isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-900'
                      }`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedBreakdown.sortedProviders.map((provider: string) => {
                      const providerData = detailedBreakdown.providerBreakdown[provider];
                      const total = Object.values(providerData).reduce((sum: number, count: number) => sum + count, 0);
                      
                      return (
                        <tr key={provider} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                          <td className={`border px-4 py-2 font-semibold ${
                            isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-900'
                          }`}>{provider}</td>
                         {detailedBreakdown.sortedTaskTypes.map((taskType: string) => (
                           <td key={taskType} className={`border px-2 py-2 text-center ${
                             isDarkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'
                           }`}>
                             {providerData[taskType] || 0}
                           </td>
                         ))}
                          <td className={`border px-4 py-2 text-center font-bold ${
                            isDarkMode ? 'border-gray-600 text-gray-200' : 'border-gray-300 text-gray-900'
                          }`}>{total as number}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Task type totals with dropdown */}
              <div>
                <h4 className={`font-semibold mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>🎯 Task Type Totals:</h4>
                <div className="space-y-2">
                  {Object.entries(detailedBreakdown.taskTypeTotals)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([taskType, count]: [string, number]) => {
                      const isExpanded = expandedTaskTypes.has(taskType);
                      const models = detailedBreakdown.modelsByTaskType[taskType] || [];
                      
                      return (
                        <div key={taskType} className={`rounded ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                        }`}>
                          <div 
                            className={`flex justify-between items-center px-3 py-2 cursor-pointer rounded ${
                              isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => toggleTaskType(taskType)}
                          >
                            <div className="flex items-center gap-2">
                              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                              <span className={`text-sm font-medium ${
                                isDarkMode ? 'text-gray-200' : 'text-gray-900'
                              }`}>{taskType}:</span>
                            </div>
                            <span className={`font-semibold text-sm ${
                              isDarkMode ? 'text-gray-200' : 'text-gray-900'
                            }`}>{count} models</span>
                          </div>
                          
                          {isExpanded && (
                            <div className="px-6 pb-3">
                              <div className="max-h-40 overflow-y-auto">
                                <div className={`grid grid-cols-12 gap-2 text-xs font-medium mb-2 px-1 ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  <div className="col-span-5">Model Name</div>
                                  <div className="col-span-2">Provider</div>
                                  <div className="col-span-2">Status</div>
                                  <div className="col-span-3">Originator</div>
                                </div>
                                <div className="space-y-1">
                                  {models.map((model, index) => {
                                    const originator = model.model_name?.includes('/') 
                                      ? model.model_name.split('/')[0] 
                                      : model.provider || 'unknown';
                                    
                                    return (
                                      <div key={index} className={`text-xs grid grid-cols-12 gap-2 py-1 ${
                                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                      }`}>
                                        <span className="col-span-5 truncate">{model.model_name}</span>
                                        <span className={`col-span-2 font-medium ${
                                          isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                        }`}>{model.provider}</span>
                                        <div className="col-span-2 flex items-center gap-1">
                                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                          <span className={`font-medium ${
                                            isDarkMode ? 'text-green-400' : 'text-green-700'
                                          }`}>{model.status || 'stable'}</span>
                                        </div>
                                        <span className={`col-span-3 font-medium truncate ${
                                          isDarkMode ? 'text-purple-400' : 'text-purple-600'
                                        }`}>{originator}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
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