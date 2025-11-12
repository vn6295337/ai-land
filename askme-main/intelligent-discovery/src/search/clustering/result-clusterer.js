import { createLogger } from '../../core/infrastructure/logger.js';
import { embeddingsManager } from '../../core/storage/embeddings.js';
import { qdrantManager } from '../../core/storage/qdrant.js';
import { cacheManager } from '../../core/storage/cache.js';

class SearchResultClusterer {
  constructor() {
    this.logger = createLogger({ component: 'result-clusterer' });
    this.isInitialized = false;
    this.clusterCache = new Map();
    this.clusterModels = new Map();
    
    // Clustering algorithms and configurations
    this.clusteringAlgorithms = {
      'kmeans': {
        name: 'K-Means Clustering',
        description: 'Partitions results into k clusters based on centroids',
        parameters: {
          minClusters: 2,
          maxClusters: 10,
          maxIterations: 100,
          tolerance: 0.001
        },
        method: this.kMeansClustering.bind(this)
      },
      'hierarchical': {
        name: 'Hierarchical Clustering',
        description: 'Creates hierarchical cluster structure',
        parameters: {
          linkage: 'average', // single, complete, average, ward
          distanceThreshold: 0.7,
          maxClusters: 15
        },
        method: this.hierarchicalClustering.bind(this)
      },
      'dbscan': {
        name: 'DBSCAN Clustering',
        description: 'Density-based clustering with noise detection',
        parameters: {
          epsilon: 0.3,
          minPoints: 3,
          metric: 'cosine'
        },
        method: this.dbscanClustering.bind(this)
      },
      'semantic': {
        name: 'Semantic Clustering',
        description: 'Clusters based on semantic similarity and concepts',
        parameters: {
          similarityThreshold: 0.6,
          maxClusterSize: 20,
          conceptDepth: 2
        },
        method: this.semanticClustering.bind(this)
      },
      'topic': {
        name: 'Topic-Based Clustering',
        description: 'Groups results by inferred topics',
        parameters: {
          numTopics: 'auto',
          minTopicSize: 3,
          coherenceThreshold: 0.4
        },
        method: this.topicClustering.bind(this)
      }
    };
    
    // Clustering features and weights
    this.clusteringFeatures = {
      semantic_embedding: {
        weight: 0.4,
        description: 'Vector embeddings for semantic similarity',
        extractor: this.extractSemanticFeatures.bind(this)
      },
      provider: {
        weight: 0.15,
        description: 'Model provider grouping',
        extractor: this.extractProviderFeatures.bind(this)
      },
      model_type: {
        weight: 0.15,
        description: 'Model type categorization',
        extractor: this.extractModelTypeFeatures.bind(this)
      },
      capabilities: {
        weight: 0.15,
        description: 'Model capabilities similarity',
        extractor: this.extractCapabilityFeatures.bind(this)
      },
      performance: {
        weight: 0.1,
        description: 'Performance tier grouping',
        extractor: this.extractPerformanceFeatures.bind(this)
      },
      domain: {
        weight: 0.05,
        description: 'Application domain clustering',
        extractor: this.extractDomainFeatures.bind(this)
      }
    };
    
    // Cluster labeling strategies
    this.labelingStrategies = {
      'centroid': this.labelFromCentroid.bind(this),
      'common_terms': this.labelFromCommonTerms.bind(this),
      'representative': this.labelFromRepresentative.bind(this),
      'semantic': this.labelFromSemantics.bind(this),
      'hybrid': this.labelFromHybrid.bind(this)
    };
    
    // Cluster quality metrics
    this.qualityMetrics = {
      silhouette: this.calculateSilhouetteScore.bind(this),
      cohesion: this.calculateCohesion.bind(this),
      separation: this.calculateSeparation.bind(this),
      dunn_index: this.calculateDunnIndex.bind(this),
      davies_bouldin: this.calculateDaviesBouldinIndex.bind(this)
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing search result clusterer');
      
      // Initialize clustering algorithms
      await this.initializeClusteringAlgorithms();
      
      // Load pre-trained clustering models
      await this.loadClusteringModels();
      
      // Initialize feature extractors
      await this.initializeFeatureExtractors();
      
      // Setup cluster caching
      await this.setupClusterCaching();
      
      // Initialize cluster quality evaluators
      await this.initializeQualityEvaluators();
      
      this.isInitialized = true;
      this.logger.info('Search result clusterer initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize result clusterer', { error: error.message });
      throw error;
    }
  }

