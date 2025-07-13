import React from 'react';
import { useGitHubData } from '../hooks/useGitHubData';
import { formatDistanceToNow } from 'date-fns';
import { 
  Database, Activity, XCircle, Clock, 
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown 
} from 'lucide-react';

export const SummaryView: React.FC = () => {
  const { data, isLoading, error } = useGitHubData();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-200 dark:bg-slate-700 h-20 rounded animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-200 dark:bg-slate-700 h-12 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Data Unavailable</p>
            <p className="text-xs text-red-600 dark:text-red-400">
              {error?.message || 'Failed to load dashboard data'}
            </p>
            <p className="text-xs text-red-500 dark:text-red-300 mt-1">
              Add VITE_GITHUB_TOKEN environment variable with GitHub Personal Access Token
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, status, isOutdated, fallbackReason } = data;

  const formatChange = (change: number) => {
    if (change === 0) return null;
    return (
      <div className="flex items-center space-x-1">
        {change > 0 ? (
          <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
        )}
        <span className={`text-xs font-medium ${
          change > 0 
            ? 'text-emerald-600 dark:text-emerald-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          {change > 0 ? '+' : ''}{change}
        </span>
      </div>
    );
  };

  const metricCards = [
    {
      title: 'Total Providers',
      value: metrics.totalProviders,
      icon: Database,
      color: 'blue' as const
    },
    {
      title: 'Available Models',
      value: metrics.totalAvailableModels,
      change: formatChange(metrics.availableModelsChange),
      icon: Activity,
      color: 'emerald' as const
    },
    {
      title: 'Models Excluded',
      value: metrics.modelsExcluded,
      icon: XCircle,
      color: 'red' as const
    },
    {
      title: 'Last Updated',
      value: formatDistanceToNow(metrics.lastUpdate, { addSuffix: true }).replace(' ago', ''),
      icon: Clock,
      color: 'slate' as const
    }
  ];

  return (
    <div className="space-y-3">
      {/* Status Banner */}
      {(isOutdated || fallbackReason) && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg px-3 py-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {fallbackReason || 'Using previous data due to latest run failure'}
            </p>
          </div>
        </div>
      )}

      {/* Core Metrics Grid - 4 Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metricCards.map((card, index) => {
          const IconComponent = card.icon;
          const colorClasses = {
            blue: 'text-blue-600 dark:text-blue-400',
            emerald: 'text-emerald-600 dark:text-emerald-400',
            red: 'text-red-600 dark:text-red-400',
            slate: 'text-slate-600 dark:text-slate-400'
          };

          return (
            <div 
              key={index} 
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <IconComponent className={`h-4 w-4 ${colorClasses[card.color]}`} />
                {card.change}
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                  {card.value}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-none">
                  {card.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Information Row - 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-400">Workflow Status</span>
            <div className="flex items-center space-x-1">
              {status.status === 'success' ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
              )}
              <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                #{status.runNumber}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-400">Data Source</span>
            <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate ml-2">
              {metrics.dataSource}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-400">Next Check</span>
            <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
              {formatDistanceToNow(metrics.nextUpdate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
