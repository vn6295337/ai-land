import React from 'react';
import { useSupabaseModelData } from '../hooks/useSupabaseModelData';
import { ProviderModelChart } from './ProviderModelChart';
import { Loader2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data, isLoading, error, isError } = useSupabaseModelData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading model data...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded">
        <h3 className="font-semibold">Error loading data</h3>
        <p>{error?.message || 'Failed to fetch model discovery data'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">AI Model Discovery Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="text-sm font-medium text-blue-600">Total Providers</h3>
            <p className="text-2xl font-bold text-blue-900">{data?.metrics.totalProviders}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <h3 className="text-sm font-medium text-green-600">Model Entries</h3>
            <p className="text-2xl font-bold text-green-900">{data?.metrics.totalModelEntries}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="text-sm font-medium text-purple-600">Unique Models</h3>
            <p className="text-2xl font-bold text-purple-900">{data?.metrics.totalUniqueModels}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <h3 className="text-sm font-medium text-orange-600">Last Update</h3>
            <p className="text-sm font-bold text-orange-900">
              {data?.metrics.lastUpdate.toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Models by Provider</h2>
          <p className="text-gray-600">Stacked bar chart showing model distribution across providers</p>
          <ProviderModelChart data={data?.chartData || []} />
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Data source: {data?.metrics.dataSource} | Last updated: {data?.metrics.lastUpdate.toLocaleString()}
        </div>
      </div>
    </div>
  );
};