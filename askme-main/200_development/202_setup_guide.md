# Complete Build & Development Setup Guide

**Document:** 202_setup_guide.md  
**Project:** ask me CliApp  
**Last Updated:** June 18, 2025  

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v1.0 | June 18, 2025 | Initial reformatted version with enhanced structure | Technical Project Coordinator |

## Table of Contents

1. [Prerequisites](#1-prerequisites)
   1. [For All Platforms](#11-for-all-platforms)
   2. [For Android Development](#12-for-android-development)
   3. [For Linux CLI Development](#13-for-linux-cli-development)
2. [Setup Instructions](#2-setup-instructions)
   1. [Clone the Repository](#21-clone-the-repository)
   2. [Configure Development Environment](#22-configure-development-environment)
   3. [Android SDK Setup](#23-android-sdk-setup)
   4. [Build the Project](#24-build-the-project)
   5. [Run Local LLM (Optional)](#25-run-local-llm-optional)
3. [Development Workflow](#3-development-workflow)
   1. [Daily Development Process](#31-daily-development-process)
   2. [Code Style & Quality](#32-code-style--quality)
4. [Configuration](#4-configuration)
   1. [Android Studio Setup](#41-android-studio-setup)
   2. [CLI Configuration](#42-cli-configuration)
5. [Troubleshooting](#5-troubleshooting)
   1. [Common Build Issues](#51-common-build-issues)
   2. [LLM Connection Issues](#52-llm-connection-issues)
   3. [Performance Issues](#53-performance-issues)
6. [Debugging](#6-debugging)
   1. [Android Debugging](#61-android-debugging)
   2. [CLI Debugging](#62-cli-debugging)
7. [Deployment](#7-deployment)
   1. [Android Deployment](#71-android-deployment)
   2. [Linux Deployment](#72-linux-deployment)
8. [Contributing Guidelines](#8-contributing-guidelines)
   1. [Branch Strategy](#81-branch-strategy)
   2. [Pull Request Process](#82-pull-request-process)
   3. [Issue Reporting](#83-issue-reporting)

---

## 1. Prerequisites

### 1.1 For All Platforms

⬜ **Java Development Kit (JDK) 17 or later**  
⬜ **Git**  
⬜ **Docker (for local LLM setup)**

### 1.2 For Android Development

⬜ **Android Studio (latest stable version)**  
⬜ **Android SDK (API 33+)**  
⬜ **Android NDK (if building native code)**

### 1.3 For Linux CLI Development

⬜ **GCC/G++ or Clang**  
⬜ **CMake 3.22+**

---

## 2. Setup Instructions

### 2.1 Clone the Repository

```bash
git clone https://github.com/yourusername/askme-lite.git
cd askme-lite
```

**Status:** ⬜ Repository cloned and directory accessed

### 2.2 Configure Development Environment

#### 2.2.1 Install JDK 17

```bash
# Ubuntu/Debian
sudo apt install openjdk-17-jdk

# Set JAVA_HOME
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
echo 'export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"' >> ~/.bashrc
```

**Status:** ⬜ JDK 17 installed and JAVA_HOME configured

#### 2.2.2 Install Kotlin & Gradle via SDKMAN

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh

# Install Kotlin 1.9.10
sdk install kotlin 1.9.10
sdk default kotlin 1.9.10

# Install Gradle 8.4
sdk install gradle 8.4
sdk default gradle 8.4
```

**Status:** ⬜ SDKMAN, Kotlin 1.9.10, and Gradle 8.4 installed

### 2.3 Android SDK Setup

```bash
# Install Android SDK components
sdkmanager --install "platforms;android-33" "build-tools;33.0.0"
sdkmanager --install "ndk;25.1.8937393"

# Set environment variables
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Status:** ⬜ Android SDK components installed and environment variables configured

### 2.4 Build the Project

#### 2.4.1 Initialize Project

```bash
# Install dependencies
./gradlew --refresh-dependencies

# Build the project
./gradlew build

# Run tests
./gradlew test

# Format and check code quality
./gradlew ktlintFormat
./gradlew ktlintCheck detekt
```

**Status:** ⬜ Project dependencies installed and initial build completed

#### 2.4.2 Android Development

```bash
# Build Android app
./gradlew :androidApp:assembleDebug

# Run Android tests
./gradlew :androidApp:connectedAndroidTest
```

**Status:** ⬜ Android app built and tests executed

#### 2.4.3 CLI Development

```bash
# Build CLI distribution
./gradlew :cli:installDist

# Run CLI tool
./cli/build/install/cli/bin/cli --model llama2 --prompt "Hello, world!"
```

**Status:** ⬜ CLI distribution built and tested

### 2.5 Run Local LLM (Optional)

**Note: Local LLM support is not yet fully integrated into the askme CLI application. These steps are for setting up a local LLM server, but the application will not use it by default in the current MVP.**

```bash
# Using Ollama
docker run -d --name ollama -p 11434:11434 ollama/ollama

# Pull a model
docker exec ollama ollama pull llama2
```

**Status:** ⬜ Local LLM setup completed (optional)

---

## 3. Development Workflow

### 3.1 Daily Development Process

#### 3.1.1 Start Development

```bash
# Navigate to project
cd askme-lite

# Pull latest changes
git pull origin main
```

**Status:** ⬜ Development environment ready

#### 3.1.2 Make Changes

1. ⬜ **Create feature branch:** `git checkout -b feature/your-feature`
2. ⬜ **Make code changes**
3. ⬜ **Test changes locally**

#### 3.1.3 Quality Checks

```bash
# Run all tests
./gradlew test

# Format code
./gradlew ktlintFormat

# Check code quality
./gradlew detekt
```

**Status:** ⬜ Code quality checks passed

#### 3.1.4 Commit & Push

```bash
# Add changes
git add .

# Commit with conventional commits
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/your-feature
```

**Status:** ⬜ Changes committed and pushed

### 3.2 Code Style & Quality

1. ⬜ **KtLint:** Code style enforcement
2. ⬜ **Detekt:** Static code analysis
3. ⬜ **Pre-commit hooks** (optional):

```bash
pip install pre-commit
pre-commit install
```

---

## 4. Configuration

### 4.1 Android Studio Setup

1. ⬜ **Open project in Android Studio**
2. ⬜ **Install "Kotlin Multiplatform Mobile" plugin**
3. ⬜ **Wait for Gradle sync to complete**
4. ⬜ **Select `androidApp` run configuration**
5. ⬜ **Connect device/emulator and run**

### 4.2 CLI Configuration

```bash
# Build and run CLI
./gradlew :cli:installDist
./cli/build/install/cli/bin/cli
```

**Status:** ⬜ CLI configuration completed

---

## 5. Troubleshooting

### 5.1 Common Build Issues

#### 5.1.1 Gradle sync fails

**Solution:**
```bash
./gradlew --stop
rm -rf ~/.gradle/caches/
./gradlew clean
```

#### 5.1.2 Missing SDK components

**Solution:** Install via Android Studio SDK Manager

#### 5.1.3 Kotlin version conflicts

**Solution:** Ensure all dependencies use same Kotlin version

### 5.2 LLM Connection Issues

#### 5.2.1 Cannot connect to local LLM

**Troubleshooting Steps:**
1. ⬜ **Verify Docker is running:** `docker ps`
2. ⬜ **Test endpoint:** `curl http://localhost:11434/api/tags`
3. ⬜ **Check firewall settings**

### 5.3 Performance Issues

**Optimization Steps:**
1. ⬜ **Use smaller models for development**
2. ⬜ **Allocate more resources to Docker**
3. ⬜ **Enable model quantization**

---

## 6. Debugging

### 6.1 Android Debugging

1. ⬜ **Use Android Studio debugger**
2. ⬜ **Check Logcat:** `adb logcat | grep "ASKME"`
3. ⬜ **Enable verbose logging in `BuildConfig.DEBUG`**

### 6.2 CLI Debugging

1. ⬜ **Run with `--verbose` flag**
2. ⬜ **Use `jstack` for thread dumps**
3. ⬜ **Enable remote debugging:** `./gradlew :cli:run --debug-jvm`

---

## 7. Deployment

### 7.1 Android Deployment

1. ⬜ **Update version in `androidApp/build.gradle.kts`**
2. ⬜ **Create signed APK/AAB**
3. ⬜ **Upload to Google Play Console**

### 7.2 Linux Deployment

```bash
# Build distribution
./gradlew :cli:distTar

# Package for distribution
# Upload to package repositories (PPA, AUR, etc.)
```

**Status:** ⬜ Linux distribution packages created

---

## 8. Contributing Guidelines

### 8.1 Branch Strategy

1. ⬜ **`main`:** Production-ready code
2. ⬜ **`develop`:** Integration branch
3. ⬜ **`feature/*`:** Feature development
4. ⬜ **`hotfix/*`:** Critical fixes

### 8.2 Pull Request Process

1. ⬜ **Create feature branch from `develop`**
2. ⬜ **Make changes with tests**
3. ⬜ **Run quality checks**
4. ⬜ **Submit PR to `develop`**
5. ⬜ **Code review and merge**

### 8.3 Issue Reporting

**Requirements:**
1. ⬜ **Use GitHub Issues**
2. ⬜ **Include steps to reproduce**
3. ⬜ **Provide environment details**
4. ⬜ **Add relevant logs**

---

**Related Documents:**
- See [201_tech_stack.md](./201_tech_stack.md) for technical stack details
- See [203_implementation_log.md](./203_implementation_log.md) for implementation progress
- See [209_wireframe_notes.md](./209_wireframe_notes.md) for UI wireframe information