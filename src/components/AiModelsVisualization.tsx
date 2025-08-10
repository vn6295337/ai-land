import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { createClient } from '@supabase/supabase-js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AiModelsVisualization = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [detailedBreakdown, setDetailedBreakdown] = useState<any>(null);

  // Initialize Supabase client with correct environment variables
  const supabase = createClient(
    "https://atilxlecbaqcksnrgzav.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0aWx4bGVjYmFxY2tzbnJnemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzOTY5MTYsImV4cCI6MjA2Nzk3MjkxNn0.sYRFyQIEzZMlgg5RtHTXDSpvxl-KrJ8E7U3_UroIJog"
  );

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
      const allData = [];
      const limit = 1000;
      let offset = 0;

      while (true) {
        const response = await supabase
          .from('ai_models_discovery')
          .select('*')
          .order('discovery_timestamp', { ascending: false })
          .range(offset, offset + limit - 1);

        if (response.error) {
          throw response.error;
        }

        const data = response.data;
        if (!data || data.length === 0) break;

        allData.push(...data);
        offset += limit;

        if (data.length < limit) break;
      }

      return allData;
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
      taskTypeTotals
    };
  };

  const createChartData = (processedData: any) => {
    const { grouped, sortedProviders, sortedTaskTypes, providerTotals } = processedData;

    const datasets = sortedTaskTypes.map((taskType, index) => ({
      label: taskType,
      data: sortedProviders.map(provider => grouped[provider][taskType] || 0),
      backgroundColor: COLORS[index % COLORS.length],
      borderColor: 'white',
      borderWidth: 0.5,
    }));

    return {
      labels: sortedProviders,
      datasets,
      providerTotals: sortedProviders.map(provider => providerTotals[provider])
    };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const rawData = await fetchModelData();
        const processedData = processData(rawData);
        const chartConfig = createChartData(processedData);
        
        setChartData(chartConfig);

        // Set summary statistics
        setSummaryStats({
          totalProviders: processedData.sortedProviders.length,
          totalTaskTypes: processedData.sortedTaskTypes.length,
          totalModels: Object.values(processedData.providerTotals).reduce((sum: number, count: number) => sum + count, 0),
          topProviders: Object.entries(processedData.providerTotals)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 5)
        });

        // Set detailed breakdown
        setDetailedBreakdown({
          providerBreakdown: processedData.grouped,
          sortedProviders: processedData.sortedProviders,
          sortedTaskTypes: processedData.sortedTaskTypes,
          taskTypeTotals: processedData.taskTypeTotals
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'AI Models by Provider and Task Type',
        font: {
          size: 16,
          weight: 'bold' as const
        },
        padding: 20
      },
      legend: {
        position: 'right' as const,
        title: {
          display: true,
          text: 'Task Types',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          afterTitle: function(tooltipItems) {
            const providerIndex = tooltipItems[0].dataIndex;
            const total = chartData?.providerTotals[providerIndex] || 0;
            return `Total: ${total} models`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 10
          }
        }
      },
      y: {
        stacked: true,
        grid: {
          display: true
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading AI models data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">No data available</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Free & Open AI Models
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Interactive tracker of API-accessible and publicly available AI tools
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {/* Chart Container */}
          <div className="bg-white p-4 rounded-lg shadow-lg h-80">
            <div className="h-full">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Summary Statistics */}
          {summaryStats && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-bold mb-4">📊 Summary Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{summaryStats.totalProviders}</div>
                  <div className="text-sm text-gray-600">Total Providers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{summaryStats.totalTaskTypes}</div>
                  <div className="text-sm text-gray-600">Task Types</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{summaryStats.totalModels}</div>
                  <div className="text-sm text-gray-600">Total Models</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Top 5 Providers by Model Count:</h4>
                <ul className="space-y-1">
                    {summaryStats.topProviders.map(([provider, count]: [string, number]) => (
                      <li key={provider} className="flex justify-between">
                        <span>{provider}:</span>
                        <span className="font-semibold">{count as number} models</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}

          {/* Detailed Breakdown */}
          {detailedBreakdown && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-bold mb-4">📋 Detailed Breakdown by Provider and Task Type</h3>
              
              {/* Provider breakdown table */}
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full table-auto border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-4 py-2 text-left">Provider</th>
                       {detailedBreakdown.sortedTaskTypes.map((taskType: string) => (
                         <th key={taskType} className="border px-2 py-2 text-center text-xs">
                           {taskType}
                         </th>
                       ))}
                      <th className="border px-4 py-2 text-center font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedBreakdown.sortedProviders.map((provider: string) => {
                      const providerData = detailedBreakdown.providerBreakdown[provider];
                      const total = Object.values(providerData).reduce((sum: number, count: number) => sum + count, 0);
                      
                      return (
                        <tr key={provider} className="hover:bg-gray-50">
                          <td className="border px-4 py-2 font-semibold">{provider}</td>
                         {detailedBreakdown.sortedTaskTypes.map((taskType: string) => (
                           <td key={taskType} className="border px-2 py-2 text-center">
                             {providerData[taskType] || 0}
                           </td>
                         ))}
                          <td className="border px-4 py-2 text-center font-bold">{total as number}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Task type totals */}
              <div>
                <h4 className="font-semibold mb-2">🎯 Task Type Totals:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(detailedBreakdown.taskTypeTotals)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([taskType, count]: [string, number]) => (
                      <div key={taskType} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                        <span className="text-sm">{taskType}:</span>
                        <span className="font-semibold text-sm">{count} models</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiModelsVisualization;