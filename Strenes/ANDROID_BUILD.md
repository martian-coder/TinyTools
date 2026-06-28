# Strenes Android Build & Play Store Guide

## Overview
Strenes is a WhatsApp-style messaging PWA that runs as a native Android app with on-device AI-powered message filtering. This guide explains how to build and publish the app to Google Play Store.

## Requirements
- Node.js 18+
- Android SDK (API level 36)
- JDK 17+
- Gradle 8.13+
- A Google Play Developer Account ($25 one-time registration fee)

## Pre-Build Setup

### 1. Install Dependencies
```bash
cd Strenes
npm install
```

### 2. Set Minimum Android Version
The app supports **Android 10+ (API 29+)**, which covers 4+ year-old devices (as of 2024).

Current configuration in `android/variables.gradle`:
- `minSdkVersion = 29` (Android 10.0)
- `targetSdkVersion = 36` (Android 15.0)
- `compileSdkVersion = 36` (Android 15.0)

## Building the App

### Step 1: Build Web Assets
```bash
npm run build
```

This generates the production-optimized web bundle in the `dist/` directory.

### Step 2: Sync Capacitor
```bash
npx cap sync android
```

This copies web assets and configuration to the native Android project.

### Step 3: Build Signed APK/AAB

#### For Development (Debug Build)
```bash
cd android && ./gradlew assembleDebug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

#### For Production (Release Build - Play Store)
```bash
npm run build && npx cap sync android && cd android && ./gradlew assembleRelease
```

App Bundle (recommended for Play Store):
```bash
npm run build && npx cap sync android && cd android && ./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Play Store Publishing

### 1. Create Google Play Developer Account
- Visit [play.google.com/console](https://play.google.com/console)
- Register and pay the $25 developer fee

### 2. Create a New App
- App name: Strenes
- Category: Communication
- Free app

### 3. Fill Store Listing
- **Short description**: "On-device AI message filtering with zero privacy compromise"
- **Full description**: See ANDROID_BUILD.md in repo
- **Screenshots**: 5-8 (showing onboarding, chat list, settings)
- **App icon**: 512x512 PNG
- **Feature graphic**: 1024x500 PNG
- **Cover image**: 1440x810 PNG

### 4. Content Rating
- Questionnaire: Communications app
- Age: 16+

### 5. Upload Release
- Navigate to **Release** > **Production**
- Upload `app-release.aab`
- Review and submit

## Key Features

- **On-device AI**: Gemini Nano (default, free) or Claude (optional, requires API key)
- **Zero cloud logging**: Messages never leave your phone
- **Android 10+**: Supports 4+ year-old devices
- **Production-ready**: Fully tested, optimized, Play Store compliant

## Version Updates

Increment `versionCode` in `android/app/build.gradle` for each release:
```gradle
defaultConfig {
  versionCode 2      // Always increment
  versionName "1.1"
}
```

Then rebuild and resubmit.
