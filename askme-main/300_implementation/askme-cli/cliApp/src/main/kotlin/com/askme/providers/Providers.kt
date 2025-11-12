package com.askme.providers

class GoogleProvider : BaseProvider() {
    
    override fun getProviderName(): String = "google"
    
    override fun getAvailableModels(): List<String> = listOf(
        "gemini-1.5-flash",           // Fast, efficient
        "gemini-1.5-flash-8b"         // Even faster
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.isMath || analysis.complexity == PromptComplexity.LOW ->
                "gemini-1.5-flash"  // Fastest for simple queries
            
            else ->
                "gemini-1.5-flash-8b"  // Good general fallback
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "google", selectedModel)
    }
}

class MistralProvider : BaseProvider() {
    
    override fun getProviderName(): String = "mistral"
    
    override fun getAvailableModels(): List<String> = listOf(
        "mistral-small-latest",       // Fast, efficient
        "open-mistral-7b",           // Open source
        "open-mixtral-8x7b",         // Powerful open source
        "open-mixtral-8x22b",        // Most powerful open
        "mistral-medium-latest"      // Balanced performance
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.isMath || analysis.complexity == PromptComplexity.LOW ->
                "mistral-small-latest"  // Fast for simple queries
            
            analysis.isCodeRelated ->
                "open-mixtral-8x7b"  // Good at code
            
            analysis.isLongForm || analysis.complexity == PromptComplexity.HIGH ->
                "open-mixtral-8x22b"  // Most powerful
            
            analysis.isAnalytical ->
                "mistral-medium-latest"  // Balanced for reasoning
            
            else ->
                "mistral-small-latest"  // Good default
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "mistral", selectedModel)
    }
}

class CohereProvider : BaseProvider() {
    
    override fun getProviderName(): String = "cohere"
    
    override fun getAvailableModels(): List<String> = listOf(
        "command",                        // Main conversational model
        "command-light",                  // Faster, lightweight version
        "command-nightly",                // Latest experimental features
        "command-r",                      // Retrieval-optimized
        "command-r-plus"                  // Enhanced retrieval
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.isLongForm || analysis.complexity == PromptComplexity.HIGH ->
                "command-r-plus"  // Most capable
            
            analysis.isAnalytical || prompt.toLowerCase().contains("search") ->
                "command-r"  // Retrieval-optimized
            
            analysis.complexity == PromptComplexity.LOW ->
                "command-light"  // Fast for simple queries
            
            else ->
                "command"  // Good default
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "cohere", selectedModel)
    }
}

class GroqProvider : BaseProvider() {
    
    override fun getProviderName(): String = "groq"
    
    override fun getAvailableModels(): List<String> = listOf(
        "llama-3.3-70b-versatile",        // Latest Llama 3.3
        "llama-3.1-70b-versatile",        // Llama 3.1 70B
        "llama-3.1-8b-instant",           // Fast 8B model
        "mixtral-8x7b-32768",             // Mixtral with long context
        "gemma2-9b-it",                   // Google Gemma 2
        "gemma-7b-it"                     // Google Gemma 7B
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.complexity == PromptComplexity.LOW || prompt.toLowerCase().contains("fast") ->
                "llama-3.1-8b-instant"  // Ultra-fast for simple queries
            
            analysis.isCodeRelated ->
                "mixtral-8x7b-32768"  // Good at code with long context
            
            analysis.isLongForm || analysis.complexity == PromptComplexity.HIGH ->
                "llama-3.3-70b-versatile"  // Most capable
            
            analysis.isAnalytical ->
                "gemma2-9b-it"  // Google's analytical model
            
            else ->
                "llama-3.1-70b-versatile"  // Good default
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "groq", selectedModel)
    }
}

class HuggingFaceProvider : BaseProvider() {
    
    override fun getProviderName(): String = "huggingface"
    
