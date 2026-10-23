#!/bin/bash
# Renders Flow Offers through layoutlib and drops the frames where the report
# reads them. Applies its build edits, renders, then puts the checkout back as
# it found it — a dirty checkout would invalidate every saved report.
#
#   tools/android-screenshots/render.sh [path-to-android-repo]
#
# Needs network the first time: the screenshot plugin is not in the Gradle cache.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
project="$(cd "$here/../.." && pwd)"
repo="${1:-$project/repos/android}"
module="feature/feature-postpaid-line"
plugin_version="${COMPOSE_SCREENSHOT_VERSION:-0.0.1-alpha16}"
out="$project/generated reports/screenshots/flowoffers/android"

[ -d "$repo/$module" ] || { echo "No $module under $repo" >&2; exit 1; }

build="$repo/$module/build.gradle.kts"
props="$repo/gradle.properties"
harness_dir="$repo/$module/src/screenshotTest/kotlin/com/feature/postpaidline/flowoffers"
backup="$(mktemp -d)"
cp "$build" "$backup/build.gradle.kts"
cp "$props" "$backup/gradle.properties"

restore() {
  cp "$backup/build.gradle.kts" "$build"
  cp "$backup/gradle.properties" "$props"
  # updateScreenshotTest also writes a reference tree next to the sources.
  rm -rf "$repo/$module/src/screenshotTest" "$repo/$module"/src/screenshotTest*/ "$backup"
  echo "Checkout restored."
}
trap restore EXIT

echo "==> Applying the screenshot plugin"
printf '\nandroid.experimental.enableScreenshotTest=true\n' >> "$props"
python3 - "$build" "$plugin_version" <<'PY'
import sys, pathlib
build, version = pathlib.Path(sys.argv[1]), sys.argv[2]
text = build.read_text()
text = text.replace(
    'plugins {\n    id("superapp.android.feature")',
    f'plugins {{\n    id("superapp.android.feature")\n    id("com.android.compose.screenshot") version "{version}"',
    1,
)
# AGP 9 wants the flag on the module, not only in gradle.properties.
text = text.replace(
    "android {\n",
    'android {\n    experimentalProperties["android.experimental.enableScreenshotTest"] = true\n',
    1,
)
# The harness needs the preview annotation on the screenshotTest classpath.
# ui-tooling for @Preview; validation-api for @PreviewTest, which is what the
# plugin's JUnit engine actually discovers. Neither is added by the plugin.
text = text.rstrip().rstrip("}").rstrip() + (
    '\n    screenshotTestImplementation(libs.androidx.ui.tooling)'
    f'\n    screenshotTestImplementation("com.android.tools.screenshot:screenshot-validation-api:{version}")'
    '\n}\n'
)
build.write_text(text)
PY

echo "==> Adding the harness"
mkdir -p "$harness_dir"
cp "$here/FlowOffersScreenshots.kt" "$harness_dir/"

echo "==> Rendering (first run downloads the plugin)"
cd "$repo"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -f local.properties ] || echo "sdk.dir=$ANDROID_HOME" > local.properties
# updateDebugScreenshotTest writes the reference images; validate… compares them.
./gradlew ":${module//\//:}:updateJmDevDebugScreenshotTest" --console=plain

echo "==> Collecting frames"
mkdir -p "$out"
found=0
# The plugin writes renders under build/outputs, named
# <method>_<preview name>_<hash>_0.png. Keep the preview name as the caption.
while IFS= read -r png; do
  base="$(basename "$png" .png)"
  name="$(printf '%s' "$base" | sed -E 's/^[a-zA-Z]+_//; s/_[0-9a-f]{8}_[0-9]+$//')"
  cp "$png" "$out/${name:-$base}.png"
  found=$((found + 1))
done < <(find "$repo/$module/build/outputs/screenshotTest-results" -name "*.png" 2>/dev/null)

if [ "$found" -eq 0 ]; then
  echo "No frames were produced — check the Gradle output above." >&2
  exit 1
fi
echo "==> $found frame(s) in: $out"
ls -la "$out"
