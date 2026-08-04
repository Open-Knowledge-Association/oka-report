# UI Rules of Thumb

This document outlines UI rules of thumb for the OKA Stats Platform. The goal is a clear, data-forward experience that feels intentional, trustworthy, and calm. These guidelines apply to dashboard, editor views, admin pages, and shared components.

## Core Principles

- Clarity over decoration: visuals should support data comprehension.
- Hierarchy first: show totals, then breakdowns, then detail.
- Consistency: same patterns for filters, tables, cards, and charts.
- Accessibility by default: color contrast, focus states, keyboard-friendly.
- Performance-aware: avoid heavy animations and excessive DOM.

## Layout & Information Architecture

- Use a two-level structure per page: primary stats summary, then analytical sections.
- Keep filters in a single horizontal bar above the main content.
- Prefer a 12-column grid for desktop; collapse to single column on mobile.
- Use a max content width (e.g., 1200-1400px) with centered layout.
- Reserve left-to-right scanning: totals on left, actions on right.

## Typography

- Choose one primary display font and one neutral body font.
- Use 3-4 text sizes max for consistency.
- Headings: short, specific, no more than one line when possible.
- Numbers: use tabular-nums for alignment in tables and cards.
- Ensure body text line height at least 1.5 for readability.

## Color & Theming

- Use a light theme as default; avoid heavy dark backgrounds.
- Define a single accent color for key actions and highlights.
- Use neutral grays for containers and backgrounds.
- Avoid high-saturation gradients; if used, keep subtle.
- Never rely on color alone to convey meaning.

## Spacing & Rhythm

- Use an 8px spacing scale.
- Keep card padding consistent across the app.
- Use generous vertical spacing between sections.
- Maintain consistent gap sizes in grids and tables.

## Components

### Cards (Summary KPIs)

- Show 4-6 key metrics per page.
- Include a concise label, large value, and a small trend indicator.
- Icons are optional; if used, keep consistent style.
- Keep card height uniform across the row.

### Tables

- Prioritize readability: zebra striping or subtle row dividers.
- Column alignment: text left, numbers right.
- Provide total row when relevant.
- Sticky header for long tables.
- Sorting is opt-in; default sort should match business priority (e.g., words added).

### Charts

- Use line charts for trends, bar charts for comparisons.
- Limit series count to 3-4 for clarity.
- Provide tooltips and labels for axes.
- Use muted gridlines and avoid heavy chart borders.

### Filters

- Use a consistent filter bar on all data pages.
- Inputs: Date range, project select, search.
- Filters should update URL search params.
- Provide a clear reset option.

### Buttons & Actions

- Primary action: single accent color per view.
- Secondary actions: outline or muted style.
- Destructive actions must be clearly labeled and separated.

## States & Feedback

- Loading: use skeletons for key sections (cards, tables, chart).
- Empty: explain why data is missing and what to do next.
- Error: show concise message and a retry action.
- Success: use subtle toasts for admin actions.

## Responsive Rules

- On mobile: stack cards, collapse filters into a drawer or vertical stack.
- Tables: allow horizontal scroll; keep first column sticky if possible.
- Charts: full width with simplified legends.

## Content & Copy

- Prefer short labels, avoid technical jargon in UI.
- Use consistent metric names: Edits, Words Added, Pageviews, Articles Created, Articles Modified, Commons Uploads.
- Date ranges should be explicit (e.g., Jan 1, 2026 - Jan 31, 2026).

## Interaction & Motion

- Use subtle transitions (150-250ms) for hover and focus states.
- Avoid heavy motion on data changes; keep UI stable.

## Admin UX

- Admin pages should feel distinct but consistent.
- Provide explicit confirmation for delete/deactivate actions.
- Show recent activity or sync status near top of admin views.

## Visual Density

- Favor breathing room over dense layouts.
- Use dividers and section headers to segment content.

## Implementation Notes

- Prefer existing shadcn/ui components and Tailwind utilities.
- Avoid custom CSS unless needed for layout or charts.
- Keep class names consistent and readable.
