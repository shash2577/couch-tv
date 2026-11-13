#!/usr/bin/env bash
# Everything done to the living-room OnePlus TV (Android TV 11, 2 GB RAM), in one go, for another
# OnePlus TV of the same model. Run from the couch-tv folder:
#
#   TV_IP=192.168.1.x NAME=bedroom sh tv-home/tools/oneplus-setup.sh
#
# Before running, on the TV: Settings > Device Preferences > About > press Build 7 times, then
# Developer options > USB debugging ON. The TV asks "Allow USB debugging?" the first time: tick
# "Always allow" and press Allow.
#
# Needs, in dist/: couch-tv-home-oneplus.apk (home, patched for the OnePlus button and look switching),
# couch-tv-ontv-local.apk (phone remote, sets the memory limit at every start), smarttube.apk.
# How to build them, and what each step is for: docs/ONEPLUS.md
# Every change and its undo is written to tv-home/tvs/$NAME.before-upgrades.txt.
set -eu
: "${TV_IP:?set TV_IP to the TV address}"
NAME="${NAME:-second-tv}"
cd "$(dirname "$0")/../.."
PY=.venv/bin/python
export TV_IP
sh_() { "$PY" tv-home/tools/tvadb.py shell "$1"; }
LOG="tv-home/tvs/$NAME.before-upgrades.txt"
ask() { printf '\n>>> %s\n    Press Enter when done. ' "$1"; read -r _; }

echo "== 0. Reach the TV and note what is there now"
sh_ "getprop ro.product.model; getprop ro.build.version.release" || { echo "Cannot reach $TV_IP:5555 (USB debugging on? Allowed?)"; exit 1; }
{
  echo "# $NAME ($TV_IP) before oneplus-setup.sh, $(date)"
  sh_ "echo private_dns_mode=\$(settings get global private_dns_mode) private_dns_specifier=\$(settings get global private_dns_specifier) auto_time=\$(settings get global auto_time)"
  sh_ "echo screensaver_components=\$(settings get secure screensaver_components)"
  sh_ "pm list packages -3"
} > "$LOG"

echo "== 1. Phone remote app (on the TV, no computer needed)"
"$PY" tv-home/tools/tvadb.py install dist/couch-tv-ontv-local.apk
sh_ "am broadcast -n dev.couchtv.ontv/.BootReceiver >/dev/null; sleep 2; am start -n dev.couchtv.ontv/.SetupActivity" >/dev/null
sleep 6
sh_ "input keyevent 23" >/dev/null   # Connect ADB (the focused button)
ask "On the TV: tick 'Always allow from this computer', then press ALLOW."

echo "== 2. couch-tv home (Night look, OnePlus button watch)"
APK=dist/couch-tv-home-oneplus.apk sh tv-home/tools/apply.sh

echo "== 3. Household settings in the phone remote (names, weather, country)"
rtk_curl() { if command -v rtk >/dev/null; then rtk proxy curl "$@"; else curl "$@"; fi; }
rtk_curl -s -m 8 -X POST "http://$TV_IP:5400/api/pair/start" >/dev/null
printf '\n>>> Type the 6-digit "Phone code" shown on the TV: '; read -r PIN
TOK=$(rtk_curl -s -m 8 -X POST -H 'content-type: application/json' -d "{\"pin\":\"$PIN\",\"name\":\"Mac setup\"}" "http://$TV_IP:5400/api/pair" | "$PY" -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
[ -n "$TOK" ] || { echo "That code was refused. Re-run this step from the setup page instead: http://$TV_IP:5400/setup"; exit 1; }
BODY=$("$PY" -c "import json;c=json.load(open('config.json'));print(json.dumps({'people':[{'id':p['id'],'name':p['name']} for p in c['people']],'weather':c['weather'],'country':c.get('country','IN')}))")
rtk_curl -s -m 8 -X POST -H "authorization: Bearer $TOK" -H 'content-type: application/json' -d "$BODY" "http://$TV_IP:5400/api/settings" >/dev/null && echo "   saved"

echo "== 4. SmartTube (ad-free YouTube), ad-block DNS, clock, aerial screensaver"
"$PY" tv-home/tools/tvadb.py install dist/smarttube.apk
sh_ "settings put global private_dns_mode hostname; settings put global private_dns_specifier dns.adguard-dns.com; settings put global auto_time 1"
sh_ "pm list packages com.codingbuffalo.aerialdream | grep -q . && settings put secure screensaver_components com.codingbuffalo.aerialdream/com.codingbuffalo.aerialdream.AerialDream && settings put secure screensaver_enabled 1 || echo '   Aerial Dream not installed: skipped'"

echo "== 5. Remove clutter (built-in ones only hidden: cmd package install-existing <pkg> brings them back)"
for p in com.eros.now com.oneplus.tv.userguide com.jio.media.stb.ondemand oneplus.smarthome com.heytap.tv.camera; do
  sh_ "pm list packages $p | grep -qx package:$p && pm uninstall --user 0 $p >/dev/null && echo '   hidden $p' || true"
done
for p in com.viacom18.tv.voot com.dsi.ant.service.socket com.dsi.ant.plugins.antplus com.jiostb.jiogames org.mozilla.tv.firefox com.amteam.amplayer; do
  sh_ "pm list packages -3 $p | grep -qx package:$p && pm uninstall $p >/dev/null && echo '   removed $p' || true"
done

echo "== 6. Deep sleep: these apps run only while open (YouTube, SmartTube, Castle stay normal)"
for p in com.nvidia.geforcenow com.retroarch tv.airtel.xstream.tvapp com.sonyliv in.startv.hotstar com.mxtech.videoplayer.ad com.graymatrix.did com.yablio.sendfilestotv com.stremio.one; do
  sh_ "pm list packages $p | grep -qx package:$p && { cmd appops set $p RUN_ANY_IN_BACKGROUND ignore; cmd appops set $p RUN_IN_BACKGROUND ignore; am set-standby-bucket $p rare; am force-stop $p; echo '   asleep $p'; } || true"
done

cat >> "$LOG" <<EOF

# Applied by oneplus-setup.sh. Undo (adb shell):
#   DNS: settings put global private_dns_mode off; settings delete global private_dns_specifier
#   Hidden built-ins: cmd package install-existing <pkg>
#   Deep sleep: cmd appops set <pkg> RUN_ANY_IN_BACKGROUND allow; cmd appops set <pkg> RUN_IN_BACKGROUND allow; am set-standby-bucket <pkg> active
#   Memory limit: uninstall dev.couchtv.ontv (it re-applies max_cached_processes=16 at each start)
#   Home: docs/UNINSTALL.md
EOF

echo "== 7. Restart"
sh_ "reboot" || true
cat <<EOF

Done. Two things only a person can do:
  1. Play Store > profile icon > Settings > Auto-update apps > Don't auto-update apps.
  2. Each phone: open http://$TV_IP:5400 and type the Phone code shown in the Couch TV app.
Log and undo: $LOG
EOF
