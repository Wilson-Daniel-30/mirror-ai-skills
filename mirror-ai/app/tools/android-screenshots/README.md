# Android screenshots, rendered through layoutlib

Renders the Flow Offers screen off-device and drops the frames where the report
reads them, so they appear in the **Android** column of section 4.

```bash
tools/android-screenshots/render.sh                  # uses repos/android
tools/android-screenshots/render.sh /path/to/repo    # or another checkout
```

Then re-run the audit (or just reload the report) and the frames appear above
the slot-by-slot view.

## This needs network on the first run

The `com.android.compose.screenshot` plugin is not in the Gradle cache, so the
first run downloads it. Everything else it needs is already on the machine.

If the plugin version has moved on, pin it:

```bash
COMPOSE_SCREENSHOT_VERSION=0.0.1-alpha16 tools/android-screenshots/render.sh
```

## What it does

1. Appends `android.experimental.enableScreenshotTest=true` to `gradle.properties`.
2. Applies `com.android.compose.screenshot` to `feature/feature-postpaid-line` and
   puts `ui-tooling` on the `screenshotTest` classpath.
3. Copies `FlowOffersScreenshots.kt` into `src/screenshotTest/kotlin/…/flowoffers/`.
4. Runs `:feature:feature-postpaid-line:updateJmDevDebugScreenshotTest`, which is
   what drives layoutlib.
5. Copies the PNGs into `generated reports/screenshots/flowoffers/android/`.
6. **Puts the checkout back exactly as it found it.** A dirty checkout changes the
   repository fingerprint, which would invalidate every saved report.

## Why there is a harness at all

The screen's own four previews are `private fun FlowOffersScreenPreview()` and
friends. Android Studio renders them because it invokes them reflectively through
`ComposeViewAdapter`; ordinary Kotlin in another source set cannot call a private
function. `FlowOffersScreen` itself is public, so the harness calls it directly
with the same four states, and rebuilds the two fixtures (`previewPostpaidAccount`,
`salesOfferMenuSampleLines`) which are private for the same reason.

The harness uses literal copy rather than `stringResource`, so a frame does not
change when remote strings do.

**Keep it in step with `FlowOffersScreen.kt`.** If a state is added to the real
previews, add it here, or the frames quietly stop representing the screen.

## Doing this for another screen

Copy the harness, point it at that screen's public composable, and rebuild
whatever fixtures its state needs. The build edits in `render.sh` are per-module,
so a screen in a different module needs its `module=` line changed.

## iOS

There is no equivalent. SwiftUI previews are rendered by Xcode running your code
in a simulator process, with no library to call and no command to dump an image.
The iOS column stays on the reconstruction until that side gets a built app plus
UI automation.
