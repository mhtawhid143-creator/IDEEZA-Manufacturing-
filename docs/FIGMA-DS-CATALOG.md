# IDEEZA — Design System · Component Catalog

- **Source file:** https://www.figma.com/design/V3uizmZLHo5Xhy65Dp3F0O/
- **Library:** IDEEZA — Design System (`lk-a66de2…b6bac`)
- **Catalogued:** 2026-08-31 via Figma MCP `search_design_system` sweeps
- **Totals:** 177 unique components/component sets — 33 Atoms · 111 Molecules · 33 Organisms

Variant counts come from the component descriptions where stated; a count in parentheses is derived from the axes the description lists; "—" means the description does not state one.

---

## Atoms · Actions

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| A01 Button | 480 | Core button: 8 hierarchies (incl. Tonal, Outline brand, Inverse, AI gradient) × 2 types × 5 sizes × 6 states, flat fills with token-bound radii. |
| A02 Icon Button | (80: 4×5×4) | Icon-only button for compact actions like close, edit, delete, more. |
| A03 Link | 48 | Text link in 3 sizes × 4 colours × 4 states with overridable label and 2px focus ring. |
| A15 Button Group | (12: 4×3) | Segmented button group of 2–5 segments × MD/LG/XL with token-bound radius and click-toggled Selected state. |
| A28 Inline CTA | — | Inline call-to-action element (no description). |

## Atoms · Input

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| Text Input (a.k.a. A04) | (200: 8×5×5) | Text field in 8 types (incl. Country Select) × 5 sizes × 5 states on the unified field size ramp. |
| Textarea (a.k.a. A05) | (15: 3×5) | Multi-line text area with 3 row heights × 5 states, optional label icon and resize affordance. |
| A06 Select | 30 | Select with built-in label, helper text, asterisk, and label icon — atomic parity with Text Input. |
| A07 Search | 25 | Search input with built-in label, helper text, and leading/trailing icon swap. |
| A08 Selection Control | — | Unified Checkbox + Radio at SM (20×20) and MD (24×24), built on _Checkbox base and _Radio base. |
| A10 Toggle | — | Toggle/switch in SM (36×20) and MD (44×24) with optional label and supporting text. |
| A11 Slider | — | Single-value range slider in SM/MD/LG with Default/Hover/Focus/Disabled states and preset value stops. |
| A12 Number Input | — | Numeric input with plus-minus or arrow steppers, 5 sizes, and optional prefix/suffix text. |
| A13 Color Picker | 25 | Color-picker field with built-in label, helper text, asterisk, and label icon — atomic parity with Text Input. |
| A14 Multi-select | 125 | Multi-select field with built-in label and helper text whose Tags variant controls displayed tag count. |

## Atoms · Data Display

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| A16 Avatar | (72: 3×6×4) | Avatar as Image/Initials/Icon × 6 sizes × 4 states with optional Online/Offline/Verified status dot. |
| A16b Avatar Label Group | 4 | Avatar with name plus optional email/subtitle in 4 sizes matching Avatar. |
| A16c Avatar Group | 12 | Stacked overlapping avatar group (4 sizes × 3/4/5 visible) with +N chip and add-more booleans. |
| A17 Badge | 432 | Compact label for status, categories, counts, and metadata: 3 styles × 6 colors × 3 sizes × 8 icon types. |
| A18 Tag | 48 | Interactive chip for filters, dismissible inputs, and assist actions (3 sizes × 4 states × 4 leading types). |
| A26 Dot | — | Small status/indicator dot (no description). |
| A29 Brand Icon | — | Brand mark/logo icon set (no description). |
| A30 Delta Chip | — | Up/down/flat change chip beside a metric, in Subtle, Filled, and Text styles on chart/delta tokens. |
| Icon (F06 Icon Base) | — | Size (12–32) × semantic-color wrapper for library glyphs, with a ★ placeholder default glyph. |

## Atoms · Feedback & Progress

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| A19 Tooltip | — | Tooltip bubble (no description). |
| A19b Tooltip Trigger | — | Tooltip trigger element (no description). |
| A20 Spinner | — | Loading spinner (no description). |
| A21 Skeleton | — | Skeleton placeholder shape (no description). |
| A22 Progress Bar | — | Responsive progress bar with layoutGrow-weighted fill so percentage stays accurate at any width. |
| A23 Progress Ring | — | Circular progress ring (no description). |

