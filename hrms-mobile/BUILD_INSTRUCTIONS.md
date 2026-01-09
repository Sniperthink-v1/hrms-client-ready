# Android Build Instructions

## Prerequisites

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio
   - Install Android SDK, Android SDK Platform, and Android Virtual Device

2. **Set up Environment Variables**
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```

3. **Install Java Development Kit (JDK)**
   - JDK 17 or higher required
   - Check: `java -version`

4. **Install Node.js and npm**
   - Node.js 18+ recommended
   - Check: `node -version` and `npm -version`

---

## Method 1: Development Build (Local)

### Quick Start
```bash
cd hrms-mobile
npm install
npx expo prebuild --clean
npx expo run:android
```

### Step-by-Step

1. **Navigate to project directory**
   ```bash
   cd hrms-mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate native Android project**
   ```bash
   npx expo prebuild --clean
   ```
   This creates the `android/` folder with native code.

4. **Build and run on device/emulator**
   ```bash
   npx expo run:android
   ```
   - This will automatically:
     - Build the Android app
     - Install it on connected device/emulator
     - Start Metro bundler
     - Launch the app

### Alternative: Build APK only
```bash
cd android
./gradlew assembleDebug
```
APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Build Release APK
```bash
cd android
./gradlew assembleRelease
```
APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

**Note:** Release APK needs signing. See signing section below.

---

## Method 2: EAS Build (Production - Recommended)

EAS Build is Expo's cloud build service for production-ready apps.

### Setup

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure EAS**
   ```bash
   cd hrms-mobile
   eas build:configure
   ```

4. **Create `eas.json`** (if not exists)
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "android": {
           "gradleCommand": ":app:assembleDebug"
         }
       },
       "preview": {
         "distribution": "internal",
         "android": {
           "buildType": "apk"
         }
       },
       "production": {
         "android": {
           "buildType": "app-bundle"
         }
       }
     },
     "submit": {
       "production": {}
     }
   }
   ```

### Build Commands

**Development Build:**
```bash
eas build --platform android --profile development
```

**Preview Build (APK for testing):**
```bash
eas build --platform android --profile preview
```

**Production Build (AAB for Play Store):**
```bash
eas build --platform android --profile production
```

### Download Build
After build completes, download from:
- EAS dashboard: https://expo.dev
- Or use: `eas build:list` to see builds

---

## Method 3: Local Production Build with Signing

### Generate Keystore

1. **Create keystore file**
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore hrms-release-key.keystore -alias hrms-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Create `android/keystore.properties`**
   ```properties
   storePassword=your-store-password
   keyPassword=your-key-password
   keyAlias=hrms-key-alias
   storeFile=../hrms-release-key.keystore
   ```

3. **Update `android/app/build.gradle`**
   ```gradle
   def keystorePropertiesFile = rootProject.file("keystore.properties")
   def keystoreProperties = new Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       ...
       signingConfigs {
           release {
               if (keystorePropertiesFile.exists()) {
                   keyAlias keystoreProperties['keyAlias']
                   keyPassword keystoreProperties['keyPassword']
                   storeFile file(keystoreProperties['storeFile'])
                   storePassword keystoreProperties['storePassword']
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               ...
           }
       }
   }
   ```

4. **Build signed release**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

---

## Troubleshooting

### Issue: "SDK location not found"
**Solution:**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
# Or create local.properties in android/
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

### Issue: "Gradle build failed"
**Solution:**
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```

### Issue: "Metro bundler not starting"
**Solution:**
```bash
npx expo start --clear
```

### Issue: "Device not detected"
**Solution:**
```bash
# Check connected devices
adb devices

# If emulator not running
emulator -avd <avd_name>

# Enable USB debugging on physical device
```

### Issue: "Build takes too long"
**Solution:**
- Use EAS Build (cloud build is faster)
- Or increase Gradle memory: `android/gradle.properties`
  ```
  org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
  ```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npx expo run:android` | Build and run on device |
| `npx expo prebuild --clean` | Regenerate native code |
| `cd android && ./gradlew assembleDebug` | Build debug APK |
| `cd android && ./gradlew assembleRelease` | Build release APK |
| `eas build --platform android` | Cloud build (EAS) |
| `adb devices` | List connected devices |
| `adb install app.apk` | Install APK on device |

---

## Next Steps After Build

1. **Test the APK/AAB** on multiple devices
2. **Upload to Google Play Console** (for production)
3. **Set up app signing** in Play Console
4. **Configure app metadata** (screenshots, description, etc.)

---

## Package Information

- **Package Name:** `com.sniperthink.hrms`
- **App Name:** SniperThink HRMS
- **Version:** 1.0.0

---

For more details, see: https://docs.expo.dev/build/introduction/

