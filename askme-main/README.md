# askme CLI

**Version**: 1.0.0
**Status**: Production Ready ✅
**Repository**: https://github.com/vn6295337/askme

An AI assistant designed with privacy in mind, connecting to multiple LLM providers through a backend proxy that manages API keys. Get instant answers from Google Gemini, Mistral AI, and Llama models with **zero local configuration required**.

## 🏗️ System Architecture

  This repository is part of a 3-tier AI Intelligence System:

  ```
  ┌─────────────────────────────────────────────────────────────────┐
  │                  AI INTELLIGENCE SYSTEM                         │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  [1] Discovery Pipeline  →  [2] Dashboard  →  [3] API Gateway   │
  │                                                                 │
  │      ai-models-           ai-land             askme-cli         │
  │      discoverer_v3                                              │
  │                                                                 │
  │  • 8-stage automation    • Real-time viz     • Smart routing    │
  │  • Daily updates         • 75+ models        • Multi-provider   │
  │  • Zero manual work      • Decision support  • Secure access    │
  └─────────────────────────────────────────────────────────────────┘
  ```

  **🔗 Related Repositories:**
  - **[ai-models-discoverer_v3](https://github.com/vn6295337/ai-models-discoverer_v3)** - Automated discovery pipeline
  - **[ai-land](https://github.com/vn6295337/ai-land)** - Decision intelligence dashboard
  - **[askme-cli](https://github.com/vn6295337/askme)** - Unified API gateway *(you are 
  here)*

  **📊 Data Flow:**
  Discovery Pipeline → Supabase (`ai_models_main` table) → Dashboard + API Gateway

## 🚀 Quick Start

To get started quickly, follow the [Build from Source](#build-from-source) instructions in the Installation section. This will guide you through setting up the project and running the CLI application.

**✅ No API keys required! ✅ No configuration needed!**

## 🌟 Key Features

*   **Zero Local Configuration**: Works immediately without any local setup; API keys are managed by the backend proxy.
*   **Backend Proxy for API Key Management**: API keys for AI providers are securely managed on the server-side, enhancing security by keeping them off your local machine.
*   **Multiple AI Providers**: Supports Google Gemini, Mistral AI, and Llama models.
*   **Intelligent Provider Selection**: Automatically chooses the best provider for your query based on its content and historical performance.
*   **Privacy-Focused**: Designed with a commitment to privacy; your questions and the AI's responses are not stored by the CLI or the default backend proxy.
*   **Security Validation**: Includes unit tests for input validation and secure data handling logic. These tests validate the internal logic of the application's security features. For comprehensive security, consider implementing integration tests against a deployed backend that simulate real-world attack scenarios.
*   **Cross-Platform**: Runs on Linux, macOS, and Windows with WSL.
*   **Multiple Input Methods**: Ask direct questions, process questions from files, or use the interactive mode.

## 📦 Installation

### System Requirements

*   **Operating System**: Linux, macOS, or Windows with WSL
*   **Java**: OpenJDK 17 or higher
*   **Memory**: 512MB RAM minimum
*   **Storage**: 50MB free space
*   **Network**: An internet connection is required to connect to the backend proxy.

### Build from Source

1.  Clone the repository:
    ```bash
    git clone https://github.com/vn6295337/askme.git
    ```
2.  Navigate to the CLI implementation directory:
    ```bash
    cd askme/300_implementation/askme-cli
    ```
3.  Make the Gradle wrapper executable:
    ```bash
    chmod +x gradlew
    ```
4.  Build the application:
    ```bash
    ./gradlew cliApp:installDist
    ```
5.  Run the application:
    ```bash
    ./cliApp/build/install/cliApp/bin/cliApp "Your question here"
    ```

## Usage

### Basic Commands

**Direct Questions (Recommended)**

```bash
./bin/cliApp "What is artificial intelligence?"
./bin/cliApp "Explain quantum computing in simple terms"
```

**With Different Providers**

```bash
./bin/cliApp -m google "What is machine learning?"
./bin/cliApp -m mistral "Explain blockchain technology"
```

**File-Based Input**

```bash
echo "What is the capital of France?" > question.txt
./bin/cliApp -f question.txt
```

**Interactive Mode**

```bash
./bin/cliApp
```

### Supported Providers

*   **Google Gemini**
*   **Mistral AI**
*   **Llama**

## Troubleshooting

### Permission Denied Error

If you get a "Permission Denied" error, make sure the `cliApp` script is executable:

```bash
chmod +x ./bin/cliApp
```

If you are building from source, also make sure the Gradle wrapper is executable:

```bash
chmod +x gradlew
```

### API Provider Errors

If you see errors related to API providers, it may be an issue with the backend service. Please check the project's GitHub issues for more information.

## License

This project is released under the MIT License. See the `LICENSE` file for complete terms.