## Atoms · Layout & Text

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| A24 Divider | 43 | Horizontal or vertical separator with optional content (heading, text, button, button group) in 3 alignments. |
| A25 KBD | — | Keyboard-key cap element (no description). |
| A27 Code | — | Inline code element (no description). |

---

## Molecules · Feedback

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M01 Alert | 8 | Inline alert/banner with icon + title + actions. |
| M02 Toast | 9 | Transient notification (top/bottom positioning). |
| M03 Banner | 5 | Page-level full-width announcement strip with severity styling. |
| M04 Snackbar | 4 | Bottom-anchored mobile-first snackbar with severity-tinted icon badge. |
| M05 Inline Message | 5 | Small inline form-context message (icon + text) living in the form-field helper slot. |
| M06 Status Block | 4 | Page-level status indicator with colored dot + label + optional sub-text. |

## Molecules · Overlay

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M07 Modal | 1 | Centered dialog with header, content, and actions. |
| M08 Drawer | 2 | Side-anchored panel using _Modal header (Left) + _Modal actions (Horizontal). |
| M09 Bottom Sheet | 1 | Mobile bottom-anchored sheet with drag handle, header, content slot, and stacked actions. |
| M10 Popover | 4 | Anchored floating popover with title, body, actions instance, and directional arrow. |
| M11 Confirm Dialog | 4 | Centered confirm dialog whose Severity controls icon and destructive actions. |
| M12 Action Sheet | 2 | Mobile bottom-anchored action menu with drag handle, cancel button, and destructive tinting. |
| M13 Lightbox | 2 | Image/media viewer overlay with dark backdrop, counter, close, nav arrows, and optional caption. |

## Molecules · Navigation

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M14 Tabs | 8 | Tab group in Fill / Line / Toggle styles. |
| M15 Header | 2 | Production navigation header in Marketing (logo + nav + CTAs) and App (search, wallet, notifications, avatar) variants. |
| M16 Sidebar Item | 8 | Sidebar nav row with icon + label + badge + chevron. |
| M17 Bottom Nav | 2 | Mobile bottom tab bar with icon + label per tab (4 or 5 tabs). |
| M18 Dropdown Menu | 4 | Dropdown menu item with badge + KBD shortcut hint. |
| M19 Breadcrumb | 1 | Path breadcrumb trail. |
| M20 Pagination | 2 | Page navigator with prev/next + page numbers. |

## Molecules · Data Display

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M21 Card | 1 | Generic content card. |
| M22 Pricing Card | 2 | Pricing tier card with features and CTA. |
| M23 Card Image | 1 | Image-led card with overlay content. |
| M24 Stat Card | — | Stat card (SM/MD/LG) with A30 delta pill, optional M114 sparkline, icon badge, kebab, and period booleans (also covers Balance Card). |
| M25 Asset Card | 12 | Web3 NFT marketplace asset card (Auction / Auction Timer / Buy Now / User × 3 states), fully property-driven. |
| M26 List Item | 4 | List row with avatar + label + meta. |
| M65 Tag List | 2 | Horizontal collection of A18 Tag instances with Wrap and Truncate (+N overflow) variants. |

## Molecules · Form

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M27 Form Field | 9 | Label + input + helper + error wrapper. |
| M28 Form Row | 2 | Multi-column form row hosting M27 Form Field instances (2 or 3 cells). |
| M29 Form Section | 2 | Form section with header column on the left and a content slot on the right (Stripe/Linear settings layout). |
| M30 Search Bar | 2 | Search bar in Inline (44px, KBD hint, filter chips) and Hero (56px, Search button) styles. |
| M31 Filter Bar | 1 | Filter bar with filter button, active chips, clear-all link, results count, and sort dropdown. |
| M32 Toolbar | 2 | Action toolbar with grouped icon buttons, dividers, and overflow menu (Floating or Inline). |
| M33 Stepper | 3 | Multi-step progress indicator (Horizontal Numbered, Horizontal Dotted, Vertical Numbered). |
| M38 OTP Input | 1 | One-time-passcode segmented input. |
| M39 Checkbox Group | 9 | Vertical/horizontal checkbox set. |
| M40 Radio Group | 9 | Vertical/horizontal radio set. |
| M41 File Upload | 1 | File dropzone with progress + file list. |
| M42 Image Upload | 6 | Image-specific upload with preview. |
| M43 Card Payment Form | 1 | Card-number + CVV + expiry composite form group (no surface chrome of its own). |

