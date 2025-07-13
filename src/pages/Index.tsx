
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SummaryView } from '../components/SummaryView';
import { DetailsView } from '../components/DetailsView';
import { Moon, Sun, RotateCcw } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');
  const [isDark, setIsDark] = useState(() => 
    localStorage.getItem('theme') === 'dark' || 
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['llm-dashboard-data'] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark ? 'dark bg-slate-900' : 'bg-slate-50'
    }`}>
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center space-x-6">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                LLM Status Beacon
              </h1>
              
              <nav className="flex">
                {(['summary', 'details'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
                title="Refresh data"
              >
                <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-3 px-3 sm:px-4">
        {activeTab === 'summary' ? <SummaryView /> : <DetailsView />}
      </main>
    </div>
  );
};

export default Index;
