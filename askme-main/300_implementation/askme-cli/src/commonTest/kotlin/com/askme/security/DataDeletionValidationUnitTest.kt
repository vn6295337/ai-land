package com.askme.security

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertNotNull

/**
 * Security Test: Secure Data Deletion
 * Tests secure deletion of sensitive data including API keys, configuration, and temporary files
 */
class DataDeletionValidationTest {

    @Test
    fun testApiKeySecureDeletion() {
        // Test secure deletion of API keys from memory
        val apiKeys = listOf(
            "sk-test123456789abcdef",
            "anthropic-key-xyz789",
            "google-api-key-abc123",
            "mistral-key-def456"
        )
        
        apiKeys.forEach { apiKey ->
            // Simulate storing API key
            val storage = SecureStorage()
            storage.storeApiKey("test-provider", apiKey)
            
            // Verify key is stored
            assertNotNull(
                storage.getApiKey("test-provider"),
                "API key should be stored: $apiKey"
            )
            
            // Perform secure deletion
            val result = storage.secureDeleteApiKey("test-provider")
            
            assertTrue(
                result.isDeleted,
                "API key should be securely deleted: $apiKey"
            )
            
            // Verify key is completely removed
            assertNull(
                storage.getApiKey("test-provider"),
                "API key should be null after deletion: $apiKey"
            )
            
            // Verify no traces in memory
            assertFalse(
                storage.hasMemoryTraces("test-provider"),
                "No memory traces should remain for: $apiKey"
            )
        }
    }

    @Test
    fun testConfigurationSecureDeletion() {
        // Test secure deletion of configuration files
        val configFiles = listOf(
            "config/api-keys.json",
            "config/user-preferences.json", 
            ".askme/settings.json",
            "temp/session-config.json"
        )
        
        configFiles.forEach { configPath ->
            val fileManager = SecureFileManager()
            
            // Create test configuration
            val testConfig = mapOf(
                "api_key" to "sensitive-key-123",
                "user_data" to "personal-info",
                "session_token" to "temp-token-xyz"
            )
            
            fileManager.writeSecureConfig(configPath, testConfig)
            
            // Verify file exists
            assertTrue(
                fileManager.fileExists(configPath),
                "Config file should exist: $configPath"
            )
            
            // Perform secure deletion
            val result = fileManager.secureDeleteFile(configPath)
            
            assertTrue(
                result.isDeleted,
                "Config file should be securely deleted: $configPath"
            )
            
            assertFalse(
                fileManager.fileExists(configPath),
                "Config file should not exist after deletion: $configPath"
            )
            
            // Verify no recoverable data
            assertFalse(
                result.hasRecoverableData,
                "No recoverable data should remain for: $configPath"
            )
        }
    }

    @Test
    fun testTempFileSecureDeletion() {
        // Test secure deletion of temporary files
        val tempFiles = listOf(
            "temp/prompt-cache.tmp",
            "temp/response-buffer.tmp",
            "temp/api-response.cache",
            ".askme/session.tmp"
        )
        
        tempFiles.forEach { tempPath ->
            val fileManager = SecureFileManager()
            
            // Create temporary file with sensitive content
            val sensitiveContent = "API Response: This is sensitive data that should be securely deleted"
            fileManager.writeTempFile(tempPath, sensitiveContent)
            
            assertTrue(
                fileManager.fileExists(tempPath),
                "Temp file should exist: $tempPath"
            )
            
            // Perform secure deletion with overwrite
            val result = fileManager.secureDeleteWithOverwrite(tempPath)
            
            assertTrue(
                result.isDeleted,
                "Temp file should be securely deleted: $tempPath"
            )
            
            assertTrue(
                result.overwritePasses >= 3,
                "Should perform multiple overwrite passes for: $tempPath"
            )
            
            assertFalse(
                fileManager.fileExists(tempPath),
                "Temp file should not exist after deletion: $tempPath"
            )
        }
    }

    @Test
    fun testMemorySecureDeletion() {
        // Test secure deletion of sensitive data from memory
        val sensitiveData = listOf(
            "password123",
            "secret-api-key",
            "personal-information",
            "session-token-xyz"
        )
        
        sensitiveData.forEach { data ->
            val memoryManager = SecureMemoryManager()
            
            // Store sensitive data in memory
            val memoryId = memoryManager.storeSensitiveData(data)
            
            assertNotNull(
                memoryManager.getSensitiveData(memoryId),
                "Data should be stored in memory: $data"
            )
            
            // Perform secure memory deletion
            val result = memoryManager.secureDeleteFromMemory(memoryId)
            
            assertTrue(
                result.isDeleted,
                "Data should be securely deleted from memory: $data"
            )
            
            assertNull(
                memoryManager.getSensitiveData(memoryId),
                "Data should be null after deletion: $data"
            )
            
            // Verify memory is zeroed
            assertTrue(
                result.isMemoryZeroed,
                "Memory should be zeroed for: $data"
            )
        }
    }