## Molecules · Pickers

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M34 Date Picker Menu | 2 | Date picker menu pane (calendar grid + presets). |
| M34a Date Picker Dropdown | 6 | Date picker dropdown wrapper (input + popover menu). |
| M34b Date Picker Modal | 2 | Date picker modal (full-screen overlay). |
| M35 Time Picker | — | Time picker in Numeric (HH/MM steppers + AM/PM) and Drum (iOS scroll wheel) modes. |
| M37 Color Picker | — | Photoshop/Figma-style color picker with SV gradient, hue/alpha sliders, eyedropper, HEX/RGBA inputs, and swatches. |

## Molecules · IDEEZA

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M44 IDEEZA Marketplace | 1 | Top-level marketplace card. |
| M45 IDEEZA Marketplace Details | 3 | Listing details (Main / Physical / Virtual variants). |
| M46 IDEEZA Item Details | 3 | Tabs panel (Details / Legal / Activities). |
| M47 IDEEZA Buying Radio | 1 | Purchase option selector with badges. |

## Molecules · States

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M48 Empty State | 1 | "Nothing here yet" — centered icon badge + title + description + action button(s). |
| M49 Error State | 1 | "Something went wrong" — centered icon badge + title + description + action button(s). |
| M50 Loading | — | Loading indicator built on A20 Spinner in Page, Inline, and Compact layouts. |
| M51 Skeleton | — | Skeleton placeholder layouts (Card, List Item, Article, Chart) assembled from A21 instances. |
| M52 Success State | 1 | "All set!" — centered icon badge + title + description + action button(s). |
| M53 No Results | 1 | "No results found" — centered icon badge + title + description + action button(s). |
| M54 Permission Denied | 1 | "Access denied" — centered icon badge + title + description + action button(s). |
| M55 No Connection | 1 | "You're offline" — centered icon badge + title + description + action button(s). |
| M56 Maintenance | 1 | "Under maintenance" — centered icon badge + title + description + action button(s). |
| M57 Not Found | 1 | "Page not found" — centered icon badge + title + description + action button(s). |
| M58 Coming Soon | 1 | "Coming soon" — centered icon badge + title + description + action button(s). |
| M59 Server Error | 1 | "Server error" — centered icon badge + title + description + action button(s). |

## Molecules · Data Display Ext (Tables, Trees, Comments)

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M60 Table Header | — | Table header row (no description). |
| M61 Table Row | 1 | Table row (single component, currently without properties/states). |
| M62 Table Cell | 144 | Table cell with 36 content styles × 2 states × supporting-text boolean, fully property-driven. |
| M64 Pagination Bar | 1 | Pagination bar: results count + rows-per-page select + prev/page-indicator/next. |
| M66 Rating Stars | 5 | 5-star rating display with gold filled stars and trailing rating value + count. |
| M68 Tree Node | 3 | Tree browser node with chevron + type icon + label + meta (Folder Expanded/Collapsed, File). |
| M69 Comment | 1 | Comment thread item with avatar + header (author • timestamp) + body + Reply/Like actions. |
| M100 Comments | 2 | The whole comments block — count header with sort, composer, and threaded list — placed as one component (Populated / Empty). |

## Molecules · Media

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M70 Image Gallery | 2 | Image gallery in Grid (primary + 2×2 thumbnails with +N) and Carousel layouts. |
| M71 Video Player | 2 | 16:9 video player with Paused/Playing states and a bottom controls scrim. |
| M72 Audio Player | 2 | Audio player in Compact and Full (album art) layouts with waveform and time. |
| M73 File Preview | 5 | File preview card with type icon badge (Image/Video/PDF/Document/Other), filename, meta, and actions. |
| M74 Image with Caption | 3 | Editorial image block with accent-bar caption and credit line in 16:9, 4:3, and Square ratios. |
| M75 Embed / Link Preview | 2 | URL preview card in Small horizontal and Large vertical layouts with favicon, domain, and title. |

