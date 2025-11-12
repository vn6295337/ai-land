package com.askme.security

import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.assertFalse

/**
 * Security Test: SQL Injection Prevention
 * Tests input sanitization and validation to prevent SQL injection attacks
 */
class InputValidationTest {

    @Test
    fun testBasicSqlInjectionPrevention() {
        // Test basic SQL injection patterns
        val maliciousInputs = listOf(
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "' OR 1=1 --",
            "admin'--",
            "admin'/*",
            "' UNION SELECT * FROM users --",
            "1' AND '1'='1",
            "1' OR '1'='1' --"
        )
        
        maliciousInputs.forEach { input ->
            val result = validateInput(input)
            assertFalse(
                result.isValid,
                "Should detect SQL injection attempt: $input"
            )
            assertTrue(
                result.errorMessage?.contains("injection") == true,
                "Should specify injection prevention for: $input"
            )
        }
    }

    @Test
    fun testAdvancedSqlInjectionPrevention() {
        // Test advanced SQL injection techniques
        val advancedInjections = listOf(
            "1'; EXEC xp_cmdshell('dir'); --",
            "'; WAITFOR DELAY '00:00:10'; --",
            "1' AND (SELECT COUNT(*) FROM sysobjects) > 0 --",
            "' UNION ALL SELECT NULL,NULL,NULL,version() --",
            "1' AND SUBSTRING(@@version,1,1) = '5' --",
            "'; INSERT INTO users VALUES ('hacker','password'); --",
            "1' AND ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)) > 65 --"
        )
        
        advancedInjections.forEach { input ->
            val result = validateInput(input)
            assertFalse(
                result.isValid,
                "Should detect advanced SQL injection: $input"
            )
        }
    }

    @Test
    fun testBlindSqlInjectionPrevention() {
        // Test blind SQL injection patterns
        val blindInjections = listOf(
            "1' AND (SELECT COUNT(*) FROM users) > 0 --",
            "1' AND (SELECT LENGTH(password) FROM users WHERE id=1) = 8 --",
            "1' AND (SELECT ASCII(SUBSTRING(password,1,1)) FROM users WHERE id=1) = 97 --",
            "'; IF (1=1) WAITFOR DELAY '00:00:05' --",
            "1' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --"
        )
        
        blindInjections.forEach { input ->
            val result = validateInput(input)
            assertFalse(
                result.isValid,
                "Should detect blind SQL injection: $input"
            )
        }
    }

    @Test
    fun testTimingBasedSqlInjectionPrevention() {
        // Test timing-based SQL injection
        val timingInjections = listOf(
            "'; WAITFOR DELAY '00:00:05' --",
            "'; SELECT SLEEP(5) --",
            "1' AND (SELECT SLEEP(5)) --",
            "'; BENCHMARK(5000000,MD5(1)) --",
            "1' AND (SELECT * FROM (SELECT SLEEP(5))a) --"
        )
        
        timingInjections.forEach { input ->
            val result = validateInput(input)
            assertFalse(
                result.isValid,
                "Should detect timing-based SQL injection: $input"
            )
        }
    }

    @Test
    fun testUrlEncodedSqlInjectionPrevention() {
        // Test URL-encoded SQL injection attempts
        val encodedInjections = listOf(
            "%27%3B%20DROP%20TABLE%20users%3B%20--", // '; DROP TABLE users; --
            "%27%20OR%20%271%27%3D%271", // ' OR '1'='1
            "%27%20UNION%20SELECT%20*%20FROM%20users%20--", // ' UNION SELECT * FROM users --
            "%27%29%3B%20DELETE%20FROM%20users%3B%20--" // '); DELETE FROM users; --
        )
        
        encodedInjections.forEach { input ->
            val result = validateInput(input)
            assertFalse(
                result.isValid,
                "Should detect URL-encoded SQL injection: $input"
            )
        }
    }

