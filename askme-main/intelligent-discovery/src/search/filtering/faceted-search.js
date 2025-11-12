import { createLogger } from '../../core/infrastructure/logger.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';

class FacetedSearchEngine {
  constructor() {
    this.logger = createLogger({ component: 'faceted-search' });
    this.isInitialized = false;
    this.facetCache = new Map();
    this.filterCache = new Map();
    
    // Facet definitions and configurations
    this.facetDefinitions = {
      provider: {
        type: 'categorical',
        field: 'provider',
        displayName: 'Provider',
        description: 'AI model provider/company',
        multiSelect: true,
        sortBy: 'count',
        maxValues: 20,
        aggregation: 'value_count'
      },
      model_type: {
        type: 'categorical',
        field: 'model_type',
        displayName: 'Model Type',
        description: 'Type of AI model',
        multiSelect: true,
        sortBy: 'count',
        maxValues: 15,
        aggregation: 'value_count'
      },
      task_category: {
        type: 'hierarchical',
        field: 'task_category',
        displayName: 'Task Category',
        description: 'Primary task categories',
        multiSelect: true,
        hierarchy: ['primary', 'secondary', 'specific'],
        maxDepth: 3,
        aggregation: 'nested_count'
      },
      domain: {
        type: 'categorical',
        field: 'domain',
        displayName: 'Domain',
        description: 'Application domain',
        multiSelect: true,
        sortBy: 'count',
        maxValues: 12,
        aggregation: 'value_count'
      },
      performance_tier: {
        type: 'ordinal',
        field: 'performance_score',
        displayName: 'Performance Tier',
        description: 'Performance ranking tier',
        ranges: [
          { label: 'Premium', min: 0.8, max: 1.0 },
          { label: 'High', min: 0.6, max: 0.8 },
          { label: 'Standard', min: 0.4, max: 0.6 },
          { label: 'Basic', min: 0.0, max: 0.4 }
        ],
        aggregation: 'range_count'
      },
      model_size: {
        type: 'ordinal',
        field: 'parameter_count',
        displayName: 'Model Size',
        description: 'Number of parameters',
        ranges: [
          { label: 'Large (>100B)', min: 100000000000, max: null },
          { label: 'Medium (10B-100B)', min: 10000000000, max: 100000000000 },
          { label: 'Small (1B-10B)', min: 1000000000, max: 10000000000 },
          { label: 'Compact (<1B)', min: 0, max: 1000000000 }
        ],
        aggregation: 'range_count'
      },
      cost_tier: {
        type: 'ordinal',
        field: 'cost_per_token',
        displayName: 'Cost Tier',
        description: 'Pricing tier',
        ranges: [
          { label: 'Premium', min: 0.01, max: null },
          { label: 'Standard', min: 0.001, max: 0.01 },
          { label: 'Economy', min: 0.0001, max: 0.001 },
          { label: 'Free', min: 0, max: 0.0001 }
        ],
        aggregation: 'range_count'
      },
      capabilities: {
        type: 'multi_categorical',
        field: 'capabilities',
        displayName: 'Capabilities',
        description: 'Model capabilities',
        multiSelect: true,
        sortBy: 'count',
        maxValues: 25,
        aggregation: 'array_value_count'
      },
      languages: {
        type: 'multi_categorical',
        field: 'supported_languages',
        displayName: 'Languages',
        description: 'Supported languages',
        multiSelect: true,
        sortBy: 'count',
        maxValues: 30,
        aggregation: 'array_value_count'
      },
      release_date: {
        type: 'temporal',
        field: 'release_date',
        displayName: 'Release Date',
        description: 'Model release timeframe',
        ranges: [
          { label: 'Last Month', days: 30 },
          { label: 'Last 3 Months', days: 90 },
          { label: 'Last 6 Months', days: 180 },
          { label: 'Last Year', days: 365 },
          { label: 'Older', days: null }
        ],
        aggregation: 'date_range_count'
      },
      quality_score: {
        type: 'numeric',
        field: 'quality_score',
        displayName: 'Quality Score',
        description: 'Overall quality rating',
        distribution: 'histogram',
        buckets: 10,
        range: [0, 1],
        aggregation: 'histogram'
      }
    };
    
    // Filter operators for different field types
    this.filterOperators = {
      categorical: ['equals', 'not_equals', 'in', 'not_in'],
      multi_categorical: ['contains', 'not_contains', 'contains_all', 'contains_any'],
      ordinal: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
      numeric: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
      temporal: ['before', 'after', 'between', 'within_days'],
      hierarchical: ['equals', 'starts_with', 'descendant_of', 'ancestor_of'],
      text: ['contains', 'not_contains', 'starts_with', 'ends_with', 'regex']
    };
    
    // Advanced filter combinations
    this.filterCombinations = {
      AND: 'all_conditions_must_match',
      OR: 'any_condition_must_match',
      NOT: 'exclude_matching_conditions',
      XOR: 'exactly_one_condition_matches'
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing faceted search engine');
      
      // Initialize facet aggregation engines
      await this.initializeFacetAggregators();
      
      // Build facet indexes for fast aggregation
      await this.buildFacetIndexes();
      
      // Initialize filter validation
      await this.initializeFilterValidation();
      
      // Setup facet caching
      await this.setupFacetCaching();
      
      // Precompute common facet combinations
      await this.precomputeCommonFacets();
      
      this.isInitialized = true;
      this.logger.info('Faceted search engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize faceted search engine', { error: error.message });
      throw error;
    }
  }

