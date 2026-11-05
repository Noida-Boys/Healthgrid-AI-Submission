# HealthGrid AI — Design Doctrine

Every UI decision in this repo follows this document. If a change fights this doc, the change is wrong or this doc gets amended deliberately — never silently.

## The feel

A government district control room: **Bloomberg Terminal × ISRO mission control**. Calm, dense, precise, trustworthy. The interface is an instrument, not a marketing page. If a screen looks like a template or an "AI-generated app," it fails review.

## Hard prohibitions (the "not-AI-looking" mandate)

- No purple/indigo gradients, no gradient text, no glassmorphism, no floating blob backgrounds.
- No emoji as icons or status indicators. Status is shown with color + shape + text.
- No centered marketing-hero layouts, no rounded-3xl cards floating in whitespace.
- No default-shadcn look, no drop shadows as decoration (borders and surface steps carry hierarchy).
- No spinners where a skeleton row will do; no bouncing dots.
- Red/amber/green appear ONLY as facility/severity status. Never decorative.

## Color tokens (dark, single accent)

| Token | Value | Use |
|---|---|---|
| `--surface-0` | `#0A0E13` | Page background |
| `--surface-1` | `#10161D` | Panels, rails, header |
| `--surface-2` | `#182029` | Cards, table rows, inputs |
| `--line` | `#243040` | All borders/dividers (1px) |
| `--ink-1` | `#E8EDF2` | Primary text, metric values |
| `--ink-2` | `#9FB0BF` | Secondary text, labels |
| `--ink-3` | `#5F7183` | Tertiary text, axis, hints |
| `--accent` | `#4FA3A5` | Interactive: links, buttons, focus, selection. The ONLY non-status chromatic. |
| `--status-healthy` | `#2FA36B` | Healthy facilities / severity ok |
| `--status-at-risk` | `#D9A03C` | At-risk / warning |
| `--status-critical` | `#D9524A` | Critical / stock-out imminent |

Status colors also have `--status-*-dim` (18% alpha) for fills/badges behind text.

## Typography

- **UI + labels:** IBM Plex Sans (400/500/600).
- **Hindi:** IBM Plex Sans Devanagari — same family, so Hindi never looks bolted-on.
- **Every numeric value:** IBM Plex Mono with `tabular-nums`. Metrics are the product; they must align and not jitter when live-updating.
- Scale: 12px dense labels / 13px body / 15px section titles / 20px+ only for the facility health score. UPPERCASE 11px letter-spaced (`+0.08em`) for rail/section headers.

## Density & layout

- Grid gap 8px, card padding 12px, table row height 36px, panel rail width 380px, header height 56px.
- Hierarchy from surface steps (`surface-0 → 1 → 2`) + 1px `--line` borders. Radius: 4px (6px max on modals).
- Empty/loading states: skeleton rows in `surface-2`, label in `ink-3`. Never a lone centered spinner.

## Motion (meaningful only)

- Marker/status change: single 1.2s pulse ring, then still. No infinite pulsing on healthy nodes.
- Score changes: 400ms count-up on the number, no layout shift (mono + tabular).
- Panel/drawer: 180ms ease-out translate. Nothing else animates.

## Voice & copy

- Sentence case, terse, factual: "Paracetamol · 5 days left", not "Uh oh! Running low!".
- Hindi strings always in Devanagari. Facility statuses in UI: "Healthy / At risk / Critical".
- Timestamps relative under 24h ("4 min ago"), absolute after.
