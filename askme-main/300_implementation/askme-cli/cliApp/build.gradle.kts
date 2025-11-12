// AskMe CLI - Free Models Edition (Google, Groq, OpenRouter)
plugins {
    kotlin("jvm") version "1.9.10"
    kotlin("plugin.serialization") version "1.9.10"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    // Core Kotlin
    implementation("org.jetbrains.kotlinx:kotlinx-cli:0.3.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.5.0")

    // HTTP Client for API calls
    implementation("io.ktor:ktor-client-core:2.3.6")
    implementation("io.ktor:ktor-client-cio:2.3.6")
    implementation("io.ktor:ktor-client-content-negotiation:2.3.6")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.6")
    implementation("io.ktor:ktor-client-auth:2.3.6")
    implementation("io.ktor:ktor-client-logging:2.3.6")

    // Supabase Client
    implementation("io.github.jan-tennert.supabase:postgrest-kt:2.1.3")
    implementation("io.github.jan-tennert.supabase:realtime-kt:2.1.3")

    // Environment Variables
    implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")

    // Logging
    implementation("org.slf4j:slf4j-simple:2.0.9")
    implementation("io.github.microutils:kotlin-logging-jvm:3.0.5")

    // File System Operations (for caching)
    implementation("com.google.code.gson:gson:2.10.1")

    // Testing
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")
}

application {
    mainClass.set("com.askme.cli.MainKt")
}

kotlin {
    jvmToolchain(17)
}

// Ensure distribution is built correctly
tasks.named("installDist") {
    doLast {
        println("✅ AskMe CLI - Free Models Edition installed successfully!")
        println("📊 Integrated with ai-models-discoverer for dynamic model discovery")
        println("🔑 Providers: Google (least restrictive), Groq, OpenRouter (most restrictive)")
        val installDir = layout.buildDirectory.dir("install/cliApp").get().asFile
        println("📁 Installation directory: ${installDir.absolutePath}")
        println("🚀 Run with: ${installDir.absolutePath}/bin/cliApp --help")
        println("⚙️  Configure: Copy .env.example to .env.local and add API keys")
    }
}