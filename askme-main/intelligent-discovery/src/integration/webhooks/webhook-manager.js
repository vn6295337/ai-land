import { createLogger } from '../../core/infrastructure/logger.js';
import { supabaseSync } from '../sync/supabase-sync.js';
import { changeTracker } from '../../output/tracking/change-tracker.js';
import { githubIntegration } from '../github/github-integration.js';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';

class WebhookManager {
  constructor() {
    this.logger = createLogger({ component: 'webhook-manager' });
    this.isInitialized = false;
    this.webhookServer = null;
    this.registeredWebhooks = new Map();
    this.eventQueue = [];
    this.processingQueue = false;
    
    // Webhook configuration
    this.webhookConfig = {
      port: process.env.WEBHOOK_PORT || 3001,
      host: process.env.WEBHOOK_HOST || '0.0.0.0',
      baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3001',
      enableHttps: process.env.WEBHOOK_HTTPS === 'true',
      sslCertPath: process.env.SSL_CERT_PATH,
      sslKeyPath: process.env.SSL_KEY_PATH,
      maxPayloadSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 5000
    };
    
    // Supported webhook events
    this.webhookEvents = {
      'model.discovered': {
        description: 'New model discovered and added to catalog',
        schema: 'model_discovery_event',
        processor: this.processModelDiscoveryEvent.bind(this)
      },
      'model.updated': {
        description: 'Model information updated',
        schema: 'model_update_event',
        processor: this.processModelUpdateEvent.bind(this)
      },
      'model.validated': {
        description: 'Model validation completed',
        schema: 'model_validation_event',
        processor: this.processModelValidationEvent.bind(this)
      },
      'model.deprecated': {
        description: 'Model marked as deprecated',
        schema: 'model_deprecation_event',
        processor: this.processModelDeprecationEvent.bind(this)
      },
      'sync.started': {
        description: 'Synchronization process started',
        schema: 'sync_lifecycle_event',
        processor: this.processSyncLifecycleEvent.bind(this)
      },
      'sync.completed': {
        description: 'Synchronization process completed',
        schema: 'sync_lifecycle_event',
        processor: this.processSyncLifecycleEvent.bind(this)
      },
      'sync.failed': {
        description: 'Synchronization process failed',
        schema: 'sync_lifecycle_event',
        processor: this.processSyncLifecycleEvent.bind(this)
      },
      'export.generated': {
        description: 'Export files generated successfully',
        schema: 'export_event',
        processor: this.processExportEvent.bind(this)
      },
      'performance.regression': {
        description: 'Performance regression detected',
        schema: 'performance_alert_event',
        processor: this.processPerformanceAlertEvent.bind(this)
      },
      'validation.failed': {
        description: 'Model validation failed',
        schema: 'validation_failure_event',
        processor: this.processValidationFailureEvent.bind(this)
      },
      'system.health': {
        description: 'System health status update',
        schema: 'system_health_event',
        processor: this.processSystemHealthEvent.bind(this)
      }
    };
    
    // Event schemas
    this.eventSchemas = {
      'model_discovery_event': {
        type: 'object',
        properties: {
          event_type: { type: 'string', enum: ['model.discovered'] },
          timestamp: { type: 'string', format: 'date-time' },
          model: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              model_type: { type: 'string' },
              discovery_source: { type: 'string' },
              confidence_score: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['id', 'name', 'provider', 'model_type']
          },
          metadata: {
            type: 'object',
            properties: {
              discovery_session_id: { type: 'string' },
              discovery_method: { type: 'string' },
              source_url: { type: 'string' }
            }
          }
        },
        required: ['event_type', 'timestamp', 'model']
      },
      'sync_lifecycle_event': {
        type: 'object',
        properties: {
          event_type: { type: 'string', enum: ['sync.started', 'sync.completed', 'sync.failed'] },
          timestamp: { type: 'string', format: 'date-time' },
          sync_id: { type: 'string' },
          sync_type: { type: 'string', enum: ['full_sync', 'incremental_sync', 'batch_upsert', 'change_based_sync'] },
          status: { type: 'string', enum: ['started', 'completed', 'failed'] },
          statistics: {
            type: 'object',
            properties: {
              records_processed: { type: 'integer' },
              records_updated: { type: 'integer' },
              records_inserted: { type: 'integer' },
              processing_time: { type: 'integer' },
              error_count: { type: 'integer' }
            }
          },
          error_details: { type: 'string' }
        },
        required: ['event_type', 'timestamp', 'sync_id', 'sync_type', 'status']
      },
      'performance_alert_event': {
        type: 'object',
        properties: {
          event_type: { type: 'string', enum: ['performance.regression'] },
          timestamp: { type: 'string', format: 'date-time' },
          alert_id: { type: 'string' },
          metric_name: { type: 'string' },
          current_value: { type: 'number' },
          threshold_value: { type: 'number' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          affected_models: {
            type: 'array',
            items: { type: 'string' }
          },
          suggested_actions: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['event_type', 'timestamp', 'alert_id', 'metric_name', 'severity']
      }
    };
    
    // Notification channels
    this.notificationChannels = {
      'slack': {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        webhook_url: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#ai-models',
        username: 'AI Model Discovery',
        processor: this.sendSlackNotification.bind(this)
      },
      'discord': {
        enabled: process.env.DISCORD_WEBHOOK_URL ? true : false,
        webhook_url: process.env.DISCORD_WEBHOOK_URL,
        username: 'AI Model Discovery',
        processor: this.sendDiscordNotification.bind(this)
      },
      'teams': {
        enabled: process.env.TEAMS_WEBHOOK_URL ? true : false,
        webhook_url: process.env.TEAMS_WEBHOOK_URL,
        processor: this.sendTeamsNotification.bind(this)
      },
      'email': {
        enabled: process.env.SMTP_HOST ? true : false,
        smtp_host: process.env.SMTP_HOST,
        smtp_port: process.env.SMTP_PORT || 587,
        smtp_user: process.env.SMTP_USER,
        smtp_pass: process.env.SMTP_PASS,
        from_email: process.env.FROM_EMAIL,
        to_emails: (process.env.TO_EMAILS || '').split(',').filter(e => e.trim()),
        processor: this.sendEmailNotification.bind(this)
      },
      'github': {
        enabled: true,
        processor: this.sendGitHubNotification.bind(this)
      }
    };
    
    // Webhook endpoints
    this.webhookEndpoints = {
      '/webhooks/github': {
        method: 'POST',
        secret_header: 'x-hub-signature-256',
        secret: process.env.GITHUB_WEBHOOK_SECRET,
        processor: this.processGitHubWebhook.bind(this)
      },
      '/webhooks/supabase': {
        method: 'POST',
        secret_header: 'authorization',
        secret: process.env.SUPABASE_WEBHOOK_SECRET,
        processor: this.processSupabaseWebhook.bind(this)
      },
      '/webhooks/generic': {
        method: 'POST',
        secret_header: 'x-webhook-signature',
        secret: process.env.GENERIC_WEBHOOK_SECRET,
        processor: this.processGenericWebhook.bind(this)
      },
      '/webhooks/health': {
        method: 'GET',
        processor: this.processHealthCheck.bind(this)
      }
    };
    
    // Event subscription management
    this.subscriptions = new Map();
    this.eventFilters = new Map();
    
    // Delivery tracking
    this.deliveryTracking = {
      successful_deliveries: 0,
      failed_deliveries: 0,
      retry_attempts: 0,
      average_delivery_time: 0,
      last_delivery_time: null
    };
  }

  async initialize() {
    try {
      this.logger.info('Initializing webhook manager');
      
      // Validate configuration
      await this.validateConfiguration();
      
      // Create webhook server
      await this.createWebhookServer();
      
      // Load existing subscriptions
      await this.loadSubscriptions();
      
      // Setup default event handlers
      await this.setupDefaultEventHandlers();
      
      // Start event queue processor
      this.startEventQueueProcessor();
      
      this.isInitialized = true;
      this.logger.info('Webhook manager initialized successfully', {
        port: this.webhookConfig.port,
        endpoints: Object.keys(this.webhookEndpoints).length,
        channels: Object.keys(this.notificationChannels).filter(c => this.notificationChannels[c].enabled).length
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize webhook manager', { error: error.message });
      throw error;
    }
  }

  async registerWebhook(url, events, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Webhook manager not initialized');
    }

    try {
      this.logger.info('Registering webhook', { url, events });

      const webhookId = this.generateWebhookId();
      const webhook = {
        id: webhookId,
        url: url,
        events: Array.isArray(events) ? events : [events],
        secret: options.secret || this.generateSecret(),
        active: options.active !== false,
        retry_attempts: options.retryAttempts || this.webhookConfig.retryAttempts,
        timeout: options.timeout || this.webhookConfig.timeout,
        filters: options.filters || {},
        headers: options.headers || {},
        created_at: Date.now(),
        last_triggered: null,
        success_count: 0,
        failure_count: 0
      };

      // Validate events
      for (const event of webhook.events) {
        if (!this.webhookEvents[event]) {
          throw new Error(`Unknown webhook event: ${event}`);
        }
      }

      // Store webhook
      this.registeredWebhooks.set(webhookId, webhook);

      // Create subscription
      for (const event of webhook.events) {
        if (!this.subscriptions.has(event)) {
          this.subscriptions.set(event, new Set());
        }
        this.subscriptions.get(event).add(webhookId);
      }

      this.logger.info('Webhook registered successfully', {
        webhook_id: webhookId,
        url: url,
        events: webhook.events
      });

      return {
        webhook_id: webhookId,
        secret: webhook.secret,
        events: webhook.events,
        active: webhook.active
      };

    } catch (error) {
      this.logger.error('Failed to register webhook', { url, error: error.message });
      throw error;
    }
  }

  async triggerEvent(eventType, eventData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Webhook manager not initialized');
    }

    try {
      this.logger.debug('Triggering webhook event', { event_type: eventType });

      // Validate event type
      if (!this.webhookEvents[eventType]) {
        throw new Error(`Unknown event type: ${eventType}`);
      }

      // Create event payload
      const event = {
        id: this.generateEventId(),
        event_type: eventType,
        timestamp: new Date().toISOString(),
        data: eventData,
        metadata: {
          source: 'ai-model-discovery',
          version: '1.0.0',
          ...options.metadata
        }
      };

      // Validate event data against schema
      if (options.validate !== false) {
        await this.validateEventData(event, eventType);
      }

      // Add to event queue for processing
      this.eventQueue.push({
        ...event,
        triggered_at: Date.now(),
        retries: 0
      });

      // Process event immediately if not async
      if (!options.async) {
        await this.processEventQueue();
      }

      this.logger.info('Webhook event triggered', {
        event_id: event.id,
        event_type: eventType,
        async: options.async || false
      });

      return event;

    } catch (error) {
      this.logger.error('Failed to trigger webhook event', { 
        event_type: eventType, 
        error: error.message 
      });
      throw error;
    }
  }

  async deliverWebhook(webhook, event, options = {}) {
    const startTime = Date.now();
    let deliveryResult = {
      webhook_id: webhook.id,
      event_id: event.id,
      url: webhook.url,
      success: false,
      status_code: null,
      response_time: 0,
      attempts: 0,
      error: null
    };

    try {
      this.logger.debug('Delivering webhook', {
        webhook_id: webhook.id,
        event_type: event.event_type,
        url: webhook.url
      });

      // Apply event filters
      if (!this.passesFilters(event, webhook.filters)) {
        this.logger.debug('Event filtered out for webhook', {
          webhook_id: webhook.id,
          event_id: event.id
        });
        return null;
      }

      // Prepare payload
      const payload = {
        ...event,
        webhook_id: webhook.id
      };

      // Generate signature
      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'ai-model-discovery-webhook/1.0.0',
        'X-Webhook-Event': event.event_type,
        'X-Webhook-Delivery': this.generateDeliveryId(),
        'X-Webhook-Signature': signature,
        ...webhook.headers
      };

      // Make HTTP request with retries
      for (let attempt = 1; attempt <= webhook.retry_attempts; attempt++) {
        deliveryResult.attempts = attempt;
        
        try {
          const response = await this.makeHttpRequest(webhook.url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            timeout: webhook.timeout
          });

          deliveryResult.status_code = response.status;
          deliveryResult.response_time = Date.now() - startTime;

          if (response.status >= 200 && response.status < 300) {
            deliveryResult.success = true;
            webhook.success_count++;
            webhook.last_triggered = Date.now();
            
            this.deliveryTracking.successful_deliveries++;
            this.deliveryTracking.last_delivery_time = Date.now();
            
            break;
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

        } catch (attemptError) {
          deliveryResult.error = attemptError.message;
          
          if (attempt < webhook.retry_attempts) {
            await this.sleep(this.webhookConfig.retryDelay * Math.pow(2, attempt - 1));
            this.deliveryTracking.retry_attempts++;
          }
        }
      }

      if (!deliveryResult.success) {
        webhook.failure_count++;
        this.deliveryTracking.failed_deliveries++;
      }

      // Update average delivery time
      if (deliveryResult.success) {
        const totalDeliveries = this.deliveryTracking.successful_deliveries;
        const currentAvg = this.deliveryTracking.average_delivery_time;
        this.deliveryTracking.average_delivery_time = 
          (currentAvg * (totalDeliveries - 1) + deliveryResult.response_time) / totalDeliveries;
      }

      this.logger.info('Webhook delivery completed', {
        webhook_id: webhook.id,
        success: deliveryResult.success,
        attempts: deliveryResult.attempts,
        response_time: deliveryResult.response_time
      });

      return deliveryResult;

    } catch (error) {
      deliveryResult.error = error.message;
      deliveryResult.response_time = Date.now() - startTime;
      
      this.logger.error('Webhook delivery failed', {
        webhook_id: webhook.id,
        event_id: event.id,
        error: error.message
      });

      return deliveryResult;
    }
  }

