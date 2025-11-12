package com.askme.providers

import kotlinx.coroutines.withTimeoutOrNull

object IntelligentProvider {
    
    private const val DEFAULT_REQUEST_TIMEOUT_MS = 30000L // 30 seconds

    private val providers = listOf(
        GoogleProvider(),
        MistralProvider(),
        CohereProvider(),
        GroqProvider(),
        OpenRouterProvider()
    )
    
    // Performance tracking for intelligent selection
    private val statsMap = mutableMapOf<String, ProviderStats>()
    
    init {
        // Initialize stats for all providers
        providers.forEach { provider ->
            statsMap[provider.getProviderName()] = ProviderStats(provider.getProviderName())
        }
    }
    
    suspend fun processQuery(prompt: String): String {
        println("🧠 Intelligent Provider Selection")
        
        // Analyze the prompt to determine best approach
        val analysis = analyzePrompt(prompt)
        
        // Get ranked providers based on query type and performance
        val rankedProviders = getRankedProviders(analysis)
        
        println("🎯 Query Analysis: ${getAnalysisSummary(analysis)}")
        println("📊 Trying providers in order: ${rankedProviders.map { it.name }.joinToString(" → ")}")
        
        // Try providers in order until one succeeds
        for ((index, provider) in rankedProviders.withIndex()) {
            val providerInstance = providers.find { it.getProviderName() == provider.name }
                ?: continue
            
            println("🔄 Trying ${provider.name} (${providerInstance.selectBestModel(prompt)})...")
            
            val result = tryProviderWithFallback(providerInstance, prompt)
            
            if (!result.startsWith("❌")) {
                println("✅ Success with ${provider.name}")
                recordSuccess(provider.name)
                return "🎯 Selected: ${provider.name}\n$result"
            } else {
                recordFailure(provider.name)
                println("❌ Failed: ${provider.name}")
                
                // If not the last provider, continue to next
                if (index < rankedProviders.size - 1) {
                    println("🔄 Falling back to next provider...")
                }
            }
        }
        
        return "❌ All providers failed. Please check your connection and try again."
    }
    
    private suspend fun tryProviderWithFallback(provider: AIProvider, prompt: String): String {
        val startTime = System.currentTimeMillis()
        
        return try {
            // Try with timeout
            withTimeoutOrNull(DEFAULT_REQUEST_TIMEOUT_MS) {
                provider.chat(prompt)
            } ?: "❌ Timeout: Request took too long"
            
        } catch (e: Exception) {
            "❌ Error: ${e.message}"
        } finally {
            val responseTime = System.currentTimeMillis() - startTime
            updateResponseTime(provider.getProviderName(), responseTime)
        }
    }
    
    private fun analyzePrompt(prompt: String): PromptAnalysis {
        val promptLower = prompt.lowercase()
        
        return PromptAnalysis(
            isCodeRelated = promptLower.contains(Regex("\\b(code|programming|function|class|variable|debug|syntax|algorithm|javascript|python|kotlin|java|rust|go|swift)\\b")),
            isCreative = promptLower.contains(Regex("\\b(story|creative|poem|write|imagine|fiction|narrative|creative writing|novel|character)\\b")),
            isAnalytical = promptLower.contains(Regex("\\b(analyze|analysis|research|data|statistics|compare|evaluate|study|examine|investigate)\\b")),
            isMath = promptLower.contains(Regex("\\b(calculate|math|equation|formula|solve|number|arithmetic|algebra|geometry|calculus)\\b")),
            isLongForm = prompt.length > 200 || promptLower.contains(Regex("\\b(explain|detailed|comprehensive|essay|report|article)\\b")),
            isConversational = promptLower.contains(Regex("\\b(chat|talk|conversation|discuss|hello|hi|how are you|what's up|greet|greeting)\\b")),
            complexity = when {
                prompt.length > 500 -> PromptComplexity.HIGH
                prompt.length > 100 -> PromptComplexity.MEDIUM
                else -> PromptComplexity.LOW
            }
        )
    }
    