    override fun getAvailableModels(): List<String> = listOf(
        "microsoft/DialoGPT-large",       // Conversational AI
        "microsoft/DialoGPT-medium",      // Medium conversational
        "facebook/blenderbot-400M-distill", // Facebook's chatbot
        "google/flan-t5-large",           // Instruction-following
        "microsoft/CodeBERT-base"         // Code understanding
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.isCodeRelated ->
                "microsoft/CodeBERT-base"  // Code-specific model
            
            analysis.complexity == PromptComplexity.HIGH ->
                "google/flan-t5-large"  // Instruction-following
            
            analysis.isConversational ->
                "microsoft/DialoGPT-large"  // Best conversational
            
            analysis.complexity == PromptComplexity.LOW ->
                "microsoft/DialoGPT-medium"  // Lighter conversational
            
            else ->
                "facebook/blenderbot-400M-distill"  // Good general chatbot
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "huggingface", selectedModel)
    }
}

class OpenRouterProvider : BaseProvider() {
    
    override fun getProviderName(): String = "openrouter"
    
    override fun getAvailableModels(): List<String> = listOf(
        "anthropic/claude-3-haiku",       // Fast Claude model
        "meta-llama/llama-3.1-8b-instruct", // Llama via OpenRouter
        "mistralai/mistral-7b-instruct",  // Mistral via OpenRouter
        "google/gemma-7b-it",             // Gemma via OpenRouter
        "microsoft/wizardlm-2-8x22b"      // WizardLM via OpenRouter
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.complexity == PromptComplexity.LOW || prompt.toLowerCase().contains("fast") ->
                "anthropic/claude-3-haiku"  // Fast Claude
            
            analysis.isCodeRelated ->
                "microsoft/wizardlm-2-8x22b"  // WizardLM good at code
            
            analysis.isAnalytical ->
                "mistralai/mistral-7b-instruct"  // Mistral analytical
            
            analysis.isLongForm ->
                "meta-llama/llama-3.1-8b-instruct"  // Llama for long content
            
            else ->
                "google/gemma-7b-it"  // Good general purpose
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "openrouter", selectedModel)
    }
}

class AI21Provider : BaseProvider() {
    
    override fun getProviderName(): String = "ai21"
    
    override fun getAvailableModels(): List<String> = listOf(
        "j2-light",                       // Fast, efficient
        "j2-mid",                         // Balanced performance
        "j2-ultra",                       // Most capable
        "jamba-instruct"                  // Latest instruction model
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.complexity == PromptComplexity.LOW ->
                "j2-light"  // Fast for simple queries
            
            analysis.complexity == PromptComplexity.HIGH || analysis.isLongForm ->
                "j2-ultra"  // Most capable
            
            analysis.isAnalytical || prompt.toLowerCase().contains("instruct") ->
                "jamba-instruct"  // Latest instruction model
            
            else ->
                "j2-mid"  // Good balanced default
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "ai21", selectedModel)
    }
}

class ReplicateProvider : BaseProvider() {
    
    override fun getProviderName(): String = "replicate"
    
    override fun getAvailableModels(): List<String> = listOf(
        "meta/llama-2-70b-chat",          // Llama 2 70B
        "meta/llama-2-13b-chat",          // Llama 2 13B
        "mistralai/mixtral-8x7b-instruct-v0.1", // Mixtral
        "meta/codellama-34b-instruct"     // Code-focused model
    )
    
    override fun selectBestModel(prompt: String): String {
        val analysis = analyzePrompt(prompt)
        return when {
            analysis.isCodeRelated ->
                "meta/codellama-34b-instruct"  // Code-specific
            
            analysis.complexity == PromptComplexity.HIGH || analysis.isLongForm ->
                "meta/llama-2-70b-chat"  // Most capable
            
            analysis.isAnalytical ->
                "mistralai/mixtral-8x7b-instruct-v0.1"  // Mixtral analytical
            
            else ->
                "meta/llama-2-13b-chat"  // Good balanced default
        }
    }
    
    override suspend fun chat(prompt: String, model: String?): String {
        val selectedModel = model ?: selectBestModel(prompt)
        return callBackend(prompt, "replicate", selectedModel)
    }
}
