import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ModelData {
  id: number;
  model_name: string;
  provider: string;
  task_type: string;
  api_available: boolean;
  free_tier: boolean;
  discovery_timestamp: string;
  discovery_method: string;
}

interface ChartData {
  provider: string;
  totalModels: number;
  models: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

export const useSupabaseModelData = () => {
  return useQuery({
    queryKey: ['supabase-model-discovery'],
    queryFn: async () => {
      console.log('🔍 Fetching from ai_models_discovery table...');

      const { data: models, error } = await supabase
        .from('ai_models_discovery' as any)
        .select('*')
        .order('discovery_timestamp', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log(`✅ Retrieved ${models.length} models from database`);

      // Group by provider and model
      const providerModelMap = new Map<string, Map<string, number>>();

      (models as unknown as ModelData[]).forEach((model: ModelData) => {
        if (!providerModelMap.has(model.provider)) {
          providerModelMap.set(model.provider, new Map());
        }

        const modelMap = providerModelMap.get(model.provider)!;
        const currentCount = modelMap.get(model.model_name) || 0;
        modelMap.set(model.model_name, currentCount + 1);
      });

      // Transform to chart format
      const chartData: ChartData[] = Array.from(providerModelMap.entries()).map(([provider, modelMap]) => {
        const modelEntries = Array.from(modelMap.entries());
        const totalModels = modelEntries.reduce((sum, [, count]) => sum + count, 0);

        return {
          provider,
          totalModels,
          models: modelEntries.map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / totalModels) * 100)
          })).sort((a, b) => b.count - a.count)
        };
      }).sort((a, b) => b.totalModels - a.totalModels);

      const metrics = {
        totalProviders: providerModelMap.size,
        totalModelEntries: models.length,
        totalUniqueModels: new Set((models as unknown as ModelData[]).map(m => m.model_name)).size,
        lastUpdate: models.length > 0 ? new Date((models as unknown as ModelData[])[0].discovery_timestamp) : new Date(),
        dataSource: 'Supabase ai_models_discovery'
      };

      return {
        chartData,
        metrics,
        rawData: models.slice(0, 5) // Sample for debugging
      };
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};