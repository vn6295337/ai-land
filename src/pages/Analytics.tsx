import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import ModelCountLineGraph from '@/components/ModelCountLineGraph';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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

      console.log(`Successfully fetched ${response.data.length} records for analytics`);
      return response.data;
    } catch (err) {
      console.error('Error fetching data:', err);
      throw err;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const rawData = await fetchModelData();
        console.log('Analytics raw data length:', rawData.length);
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

    // Set up auto-refresh every 5 minutes (same as main dashboard)
    const interval = setInterval(loadData, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-lg ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Loading analytics data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Link 
            to="/" 
            className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
              darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-6 relative">
          {/* Back Button */}
          <Link 
            to="/"
            className={`absolute left-0 top-0 inline-flex items-center px-3 py-2 rounded-md transition-colors ${
              darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Link>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`absolute right-0 top-0 p-2 rounded-lg ${
              darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100'
            } transition-colors`}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            AI Models Analytics
          </h1>
          <p className={`mt-2 text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Historical trends and insights
          </p>
        </div>

        <div className="flex-1">
          {/* Analytics Info */}
          <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-200'} border`}>
            <div className={`text-base ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
              <p className="mb-2">
                <strong>Analytics Dashboard:</strong> Track model count changes over time with provider-level filtering.
              </p>
              <p className="mb-2">
                <strong>Data Collection:</strong> Automatically captures snapshots when the main dashboard refreshes.
              </p>
              <p>
                <strong>Last Refresh:</strong> {lastRefresh.toLocaleString('en-US', { 
                  timeZone: 'UTC', 
                  year: 'numeric', 
                  month: 'short', 
                  day: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit'
                })} UTC | <strong>Total Models: {models.length}</strong>
              </p>
            </div>
          </div>

          {/* Model Count Line Graph */}
          <ModelCountLineGraph currentModels={models} darkMode={darkMode} />

          {/* Provider Summary */}
          <div className={`mt-6 p-6 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Current Provider Distribution
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inference Providers */}
              <div>
                <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Inference Providers
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const counts: { [key: string]: number } = {};
                    models.forEach(model => {
                      const provider = model.inference_provider || 'Unknown';
                      counts[provider] = (counts[provider] || 0) + 1;
                    });
                    return Object.entries(counts)
                      .sort(([,a], [,b]) => b - a)
                      .map(([provider, count]) => (
                        <div key={provider} className="flex justify-between items-center">
                          <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {provider}
                          </span>
                          <span className={`font-mono px-2 py-1 rounded text-sm ${
                            darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {count}
                          </span>
                        </div>
                      ));
                  })()}
                </div>
              </div>

              {/* Model Providers */}
              <div>
                <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Model Providers
                </h3>
                <div className="space-y-2">
                  {(() => {
                    const counts: { [key: string]: number } = {};
                    models.forEach(model => {
                      const provider = model.model_provider || 'Unknown';
                      counts[provider] = (counts[provider] || 0) + 1;
                    });
                    return Object.entries(counts)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 10) // Show top 10 model providers
                      .map(([provider, count]) => (
                        <div key={provider} className="flex justify-between items-center">
                          <span className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} truncate mr-2`}>
                            {provider}
                          </span>
                          <span className={`font-mono px-2 py-1 rounded text-sm ${
                            darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {count}
                          </span>
                        </div>
                      ));
                  })()}
                </div>
                {(() => {
                  const counts: { [key: string]: number } = {};
                  models.forEach(model => {
                    const provider = model.model_provider || 'Unknown';
                    counts[provider] = (counts[provider] || 0) + 1;
                  });
                  const totalProviders = Object.keys(counts).length;
                  if (totalProviders > 10) {
                    return (
                      <div className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        ... and {totalProviders - 10} more providers
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-8 pt-6 border-t rounded-lg p-4 ${
          darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'
        }`}>
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center`}>
            <p className="font-medium">
              © 2025 Free AI Models Tracker - Analytics Dashboard
            </p>
            <p className="mt-2">
              Historical data is stored locally in your browser. Export your data before clearing browser storage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;