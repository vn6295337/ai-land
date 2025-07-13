
import React, { useState, useMemo } from 'react';
import { useGitHubData } from '../hooks/useGitHubData';
import { Search, Check, X, ExternalLink } from 'lucide-react';

export const DetailsView: React.FC = () => {
  const { data, isLoading, error } = useGitHubData();
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [showOnlyVerified, setShowOnlyVerified] = useState(false);

  const filteredModels = useMemo(() => {
    if (!data?.models) return [];
    
    return data.models.filter(model => {
      const matchesSearch = model.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           model.provider.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProvider = providerFilter === 'all' || model.provider === providerFilter;
      const matchesVerified = !showOnlyVerified || model.quality_verified;
      
      return matchesSearch && matchesProvider && matchesVerified;
    });
  }, [data?.models, searchTerm, providerFilter, showOnlyVerified]);

  const providers = useMemo(() => {
    if (!data?.models) return [];
    return Array.from(new Set(data.models.map(m => m.provider))).sort();
  }, [data?.models]);

  if (isLoading) {
    return <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-64 rounded-lg" />;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
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
          {providers.map(provider => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>

        <label className="flex items-center space-x-1.5 px-2 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={showOnlyVerified}
            onChange={(e) => setShowOnlyVerified(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-1"
          />
          <span className="text-slate-700 dark:text-slate-300">Verified only</span>
        </label>
      </div>

      {/* Results Summary */}
      <div className="text-xs text-slate-600 dark:text-slate-400">
        {filteredModels.length} of {data?.models.length} models
      </div>

      {/* Streamlined Table */}
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
                  API
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Free
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Reg.
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Verified
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Trusted
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
                    <StatusIcon value={model.api_available} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusIcon value={model.free_tier} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusIcon value={model.registration_required} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusIcon value={model.quality_verified} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusIcon value={model.trusted_source} />
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