  // Event processors
  async processModelDiscoveryEvent(event) {
    this.logger.info('Processing model discovery event', {
      model_id: event.data.model?.id,
      model_name: event.data.model?.name
    });

    // Trigger notifications
    await this.sendNotifications('model_discovery', {
      title: 'New Model Discovered',
      message: `New model "${event.data.model?.name}" discovered from ${event.data.model?.provider}`,
      model: event.data.model,
      color: 'good'
    });

    // Update GitHub if enabled
    if (this.notificationChannels.github.enabled) {
      await this.createGitHubIssue({
        title: `New Model: ${event.data.model?.name}`,
        body: `A new model has been discovered and added to the catalog.\n\n**Details:**\n- Provider: ${event.data.model?.provider}\n- Type: ${event.data.model?.model_type}\n- Discovery Source: ${event.data.metadata?.discovery_source}`,
        labels: ['new-model', 'discovery', 'automated']
      });
    }
  }

  async processSyncLifecycleEvent(event) {
    this.logger.info('Processing sync lifecycle event', {
      sync_id: event.data.sync_id,
      status: event.data.status
    });

    const statusEmojis = {
      started: '🔄',
      completed: '✅',
      failed: '❌'
    };

    const statusColors = {
      started: 'warning',
      completed: 'good',
      failed: 'danger'
    };

    await this.sendNotifications('sync_lifecycle', {
      title: `Sync ${event.data.status.charAt(0).toUpperCase() + event.data.status.slice(1)}`,
      message: `${statusEmojis[event.data.status]} Synchronization ${event.data.status}`,
      sync_details: event.data,
      color: statusColors[event.data.status]
    });
  }

