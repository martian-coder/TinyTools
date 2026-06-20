# Build Strenes Android APK Locally — Complete Guide for VCs

This guide walks you through building a **production-ready Android APK** of Strenes on your machine.

**Time:** ~30 minutes (first time) | ~5 minutes (subsequent builds)

---

## Prerequisites

### Step 1: Install Java Development Kit (JDK) 17+

**macOS:**
```bash
brew install openjdk@17
# Add to shell profile (~/.zshrc or ~/.bash_profile):
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
# Reload: source ~/.zshrc
```

**Windows:**
1. Download from [oracle.com/java](https://www.oracle.com/java/technologies/downloads/#java17)
2. Run installer
3. Add to `PATH`:
   - Open Environment Variables (Win+X → System → Advanced → Environment Variables)
   - Add `C:\Program Files\Java\jdk-17\bin` to `PATH`
4. Verify: `java -version`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
java -version
```

### Step 2: Install Android SDK

**Option A: Via Android Studio (recommended)**

1. Download [Android Studio](https://developer.android.com/studio)
2. Install and open it
3. Go to **Preferences** → **SDK Manager**
4. Install:
   - Android SDK Platform 34 (API 34)
   - Build-tools 34.0.0
   - Android NDK (optional, but good to have)
5. Copy the SDK path (shown in SDK Manager)

**Option B: Standalone SDK**

```bash
# macOS/Linux
cd ~
mkdir -p android-sdk
cd android-sdk

# Download command-line tools from:
# https://developer.android.com/studio#command-tools

# Extract and install
unzip cmdline-tools-*.zip
mv cmdline-tools latest
mkdir -p cmdline-tools && mv latest cmdline-tools/

# Add to PATH
export ANDROID_SDK_ROOT=~/android-sdk
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin
```

### Step 3: Set Environment Variables

**macOS/Linux:**

Add to `~/.zshrc` or `~/.bash_profile`:
```bash
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk  # macOS
# OR
export ANDROID_SDK_ROOT=$HOME/Android/Sdk          # Linux
export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools
export PATH=$PATH:$ANDROID_SDK_ROOT/emulator

# Reload
source ~/.zshrc
```

**Windows:**
1. Open Environment Variables
2. Add:
   - `ANDROID_SDK_ROOT` = `C:\Users\[YourUsername]\AppData\Local\Android\Sdk`
   - Add `%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin` to `PATH`
   - Add `%ANDROID_SDK_ROOT%\platform-tools` to `PATH`
3. Restart terminal/IDE

### Step 4: Verify Installation

```bash
java -version
# Output: openjdk version "17.0.x"

android --version
# Output: Android SDK Command-line Tools

adb --version
# Output: Android Debug Bridge version
```

---

## Build Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/martian-coder/TinyTools
cd TinyTools/Strenes
```

### Step 2: Install Dependencies

```bash
npm ci  # Install exact versions from package-lock.json
```

### Step 3: Build the Web App

```bash
npm run build
```

Expected output:
```
vite v8.0.16 building client environment for production...
✓ 1785 modules transformed
dist/registerSW.js                 0.13 kB
dist/assets/index-*.js            255 kB
✓ built in 300ms
```

### Step 4: Sync Capacitor

```bash
npx cap sync android
```

Expected output:
```
✔ Copying web assets from dist to android/app/src/main/assets/public
✔ Creating capacitor.config.json
✔ Copying Android plugin files
[info] Sync finished in 0.085s
```

### Step 5: Build the APK

**Debug APK (for testing):**
```bash
cd android
./gradlew assembleDebug
```

**Release APK (for Google Play/distribution):**
```bash
cd android
./gradlew assembleRelease
```

First build will:
1. Download Gradle (~200MB)
2. Download Android SDK tools (~1GB)
3. Compile and bundle the app

**Takes 5–10 minutes on first run. Subsequent builds: <2 minutes.**

### Step 6: Locate Your APK

**Debug:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Release (unsigned):**
```
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

**Size:** ~30MB (compressed, includes Gemini Nano model)

---

## Testing the APK

### Option A: On an Emulator

```bash
# Start the emulator via Android Studio, then:
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Launch the app
adb shell am start -n com.strenes.app/.MainActivity
```

### Option B: On a Physical Device

1. **Enable USB debugging on phone:**
   - Go to Settings → About → tap Build Number 7 times
   - Go to Settings → Developer Options → Enable USB Debugging

2. **Connect via USB:**
   ```bash
   adb devices
   # Output: Your device should list as "device"
   ```

3. **Install APK:**
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Launch:**
   - App appears in your app drawer
   - Tap to open

### Test Features

- ✅ Send a message → Tone analyzer runs
- ✅ Try abusive text → Civility filter blocks it
- ✅ Open Settings → All features appear
- ✅ Toggle Drunk Mode → UI responds
- ✅ Check network: Use Android Studio Profiler → Network tab
  - **Zero outbound API calls during message processing** ✅

---

## Signing for Google Play Store

### Step 1: Generate Keystore (First Time Only)

```bash
keytool -genkey -v -keystore strenes.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias strenes_key
```

You'll be prompted for:
- Keystore password: (save this securely)
- Key password: (can be same as keystore)
- Name, organization, country, etc.

**Output:** `strenes.keystore` file (keep this safe!)

### Step 2: Sign the APK

```bash
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore strenes.keystore \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  strenes_key
```

### Step 3: Verify Signature

```bash
jarsigner -verify -verbose \
  android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Expected output:
```
...verified OK
```

### Step 4: Align the APK (Final Step)

```bash
zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  strenes-release.apk
```

**Result:** `strenes-release.apk` is ready for Google Play!

---

## Upload to Google Play Store

### Step 1: Create Google Play Developer Account

- Go to [Google Play Console](https://play.google.com/console)
- Sign in with Google account
- Pay $25 one-time fee
- Create app listing

### Step 2: Create App Release

1. **In Google Play Console:**
   - Select your app
   - Go to **Release** → **Production**
   - Click **Create new release**

2. **Upload signed APK:**
   - Click **Browse files**
   - Select `strenes-release.apk`
   - Upload

3. **Fill in release notes:**
   ```
   Initial release of Strenes
   
   - On-device AI message filtering
   - Civility guard for abusive content
   - Smart inbox sorting
   - Tone analyzer for outgoing messages
   - Zero cloud, zero data collection
   - Download Gemini Nano model on first launch
   ```

4. **Set app details:**
   - **Category:** Productivity or Communication
   - **Rating:** Fill out questionnaire (you'll get an age rating)
   - **Pricing:** Free (with optional Pro in-app purchase)

5. **Review & submit:**
   - Google reviews for 1–3 hours
   - Get email when approved

### Step 3: Staged Rollout (Recommended)

1. **Start with 5% of users**
   - If bug reports appear, fix and roll back
   - Otherwise, increase: 5% → 25% → 50% → 100%

2. **Timeline:** 1 week per stage = full rollout in 4 weeks

---

## Troubleshooting

### Error: "Could not resolve com.android.tools.build:gradle"

**Cause:** Network issue or missing Google Maven repository.

**Fix:**
```bash
# Check internet connection first

# If network is fine, manually update Gradle:
cd android
./gradlew wrapper --gradle-version latest

# Then try building again
./gradlew assembleDebug
```

### Error: "ANDROID_SDK_ROOT not found"

**Cause:** Environment variable not set.

**Fix:**
```bash
# Find your SDK path
android_sdk_path=$(find ~ -type d -name "android-sdk" 2>/dev/null | head -1)
echo "export ANDROID_SDK_ROOT=$android_sdk_path" >> ~/.zshrc
source ~/.zshrc

# Or create local.properties in android/ directory:
echo "sdk.dir=/path/to/android/sdk" > android/local.properties
```

### Error: "command not found: keytool"

**Cause:** Java not in PATH or JDK not installed properly.

**Fix:**
```bash
# Verify Java is installed
java -version

# If not, reinstall JDK and add to PATH
# macOS: brew install openjdk@17
# Then reload shell: source ~/.zshrc
```

### APK File Too Large (>100MB)

**Cause:** Debug build includes all symbols.

**Solution:** Use release build:
```bash
./gradlew assembleRelease
```

Release build: ~30MB (optimized)

### App Crashes on Launch

**Cause:** Gemini Nano model download failed or missing permissions.

**Fix:**
1. Check internet connection
2. Ensure `android/app/src/AndroidManifest.xml` includes:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   ```
3. Rebuild and sync:
   ```bash
   npm run build && npx cap sync android
   ```

### "App Not Installed" Error

**Cause:** APK signature mismatch or incompatible Android version.

**Fix:**
```bash
# Uninstall old version first
adb uninstall com.strenes.app

# Clear cache
adb shell pm clear com.strenes.app

# Reinstall
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Performance Tips

### Faster Builds

1. **Use Gradle daemon** (enabled by default):
   ```bash
   # Confirm in gradle.properties
   grep "org.gradle.daemon" android/gradle.properties
   ```

2. **Parallel compilation:**
   ```bash
   echo "org.gradle.parallel=true" >> android/gradle.properties
   echo "org.gradle.workers.max=4" >> android/gradle.properties
   ```

3. **Incremental builds:**
   - Don't do `npm run build` every time
   - Only run `npx cap sync android` if web code changed
   - Then `./gradlew assembleDebug`

### Testing Without Rebuilding

If you only changed settings or styling:
```bash
# Just sync without rebuilding web:
npx cap copy android

# Then rebuild Android only:
cd android && ./gradlew assembleDebug
```

---

## What to Show VCs

1. **Install the APK on your phone**
   - Let them try sending abusive messages → blocked
   - Show Tone Analyzer warning
   - Demonstrate DND + Drunk Mode

2. **Open DevTools (Android Studio Profiler)**
   - Show **zero** outbound API calls during message processing
   - Prove: "Your message never leaves your phone"

3. **Export data**
   - Show they can delete everything locally
   - Point out: No cloud backup, no sync (by design)

4. **Show the code** (coming Q4 2025)
   - Open source; they can audit it
   - Or run static analysis: `npm run lint`

5. **Pitch narrative**
   - "First messaging filter to run entirely on-device"
   - "Gemini Nano powers the AI; zero cloud dependency"
   - "Privacy-first monetization: Pro features, not data sales"

---

## CI/CD Automation (GitHub Actions)

To automatically build APKs on every push:

1. **Generate keystore:**
   ```bash
   keytool -genkey -v -keystore strenes.keystore ...
   ```

2. **Encode for GitHub Secrets:**
   ```bash
   base64 strenes.keystore | pbcopy  # macOS
   base64 strenes.keystore | xclip   # Linux
   ```

3. **Add GitHub Secrets** (Settings → Secrets and variables):
   - `ANDROID_KEYSTORE_B64` = Base64 keystore
   - `ANDROID_KEYSTORE_PASSWORD` = Your password
   - `ANDROID_KEY_ALIAS` = `strenes_key`
   - `ANDROID_KEY_PASSWORD` = Your password

4. **Create `.github/workflows/android.yml`:**
   ```yaml
   name: Build Android APK
   on: [push]
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
         - run: echo "${{ secrets.ANDROID_KEYSTORE_B64 }}" | base64 -d > Strenes/strenes.keystore
         - run: cd Strenes && npm run build:android
         - uses: actions/upload-artifact@v3
           with:
             name: app-release.apk
             path: Strenes/android/app/build/outputs/apk/release/app-release.apk
   ```

Now every push builds the APK automatically!

---

## Next Steps

1. **Build locally** using this guide
2. **Test on your phone** and show VCs
3. **Upload to Google Play** when ready
4. **Gather feedback** from beta users
5. **Iterate** on features based on usage

---

**Need help?**
- Tweet: [@strenes](https://twitter.com/strenes) (coming Q3 2025)
- Issue: [GitHub Issues](https://github.com/martian-coder/TinyTools/issues)
- Email: security@strenes.dev

**Good luck! 🚀**
