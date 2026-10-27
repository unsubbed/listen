# Unsubbed Listen: clean-room log

The incumbent is Speechify (Cliff Weitzman / Speechify Inc.). Unsubbed Listen is described only as "a free alternative to Speechify".

## Sources used for SPEC.md
| Date | Source | How | What we took |
|---|---|---|---|
| 2026-10-26 | https://speechify.com/ (public homepage) | REA `capture_browser_scenario`: load page, accessibility tree, screenshot | Feature list only: natural voices, text highlighting while listening, speed control, "listen to anything" (books, PDFs, docs), offline listening is a paid extra, supported formats (PDF, EPUB, DOCX, TXT, links, scans) |
| 2026-10-26 | https://speechify.com/text-to-speech-online/ (public free demo) | REA scenario: load, Page Down, screenshots | Layout of the public demo: voice picker panel with filters on the left, text box on the right, Play and Download buttons along the bottom, speed dropdown at the top. Used to make our layout *different* |
| 2026-10-26 | https://oae.stanford.edu/resources/speechify-tips-tricks (public university help page) | Fetched text | Web app has a left-side toolbar with Speed (and auto speed-up), plus More > Skip Content, Dark mode and Auto-scroll |
| 2026-10-26 | https://speechify.com/blog/how-can-i-play-pause-my-file-while-listening-on-the-computer/ (search snippet only) | Web search | Space bar plays and pauses |
| — | Web Speech API (W3C / MDN, public standard) | General knowledge | `speechSynthesis`, voices, rate, word boundary events |
| — | ZIP, DOCX (ECMA-376) and EPUB (W3C) public formats | General knowledge | How to read text out of .docx and .epub files |

## What we did NOT do
- No decompiling, unminifying, source-map recovery, script-source capture or binary tools on any Speechify software. REA `include_script_sources` was never turned on, and no DOM dump was taken.
- No desktop app, mobile app or Chrome extension installed. No EULA accepted, no account created, no login. The logged-in web app (app.speechify.com) was never opened.
- No Speechify text, voices, voice names, sample texts, colors, logo, fonts, icons or celebrity voice imagery copied. Our sample text, labels and palette are written fresh.

## Raw captures
Raw REA output and screenshots stay in `.rea-private/`. That folder is git-ignored, never given to the builder and never published.
