import { createLogger } from '../../core/infrastructure/logger.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { cacheManager } from '../../core/storage/cache.js';

class LlamaIndexKnowledgeBase {
  constructor() {
    this.logger = createLogger({ component: 'knowledge-base' });
    this.isInitialized = false;
    this.documents = new Map();
    this.indices = new Map();
    this.queryCache = new Map();
    
    // Knowledge base configuration
    this.knowledgeConfig = {
      chunkSize: 512,
      chunkOverlap: 50,
      maxDocuments: 10000,
      indexRefreshInterval: 60 * 60 * 1000, // 1 hour
      cacheTimeout: 30 * 60 * 1000, // 30 minutes
      similarity_threshold: 0.7,
      max_results: 20
    };
    
    // Document types for model knowledge
    this.documentTypes = {
      'model_metadata': {
        collection: 'model_metadata',
        priority: 'high',
        fields: ['name', 'description', 'capabilities', 'parameters', 'performance'],
        embedding_strategy: 'comprehensive'
      },
      'provider_documentation': {
        collection: 'provider_docs',
        priority: 'medium',
        fields: ['provider', 'api_reference', 'usage_examples', 'limitations'],
        embedding_strategy: 'contextual'
      },
      'performance_benchmarks': {
        collection: 'benchmarks',
        priority: 'high',
        fields: ['model_name', 'task_type', 'metrics', 'comparison_data'],
        embedding_strategy: 'metric_focused'
      },
      'user_feedback': {
        collection: 'feedback',
        priority: 'medium',
        fields: ['model_name', 'user_experience', 'use_case', 'rating'],
        embedding_strategy: 'sentiment_aware'
      },
      'technical_specifications': {
        collection: 'tech_specs',
        priority: 'high',
        fields: ['architecture', 'training_data', 'hardware_requirements', 'api_details'],
        embedding_strategy: 'technical'
      }
    };
    
    // Index types for different query patterns
    this.indexTypes = {
      'vector_index': {
        description: 'Dense vector similarity search',
        use_cases: ['semantic_search', 'model_similarity', 'capability_matching'],
        implementation: this.createVectorIndex.bind(this)
      },
      'keyword_index': {
        description: 'Keyword-based exact matching',
        use_cases: ['specific_model_lookup', 'provider_filtering', 'exact_capability_match'],
        implementation: this.createKeywordIndex.bind(this)
      },
      'hybrid_index': {
        description: 'Combined vector and keyword search',
        use_cases: ['complex_queries', 'multi_criteria_search', 'ranking_optimization'],
        implementation: this.createHybridIndex.bind(this)
      },
      'graph_index': {
        description: 'Knowledge graph relationships',
        use_cases: ['model_relationships', 'provider_ecosystems', 'capability_hierarchies'],
        implementation: this.createGraphIndex.bind(this)
      }
    };
    
    // Query processing strategies
    this.queryStrategies = {
      'direct_lookup': {
        description: 'Direct model or provider lookup',
        pattern: /^(find|get|show)\s+(model|provider)\s+(.+)/i,
        processor: this.processDirectLookup.bind(this)
      },
      'capability_search': {
        description: 'Search by model capabilities',
        pattern: /^.*(can|capable|ability|feature|support).*/i,
        processor: this.processCapabilitySearch.bind(this)
      },
      'comparison_query': {
        description: 'Compare models or providers',
        pattern: /^.*(compare|versus|vs|better|best).*/i,
        processor: this.processComparisonQuery.bind(this)
      },
      'recommendation_request': {
        description: 'Model recommendations for use cases',
        pattern: /^.*(recommend|suggest|best\s+for|suitable).*/i,
        processor: this.processRecommendationRequest.bind(this)
      },
      'technical_inquiry': {
        description: 'Technical specifications and details',
        pattern: /^.*(spec|architecture|parameter|size|requirement).*/i,
        processor: this.processTechnicalInquiry.bind(this)
      }
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing LlamaIndex knowledge base');
      
      // Initialize document storage
      await this.initializeDocumentStorage();
      
      // Load existing documents
      await this.loadExistingDocuments();
      
      // Create and build indices
      await this.buildKnowledgeIndices();
      
      // Initialize query processing
      await this.initializeQueryProcessing();
      
      // Setup knowledge base maintenance
      await this.setupKnowledgeMaintenance();
      
      this.isInitialized = true;
      this.logger.info('LlamaIndex knowledge base initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize knowledge base', { error: error.message });
      throw error;
    }
  }