## Molecules · Web3

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M76 Wallet Card | 2 | Wallet panel with Connected (balance + Send/Receive/Swap) and Disconnected (connect CTA) states. |
| M77 Tx Receipt | 1 | Transaction receipt panel with confirmed status, monospace amount, details rows, and Etherscan CTA. |
| M78 Address Chip | 2 | Truncated 0x wallet address chip with copy icon in SM/MD, set in Roboto Mono. |
| M79 Tx Status Badge | 4 | Transaction status pill (Submitted / Pending / Confirmed / Failed) with icon + label. |
| M80 Token Amount Input | 3 | Token amount input for swaps and buys with balance, MAX, token chip, and USD equivalent rows. |
| M81 Gas Selector | 3 | Gas fee tier selector (Slow / Normal / Fast) with monospace fees. |
| M82 Network Switcher | 3 | Network/chain switcher with logo, status dot, chain name, and Default/Connected/Wrong Network states. |
| M83 Mint Button | 5 | Stateful mint button (Idle / Connecting / Minting / Success / Disabled) wrapping A01. |
| M84 Auction Timer | 2 | HH:MM:SS auction countdown that switches to error tints when ending soon. |
| M85 Bid Modal | 1 | Auction bid modal with auction info pill, bid input, fee summary, and Cancel/Place bid actions. |

## Molecules · Marketing / Editorial ("Premium")

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M86 Testimonial Card | — | Premium testimonial with rating stars, verified badge, quote, and author block. |
| M87 Logo Cloud Item | — | Logo cloud cell: gradient brand mark + name + category. |
| M88 Feature Card | — | Premium feature card with gradient icon container, NEW badge, title, description, and Learn-more link. |
| M89 FAQ Item | — | Premium FAQ row with Q badge, question, rotating arrow toggle, and answer (collapsed/expanded). |
| M90 Newsletter Signup | — | Premium newsletter block with badge, title, email field + Subscribe button, and trust line. |
| M91 CTA Block | — | Premium dark CTA with limited-time pill, display headline, dual CTAs, and rating proof. |
| M92 Stats Block | — | Premium stat with overline label, display number, success badge, and mini bar sparkline. |
| M93 Social Proof | — | Premium pill combining an avatar group with mixed-weight proof copy on a gradient stroke. |
| M94 Author Bio | — | Premium author block with avatar, verified name + Follow button, role, bio, and social links. |
| M95 Article Card | — | Premium article card with gradient cover, badge, title, excerpt, and author/date row. |
| M96 Hero Variant Card | — | Premium multi-hero card with gradient visual, audience badge, title, sub, and CTA. |
| M97 Comparison Item | — | Premium comparison row with feature label and 3 plan columns of tick/cancel icons. |
| M98 Quote Block | — | Premium editorial pullquote with large decorative quote mark and author attribution. |
| M99 Cookie Consent | — | Premium GDPR strip on dark background with gradient icon, copy, and 3 action buttons. |

## Molecules · Charts

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M110 Bar Chart | — | Dense bar chart in four densities (12 columns to 92 hairlines) with legend/axes/gridlines/trend as booleans. |
| M111 Line Chart | 6 | Dense 92-point line chart with 1.25px hairlines, single-hue series, and boolean chart chrome. |
| M112 Area Chart | — | Stacked 92-point area bands in the shared series order with surface-coloured band edges. |
| M113 Donut Chart | — | Donut of real Figma arcs stepping one hue, with a switchable centre total/caption slot. |
| M114 Sparkline | — | Inline 44-point sparkline in semantic trend colours, compact enough for a table cell. |
| M115 Bullet Chart | — | Bullet/target chart with neutral range bands, violet measure, bar-in-bar comparative, and text-primary target tick. |

## Molecules · Dashboard / App Extras

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| M130 Chart Card | — | The chrome around a plot — title, subtitle, headline value with delta pill, period selector, legend, body slot, and footer. |
| M131 Quick Action Tile | — | Quick action tile in Top (square grid) and Left (wide row) layouts with a full interaction-state axis. |
| M132 Metric Breakdown Row | — | Linked stacked bar over one row per series, with matching series-marker dots and boolean percent/bar. |
| M133 Payment Card Visual | — | Payment card visual with variant-switched gradient overlay and an INSTANCE_SWAP brand-mark slot. |
| M134 Org Switcher | — | Org/workspace switcher whose trigger is avatar + name + plan + chevron and whose open panel reuses A07/M18/A24. |
| M135 Sidebar Promo Card | — | Sidebar promo in Full and Compact (rail) layouts, Solid or Gradient, with an A01 CTA. |