  async clusterResults(results, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Result clusterer not initialized');
    }

    try {
      this.logger.info('Clustering search results', {
        resultCount: results.length,
        algorithm: options.algorithm || 'semantic',
        features: options.features || Object.keys(this.clusteringFeatures)
      });

      if (results.length < 2) {
        return this.createSingleCluster(results);
      }

      const startTime = Date.now();
      
      // Check cache
      const cacheKey = this.generateClusterCacheKey(results, options);
      const cached = await this.getCachedClusters(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached clustering results');
        return cached;
      }

      // Extract features for clustering
      const features = await this.extractClusteringFeatures(results, options);
      
      // Select and configure clustering algorithm
      const algorithm = options.algorithm || 'semantic';
      const algorithmConfig = this.clusteringAlgorithms[algorithm];
      
      if (!algorithmConfig) {
        throw new Error(`Unknown clustering algorithm: ${algorithm}`);
      }

      // Determine optimal number of clusters
      const optimalK = await this.determineOptimalClusters(features, algorithmConfig, options);
      
      // Execute clustering
      const clusterAssignments = await algorithmConfig.method(
        features,
        { ...algorithmConfig.parameters, ...options.parameters, k: optimalK }
      );
      
      // Build cluster objects
      const clusters = await this.buildClusters(results, clusterAssignments, features);
      
      // Generate cluster labels
      const labeledClusters = await this.labelClusters(clusters, options);
      
      // Calculate cluster quality metrics
      const qualityMetrics = await this.evaluateClusterQuality(labeledClusters, features);
      
      // Optimize cluster arrangement
      const optimizedClusters = await this.optimizeClusterArrangement(labeledClusters, qualityMetrics);
      
      const processingTime = Date.now() - startTime;
      
      const clusteringResult = {
        clusters: optimizedClusters,
        metadata: {
          algorithm: algorithm,
          totalResults: results.length,
          clusterCount: optimizedClusters.length,
          averageClusterSize: results.length / optimizedClusters.length,
          processingTime,
          optimalK,
          qualityMetrics,
          features: Object.keys(features),
          parameters: { ...algorithmConfig.parameters, ...options.parameters }
        },
        hierarchy: await this.buildClusterHierarchy(optimizedClusters),
        summary: this.generateClusteringSummary(optimizedClusters, qualityMetrics)
      };
      
      // Cache results
      await this.cacheClusters(cacheKey, clusteringResult);
      
      this.logger.info('Result clustering completed', {
        clusterCount: optimizedClusters.length,
        averageSize: clusteringResult.metadata.averageClusterSize.toFixed(1),
        processingTime,
        qualityScore: qualityMetrics.overall?.toFixed(3)
      });
      
      return clusteringResult;
      
    } catch (error) {
      this.logger.error('Result clustering failed', { error: error.message });
      throw error;
    }
  }

  async extractClusteringFeatures(results, options) {
    const selectedFeatures = options.features || Object.keys(this.clusteringFeatures);
    const features = {};
    
    for (const featureName of selectedFeatures) {
      const featureConfig = this.clusteringFeatures[featureName];
      if (!featureConfig) {
        this.logger.warn(`Unknown clustering feature: ${featureName}`);
        continue;
      }
      
      try {
        this.logger.debug(`Extracting ${featureName} features`);
        features[featureName] = await featureConfig.extractor(results, options);
        
      } catch (error) {
        this.logger.warn(`Failed to extract ${featureName} features`, { error: error.message });
      }
    }
    
    return features;
  }

  async extractSemanticFeatures(results, options) {
    const embeddings = [];
    
    for (const result of results) {
      try {
        // Use existing embedding or generate new one
        let embedding = result.embedding;
        
        if (!embedding) {
          const text = this.extractTextContent(result);
          embedding = await embeddingsManager.generateEmbedding(text);
        }
        
        embeddings.push(embedding);
        
      } catch (error) {
        this.logger.warn(`Failed to get embedding for result ${result.id}`, { error: error.message });
        // Use zero vector as fallback
        embeddings.push(new Array(384).fill(0));
      }
    }
    
    return {
      type: 'vector',
      dimensions: embeddings[0]?.length || 384,
      vectors: embeddings,
      weight: this.clusteringFeatures.semantic_embedding.weight
    };
  }

  async extractProviderFeatures(results, options) {
    const providerFeatures = results.map(result => {
      const provider = result.payload?.provider || 'unknown';
      return this.oneHotEncode(provider, ['openai', 'anthropic', 'google', 'meta', 'microsoft', 'huggingface', 'other']);
    });
    
    return {
      type: 'categorical',
      vectors: providerFeatures,
      weight: this.clusteringFeatures.provider.weight
    };
  }

  async extractModelTypeFeatures(results, options) {
    const typeFeatures = results.map(result => {
      const modelType = result.payload?.model_type || 'unknown';
      return this.oneHotEncode(modelType, ['text-generation', 'chat', 'embedding', 'multimodal', 'code', 'other']);
    });
    
    return {
      type: 'categorical',
      vectors: typeFeatures,
      weight: this.clusteringFeatures.model_type.weight
    };
  }

  async extractCapabilityFeatures(results, options) {
    const allCapabilities = ['reasoning', 'creativity', 'code', 'math', 'multilingual', 'analysis', 'conversation'];
    
    const capabilityFeatures = results.map(result => {
      const capabilities = result.payload?.capabilities || [];
      return allCapabilities.map(cap => capabilities.includes(cap) ? 1 : 0);
    });
    
    return {
      type: 'binary',
      vectors: capabilityFeatures,
      weight: this.clusteringFeatures.capabilities.weight
    };
  }

  async extractPerformanceFeatures(results, options) {
    const performanceFeatures = results.map(result => {
      const score = result.payload?.performance_score || result.score || 0.5;
      const latency = result.payload?.average_latency || 1000;
      const throughput = result.payload?.throughput || 10;
      
      return [
        this.normalize(score, 0, 1),
        this.normalize(Math.log(latency), Math.log(100), Math.log(5000)),
        this.normalize(Math.log(throughput), Math.log(1), Math.log(1000))
      ];
    });
    
    return {
      type: 'numeric',
      vectors: performanceFeatures,
      weight: this.clusteringFeatures.performance.weight
    };
  }

  async extractDomainFeatures(results, options) {
    const domainFeatures = results.map(result => {
      const domain = result.payload?.domain || 'general';
      return this.oneHotEncode(domain, ['healthcare', 'finance', 'education', 'creative', 'technical', 'research', 'general']);
    });
    
    return {
      type: 'categorical',
      vectors: domainFeatures,
      weight: this.clusteringFeatures.domain.weight
    };
  }

  async determineOptimalClusters(features, algorithmConfig, options) {
    if (options.k || options.numClusters) {
      return options.k || options.numClusters;
    }
    
    const maxK = Math.min(algorithmConfig.parameters.maxClusters || 10, Math.floor(Object.values(features)[0].vectors.length / 2));
    const minK = algorithmConfig.parameters.minClusters || 2;
    
    if (maxK <= minK) {
      return minK;
    }
    
    // Use elbow method or silhouette analysis
    const method = options.optimizationMethod || 'silhouette';
    
    if (method === 'elbow') {
      return await this.findOptimalKElbow(features, minK, maxK, algorithmConfig);
    } else {
      return await this.findOptimalKSilhouette(features, minK, maxK, algorithmConfig);
    }
  }

  async findOptimalKSilhouette(features, minK, maxK, algorithmConfig) {
    let bestK = minK;
    let bestScore = -1;
    
    for (let k = minK; k <= maxK; k++) {
      try {
        const assignments = await algorithmConfig.method(features, { ...algorithmConfig.parameters, k });
        const clusters = await this.buildTemporaryClusters(assignments, features);
        const silhouetteScore = await this.calculateSilhouetteScore(clusters, features);
        
        if (silhouetteScore > bestScore) {
          bestScore = silhouetteScore;
          bestK = k;
        }
        
      } catch (error) {
        this.logger.debug(`Failed to evaluate k=${k}`, { error: error.message });
      }
    }
    
    this.logger.debug(`Optimal k determined by silhouette analysis`, { k: bestK, score: bestScore });
    return bestK;
  }

  async kMeansClustering(features, parameters) {
    const k = parameters.k || 3;
    const maxIterations = parameters.maxIterations || 100;
    const tolerance = parameters.tolerance || 0.001;
    
    // Combine all feature vectors
    const combinedVectors = this.combineFeatureVectors(features);
    const n = combinedVectors.length;
    const dimensions = combinedVectors[0].length;
    
    // Initialize centroids randomly
    let centroids = this.initializeRandomCentroids(k, dimensions);
    let assignments = new Array(n).fill(0);
    let converged = false;
    let iteration = 0;
    
    while (!converged && iteration < maxIterations) {
      const newAssignments = new Array(n);
      
      // Assign points to nearest centroid
      for (let i = 0; i < n; i++) {
        let minDistance = Infinity;
        let bestCluster = 0;
        
        for (let j = 0; j < k; j++) {
          const distance = this.calculateEuclideanDistance(combinedVectors[i], centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = j;
          }
        }
        
        newAssignments[i] = bestCluster;
      }
      
      // Update centroids
      const newCentroids = new Array(k);
      for (let j = 0; j < k; j++) {
        const clusterPoints = combinedVectors.filter((_, i) => newAssignments[i] === j);
        
        if (clusterPoints.length > 0) {
          newCentroids[j] = this.calculateCentroid(clusterPoints);
        } else {
          // Keep old centroid if no points assigned
          newCentroids[j] = [...centroids[j]];
        }
      }
      
      // Check convergence
      converged = this.centroidsConverged(centroids, newCentroids, tolerance);
      centroids = newCentroids;
      assignments = newAssignments;
      iteration++;
    }
    
    this.logger.debug(`K-means converged after ${iteration} iterations`);
    return assignments;
  }

  async hierarchicalClustering(features, parameters) {
    const linkage = parameters.linkage || 'average';
    const distanceThreshold = parameters.distanceThreshold || 0.7;
    const maxClusters = parameters.maxClusters || 15;
    
    const combinedVectors = this.combineFeatureVectors(features);
    const n = combinedVectors.length;
    
    // Initialize each point as its own cluster
    let clusters = combinedVectors.map((vector, index) => ({
      id: index,
      points: [index],
      centroid: [...vector],
      size: 1
    }));
    
    // Distance matrix
    const distances = this.calculateDistanceMatrix(combinedVectors);
    
    // Merge clusters until threshold or max clusters reached
    while (clusters.length > maxClusters) {
      const mergeInfo = this.findClosestClusters(clusters, distances, linkage);
      
      if (mergeInfo.distance > distanceThreshold) {
        break;
      }
      
      // Merge the two closest clusters
      const [i, j] = mergeInfo.indices;
      const newCluster = this.mergeClusters(clusters[i], clusters[j], combinedVectors);
      
      // Remove old clusters and add new one
      clusters = clusters.filter((_, index) => index !== i && index !== j);
      clusters.push(newCluster);
    }
    
    // Convert to assignments array
    const assignments = new Array(n);
    clusters.forEach((cluster, clusterIndex) => {
      cluster.points.forEach(pointIndex => {
        assignments[pointIndex] = clusterIndex;
      });
    });
    
    return assignments;
  }

  async dbscanClustering(features, parameters) {
    const epsilon = parameters.epsilon || 0.3;
    const minPoints = parameters.minPoints || 3;
    
    const combinedVectors = this.combineFeatureVectors(features);
    const n = combinedVectors.length;
    
    const labels = new Array(n).fill(-1); // -1 means unclassified
    let clusterId = 0;
    
    for (let i = 0; i < n; i++) {
      if (labels[i] !== -1) continue; // Already processed
      
      const neighbors = this.getNeighbors(i, combinedVectors, epsilon);
      
      if (neighbors.length < minPoints) {
        labels[i] = -2; // Mark as noise
        continue;
      }
      
      // Start new cluster
      labels[i] = clusterId;
      const seedSet = [...neighbors];
      
      for (let j = 0; j < seedSet.length; j++) {
        const point = seedSet[j];
        
        if (labels[point] === -2) {
          labels[point] = clusterId; // Change noise to border point
        }
        
        if (labels[point] !== -1) continue; // Already processed
        
        labels[point] = clusterId;
        const pointNeighbors = this.getNeighbors(point, combinedVectors, epsilon);
        
        if (pointNeighbors.length >= minPoints) {
          seedSet.push(...pointNeighbors);
        }
      }
      
      clusterId++;
    }
    
    // Convert noise points (-2) to cluster assignments
    const maxCluster = Math.max(...labels.filter(l => l >= 0));
    const assignments = labels.map(label => label >= 0 ? label : maxCluster + 1);
    
    return assignments;
  }

  async semanticClustering(features, parameters) {
    const similarityThreshold = parameters.similarityThreshold || 0.6;
    const maxClusterSize = parameters.maxClusterSize || 20;
    
    // Use semantic embeddings primarily
    const semanticFeatures = features.semantic_embedding;
    if (!semanticFeatures) {
      throw new Error('Semantic clustering requires semantic_embedding features');
    }
    
    const vectors = semanticFeatures.vectors;
    const n = vectors.length;
    const assignments = new Array(n).fill(-1);
    let clusterId = 0;
    
    for (let i = 0; i < n; i++) {
      if (assignments[i] !== -1) continue;
      
      // Start new cluster
      const cluster = [i];
      assignments[i] = clusterId;
      
      // Find semantically similar items
      for (let j = i + 1; j < n; j++) {
        if (assignments[j] !== -1 || cluster.length >= maxClusterSize) continue;
        
        const similarity = this.calculateCosineSimilarity(vectors[i], vectors[j]);
        
        if (similarity >= similarityThreshold) {
          cluster.push(j);
          assignments[j] = clusterId;
        }
      }
      
      clusterId++;
    }
    
    return assignments;
  }

  async topicClustering(features, parameters) {
    const numTopics = parameters.numTopics === 'auto' ? 'auto' : (parameters.numTopics || 5);
    const minTopicSize = parameters.minTopicSize || 3;
    
    // Extract text content for topic modeling
    const textFeatures = this.extractTextFeatures(features);
    
    // Simple topic clustering based on keyword co-occurrence
    const topics = await this.extractTopics(textFeatures, numTopics === 'auto' ? null : numTopics);
    
    const assignments = new Array(textFeatures.length);
    
    for (let i = 0; i < textFeatures.length; i++) {
      let bestTopic = 0;
      let bestScore = 0;
      
      topics.forEach((topic, topicIndex) => {
        const score = this.calculateTopicSimilarity(textFeatures[i], topic);
        if (score > bestScore) {
          bestScore = score;
          bestTopic = topicIndex;
        }
      });
      
      assignments[i] = bestTopic;
    }
    
    return assignments;
  }

  async buildClusters(results, assignments, features) {
    const clusterMap = new Map();
    
    // Group results by cluster assignment
    assignments.forEach((clusterId, resultIndex) => {
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId).push({
        result: results[resultIndex],
        index: resultIndex
      });
    });
    
    // Build cluster objects
    const clusters = [];
    
    for (const [clusterId, clusterItems] of clusterMap.entries()) {
      const cluster = {
        id: clusterId,
        size: clusterItems.length,
        results: clusterItems.map(item => item.result),
        indices: clusterItems.map(item => item.index),
        centroid: await this.calculateClusterCentroid(clusterItems, features),
        statistics: await this.calculateClusterStatistics(clusterItems),
        representative: await this.findRepresentativeResult(clusterItems, features)
      };
      
      clusters.push(cluster);
    }
    
    // Sort clusters by size (largest first)
    return clusters.sort((a, b) => b.size - a.size);
  }

  async labelClusters(clusters, options) {
    const labelingStrategy = options.labelingStrategy || 'hybrid';
    const labelingMethod = this.labelingStrategies[labelingStrategy];
    
    if (!labelingMethod) {
      throw new Error(`Unknown labeling strategy: ${labelingStrategy}`);
    }
    
    const labeledClusters = [];
    
    for (const cluster of clusters) {
      try {
        const label = await labelingMethod(cluster, options);
        labeledClusters.push({
          ...cluster,
          label: label.text,
          labelConfidence: label.confidence,
          labelMethod: labelingStrategy,
          labelMetadata: label.metadata
        });
        
      } catch (error) {
        this.logger.warn(`Failed to label cluster ${cluster.id}`, { error: error.message });
        labeledClusters.push({
          ...cluster,
          label: `Cluster ${cluster.id + 1}`,
          labelConfidence: 0.1,
          labelMethod: 'fallback'
        });
      }
    }
    
    return labeledClusters;
  }

  async labelFromHybrid(cluster, options) {
    // Combine multiple labeling strategies
    const strategies = ['common_terms', 'representative', 'semantic'];
    const labels = [];
    
    for (const strategy of strategies) {
      try {
        const method = this.labelingStrategies[strategy];
        const label = await method(cluster, options);
        labels.push({ ...label, strategy });
      } catch (error) {
        this.logger.debug(`Labeling strategy ${strategy} failed`, { error: error.message });
      }
    }
    
    if (labels.length === 0) {
      return { text: `Cluster ${cluster.id + 1}`, confidence: 0.1, metadata: {} };
    }
    
    // Select best label based on confidence
    const bestLabel = labels.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      text: bestLabel.text,
      confidence: bestLabel.confidence,
      metadata: {
        hybridStrategies: labels.map(l => l.strategy),
        alternatives: labels.filter(l => l !== bestLabel)
      }
    };
  }

  async labelFromCommonTerms(cluster, options) {
    // Extract common terms from cluster results
    const allText = cluster.results.map(result => 
      this.extractTextContent(result)
    ).join(' ');
    
    const terms = this.extractTerms(allText);
    const termFreq = this.calculateTermFrequency(terms);
    
    // Get most frequent meaningful terms
    const significantTerms = Object.entries(termFreq)
      .filter(([term, freq]) => term.length > 2 && freq >= Math.max(2, cluster.size * 0.3))
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([term]) => term);
    
    const label = significantTerms.length > 0 ? 
      significantTerms.join(', ') : 
      `Mixed Models (${cluster.size})`;
    
    return {
      text: label,
      confidence: Math.min(0.9, significantTerms.length / 3),
      metadata: { terms: significantTerms, frequencies: termFreq }
    };
  }

  async labelFromRepresentative(cluster, options) {
    if (!cluster.representative) {
      return { text: `Cluster ${cluster.id + 1}`, confidence: 0.1, metadata: {} };
    }
    
    const rep = cluster.representative.result;
    const name = rep.payload?.name || rep.payload?.model_name || `Model ${rep.id}`;
    const provider = rep.payload?.provider;
    
    let label = name;
    if (provider && cluster.size > 1) {
      label = `${provider} Models (${cluster.size})`;
    } else if (cluster.size > 1) {
      label = `${name} and ${cluster.size - 1} similar`;
    }
    
    return {
      text: label,
      confidence: 0.8,
      metadata: { representative: rep.id, provider }
    };
  }

  async labelFromSemantics(cluster, options) {
    // Use semantic analysis to generate meaningful labels
    const concepts = await this.extractClusterConcepts(cluster);
    
    if (concepts.length === 0) {
      return { text: `Cluster ${cluster.id + 1}`, confidence: 0.1, metadata: {} };
    }
    
    const primaryConcept = concepts[0];
    const label = `${primaryConcept.name} Models`;
    
    return {
      text: label,
      confidence: primaryConcept.confidence,
      metadata: { concepts, primaryConcept }
    };
  }

  async labelFromCentroid(cluster, options) {
    // Generate label based on cluster centroid characteristics
    if (!cluster.centroid) {
      return { text: `Cluster ${cluster.id + 1}`, confidence: 0.1, metadata: {} };
    }
    
    // Find closest actual item to centroid
    let minDistance = Infinity;
    let closestResult = null;
    
    for (const result of cluster.results) {
      const distance = this.calculateDistanceToPoint(result, cluster.centroid);
      if (distance < minDistance) {
        minDistance = distance;
        closestResult = result;
      }
    }
    
    if (closestResult) {
      const name = closestResult.payload?.name || `Model ${closestResult.id}`;
      return {
        text: `${name}-like Models`,
        confidence: 0.7,
        metadata: { centroid: cluster.centroid, closest: closestResult.id }
      };
    }
    
    return { text: `Cluster ${cluster.id + 1}`, confidence: 0.1, metadata: {} };
  }

  // Helper methods
  extractTextContent(result) {
    const parts = [
      result.payload?.name,
      result.payload?.description,
      result.payload?.tags?.join(' '),
      result.payload?.capabilities?.join(' ')
    ].filter(Boolean);
    
    return parts.join(' ').toLowerCase();
  }

  oneHotEncode(value, categories) {
    const encoded = new Array(categories.length).fill(0);
    const index = categories.indexOf(value);
    if (index >= 0) {
      encoded[index] = 1;
    } else if (categories.includes('other')) {
      encoded[categories.indexOf('other')] = 1;
    }
    return encoded;
  }

  normalize(value, min, max) {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  combineFeatureVectors(features) {
    const featureVectors = Object.values(features);
    const n = featureVectors[0].vectors.length;
    const combined = [];
    
    for (let i = 0; i < n; i++) {
      const combinedVector = [];
      
      featureVectors.forEach(feature => {
        const weightedVector = feature.vectors[i].map(v => v * feature.weight);
        combinedVector.push(...weightedVector);
      });
      
      combined.push(combinedVector);
    }
    
    return combined;
  }

  calculateEuclideanDistance(vector1, vector2) {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      sum += Math.pow(vector1[i] - vector2[i], 2);
    }
    return Math.sqrt(sum);
  }

  calculateCosineSimilarity(vector1, vector2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  calculateCentroid(vectors) {
    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    vectors.forEach(vector => {
      vector.forEach((value, index) => {
        centroid[index] += value;
      });
    });
    
    return centroid.map(sum => sum / vectors.length);
  }

  centroidsConverged(oldCentroids, newCentroids, tolerance) {
    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.calculateEuclideanDistance(oldCentroids[i], newCentroids[i]);
      if (distance > tolerance) {
        return false;
      }
    }
    return true;
  }

  initializeRandomCentroids(k, dimensions) {
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const centroid = [];
      for (let j = 0; j < dimensions; j++) {
        centroid.push(Math.random());
      }
      centroids.push(centroid);
    }
    return centroids;
  }

  generateClusterCacheKey(results, options) {
    const keyData = {
      resultIds: results.map(r => r.id).sort().join(','),
      algorithm: options.algorithm || 'semantic',
      features: (options.features || []).sort().join(','),
      parameters: JSON.stringify(options.parameters || {})
    };
    
    return `cluster:${Buffer.from(JSON.stringify(keyData)).toString('base64').slice(0, 32)}`;
  }

  async getCachedClusters(cacheKey) {
    try {
      const cached = await cacheManager.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 1800000) { // 30 minutes
        return cached;
      }
    } catch (error) {
      this.logger.debug('Cluster cache lookup failed', { error: error.message });
    }
    return null;
  }

  async cacheClusters(cacheKey, clusterResult) {
    try {
      await cacheManager.set(cacheKey, {
        ...clusterResult,
        timestamp: Date.now()
      }, 1800); // 30 minutes
    } catch (error) {
      this.logger.debug('Failed to cache clusters', { error: error.message });
    }
  }

  createSingleCluster(results) {
    return {
      clusters: [{
        id: 0,
        size: results.length,
        results: results,
        label: `All Results (${results.length})`,
        labelConfidence: 1.0,
        representative: results[0]
      }],
      metadata: {
        algorithm: 'single',
        totalResults: results.length,
        clusterCount: 1,
        averageClusterSize: results.length,
        processingTime: 0
      }
    };
  }

  // Placeholder methods for complex operations
  async initializeClusteringAlgorithms() { /* Implementation details */ }
  async loadClusteringModels() { /* Implementation details */ }
  async initializeFeatureExtractors() { /* Implementation details */ }
  async setupClusterCaching() { /* Implementation details */ }
  async initializeQualityEvaluators() { /* Implementation details */ }
  async findOptimalKElbow(features, minK, maxK, algorithmConfig) { return Math.ceil((minK + maxK) / 2); }
  async buildTemporaryClusters(assignments, features) { return []; }
  async calculateSilhouetteScore(clusters, features) { return 0.7; }
  calculateDistanceMatrix(vectors) { return []; }
  findClosestClusters(clusters, distances, linkage) { return { indices: [0, 1], distance: 0.5 }; }
  mergeClusters(cluster1, cluster2, vectors) { return { id: 0, points: [], centroid: [], size: 0 }; }
  getNeighbors(pointIndex, vectors, epsilon) { return []; }
  extractTextFeatures(features) { return []; }
  async extractTopics(textFeatures, numTopics) { return []; }
  calculateTopicSimilarity(text, topic) { return 0.5; }
  async calculateClusterCentroid(clusterItems, features) { return null; }
  async calculateClusterStatistics(clusterItems) { return {}; }
  async findRepresentativeResult(clusterItems, features) { return clusterItems[0]; }
  async evaluateClusterQuality(clusters, features) { return { overall: 0.7 }; }
  async optimizeClusterArrangement(clusters, qualityMetrics) { return clusters; }
  async buildClusterHierarchy(clusters) { return null; }
  generateClusteringSummary(clusters, qualityMetrics) { return ''; }
  extractTerms(text) { return text.split(/\s+/).filter(t => t.length > 2); }
  calculateTermFrequency(terms) { 
    const freq = {};
    terms.forEach(term => freq[term] = (freq[term] || 0) + 1);
    return freq;
  }
  async extractClusterConcepts(cluster) { return []; }
  calculateDistanceToPoint(result, centroid) { return 0.5; }

  getStats() {
    return {
      initialized: this.isInitialized,
      clusterCache: this.clusterCache.size,
      algorithms: Object.keys(this.clusteringAlgorithms),
      features: Object.keys(this.clusteringFeatures),
      labelingStrategies: Object.keys(this.labelingStrategies),
      qualityMetrics: Object.keys(this.qualityMetrics)
    };
  }

  async cleanup() {
    this.clusterCache.clear();
    this.clusterModels.clear();
    this.isInitialized = false;
    this.logger.info('Search result clusterer cleaned up');
  }
}

export const resultClusterer = new SearchResultClusterer();