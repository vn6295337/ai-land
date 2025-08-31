import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
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

  // Storage key for historical data
  const STORAGE_KEY = 'modelCountHistory';
  const MAX_DATA_POINTS = 1000;

  // Initialize historical data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setHistoricalData(parsed);
      } catch (error) {
        console.error('Error parsing stored historical data:', error);
      }
    }
  }, []);

  // Save historical data to localStorage
  const saveToStorage = (data: HistoricalDataPoint[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving historical data:', error);
    }
  };

  // Track new data points when currentModels changes
  useEffect(() => {
    if (currentModels.length > 0) {
      const now = new Date();
      
      // Calculate provider counts
      const inferenceProviders: { [key: string]: number } = {};
      const modelProviders: { [key: string]: number } = {};
      
      currentModels.forEach(model => {
        const inferenceProvider = model.inference_provider || 'Unknown';
        const modelProvider = model.model_provider || 'Unknown';
        
        inferenceProviders[inferenceProvider] = (inferenceProviders[inferenceProvider] || 0) + 1;
        modelProviders[modelProvider] = (modelProviders[modelProvider] || 0) + 1;
      });

      const newDataPoint: HistoricalDataPoint = {
        timestamp: now,
        totalCount: currentModels.length,
        providerCounts: {
          inferenceProviders,
          modelProviders
        }
      };

      // Check if this is a new data point (avoid duplicates within 1 minute)
      const isNewDataPoint = historicalData.length === 0 || 
        now.getTime() - historicalData[historicalData.length - 1].timestamp.getTime() > 60000;

      if (isNewDataPoint) {
        const updatedData = [...historicalData, newDataPoint];
        // Keep only the last MAX_DATA_POINTS
        const trimmedData = updatedData.slice(-MAX_DATA_POINTS);
        setHistoricalData(trimmedData);
        saveToStorage(trimmedData);
      }
    }
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

  // Filter data based on time range
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

    return historicalData.filter(point => point.timestamp >= cutoffTime);
  }, [historicalData, timeRange]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const datasets = [];
    const colors = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'
    ];

    // Total count line (always shown)
    datasets.push({
      label: 'Total Models',
      data: filteredData.map(point => ({
        x: point.timestamp,
        y: point.totalCount
      })),
      borderColor: colors[0],
      backgroundColor: colors[0] + '20',
      tension: 0.1,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2
    });

    let colorIndex = 1;

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
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 1.5,
        borderDash: [5, 5]
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
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 1.5,
        borderDash: [2, 2]
      });
      colorIndex++;
    });

    return { datasets };
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
        borderWidth: 1
      }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            hour: 'MMM dd HH:mm',
            day: 'MMM dd',
            week: 'MMM dd',
            month: 'MMM yyyy'
          }
        },
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: darkMode ? '#9ca3af' : '#6b7280'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: darkMode ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: darkMode ? '#9ca3af' : '#6b7280',
          precision: 0
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
  const clearData = () => {
    setHistoricalData([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Export data
  const exportData = () => {
    const dataStr = JSON.stringify(historicalData, null, 2);
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
          <div className="h-96">
            <Line data={chartData} options={chartOptions} />
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