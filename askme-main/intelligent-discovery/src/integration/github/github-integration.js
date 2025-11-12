import { createLogger } from '../../core/infrastructure/logger.js';
import { supabaseSync } from '../sync/supabase-sync.js';
import { changeTracker } from '../../output/tracking/change-tracker.js';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

class GitHubIntegration {
  constructor() {
    this.logger = createLogger({ component: 'github-integration' });
    this.isInitialized = false;
    this.octokit = null;
    this.workflowHistory = new Map();
    
    // GitHub Actions configuration
    this.githubConfig = {
      githubToken: process.env.GITHUB_TOKEN,
      githubRepo: process.env.GITHUB_REPO || 'intelligent-discovery',
      githubOwner: process.env.GITHUB_OWNER || 'ai-models',
      workflowsDirectory: '.github/workflows',
      artifactsDirectory: './artifacts',
      branchName: 'automated-sync',
      enablePullRequests: true,
      enableIssues: true,
      enableReleases: true
    };
    
    // Workflow templates
    this.workflowTemplates = {
      'model_sync': {
        name: 'Model Synchronization',
        description: 'Automated model discovery and synchronization workflow',
        filename: 'model-sync.yml',
        triggers: ['schedule', 'workflow_dispatch', 'push'],
        processor: this.generateModelSyncWorkflow.bind(this)
      },
      'validation_pipeline': {
        name: 'Model Validation Pipeline',
        description: 'Comprehensive model validation and testing',
        filename: 'validation-pipeline.yml',
        triggers: ['pull_request', 'workflow_dispatch'],
        processor: this.generateValidationWorkflow.bind(this)
      },
      'export_pipeline': {
        name: 'Export and Deploy Pipeline',
        description: 'Export catalog and deploy to various platforms',
        filename: 'export-deploy.yml',
        triggers: ['workflow_run', 'workflow_dispatch'],
        processor: this.generateExportWorkflow.bind(this)
      },
      'performance_monitoring': {
        name: 'Performance Monitoring',
        description: 'Continuous performance monitoring and alerting',
        filename: 'performance-monitoring.yml',
        triggers: ['schedule', 'workflow_dispatch'],
        processor: this.generateMonitoringWorkflow.bind(this)
      },
      'release_automation': {
        name: 'Release Automation',
        description: 'Automated release creation and changelog generation',
        filename: 'release-automation.yml',
        triggers: ['push', 'workflow_dispatch'],
        processor: this.generateReleaseWorkflow.bind(this)
      }
    };
    
    // GitHub Actions steps library
    this.actionSteps = {
      setup_node: {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v4',
        with: {
          'node-version': '18',
          'cache': 'npm'
        }
      },
      checkout: {
        name: 'Checkout code',
        uses: 'actions/checkout@v4',
        with: {
          'fetch-depth': 0
        }
      },
      cache_dependencies: {
        name: 'Cache dependencies',
        uses: 'actions/cache@v3',
        with: {
          path: '~/.npm',
          key: '${{ runner.os }}-node-${{ hashFiles(\'**/package-lock.json\') }}',
          'restore-keys': '${{ runner.os }}-node-'
        }
      },
      install_dependencies: {
        name: 'Install dependencies',
        run: 'npm ci'
      },
      run_discovery: {
        name: 'Run model discovery',
        run: 'npm run discover',
        timeout: 30,
        env: {
          OPENAI_API_KEY: '${{ secrets.OPENAI_API_KEY }}',
          ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
          GEMINI_API_KEY: '${{ secrets.GEMINI_API_KEY }}',
          HUGGINGFACE_API_KEY: '${{ secrets.HUGGINGFACE_API_KEY }}',
          QDRANT_API_KEY: '${{ secrets.QDRANT_API_KEY }}',
          SUPABASE_URL: '${{ secrets.SUPABASE_URL }}',
          SUPABASE_SERVICE_ROLE_KEY: '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'
        }
      },
      run_validation: {
        name: 'Run model validation',
        run: 'npm run validate',
        timeout: 45,
        env: {
          VALIDATION_TIMEOUT: '300000',
          MAX_CONCURRENT_VALIDATIONS: '5'
        }
      },
      generate_exports: {
        name: 'Generate exports',
        run: 'npm run export',
        timeout: 15
      },
      sync_supabase: {
        name: 'Sync to Supabase',
        run: 'npm run sync:supabase',
        timeout: 10,
        env: {
          SUPABASE_URL: '${{ secrets.SUPABASE_URL }}',
          SUPABASE_SERVICE_ROLE_KEY: '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'
        }
      },
      upload_artifacts: {
        name: 'Upload artifacts',
        uses: 'actions/upload-artifact@v3',
        with: {
          name: 'model-catalog-${{ github.run_number }}',
          path: 'exports/',
          'retention-days': 30
        }
      },
      create_pull_request: {
        name: 'Create Pull Request',
        uses: 'peter-evans/create-pull-request@v5',
        with: {
          token: '${{ secrets.GITHUB_TOKEN }}',
          'commit-message': 'chore: automated model catalog update',
          title: 'Automated Model Catalog Update - Run #${{ github.run_number }}',
          body: 'Automated update of model catalog with latest discoveries and validations.',
          branch: 'automated-sync-${{ github.run_number }}',
          'delete-branch': true
        }
      },
      notify_teams: {
        name: 'Notify Teams',
        uses: 'rtCamp/action-slack-notify@v2',
        env: {
          SLACK_WEBHOOK: '${{ secrets.SLACK_WEBHOOK }}',
          SLACK_CHANNEL: 'ai-models',
          SLACK_COLOR: '${{ job.status }}',
          SLACK_MESSAGE: 'Model catalog sync completed with status: ${{ job.status }}'
        }
      }
    };
    
    // Integration strategies
    this.integrationStrategies = {
      'continuous_sync': {
        description: 'Continuous synchronization with model providers',
        schedule: '0 */6 * * *', // Every 6 hours
        processor: this.setupContinuousSync.bind(this)
      },
      'daily_validation': {
        description: 'Daily comprehensive validation pipeline',
        schedule: '0 2 * * *', // Daily at 2 AM
        processor: this.setupDailyValidation.bind(this)
      },
      'weekly_export': {
        description: 'Weekly export and deployment pipeline',
        schedule: '0 0 * * 0', // Weekly on Sunday
        processor: this.setupWeeklyExport.bind(this)
      },
      'on_demand': {
        description: 'Manual trigger for immediate sync',
        trigger: 'workflow_dispatch',
        processor: this.setupOnDemandSync.bind(this)
      }
    };
    
    // Repository management
    this.repoConfig = {
      defaultBranch: 'main',
      protectedBranches: ['main', 'production'],
      requiredChecks: ['model-validation', 'export-validation'],
      autoMerge: false,
      deleteHeadBranches: true,
      enableSquashMerge: true
    };
    
    // Issue templates
    this.issueTemplates = {
      'validation_failure': {
        title: 'Model Validation Failure - {model_name}',
        labels: ['bug', 'validation', 'automated'],
        assignees: ['ai-team'],
        template: this.generateValidationIssueTemplate.bind(this)
      },
      'sync_failure': {
        title: 'Synchronization Failure - {sync_type}',
        labels: ['bug', 'sync', 'automated'],
        assignees: ['devops-team'],
        template: this.generateSyncIssueTemplate.bind(this)
      },
      'performance_regression': {
        title: 'Performance Regression Detected - {metric}',
        labels: ['performance', 'regression', 'automated'],
        assignees: ['performance-team'],
        template: this.generatePerformanceIssueTemplate.bind(this)
      }
    };
    
    // Release automation
    this.releaseConfig = {
      automaticReleases: true,
      releaseStrategy: 'semantic',
      changelogGeneration: true,
      assetGeneration: true,
      notificationChannels: ['slack', 'email'],
      preReleaseTesting: true
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing GitHub integration');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Initialize Octokit client
      await this.initializeGitHubClient();
      
      // Verify repository access
      await this.verifyRepositoryAccess();
      
      // Setup webhook configurations
      await this.setupWebhookConfigurations();
      
      // Initialize workflow history
      await this.loadWorkflowHistory();
      
      this.isInitialized = true;
      this.logger.info('GitHub integration initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize GitHub integration', { error: error.message });
      throw error;
    }
  }