  async processPerformanceAlertEvent(event) {
    this.logger.warn('Processing performance alert event', {
      alert_id: event.data.alert_id,
      metric: event.data.metric_name,
      severity: event.data.severity
    });

    const severityEmojis = {
      low: '⚠️',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    await this.sendNotifications('performance_alert', {
      title: `Performance Alert - ${event.data.severity.toUpperCase()}`,
      message: `${severityEmojis[event.data.severity]} Performance regression detected in ${event.data.metric_name}`,
      alert_details: event.data,
      color: 'danger',
      urgent: event.data.severity === 'critical'
    });

    // Create GitHub issue for high/critical alerts
    if (['high', 'critical'].includes(event.data.severity)) {
      await this.createGitHubIssue({
        title: `Performance Regression: ${event.data.metric_name}`,
        body: `Performance regression detected with ${event.data.severity} severity.\n\n**Details:**\n- Metric: ${event.data.metric_name}\n- Current Value: ${event.data.current_value}\n- Threshold: ${event.data.threshold_value}\n- Affected Models: ${event.data.affected_models?.join(', ')}`,
        labels: ['performance', 'regression', event.data.severity, 'automated']
      });
    }
  }

  // Notification methods
  async sendNotifications(eventType, notificationData) {
    const enabledChannels = Object.keys(this.notificationChannels)
      .filter(channel => this.notificationChannels[channel].enabled);

    for (const channel of enabledChannels) {
      try {
        await this.notificationChannels[channel].processor(eventType, notificationData);
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification`, { error: error.message });
      }
    }
  }

  async sendSlackNotification(eventType, data) {
    const payload = {
      channel: this.notificationChannels.slack.channel,
      username: this.notificationChannels.slack.username,
      icon_emoji: ':robot_face:',
      text: data.title,
      attachments: [{
        color: data.color || 'good',
        title: data.title,
        text: data.message,
        timestamp: Math.floor(Date.now() / 1000),
        fields: this.createSlackFields(data)
      }]
    };

    return this.makeHttpRequest(this.notificationChannels.slack.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async sendDiscordNotification(eventType, data) {
    const payload = {
      username: this.notificationChannels.discord.username,
      embeds: [{
        title: data.title,
        description: data.message,
        color: this.getDiscordColor(data.color),
        timestamp: new Date().toISOString(),
        fields: this.createDiscordFields(data)
      }]
    };

    return this.makeHttpRequest(this.notificationChannels.discord.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async sendGitHubNotification(eventType, data) {
    // GitHub notifications are handled through issue creation and workflow triggers
    if (githubIntegration.isInitialized) {
      await githubIntegration.triggerWorkflow('notification-workflow', {
        event_type: eventType,
        notification_data: JSON.stringify(data)
      });
    }
  }

  // Webhook server
  async createWebhookServer() {
    const requestHandler = async (req, res) => {
      try {
        const endpoint = this.webhookEndpoints[req.url];
        
        if (!endpoint) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
          return;
        }

        if (req.method !== endpoint.method) {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // Handle GET requests (like health checks)
        if (req.method === 'GET') {
          const result = await endpoint.processor(req, res);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // Read request body
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        
        req.on('end', async () => {
          try {
            // Verify signature if required
            if (endpoint.secret && endpoint.secret_header) {
              const signature = req.headers[endpoint.secret_header];
              if (!this.verifySignature(body, signature, endpoint.secret)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid signature' }));
                return;
              }
            }

            // Process webhook
            const result = await endpoint.processor(body, req.headers);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            
          } catch (error) {
            this.logger.error('Webhook processing failed', { error: error.message });
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });

      } catch (error) {
        this.logger.error('Webhook request failed', { error: error.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    };

    // Create server
    if (this.webhookConfig.enableHttps) {
      const options = {
        cert: await fs.readFile(this.webhookConfig.sslCertPath),
        key: await fs.readFile(this.webhookConfig.sslKeyPath)
      };
      this.webhookServer = https.createServer(options, requestHandler);
    } else {
      this.webhookServer = http.createServer(requestHandler);
    }

    // Start server
    return new Promise((resolve, reject) => {
      this.webhookServer.listen(this.webhookConfig.port, this.webhookConfig.host, (error) => {
        if (error) {
          reject(error);
        } else {
          this.logger.info('Webhook server started', {
            port: this.webhookConfig.port,
            host: this.webhookConfig.host,
            https: this.webhookConfig.enableHttps
          });
          resolve();
        }
      });
    });
  }

  // Event queue processing
  startEventQueueProcessor() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.processEventQueue();
      }
    }, 1000); // Process every second
  }

  async processEventQueue() {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      
      try {
        await this.processEvent(event);
      } catch (error) {
        this.logger.error('Event processing failed', {
          event_id: event.id,
          error: error.message
        });
        
        // Retry if attempts remaining
        if (event.retries < this.webhookConfig.retryAttempts) {
          event.retries++;
          this.eventQueue.push(event);
        }
      }
    }
  }

  async processEvent(event) {
    // Get subscribers for this event type
    const subscribers = this.subscriptions.get(event.event_type) || new Set();
    
    if (subscribers.size === 0) {
      this.logger.debug('No subscribers for event', { event_type: event.event_type });
      return;
    }

    // Process event with registered handler
    const eventHandler = this.webhookEvents[event.event_type];
    if (eventHandler && eventHandler.processor) {
      await eventHandler.processor(event);
    }

    // Deliver to all subscribers
    const deliveryPromises = Array.from(subscribers).map(async (webhookId) => {
      const webhook = this.registeredWebhooks.get(webhookId);
      if (webhook && webhook.active) {
        return this.deliverWebhook(webhook, event);
      }
    });

    await Promise.allSettled(deliveryPromises);
  }

  // Utility methods
  generateWebhookId() {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateDeliveryId() {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateSignature(payload, secret) {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async makeHttpRequest(url, options) {
    // Simplified HTTP request implementation
    // In production, use a proper HTTP client like axios
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const req = httpModule.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 30000
      }, (res) => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Placeholder methods for complex operations
  async validateConfiguration() { /* Implementation details */ }
  async loadSubscriptions() { /* Implementation details */ }
  async setupDefaultEventHandlers() { /* Implementation details */ }
  async validateEventData(event, eventType) { /* Implementation details */ }
  passesFilters(event, filters) { return true; }
  createSlackFields(data) { return []; }
  createDiscordFields(data) { return []; }
  getDiscordColor(color) { return 0x00ff00; }
  async createGitHubIssue(issueData) { /* Implementation details */ }
  async processGitHubWebhook(body, headers) { return { status: 'processed' }; }
  async processSupabaseWebhook(body, headers) { return { status: 'processed' }; }
  async processGenericWebhook(body, headers) { return { status: 'processed' }; }
  async processHealthCheck(req, res) { 
    return { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      webhooks: this.registeredWebhooks.size,
      events_processed: this.deliveryTracking.successful_deliveries
    }; 
  }
  async sendEmailNotification(eventType, data) { /* Implementation details */ }
  async sendTeamsNotification(eventType, data) { /* Implementation details */ }

  getStats() {
    return {
      initialized: this.isInitialized,
      server_running: this.webhookServer ? true : false,
      registered_webhooks: this.registeredWebhooks.size,
      active_subscriptions: this.subscriptions.size,
      supported_events: Object.keys(this.webhookEvents).length,
      notification_channels: Object.keys(this.notificationChannels).filter(c => this.notificationChannels[c].enabled).length,
      delivery_tracking: this.deliveryTracking,
      event_queue_size: this.eventQueue.length
    };
  }

  async cleanup() {
    if (this.webhookServer) {
      this.webhookServer.close();
      this.webhookServer = null;
    }
    
    this.registeredWebhooks.clear();
    this.subscriptions.clear();
    this.eventQueue.length = 0;
    this.processingQueue = false;
    this.isInitialized = false;
    
    this.logger.info('Webhook manager cleaned up');
  }
}

export const webhookManager = new WebhookManager();