  async addDocument(documentType, content, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Knowledge base not initialized');
    }

    try {
      const docTypeConfig = this.documentTypes[documentType];
      if (!docTypeConfig) {
        throw new Error(`Unknown document type: ${documentType}`);
      }

      this.logger.debug('Adding document to knowledge base', {
        type: documentType,
        content_length: typeof content === 'string' ? content.length : 'object',
        metadata_keys: Object.keys(metadata).length
      });

      // Generate document ID
      const documentId = this.generateDocumentId(documentType, content, metadata);

      // Process document content
      const processedContent = await this.processDocumentContent(content, docTypeConfig);

      // Create document chunks
      const chunks = await this.createDocumentChunks(processedContent, docTypeConfig);

      // Generate embeddings for chunks
      const embeddings = await this.generateChunkEmbeddings(chunks, docTypeConfig.embedding_strategy);

      // Create document object
      const document = {
        id: documentId,
        type: documentType,
        content: processedContent,
        chunks: chunks,
        embeddings: embeddings,
        metadata: {
          ...metadata,
          added_at: Date.now(),
          chunk_count: chunks.length,
          embedding_strategy: docTypeConfig.embedding_strategy,
          priority: docTypeConfig.priority
        }
      };

      // Store document
      await this.storeDocument(document);

      // Update indices
      await this.updateIndicesWithDocument(document);

      // Cache document for quick access
      this.documents.set(documentId, document);

      this.logger.info('Document added to knowledge base', {
        document_id: documentId,
        type: documentType,
        chunks: chunks.length,
        priority: docTypeConfig.priority
      });

      return documentId;

    } catch (error) {
      this.logger.error('Failed to add document to knowledge base', { 
        type: documentType, 
        error: error.message 
      });
      throw error;
    }
  }

  async queryKnowledgeBase(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Knowledge base not initialized');
    }

    try {
      this.logger.debug('Querying knowledge base', {
        query: query.substring(0, 100),
        options: Object.keys(options)
      });

      // Check query cache
      const cacheKey = this.generateQueryCacheKey(query, options);
      const cached = this.queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this .knowledgeConfig.cacheTimeout) {
        this.logger.debug('Returning cached query result');
        return cached.result;
      }

      const startTime = Date.now();

      // Determine query strategy
      const strategy = this.determineQueryStrategy(query);
      
      // Process query based on strategy
      const queryResult = await strategy.processor(query, options);

      // Enhance results with additional context
      const enhancedResult = await this.enhanceQueryResult(queryResult, query, options);

      // Calculate confidence score
      enhancedResult.confidence = this.calculateQueryConfidence(enhancedResult, query);
      enhancedResult.processing_time = Date.now() - startTime;

      // Cache result
      this.queryCache.set(cacheKey, {
        result: enhancedResult,
        timestamp: Date.now()
      });

      this.logger.debug('Knowledge base query completed', {
        strategy: strategy.description,
        results_count: enhancedResult.results?.length || 0,
        confidence: enhancedResult.confidence,
        processing_time: enhancedResult.processing_time
      });

      return enhancedResult;

    } catch (error) {
      this.logger.error('Knowledge base query failed', { query, error: error.message });
      return {
        query: query,
        results: [],
        error: error.message,
        confidence: 0,
        strategy: 'error_fallback'
      };
    }
  }

  async updateDocument(documentId, updates) {
    try {
      const document = this.documents.get(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      this.logger.info('Updating document in knowledge base', { documentId });

      // Update document content
      const updatedDocument = {
        ...document,
        ...updates,
        metadata: {
          ...document.metadata,
          ...updates.metadata,
          updated_at: Date.now(),
          version: (document.metadata.version || 1) + 1
        }
      };

      // Regenerate chunks and embeddings if content changed
      if (updates.content) {
        const docTypeConfig = this.documentTypes[document.type];
        updatedDocument.chunks = await this.createDocumentChunks(updates.content, docTypeConfig);
        updatedDocument.embeddings = await this.generateChunkEmbeddings(
          updatedDocument.chunks, 
          docTypeConfig.embedding_strategy
        );
      }

      // Store updated document
      await this.storeDocument(updatedDocument);

      // Update indices
      await this.updateIndicesWithDocument(updatedDocument);

      // Update cache
      this.documents.set(documentId, updatedDocument);

      this.logger.info('Document updated successfully', { 
        documentId, 
        version: updatedDocument.metadata.version 
      });

      return updatedDocument;

    } catch (error) {
      this.logger.error('Failed to update document', { documentId, error: error.message });
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      const document = this.documents.get(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      this.logger.info('Deleting document from knowledge base', { documentId });

      // Remove from indices
      await this.removeDocumentFromIndices(document);

      // Remove from storage
      await this.removeDocumentFromStorage(documentId);

      // Remove from cache
      this.documents.delete(documentId);

      this.logger.info('Document deleted successfully', { documentId });

    } catch (error) {
      this.logger.error('Failed to delete document', { documentId, error: error.message });
      throw error;
    }
  }

  // Query strategy processors
  async processDirectLookup(query, options) {
    const match = query.match(/^(find|get|show)\s+(model|provider)\s+(.+)/i);
    if (!match) return { results: [], strategy: 'direct_lookup' };

    const [, action, type, target] = match;
    
    // Search for exact matches first
    const exactMatches = await this.searchByExactMatch(type, target);
    
    // If no exact matches, use fuzzy search
    if (exactMatches.length === 0) {
      const fuzzyMatches = await this.searchByFuzzyMatch(type, target);
      return {
        results: fuzzyMatches,
        strategy: 'direct_lookup_fuzzy',
        search_target: target,
        search_type: type
      };
    }

    return {
      results: exactMatches,
      strategy: 'direct_lookup_exact',
      search_target: target,
      search_type: type
    };
  }

  async processCapabilitySearch(query, options) {
    // Extract capability terms from query
    const capabilityTerms = this.extractCapabilityTerms(query);
    
    if (capabilityTerms.length === 0) {
      return { results: [], strategy: 'capability_search', error: 'No capabilities detected' };
    }

    // Search documents by capabilities
    const results = [];
    
    for (const capability of capabilityTerms) {
      const capabilityResults = await this.searchByCapability(capability, options);
      results.push(...capabilityResults);
    }

    // Deduplicate and rank results
    const deduplicatedResults = this.deduplicateResults(results);
    const rankedResults = this.rankResultsByRelevance(deduplicatedResults, capabilityTerms);

    return {
      results: rankedResults,
      strategy: 'capability_search',
      capabilities_searched: capabilityTerms,
      total_matches: results.length
    };
  }

  async processComparisonQuery(query, options) {
    // Extract entities to compare
    const entities = this.extractComparisonEntities(query);
    
    if (entities.length < 2) {
      return { results: [], strategy: 'comparison_query', error: 'Need at least 2 entities to compare' };
    }

    // Get detailed information for each entity
    const entityDetails = await Promise.all(
      entities.map(entity => this.getEntityDetails(entity))
    );

    // Perform comparison analysis
    const comparison = await this.performComparativeAnalysis(entityDetails);

    return {
      results: [comparison],
      strategy: 'comparison_query',
      entities_compared: entities,
      comparison_aspects: comparison.aspects
    };
  }

  async processRecommendationRequest(query, options) {
    // Extract use case and requirements
    const useCase = this.extractUseCase(query);
    const requirements = this.extractRequirements(query);

    // Find models matching the use case
    const candidates = await this.findModelCandidates(useCase, requirements);

    // Rank candidates by suitability
    const recommendations = await this.rankRecommendations(candidates, useCase, requirements);

    return {
      results: recommendations,
      strategy: 'recommendation_request',
      use_case: useCase,
      requirements: requirements,
      candidates_evaluated: candidates.length
    };
  }

  async processTechnicalInquiry(query, options) {
    // Extract technical aspects being queried
    const technicalAspects = this.extractTechnicalAspects(query);
    const targetEntity = this.extractTargetEntity(query);

    if (!targetEntity) {
      return { results: [], strategy: 'technical_inquiry', error: 'No target entity specified' };
    }

    // Get technical specifications
    const techSpecs = await this.getTechnicalSpecifications(targetEntity, technicalAspects);

    return {
      results: techSpecs,
      strategy: 'technical_inquiry',
      target_entity: targetEntity,
      technical_aspects: technicalAspects
    };
  }

  // Index creation methods
  async createVectorIndex(documents) {
    this.logger.info('Creating vector index');
    
    const vectorIndex = {
      type: 'vector_index',
      documents: new Map(),
      embeddings: [],
      metadata: [],
      created_at: Date.now()
    };

    for (const document of documents) {
      if (document.embeddings && document.embeddings.length > 0) {
        vectorIndex.documents.set(document.id, document);
        vectorIndex.embeddings.push(...document.embeddings);
        vectorIndex.metadata.push(...document.chunks.map((chunk, index) => ({
          document_id: document.id,
          chunk_index: index,
          content: chunk.content,
          type: document.type
        })));
      }
    }

    return vectorIndex;
  }

  async createKeywordIndex(documents) {
    this.logger.info('Creating keyword index');
    
    const keywordIndex = {
      type: 'keyword_index',
      keywords: new Map(),
      documents: new Map(),
      created_at: Date.now()
    };

    for (const document of documents) {
      keywordIndex.documents.set(document.id, document);
      
      // Extract keywords from document
      const keywords = this.extractKeywords(document);
      
      for (const keyword of keywords) {
        if (!keywordIndex.keywords.has(keyword)) {
          keywordIndex.keywords.set(keyword, []);
        }
        keywordIndex.keywords.get(keyword).push({
          document_id: document.id,
          relevance: this.calculateKeywordRelevance(keyword, document)
        });
      }
    }

    return keywordIndex;
  }

  async createHybridIndex(documents) {
    this.logger.info('Creating hybrid index');
    
    const vectorIndex = await this.createVectorIndex(documents);
    const keywordIndex = await this.createKeywordIndex(documents);

    return {
      type: 'hybrid_index',
      vector_index: vectorIndex,
      keyword_index: keywordIndex,
      created_at: Date.now()
    };
  }

  async createGraphIndex(documents) {
    this.logger.info('Creating graph index');
    
    const graphIndex = {
      type: 'graph_index',
      nodes: new Map(),
      edges: new Map(),
      relationships: {
        'provider_to_model': new Map(),
        'model_to_capability': new Map(),
        'capability_to_use_case': new Map(),
        'model_similarity': new Map()
      },
      created_at: Date.now()
    };

    // Build graph relationships
    for (const document of documents) {
      await this.addDocumentToGraph(document, graphIndex);
    }

    return graphIndex;
  }

  // Helper methods
  generateDocumentId(type, content, metadata) {
    const data = {
      type,
      content: typeof content === 'string' ? content.substring(0, 100) : JSON.stringify(content).substring(0, 100),
      timestamp: Date.now(),
      metadata_hash: metadata ? JSON.stringify(metadata) : ''
    };
    
    return `doc_${Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16)}`;
  }

  async processDocumentContent(content, docTypeConfig) {
    if (typeof content === 'string') {
      return content;
    }
    
    // Extract relevant fields based on document type
    const relevantContent = {};
    for (const field of docTypeConfig.fields) {
      if (content[field]) {
        relevantContent[field] = content[field];
      }
    }
    
    return relevantContent;
  }

  async createDocumentChunks(content, docTypeConfig) {
    const textContent = typeof content === 'string' ? 
      content : 
      Object.values(content).join(' ');

    const chunks = [];
    const chunkSize = this.knowledgeConfig.chunkSize;
    const overlap = this.knowledgeConfig.chunkOverlap;

    for (let i = 0; i < textContent.length; i += chunkSize - overlap) {
      const chunk = {
        content: textContent.slice(i, i + chunkSize),
        start_pos: i,
        end_pos: Math.min(i + chunkSize, textContent.length),
        chunk_id: `chunk_${chunks.length}`,
        size: Math.min(chunkSize, textContent.length - i)
      };
      chunks.push(chunk);
      
      if (i + chunkSize >= textContent.length) break;
    }

    return chunks;
  }

  async generateChunkEmbeddings(chunks, strategy) {
    const embeddings = [];
    
    for (const chunk of chunks) {
      try {
        const embedding = await embeddingsManager.generateEmbedding(chunk.content);
        embeddings.push({
          chunk_id: chunk.chunk_id,
          embedding: embedding,
          strategy: strategy,
          generated_at: Date.now()
        });
      } catch (error) {
        this.logger.warn(`Failed to generate embedding for chunk ${chunk.chunk_id}`, { error: error.message });
      }
    }

    return embeddings;
  }

  determineQueryStrategy(query) {
    for (const [strategyName, strategy] of Object.entries(this.queryStrategies)) {
      if (strategy.pattern.test(query)) {
        return strategy;
      }
    }
    
    // Default to semantic search if no pattern matches
    return {
      description: 'Semantic search fallback',
      processor: this.processSemanticSearch.bind(this)
    };
  }

  async processSemanticSearch(query, options) {
    // Generate query embedding
    const queryEmbedding = await embeddingsManager.generateEmbedding(query);
    
    // Search vector index
    const vectorIndex = this.indices.get('vector_index');
    if (!vectorIndex) {
      return { results: [], strategy: 'semantic_search', error: 'Vector index not available' };
    }
    
    // Find most similar embeddings
    const similarities = [];
    for (let i = 0; i < vectorIndex.embeddings.length; i++) {
      const similarity = this.calculateCosineSimilarity(queryEmbedding, vectorIndex.embeddings[i]);
      if (similarity >= this.knowledgeConfig.similarity_threshold) {
        similarities.push({
          similarity: similarity,
          metadata: vectorIndex.metadata[i],
          index: i
        });
      }
    }
    
    // Sort by similarity and limit results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, this.knowledgeConfig.max_results);
    
    return {
      results: topResults,
      strategy: 'semantic_search',
      query_embedding_generated: true,
      similarity_threshold: this.knowledgeConfig.similarity_threshold
    };
  }

  calculateCosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  generateQueryCacheKey(query, options) {
    const keyData = {
      query: query.toLowerCase().trim(),
      options: JSON.stringify(options),
      timestamp: Math.floor(Date.now() / this.knowledgeConfig.cacheTimeout)
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 32);
  }

  calculateQueryConfidence(result, query) {
    if (!result.results || result.results.length === 0) return 0;
    
    let confidence = 0.5; // Base confidence
    
    // Adjust based on result count
    confidence += Math.min(0.3, result.results.length / 10);
    
    // Adjust based on strategy match
    if (result.strategy.includes('exact')) confidence += 0.2;
    if (result.strategy.includes('fuzzy')) confidence += 0.1;
    
    // Adjust based on similarity scores if available
    if (result.results[0]?.similarity) {
      confidence += result.results[0].similarity * 0.3;
    }
    
    return Math.min(1, confidence);
  }

  // Placeholder methods for complex operations
  async initializeDocumentStorage() { /* Implementation details */ }
  async loadExistingDocuments() { /* Implementation details */ }
  async buildKnowledgeIndices() { /* Implementation details */ }
  async initializeQueryProcessing() { /* Implementation details */ }
  async setupKnowledgeMaintenance() { /* Implementation details */ }
  async storeDocument(document) { /* Implementation details */ }
  async updateIndicesWithDocument(document) { /* Implementation details */ }
  async enhanceQueryResult(result, query, options) { return result; }
  async searchByExactMatch(type, target) { return []; }
  async searchByFuzzyMatch(type, target) { return []; }
  extractCapabilityTerms(query) { return []; }
  async searchByCapability(capability, options) { return []; }
  deduplicateResults(results) { return results; }
  rankResultsByRelevance(results, terms) { return results; }
  extractComparisonEntities(query) { return []; }
  async getEntityDetails(entity) { return {}; }
  async performComparativeAnalysis(details) { return {}; }
  extractUseCase(query) { return ''; }
  extractRequirements(query) { return []; }
  async findModelCandidates(useCase, requirements) { return []; }
  async rankRecommendations(candidates, useCase, requirements) { return candidates; }
  extractTechnicalAspects(query) { return []; }
  extractTargetEntity(query) { return null; }
  async getTechnicalSpecifications(entity, aspects) { return []; }
  extractKeywords(document) { return []; }
  calculateKeywordRelevance(keyword, document) { return 0.5; }
  async addDocumentToGraph(document, graph) { /* Implementation details */ }
  async removeDocumentFromIndices(document) { /* Implementation details */ }
  async removeDocumentFromStorage(documentId) { /* Implementation details */ }

  getStats() {
    return {
      initialized: this.isInitialized,
      documents: this.documents.size,
      indices: this.indices.size,
      query_cache: this.queryCache.size,
      document_types: Object.keys(this.documentTypes).length,
      index_types: Object.keys(this.indexTypes).length,
      query_strategies: Object.keys(this.queryStrategies).length
    };
  }

  async cleanup() {
    this.documents.clear();
    this.indices.clear();
    this.queryCache.clear();
    this.isInitialized = false;
    this.logger.info('LlamaIndex knowledge base cleaned up');
  }
}

export const knowledgeBase = new LlamaIndexKnowledgeBase();