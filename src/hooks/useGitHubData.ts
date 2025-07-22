
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Primary: GitHub raw file (fast, direct)
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/vn6295337/askme/main/scout-agent/validated_models.json';

// Fallback: Your backend proxy  
const BACKEND_URL = 'https://askme-backend-proxy.onrender.com';

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

function transformGitHubData(rawData: any) {
  const models = rawData.models || [];
  const metadata = rawData.metadata || {};

  const metrics: DashboardMetrics = {
    totalProviders: metadata.providers_validated?.length || 0,
    totalAvailableModels: models.filter((m: any) => m.api_available).length,
    availableModelsChange: 0,
    modelsExcluded: metadata.total_excluded_models || 0,
    lastUpdate: new Date(metadata.timestamp || Date.now()),
    nextUpdate: new Date(Date.now() + 15 * 60 * 1000),
    dataSource: 'Scout Agent (GitHub)',
    avgResponseTime: 0,
    successRate: (models.filter((m: any) => m.api_available).length / models.length) * 100 || 0
  };

  const status: WorkflowStatus = {
    status: 'success' as const,
    lastRun: new Date(metadata.timestamp || Date.now()),
    healthChecks: {
      passed: metadata.providers_with_models?.length || 0,
      total: metadata.providers_validated?.length || 0
    }
  };

  return {
    models,
    metrics,
    status,
    isOutdated: false,
    fallbackReason: ''
  };
}

function transformBackendData(backendData: any) {
  const models = backendData.validated_models || [];
  const dashboardData = backendData.dashboard_data || {};

  const metrics: DashboardMetrics = {
    totalProviders: dashboardData.performance_metrics?.total_providers || 0,
    totalAvailableModels: models.filter((m: any) => m.api_available).length,
    availableModelsChange: 0,
    modelsExcluded: 0,
    lastUpdate: new Date(backendData.timestamp),
    nextUpdate: new Date(Date.now() + 15 * 60 * 1000),
    dataSource: 'Scout Agent (Backend)',
    avgResponseTime: dashboardData.performance_metrics?.average_response_time || 0,
    successRate: dashboardData.performance_metrics?.success_rate || 0
  };

  const status: WorkflowStatus = {
    status: 'success' as const,
    lastRun: new Date(backendData.timestamp),
    healthChecks: {
      passed: dashboardData.performance_metrics?.active_providers || 0,
      total: dashboardData.performance_metrics?.total_providers || 0
    }
  };

  return {
    models,
    metrics,
    status,
    isOutdated: false,
    fallbackReason: ''
  };
}

export const useGitHubData = () => {
  return useQuery({
    queryKey: ['llm-dashboard-data'],
    queryFn: async () => {
      try {
        // Method 1: Direct GitHub fetch (fastest)
        console.log('Fetching from GitHub raw...');
        const githubResponse = await fetch(GITHUB_RAW_URL);

        if (githubResponse.ok) {
          const githubData = await githubResponse.json();

          // Store in Supabase for caching/analytics
          await supabase
            .from('model_validations')
            .upsert({
              id: 'latest',
              data: githubData,
              source: 'github_raw',
              fetched_at: new Date().toISOString()
            });

          return transformGitHubData(githubData);
        }
      } catch (error) {
        console.warn('GitHub raw fetch failed:', error);
      }

      try {
        // Method 2: Backend proxy fallback
        console.log('Falling back to backend proxy...');
        const backendResponse = await fetch(`${BACKEND_URL}/api/github/llm-data`);

        if (backendResponse.ok) {
          const backendData = await backendResponse.json();
          
          // Store in Supabase for caching
          await supabase
            .from('model_validations')
            .upsert({
              id: 'latest',
              data: backendData,
              source: 'backend_proxy',
              fetched_at: new Date().toISOString()
            });

          return transformBackendData(backendData);
        }
      } catch (error) {
        console.warn('Backend proxy failed:', error);
      }

      // Method 3: Supabase cache fallback
      console.log('Using Supabase cache...');
      const { data: cachedData } = await supabase
        .from('model_validations')
        .select('*')
        .eq('id', 'latest')
        .maybeSingle();

      if (cachedData) {
        const result = cachedData.source === 'github_raw' 
          ? transformGitHubData(cachedData.data)
          : transformBackendData(cachedData.data);
        
        // Check if cached data is recent (within last 30 minutes)
        const cacheAge = Date.now() - new Date(cachedData.fetched_at).getTime();
        const isRecentCache = cacheAge < 30 * 60 * 1000; // 30 minutes
        
        return {
          ...result,
          isOutdated: !isRecentCache,
          fallbackReason: isRecentCache ? '' : 'Using cached data from Supabase'
        };
      }

      throw new Error('All data sources unavailable');
    },
    refetchInterval: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours,
  });
};
