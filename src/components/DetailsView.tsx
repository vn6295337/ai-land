
import React, { useState, useMemo } from 'react';
import { useGitHubData } from '../hooks/useGitHubData';
import { Search, Check, X, ExternalLink, Globe, Zap, Shield } from 'lucide-react';

export const DetailsView: React.FC = () => {
  const { data, isLoading, error } = useGitHubData();
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  const filteredModels = useMemo(() => {
    if (!data?.models) return [];

    return data.models.filter(model => {
      const matchesSearch = model.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           model.provider.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvider = providerFilter === 'all' || model.provider === providerFilter;
      const matchesAvailable = !showOnlyAvailable || model.api_available;

      return matchesSearch && matchesProvider && matchesAvailable;
    });
  }, [data?.models, searchTerm, providerFilter, showOnlyAvailable]);

  const providers = useMemo(() => {
    if (!data?.models) return [];
    return Array.from(new Set(data.models.map(m => String(m.provider)))).sort();
  }, [data?.models]);

  if (isLoading) {
    return <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-64 rounded-lg" />;
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error?.message || 'Failed to load model data from scout-agent'}
        </p>
      </div>
    );
  }

  const StatusIcon = ({ value }: { value: boolean }) => (
    value ? (
      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <X className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
    )
  );

  const getHealthStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
      case 'healthy':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'unavailable':
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search models..."
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          <option value="all">All Providers</option>
          {providers.map((provider, index) => (
            <option key={`provider-${index}`} value={String(provider)}>{String(provider)}</option>
          ))}
        </select>

        <label className="flex items-center space-x-1.5 px-2 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={showOnlyAvailable}
            onChange={(e) => setShowOnlyAvailable(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-1"
          />
          <span className="text-slate-700 dark:text-slate-300">Available only</span>
        </label>
      </div>

      {/* Results Summary */}
      <div className="text-xs text-slate-600 dark:text-slate-400">
        {filteredModels.length} of {data?.models.length} models • Last validated: {data.status.lastRun.toLocaleString()}
      </div>

      {/* Enhanced Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Response
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  API
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Free
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Region
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Auth
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredModels.map((model, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {model.model_name}
                      </span>
                      {model.documentation_url && (
                        <a 
                          href={model.documentation_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {model.provider}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getHealthStatusColor(model.health_status)}`}>
                      {model.health_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <Zap className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {typeof model.response_time === 'number' ? `${model.response_time}ms` : model.response_time}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusIcon value={model.api_available} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusIcon value={model.free_tier} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      {model.geographic_origin_verified && model.allowed_region ? (
                        <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Globe className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {model.auth_method === 'backend_proxy' ? 'Proxy' : model.auth_method}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
