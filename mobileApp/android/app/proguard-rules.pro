# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- Release shrinking (R8) keep-rules for libraries that rely on reflection ---
# react-native-blob-util (CV / photo uploads)
-keep class com.ReactNativeBlobUtil.** { *; }
-dontwarn com.ReactNativeBlobUtil.**
# react-native-svg (icons, logo shimmer)
-keep public class com.horcrux.svg.** { *; }
# react-native-webview (voice interview bridge)
-keep class com.reactnativecommunity.webview.** { *; }
# OkHttp / Okio used by networking libs
-dontwarn okhttp3.**
-dontwarn okio.**
