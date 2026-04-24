# Zonga Mobile QA Checklist (Pilot)

## Devices and Browsers

- iPhone Safari (latest + previous major)
- Android Chrome (latest + previous major)
- Low-end Android profile (throttled CPU/network)
- Tablet portrait and landscape

## Playback

- Sticky player controls remain reachable in portrait mode.
- Tap targets are >= 44px in critical controls.
- Play/pause/seek works after app background/foreground transitions.
- Volume and playback position persist after refresh.
- Network drop shows clear error and recovers with retry.

## Upload and Creator UX

- Label Upload Console forms are readable without zoom.
- Drag/drop and file picker are usable on mobile browsers.
- Missing field warnings are visible before ingest.
- Rights declaration checkbox is prominent and required.

## Navigation and Readability

- Sidebar/mobile nav does not block key content.
- Typography remains legible on 360px width.
- Important CTAs (Apply, Upload, Export) are thumb-friendly.
- No horizontal scroll on dashboard and marketing pilot pages.

## Sharing and Cultural Surfaces

- WhatsApp share opens with populated text/link.
- Instagram and TikTok links open as expected.
- Artist story and event tie-ins render in portrait-first layout.

## Performance

- First meaningful paint under constrained mobile network is acceptable for pilot demos.
- No critical layout shifts on player and dashboard pages.
- Core actions complete without JS console errors on mobile.
