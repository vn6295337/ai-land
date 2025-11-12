# Project Structure

```
intelligent-discovery/
├── package.json                    # dependencies and scripts
├── architecture.md                 # modular architecture document
├── problem_analysis.md             # scout-agent issues analysis
├── module_toolstacks.md            # tool stack block diagrams
├── project_structure.md            # this file
├── readme.md                       # project overview and usage
├── contributing.md                 # contribution guidelines
├── changelog.md                    # version history
├── jest.config.js                  # testing configuration
├── eslint.config.js                # linting configuration
│
├── src/
│   ├── main.js                     # application entry point
│   │
│   ├── core/                       # modules 1-2 (infrastructure, database)
│   │   ├── infrastructure/
│   │   │   ├── logger.js
│   │   │   ├── config.js
│   │   │   ├── errors.js
│   │   │   └── cli.js
│   │   └── storage/
│   │       ├── qdrant.js
│   │       ├── embeddings.js
│   │       ├── cache.js
│   │       └── backup.js
│   │
│   ├── discovery/                  # modules 3-4 (provider discovery, enumeration)
│   │   ├── providers/
│   │   │   ├── huggingface.js
│   │   │   ├── openai.js
│   │   │   ├── anthropic.js
│   │   │   ├── google.js
│   │   │   ├── mistral.js
│   │   │   └── orchestrator.js
│   │   └── enumeration/
│   │       ├── hub-scanner.js
│   │       ├── provider-scanner.js
│   │       ├── aggregator.js
│   │       └── filters.js
│   │
│   ├── validation/                 # modules 5-6 (api validation, capabilities)
│   │   ├── api/
│   │   │   ├── endpoint-tester.js
│   │   │   ├── performance.js
│   │   │   ├── auth-checker.js
│   │   │   ├── parameter-validator.js
│   │   │   └── streaming-tester.js
│   │   └── capabilities/
│   │       ├── modality-detector.js
│   │       ├── context-tester.js
│   │       ├── function-tester.js
│   │       ├── language-tester.js
│   │       ├── safety-tester.js
│   │       └── reasoning-benchmark.js
│   │
│   ├── economics/                  # modules 7-8 (pricing, usage analysis)
│   │   ├── pricing/
│   │   │   ├── pricing-apis.js
│   │   │   ├── cost-calculator.js
│   │   │   ├── tier-analyzer.js
│   │   │   ├── model-analyzer.js
│   │   │   ├── price-tracker.js
│   │   │   └── efficiency-calculator.js
│   │   └── usage/
│   │       ├── popularity-analyzer.js
│   │       ├── community-tracker.js
│   │       ├── maintenance-monitor.js
│   │       └── reliability-assessor.js
│   │
│   ├── intelligence/               # modules 9-10 (semantic indexing, rag)
│   │   ├── semantic/
│   │   │   ├── embedding-generator.js
│   │   │   ├── vector-indexer.js
│   │   │   ├── similarity-search.js
│   │   │   ├── clustering.js
│   │   │   └── categorization.js
│   │   └── rag/
│   │       ├── knowledge-base.js
│   │       ├── rag-pipeline.js
│   │       ├── nl-search.js
│   │       ├── recommender.js
│   │       └── comparator.js
│   │
│   ├── filtering/                  # modules 11-12 (business logic, quality scoring)
│   │   ├── business/
│   │   │   ├── compliance-filter.js
│   │   │   ├── pricing-filter.js
│   │   │   ├── trust-filter.js
│   │   │   ├── capability-filter.js
│   │   │   └── rule-engine.js
│   │   └── scoring/
│   │       ├── quality-scorer.js
│   │       ├── weight-calculator.js
│   │       ├── context-ranker.js
│   │       ├── confidence-calculator.js
│   │       └── ab-tester.js
│   │
│   ├── output/                     # modules 13-14 (export, integration)
│   │   ├── export/
│   │   │   ├── json-exporter.js
│   │   │   ├── csv-exporter.js
│   │   │   ├── markdown-generator.js
│   │   │   ├── api-catalog.js
│   │   │   └── diff-reporter.js
│   │   └── integration/
│   │       ├── backend-sync.js
│   │       ├── config-updater.js
│   │       ├── github-integration.js
│   │       ├── webhook-notifier.js
│   │       └── rollback-manager.js
│   │
│   ├── monitoring/                 # modules 15-16 (health, workflows)
│   │   ├── health/
│   │   │   ├── endpoint-monitor.js
│   │   │   ├── availability-tracker.js
│   │   │   ├── change-alerter.js
│   │   │   ├── performance-monitor.js
│   │   │   └── dashboard.js
│   │   └── workflows/
│   │       ├── scheduler.js
│   │       ├── incremental-updater.js
│   │       ├── recovery-manager.js
│   │       ├── notification-system.js
│   │       └── audit-logger.js
│   │
│   ├── interface/                  # modules 17-18 (cli, reporting)
│   │   ├── cli/
│   │   │   ├── commands.js
│   │   │   ├── search-interface.js
│   │   │   ├── compare-tool.js
│   │   │   ├── benchmark-commands.js
│   │   │   └── setup-wizard.js
│   │   └── reporting/
│   │       ├── summary-reporter.js
│   │       ├── trend-analyzer.js
│   │       ├── cost-optimizer.js
│   │       ├── landscape-generator.js
│   │       └── query-analyzer.js
│   │
│   └── advanced/                   # module 19 (ml enhancements)
│       └── ml/
│           ├── predictive-scorer.js
│           ├── anomaly-detector.js
│           ├── auto-categorizer.js
│           ├── smart-cache.js
│           └── intelligent-optimizer.js
│
├── config/                         # configuration files
│   ├── default.yaml               # default configuration
│   ├── development.yaml           # development environment config
│   ├── production.yaml            # production environment config
│   └── providers.yaml             # provider-specific configurations
│
├── data/                          # data storage
│   ├── cache/                     # local cache files
│   ├── exports/                   # generated exports
│   ├── models/                    # discovered model data
│   └── backups/                   # backup files
│
├── logs/                          # log files
│   ├── discovery.log              # discovery operation logs
│   ├── validation.log             # validation logs
│   ├── errors.log                 # error logs
│   └── audit.log                  # audit trail logs
│
├── scripts/                       # utility scripts
│   ├── setup.js                   # initial setup script
│   ├── migrate.js                 # data migration scripts  
│   ├── backup.js                  # backup utilities
│   └── cleanup.js                 # cleanup utilities
│
└── tests/                         # test files
    ├── unit/                      # unit tests
    ├── integration/               # integration tests
    ├── e2e/                       # end-to-end tests
    └── fixtures/                  # test data fixtures
```