
import { useQuery } from '@tanstack/react-query';

// Local storage keys for caching and change tracking
const CACHE_KEY = 'llm-dashboard-cache';
const CACHE_TIMESTAMP_KEY = 'llm-dashboard-cache-timestamp';
const PREVIOUS_METRICS_KEY = 'llm-dashboard-previous-metrics';

interface LLMModel {
  model_name: string;
  provider: string;
  api_available: boolean;
  registration_required: boolean;
  free_tier: boolean;
  auth_method: string;
  documentation_url: string;
  notes: string;
  quality_verified: boolean;
  trusted_source: boolean;
  validation_reason: string;
}

interface DashboardMetrics {
  totalProviders: number;
  totalAvailableModels: number;
  availableModelsChange: number; // Change from last update
  modelsExcluded: number;
  lastUpdate: Date;
  nextUpdate: Date;
  dataSource: string;
}

interface WorkflowStatus {
  status: 'success' | 'failure' | 'in_progress';
  lastRun: Date;
  runNumber: number;
}

interface CachedData {
  models: LLMModel[];
  metrics: DashboardMetrics;
  status: WorkflowStatus;
  cachedAt: string;
  originalDataSource: string;
}

export const useGitHubData = () => {
  return useQuery({
    queryKey: ['llm-dashboard-data'],
    queryFn: async () => {
      let errorMessage = '';
      let fallbackReason = '';

      try {
        // Get backend URL from environment
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://askme-backend-proxy.onrender.com';
        
        // Call your backend proxy endpoint - updated to match available endpoint
        const response = await fetch(`${backendUrl}/api/github/llm-data`);
        
        if (!response.ok) {
          throw new Error(`Backend API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.models || !Array.isArray(data.models)) {
          throw new Error('Invalid data format received from backend');
        }

        const models: LLMModel[] = data.models;

        // Calculate metrics
        const totalProviders = new Set(models.map(m => m.provider)).size;
        const totalAvailableModels = models.filter(m => m.api_available).length;
        const totalModels = models.length;
        const modelsExcluded = totalModels - totalAvailableModels;

        // Calculate change from previous metrics
        let availableModelsChange = 0;
        try {
          const previousMetricsStr = localStorage.getItem(PREVIOUS_METRICS_KEY);
          if (previousMetricsStr) {
            const previousMetrics = JSON.parse(previousMetricsStr);
            availableModelsChange = totalAvailableModels - (previousMetrics.totalAvailableModels || 0);
          }
        } catch (error) {
          console.warn('Failed to load previous metrics:', error);
        }

        const metrics: DashboardMetrics = {
          totalProviders,
          totalAvailableModels,
          availableModelsChange,
          modelsExcluded,
          lastUpdate: new Date(data.lastUpdate || Date.now()),
          nextUpdate: new Date(Date.now() + 15 * 60 * 1000),
          dataSource: data.dataSource || 'Backend API'
        };

        const status: WorkflowStatus = {
          status: data.status?.status || 'success',
          lastRun: new Date(data.status?.lastRun || Date.now()),
          runNumber: data.status?.runNumber || 1
        };

        const result = { 
          models, 
          metrics, 
          status, 
          isOutdated: data.isOutdated || false,
          fallbackReason: data.fallbackReason || ''
        };

        // Cache successful data and store current metrics for next comparison
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            models,
            metrics,
            status,
            cachedAt: new Date().toISOString(),
            originalDataSource: data.dataSource || 'Backend API'
          }));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
          localStorage.setItem(PREVIOUS_METRICS_KEY, JSON.stringify(metrics));
        } catch (cacheError) {
          console.warn('Failed to cache data:', cacheError);
        }

        return result;

      } catch (error) {
        console.warn('Backend data fetch failed:', error);
        
        // FALLBACK: Try to use cached data
        try {
          const cachedDataStr = localStorage.getItem(CACHE_KEY);
          const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
          
          if (cachedDataStr && cacheTimestamp) {
            const cachedData: CachedData = JSON.parse(cachedDataStr);
            const cacheAge = Date.now() - new Date(cacheTimestamp).getTime();
            const cacheAgeHours = Math.round(cacheAge / (1000 * 60 * 60));
            
            const updatedMetrics = {
              ...cachedData.metrics,
              dataSource: `${cachedData.originalDataSource} (cached ${cacheAgeHours}h ago)`,
              lastUpdate: new Date(cachedData.cachedAt),
              nextUpdate: new Date(Date.now() + 15 * 60 * 1000)
            };

            return {
              models: cachedData.models,
              metrics: updatedMetrics,
              status: {
                ...cachedData.status,
                status: 'failure' as const
              },
              isOutdated: true,
              fallbackReason: fallbackReason || 'Using cached data due to backend connection issues'
            };
          }
        } catch (cacheError) {
          console.warn('Failed to load cached data:', cacheError);
        }

        throw new Error(fallbackReason || (error as Error).message || 'Failed to load data from backend and no cache available');
      }
    },
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};
