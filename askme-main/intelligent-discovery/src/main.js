#!/usr/bin/env node

import CLI from './core/infrastructure/cli.js';
import { createLogger } from './core/infrastructure/logger.js';
import config from './core/infrastructure/config.js';
import { ErrorHandler, ConfigurationError } from './core/infrastructure/errors.js';
import { qdrantManager } from './core/storage/qdrant.js';
import { embeddingsManager } from './core/storage/embeddings.js';
import { cacheManager } from './core/storage/cache.js';
import { backupManager } from './core/storage/backup.js';

// Module 3: Provider Discovery
import { providerOrchestrator } from './discovery/providers/orchestrator.js';
import { enumerator } from './discovery/providers/enumerator.js';

// Module 4: Model Enumeration
import { hubScanner } from './discovery/scanners/hub-scanner.js';
import { providerScanner } from './discovery/scanners/provider-scanner.js';
import { aggregator } from './discovery/scanners/aggregator.js';
import { parallelProcessor } from './discovery/scanners/parallel-processor.js';
import { progressTracker } from './discovery/scanners/progress-tracker.js';

// Module 5: API Validation
import { apiTester } from './validation/testing/api-tester.js';
import { capabilityVerifier } from './validation/capabilities/capability-verifier.js';
import { qualityAnalyzer } from './validation/quality/quality-analyzer.js';
import { benchmarkSuite } from './validation/performance/benchmark-suite.js';
import { reliabilityMonitor } from './validation/monitoring/reliability-monitor.js';
import { validationReporter } from './validation/reporting/validation-reporter.js';

const logger = createLogger({ level: config.get('LOG_LEVEL') });
const errorHandler = new ErrorHandler(logger);

