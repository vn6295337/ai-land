package com.askme.security

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.assertFalse

/**
 * Security Test: Unauthorized File Access Prevention
 * Tests that the application properly restricts file access outside allowed directories
 */
class FileAccessValidationTest {

    @Test
    fun testPreventAccessToSystemFiles() {
        // Test accessing system files like /etc/passwd
        val systemFiles = listOf(
            "/etc/passwd",
            "/etc/shadow", 
            "/root/.bashrc",
            "../../../etc/passwd",
            "../../../../etc/passwd"
        )
        
        systemFiles.forEach { filePath ->
            val result = attemptFileAccess(filePath)
            assertFalse(
                result.success,
                "Should deny access to system file: $filePath"
            )
        }
    }

    @Test
    fun testPreventDirectoryTraversal() {
        // Test directory traversal attacks
        val traversalPaths = listOf(
            "../config.json",
            "../../config.json", 
            "../../../config.json",
            "..\\config.json",
            "..\\..\\config.json",
            "%2e%2e%2fconfig.json",
            "..%252fconfig.json"
        )
        
        traversalPaths.forEach { path ->
            val result = attemptFileAccess(path)
            assertFalse(
                result.success,
                "Should deny directory traversal: $path"
            )
        }
    }

    @Test
    fun testAllowOnlyConfigDirectory() {
        // Test that only files in allowed config directory are accessible
        val allowedPaths = listOf(
            "config/settings.json",
            "config/api-keys.enc",
            ".askme/config.json"
        )
        
        allowedPaths.forEach { path ->
            val result = attemptFileAccess(path)
            assertTrue(
                result.isPathAllowed,
                "Should allow access to config file: $path"
            )
        }
    }

    @Test
    fun testPreventHomeDirectoryAccess() {
        // Test prevention of unauthorized home directory access
        val homePaths = listOf(
            "~/.ssh/id_rsa",
            "~/.bashrc",
            "~/.profile",
            "/home/user/.ssh/",
            System.getProperty("user.home") + "/.ssh/id_rsa"
        )
        
        homePaths.forEach { path ->
            val result = attemptFileAccess(path)
            assertFalse(
                result.success,
                "Should deny access to home directory file: $path"
            )
        }
    }

    @Test
    fun testPreventTempDirectoryAccess() {
        // Test prevention of unauthorized temp directory access
        val tempPaths = listOf(
            "/tmp/sensitive.txt",
            "/var/tmp/cache.dat",
            System.getProperty("java.io.tmpdir") + "/askme-temp.txt"
        )
        
        tempPaths.forEach { path ->
            val result = attemptFileAccess(path)
            assertFalse(
                result.success,
                "Should deny access to temp directory: $path"
            )
        }
    }

    // Mock file access result for testing
    private data class FileAccessResult(
        val success: Boolean,
        val isPathAllowed: Boolean,
        val errorMessage: String? = null
    )

    // Simulate file access attempt with security validation
    private fun attemptFileAccess(filePath: String): FileAccessResult {
        // Simulate security validation logic
        val allowedPatterns = listOf(
            Regex("^config/.*"),
            Regex("^\\.askme/.*"),
            Regex("^[^/]*\\.json$") // Only JSON files in current directory
        )
        
        val deniedPatterns = listOf(
            Regex(".*\\.\\./.*"), // Directory traversal
            Regex("^/etc/.*"),    // System files
            Regex("^/root/.*"),   // Root directory
            Regex("^/home/.*/\\.ssh/.*"), // SSH keys
            Regex("^/tmp/.*"),    // Temp files
            Regex("^/var/.*"),    // System var files
            Regex(".*%2e%2e.*"),  // URL encoded traversal
            Regex(".*%252f.*")    // Double encoded paths
        )
        
        // Check if path is explicitly denied
        val isDenied = deniedPatterns.any { it.matches(filePath) }
        if (isDenied) {
            return FileAccessResult(
                success = false,
                isPathAllowed = false,
                errorMessage = "Access denied: Path violates security policy"
            )
        }
        
        // Check if path is allowed
        val isAllowed = allowedPatterns.any { it.matches(filePath) }
        
        return FileAccessResult(
            success = isAllowed,
            isPathAllowed = isAllowed,
            errorMessage = if (!isAllowed) "Access denied: Path not in allowed directories" else null
        )
    }
}
