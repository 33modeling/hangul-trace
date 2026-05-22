# Hangul Trace Flow, Feature, and Design Audit

Date: 2026-05-22

## Purpose

This document is the working checklist for verifying the full app flow, source design, UI movement, button behavior, bug fixes, and design improvements. Update the "Fix Log" section whenever a code change is made from this audit.

## Source Design

- `index.html`: single-page app shell. It contains the intro screen, main menu, all mode panels, toolbars, navigation buttons, canvases, and script loading order.
- `index.js`: app-level routing and event delegation. It shows one mode at a time, returns to the main menu, handles delegated previous/next navigation, initializes the intro screen, and registers the service worker on HTTP/HTTPS.
- `shared/core.js`: shared canvas rendering and pointer/touch/mouse drawing helpers. It owns canvas sizing, guide drawing, row guide drawing, stroke tracking, and stroke-order overlay rendering.
- `shared/navigation.js`: index-based navigation for simple item lists. It tracks current item, completed items, stroke count, dots, and stroke hint pills.
- `shared/common.js`: character and word data shared by modes.
- `shared/strokeOrder.js`: stroke-order metadata and animation helpers.
- `shared/utils.js`: localStorage and character validation helpers.
- `shared/myWords.js`: persistent custom word storage.
- `shared/sound.js`: background music and effect sound controls.
- `shared/styles.css`: app layout, mobile viewport handling, menu, mode, toolbar, canvas, and responsive styling.
- `modes/*/modes.js`: feature-specific mode controllers. Each mode wires its own canvases, labels, clear actions, feedback, and resize behavior.
- `tests/e2e/*.spec.js`: Playwright coverage for menu flow, mobile layout, drawing, navigation, touch behavior, responsive behavior, and known core regressions.

## Feature List

- Intro screen with version display from `VERSION`.
- Main menu mode selection.
- Background music and effect sound toggles.
- Hangul consonant/vowel tracing mode.
- Basic Hangul word tracing mode.
- Advanced Hangul word tracing mode.
- Custom word practice mode.
- Custom word add/edit/reorder/delete mode.
- Number tracing mode.
- English uppercase/lowercase tracing mode.
- Previous/next navigation buttons in tracing modes.
- Dot navigation for list-based modes.
- Clear drawing button in tracing modes.
- Stroke-order view where supported.
- Feedback and completion state based on stroke count.
- Responsive portrait and landscape mobile layout.
- PWA manifest, icons, and service worker registration.
- Secret mode entered from the hidden menu trigger.

## Full Flow Checklist

- App starts at intro, dismisses by touch/click/keyboard, and reveals the menu.
- Every visible mode card opens the correct mode panel.
- Back/menu buttons return from every mode to the main menu.
- Previous/next buttons move to the expected item and wrap correctly.
- Dot buttons jump to the selected item in list modes.
- Drawing works with mouse, pointer, and touch.
- Drawing continues if the pointer leaves the canvas before release.
- Clear buttons reset the drawing layer and feedback state.
- Stroke-order buttons draw visible overlay guidance and do not break normal tracing.
- English uppercase/lowercase toggle changes the character set and label.
- Custom words can be added, validated, displayed, reordered, deleted, and practiced.
- Empty custom word state routes to the add screen.
- Portrait and landscape layouts keep controls and canvases inside the viewport.
- Buttons meet touch target requirements on mobile.
- Console/page errors stay empty during normal flows.

## Design Audit Checklist

- Main menu shows all available features without hidden overflow on small phones.
- Mode cards use consistent visual weight, spacing, and accessible button semantics.
- Toolbars keep primary navigation and destructive/secondary actions visually distinct.
- Previous/next buttons remain fixed-size and easy to tap.
- Canvas area is stable during resize and orientation change.
- Text labels do not overlap buttons or canvases.
- Long Korean labels and custom words fit without breaking the layout.
- Color palette provides enough contrast while keeping a child-friendly tone.
- Button movement and mode transitions do not leave stale event handlers or stale timers.

## Known Audit Findings

- The mobile UI test expected six mode cards, but the current product exposes seven visible cards including advanced mode. The test should match the product feature list.
- Manual and automated checks still need to cover the advanced mode back button, canvas visibility, and navigation in the same way as other tracing modes.
- Design pass should reduce menu crowding risk on small screens and improve consistency around menu card count/spacing.

## Fix Log

- 2026-05-22: Created this audit document before code fixes, as the source of truth for the following verification and bug-fix pass.