class IntelligentDiscovery {
  constructor() {
    this.cli = new CLI();
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    this.setupGlobalErrorHandlers();
    this.validateEnvironment();
  }

  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
      process.exit(1);
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT, shutting down gracefully');
      await this.shutdown();
    });

    // Handle SIGTERM
    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM, shutting down gracefully');
      await this.shutdown();
    });
  }

  validateEnvironment() {
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 18) {
        throw new ConfigurationError(
          `Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`
        );
      }

      // Validate configuration
      const apiKeys = config.getApiKeys();
      if (Object.keys(apiKeys).length === 0) {
        this.logger.warn('No API keys configured. Some features may not work properly.');
      }

      // Check database configuration
      const dbConfig = config.getDatabaseConfig();
      if (!dbConfig.url) {
        this.logger.warn('No database URL configured. Vector operations will not work.');
      }

      this.logger.info('Environment validation completed', {
        nodeVersion,
        environment: config.get('NODE_ENV'),
        configuredProviders: Object.keys(apiKeys),
        databaseUrl: dbConfig.url
      });

    } catch (error) {
      this.errorHandler.handle(error, { context: 'environment_validation' });
      throw error;
    }
  }

  async initialize() {
    try {
      this.logger.info('Initializing Intelligent Model Discovery System', {
        version: '1.0.0',
        environment: config.get('NODE_ENV'),
        logLevel: config.get('LOG_LEVEL')
      });

      // Initialize core services (will be implemented in future modules)
      await this.initializeCoreServices();

      this.logger.info('System initialization completed successfully');

    } catch (error) {
      this.errorHandler.handle(error, { context: 'system_initialization' });
      throw error;
    }
  }

  async initializeCoreServices() {
    // Initialize Module 2: Database & Storage services
    await this.initializeDatabase();     // Module 2 ✅ COMPLETE
    
    // Initialize Module 3: Provider Discovery services
    await this.initializeProviders();       // Module 3 ✅ COMPLETE
    
    // Initialize Module 4: Model Enumeration services
    await this.initializeModelEnumeration(); // Module 4 ✅ COMPLETE
    
    // Initialize Module 5: API Validation services
    await this.initializeValidation();      // Module 5 ✅ COMPLETE
    
    // Placeholder for future service initialization:
    // await this.initializeIntelligence(); // Module 9
    // await this.initializeMonitoring();   // Module 15

    this.logger.info('✅ Modules 2-5 (Database, Discovery, Enumeration, Validation) initialization completed');
  }

  /**
   * Initialize Module 2: Database & Storage
   */
  async initializeDatabase() {
    try {
      this.logger.info('🔄 Initializing Module 2: Database & Storage...');

      // Step 1: Initialize cache manager
      await cacheManager.initialize();
      this.logger.debug('✅ Step 10: Cache manager initialized');

      // Step 2: Initialize backup manager
      await backupManager.initialize();
      this.logger.debug('✅ Step 11: Backup manager initialized');

      // Step 3: Initialize embeddings manager
      await embeddingsManager.initialize();
      this.logger.debug('✅ Step 9: Embeddings manager initialized');

      // Step 4: Initialize Qdrant database connection
      await qdrantManager.initialize();
      this.logger.debug('✅ Step 7-8: Qdrant database initialized with collections');

      this.logger.info('🎉 Module 2: Database & Storage fully operational', {
        database: qdrantManager.getStatus(),
        embeddings: embeddingsManager.getStats(),
        cache: cacheManager.getStats(),
        component: 'main'
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize Module 2: Database & Storage', {
        error: error.message,
        component: 'main'
      });
      throw error;
    }
  }

  /**
   * Initialize Module 3: Provider Discovery
   */
  async initializeProviders() {
    try {
      this.logger.info('🔄 Initializing Module 3: Provider Discovery...');

      // Step 12: Initialize provider orchestrator
      await providerOrchestrator.initialize();
      this.logger.debug('✅ Step 12: Provider orchestrator initialized');

      // Step 13: Initialize enumerator
      await enumerator.initialize();
      this.logger.debug('✅ Step 13: Provider enumerator initialized');

      this.logger.info('🎉 Module 3: Provider Discovery fully operational', {
        providers: providerOrchestrator.getStats(),
        component: 'main'
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize Module 3: Provider Discovery', {
        error: error.message,
        component: 'main'
      });
      throw error;
    }
  }

  /**
   * Initialize Module 4: Model Enumeration
   */
  async initializeModelEnumeration() {
    try {
      this.logger.info('🔄 Initializing Module 4: Model Enumeration...');

      // Step 17: Initialize HuggingFace Hub scanner
      await hubScanner.initialize();
      this.logger.debug('✅ Step 17: HuggingFace Hub scanner initialized');

      // Step 18: Initialize provider scanners
      await providerScanner.initialize();
      this.logger.debug('✅ Step 18: Provider scanners initialized');

      // Step 19: Initialize aggregator
      await aggregator.initialize();
      this.logger.debug('✅ Step 19: Model aggregator initialized');

      // Step 22: Initialize parallel processor
      await parallelProcessor.initialize();
      this.logger.debug('✅ Step 22: Parallel processor initialized');

      // Step 23: Initialize progress tracker
      await progressTracker.initialize();
      this.logger.debug('✅ Step 23: Progress tracker initialized');

      this.logger.info('🎉 Module 4: Model Enumeration fully operational', {
        scanner: hubScanner.getStats(),
        processor: parallelProcessor.getStats(),
        component: 'main'
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize Module 4: Model Enumeration', {
        error: error.message,
        component: 'main'
      });
      throw error;
    }
  }

  /**
   * Initialize Module 5: API Validation
   */
  async initializeValidation() {
    try {
      this.logger.info('🔄 Initializing Module 5: API Validation...');

      // Step 24: Initialize API tester
      await apiTester.initialize();
      this.logger.debug('✅ Step 24: API endpoint testing framework initialized');

      // Step 25: Initialize capability verifier
      await capabilityVerifier.initialize();
      this.logger.debug('✅ Step 25: Capability verification system initialized');

      // Step 26: Initialize quality analyzer
      await qualityAnalyzer.initialize();
      this.logger.debug('✅ Step 26: Quality analysis system initialized');

      // Step 27: Initialize benchmark suite
      await benchmarkSuite.initialize();
      this.logger.debug('✅ Step 27: Performance benchmarking suite initialized');

      // Step 28: Initialize reliability monitor
      await reliabilityMonitor.initialize();
      this.logger.debug('✅ Step 28: Reliability monitoring system initialized');

      // Step 29: Initialize validation reporter
      await validationReporter.initialize();
      this.logger.debug('✅ Step 29: Validation reporting system initialized');

      this.logger.info('🎉 Module 5: API Validation fully operational', {
        tester: apiTester.getStats(),
        verifier: capabilityVerifier.getStats(),
        analyzer: qualityAnalyzer.getStats(),
        benchmark: benchmarkSuite.getStats(),
        monitor: reliabilityMonitor.getStats(),
        reporter: validationReporter.getStats(),
        component: 'main'
      });

    } catch (error) {
      this.logger.error('❌ Failed to initialize Module 5: API Validation', {
        error: error.message,
        component: 'main'
      });
      throw error;
    }
  }

  async run() {
    try {
      await this.initialize();
      
      // Parse CLI arguments and execute commands
      this.cli.parse();
      
    } catch (error) {
      this.errorHandler.handle(error, { context: 'application_run' });
      process.exit(1);
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Intelligent Model Discovery System');
    
    try {
      // Graceful shutdown of all modules in reverse order
      await this.shutdownValidation();      // Module 5
      await this.shutdownModelEnumeration(); // Module 4
      await this.shutdownProviders();       // Module 3
      await this.shutdownDatabase();        // Module 2
      
      // Graceful shutdown procedures for future modules:
      // await this.stopMonitoring();
      // await this.cleanupResources();

    } catch (error) {
      this.logger.error('Error during shutdown', { error: error.message });
    }

    process.exit(0);
  }

  /**
   * Shutdown Module 2: Database & Storage
   */
  async shutdownDatabase() {
    try {
      this.logger.info('🔄 Shutting down Module 2: Database & Storage...');

      // Cleanup in reverse order of initialization
      await qdrantManager.disconnect();
      await embeddingsManager.cleanup();
      await backupManager.cleanup();
      await cacheManager.cleanup();

      this.logger.info('✅ Module 2: Database & Storage shutdown completed');
    } catch (error) {
      this.logger.error('❌ Error shutting down Module 2', {
        error: error.message,
        component: 'main'
      });
    }
  }

  /**
   * Shutdown Module 3: Provider Discovery
   */
  async shutdownProviders() {
    try {
      this.logger.info('🔄 Shutting down Module 3: Provider Discovery...');

      await enumerator.cleanup();
      await providerOrchestrator.cleanup();

      this.logger.info('✅ Module 3: Provider Discovery shutdown completed');
    } catch (error) {
      this.logger.error('❌ Error shutting down Module 3', {
        error: error.message,
        component: 'main'
      });
    }
  }

  /**
   * Shutdown Module 4: Model Enumeration
   */
  async shutdownModelEnumeration() {
    try {
      this.logger.info('🔄 Shutting down Module 4: Model Enumeration...');

      await progressTracker.cleanup();
      await parallelProcessor.cleanup();
      await aggregator.cleanup();
      await providerScanner.cleanup();
      await hubScanner.cleanup();

      this.logger.info('✅ Module 4: Model Enumeration shutdown completed');
    } catch (error) {
      this.logger.error('❌ Error shutting down Module 4', {
        error: error.message,
        component: 'main'
      });
    }
  }

  /**
   * Shutdown Module 5: API Validation
   */
  async shutdownValidation() {
    try {
      this.logger.info('🔄 Shutting down Module 5: API Validation...');

      await validationReporter.cleanup();
      await reliabilityMonitor.cleanup();
      await benchmarkSuite.cleanup();
      await qualityAnalyzer.cleanup();
      await capabilityVerifier.cleanup();
      await apiTester.cleanup();

      this.logger.info('✅ Module 5: API Validation shutdown completed');
    } catch (error) {
      this.logger.error('❌ Error shutting down Module 5', {
        error: error.message,
        component: 'main'
      });
    }
  }

  // Static method for programmatic usage
  static async create(options = {}) {
    const app = new IntelligentDiscovery();
    
    if (options.skipCliParsing) {
      await app.initialize();
      return app;
    }
    
    await app.run();
    return app;
  }
}

// Export for programmatic usage
export default IntelligentDiscovery;

// Run as CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new IntelligentDiscovery();
  app.run().catch((error) => {
    logger.error('Application startup failed', { error: error.message });
    process.exit(1);
  });
}