---

## Organisms · App Shell

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| O01 App Shell | — | Application shell layout (no description). |
| O02 Page Header | — | Page-level header (no description). |
| O04 Sidebar Navigation | 3 | Collapsible sidebar with search + nav items + user info. |
| O05 Mobile Tab Bar | — | Mobile tab bar (no description). |
| O06 Breadcrumb Trail | — | Breadcrumb trail organism (no description). |
| O07 Dashboard Grid | — | Dashboard grid layout (no description). |
| O08 Activity Feed Pane | — | Activity feed pane (no description). |
| O09 Stats Dashboard | — | Stats dashboard layout (no description). |

## Organisms · App Layouts & Pages

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| O10 Marketplace Grid | — | Marketplace grid layout (no description). |
| O11 Search Results Layout | — | Search results layout (no description). |
| O12 Auth Form | — | Authentication form layout (no description). |
| O13 Multi-step Form | — | Multi-step form layout (no description). |
| O14 Settings Panel | — | Settings panel layout (no description). |
| O15 Profile Editor | — | Profile editor layout (no description). |
| O16 Asset Detail Layout | — | Asset detail layout (no description). |
| O17 Marketplace Listing Page | — | Marketplace listing page layout (no description). |
| O18 Wallet Dashboard | — | Wallet dashboard layout (no description). |
| O19 Transaction History | — | Transaction history layout (no description). |
| O20 NFT Gallery | — | NFT gallery layout (no description). |

## Organisms · Marketing Sections

All share the description: "Marketing section organism — assembled from published molecules. Swap copy per page; layout is auto-layout at 1440 with 80px gutters."

| ID/Name | Variants | What it is (one sentence) |
|---|---|---|
| O25 Hero Section | — | Marketing hero section assembled from published molecules at 1440/80px gutters. |
| O26 Feature Grid | — | Marketing feature grid section assembled from published molecules. |
| O27 Testimonial Grid | — | Marketing testimonial grid section assembled from published molecules. |
| O28 Pricing Section | — | Marketing pricing section assembled from published molecules. |
| O29 Logo Cloud | — | Marketing logo cloud section assembled from published molecules. |
| O30 CTA Section | — | Marketing CTA section assembled from published molecules. |
| O31 Footer | — | Marketing footer section assembled from published molecules. |
| O32 FAQ Section | — | Marketing FAQ section assembled from published molecules. |
| O33 Newsletter Section | — | Marketing newsletter section assembled from published molecules. |
| O34 Stats Section | — | Marketing stats section assembled from published molecules. |
| O35 Team / About | — | Marketing team/about section assembled from published molecules. |
| O36 Article List | — | Marketing article list section assembled from published molecules. |
| O37 Comparison Section | — | Marketing comparison section assembled from published molecules. |
| O38 Cookie Banner | — | Marketing cookie banner section assembled from published molecules. |

---

## Private helpers (_-prefixed)

None are published as searchable library components — they surface only as internals referenced in the descriptions of public components already catalogued above:

- `_Modal header`, `_Modal actions` — used by M07, M08, M09, M10, M11
- `_Checkbox base`, `_Radio base`, `_Toggle base` — used by A08, A10, M62
- `_Select item` — used by M12
- `_Button group segment` — used by A15
- `_Badge icon` — used by A18
- `_Comment thread`, `_Comment input` — used by M100
- `_Series marker` — used by M132
- `_Link label` — mentioned in A03's description only as a future option (may not exist)

## Coverage note

**Query sweeps run** (all with `includeStyles=false`, `includeVariables=false`, restricted to the IDEEZA — Design System library key):

