
import { useQuery } from '@tanstack/react-query';

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'https://askme-backend-proxy.onrender.com';

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
  documentation_url?: string;
  backend_url?: string;
  health_status: string;
  response_time: string | number;
  last_validated: string;
  geographic_origin_verified: boolean;
  allowed_region: boolean;
  origin_reason: string;
  notes?: string;
}

interface DashboardMetrics {
  totalProviders: number;
  totalAvailableModels: number;
  availableModelsChange: number;
  modelsExcluded: number;
  lastUpdate: Date;
  nextUpdate: Date;
  dataSource: string;
  avgResponseTime: number;
  successRate: number;
}

interface WorkflowStatus {
  status: 'success' | 'failure' | 'in_progress';
  lastRun: Date;
  runNumber?: number;
  healthChecks?: {
    passed: number;
    total: number;
  };
}

interface ValidationData {
  timestamp: string;
  scout_agent_version: string;
  backend_url: string;
  validation_summary: {
    total_models: number;
    total_eligible: number;
    providers: string[];
    active_providers: number;
  };
  validated_models: LLMModel[];
  eligible_models: any[];
  dashboard_data: {
    provider_status: Array<{
      provider: string;
      model_name: string;
      status: string;
      response_time: string | number;
      last_validated: string;
    }>;
    performance_metrics: {
      total_providers: number;
      active_providers: number;
      average_response_time: number;
      success_rate: number;
    };
  };
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
          // Fetch directly from GitHub
          const validationResponse = await fetch('https://raw.githubusercontent.com/vn6295337/askme/main/scout-agent/validated_models.json');

          if (!validationResponse.ok) {
            throw new Error(`GitHub API returned ${validationResponse.status}: ${validationResponse.statusText}`);
          }

          const validationData: ValidationData = await validationResponse.json();

        if (!validationData.validated_models || !Array.isArray(validationData.validated_models)) {
          throw new Error('Invalid data format from backend');
        }

        const models = validationData.validated_models;
        const dashboardData = validationData.dashboard_data;

        // Calculate metrics from the scout-agent data
        const totalProviders = dashboardData.performance_metrics.total_providers;
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
          lastUpdate: new Date(validationData.timestamp),
          nextUpdate: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
          dataSource: 'Scout Agent Validation',
          avgResponseTime: dashboardData.performance_metrics.average_response_time || 0,
          successRate: dashboardData.performance_metrics.success_rate || 0
        };

        // Get backend health status
        let healthStatus: WorkflowStatus = {
          status: 'success',
          lastRun: new Date(validationData.timestamp),
          healthChecks: {
            passed: dashboardData.performance_metrics.active_providers,
            total: dashboardData.performance_metrics.total_providers
          }
        };

        // Try to get additional health data
        try {
          const healthResponse = await fetch(`${BACKEND_URL}/api/github/llm-health`);
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            if (healthData.overall_status) {
              healthStatus.status = healthData.overall_status === 'healthy' ? 'success' : 'failure';
            }
          }
        } catch (healthError) {
          console.warn('Could not fetch health data:', healthError);
        }

        const result = {
          models,
          metrics,
          status: healthStatus,
          isOutdated: false,
          fallbackReason: ''
        };

        // Cache successful data
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            models,
            metrics,
            status: healthStatus,
            cachedAt: new Date().toISOString(),
            originalDataSource: 'Scout Agent Backend'
          }));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
          localStorage.setItem(PREVIOUS_METRICS_KEY, JSON.stringify(metrics));
        } catch (cacheError) {
          console.warn('Failed to cache data:', cacheError);
        }

        return result;

      } catch (error) {
        console.warn('Primary data fetch failed:', error);
        errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
              fallbackReason: 'Using cached data due to backend unavailability'
            };
          }
        } catch (cacheError) {
          console.warn('Failed to load cached data:', cacheError);
        }

        throw new Error(`Backend unavailable: ${errorMessage}. Please check if the scout-agent workflow has run recently.`);
      }
    },
    refetchInterval: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours,
  });
};
