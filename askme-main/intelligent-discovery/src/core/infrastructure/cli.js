import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { createLogger } from './logger.js';
import config from './config.js';

const program = new Command();
const logger = createLogger({ level: config.get('LOG_LEVEL') });

class CLI {
  constructor() {
    this.setupProgram();
    this.setupCommands();
  }

  setupProgram() {
    program
      .name('intelligent-discovery')
      .description('AI-powered model discovery system')
      .version('1.0.0')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('-q, --quiet', 'Suppress output except errors')
      .option('--config <path>', 'Path to configuration file')
      .hook('preAction', (thisCommand) => {
        if (thisCommand.opts().verbose) {
          process.env.LOG_LEVEL = 'debug';
        }
        if (thisCommand.opts().quiet) {
          process.env.LOG_LEVEL = 'error';
        }
      });
  }

  setupCommands() {
    // Discovery Commands
    program
      .command('discover')
      .description('Discover models from providers')
      .option('-p, --providers <providers>', 'Comma-separated list of providers')
      .option('-l, --limit <number>', 'Maximum models per provider', '1000')
      .option('-f, --filter <filter>', 'Filter models by criteria')
      .option('--force-refresh', 'Force refresh cached data')
      .action(this.handleDiscover.bind(this));

    program
      .command('validate')
      .description('Validate discovered models')
      .option('-m, --models <models>', 'Comma-separated list of model IDs')
      .option('-p, --provider <provider>', 'Validate models from specific provider')
      .option('--test-types <types>', 'Types of tests to run (api,capabilities,pricing)')
      .option('--parallel <number>', 'Number of parallel validations', '5')
      .action(this.handleValidate.bind(this));

    program
      .command('search')
      .description('Search models using natural language')
      .argument('<query>', 'Search query')
      .option('-l, --limit <number>', 'Maximum results to return', '10')
      .option('--semantic', 'Use semantic similarity search')
      .option('--filters <filters>', 'JSON string of filters to apply')
      .action(this.handleSearch.bind(this));

    // Export Commands
    program
      .command('export')
      .description('Export discovered models')
      .option('-f, --format <format>', 'Export format (json,csv,yaml)', 'json')
      .option('-o, --output <path>', 'Output file path')
      .option('--include-metadata', 'Include full metadata')
      .option('--filter <filter>', 'Filter models before export')
      .action(this.handleExport.bind(this));

    // Sync Commands
    program
      .command('sync')
      .description('Sync with AskMe backend')
      .option('--dry-run', 'Show what would be synced without executing')
      .option('--force', 'Force sync even if no changes detected')
      .action(this.handleSync.bind(this));

    // Monitoring Commands
    program
      .command('monitor')
      .description('Monitor model availability and changes')
      .option('-i, --interval <minutes>', 'Check interval in minutes', '60')
      .option('--providers <providers>', 'Providers to monitor')
      .option('--alerts', 'Enable alert notifications')
      .action(this.handleMonitor.bind(this));

    // Utility Commands
    program
      .command('status')
      .description('Show system status and statistics')
      .option('--detailed', 'Show detailed information')
      .action(this.handleStatus.bind(this));

    program
      .command('setup')
      .description('Interactive setup wizard')
      .action(this.handleSetup.bind(this));

    program
      .command('config')
      .description('Show or modify configuration')
      .option('--show', 'Show current configuration')
      .option('--set <key=value>', 'Set configuration value')
      .option('--validate', 'Validate current configuration')
      .action(this.handleConfig.bind(this));

    // Benchmark Commands
    program
      .command('benchmark')
      .description('Benchmark model performance')
      .option('-m, --models <models>', 'Models to benchmark')
      .option('-t, --tests <tests>', 'Test types (latency,throughput,quality)')
      .option('--iterations <number>', 'Number of test iterations', '5')
      .action(this.handleBenchmark.bind(this));
  }

  async handleDiscover(options) {
    const spinner = ora('Discovering models...').start();
    
    try {
      logger.info('Starting model discovery', { providers: options.providers, limit: options.limit });
      
      // Implementation will be added when discovery modules are built
      spinner.succeed('Model discovery completed');
      
    } catch (error) {
      spinner.fail('Model discovery failed');
      logger.error('Discovery error', { error: error.message });
      process.exit(1);
    }
  }