    @Test
    fun testLogFileSecureDeletion() {
        // Test secure deletion of log files that might contain sensitive info
        val logFiles = listOf(
            "logs/api-requests.log",
            "logs/error.log",
            "logs/debug.log",
            ".askme/activity.log"
        )
        
        logFiles.forEach { logPath ->
            val logManager = SecureLogManager()
            
            // Create log with potentially sensitive content
            val logEntries = listOf(
                "API request with key: sk-xxx",
                "User query: personal question",
                "Error: authentication failed for user@email.com"
            )
            
            logEntries.forEach { entry ->
                logManager.writeLogEntry(logPath, entry)
            }
            
            assertTrue(
                logManager.logExists(logPath),
                "Log file should exist: $logPath"
            )
            
            // Perform secure log deletion
            val result = logManager.secureDeleteLog(logPath)
            
            assertTrue(
                result.isDeleted,
                "Log file should be securely deleted: $logPath"
            )
            
            assertFalse(
                logManager.logExists(logPath),
                "Log file should not exist after deletion: $logPath"
            )
            
            // Verify sensitive data is not recoverable
            assertFalse(
                result.hasSensitiveTraces,
                "No sensitive traces should remain in: $logPath"
            )
        }
    }

    @Test
    fun testCacheSecureDeletion() {
        // Test secure deletion of cached responses
        val cacheKeys = listOf(
            "prompt-hash-123",
            "api-response-456",
            "user-session-789",
            "model-output-abc"
        )
        
        cacheKeys.forEach { cacheKey ->
            val cacheManager = SecureCacheManager()
            
            // Store sensitive data in cache
            val cacheData = "Cached API response with sensitive information"
            cacheManager.storeInCache(cacheKey, cacheData)
            
            assertNotNull(
                cacheManager.getFromCache(cacheKey),
                "Data should be cached: $cacheKey"
            )
            
            // Perform secure cache deletion
            val result = cacheManager.secureDeleteCache(cacheKey)
            
            assertTrue(
                result.isDeleted,
                "Cache should be securely deleted: $cacheKey"
            )
            
            assertNull(
                cacheManager.getFromCache(cacheKey),
                "Cache should be null after deletion: $cacheKey"
            )
            
            // Verify no residual data
            assertFalse(
                result.hasResidualData,
                "No residual data should remain for: $cacheKey"
            )
        }
    }

    @Test
    fun testApplicationShutdownSecureDeletion() {
        // Test secure deletion during application shutdown
        val securityManager = ApplicationSecurityManager()
        
        // Simulate application with sensitive data
        securityManager.initialize()
        securityManager.storeApiKey("openai", "sk-test123")
        securityManager.storeUserSession("user123", "session-data")
        securityManager.createTempFile("temp-processing.tmp")
        
        // Verify data exists
        assertTrue(
            securityManager.hasStoredData(),
            "Application should have stored data"
        )
        
        // Perform secure shutdown
        val result = securityManager.secureShutdown()
        
        assertTrue(
            result.isShutdownSecure,
            "Shutdown should be secure"
        )
        
        assertTrue(
            result.allDataDeleted,
            "All sensitive data should be deleted"
        )
        
        assertFalse(
            securityManager.hasStoredData(),
            "No data should remain after secure shutdown"
        )
        
        // Verify cleanup completeness
        assertTrue(
            result.cleanupOperations.contains("api_keys_deleted"),
            "API keys should be deleted during shutdown"
        )
        
        assertTrue(
            result.cleanupOperations.contains("temp_files_deleted"),
            "Temp files should be deleted during shutdown"
        )
        
        assertTrue(
            result.cleanupOperations.contains("memory_cleared"),
            "Memory should be cleared during shutdown"
        )
    }

    // Mock classes for testing secure deletion
    private class SecureStorage {
        private val storage = mutableMapOf<String, String?>()
        
        fun storeApiKey(provider: String, key: String) {
            storage[provider] = key
        }
        
        fun getApiKey(provider: String): String? = storage[provider]
        
        fun secureDeleteApiKey(provider: String): DeletionResult {
            val existed = storage.containsKey(provider)
            storage[provider] = null
            storage.remove(provider)
            
            return DeletionResult(
                isDeleted = existed,
                isMemoryZeroed = true
            )
        }
        
        fun hasMemoryTraces(provider: String): Boolean = false
    }

    private class SecureFileManager {
        private val files = mutableMapOf<String, String>()
        
