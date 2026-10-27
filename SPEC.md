# Unsubbed Listen: SPEC

**Unsubbed Listen is a free alternative to Speechify.** It reads your text and documents aloud in the browser and highlights each word as it goes. There's no account and no limit, and by default nothing leaves the device.

This spec describes *behavior only*. It was written from public pages and from watching the public website (see CLEANROOM.md). Builders work from this file alone.

## 0. KEEP vs CHANGE (anti-copy rules)
| KEEP: functional, same as users expect | CHANGE: expressive, our own |
|---|---|
| Paste text or open a document, press play, hear it read aloud | Our words: the transport is the **Deck**, the document list is the **Shelf**, the voice area is the **Voice** card |
| The word being spoken is highlighted and the view follows along | Our own marks: the current sentence gets a **warm sand tint**, and the current word gets a **thick pine-green underline**. Never a blue fill |
| Speed control | A **− 1.0× +** stepper inside the Deck, with words-per-minute shown. Not a dropdown or a face icon |
| Pick a voice | A plain **dropdown grouped by language**. No avatar grid, no celebrity faces, no gender or age filters |
| Play and pause, skip back and forward | The Deck sits at the **top** of the reader and stays visible while you scroll (theirs is a bottom bar) |
| A library of documents | The Shelf is a **right-hand column** next to the reader, not a separate page |
| Space bar plays and pauses | Plus our own keys: ← / → move one sentence, [ / ] change speed |
| Dark mode | Kit light/dark theme |
| Open common files | .txt, .md, .html, .docx, .epub, read **on the device** with no upload |
| — | Fonts: the system serif for reading, the kit sans for the interface. No web fonts |
| — | Extras they lack: free with no limits; **on-device voices by default** (text never leaves the device); works offline; click any sentence to start there; remembers your place in every document |

## 1. Screen layout
- Kit header (Open, Save, Settings, Support) and kit footer, unchanged.
- **Desktop (≥ 900px):** two columns.
  - **Left (wide):** the **Reader card**. At its top is the **Deck** (sticky inside the page, so it stays in view while the text scrolls). Below the Deck is the document text.
  - **Right (about 280px):** the **Shelf card** (document list) on top, the **Voice card** under it.
- **Mobile (< 900px):** the Deck sticks to the top of the screen (under the kit header), then the reader, then the Shelf, then the Voice card. No horizontal scroll at 375px.

## 2. The Deck (transport), left to right
1. **Back** button (`aria-label="Previous sentence"`): moves to the previous sentence. If it's playing, it keeps playing from there.
2. **Play/Pause** button: the biggest control. A rounded square in `--accent`. Its accessible name switches between "Play" and "Pause".
3. **Forward** button (`aria-label="Next sentence"`).
4. **Progress text:** "Sentence 4 of 32 · about 3 min left". Minutes left = remaining words ÷ (170 × speed), rounded up. With no text it says "Nothing to read yet".
5. **Speed stepper:** "−" button, value "1.0×", "+" button, and under it a small "≈ 170 words/min". The range is 0.5× to 3.0× in steps of 0.1. The value has `aria-live="polite"`.

When the end is reached, playback stops and the position goes back to sentence 1. The toast says "Finished. Press play to hear it again."

## 3. Reader
- **Reading view** (default when the document has text): paragraphs of text in the serif font at a comfortable reading width (about 68 characters). Each sentence is clickable (cursor pointer). **Clicking a sentence starts reading from that sentence.**
- The **current sentence** gets the sand tint (class), and the **current word** gets the green underline. The word mark uses the CSS Custom Highlight API (`CSS.highlights`, `::highlight(listen-word)`) so the text DOM is never rewritten. If the browser lacks that API, only the sentence tint shows.
- **Follow along** (on by default, Settings): the current sentence is kept in view (`scrollIntoView({block:'center', behavior:'smooth'})`, or `'auto'` with reduced motion).
- An **Edit** button (top-right of the reader, under the Deck) switches to a plain `<textarea>` for this document. **Done** switches back. Editing stops playback and resets the position to 0 if the text changed.
- **Empty document:** shows the textarea with the placeholder "Paste or type something to hear it read aloud…" and a line under it: "Or use Open to add a .txt, .docx, .epub, .md or .html file."
- Paragraphs are split on line breaks. Blank lines collapse.

## 4. Sentences (engine)
- Split on `.`, `!`, `?`, `…` (and any closing quotes or brackets after them) followed by whitespace or the end, and on line breaks.
- These do not end a sentence: Mr. Mrs. Ms. Dr. Prof. Sr. Jr. St. vs. etc. e.g. i.e. No. Fig. and single capital initials ("J. R. Smith").
- Any sentence longer than 220 characters is cut into pieces at the last `,`, `;`, `:` or `—` before 220, or else at the last space. (Some browsers stop speaking a long chunk partway through.)
- Each piece knows its start and end offset in the document text. Word boundary events (`charIndex`, plus `charLength` when the browser gives it, otherwise up to the next whitespace) map back to document offsets for the word mark.
- Empty or whitespace-only pieces are dropped.

