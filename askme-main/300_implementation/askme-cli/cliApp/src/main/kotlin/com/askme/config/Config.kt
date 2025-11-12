package com.askme.config

import io.github.cdimascio.dotenv.Dotenv
import io.github.cdimascio.dotenv.dotenv
import mu.KotlinLogging
import java.io.File

private val logger = KotlinLogging.logger {}

/**
 * Application configuration loaded from .env.local or environment variables
 * Shared configuration structure with ai-models-discoverer
 */
object Config {
    private val dotenv: Dotenv by lazy {
        try {
            dotenv {
                directory = findConfigDirectory()
                filename = ".env.local"
                ignoreIfMalformed = true
                ignoreIfMissing = true
            }
        } catch (e: Exception) {
            logger.warn { "Could not load .env.local, using environment variables only: ${e.message}" }
            dotenv {
                ignoreIfMalformed = true
                ignoreIfMissing = true
            }
        }
    }

    // Supabase Configuration (shared with discoverer)
    val supabaseUrl: String by lazy {
        getEnvOrThrow("SUPABASE_URL", "Supabase URL not configured")
    }

    val supabaseKey: String by lazy {
        getEnvOrThrow("SUPABASE_KEY", "Supabase key not configured")
    }

    // Provider API Keys (3 free-tier providers)
    val googleApiKey: String? by lazy {
        getEnvOrNull("GOOGLE_API_KEY")
    }

    val groqApiKey: String? by lazy {
        getEnvOrNull("GROQ_API_KEY")
    }

    val openRouterApiKey: String? by lazy {
        getEnvOrNull("OPENROUTER_API_KEY")
    }

    // Cache Settings
    val cacheDurationHours: Int by lazy {
        getEnvOrNull("CACHE_DURATION_HOURS")?.toIntOrNull() ?: 24
    }

    val cacheDir: String by lazy {
        getEnvOrNull("CACHE_DIR") ?: ".askme_cache"
    }

    // Logging
    val logLevel: String by lazy {
        getEnvOrNull("LOG_LEVEL") ?: "INFO"
    }

    /**
     * Check if at least one provider API key is configured
     */
    fun hasValidProviderKey(): Boolean {
        return googleApiKey != null || groqApiKey != null || openRouterApiKey != null
    }

    /**
     * Get list of available providers based on configured keys
     */
    fun getAvailableProviders(): List<String> {
        return buildList {
            if (googleApiKey != null) add("google")
            if (groqApiKey != null) add("groq")
            if (openRouterApiKey != null) add("openrouter")
        }
    }

    private fun getEnvOrThrow(key: String, errorMessage: String): String {
        return getEnvOrNull(key) ?: throw ConfigurationException(errorMessage)
    }

    private fun getEnvOrNull(key: String): String? {
        // Try dotenv first, then system environment
        return dotenv[key] ?: System.getenv(key)
    }

    private fun findConfigDirectory(): String {
        // Look for .env.local in current directory, then parent directories
        var dir = File(System.getProperty("user.dir"))
        repeat(3) {
            if (File(dir, ".env.local").exists()) {
                logger.info { "Found .env.local in: ${dir.absolutePath}" }
                return dir.absolutePath
            }
            dir = dir.parentFile ?: return System.getProperty("user.dir")
        }
        return System.getProperty("user.dir")
    }
}

class ConfigurationException(message: String) : Exception(message)
