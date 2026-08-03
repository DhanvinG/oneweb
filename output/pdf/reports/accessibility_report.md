# Technical PDF Accessibility Report — "Digital Accessibility in Practice"

**File:** `output/pdf/OneWeb_Digital_Accessibility_in_Practice_Full_Guide.pdf` (1.88 MB)
**Generated:** 2026-08-03 · Chrome 151 (Skia/PDF m151) via Playwright, tagged export · finalized with pypdf 6.14.2
**Validation:** `tmp/pdfs/validate_full_guide.py` — all assertions pass. Independent cross-check with Poppler `pdfinfo` 23.13.0.

## Document properties

| Property | Value | Verified by |
|---|---|---|
| Page count | 30 | pypdf assertion + pdfinfo |
| Page size | 612 × 792 pt (US Letter), every page, rotation 0 | pypdf assertion + pdfinfo |
| Language | `/Lang (en)` | pypdf assertion |
| Tagged | Yes (`/MarkInfo /Marked true`, `/StructTreeRoot` present, 1,501 structure elements) | pypdf assertion + pdfinfo "Tagged: yes" |
| Title | Digital Accessibility in Practice (exact-match asserted) | pypdf |
| Author / Creator | OneWeb Movement | pypdf assertion |
| Subject | A practical digital accessibility resource guide for businesses and organizations | pypdf assertion |
| Keywords | digital accessibility, WCAG, inclusive design, OneWeb, accessibility testing | pdfinfo |
| /DisplayDocTitle | true (screen readers announce the title, not the filename) | pypdf assertion |
| Encryption / JavaScript / forms | none | pdfinfo |

## Structure, headings, and reading order

- **Heading model:** one `h1` (cover title) + exactly one `h2` per page in the title band, with page-content headings at `h3`. Chrome derives both the structure tree and the bookmark outline from this hierarchy.
- **Bookmark outline:** 99 items (recursively counted; asserted ≥25) covering every page heading — usable navigation for a 30-page guide.
- **Reading order:** the structure tree follows source order. Pages are single-column stacks of blocks; within two-column blocks, reading order is left column then right column, matching visual order. Repeated page furniture: the footer is `aria-hidden` (artifact-like), the header brand image has empty alt with the adjacent text "OneWeb" carrying the name, and chapter labels are short text nodes.
- **Real semantics preserved:** genuine `<ol>`/`<ul>` lists, a real `<table>` with `<th>` headers in the page-20 structure demo, `<nav>` for the table of contents, `<figure>` for illustrations, `<kbd>` for key names, `<cite>` for the attributed quotation, `<dl>` glossary.

## Images and alternative text

6 `/Alt` entries in the structure tree (asserted ≥5):

| Page | Image | Treatment |
|---|---|---|
| 1 | Community illustration (cover) | Informative — describes the collaborative scene incl. wheelchair user and white-cane presenter |
| 7 | Everyday-access illustration | Informative — names all three depicted scenarios |
| 12 | Alt-text illustration | Informative — concise purpose description |
| 14 | Captions illustration | Informative — presenter, caption area, waveform |
| 16 | Keyboard-focus illustration | Informative — wheelchair user, wrist support, visible focus outline |
| 23 | Flyer mock (`role="img"` + `aria-label`) | Informative — the mock demonstrates flyer alt text |
| every page | Header logo | Decorative — `alt=""`, name carried by adjacent text |

No image is cropped or distorted: a build-time check fails on any `object-fit: cover/fill` aspect mismatch >2% and warns on heavy letterboxing. All figures declare their native aspect ratio.

## Links

- **16 link annotations** (asserted ≥16): 6 internal TOC links (page 2 → chapter openers), 1 in-page teaching link pair (page 21), 7 external `https://` URIs, CTA links.
- **External URLs verified live on 2026-08-03:** w3.org/WAI, WCAG 2 overview, WCAG 2.2 quick reference, W3C Easy Checks, ada.gov web guidance, wave.webaim.org — all HTTP 200. `oneweb.social` 308-redirected to `https://www.oneweb.social/`; the link was updated to the canonical URL (HTTP 200).
- Link text is descriptive ("W3C Web Accessibility Initiative (WAI)", never "click here" — except as the labeled *bad example* on page 21); visible print-friendly URLs accompany each resource on page 30 in ≥9.5px mono.

## Color and contrast (calculated, not estimated)

Every rendered text node is checked at build time: computed foreground color vs effective background (nearest opaque ancestor), WCAG relative-luminance ratio, thresholds 4.5:1 normal / 3:1 large (≥24px, or ≥18.66px bold). **Zero failures in the final build.** Key working pairs:

| Pair | Ratio | Use |
|---|---|---|
| black on blue #3083fd | 5.79:1 | body text on blue pages |
| black on lime #ccff00 / pale #dcecff / soft #f4f8f9 | 17.9 / 17.5 / 19.6 | all sizes |
| black on orange #ff5a00 | 6.71:1 | callouts, chips |
| black on red #ff0038 | 5.31:1 | critical tier, FAIL chips |
| #005bc6 (links/accents) on white / pale / soft | 6.34 / 5.28 / 5.93 | normal text |
| #9c3300 on white/soft | 7.27 / 6.80 | small orange-meaning labels |
| #424b55 on white/soft/pale | 8.86 / 8.29 / 7.38 | secondary text |
| white on black | 21:1 | dark pages/footers |

Banned combinations (orange-on-blue 1.16:1, lime-on-white 1.18:1, #3083fd small text on white 3.63:1) cannot ship — the contrast gate fails the build. Deliberately low-contrast *demonstrations* (the failing sample on page 10, the vague error on page 19) are `aria-hidden`, labeled with text chips, and their information is carried by visible passing text.

Color is never the sole carrier of meaning: before/after states, pass/fail marks, and priority tiers all pair color with text chips (BEFORE/AFTER, FAILS/PASSES, Fix now/Next/Soon/Schedule).

## Text and readability

- Extractable text on every page: minimum 271 characters (floor asserted at 120). `pdftotext` extraction succeeds document-wide.
- Body 13.5px/1.42 (~10.1pt); lead 15.5px; smallest meaningful text 9.5px (enforced by a build gate that scans computed sizes outside `aria-hidden` subtrees).
- POUR is expanded at first use; acronyms (WCAG, WAI, ADA, ASL) expand or are glossed; the quotation (Tim Berners-Lee) is genuinely attributed; no invented statistics.

## Automated vs. manual verification — honest scope

**Automated (every build):** page count/size, overflow and page-edge escapes, computed contrast per text node, font floor, duplicate IDs, image alt presence + crop/distortion + broken-asset detection, page-utilization advisory; validator: tagged state, structure tree, language, outline count, alt count, link/URI counts, per-page text floor, metadata, DisplayDocTitle.

**Manually inspected:** all 30 rendered pages at full size (layout, crops, wraps, balance, color rhythm); reading-order spot checks via extracted text; every external URL fetched.

**Not performed — recommended before any formal conformance claim:**
1. **Screen-reader testing** (NVDA/JAWS/VoiceOver) of the tagged output — Chrome's auto-tagging is good but generic (e.g., decorative layout containers are not authored as PDF artifacts beyond `aria-hidden`; no `/ActualText` entries).
2. **PDF/UA checking** (e.g., PAC 2024): the file is tagged PDF 1.3 without XMP metadata; full PDF/UA-1 conformance was not the target and is not claimed.
3. **Print proofing** for color-managed output — the palette is specified in sRGB hex; commercial CMYK printing would need a proofing pass.
4. **Evaluation with disabled readers** — as the guide itself teaches (page 9), automated + manual review cannot replace lived experience.