    @Test
    fun testNoSqlInjectionPrevention() {
        // Test NoSQL injection patterns (for future database compatibility)
        val noSqlInjections = listOf(
            "'; db.users.drop(); //",
            "'; return true; //",
            "'; this.password != null; //",
            "admin'; return true; var x='",
            "'; db.users.find(); //"
        )
        
        noSqlInjections.forEach { input ->
            val result = validateInput(input)
            assertFalse(
                result.isValid,
                "Should detect NoSQL injection: $input"
            )
        }
    }

    @Test
    fun testValidInputsAllowed() {
        // Test that legitimate inputs are allowed
        val validInputs = listOf(
            "user@example.com",
            "normal_username",
            "password123",
            "What is the capital of France?",
            "How do I configure API keys?",
            "Tell me about machine learning",
            "12345",
            "valid-config-name"
        )
        
        validInputs.forEach { input ->
            val result = validateInput(input)
            assertTrue(
                result.isValid,
                "Should allow valid input: $input"
            )
        }
    }

    @Test
    fun testSpecialCharacterHandling() {
        // Test proper handling of special characters in legitimate use
        val specialCharInputs = listOf(
            "What's the weather like?", // Apostrophe in question
            "How do you say \"hello\" in French?", // Quotes in question
            "Calculate 2+2=4", // Equals sign
            "List items: item1, item2, item3", // Colons and commas
            "Use the command: ls -la" // Hyphens and spaces
        )
        
        specialCharInputs.forEach { input ->
            val result = validateInput(input)
            assertTrue(
                result.isValid,
                "Should allow special characters in legitimate context: $input"
            )
        }
    }

    // Mock data class for validation results
    private data class ValidationResult(
        val isValid: Boolean,
        val sanitizedInput: String? = null,
        val errorMessage: String? = null,
        val detectedThreats: List<String> = emptyList()
    )

    // Mock input validation function
    private fun validateInput(input: String): ValidationResult {
        // SQL injection pattern detection
        val sqlPatterns = listOf(
            Regex("(?i).*('|(\\-\\-)|(;)|(\\||\\|)|(\\*|\\*)).*"), // Basic SQL chars
            Regex("(?i).*(union|select|insert|delete|update|drop|create|alter|exec|execute).*"), // SQL keywords
            Regex("(?i).*(script|javascript|vbscript|onload|onerror).*"), // Script injection
            Regex("(?i).*(waitfor|delay|sleep|benchmark).*"), // Timing attacks
            Regex("(?i).*(sysobjects|information_schema|mysql|oracle|postgres).*"), // DB-specific
            Regex("(?i).*(xp_cmdshell|sp_executesql|openrowset).*"), // System procedures
            Regex(".*(%27|%3B|%2D%2D|%7C|%2A).*"), // URL encoded SQL chars
            Regex("(?i).*(db\\.|this\\.|return|function\\().*") // NoSQL patterns
        )
        
        val detectedThreats = mutableListOf<String>()
        
        // Check for SQL injection patterns
        sqlPatterns.forEachIndexed { index, pattern ->
            if (pattern.matches(input)) {
                detectedThreats.add(when (index) {
                    0 -> "SQL special characters"
                    1 -> "SQL keywords"
                    2 -> "Script injection"
                    3 -> "Timing attack"
                    4 -> "Database-specific keywords"
                    5 -> "System procedures"
                    6 -> "URL-encoded SQL"
                    7 -> "NoSQL injection"
                    else -> "Unknown threat"
                })
            }
        }
        
        return if (detectedThreats.isNotEmpty()) {
            ValidationResult(
                isValid = false,
                errorMessage = "Input rejected: Potential injection attack detected",
                detectedThreats = detectedThreats
            )
        } else {
            // Additional validation for legitimate inputs
            val sanitized = input.trim()
            ValidationResult(
                isValid = sanitized.isNotEmpty() && sanitized.length <= 1000, // Basic length check
                sanitizedInput = sanitized
            )
        }
    }
}