- Prefix sweeps: A0, A1, A2, A3, I0, I1, I2, M0, M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, O0, O1, O2, O3, C0, C1, T0, S0, F0
- Keyword sweeps: Chart, Navigation, Table, Form, Picker, Card, Stepper, Pagination, Tabs, Menu, Sidebar, Navbar, Footer, Hero, Pricing, Testimonial, Email, Input, Select, Checkbox, Radio, Toggle, Slider, Date, Upload, "Search field", "Empty state", Avatar, Breadcrumb, Accordion, "List item", Stat, KPI, Header, Section, "Comment thread", "_Modal header", "_Checkbox base"
- Gap probes: A04, A05, A09, M18, M36, M63, M67, M101–M104, "M105 Comment Menu", M106–M109, M116, M117, M120, M121, O03, O21, O22, O23, O24, F06

**Confirmed gaps / notes:**

- No components with C, T, S, or I prefixes exist; the only F-prefixed item is "F06 Icon Base", published under the plain name **Icon**.
- **A04 and A05 are published unnumbered** as "Text Input" and "Textarea" (M80's description explicitly calls the former "A04 Text Input"). **A09** does not exist — checkbox and radio were unified into A08 Selection Control.
- Missing molecule IDs (probed, nothing found): **M36, M63, M67, M101–M109, M116–M129** (M116/M117 and M120/M121 probed empty, then range abandoned per two-consecutive-empty rule). M65 Tag List's description mislabels itself "M63". **M105 Comment Menu** is referenced by M100's description as a placeable component but is not published/searchable in the library — the one range entry I could not fully resolve.
- Missing organism IDs (probed, nothing found): **O03, O21–O24**. O-range otherwise continuous O01–O02, O04–O20, O25–O38.
- Icon glyphs ("icon/…"), flags, and animation icons were excluded by instruction.

---

## Node ids (live file, read via use_figma)

The page-list API serves this file a stale view; these ids were read live. Use
them with `get_design_context`/`get_metadata`. Component sets (variants live
inside): pages — Cover 0:1 · Index 1:2 · Tokens 1:3 · Foundations 1:4 · Atoms
Action 1:5 · Atoms Input 1:6 · Atoms Display 1:7 · Molecules Feedback 1:8 ·
Overlay 1:9 · Navigation 1:10 · Data Display 1:11 · Pickers 1291:2 · Form 1:13 ·
IDEEZA 1:14 · Atoms Chart 3976:106 · Molecules Chart 4014:106 · Organisms App
1:16 · Organisms Marketing 1:17 · Screens Auth/Core/Settings/Marketing
1:18–1:21 (empty) · Email 1:22 · Icons 1109:3 · States 1763:2 · Data Display
Ext 1799:2 · Web3 1839:2 · Media 1875:2 · Marketing 1935:2.

| Component | Node id |
|---|---|
| A01 Button 172:1679 · A02 Icon Button 167:1479 · A03 Link 607:928 · A15 Button Group 422:928 | |
| Text Input 227:2517 · Textarea 223:492 · A06 Select 638:776 · A07 Search 630:752 · A08 Selection Control 369:1014 · A10 Toggle 298:627 · A11 Slider 632:752 · A12 Number Input 688:1756 · A13 Color Picker 640:771 · A14 Multi-select 644:1446 | |
| A16 Avatar 467:2 · A17 Badge 494:273 · A18 Tag 517:645 · A19 Tooltip 560:808 · A20 Spinner 537:743 · A21 Skeleton 566:835 · A22 Progress Bar 731:704 · A23 Progress Ring 588:734 · A24 Divider 512:557 · A25 KBD 601:710 · A26 Dot 523:774 · A27 Code 602:710 · A28 Inline CTA 616:704 · A29 Brand Icon 858:722 · A30 Delta Chip 4115:1370 | |
| M01 Alert 704:2 · M02 Toast 715:12 · M03 Banner 1301:57 · M04 Snackbar 1302:35 · M05 Inline Message 1303:27 · M06 Status Block 1304:31 | |
| M07 Modal 824:102 · M08 Drawer 1440:850 · M09 Bottom Sheet 1439:711 · M10 Popover 1441:894 · M11 Confirm Dialog 1438:907 · M12 Action Sheet 1443:878 · M13 Lightbox 1444:827 | |
| M14 Tabs 769:260 · M15 Header 1460:442 · M16 Sidebar Item 748:162 · M17 Bottom Nav 1455:316 · M18 Dropdown Menu 742:147 · M19 Breadcrumb 756:162 · M20 Pagination 758:200 · M134 Org Switcher 4136:929 · M135 Sidebar Promo Card 4152:654 | |
| M21 Card 898:55 · M22 Pricing Card 899:179 · M23 Card Image 900:107 · M24 Stat Card 1540:196 · M25 Asset Card 1548:2110 · M26 List Item 894:71 · M60 Table Header 2592:587 · M61 Table Row 2597:655 · M62 Table Cell 2594:726 · M65 Tag List 1785:402 · M131 Quick Action Tile 4126:1518 · M132 Metric Breakdown Row 4126:1715 · M133 Payment Card Visual 4128:1584 | |
| M27 Form Field 698:56 · M28 Form Row 1738:716 · M29 Form Section 1738:843 · M30 Search Bar 1740:634 · M31 Filter Bar 1741:627 · M32 Toolbar 1742:771 · M33 Stepper 1738:926 · M38 OTP 857:56 · M39 Checkbox Group 881:251 · M40 Radio Group 883:369 · M41 File Upload 885:333 · M42 Image Upload 884:321 · M43 Card Payment 886:389 | |
| M34 Date Picker Menu 920:1857 · M34a Dropdown 925:3375 · M34b Modal 927:4269 · M35 Time Picker 1928:3202 · M37 Color Picker 1930:3211 | |
| M44–M47 IDEEZA 1090:6554 / 1090:6558 / 1090:6565 / 1090:6609 | |
| M48 Empty 1763:3 · M49 Error 1763:54 · M50 Loading 2270:95 · M51 Skeleton 2270:159 · M52 Success 1763:119 · M53 No Results 1763:152 · M54 Permission 1763:186 · M55 No Connection 1763:242 · M56 Maintenance 1763:276 · M57 Not Found 1763:310 · M58 Coming Soon 1763:367 · M59 Server Error 1763:400 | |
| M64 Pagination Bar 1799:133 · M66 Rating Stars 1801:144 · M68 Tree Node 1801:199 · M100 Comments 3799:842 | |
| M70 Gallery 1876:82 · M71 Video 1876:144 · M72 Audio 1876:345 · M73 File Preview 1876:437 · M74 Image+Caption 2284:181 · M75 Embed 2284:223 | |
| M76–M85 Web3: 1869:167 · 1869:168 · 1839:15 · 1839:34 · 1840:131 · 3738:294 · 1840:192 · 1839:116 · 1839:49 · 1869:215 | |
| M86–M99 Marketing: 1986:29 · 1986:37 · 1986:54 · 1986:77 · 1992:117 · 1992:160 · 1992:192 · 1992:228 · 1992:269 · 2000:138 · 2000:163 · 2000:184 · 2000:196 · 2000:246 | |
| M110 Bar 4097:1179 · M111 Line 4095:731 · M112 Area 4098:1233 · M113 Donut 4021:973 · M114 Sparkline 4088:843 · M115 Bullet 4023:982 · M130 Chart Card 4111:1849 | |
| O01 App Shell 2485:1355 · O02 Page Header 2473:562 · O04 Sidebar Nav 755:351 · O05 Mobile Tab Bar 2465:562 · O06 Breadcrumb Trail 2460:500 · O07 Dashboard Grid 2490:1008 · O08 Activity Feed 2491:1217 · O09 Stats Dashboard 2492:1265 · O10 Marketplace Grid 2495:1417 · O11 Search Results 2496:1732 · O12 Auth Form 2500:1825 · O13 Multi-step Form 2502:1912 · O14 Settings 2503:2062 · O15 Profile Editor 2504:2196 · O16 Asset Detail 2507:2296 · O17 Listing Page 2508:2371 · O18 Wallet 2510:2719 · O19 Tx History 2512:2871 · O20 NFT Gallery 2513:3074 | |
| O25–O38 Marketing sections: 3253:15218–15235 (Hero 15218 · Features 15219 · Logo Cloud 15220 · Testimonials 15221 · Stats 15222 · Pricing 15223 · CTA 15224 · FAQ 15225 · Newsletter 15226 · Comparison 15229 · Team 15231 · Articles 15232 · Cookie 15234 · Footer 15235) | |