    private fun getRankedProviders(analysis: PromptAnalysis): List<ProviderStats> {
        val currentStats = statsMap.values.toList()
        
        // Score providers based on query type and performance
        val scoredProviders = currentStats.map { stats ->
            var score = stats.score
            
            // Boost score based on query type preferences (9 providers)
            when (stats.name) {
                "google" -> {
                    if (analysis.isMath) score += 20
                    if (analysis.isAnalytical) score += 15
                    if (analysis.complexity == PromptComplexity.HIGH) score += 10
                }
                "mistral" -> {
                    if (analysis.isCodeRelated) score += 25
                    if (analysis.isAnalytical) score += 20
                    if (analysis.complexity == PromptComplexity.MEDIUM) score += 15
                }
                "llama" -> {
                    if (analysis.isCreative) score += 25
                    if (analysis.isLongForm) score += 20
                    if (analysis.complexity == PromptComplexity.LOW) score += 10
                }
                "cohere" -> {
                    if (analysis.isAnalytical) score += 22
                    if (analysis.isLongForm) score += 18
                    if (analysis.complexity == PromptComplexity.MEDIUM) score += 12
                }
                "groq" -> {
                    if (analysis.complexity == PromptComplexity.LOW) score += 30 // Groq is very fast
                    if (analysis.isCodeRelated) score += 15
                    if (analysis.isMath) score += 12
                }
                "huggingface" -> {
                    if (analysis.isCodeRelated) score += 20
                    if (analysis.isConversational) score += 18
                    if (analysis.complexity == PromptComplexity.LOW) score += 8
                }
                "openrouter" -> {
                    if (analysis.complexity == PromptComplexity.HIGH) score += 18
                    if (analysis.isAnalytical) score += 15
                    if (analysis.isCodeRelated) score += 12
                }
                "ai21" -> {
                    if (analysis.isAnalytical) score += 16
                    if (analysis.complexity == PromptComplexity.MEDIUM) score += 14
                    if (analysis.isLongForm) score += 10
                }
                "replicate" -> {
                    if (analysis.isCodeRelated) score += 22
                    if (analysis.complexity == PromptComplexity.HIGH) score += 16
                    if (analysis.isAnalytical) score += 12
                }
            }
            
            stats to score
        }
        
        // Sort by performance and suitability
        return scoredProviders.sortedByDescending { it.second }.map { it.first }
    }
    
    private fun getAnalysisSummary(analysis: PromptAnalysis): String {
        val traits = mutableListOf<String>()
        
        if (analysis.isCodeRelated) traits.add("Code")
        if (analysis.isCreative) traits.add("Creative")
        if (analysis.isAnalytical) traits.add("Analytical")
        if (analysis.isMath) traits.add("Math")
        if (analysis.isLongForm) traits.add("Long-form")
        if (analysis.isConversational) traits.add("Conversational")
        
        val complexityStr = when (analysis.complexity) {
            PromptComplexity.LOW -> "Simple"
            PromptComplexity.MEDIUM -> "Medium"
            PromptComplexity.HIGH -> "Complex"
        }
        
        return if (traits.isNotEmpty()) {
            "${traits.joinToString(", ")} ($complexityStr)"
        } else {
            "General ($complexityStr)"
        }
    }
    
    private fun recordSuccess(providerName: String) {
        val current = statsMap[providerName] ?: return
        statsMap[providerName] = current.copy(
            successCount = current.successCount + 1,
            lastSuccess = System.currentTimeMillis()
        )
    }
    
    private fun recordFailure(providerName: String) {
        val current = statsMap[providerName] ?: return
        statsMap[providerName] = current.copy(
            failureCount = current.failureCount + 1,
            lastFailure = System.currentTimeMillis()
        )
    }
    
    private fun updateResponseTime(providerName: String, responseTime: Long) {
        val current = statsMap[providerName] ?: return
        statsMap[providerName] = current.copy(
            totalResponseTime = current.totalResponseTime + responseTime
        )
    }
    
    suspend fun getProviderStats(): String {
        return buildString {
            appendLine("📊 Provider Performance Statistics")
            appendLine("=".repeat(50))
            
            val sortedStats = statsMap.values.sortedByDescending { it.score }
            
            for (stats in sortedStats) {
                val provider = providers.find { it.getProviderName() == stats.name }
                
                appendLine("\n🤖 ${stats.name.uppercase()}")
                appendLine("   Success Rate: ${String.format("%.1f", stats.successRate * 100)}% (${stats.successCount}/${stats.totalRequests})")
                appendLine("   Avg Response: ${stats.averageResponseTime}ms")
                appendLine("   Performance Score: ${String.format("%.1f", stats.score)}")
                
                if (provider != null) {
                    appendLine("   Available Models: ${provider.getAvailableModels().size}")
                    appendLine("   Models: ${provider.getAvailableModels().take(3).joinToString(", ")}${if (provider.getAvailableModels().size > 3) "..." else ""}")
                }
                
                if (stats.lastSuccess > 0) {
                    val lastSuccessTime = (System.currentTimeMillis() - stats.lastSuccess) / 1000
                    appendLine("   Last Success: ${lastSuccessTime}s ago")
                }
            }
            
            appendLine("\n🎯 Selection Logic (9 Providers):")
            appendLine("   • Code queries → Mistral, Replicate, HuggingFace (coding optimized)")
            appendLine("   • Math queries → Google, Groq (computational strength)")  
            appendLine("   • Creative queries → Llama (creative writing)")
            appendLine("   • Analytical queries → Cohere, Google, Mistral (reasoning)")
            appendLine("   • Fast queries → Groq (ultra-fast LPU inference)")
            appendLine("   • Complex queries → OpenRouter, Google Pro, AI21")
            appendLine("   • Conversational → HuggingFace, Cohere")
            appendLine("   • General purpose → All providers with intelligent fallback")
            
            appendLine("\n🔄 Fallback Order: Performance + Query Type Match + Speed")
        }
    }
}
// Note: Llama provider currently has backend issues (Together.ai API key/model access)