  async search(query, filters = {}, facetOptions = {}) {
    if (!this.isInitialized) {
      throw new Error('Faceted search engine not initialized');
    }

    try {
      this.logger.info('Performing faceted search', {
        query: query?.substring(0, 100),
        filterCount: Object.keys(filters).length,
        requestedFacets: facetOptions.facets?.length || 'all'
      });

      const startTime = Date.now();
      
      // Validate and normalize filters
      const validatedFilters = await this.validateFilters(filters);
      
      // Build search query with filters
      const searchQuery = await this.buildSearchQuery(query, validatedFilters);
      
      // Execute search with filters
      const searchResults = await this.executeFilteredSearch(searchQuery, facetOptions);
      
      // Generate facets for current result set
      const facets = await this.generateFacets(searchQuery, validatedFilters, facetOptions);
      
      // Apply post-search filtering if needed
      const refinedResults = await this.applyPostSearchFiltering(searchResults, validatedFilters);
      
      const processingTime = Date.now() - startTime;
      
      const response = {
        results: refinedResults.results,
        facets: facets,
        filters: {
          applied: validatedFilters,
          available: await this.getAvailableFilters(searchResults.results),
          suggestions: await this.generateFilterSuggestions(query, validatedFilters)
        },
        metadata: {
          query,
          totalResults: refinedResults.total,
          filteredResults: refinedResults.results.length,
          processingTime,
          searchTime: searchResults.searchTime,
          facetTime: facets.computationTime
        }
      };
      
      this.logger.info('Faceted search completed', {
        totalResults: response.metadata.totalResults,
        filteredResults: response.metadata.filteredResults,
        facetCount: Object.keys(response.facets).length,
        processingTime
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('Faceted search failed', { query, filters, error: error.message });
      throw error;
    }
  }

  async validateFilters(filters) {
    const validatedFilters = {};
    
    for (const [facetName, filterValue] of Object.entries(filters)) {
      const facetDef = this.facetDefinitions[facetName];
      
      if (!facetDef) {
        this.logger.warn(`Unknown facet: ${facetName}`, { availableFacets: Object.keys(this.facetDefinitions) });
        continue;
      }
      
      try {
        validatedFilters[facetName] = await this.validateSingleFilter(facetName, filterValue, facetDef);
      } catch (error) {
        this.logger.warn(`Invalid filter for facet ${facetName}`, { filterValue, error: error.message });
      }
    }
    
    return validatedFilters;
  }

  async validateSingleFilter(facetName, filterValue, facetDef) {
    // Handle different filter structures
    if (typeof filterValue === 'string' || typeof filterValue === 'number') {
      // Simple value filter
      return { operator: 'equals', value: filterValue };
    }
    
    if (Array.isArray(filterValue)) {
      // Array of values (IN operation)
      return { operator: 'in', values: filterValue };
    }
    
    if (typeof filterValue === 'object' && filterValue !== null) {
      // Complex filter object
      const { operator, value, values, min, max, ...options } = filterValue;
      
      // Validate operator
      const allowedOperators = this.filterOperators[facetDef.type] || [];
      if (operator && !allowedOperators.includes(operator)) {
        throw new Error(`Invalid operator '${operator}' for facet type '${facetDef.type}'`);
      }
      
      // Validate filter structure based on operator
      const validatedFilter = { operator: operator || 'equals', ...options };
      
      if (values !== undefined) {
        validatedFilter.values = Array.isArray(values) ? values : [values];
      } else if (value !== undefined) {
        validatedFilter.value = value;
      }
      
      if (min !== undefined || max !== undefined) {
        validatedFilter.range = { min, max };
      }
      
      return validatedFilter;
    }
    
    throw new Error(`Invalid filter format for facet ${facetName}`);
  }

  async buildSearchQuery(query, filters) {
    const searchQuery = {
      text: query,
      filters: await this.convertFiltersToQdrantFormat(filters),
      facetFilters: filters,
      timestamp: Date.now()
    };
    
    return searchQuery;
  }

  async convertFiltersToQdrantFormat(filters) {
    const qdrantFilters = { must: [], should: [], must_not: [] };
    
    for (const [facetName, filter] of Object.entries(filters)) {
      const facetDef = this.facetDefinitions[facetName];
      const qdrantConditions = await this.buildQdrantConditions(facetName, filter, facetDef);
      
      // Add conditions to appropriate clause based on combination logic
      const targetClause = filter.combination || 'must';
      if (qdrantFilters[targetClause]) {
        qdrantFilters[targetClause].push(...qdrantConditions);
      }
    }
    
    // Clean up empty clauses
    Object.keys(qdrantFilters).forEach(clause => {
      if (qdrantFilters[clause].length === 0) {
        delete qdrantFilters[clause];
      }
    });
    
    return qdrantFilters;
  }

  async buildQdrantConditions(facetName, filter, facetDef) {
    const conditions = [];
    const field = facetDef.field;
    
    switch (filter.operator) {
      case 'equals':
        conditions.push({ key: field, match: { value: filter.value } });
        break;
        
      case 'not_equals':
        conditions.push({ key: field, match: { value: filter.value } });
        // Note: This would go in must_not clause
        break;
        
      case 'in':
        conditions.push({ key: field, match: { any: filter.values } });
        break;
        
      case 'not_in':
        conditions.push({ key: field, match: { any: filter.values } });
        // Note: This would go in must_not clause
        break;
        
      case 'greater_than':
        conditions.push({ key: field, range: { gt: filter.value } });
        break;
        
      case 'less_than':
        conditions.push({ key: field, range: { lt: filter.value } });
        break;
        
      case 'between':
        if (filter.range) {
          const rangeCondition = { key: field, range: {} };
          if (filter.range.min !== undefined) rangeCondition.range.gte = filter.range.min;
          if (filter.range.max !== undefined) rangeCondition.range.lte = filter.range.max;
          conditions.push(rangeCondition);
        }
        break;
        
      case 'contains':
        if (facetDef.type === 'multi_categorical') {
          conditions.push({ key: field, match: { any: [filter.value] } });
        } else {
          conditions.push({ key: field, match: { text: filter.value } });
        }
        break;
        
      case 'contains_all':
        filter.values.forEach(value => {
          conditions.push({ key: field, match: { any: [value] } });
        });
        break;
        
      case 'contains_any':
        conditions.push({ key: field, match: { any: filter.values } });
        break;
        
      case 'before':
        conditions.push({ key: field, range: { lt: filter.value } });
        break;
        
      case 'after':
        conditions.push({ key: field, range: { gt: filter.value } });
        break;
        
      case 'within_days':
        const now = Date.now();
        const daysAgo = now - (filter.days * 24 * 60 * 60 * 1000);
        conditions.push({ key: field, range: { gte: daysAgo, lte: now } });
        break;
        
      case 'starts_with':
        // For hierarchical facets
        conditions.push({ key: field, match: { text: `${filter.value}*` } });
        break;
        
      case 'regex':
        // Note: Qdrant may not support regex directly
        conditions.push({ key: field, match: { text: filter.value } });
        break;
        
      default:
        this.logger.warn(`Unsupported filter operator: ${filter.operator}`);
    }
    
    return conditions;
  }

  async executeFilteredSearch(searchQuery, options = {}) {
    const startTime = Date.now();
    
    try {
      // Determine search strategy based on query
      let searchResults;
      
      if (searchQuery.text) {
        // Text-based search with filters
        const queryEmbedding = await embeddingsManager.generateEmbedding(searchQuery.text);
        
        searchResults = await qdrantManager.search(
          'model_embeddings',
          queryEmbedding,
          {
            limit: options.limit || 100,
            filter: searchQuery.filters,
            withPayload: true,
            withVector: false,
            scoreThreshold: options.scoreThreshold || 0.3
          }
        );
      } else {
        // Filter-only search
        searchResults = await qdrantManager.scroll(
          'model_metadata',
          {
            filter: searchQuery.filters,
            limit: options.limit || 100,
            withPayload: true
          }
        );
        searchResults = searchResults.points || [];
      }
      
      const searchTime = Date.now() - startTime;
      
      return {
        results: searchResults.map(result => ({
          id: result.id,
          score: result.score || 1.0,
          payload: result.payload
        })),
        total: searchResults.length,
        searchTime
      };
      
    } catch (error) {
      this.logger.error('Filtered search execution failed', { error: error.message });
      throw error;
    }
  }

  async generateFacets(searchQuery, appliedFilters, options = {}) {
    const startTime = Date.now();
    const requestedFacets = options.facets || Object.keys(this.facetDefinitions);
    const facets = {};
    
    try {
      // Generate facets for each requested facet type
      for (const facetName of requestedFacets) {
        const facetDef = this.facetDefinitions[facetName];
        if (!facetDef) continue;
        
        // Skip if this facet is already filtered (unless explicitly requested)
        if (appliedFilters[facetName] && !options.includeFilteredFacets) {
          continue;
        }
        
        try {
          facets[facetName] = await this.generateSingleFacet(
            facetName, 
            facetDef, 
            searchQuery, 
            appliedFilters,
            options
          );
        } catch (error) {
          this.logger.warn(`Failed to generate facet ${facetName}`, { error: error.message });
          facets[facetName] = { 
            error: error.message,
            type: facetDef.type,
            displayName: facetDef.displayName
          };
        }
      }
      
      const computationTime = Date.now() - startTime;
      
      return {
        ...facets,
        computationTime,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.error('Facet generation failed', { error: error.message });
      return { error: error.message, computationTime: Date.now() - startTime };
    }
  }

  async generateSingleFacet(facetName, facetDef, searchQuery, appliedFilters, options) {
    // Check cache first
    const cacheKey = this.generateFacetCacheKey(facetName, searchQuery, appliedFilters);
    const cached = await this.getCachedFacet(cacheKey);
    if (cached) {
      return cached;
    }
    
    let facetData;
    
    switch (facetDef.type) {
      case 'categorical':
      case 'multi_categorical':
        facetData = await this.generateCategoricalFacet(facetName, facetDef, searchQuery, appliedFilters);
        break;
        
      case 'ordinal':
        facetData = await this.generateOrdinalFacet(facetName, facetDef, searchQuery, appliedFilters);
        break;
        
      case 'numeric':
        facetData = await this.generateNumericFacet(facetName, facetDef, searchQuery, appliedFilters);
        break;
        
      case 'temporal':
        facetData = await this.generateTemporalFacet(facetName, facetDef, searchQuery, appliedFilters);
        break;
        
      case 'hierarchical':
        facetData = await this.generateHierarchicalFacet(facetName, facetDef, searchQuery, appliedFilters);
        break;
        
      default:
        throw new Error(`Unsupported facet type: ${facetDef.type}`);
    }
    
    // Add metadata
    facetData.metadata = {
      type: facetDef.type,
      displayName: facetDef.displayName,
      description: facetDef.description,
      multiSelect: facetDef.multiSelect,
      field: facetDef.field
    };
    
    // Cache result
    await this.cacheFacet(cacheKey, facetData);
    
    return facetData;
  }

  async generateCategoricalFacet(facetName, facetDef, searchQuery, appliedFilters) {
    // Create a modified query excluding the current facet filter
    const facetQuery = { ...searchQuery };
    const modifiedFilters = { ...searchQuery.filters };
    
    // Remove current facet from filters to get accurate counts
    if (modifiedFilters.must) {
      modifiedFilters.must = modifiedFilters.must.filter(condition => 
        condition.key !== facetDef.field
      );
    }
    
    facetQuery.filters = modifiedFilters;
    
    // Aggregate values
    const aggregationResults = await this.aggregateField(
      facetDef.field,
      facetQuery,
      {
        maxValues: facetDef.maxValues,
        sortBy: facetDef.sortBy,
        type: facetDef.type
      }
    );
    
    // Format results
    const values = aggregationResults.map(result => ({
      value: result.value,
      count: result.count,
      selected: this.isValueSelected(facetName, result.value, appliedFilters),
      displayValue: this.formatDisplayValue(result.value, facetDef)
    }));
    
    return {
      values,
      totalValues: aggregationResults.length,
      selectedCount: values.filter(v => v.selected).length
    };
  }

  async generateOrdinalFacet(facetName, facetDef, searchQuery, appliedFilters) {
    const ranges = facetDef.ranges.map(range => ({
      ...range,
      count: 0,
      selected: this.isRangeSelected(facetName, range, appliedFilters)
    }));
    
    // Count items in each range
    for (const range of ranges) {
      const rangeQuery = {
        ...searchQuery,
        filters: {
          ...searchQuery.filters,
          must: [
            ...(searchQuery.filters.must || []),
            this.buildRangeCondition(facetDef.field, range)
          ]
        }
      };
      
      const count = await this.countResults(rangeQuery);
      range.count = count;
    }
    
    return {
      ranges,
      selectedRanges: ranges.filter(r => r.selected)
    };
  }

  async generateNumericFacet(facetName, facetDef, searchQuery, appliedFilters) {
    // Get min/max values and create histogram
    const stats = await this.getFieldStatistics(facetDef.field, searchQuery);
    
    const bucketSize = (stats.max - stats.min) / facetDef.buckets;
    const buckets = [];
    
    for (let i = 0; i < facetDef.buckets; i++) {
      const min = stats.min + (i * bucketSize);
      const max = i === facetDef.buckets - 1 ? stats.max : min + bucketSize;
      
      const bucketQuery = {
        ...searchQuery,
        filters: {
          ...searchQuery.filters,
          must: [
            ...(searchQuery.filters.must || []),
            { key: facetDef.field, range: { gte: min, lt: max } }
          ]
        }
      };
      
      const count = await this.countResults(bucketQuery);
      
      buckets.push({
        min,
        max,
        count,
        label: `${min.toFixed(2)} - ${max.toFixed(2)}`
      });
    }
    
    return {
      buckets,
      statistics: stats,
      distribution: facetDef.distribution
    };
  }

  async generateTemporalFacet(facetName, facetDef, searchQuery, appliedFilters) {
    const now = Date.now();
    const ranges = facetDef.ranges.map(range => {
      const rangeStart = range.days ? now - (range.days * 24 * 60 * 60 * 1000) : 0;
      const rangeEnd = now;
      
      return {
        ...range,
        startDate: rangeStart,
        endDate: rangeEnd,
        count: 0,
        selected: this.isTemporalRangeSelected(facetName, range, appliedFilters)
      };
    });
    
    // Count items in each time range
    for (const range of ranges) {
      const rangeQuery = {
        ...searchQuery,
        filters: {
          ...searchQuery.filters,
          must: [
            ...(searchQuery.filters.must || []),
            { key: facetDef.field, range: { gte: range.startDate, lte: range.endDate } }
          ]
        }
      };
      
      const count = await this.countResults(rangeQuery);
      range.count = count;
    }
    
    return {
      ranges,
      selectedRanges: ranges.filter(r => r.selected)
    };
  }

  async generateHierarchicalFacet(facetName, facetDef, searchQuery, appliedFilters) {
    // Build hierarchical structure
    const hierarchy = await this.buildHierarchy(facetDef.field, searchQuery, facetDef);
    
    return {
      hierarchy,
      maxDepth: facetDef.maxDepth,
      expandedNodes: this.getExpandedNodes(facetName, appliedFilters)
    };
  }

  async applyPostSearchFiltering(searchResults, filters) {
    // Apply any filters that couldn't be handled at the database level
    let filteredResults = [...searchResults.results];
    
    // Apply custom filters or complex conditions
    for (const [facetName, filter] of Object.entries(filters)) {
      if (filter.postProcess) {
        filteredResults = await this.applyPostProcessFilter(
          filteredResults, 
          facetName, 
          filter
        );
      }
    }
    
    return {
      results: filteredResults,
      total: filteredResults.length,
      originalTotal: searchResults.total
    };
  }

  async getAvailableFilters(results) {
    // Analyze current results to suggest available filters
    const availableFilters = {};
    
    for (const [facetName, facetDef] of Object.entries(this.facetDefinitions)) {
      const values = await this.extractUniqueValues(results, facetDef.field);
      
      if (values.length > 0) {
        availableFilters[facetName] = {
          type: facetDef.type,
          displayName: facetDef.displayName,
          valueCount: values.length,
          sampleValues: values.slice(0, 5),
          operators: this.filterOperators[facetDef.type] || []
        };
      }
    }
    
    return availableFilters;
  }

  async generateFilterSuggestions(query, appliedFilters) {
    const suggestions = [];
    
    // Suggest filters based on query content
    if (query) {
      const queryLower = query.toLowerCase();
      
      // Suggest provider filters
      const providers = ['openai', 'anthropic', 'google', 'meta', 'microsoft'];
      const mentionedProviders = providers.filter(p => queryLower.includes(p));
      
      mentionedProviders.forEach(provider => {
        if (!appliedFilters.provider) {
          suggestions.push({
            facet: 'provider',
            operator: 'equals',
            value: provider,
            reason: `Query mentions ${provider}`,
            confidence: 0.8
          });
        }
      });
      
      // Suggest task-based filters
      const tasks = ['generation', 'classification', 'summarization', 'translation'];
      const mentionedTasks = tasks.filter(task => queryLower.includes(task));
      
      mentionedTasks.forEach(task => {
        if (!appliedFilters.task_category) {
          suggestions.push({
            facet: 'task_category',
            operator: 'contains',
            value: task,
            reason: `Query indicates ${task} task`,
            confidence: 0.7
          });
        }
      });
    }
    
    // Suggest popular filter combinations
    const popularCombinations = await this.getPopularFilterCombinations();
    suggestions.push(...popularCombinations.slice(0, 3));
    
    return suggestions.slice(0, 10);
  }

  // Helper methods
  generateFacetCacheKey(facetName, searchQuery, appliedFilters) {
    const keyData = {
      facet: facetName,
      query: searchQuery.text || '',
      filters: JSON.stringify(appliedFilters)
    };
    
    return `facet:${Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 32)}`;
  }

  async getCachedFacet(cacheKey) {
    try {
      const cached = await cacheManager.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minutes cache
        return cached;
      }
    } catch (error) {
      this.logger.debug('Facet cache lookup failed', { error: error.message });
    }
    return null;
  }

  async cacheFacet(cacheKey, facetData) {
    try {
      await cacheManager.set(cacheKey, {
        ...facetData,
        timestamp: Date.now()
      }, 300); // 5 minutes
    } catch (error) {
      this.logger.debug('Failed to cache facet', { error: error.message });
    }
  }

  isValueSelected(facetName, value, appliedFilters) {
    const filter = appliedFilters[facetName];
    if (!filter) return false;
    
    if (filter.value === value) return true;
    if (filter.values && filter.values.includes(value)) return true;
    
    return false;
  }

  isRangeSelected(facetName, range, appliedFilters) {
    const filter = appliedFilters[facetName];
    if (!filter || !filter.range) return false;
    
    return filter.range.min === range.min && filter.range.max === range.max;
  }

  isTemporalRangeSelected(facetName, range, appliedFilters) {
    const filter = appliedFilters[facetName];
    if (!filter) return false;
    
    return filter.days === range.days;
  }

  formatDisplayValue(value, facetDef) {
    // Format values for display based on facet type
    if (typeof value === 'string') {
      return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return String(value);
  }

  buildRangeCondition(field, range) {
    const condition = { key: field, range: {} };
    
    if (range.min !== undefined && range.min !== null) {
      condition.range.gte = range.min;
    }
    
    if (range.max !== undefined && range.max !== null) {
      condition.range.lte = range.max;
    }
    
    return condition;
  }

  // Placeholder methods for complex operations
  async initializeFacetAggregators() { /* Implementation details */ }
  async buildFacetIndexes() { /* Implementation details */ }
  async initializeFilterValidation() { /* Implementation details */ }
  async setupFacetCaching() { /* Implementation details */ }
  async precomputeCommonFacets() { /* Implementation details */ }
  async aggregateField(field, query, options) {
    // Mock aggregation - would use actual database aggregation
    return [
      { value: 'openai', count: 25 },
      { value: 'anthropic', count: 18 },
      { value: 'google', count: 15 },
      { value: 'meta', count: 12 }
    ];
  }
  async countResults(query) {
    // Mock count - would use actual database count
    return Math.floor(Math.random() * 100) + 1;
  }
  async getFieldStatistics(field, query) {
    // Mock statistics - would compute actual stats
    return { min: 0, max: 1, avg: 0.7, count: 100 };
  }
  async buildHierarchy(field, query, facetDef) {
    // Mock hierarchy - would build actual hierarchical structure
    return [
      { value: 'text', count: 50, children: [
        { value: 'generation', count: 30 },
        { value: 'classification', count: 20 }
      ]},
      { value: 'multimodal', count: 25, children: [] }
    ];
  }
  getExpandedNodes(facetName, appliedFilters) { return []; }
  async applyPostProcessFilter(results, facetName, filter) { return results; }
  async extractUniqueValues(results, field) {
    return [...new Set(results.map(r => r.payload?.[field]).filter(Boolean))];
  }
  async getPopularFilterCombinations() { return []; }

  getStats() {
    return {
      initialized: this.isInitialized,
      facetCache: this.facetCache.size,
      filterCache: this.filterCache.size,
      facetDefinitions: Object.keys(this.facetDefinitions).length,
      supportedOperators: Object.keys(this.filterOperators).length,
      facetTypes: [...new Set(Object.values(this.facetDefinitions).map(f => f.type))]
    };
  }

  async cleanup() {
    this.facetCache.clear();
    this.filterCache.clear();
    this.isInitialized = false;
    this.logger.info('Faceted search engine cleaned up');
  }
}

export const facetedSearch = new FacetedSearchEngine();