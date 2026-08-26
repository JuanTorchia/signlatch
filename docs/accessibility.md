# Accessibility and responsive release requirements

SignLatch targets WCAG 2.2 AA for the review, approval, dispatch, and timeline surfaces.
Every state change uses a textual live region, every action has an accessible name,
disabled authority is explained in text, focus order follows document order, and no
meaning depends only on color. Exact digests wrap without horizontal scrolling.

Release gates cover keyboard activation, 320 CSS-pixel width, visible focus, semantic
headings, form labels, reduced motion, and readable error/invalidated/reapproval states.
The automated browser gate covers keyboard operation and 320-pixel overflow; screen
reader announcements and contrast remain named human checks in the release checklist.
