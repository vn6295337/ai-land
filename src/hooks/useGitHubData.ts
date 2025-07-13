
import { useQuery } from '@tanstack/react-query';
import JSZip from 'jszip';

const GITHUB_OWNER = 'vn6295337';
const GITHUB_REPO = 'askme';
const WORKFLOW_FILE = 'scout-agent.yml';
const ARTIFACT_NAME = 'model-validation-results';

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
        // Fetch workflow runs
        const runsUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=10`;
        const runsResponse = await fetch(runsUrl);
        
        if (!runsResponse.ok) {
          throw new Error(`GitHub API returned ${runsResponse.status}: ${runsResponse.statusText}`);
        }
        
        const { workflow_runs } = await runsResponse.json();
        
        if (!workflow_runs || workflow_runs.length === 0) {
          fallbackReason = 'No workflow runs found';
          throw new Error('No workflow runs available');
        }

        // Find the most recent successful run
        const successfulRun = workflow_runs.find((r: any) => r.conclusion === 'success');
        
        if (!successfulRun) {
          fallbackReason = 'No successful workflow runs found';
          throw new Error('No successful workflow runs available');
        }

        const latestRun = workflow_runs[0];
        const isOutdated = latestRun.id !== successfulRun.id;

        // Fetch and download artifact
        const artifactsUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${successfulRun.id}/artifacts`;
        const artifactsResponse = await fetch(artifactsUrl);
        
        if (!artifactsResponse.ok) {
          throw new Error(`Failed to fetch artifacts: ${artifactsResponse.status}`);
        }
        
        const { artifacts } = await artifactsResponse.json();
        const targetArtifact = artifacts.find((a: any) => a.name === ARTIFACT_NAME);
        
        if (!targetArtifact) {
          throw new Error(`Artifact "${ARTIFACT_NAME}" not found`);
        }

        const zipResponse = await fetch(targetArtifact.archive_download_url, {
          headers: { 'Accept': 'application/vnd.github+json' }
        });
        
        if (!zipResponse.ok) {
          throw new Error(`Failed to download artifact: ${zipResponse.status}`);
        }
        
        const blob = await zipResponse.blob();
        const zip = await JSZip.loadAsync(blob);
        const jsonFile = Object.keys(zip.files).find(k => 
          k.endsWith('validated_models.json') || k.endsWith('.json')
        );
        
        if (!jsonFile) {
          throw new Error('validated_models.json not found in artifact');
        }
        
        const content = await zip.files[jsonFile].async('string');
        const models: LLMModel[] = JSON.parse(content);

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
          lastUpdate: new Date(successfulRun.created_at),
          nextUpdate: new Date(Date.now() + 15 * 60 * 1000),
          dataSource: isOutdated ? `${targetArtifact.name} (using previous successful run)` : targetArtifact.name
        };

        const status: WorkflowStatus = {
          status: successfulRun.conclusion || 'success',
          lastRun: new Date(successfulRun.created_at),
          runNumber: successfulRun.run_number
        };

        const result = { 
          models, 
          metrics, 
          status, 
          isOutdated,
          fallbackReason: isOutdated ? 'Latest run failed, using previous successful data' : ''
        };

        // Cache successful data and store current metrics for next comparison
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            models,
            metrics,
            status,
            cachedAt: new Date().toISOString(),
            originalDataSource: targetArtifact.name
          }));
          localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
          localStorage.setItem(PREVIOUS_METRICS_KEY, JSON.stringify(metrics));
        } catch (cacheError) {
          console.warn('Failed to cache data:', cacheError);
        }

        return result;

      } catch (error) {
        console.warn('Primary data fetch failed:', error);
        
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
              fallbackReason: fallbackReason || 'Using cached data due to connection issues'
            };
          }
        } catch (cacheError) {
          console.warn('Failed to load cached data:', cacheError);
        }

        throw new Error(fallbackReason || (error as Error).message || 'Failed to load data and no cache available');
      }
    },
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};