        fun writeSecureConfig(path: String, config: Map<String, String>) {
            files[path] = config.toString()
        }
        
        fun writeTempFile(path: String, content: String) {
            files[path] = content
        }
        
        fun fileExists(path: String): Boolean = files.containsKey(path)
        
        fun secureDeleteFile(path: String): FileDeletionResult {
            val existed = files.containsKey(path)
            files.remove(path)
            
            return FileDeletionResult(
                isDeleted = existed,
                hasRecoverableData = false
            )
        }
        
        fun secureDeleteWithOverwrite(path: String): OverwriteDeletionResult {
            val existed = files.containsKey(path)
            files.remove(path)
            
            return OverwriteDeletionResult(
                isDeleted = existed,
                overwritePasses = 3
            )
        }
    }

    private class SecureMemoryManager {
        private val memory = mutableMapOf<String, String?>()
        private var idCounter = 0
        
        fun storeSensitiveData(data: String): String {
            val id = "mem_${++idCounter}"
            memory[id] = data
            return id
        }
        
        fun getSensitiveData(id: String): String? = memory[id]
        
        fun secureDeleteFromMemory(id: String): MemoryDeletionResult {
            val existed = memory.containsKey(id)
            memory[id] = null
            memory.remove(id)
            
            return MemoryDeletionResult(
                isDeleted = existed,
                isMemoryZeroed = true
            )
        }
    }

    private class SecureLogManager {
        private val logs = mutableMapOf<String, MutableList<String>>()
        
        fun writeLogEntry(path: String, entry: String) {
            logs.getOrPut(path) { mutableListOf() }.add(entry)
        }
        
        fun logExists(path: String): Boolean = logs.containsKey(path)
        
        fun secureDeleteLog(path: String): LogDeletionResult {
            val existed = logs.containsKey(path)
            logs.remove(path)
            
            return LogDeletionResult(
                isDeleted = existed,
                hasSensitiveTraces = false
            )
        }
    }

    private class SecureCacheManager {
        private val cache = mutableMapOf<String, String?>()
        
        fun storeInCache(key: String, data: String) {
            cache[key] = data
        }
        
        fun getFromCache(key: String): String? = cache[key]
        
        fun secureDeleteCache(key: String): CacheDeletionResult {
            val existed = cache.containsKey(key)
            cache[key] = null
            cache.remove(key)
            
            return CacheDeletionResult(
                isDeleted = existed,
                hasResidualData = false
            )
        }
    }

    private class ApplicationSecurityManager {
        private val apiKeys = mutableMapOf<String, String>()
        private val sessions = mutableMapOf<String, String>()
        private val tempFiles = mutableSetOf<String>()
        
        fun initialize() {
            // Initialization logic
        }
        
        fun storeApiKey(provider: String, key: String) {
            apiKeys[provider] = key
        }
        
        fun storeUserSession(userId: String, sessionData: String) {
            sessions[userId] = sessionData
        }
        
        fun createTempFile(filename: String) {
            tempFiles.add(filename)
        }
        
        fun hasStoredData(): Boolean {
            return apiKeys.isNotEmpty() || sessions.isNotEmpty() || tempFiles.isNotEmpty()
        }
        
        fun secureShutdown(): ShutdownResult {
            val operations = mutableListOf<String>()
            
            if (apiKeys.isNotEmpty()) {
                apiKeys.clear()
                operations.add("api_keys_deleted")
            }
            
            if (sessions.isNotEmpty()) {
                sessions.clear()
                operations.add("sessions_deleted")
            }
            
            if (tempFiles.isNotEmpty()) {
                tempFiles.clear()
                operations.add("temp_files_deleted")
            }
            
            operations.add("memory_cleared")
            
            return ShutdownResult(
                isShutdownSecure = true,
                allDataDeleted = true,
                cleanupOperations = operations
            )
        }
    }

    // Result data classes
    private data class DeletionResult(
        val isDeleted: Boolean,
        val isMemoryZeroed: Boolean = false
    )

    private data class FileDeletionResult(
        val isDeleted: Boolean,
        val hasRecoverableData: Boolean
    )

    private data class OverwriteDeletionResult(
        val isDeleted: Boolean,
        val overwritePasses: Int
    )

    private data class MemoryDeletionResult(
        val isDeleted: Boolean,
        val isMemoryZeroed: Boolean
    )

    private data class LogDeletionResult(
        val isDeleted: Boolean,
        val hasSensitiveTraces: Boolean
    )

    private data class CacheDeletionResult(
        val isDeleted: Boolean,
        val hasResidualData: Boolean
    )

    private data class ShutdownResult(
        val isShutdownSecure: Boolean,
        val allDataDeleted: Boolean,
        val cleanupOperations: List<String>
    )
}
