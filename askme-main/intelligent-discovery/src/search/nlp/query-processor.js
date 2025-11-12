import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';

class NaturalLanguageQueryProcessor {
  constructor() {
    this.logger = createLogger({ component: 'query-processor' });
    this.isInitialized = false;
    this.queryCache = new Map();
    this.intentCache = new Map();
    
    // Query processing pipeline stages
    this.processingStages = {
      tokenization: this.tokenizeQuery.bind(this),
      normalization: this.normalizeQuery.bind(this),
      intent_detection: this.detectIntent.bind(this),
      entity_extraction: this.extractEntities.bind(this),
      query_expansion: this.expandQuery.bind(this),
      context_enrichment: this.enrichContext.bind(this),
      semantic_parsing: this.parseSemantics.bind(this)
    };
    
    // Intent patterns and their confidence scores
    this.intentPatterns = {
      search: {
        patterns: [
          /\b(?:find|search|look for|show me|get me)\b/i,
          /\b(?:what|which|where)\b.*\b(?:is|are)\b/i,
          /\b(?:list|display)\b/i
        ],
        confidence: 0.9,
        keywords: ['find', 'search', 'show', 'list', 'what', 'which', 'where']
      },
      recommendation: {
        patterns: [
          /\b(?:recommend|suggest|best|top|good)\b/i,
          /\b(?:what.*should|which.*better)\b/i,
          /\b(?:help me choose|help me pick)\b/i
        ],
        confidence: 0.85,
        keywords: ['recommend', 'suggest', 'best', 'top', 'better', 'choose']
      },
      comparison: {
        patterns: [
          /\b(?:compare|vs|versus|difference|better than)\b/i,
          /\b(?:pros and cons|advantages|disadvantages)\b/i,
          /\b(?:which is better|what's the difference)\b/i
        ],
        confidence: 0.8,
        keywords: ['compare', 'vs', 'versus', 'difference', 'better', 'pros', 'cons']
      },
      explanation: {
        patterns: [
          /\b(?:explain|what is|how does|why|how to)\b/i,
          /\b(?:definition|meaning|purpose)\b/i,
          /\b(?:tell me about|describe)\b/i
        ],
        confidence: 0.75,
        keywords: ['explain', 'what', 'how', 'why', 'definition', 'meaning']
      },
      generation: {
        patterns: [
          /\b(?:generate|create|make|produce|build)\b/i,
          /\b(?:write|compose|draft)\b/i,
          /\b(?:help me create|help me make)\b/i
        ],
        confidence: 0.8,
        keywords: ['generate', 'create', 'make', 'write', 'compose', 'build']
      },
      analysis: {
        patterns: [
          /\b(?:analyze|examine|study|investigate)\b/i,
          /\b(?:insights|trends|patterns)\b/i,
          /\b(?:performance|metrics|statistics)\b/i
        ],
        confidence: 0.75,
        keywords: ['analyze', 'examine', 'insights', 'trends', 'performance']
      }
    };
    
    // Entity types and recognition patterns
    this.entityTypes = {
      model_name: {
        patterns: [
          /\b(?:GPT-[0-9]+(?:\.[0-9]+)?|Claude(?:-[0-9]+)?|Llama(?:-[0-9]+)?|Gemini|PaLM)\b/gi,
          /\b[A-Z][a-z]+-[A-Z][a-z]+(?:-[0-9]+)?\b/g
        ],
        confidence: 0.9
      },
      provider: {
        patterns: [
          /\b(?:OpenAI|Anthropic|Google|Meta|Microsoft|Hugging ?Face|Cohere|AI21|Replicate)\b/gi
        ],
        confidence: 0.95
      },
      task_type: {
        patterns: [
          /\b(?:text generation|summarization|translation|classification|question answering|code generation|chat|conversation)\b/gi,
          /\b(?:NLP|computer vision|multimodal|embedding|fine-tuning)\b/gi
        ],
        confidence: 0.85
      },
      domain: {
        patterns: [
          /\b(?:healthcare|finance|legal|education|research|business|creative|technical|scientific)\b/gi,
          /\b(?:coding|programming|writing|analysis|medical|financial)\b/gi
        ],
        confidence: 0.8
      },
      capability: {
        patterns: [
          /\b(?:reasoning|creativity|accuracy|speed|multilingual|code|math|logic)\b/gi,
          /\b(?:context length|parameters|training data|performance)\b/gi
        ],
        confidence: 0.75
      },
      metric: {
        patterns: [
          /\b(?:accuracy|precision|recall|F1|BLEU|ROUGE|latency|throughput|cost)\b/gi,
          /\b(?:benchmark|score|rating|performance|efficiency)\b/gi
        ],
        confidence: 0.8
      }
    };
    
    // Query expansion strategies
    this.expansionStrategies = {
      synonyms: this.expandWithSynonyms.bind(this),
      related_terms: this.expandWithRelatedTerms.bind(this),
      domain_terms: this.expandWithDomainTerms.bind(this),
      hierarchical: this.expandHierarchically.bind(this),
      contextual: this.expandContextually.bind(this)
    };
    
    // Semantic roles and patterns
    this.semanticRoles = {
      subject: /^(?:what|which|who)\s+/i,
      predicate: /\b(?:is|are|has|have|can|could|should|would)\b/i,
      object: /\b(?:for|about|with|in|on|at)\s+(.+)$/i,
      modifier: /\b(?:best|top|latest|new|popular|recommended)\b/i,
      constraint: /\b(?:only|except|without|excluding)\b/i
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing natural language query processor');
      
      // Load NLP models and resources
      await this.loadNLPModels();
      
      // Initialize intent classification
      await this.initializeIntentClassification();
      
      // Load entity recognition models
      await this.loadEntityModels();
      
      // Initialize query expansion resources
      await this.initializeExpansionResources();
      
      // Load semantic parsing rules
      await this.loadSemanticRules();
      
      this.isInitialized = true;
      this.logger.info('Natural language query processor initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize query processor', { error: error.message });
      throw error;
    }
  }

  async processQuery(query, context = {}) {
    if (!this.isInitialized) {
      throw new Error('Query processor not initialized');
    }

    try {
      this.logger.debug('Processing natural language query', {
        query: query.substring(0, 100),
        hasContext: Object.keys(context).length > 0
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(query, context);
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      const startTime = Date.now();
      const processedQuery = {
        original: query,
        timestamp: Date.now(),
        context: context,
        processingStages: {}
      };

      // Execute processing pipeline
      for (const [stageName, stageFunction] of Object.entries(this.processingStages)) {
        const stageStartTime = Date.now();
        
        try {
          processedQuery[stageName] = await stageFunction(query, processedQuery, context);
          processedQuery.processingStages[stageName] = {
            success: true,
            duration: Date.now() - stageStartTime
          };
          
        } catch (error) {
          this.logger.warn(`Processing stage ${stageName} failed`, { error: error.message });
          processedQuery.processingStages[stageName] = {
            success: false,
            error: error.message,
            duration: Date.now() - stageStartTime
          };
        }
      }

      // Finalize processing
      processedQuery.processingTime = Date.now() - startTime;
      processedQuery.confidence = this.calculateOverallConfidence(processedQuery);
      processedQuery.suggestions = await this.generateQuerySuggestions(processedQuery);
      
      // Cache result
      await this.cacheResult(cacheKey, processedQuery);
      
      this.logger.debug('Query processing completed', {
        processingTime: processedQuery.processingTime,
        confidence: processedQuery.confidence,
        intent: processedQuery.intent_detection?.intent
      });
      
      return processedQuery;
      
    } catch (error) {
      this.logger.error('Query processing failed', { query, error: error.message });
      throw error;
    }
  }

  async tokenizeQuery(query, processedQuery, context) {
    // Advanced tokenization with linguistic processing
    const tokens = {
      raw: query.split(/\s+/),
      normalized: [],
      filtered: [],
      stems: [],
      pos_tags: [],
      dependencies: []
    };

    // Normalize tokens
    tokens.normalized = tokens.raw.map(token => 
      token.toLowerCase()
        .replace(/[^\w\s'-]/g, '')
        .trim()
    ).filter(token => token.length > 0);

    // Filter stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 
      'above', 'below', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);

    tokens.filtered = tokens.normalized.filter(token => 
      !stopWords.has(token) && token.length > 1
    );

    // Simple stemming (could be enhanced with proper stemming library)
    tokens.stems = tokens.filtered.map(token => this.simpleStem(token));

    // Basic POS tagging patterns
    tokens.pos_tags = tokens.normalized.map(token => this.simplePOSTag(token));

    // Extract n-grams
    tokens.bigrams = this.extractNGrams(tokens.normalized, 2);
    tokens.trigrams = this.extractNGrams(tokens.normalized, 3);

    return tokens;
  }

  async normalizeQuery(query, processedQuery, context) {
    let normalized = query.toLowerCase().trim();
    
    // Expand contractions
    const contractions = {
      "what's": "what is",
      "how's": "how is",
      "where's": "where is",
      "who's": "who is",
      "can't": "cannot",
      "won't": "will not",
      "don't": "do not",
      "doesn't": "does not",
      "didn't": "did not",
      "shouldn't": "should not",
      "wouldn't": "would not",
      "couldn't": "could not"
    };

    Object.entries(contractions).forEach(([contraction, expansion]) => {
      normalized = normalized.replace(new RegExp(`\\b${contraction}\\b`, 'gi'), expansion);
    });

    // Normalize common abbreviations
    const abbreviations = {
      "ai": "artificial intelligence",
      "ml": "machine learning",
      "nlp": "natural language processing",
      "llm": "large language model",
      "api": "application programming interface",
      "gpu": "graphics processing unit",
      "cpu": "central processing unit"
    };

    Object.entries(abbreviations).forEach(([abbrev, full]) => {
      normalized = normalized.replace(new RegExp(`\\b${abbrev}\\b`, 'gi'), full);
    });

    // Remove extra whitespace and punctuation
    normalized = normalized.replace(/\s+/g, ' ').replace(/[^\w\s'-]/g, ' ').trim();

    return {
      normalized,
      original: query,
      transformations: {
        contractions_expanded: Object.keys(contractions).some(c => query.toLowerCase().includes(c)),
        abbreviations_expanded: Object.keys(abbreviations).some(a => query.toLowerCase().includes(a)),
        punctuation_removed: query !== normalized
      }
    };
  }

  async detectIntent(query, processedQuery, context) {
    const intents = [];
    const queryLower = query.toLowerCase();

    // Pattern-based intent detection
    for (const [intentType, intentConfig] of Object.entries(this.intentPatterns)) {
      let maxScore = 0;
      let matchedPatterns = [];

      // Check regex patterns
      for (const pattern of intentConfig.patterns) {
        if (pattern.test(queryLower)) {
          maxScore = Math.max(maxScore, intentConfig.confidence);
          matchedPatterns.push(pattern.source);
        }
      }

      // Check keyword presence
      const keywordMatches = intentConfig.keywords.filter(keyword => 
        queryLower.includes(keyword)
      );
      
      if (keywordMatches.length > 0) {
        const keywordScore = (keywordMatches.length / intentConfig.keywords.length) * 0.7;
        maxScore = Math.max(maxScore, keywordScore);
      }

      if (maxScore > 0.3) {
        intents.push({
          intent: intentType,
          confidence: maxScore,
          matchedPatterns,
          matchedKeywords: keywordMatches,
          evidence: {
            patterns: matchedPatterns.length,
            keywords: keywordMatches.length
          }
        });
      }
    }

    // Sort by confidence and return top intent
    intents.sort((a, b) => b.confidence - a.confidence);
    
    const primaryIntent = intents[0] || {
      intent: 'search',
      confidence: 0.5,
      matchedPatterns: [],
      matchedKeywords: [],
      evidence: { patterns: 0, keywords: 0 }
    };

    // Enhance with contextual information
    if (context.previousQueries) {
      primaryIntent.contextualBoost = this.calculateContextualIntentBoost(
        primaryIntent,
        context.previousQueries
      );
    }

    return {
      primary: primaryIntent,
      alternatives: intents.slice(1, 3),
      allCandidates: intents,
      confidence: primaryIntent.confidence
    };
  }

  async extractEntities(query, processedQuery, context) {
    const entities = [];
    const queryText = query;

    // Extract entities using pattern matching
    for (const [entityType, entityConfig] of Object.entries(this.entityTypes)) {
      for (const pattern of entityConfig.patterns) {
        const matches = [...queryText.matchAll(pattern)];
        
        for (const match of matches) {
          const entityText = match[0];
          const startPos = match.index;
          const endPos = startPos + entityText.length;

          entities.push({
            type: entityType,
            text: entityText,
            normalized: this.normalizeEntity(entityText, entityType),
            confidence: entityConfig.confidence,
            position: { start: startPos, end: endPos },
            context: this.getEntityContext(query, startPos, endPos)
          });
        }
      }
    }

    // Resolve entity relationships
    const resolvedEntities = await this.resolveEntityRelationships(entities);
    
    // Group entities by type
    const entitiesByType = {};
    resolvedEntities.forEach(entity => {
      if (!entitiesByType[entity.type]) {
        entitiesByType[entity.type] = [];
      }
      entitiesByType[entity.type].push(entity);
    });

    return {
      entities: resolvedEntities,
      byType: entitiesByType,
      count: resolvedEntities.length,
      coverage: this.calculateEntityCoverage(query, resolvedEntities)
    };
  }

  async expandQuery(query, processedQuery, context) {
    const expansions = {
      original: query,
      expanded_terms: [],
      strategies_used: [],
      total_expansions: 0
    };

    // Apply expansion strategies
    for (const [strategyName, strategyFunction] of Object.entries(this.expansionStrategies)) {
      try {
        const strategyExpansions = await strategyFunction(query, processedQuery, context);
        
        if (strategyExpansions.length > 0) {
          expansions.expanded_terms.push({
            strategy: strategyName,
            terms: strategyExpansions,
            count: strategyExpansions.length
          });
          expansions.strategies_used.push(strategyName);
          expansions.total_expansions += strategyExpansions.length;
        }
        
      } catch (error) {
        this.logger.warn(`Query expansion strategy ${strategyName} failed`, { error: error.message });
      }
    }

    // Limit total expansions to prevent query explosion
    const maxExpansions = 15;
    if (expansions.total_expansions > maxExpansions) {
      expansions.expanded_terms = this.pruneExpansions(expansions.expanded_terms, maxExpansions);
      expansions.total_expansions = maxExpansions;
    }

    return expansions;
  }

  async enrichContext(query, processedQuery, context) {
    const enrichedContext = {
      ...context,
      query_characteristics: await this.analyzeQueryCharacteristics(query, processedQuery),
      domain_context: await this.inferDomainContext(query, processedQuery),
      user_context: await this.enrichUserContext(context),
      temporal_context: await this.addTemporalContext(context),
      session_context: await this.buildSessionContext(context)
    };

    // Add query complexity metrics
    enrichedContext.complexity = {
      lexical: this.calculateLexicalComplexity(processedQuery.tokenization),
      syntactic: this.calculateSyntacticComplexity(query),
      semantic: this.calculateSemanticComplexity(processedQuery),
      overall: 0
    };

    enrichedContext.complexity.overall = (
      enrichedContext.complexity.lexical * 0.3 +
      enrichedContext.complexity.syntactic * 0.3 +
      enrichedContext.complexity.semantic * 0.4
    );

    return enrichedContext;
  }

  async parseSemantics(query, processedQuery, context) {
    const semanticParse = {
      roles: {},
      relations: [],
      concepts: [],
      structure: null
    };

    // Extract semantic roles
    for (const [role, pattern] of Object.entries(this.semanticRoles)) {
      const match = query.match(pattern);
      if (match) {
        semanticParse.roles[role] = {
          text: match[0],
          position: match.index,
          confidence: 0.8
        };
      }
    }

    // Identify concepts and relationships
    semanticParse.concepts = await this.extractConcepts(query, processedQuery);
    semanticParse.relations = await this.extractRelations(query, processedQuery);

    // Build semantic structure
    semanticParse.structure = await this.buildSemanticStructure(semanticParse, processedQuery);

    return semanticParse;
  }

  // Helper methods for processing stages
  simpleStem(word) {
    // Simple suffix removal stemming
    const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment'];
    
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }
    
    return word;
  }

  simplePOSTag(word) {
    // Simple POS tagging based on patterns
    const posPatterns = {
      'DT': /^(the|a|an|this|that|these|those)$/i,
      'IN': /^(in|on|at|by|for|with|from|to|of|about|through)$/i,
      'VB': /^(is|are|was|were|be|been|being|have|has|had|do|does|did)$/i,
      'WP': /^(what|who|where|when|why|how|which)$/i,
      'JJ': /^.*(able|ful|less|ous|ive|ing|ed)$/i,
      'NN': /^[A-Z]/
    };

    for (const [tag, pattern] of Object.entries(posPatterns)) {
      if (pattern.test(word)) {
        return tag;
      }
    }

    return 'NN'; // Default to noun
  }

  extractNGrams(tokens, n) {
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  normalizeEntity(entityText, entityType) {
    // Normalize entities based on type
    switch (entityType) {
      case 'model_name':
        return entityText.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      case 'provider':
        return entityText.toLowerCase().replace(/\s+/g, '');
      case 'task_type':
        return entityText.toLowerCase().replace(/\s+/g, '_');
      default:
        return entityText.toLowerCase().trim();
    }
  }

  getEntityContext(query, startPos, endPos) {
    const contextWindow = 20;
    const start = Math.max(0, startPos - contextWindow);
    const end = Math.min(query.length, endPos + contextWindow);
    
    return {
      before: query.substring(start, startPos).trim(),
      after: query.substring(endPos, end).trim(),
      full: query.substring(start, end).trim()
    };
  }

  async resolveEntityRelationships(entities) {
    // Simple entity relationship resolution
    const resolved = [...entities];
    
    // Mark entities that are likely related
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const entity1 = resolved[i];
        const entity2 = resolved[j];
        
        // Check if entities are adjacent or related
        const distance = Math.abs(entity1.position.start - entity2.position.end);
        if (distance < 10) { // Within 10 characters
          entity1.related = entity1.related || [];
          entity1.related.push(entity2.text);
          entity2.related = entity2.related || [];
          entity2.related.push(entity1.text);
        }
      }
    }
    
    return resolved;
  }

  calculateEntityCoverage(query, entities) {
    const totalChars = query.length;
    const coveredChars = entities.reduce((sum, entity) => 
      sum + (entity.position.end - entity.position.start), 0
    );
    
    return totalChars > 0 ? coveredChars / totalChars : 0;
  }

  // Query expansion strategy implementations
  async expandWithSynonyms(query, processedQuery, context) {
    // Simple synonym expansion
    const synonyms = {
      'find': ['search', 'locate', 'discover'],
      'best': ['top', 'excellent', 'optimal', 'superior'],
      'model': ['algorithm', 'system', 'tool'],
      'fast': ['quick', 'rapid', 'speedy'],
      'good': ['excellent', 'quality', 'effective'],
      'help': ['assist', 'support', 'aid'],
      'create': ['generate', 'make', 'produce', 'build'],
      'analyze': ['examine', 'study', 'investigate']
    };

    const expansions = [];
    const tokens = processedQuery.tokenization?.filtered || [];
    
    tokens.forEach(token => {
      if (synonyms[token]) {
        expansions.push(...synonyms[token]);
      }
    });

    return [...new Set(expansions)]; // Remove duplicates
  }

  async expandWithRelatedTerms(query, processedQuery, context) {
    // Domain-specific related terms
    const relatedTerms = {
      'ai': ['machine learning', 'deep learning', 'neural network', 'artificial intelligence'],
      'model': ['neural network', 'algorithm', 'transformer', 'architecture'],
      'text': ['language', 'nlp', 'processing', 'generation'],
      'code': ['programming', 'development', 'software', 'coding'],
      'analysis': ['analytics', 'insights', 'data', 'statistics']
    };

    const expansions = [];
    const tokens = processedQuery.tokenization?.filtered || [];
    
    tokens.forEach(token => {
      if (relatedTerms[token]) {
        expansions.push(...relatedTerms[token]);
      }
    });

    return [...new Set(expansions)];
  }

  async expandWithDomainTerms(query, processedQuery, context) {
    // Expand based on detected domain
    const domainTerms = {
      'healthcare': ['medical', 'clinical', 'diagnosis', 'treatment', 'patient'],
      'finance': ['financial', 'investment', 'trading', 'market', 'economic'],
      'legal': ['law', 'regulation', 'compliance', 'contract', 'legal'],
      'education': ['learning', 'teaching', 'academic', 'student', 'curriculum'],
      'technology': ['software', 'hardware', 'system', 'platform', 'digital']
    };

    const detectedDomain = context.query_characteristics?.domain || 'general';
    return domainTerms[detectedDomain] || [];
  }

  async expandHierarchically(query, processedQuery, context) {
    // Hierarchical expansion (broader and narrower terms)
    const hierarchical = {
      'model': {
        broader: ['system', 'tool', 'technology'],
        narrower: ['transformer', 'lstm', 'gpt', 'bert']
      },
      'analysis': {
        broader: ['research', 'study'],
        narrower: ['sentiment analysis', 'data analysis', 'statistical analysis']
      }
    };

    const expansions = [];
    const tokens = processedQuery.tokenization?.filtered || [];
    
    tokens.forEach(token => {
      if (hierarchical[token]) {
        expansions.push(...hierarchical[token].broader);
        expansions.push(...hierarchical[token].narrower);
      }
    });

    return [...new Set(expansions)];
  }

  async expandContextually(query, processedQuery, context) {
    // Contextual expansion based on user history or session
    const expansions = [];
    
    if (context.previousQueries) {
      // Extract common terms from previous queries
      const commonTerms = this.extractCommonTerms(context.previousQueries);
      expansions.push(...commonTerms.slice(0, 3));
    }
    
    if (context.userProfile?.interests) {
      // Add terms based on user interests
      expansions.push(...context.userProfile.interests.slice(0, 2));
    }

    return [...new Set(expansions)];
  }

  // Additional helper methods
  calculateOverallConfidence(processedQuery) {
    const confidences = [];
    
    if (processedQuery.intent_detection?.confidence) {
      confidences.push(processedQuery.intent_detection.confidence);
    }
    
    if (processedQuery.entity_extraction?.entities?.length > 0) {
      const avgEntityConfidence = processedQuery.entity_extraction.entities
        .reduce((sum, entity) => sum + entity.confidence, 0) / 
        processedQuery.entity_extraction.entities.length;
      confidences.push(avgEntityConfidence);
    }
    
    const successfulStages = Object.values(processedQuery.processingStages || {})
      .filter(stage => stage.success).length;
    const totalStages = Object.keys(this.processingStages).length;
    confidences.push(successfulStages / totalStages);
    
    return confidences.length > 0 ? 
      confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0.5;
  }

  async generateQuerySuggestions(processedQuery) {
    const suggestions = [];
    
    // Suggest based on intent
    const intent = processedQuery.intent_detection?.primary?.intent;
    if (intent === 'search') {
      suggestions.push('Try being more specific about what you\'re looking for');
    } else if (intent === 'comparison') {
      suggestions.push('Consider specifying the criteria for comparison');
    }
    
    // Suggest based on entities
    const entities = processedQuery.entity_extraction?.entities || [];
    if (entities.length === 0) {
      suggestions.push('Try including specific model names or providers');
    }
    
    // Suggest query expansions
    const expansions = processedQuery.query_expansion?.expanded_terms || [];
    if (expansions.length > 0) {
      const topExpansion = expansions[0];
      if (topExpansion.terms.length > 0) {
        suggestions.push(`Try including: ${topExpansion.terms.slice(0, 3).join(', ')}`);
      }
    }
    
    return suggestions.slice(0, 3);
  }

  generateCacheKey(query, context) {
    const keyData = {
      query: query.toLowerCase().trim(),
      userId: context.userId,
      sessionId: context.sessionId
    };
    
    return `nlp_query:${Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 32)}`;
  }

  async getCachedResult(cacheKey) {
    try {
      const cached = await cacheManager.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 3600000) { // 1 hour cache
        return cached;
      }
    } catch (error) {
      this.logger.debug('Cache lookup failed', { error: error.message });
    }
    return null;
  }

  async cacheResult(cacheKey, result) {
    try {
      await cacheManager.set(cacheKey, result, 3600); // 1 hour
    } catch (error) {
      this.logger.debug('Failed to cache result', { error: error.message });
    }
  }

  // Placeholder methods for complex operations
  async loadNLPModels() { /* Implementation details */ }
  async initializeIntentClassification() { /* Implementation details */ }
  async loadEntityModels() { /* Implementation details */ }
  async initializeExpansionResources() { /* Implementation details */ }
  async loadSemanticRules() { /* Implementation details */ }
  calculateContextualIntentBoost(intent, previousQueries) { return 0.1; }
  pruneExpansions(expansions, maxCount) { return expansions.slice(0, maxCount); }
  async analyzeQueryCharacteristics(query, processedQuery) { return {}; }
  async inferDomainContext(query, processedQuery) { return { domain: 'general' }; }
  async enrichUserContext(context) { return context; }
  async addTemporalContext(context) { return { timestamp: Date.now() }; }
  async buildSessionContext(context) { return { sessionId: context.sessionId }; }
  calculateLexicalComplexity(tokenization) { return 0.5; }
  calculateSyntacticComplexity(query) { return 0.5; }
  calculateSemanticComplexity(processedQuery) { return 0.5; }
  async extractConcepts(query, processedQuery) { return []; }
  async extractRelations(query, processedQuery) { return []; }
  async buildSemanticStructure(semanticParse, processedQuery) { return null; }
  extractCommonTerms(queries) { return []; }

  getStats() {
    return {
      initialized: this.isInitialized,
      queryCache: this.queryCache.size,
      intentCache: this.intentCache.size,
      processingStages: Object.keys(this.processingStages).length,
      intentPatterns: Object.keys(this.intentPatterns).length,
      entityTypes: Object.keys(this.entityTypes).length,
      expansionStrategies: Object.keys(this.expansionStrategies).length
    };
  }

  async cleanup() {
    this.queryCache.clear();
    this.intentCache.clear();
    this.isInitialized = false;
    this.logger.info('Natural language query processor cleaned up');
  }
}

export const queryProcessor = new NaturalLanguageQueryProcessor();