## 5. Speaking
- Use `speechSynthesis` with one `SpeechSynthesisUtterance` per sentence piece. When one ends, start the next.
- **Pause** = `speechSynthesis.cancel()` while keeping the sentence index. **Play** restarts that sentence from its beginning. (The browser's own pause is unreliable on several platforms.)
- Changing the voice or speed while playing restarts the current sentence with the new setting.
- A stale `onend` from a cancelled utterance must never advance the position (guard with a token or counter).
- Position (sentence index) is saved per document, so reopening a document continues where you left off.
- If `speechSynthesis` is missing, the Play button is disabled and the reader shows: "This browser can't read aloud. Try a recent Chrome, Edge, Safari or Firefox."

## 6. Voice card
- Heading "Voice".
- A `<select>` of voices, grouped with `<optgroup>` by language (the language name from `Intl.DisplayNames`, falling back to the code). Option text is the voice name. Voices load asynchronously, so listen for `voiceschanged`.
- Default voice: the saved one if it's still there, else the first on-device voice whose language matches `navigator.language`, else the first on-device voice.
- Checkbox **"Only voices that stay on this device"** (checked by default). Under it, a note:
  - checked: "Your text never leaves this device."
  - unchecked: "Online voices sound more natural, but your browser sends the text to its maker (Google, Microsoft or Apple) to speak it. Unsubbed never sees it."
  When unchecked, online voices (`localService === false`) appear with " · online" after their name.
- If no voices pass the filter: "No voices found. Your device may need a speech voice installed, or untick the box above."
- A **Try** button reads one short sentence in the chosen voice: "Hello. This is how I sound."

## 7. Shelf card
- Heading "Shelf" and a **New** button that adds an empty document called "Untitled" and opens it in edit mode.
- A list of documents, newest first. Each row shows the title (one line, ellipsis) and "N min · 40%" (total listening time at 1×, and the percent of sentences read). Clicking a row opens that document (and stops playback). The open one has `aria-current="true"`.
- Each row has a small **Remove** button (`aria-label="Remove <title>"`) with a `confirm()`: "Remove “<title>” from this device?"
- **Titles:** a file's name without its extension, or for pasted text the first line (up to 50 characters).
- If the shelf is ever empty, it creates one empty "Untitled" document.

## 8. Files
- **Open** accepts `.txt,.md,.html,.htm,.docx,.epub,.json`. Each file except .json adds a new document to the Shelf and opens it.
  - `.txt` / `.md`: as is (for Markdown, strip leading `#`, `>`, `-`/`*` list markers and `**`/`__`/backticks so they're not read aloud).
  - `.html` / `.htm`: `DOMParser`, then `body.innerText`-like text (block elements become line breaks). Scripts and styles are dropped. Nothing is rendered or executed.
  - `.docx`: a ZIP. Read `word/document.xml` and turn each `<w:p>` into a line, with the text from `<w:t>` (`<w:tab/>` becomes a space, `<w:br/>` a line break).
  - `.epub`: a ZIP. Read `META-INF/container.xml`, then the OPF file it points to, then the spine items in order, as XHTML through the same HTML-to-text step. Chapters are separated by a blank line.
  - ZIP reading uses only the browser: parse the central directory and inflate entries with `DecompressionStream('deflate-raw')` (method 8), or take them as is (method 0). No libraries.
  - `.json`: an Unsubbed Listen backup. Its documents are **added** to the Shelf (any whose `id` is already present are replaced). Settings in it are ignored.
  - Unknown or broken files: the kit toast "Couldn't open <name>. Is it the right kind of file?"
  - A file that yields no text: the toast "<name> has no text we can read." (for example a scanned image).
- **Save** downloads `listen-backup.json`: `{ app: 'unsubbed-listen', version: 1, docs: [...] }`.

## 9. Settings dialog (`#app-settings`)
- **Text size:** Small / Medium (default) / Large (reader font 1.0625 / 1.1875 / 1.375rem).
- **Follow along as it reads** checkbox (default on).

## 10. Storage and state
Kit storage (`localStorage`, key `unsubbed:listen`): `{ docs: [{id, title, text, pos, added}], current, voice, rate, localOnly, size, follow }`. Call `kit.store()` after every change. `localStorage` holds about 5 MB, which is plenty for articles but not for many whole books. The kit already shows an out-of-space toast.

## 11. First visit
The Shelf starts with one document called "Welcome to Listen", an original text written by us (about 120 words) that explains: press play or Space, click any sentence to start there, ← → to skip, [ ] for speed, open your own files, and that it's private. Its exact text is up to the builder, in plain friendly English.

## 12. Keyboard
These don't fire when focus is in a text field, select or button (for Space only), or when a dialog is open:
- **Space:** play/pause.
- **← / →:** previous/next sentence.
- **[ / ]:** speed −0.1 / +0.1.

## 13. Not in scope (v1)
Downloading the audio as an MP3 (browsers can't record their own speech voices), PDF and scanned pages (they need a large extra library or OCR; open question for Zabir), web links (no network), AI or cloned voices, skip-content rules, accounts or sync.

## 14. Acceptance checks
- Pasting 3 sentences and pressing Play reads them in order, with the sentence tint moving.
- "Dr. Smith arrived. He sat down." gives 2 sentences. A 600-character sentence gives at least 3 pieces, each ≤ 220 characters, and together they cover the original text.
- Clicking sentence 3 starts there. ← and → move one sentence. Space toggles.
- Pause then Play resumes the same sentence, not sentence 1.
- Speed + and − stay within 0.5–3.0. Changing speed while playing takes effect at once.
- The on-device checkbox hides online voices, and the note text changes.
- A .docx, an .epub, an .html and a .txt each open as new Shelf items with correct text and no markup.
- Save, then Clear data, then Open the backup brings the documents back.
- Reload keeps the documents, the current document, its position, voice, speed and settings.
- No network requests at all (CSP unchanged). Works offline after load.
- A 375px phone has no horizontal scroll, and the Deck stays visible while scrolling.
