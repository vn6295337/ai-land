import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { supabase } from '@/integrations/supabase/client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ChevronDown, ChevronUp, Download, Trash2, Calendar } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface HistoricalDataPoint {
  id?: number;
  timestamp: Date;
  totalCount: number;
  providerCounts: {
    inferenceProviders: { [key: string]: number };
    modelProviders: { [key: string]: number };
  };
}

interface ModelCountLineGraphProps {
  currentModels: any[];
  darkMode: boolean;
}

const ModelCountLineGraph: React.FC<ModelCountLineGraphProps> = ({ currentModels, darkMode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [selectedInferenceProviders, setSelectedInferenceProviders] = useState<Set<string>>(new Set());
  const [selectedModelProviders, setSelectedModelProviders] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  // No longer using localStorage - data persisted in database

  // Load historical data from database
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const { data, error } = await supabase
          .from('analytics_history')
          .select('*')
          .order('timestamp', { ascending: true });

        if (error) {
          console.error('Error loading historical data:', error);
          return;
        }

        const formattedData: HistoricalDataPoint[] = (data || []).map((item: any) => ({
          id: item.id,
          timestamp: new Date(item.timestamp),
          totalCount: item.total_models,
          providerCounts: {
            inferenceProviders: item.inference_provider_counts,
            modelProviders: item.model_provider_counts
          }
        }));

        setHistoricalData(formattedData);
      } catch (error) {
        console.error('Error loading historical data:', error);
      }
    };

    loadHistoricalData();
  }, []);

  // Save analytics snapshot to database
  const saveAnalyticsSnapshot = async (
    totalModels: number,
    inferenceProviders: { [key: string]: number },
    modelProviders: { [key: string]: number }
  ) => {
    try {
      const { error } = await supabase.rpc('insert_analytics_snapshot', {
        p_total_models: totalModels,
        p_inference_provider_counts: inferenceProviders,
        p_model_provider_counts: modelProviders
      });

      if (error) {
        console.error('Error saving analytics snapshot:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error saving analytics snapshot:', error);
      return false;
    }
  };

  // Track analytics snapshots - save once per day (last update of the day)
  useEffect(() => {
    const collectAnalyticsData = async () => {
      if (currentModels.length === 0) return;

      // Calculate provider counts
      const inferenceProviders: { [key: string]: number } = {};
      const modelProviders: { [key: string]: number } = {};
      
      currentModels.forEach(model => {
        const inferenceProvider = model.inference_provider || 'Unknown';
        const modelProvider = model.model_provider || 'Unknown';
        
        inferenceProviders[inferenceProvider] = (inferenceProviders[inferenceProvider] || 0) + 1;
        modelProviders[modelProvider] = (modelProviders[modelProvider] || 0) + 1;
      });

      // Always save - will overwrite existing data for the current day
      console.log('Saving daily analytics snapshot:', {
        totalModels: currentModels.length,
        inferenceProviderCount: Object.keys(inferenceProviders).length,
        modelProviderCount: Object.keys(modelProviders).length
      });
      
      const success = await saveAnalyticsSnapshot(
        currentModels.length,
        inferenceProviders,
        modelProviders
      );

      if (success) {
        // Reload historical data to get the latest entry
        const { data, error } = await supabase
          .from('analytics_history')
          .select('*')
          .order('timestamp', { ascending: true });

        if (!error && data) {
          const formattedData: HistoricalDataPoint[] = data.map((item: any) => ({
            id: item.id,
            timestamp: new Date(item.timestamp),
            totalCount: item.total_models,
            providerCounts: {
              inferenceProviders: item.inference_provider_counts,
              modelProviders: item.model_provider_counts
            }
          }));
          setHistoricalData(formattedData);
        }
      }
    };

    collectAnalyticsData();
  }, [currentModels]);

  // Get unique providers from historical data
  const availableProviders = useMemo(() => {
    const inferenceProviders = new Set<string>();
    const modelProviders = new Set<string>();

    historicalData.forEach(point => {
      Object.keys(point.providerCounts.inferenceProviders).forEach(provider => {
        inferenceProviders.add(provider);
      });
      Object.keys(point.providerCounts.modelProviders).forEach(provider => {
        modelProviders.add(provider);
      });
    });

    return {
      inferenceProviders: Array.from(inferenceProviders).sort(),
      modelProviders: Array.from(modelProviders).sort()
    };
  }, [historicalData]);

  // Filter data based on time range and get only last entry per day
  const filteredData = useMemo(() => {
    if (historicalData.length === 0) return [];

    const now = new Date();
    const cutoffTime = (() => {
      switch (timeRange) {
        case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case 'all': return new Date(0);
        default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    })();

    // Filter by time range first
    const timeFiltered = historicalData.filter(point => point.timestamp >= cutoffTime);
    
    // Group by date (YYYY-MM-DD) and get the latest entry per day
    const dailyData = new Map<string, HistoricalDataPoint>();
    
    timeFiltered.forEach(point => {
      const dateKey = point.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = dailyData.get(dateKey);
      
      // Keep the latest timestamp for each day
      if (!existing || point.timestamp > existing.timestamp) {
        dailyData.set(dateKey, point);
      }
    });
    
    // Convert back to array and sort by date
    const result = Array.from(dailyData.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    console.log(`Time range: ${timeRange}, Total points: ${historicalData.length}, Daily points: ${result.length}`);
    
    return result;
  }, [historicalData, timeRange]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const datasets = [];
    const colors = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'
    ];

    // Total count line (only shown when no providers are selected)
    const showTotalLine = selectedInferenceProviders.size === 0 && selectedModelProviders.size === 0;
    
    if (showTotalLine) {
      datasets.push({
        label: 'Total Models',
        data: filteredData.map(point => ({
          x: point.timestamp,
          y: point.totalCount
        })),
        borderColor: colors[0],
        backgroundColor: colors[0] + '20',
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 8,
        borderWidth: 2,
        pointBackgroundColor: colors[0],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1
      });
    }

    let colorIndex = showTotalLine ? 1 : 0;

    // Add selected inference provider lines
    selectedInferenceProviders.forEach(provider => {
      datasets.push({
        label: `${provider} (Inference)`,
        data: filteredData.map(point => ({
          x: point.timestamp,
          y: point.providerCounts.inferenceProviders[provider] || 0
        })),
        borderColor: colors[colorIndex % colors.length],
        backgroundColor: colors[colorIndex % colors.length] + '20',
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: [5, 5],
        pointBackgroundColor: colors[colorIndex % colors.length],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1
      });
      colorIndex++;
    });

    // Add selected model provider lines
    selectedModelProviders.forEach(provider => {
      datasets.push({
        label: `${provider} (Model)`,
        data: filteredData.map(point => ({
          x: point.timestamp,
          y: point.providerCounts.modelProviders[provider] || 0
        })),
        borderColor: colors[colorIndex % colors.length],
        backgroundColor: colors[colorIndex % colors.length] + '20',
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: [2, 2],
        pointBackgroundColor: colors[colorIndex % colors.length],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1
      });
      colorIndex++;
    });

    return { datasets };
  }, [filteredData, selectedInferenceProviders, selectedModelProviders]);

  // Calculate dynamic y-axis range for better visibility of small changes
  const yAxisConfig = useMemo(() => {
    if (filteredData.length === 0) return { min: 0, max: 100, stepSize: 10 };
    
    // Determine which values to consider based on what's being displayed
    const showTotalLine = selectedInferenceProviders.size === 0 && selectedModelProviders.size === 0;
    
    const allValues = filteredData.flatMap(point => [
      ...(showTotalLine ? [point.totalCount] : []),
      ...selectedInferenceProviders.size > 0 
        ? Array.from(selectedInferenceProviders).map(provider => 
            point.providerCounts.inferenceProviders[provider] || 0
          ) 
        : [],
      ...selectedModelProviders.size > 0 
        ? Array.from(selectedModelProviders).map(provider => 
            point.providerCounts.modelProviders[provider] || 0
          ) 
        : []
    ]);
    
    if (allValues.length === 0) return { min: 0, max: 100, stepSize: 10 };
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    
    // If range is very small, add padding to make changes visible
    const padding = range < 5 ? Math.max(2, Math.ceil(range * 0.5)) : Math.ceil(range * 0.1);
    
    const adjustedMin = Math.max(0, minValue - padding);
    const adjustedMax = maxValue + padding;
    const adjustedRange = adjustedMax - adjustedMin;
    
    // Calculate dynamic step size based on the range
    let stepSize;
    if (adjustedRange <= 10) {
      stepSize = 1;
    } else if (adjustedRange <= 50) {
      stepSize = Math.max(1, Math.ceil(adjustedRange / 10));
    } else if (adjustedRange <= 100) {
      stepSize = Math.max(5, Math.ceil(adjustedRange / 15));
    } else {
      stepSize = Math.max(10, Math.ceil(adjustedRange / 10));
    }
    
    return {
      min: adjustedMin,
      max: adjustedMax,
      stepSize: stepSize
    };
  }, [filteredData, selectedInferenceProviders, selectedModelProviders]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: darkMode ? '#e5e7eb' : '#374151',
          font: { size: 12 }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: darkMode ? '#1f2937' : '#ffffff',
        titleColor: darkMode ? '#e5e7eb' : '#374151',
        bodyColor: darkMode ? '#d1d5db' : '#6b7280',
        borderColor: darkMode ? '#374151' : '#d1d5db',
        borderWidth: 1,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          title: (context: any) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleDateString('en-GB', {
              timeZone: 'UTC',
              year: 'numeric',
              month: 'short', 
              day: '2-digit'
            }).replace(/ /g, '-');
          },
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y} models`;
          }
        }
      },
      // Note: Data labels would require chartjs-plugin-datalabels
      // For now, values are shown in tooltips on hover
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'day',
          displayFormats: {
            day: 'DD-MMM-YYYY'
          }
        },
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: darkMode ? '#9ca3af' : '#6b7280',
          callback: function(value: any) {
            const date = new Date(value);
            return date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }).replace(/ /g, '-');
          }
        }
      },
      y: {
        min: yAxisConfig.min,
        max: yAxisConfig.max,
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: darkMode ? '#9ca3af' : '#6b7280',
          precision: 0,
          stepSize: yAxisConfig.stepSize
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  // Toggle provider selection
  const toggleProvider = (provider: string, type: 'inference' | 'model') => {
    if (type === 'inference') {
      const newSet = new Set(selectedInferenceProviders);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      setSelectedInferenceProviders(newSet);
    } else {
      const newSet = new Set(selectedModelProviders);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      setSelectedModelProviders(newSet);
    }
  };



  // Clear historical data
  const clearData = async () => {
    try {
      const { error } = await supabase
        .from('analytics_history')
        .delete()
        .neq('id', 0); // Delete all records
      
      if (error) {
        console.error('Error clearing analytics data:', error);
      } else {
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('Error clearing analytics data:', error);
    }
  };

  // Export data
  const exportData = () => {
    const exportableData = historicalData.map(point => ({
      timestamp: point.timestamp.toISOString(),
      totalCount: point.totalCount,
      providerCounts: point.providerCounts
    }));
    const dataStr = JSON.stringify(exportableData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `model-count-history-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (historicalData.length === 0) {
    return (
      <div className={`p-6 rounded-lg shadow-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Model Count Tracker
        </h2>
        <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No historical data available yet.</p>
          <p className="text-sm mt-2">Data will be collected every 5 minutes when the table refreshes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg shadow-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex items-center space-x-2 text-lg font-semibold ${darkMode ? 'text-white hover:text-gray-300' : 'text-gray-900 hover:text-gray-700'}`}
        >
          {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          <span>Model Count Tracker</span>
          <span className={`text-sm font-normal ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            ({historicalData.length} data points)
          </span>
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportData}
            className={`p-2 rounded-md transition-colors ${
              darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Export Data"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearData}
            className={`p-2 rounded-md transition-colors ${
              darkMode ? 'hover:bg-red-700 text-red-400' : 'hover:bg-red-100 text-red-600'
            }`}
            title="Clear All Data"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Controls */}
          <div className="mb-6 space-y-4">
            {/* Time Range Selector */}
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Time Range:
              </span>
              <div className="flex space-x-2">
                {[
                  { value: '24h', label: '24 Hours' },
                  { value: '7d', label: '7 Days' },
                  { value: '30d', label: '30 Days' },
                  { value: 'all', label: 'All Time' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimeRange(option.value as any)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      timeRange === option.value
                        ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                        : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inference Providers */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Inference Providers (Dashed Lines)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableProviders.inferenceProviders.map(provider => (
                    <button
                      key={provider}
                      onClick={() => toggleProvider(provider, 'inference')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        selectedInferenceProviders.has(provider)
                          ? 'bg-blue-600 text-white'
                          : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Providers */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Model Providers (Dotted Lines)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableProviders.modelProviders.map(provider => (
                    <button
                      key={provider}
                      onClick={() => toggleProvider(provider, 'model')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        selectedModelProviders.has(provider)
                          ? 'bg-green-600 text-white'
                          : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-96 relative">
            <Line data={chartData} options={chartOptions} />
            {selectedInferenceProviders.size === 0 && selectedModelProviders.size === 0 && (
              <div className={`absolute top-4 right-4 px-3 py-2 rounded-md text-xs ${
                darkMode ? 'bg-blue-900/30 text-blue-200 border border-blue-600/30' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                💡 Select providers below to compare their model counts
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {currentModels.length}
              </div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Current Total
              </div>
            </div>
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {filteredData.length}
              </div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Data Points
              </div>
            </div>
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {filteredData.length > 0 ? Math.max(...filteredData.map(d => d.totalCount)) : 0}
              </div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Peak Count
              </div>
            </div>
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {filteredData.length > 1 
                  ? ((filteredData[filteredData.length - 1].totalCount - filteredData[0].totalCount) >= 0 ? '+' : '') +
                    (filteredData[filteredData.length - 1].totalCount - filteredData[0].totalCount)
                  : '0'}
              </div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Net Change
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ModelCountLineGraph;