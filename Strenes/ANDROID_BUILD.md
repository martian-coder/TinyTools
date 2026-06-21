# Building the Android App

Strenes can be packaged as an Android app using Capacitor. This guide walks through building the APK installer.

## Prerequisites

You'll need:
- **Java Development Kit (JDK) 17+** — [download](https://www.oracle.com/java/technologies/downloads/#java17)
- **Android SDK** — Install via Android Studio or standalone
- **Node.js 18+** and npm
- **Gradle** — Included in the Android SDK

### Quick Setup on macOS/Linux

```bash
# Install JDK 17
brew install openjdk@17

# Install Android SDK (via Android Studio)
# OR use standalone SDK command-line tools from:
# https://developer.android.com/studio#command-tools

# Add Android SDK to your environment
export ANDROID_SDK_ROOT=~/Library/Android/sdk  # macOS
export ANDROID_SDK_ROOT=~/Android/Sdk         # Linux

# Add to PATH
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export PATH=$PATH:$ANDROID_SDK_ROOT/emulator
```

## Building the APK

### 1. Install Dependencies

```bash
cd Strenes
npm ci  # Install node dependencies
```

### 2. Build Release APK

```bash
# Build the web assets and sync with Android project
npm run build:android

# This runs:
# 1. npm run build  - Build React app for production
# 2. npx cap sync android  - Sync web assets to Android
# 3. cd android && ./gradlew assembleRelease  - Build signed APK
```

### 3. Build Debug APK (for testing)

```bash
npm run build:android:debug

# OR manually:
# npm run build && npx cap sync android && cd android && ./gradlew assembleDebug
```

## Output Location

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Signing the Release APK

For distribution on Google Play Store, you need to sign the APK with your keystore:

### 1. Create a Keystore (first time only)

```bash
keytool -genkey -v -keystore strenes.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias strenes-key
```

### 2. Sign the APK

```bash
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore strenes.keystore \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  strenes-key

# Verify signature
jarsigner -verify -verbose android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### 3. Align the APK

```bash
zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  app-release.apk
```

The final `app-release.apk` is ready for Google Play Store upload.

## Troubleshooting

### Gradle Build Fails

**"Could not resolve com.android.tools.build:gradle"**
- Make sure Java/JDK is properly installed and in PATH
- Update Gradle: `cd android && ./gradlew wrapper --gradle-version latest`

**"ANDROID_SDK_ROOT not found"**
- Set `ANDROID_SDK_ROOT` environment variable (see Prerequisites above)
- Or create `android/local.properties`:
  ```
  sdk.dir=/path/to/android/sdk
  ```

### APK Size Too Large

- Enable shrinking in `android/app/build.gradle`:
  ```gradle
  buildTypes {
    release {
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
  ```

### App Crashes on Launch

- Check Capacitor sync: `npx cap sync android`
- Rebuild assets: `npm run build`
- Check Android Studio logs for errors

## Testing the APK

### On Emulator

```bash
# Start Android emulator via Android Studio

# Install APK to running emulator
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or via Gradle
cd android
./gradlew installDebug
```

### On Physical Device

```bash
# Enable USB debugging on device
# Connect via USB

# Install APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# View logs
adb logcat | grep strenes
```

## Publishing to Google Play Store

1. **Create Google Play Developer Account** — $25 one-time fee
2. **Sign APK** — Follow "Signing the Release APK" section above
3. **Create App Listing** — In Google Play Console
4. **Upload APK** — Select signed `app-release.apk`
5. **Review & Submit** — Google takes 1-3 hours to review
6. **Release** — Can go to production or staged rollout (recommended: 5% → 25% → 50% → 100%)

## CI/CD Automation (GitHub Actions)

To automate builds on every push to main:

1. Generate signing key (one-time):
   ```bash
   keytool -genkey -v -keystore strenes.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias strenes
   ```

2. Encode for GitHub Secrets:
   ```bash
   base64 strenes.keystore | pbcopy  # macOS
   base64 strenes.keystore | xclip   # Linux
   ```

3. Add to GitHub → Settings → Secrets:
   - `ANDROID_KEYSTORE_B64` — Base64-encoded keystore
   - `ANDROID_KEYSTORE_PASSWORD` — Keystore password
   - `ANDROID_KEY_ALIAS` — Key alias (e.g., "strenes")
   - `ANDROID_KEY_PASSWORD` — Key password

4. Create `.github/workflows/android-build.yml`:
   ```yaml
   name: Build Android APK
   on: [push, pull_request]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: 18
         - uses: actions/setup-java@v3
           with:
             java-version: 17
             distribution: 'temurin'
         - name: Decode keystore
           run: echo "${{ secrets.ANDROID_KEYSTORE_B64 }}" | base64 -d > Strenes/strenes.keystore
         - name: Build APK
           working-directory: Strenes
           run: npm run build:android
         - name: Upload artifact
           uses: actions/upload-artifact@v3
           with:
             name: app-release.apk
             path: Strenes/android/app/build/outputs/apk/release/**/*.apk
   ```

## Next Steps

- Test on multiple Android versions (API 24+)
- Add app icon and branding
- Write app description for Play Store
- Set up beta testing with internal testers

For more, see:
- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android Studio Docs](https://developer.android.com/studio/intro)
