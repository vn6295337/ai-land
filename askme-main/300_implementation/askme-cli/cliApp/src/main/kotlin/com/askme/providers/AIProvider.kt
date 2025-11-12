package com.askme.providers

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*
import kotlinx.serialization.Serializable

// Backend response format (matches our working backend)
@Serializable
data class BackendResponse(
    val response: String,
    val provider: String,
    val model: String? = null,
    val timestamp: String? = null
)

@Serializable
data class BackendRequest(
    val prompt: String,
    val provider: String,
    val model: String? = null
)

@Serializable 
data class BackendError(
    val error: String
)

// Provider interface
interface AIProvider {
    suspend fun chat(prompt: String, model: String? = null): String
    fun getProviderName(): String
    fun getAvailableModels(): List<String>
    fun selectBestModel(prompt: String): String
}

// Base provider with common backend functionality
abstract class BaseProvider : AIProvider {
    
    companion object {
        const val BACKEND_URL = "https://askme-backend-proxy.onrender.com/api/query"
        
        val httpClient = HttpClient(CIO) {
            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    coerceInputValues = true
		    isLenient = true
		    encodeDefaults = true
                })
            }
        }
    }
    
    protected suspend fun callBackend(prompt: String, providerName: String, model: String? = null): String {
        return try {
            val request = BackendRequest(
                prompt = prompt,
                provider = providerName,
                model = model
            )
            
            val response: HttpResponse = httpClient.post(BACKEND_URL) {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            
            when (response.status) {
                HttpStatusCode.OK -> {
                    val backendResponse = response.body<BackendResponse>()
                    "💬 ${backendResponse.response}"
                }
                else -> {
                    try {
                        val errorResponse = response.body<BackendError>()
                        "❌ ${errorResponse.error}"
                    } catch (e: Exception) {
                        "❌ HTTP ${response.status.value}: ${response.status.description}"
                    }
                }
            }
        } catch (e: Exception) {
            "❌ Connection error: ${e.message}"
        }
    }
    
    // Helper function to analyze prompt and suggest model
    protected fun analyzePrompt(prompt: String): PromptAnalysis {
        val promptLower = prompt.lowercase()
        
        return PromptAnalysis(
            isCodeRelated = promptLower.contains(Regex("\\b(code|programming|function|class|variable|debug|syntax|algorithm)\\b")),
            isCreative = promptLower.contains(Regex("\\b(story|creative|poem|write|imagine|fiction|narrative)\\b")),
            isAnalytical = promptLower.contains(Regex("\\b(analyze|analysis|research|data|statistics|compare|evaluate)\\b")),
            isMath = promptLower.contains(Regex("\\b(calculate|math|equation|formula|solve|number)\\b")),
            isLongForm = prompt.length > 200 || promptLower.contains(Regex("\\b(explain|detailed|comprehensive|essay)\\b")),
            isConversational = promptLower.contains(Regex("\\b(chat|talk|conversation|discuss|hello|hi|how are you|what's up)\\b")),
            complexity = when {
                prompt.length > 500 -> PromptComplexity.HIGH
                prompt.length > 100 -> PromptComplexity.MEDIUM
                else -> PromptComplexity.LOW
            }
        )
    }
}

data class PromptAnalysis(
    val isCodeRelated: Boolean,
    val isCreative: Boolean,
    val isAnalytical: Boolean,
    val isMath: Boolean,
    val isLongForm: Boolean,
    val isConversational: Boolean,
    val complexity: PromptComplexity
)

enum class PromptComplexity {
    LOW, MEDIUM, HIGH
}

// Provider performance tracking
data class ProviderStats(
    val name: String,
    val successCount: Int = 0,
    val failureCount: Int = 0,
    val totalResponseTime: Long = 0L,
    val lastSuccess: Long = 0L,
    val lastFailure: Long = 0L
) {
    val successRate: Double get() = if (totalRequests > 0) successCount.toDouble() / totalRequests else 0.0
    val totalRequests: Int get() = successCount + failureCount
    val averageResponseTime: Long get() = if (successCount > 0) totalResponseTime / successCount else 0L
    val score: Double get() = successRate * 100 + (if (averageResponseTime > 0) (1000.0 / averageResponseTime) else 0.0)
}
