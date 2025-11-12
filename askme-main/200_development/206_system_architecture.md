# AskMe CLI System Architecture Overview

**Document Title:** AskMe CLI System Architecture  
**Project:** AskMe CLI - 5-Provider AI Interface  
**Document Type:** Technical Architecture Specification  

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v3.0 | 2025-07-18 | Updated for 5-provider production release | Architecture Team |
| v2.1 | 2025-06-18 | Reformatted structure, added hierarchical numbering | Project Coordinator |
| v2.0 | 2025-06-15 | Updated with production CLI metrics and Android status | Architecture Team |
| v1.5 | 2025-06-10 | Added security architecture and performance benchmarks | Architecture Team |
| v1.0 | 2025-06-05 | Initial system architecture design | Architecture Team |

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Core Components](#2-core-components)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Security & Privacy Architecture](#4-security--privacy-architecture)
5. [Performance Characteristics](#5-performance-characteristics)
6. [Development Architecture](#6-development-architecture)
7. [System Capabilities](#7-system-capabilities)
8. [System Requirements](#8-system-requirements)
9. [Integration Points](#9-integration-points)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🚀 AskMe CLI v1.3.0                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐ │
│  │  💻 CLI Layer   │      │  🧠 Core Logic   │      │  🤖 AI       │ │
│  │                 │◄────►│                  │◄────►│  Providers   │ │
│  │  • CLI Tool     │      │  • Query Engine  │      │              │ │
│  │  • Interactive  │      │  • Provider Mgmt │      │  • Google    │ │
│  │  • Args Parser  │      │  • Settings      │      │  • Mistral   │ │
│  │  • Stats Display│      │  • Security      │      │  • Cohere    │ │
│  └─────────────────┘      │  • Intelligent   │      │  • Groq      │ │
│                           │    Selection     │      │  • OpenRouter│ │
│                           └──────────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Components

### 2.1 UI Layer

| Component | Technology | Status | Description |
|-----------|------------|--------|-------------|
| **🤖 Android App** | Jetpack Compose | ⏳ *Foundation Ready* | Modern UI with Material Design 3 |
| **⌨️ CLI Interface** | Kotlinx.CLI | ✅ **Production Ready** | Command-line tool for Linux users |
| **🔗 Shared Components** | Kotlin Multiplatform | ✅ **Operational** | Common UI logic and utilities |

### 2.2 Core Logic Engine

| Component | Purpose | Implementation | Status |
|-----------|---------|----------------|--------|
| **🔍 Query Processor** | Input validation & routing | Kotlin coroutines + Flow | ✅ **Operational** |
| **🎛️ Provider Manager** | LLM provider orchestration | Intelligent failover system | ✅ **4-Provider System** |
| **⚙️ Settings Manager** | Configuration & preferences | Encrypted local storage | ✅ **Secure** |
| **🏠 Local Model Manager** | On-device model handling | File management + execution | ✅ **Ready** |

### 2.3 LLM Provider Ecosystem

| Provider | Type | Models | Integration Status | Response Time |
|----------|------|--------|-------------------|---------------|
| **🟢 Google Gemini** | Cloud API | Gemini Pro | ✅ **Live Production** | ~1.8s |
| **🟡 Mistral AI** | Cloud API | Mistral Medium | ✅ **Live Production** | ~2.0s |
| **🟠 OpenAI** | Cloud API | GPT-4, GPT-3.5 | ✅ **Ready** | *Requires API key* |
| **🟣 Anthropic** | Cloud API | Claude Sonnet/Haiku | ✅ **Ready** | *Requires API key* |

---

## 3. Data Flow Architecture

### 3.1 Step 1: User Input
```
User Query → Input Validation → Sanitization → Security Check
                                                      ↓
                                              ✅ Approved Query
```

### 3.2 Step 2: Query Processing
```
Query Router → Provider Selection → Load Balancing → API Call
     ↓              ↓                    ↓              ↓
Security     Health Check         Performance      Rate Limiting
```

### 3.3 Step 3: LLM Execution
```
Primary Provider → Backup Provider → Tertiary Provider → Final Fallback
      ↓                  ↓                   ↓               ↓
   Success           Retry Logic         Retry Logic     Error Handling
```

### 3.4 Step 4: Response Delivery
```
Raw Response → Post-Processing → Format Validation → User Display
      ↓              ↓               ↓                    ↓
   Filtering      Sanitization    Quality Check      Final Output
```

### 3.5 Step 5: Optional Storage
```
Response → Local Cache → Encrypted Storage → Sync (Optional)
    ↓          ↓              ↓                    ↓
User Control  Performance   Security          Cloud Backup
```

---

## 4. Security & Privacy Architecture

### 4.1 Data Protection

```
┌─────────────────────────────────────────────────────┐
│                ZERO DATA COLLECTION                 │
├─────────────────────────────────────────────────────┤
│  🔑 API Keys        │  🗄️ Local Storage              │
│  • AES-256 encrypted│  • SQLite encrypted            │
│  • Android Keystore │  • Minimal data footprint      │
│  • Secure deletion  │  • User-controlled retention   │
│                     │                                │
│  🌐 Network Security│  📱 Device Security            │
│  • HTTPS-only calls │  • Secure file permissions     │
│  • Certificate pin  │  • Memory protection           │
│  • No telemetry     │  • Process isolation           │
└─────────────────────────────────────────────────────┘
```

### 4.2 Security Layers

1. **🔒 Input Sanitization:** All user input validated and sanitized
2. **🔐 Credential Protection:** API keys encrypted with AES-256
3. **🌍 Network Security:** HTTPS-only, certificate pinning
4. **💾 Storage Encryption:** Local database fully encrypted
5. **🚫 Zero Telemetry:** No data collection or analytics

---

## 5. Performance Characteristics

### 5.1 Benchmarks

| Metric | Target | Achieved | Status |
|--------|--------|----------|--------|
| **⏱️ Response Time** | < 2.0s | **1.92s** | ✅ **4% Better** |
| **🏗️ Build Time** | < 2 min | **1.8 min** | ✅ **Optimized** |
| **💾 Memory Usage** | < 512MB | **~400MB** | ✅ **Efficient** |
| **📦 App Size** | < 20MB | *Pending* | ⏳ **Android Blocked** |

### 5.2 Optimization Features

1. **⚡ Response Caching:** Intelligent cache with TTL
2. **🔄 Connection Pooling:** Reuse HTTP connections
3. **📈 Lazy Loading:** Load components on demand
4. **🗜️ Data Compression:** Minimize network payload

---

## 6. Development Architecture

### 6.1 Module Structure

```
askme-project/
├── 📦 core/                    # Shared business logic
│   ├── api/                   # Provider implementations  
│   ├── data/                  # Data models & storage
│   └── security/              # Encryption & auth
├── 📱 androidApp/             # Android UI (Jetpack Compose)
├── ⌨️ cliApp/                 # Command-line interface
├── 🧪 tests/                  # Test suites
└── 📚 docs/                   # Documentation
```

### 6.2 Build Pipeline

```
Code Changes → Quality Checks → Tests → Build → Deploy
      ↓             ↓           ↓        ↓       ↓
  Git Hooks    Detekt+ktlint  JUnit   Gradle   Artifacts
```

---

## 7. System Capabilities

### 7.1 Current Features ✅

1. 🤖 **Multi-Provider AI:** 4 LLM providers with intelligent failover
2. ⌨️ **CLI Interface:** Production-ready command-line tool
3. 🔒 **Privacy-First:** Zero data collection, encrypted storage
4. ⚡ **High Performance:** Sub-2-second response times
5. 🛡️ **Enterprise Security:** Comprehensive security testing

### 7.2 In Progress ⏳

1. 📱 **Android App:** Foundation ready, deployment blocked by SDK issues
2. 🌐 **Web Interface:** Planned for future releases
3. 📊 **Analytics Dashboard:** Optional privacy-respecting metrics

### 7.3 Future Roadmap 🚀

1. 🏠 **Local Models:** On-device inference capabilities
2. 🌍 **Multi-Language:** Internationalization support
3. 🔌 **Plugin System:** Third-party integrations
4. ☁️ **Cloud Sync:** Optional cross-device synchronization

---

## 8. System Requirements

### 8.1 Development Environment

1. **Java:** OpenJDK 17+ (LTS)
2. **Kotlin:** 1.9.10 (aligned across all modules)
3. **Gradle:** 8.4 (optimized for KMP)
4. **Android SDK:** API 34 (latest stable)

### 8.2 Runtime Environment

1. **CLI:** Linux with 2GB+ RAM
2. **Android:** API 24+ (Android 7.0+)
3. **Network:** Internet connection for cloud providers
4. **Storage:** 100MB+ free space

---

## 9. Integration Points

### 9.1 External APIs

1. **Google AI Platform:** Gemini Pro integration
2. **Mistral AI:** Direct API integration
3. **OpenAI:** GPT model access (optional)
4. **Anthropic:** Claude model access (optional)

### 9.2 Local Services

1. **Ollama:** Local model serving (planned for future)
2. **LocalAI:** Self-hosted inference (planned for future)
3. **Custom Models:** GGML/ONNX support (planned for future)

---

**📊 Architecture Status:** ✅ **Core Complete** | ⏳ **Android Deployment Pending** | 🚀 **CLI Production Ready**