  async createWorkflow(workflowName, options = {}) {
    if (!this.isInitialized) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      this.logger.info('Creating GitHub workflow', {
        workflow: workflowName,
        options: Object.keys(options)
      });

      const workflow = this.workflowTemplates[workflowName];
      if (!workflow) {
        throw new Error(`Unknown workflow template: ${workflowName}`);
      }

      const startTime = Date.now();
      const workflowId = this.generateWorkflowId();

      // Generate workflow YAML content
      const workflowContent = await workflow.processor(options);
      
      // Create workflow file
      const workflowPath = await this.createWorkflowFile(
        workflowContent, 
        workflow.filename, 
        options
      );
      
      // Commit and push workflow
      if (options.deployToGitHub !== false) {
        await this.deployWorkflowToGitHub(workflowPath, workflow.filename, options);
      }
      
      // Create workflow record
      const workflowRecord = {
        workflow_id: workflowId,
        name: workflowName,
        filename: workflow.filename,
        workflow_path: workflowPath,
        triggers: workflow.triggers,
        created_at: Date.now(),
        deployed: options.deployToGitHub !== false,
        options_applied: options,
        processing_time: Date.now() - startTime
      };

      // Store workflow history
      this.workflowHistory.set(workflowId, workflowRecord);

      this.logger.info('GitHub workflow created successfully', {
        workflow: workflowName,
        workflow_id: workflowId,
        deployed: workflowRecord.deployed,
        processing_time: workflowRecord.processing_time
      });

      return workflowRecord;

    } catch (error) {
      this.logger.error('Failed to create GitHub workflow', { 
        workflow: workflowName, 
        error: error.message 
      });
      throw error;
    }
  }

  async triggerWorkflow(workflowName, inputs = {}) {
    if (!this.isInitialized) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      this.logger.info('Triggering GitHub workflow', {
        workflow: workflowName,
        inputs: Object.keys(inputs)
      });

      // Dispatch workflow
      const response = await this.octokit.rest.actions.createWorkflowDispatch({
        owner: this.githubConfig.githubOwner,
        repo: this.githubConfig.githubRepo,
        workflow_id: `${workflowName}.yml`,
        ref: this.githubConfig.defaultBranch || 'main',
        inputs: inputs
      });

      const triggerRecord = {
        trigger_id: this.generateTriggerId(),
        workflow_name: workflowName,
        inputs: inputs,
        github_response: response.data,
        triggered_at: Date.now(),
        status: 'triggered'
      };

      this.logger.info('GitHub workflow triggered successfully', {
        workflow: workflowName,
        trigger_id: triggerRecord.trigger_id
      });

      return triggerRecord;

    } catch (error) {
      this.logger.error('Failed to trigger GitHub workflow', { 
        workflow: workflowName, 
        error: error.message 
      });
      throw error;
    }
  }

  // Workflow generators
  async generateModelSyncWorkflow(options) {
    const workflow = {
      name: 'Model Synchronization',
      on: {
        schedule: [
          { cron: '0 */6 * * *' } // Every 6 hours
        ],
        workflow_dispatch: {
          inputs: {
            sync_strategy: {
              description: 'Synchronization strategy',
              required: false,
              default: 'incremental_sync',
              type: 'choice',
              options: ['full_sync', 'incremental_sync', 'batch_upsert', 'change_based_sync']
            },
            dry_run: {
              description: 'Perform dry run',
              required: false,
              default: false,
              type: 'boolean'
            }
          }
        },
        push: {
          branches: ['main'],
          paths: ['src/**', 'config/**']
        }
      },
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      jobs: {
        sync: {
          'runs-on': 'ubuntu-latest',
          'timeout-minutes': 120,
          steps: [
            this.actionSteps.checkout,
            this.actionSteps.setup_node,
            this.actionSteps.cache_dependencies,
            this.actionSteps.install_dependencies,
            {
              name: 'Run model discovery',
              run: 'npm run discover',
              'timeout-minutes': 30,
              env: {
                ...this.actionSteps.run_discovery.env,
                SYNC_STRATEGY: '${{ github.event.inputs.sync_strategy || \'incremental_sync\' }}',
                DRY_RUN: '${{ github.event.inputs.dry_run || \'false\' }}'
              }
            },
            this.actionSteps.run_validation,
            this.actionSteps.generate_exports,
            this.actionSteps.sync_supabase,
            this.actionSteps.upload_artifacts,
            {
              ...this.actionSteps.create_pull_request,
              if: 'success() && github.event_name != \'pull_request\''
            },
            {
              ...this.actionSteps.notify_teams,
              if: 'always()'
            }
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  async generateValidationWorkflow(options) {
    const workflow = {
      name: 'Model Validation Pipeline',
      on: {
        pull_request: {
          branches: ['main'],
          paths: ['src/**', 'data/**']
        },
        workflow_dispatch: {
          inputs: {
            validation_level: {
              description: 'Validation level',
              required: false,
              default: 'comprehensive',
              type: 'choice',
              options: ['basic', 'comprehensive', 'full']
            }
          }
        }
      },
      jobs: {
        validate: {
          'runs-on': 'ubuntu-latest',
          'timeout-minutes': 60,
          strategy: {
            matrix: {
              'validation-type': ['api', 'performance', 'quality', 'security']
            }
          },
          steps: [
            this.actionSteps.checkout,
            this.actionSteps.setup_node,
            this.actionSteps.install_dependencies,
            {
              name: 'Run ${{ matrix.validation-type }} validation',
              run: 'npm run validate:${{ matrix.validation-type }}',
              'timeout-minutes': 20,
              env: {
                VALIDATION_LEVEL: '${{ github.event.inputs.validation_level || \'comprehensive\' }}'
              }
            },
            {
              name: 'Upload validation results',
              uses: 'actions/upload-artifact@v3',
              if: 'always()',
              with: {
                name: 'validation-results-${{ matrix.validation-type }}',
                path: 'validation-results/',
                'retention-days': 7
              }
            }
          ]
        },
        report: {
          needs: 'validate',
          'runs-on': 'ubuntu-latest',
          if: 'always()',
          steps: [
            this.actionSteps.checkout,
            {
              name: 'Download validation results',
              uses: 'actions/download-artifact@v3',
              with: {
                path: 'validation-results/'
              }
            },
            {
              name: 'Generate validation report',
              run: 'npm run report:validation'
            },
            {
              name: 'Comment PR with results',
              uses: 'actions/github-script@v6',
              if: 'github.event_name == \'pull_request\'',
              with: {
                script: `
                  const fs = require('fs');
                  const report = fs.readFileSync('validation-results/summary.md', 'utf8');
                  
                  github.rest.issues.createComment({
                    issue_number: context.issue.number,
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    body: report
                  });
                `
              }
            }
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  async generateExportWorkflow(options) {
    const workflow = {
      name: 'Export and Deploy Pipeline',
      on: {
        workflow_run: {
          workflows: ['Model Synchronization'],
          types: ['completed'],
          branches: ['main']
        },
        workflow_dispatch: {
          inputs: {
            export_formats: {
              description: 'Export formats (comma-separated)',
              required: false,
              default: 'json,csv,markdown,api'
            },
            deploy_targets: {
              description: 'Deployment targets (comma-separated)',
              required: false,
              default: 'supabase,cdn,docs'
            }
          }
        }
      },
      jobs: {
        export: {
          'runs-on': 'ubuntu-latest',
          if: '${{ github.event.workflow_run.conclusion == \'success\' || github.event_name == \'workflow_dispatch\' }}',
          steps: [
            this.actionSteps.checkout,
            this.actionSteps.setup_node,
            this.actionSteps.install_dependencies,
            {
              name: 'Generate all exports',
              run: 'npm run export:all',
              env: {
                EXPORT_FORMATS: '${{ github.event.inputs.export_formats || \'json,csv,markdown,api\' }}'
              }
            },
            {
              name: 'Deploy to Supabase',
              run: 'npm run deploy:supabase',
              if: 'contains(github.event.inputs.deploy_targets, \'supabase\') || github.event_name == \'workflow_run\'',
              env: {
                SUPABASE_URL: '${{ secrets.SUPABASE_URL }}',
                SUPABASE_SERVICE_ROLE_KEY: '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'
              }
            },
            {
              name: 'Deploy to CDN',
              run: 'npm run deploy:cdn',
              if: 'contains(github.event.inputs.deploy_targets, \'cdn\') || github.event_name == \'workflow_run\'',
              env: {
                CDN_API_KEY: '${{ secrets.CDN_API_KEY }}',
                CDN_ENDPOINT: '${{ secrets.CDN_ENDPOINT }}'
              }
            },
            {
              name: 'Deploy documentation',
              run: 'npm run deploy:docs',
              if: 'contains(github.event.inputs.deploy_targets, \'docs\') || github.event_name == \'workflow_run\'',
              env: {
                DOCS_DEPLOY_TOKEN: '${{ secrets.DOCS_DEPLOY_TOKEN }}'
              }
            },
            this.actionSteps.upload_artifacts
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  async generateMonitoringWorkflow(options) {
    const workflow = {
      name: 'Performance Monitoring',
      on: {
        schedule: [
          { cron: '0 */2 * * *' } // Every 2 hours
        ],
        workflow_dispatch: {}
      },
      jobs: {
        monitor: {
          'runs-on': 'ubuntu-latest',
          steps: [
            this.actionSteps.checkout,
            this.actionSteps.setup_node,
            this.actionSteps.install_dependencies,
            {
              name: 'Run performance monitoring',
              run: 'npm run monitor:performance',
              env: {
                MONITORING_INTERVAL: '3600000', // 1 hour
                ALERT_THRESHOLDS: 'latency:1000,accuracy:0.8,availability:0.95'
              }
            },
            {
              name: 'Check for regressions',
              run: 'npm run check:regressions'
            },
            {
              name: 'Create performance issue',
              if: 'failure()',
              uses: 'actions/github-script@v6',
              with: {
                script: `
                  const title = 'Performance Regression Detected - ' + new Date().toISOString();
                  const body = 'Automated performance monitoring detected a regression. Please investigate.';
                  
                  github.rest.issues.create({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    title: title,
                    body: body,
                    labels: ['performance', 'regression', 'automated']
                  });
                `
              }
            }
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  async generateReleaseWorkflow(options) {
    const workflow = {
      name: 'Release Automation',
      on: {
        push: {
          branches: ['main'],
          paths: ['package.json', 'CHANGELOG.md']
        },
        workflow_dispatch: {
          inputs: {
            release_type: {
              description: 'Release type',
              required: true,
              type: 'choice',
              options: ['patch', 'minor', 'major']
            }
          }
        }
      },
      jobs: {
        release: {
          'runs-on': 'ubuntu-latest',
          if: 'contains(github.event.head_commit.message, \'chore(release)\') || github.event_name == \'workflow_dispatch\'',
          steps: [
            this.actionSteps.checkout,
            this.actionSteps.setup_node,
            this.actionSteps.install_dependencies,
            {
              name: 'Generate changelog',
              run: 'npm run changelog:generate'
            },
            {
              name: 'Create release assets',
              run: 'npm run build:release'
            },
            {
              name: 'Create GitHub release',
              uses: 'actions/create-release@v1',
              env: {
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'
              },
              with: {
                tag_name: 'v${{ github.run_number }}',
                release_name: 'Release v${{ github.run_number }}',
                body_path: 'CHANGELOG.md',
                draft: false,
                prerelease: false
              }
            }
          ]
        }
      }
    };

    return this.convertToYAML(workflow);
  }

  // Helper methods
  async validateConfiguration() {
    const requiredEnvVars = ['GITHUB_TOKEN'];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set`);
      }
    }
  }

  async initializeGitHubClient() {
    this.octokit = new Octokit({
      auth: this.githubConfig.githubToken,
      userAgent: 'AI-Model-Discovery/1.0.0'
    });
  }

  async verifyRepositoryAccess() {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.githubConfig.githubOwner,
        repo: this.githubConfig.githubRepo
      });
      
      this.logger.info('Repository access verified', { 
        repo: data.full_name,
        private: data.private 
      });
    } catch (error) {
      throw new Error(`Failed to access repository: ${error.message}`);
    }
  }

  async createWorkflowFile(content, filename, options) {
    const workflowsDir = path.join(process.cwd(), this.githubConfig.workflowsDirectory);
    await fs.mkdir(workflowsDir, { recursive: true });
    
    const filePath = path.join(workflowsDir, filename);
    await fs.writeFile(filePath, content, 'utf8');
    
    return filePath;
  }

  async deployWorkflowToGitHub(localPath, filename, options) {
    try {
      const content = await fs.readFile(localPath, 'utf8');
      const encodedContent = Buffer.from(content).toString('base64');
      
      // Check if file exists
      let sha;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.githubConfig.githubOwner,
          repo: this.githubConfig.githubRepo,
          path: `.github/workflows/${filename}`
        });
        sha = data.sha;
      } catch (error) {
        // File doesn't exist, that's okay
      }
      
      // Create or update file
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.githubConfig.githubOwner,
        repo: this.githubConfig.githubRepo,
        path: `.github/workflows/${filename}`,
        message: `chore: update ${filename} workflow`,
        content: encodedContent,
        sha: sha,
        branch: this.githubConfig.defaultBranch || 'main'
      });
      
      this.logger.info('Workflow deployed to GitHub', { filename });
    } catch (error) {
      this.logger.error('Failed to deploy workflow to GitHub', { 
        filename, 
        error: error.message 
      });
      throw error;
    }
  }

  convertToYAML(workflow) {
    // Simple YAML conversion - in production, use a proper YAML library
    const yamlLines = [];
    
    const convertObject = (obj, indent = 0) => {
      const spaces = '  '.repeat(indent);
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          yamlLines.push(`${spaces}${key}:`);
          convertObject(value, indent + 1);
        } else if (Array.isArray(value)) {
          yamlLines.push(`${spaces}${key}:`);
          for (const item of value) {
            if (typeof item === 'object') {
              yamlLines.push(`${spaces}  -`);
              convertObject(item, indent + 2);
            } else {
              yamlLines.push(`${spaces}  - ${item}`);
            }
          }
        } else {
          const valueStr = typeof value === 'string' && 
                          (value.includes(':') || value.includes('$') || value.includes('\n'))
                          ? `"${value.replace(/"/g, '\\"')}"` 
                          : value;
          yamlLines.push(`${spaces}${key}: ${valueStr}`);
        }
      }
    };
    
    convertObject(workflow);
    return yamlLines.join('\n');
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTriggerId() {
    return `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Placeholder methods for complex operations
  async setupWebhookConfigurations() { /* Implementation details */ }
  async loadWorkflowHistory() { /* Implementation details */ }
  async setupContinuousSync(options) { /* Implementation details */ }
  async setupDailyValidation(options) { /* Implementation details */ }
  async setupWeeklyExport(options) { /* Implementation details */ }
  async setupOnDemandSync(options) { /* Implementation details */ }
  generateValidationIssueTemplate(context) { return 'Validation failure template'; }
  generateSyncIssueTemplate(context) { return 'Sync failure template'; }
  generatePerformanceIssueTemplate(context) { return 'Performance issue template'; }

  getStats() {
    return {
      initialized: this.isInitialized,
      workflow_templates: Object.keys(this.workflowTemplates).length,
      action_steps: Object.keys(this.actionSteps).length,
      integration_strategies: Object.keys(this.integrationStrategies).length,
      workflow_history: this.workflowHistory.size,
      github_repo: `${this.githubConfig.githubOwner}/${this.githubConfig.githubRepo}`
    };
  }

  async cleanup() {
    if (this.octokit) {
      this.octokit = null;
    }
    
    this.workflowHistory.clear();
    this.isInitialized = false;
    this.logger.info('GitHub integration cleaned up');
  }
}

export const githubIntegration = new GitHubIntegration();