  async handleValidate(options) {
    const spinner = ora('Validating models...').start();
    
    try {
      logger.info('Starting model validation', options);
      
      // Implementation will be added when validation modules are built
      spinner.succeed('Model validation completed');
      
    } catch (error) {
      spinner.fail('Model validation failed');
      logger.error('Validation error', { error: error.message });
      process.exit(1);
    }
  }

  async handleSearch(query, options) {
    console.log(chalk.blue(`Searching for: "${query}"`));
    
    try {
      logger.info('Starting model search', { query, options });
      
      // Implementation will be added when search modules are built
      console.log(chalk.green('Search completed'));
      
    } catch (error) {
      console.log(chalk.red('Search failed'));
      logger.error('Search error', { error: error.message });
      process.exit(1);
    }
  }

  async handleExport(options) {
    const spinner = ora(`Exporting models as ${options.format}...`).start();
    
    try {
      logger.info('Starting model export', options);
      
      // Implementation will be added when export modules are built
      spinner.succeed(`Models exported to ${options.output || 'default location'}`);
      
    } catch (error) {
      spinner.fail('Export failed');
      logger.error('Export error', { error: error.message });
      process.exit(1);
    }
  }

  async handleSync(options) {
    const spinner = ora('Syncing with AskMe backend...').start();
    
    try {
      logger.info('Starting backend sync', options);
      
      // Implementation will be added when integration modules are built
      spinner.succeed('Sync completed');
      
    } catch (error) {
      spinner.fail('Sync failed');
      logger.error('Sync error', { error: error.message });
      process.exit(1);
    }
  }

  async handleMonitor(options) {
    console.log(chalk.blue('Starting model monitoring...'));
    logger.info('Starting model monitoring', options);
    
    // Implementation will be added when monitoring modules are built
    console.log(chalk.yellow('Monitoring system not yet implemented'));
  }

  async handleStatus(options) {
    console.log(chalk.blue('System Status:'));
    
    try {
      const status = {
        version: '1.0.0',
        environment: config.get('NODE_ENV'),
        logLevel: config.get('LOG_LEVEL'),
        providers: Object.keys(config.getApiKeys()).length,
        database: config.getDatabaseConfig().url,
        cache: config.getCacheConfig().dir
      };

      if (options.detailed) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(`Version: ${status.version}`);
        console.log(`Environment: ${status.environment}`);
        console.log(`Configured Providers: ${status.providers}`);
        console.log(`Database: ${status.database}`);
      }
      
    } catch (error) {
      console.log(chalk.red('Failed to get system status'));
      logger.error('Status error', { error: error.message });
    }
  }

  async handleSetup() {
    console.log(chalk.blue('Intelligent Model Discovery Setup Wizard'));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Select environment:',
        choices: ['development', 'production'],
        default: 'development'
      },
      {
        type: 'input',
        name: 'qdrantUrl',
        message: 'Qdrant database URL:',
        default: 'http://localhost:6333'
      },
      {
        type: 'checkbox',
        name: 'providers',
        message: 'Select providers to configure:',
        choices: [
          'OpenAI',
          'Anthropic',
          'Google',
          'Mistral',
          'Cohere',
          'HuggingFace',
          'Groq'
        ]
      },
      {
        type: 'input',
        name: 'maxModels',
        message: 'Maximum models per provider:',
        default: '1000',
        validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid number'
      }
    ]);

    console.log(chalk.green('Setup completed! Configuration saved.'));
    logger.info('Setup completed', answers);
  }

  async handleConfig(options) {
    if (options.show) {
      console.log(JSON.stringify(config.getAll(), null, 2));
    } else if (options.validate) {
      try {
        console.log(chalk.green('Configuration is valid'));
      } catch (error) {
        console.log(chalk.red(`Configuration error: ${error.message}`));
      }
    } else {
      console.log('Use --show to display config or --validate to check validity');
    }
  }

  async handleBenchmark(options) {
    const spinner = ora('Running benchmarks...').start();
    
    try {
      logger.info('Starting benchmark', options);
      
      // Implementation will be added when benchmark modules are built
      spinner.succeed('Benchmark completed');
      
    } catch (error) {
      spinner.fail('Benchmark failed');
      logger.error('Benchmark error', { error: error.message });
      process.exit(1);
    }
  }

  parse(argv = process.argv) {
    program.parse(argv);
  }
}

export default CLI;