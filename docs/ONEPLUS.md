# couch-tv on a OnePlus TV (Android TV 11, 2 GB RAM)

Notes from setting couch-tv up on a real OnePlus TV (model `Oneplus_Dosa_IN`, Android TV 11,
2 GB RAM, India), November 2026: option C (the phone remote runs on the TV, no computer stays on)
plus option A (the couch-tv home). It works, with three code changes on top of upstream and a
handful of TV settings. Everything here was tested on that TV; the one-shot script for a second TV
of the same model ([`tv-home/tools/oneplus-setup.sh`](../tv-home/tools/oneplus-setup.sh)) has not
yet been run on a second TV.

## The code changes (branch `oneplus-tv`)

1. **The OnePlus button on the remote opens OnePlus's own launcher**, not the Android home, so
   couch-tv never came back. `FireWatch.kt` and the manifest also watch
   `com.oneplus.tv.launcher/.LauncherPage` and bring couch-tv back over it.
2. **The phone remote did not start after a reboot.** OnePlus strips third-party boot receivers at
   boot ("remove receiver" in logcat). The home's FireWatch, which does start, sends an explicit
   broadcast to `dev.couchtv.ontv/.BootReceiver` when it connects. The remote is back about 65 s
   after a reboot.
3. **"Look" and Home settings changes did nothing.** `MainActivity.shouldOverrideUrlLoading`
   returned `true` for every address, which also blocked app.js `restart()` (a `location.replace`
   of its own page), so the old look stayed on screen. It now lets the page reload itself; every
   other address stays blocked. Tested both ways with remote keys: Home settings > Look and scenes >
   Classic shows the app grid, Night scenes shows the clock and dock.
4. **Memory limit on small TVs** (`on-tv/.../Adb.kt`): on a TV with less than 3 GB RAM, the phone
   remote runs `device_config put activity_manager max_cached_processes 16` each time it connects
   ADB. Android forgets `device_config` at every reboot, so it is set again each time; checked after
   a reboot (`CUR_MAX_CACHED_PROCESSES=16` in `dumpsys activity settings`).
   `settings put global activity_manager_constants` does nothing on this Android 11 build.

Also on this branch: a greeting ("Good evening, <name>") for the person picked, air quality (AQI)
and news lines on the Night look, with tests (`tests/aqi.test.mjs`).

Both APKs are local builds signed with the debug key, so the official release APKs cannot update
over them (signature mismatch). To go back to an official build: uninstall first, then re-pair each
phone and re-enter people, weather and country.

Builds (JDK 17+, Android SDK):

```sh
tv-home/android/gradlew -p tv-home/android --no-daemon -q clean assembleRelease -PconfigJson=$PWD/config.json
cp tv-home/android/app/build/outputs/apk/release/*.apk dist/couch-tv-home-oneplus.apk
GRADLE=$PWD/tv-home/android/gradlew bash on-tv/scripts/build.sh   # -> copy to dist/couch-tv-ontv-local.apk
```

## Why a 2 GB TV feels slow, and what helped

The slowness is memory, not CPU. With the stock apps it had about 100 MB free and 489 of 512 MB
swap in use. The load average of about 27 comes from MediaTek kernel threads; the CPU was about 90%
idle. What helped, in order of effect:

- **Restart once** after the clean-up: swap free went from about 20 MB to 353 MB.
- **Fewer cached apps** (the memory limit above).
- **Remove what is never used.** Built-in apps can only be hidden for the user, which is safe and
  undoable: `pm uninstall --user 0 <pkg>`, undo with `cmd package install-existing <pkg>`. Apps the
  user installed are removed for good with `pm uninstall <pkg>`.
- **Deep sleep for apps used now and then**, so they run only while open:
  ```sh
  cmd appops set <pkg> RUN_ANY_IN_BACKGROUND ignore
  cmd appops set <pkg> RUN_IN_BACKGROUND ignore
  am set-standby-bucket <pkg> rare
  am force-stop <pkg>
  ```
  Undo: the same appops with `allow`, and `am set-standby-bucket <pkg> active`. Keep the apps you
  open every day (YouTube, SmartTube) normal, or they start cold each time.
- **Play Store auto-update off** (Play Store > profile > Settings > Auto-update apps > Don't
  auto-update apps). Background updates were a regular memory spike. This has to be set on the TV.
- **Trim caches** (`pm trim-caches 999G`) freed about 1 GB of storage.

## Do not touch

- `com.oneplus.tv.launcher`: it is also what shows as **"Oxygen Play"**, so Oxygen Play cannot be
  removed. Never hide or disable a home screen or setup app: that can leave the TV unable to boot to
  a home.
- `com.heytap.mcs` and `com.oneplus.dlna` are persistent system processes; `oneplus.smarthome` runs
  as the system user. Hiding Smart Home with `--user 0` was fine; disabling is not.

## Other things this TV needed

- **The clock** had been set by hand to January 2024 with `auto_time=0`, which broke HTTPS
  (thumbnails, weather). `settings put global auto_time 1`.
- **Ad-blocking DNS** for the whole TV: `settings put global private_dns_mode hostname;
  settings put global private_dns_specifier dns.adguard-dns.com`.
- **SmartTube** (ad-free YouTube): the stable armeabi-v7a build from its GitHub releases.
- **Home settings saved on the TV override `config.json`.** The page keeps them in its storage
  (`tvhome.settings`) and in the app's own preferences, and
  `lookSetting() = settings.look || kept look || config look || "night"`. A "look" quick button
  switched it to Classic once by a stray press, so this setup keeps only the Input quick button
  (`"quick": ["input"]`).

## Looking inside the home page on the TV

The release home is not debuggable. To inspect it, install a debug build signed with the same key
(`assembleDebug`, `adb install -r` keeps its data), then:

```sh
adb forward tcp:9333 localabstract:webview_devtools_remote_$(adb shell pidof app.couchtv.launcher)
# Chrome DevTools Protocol on localhost:9333: Runtime.evaluate, Page.reload {ignoreCache:true}
```

Reinstall the release APK when done.

## A second TV of the same model

On the TV: Settings > Device Preferences > About > press Build 7 times, then Developer options >
USB debugging on. Build the two APKs above into `dist/`, put SmartTube in `dist/smarttube.apk`,
then:

```sh
TV_IP=192.168.1.x NAME=bedroom sh tv-home/tools/oneplus-setup.sh
```

It asks you to press Allow on the TV and to type the Phone code it shows. It writes what was there
before, and how to undo each change, to `tv-home/tvs/<NAME>.before-upgrades.txt` (not committed).
Two steps stay manual: Play Store auto-update off, and pairing each phone. If Aerial Dream is
installed first, it becomes the screensaver.
