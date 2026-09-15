---
name: Prestige Thai Academy
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#43474e'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#456084'
  primary: '#022445'
  on-primary: '#ffffff'
  primary-container: '#1e3a5c'
  on-primary-container: '#8aa4cc'
  inverse-primary: '#adc8f2'
  secondary: '#795823'
  on-secondary: '#ffffff'
  secondary-container: '#fdd08e'
  on-secondary-container: '#785722'
  tertiary: '#312000'
  on-tertiary: '#ffffff'
  tertiary-container: '#4d3400'
  on-tertiary-container: '#c19d5f'
  error: '#BA1A1A'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e3ff'
  primary-fixed-dim: '#adc8f2'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#2d486b'
  secondary-fixed: '#ffddb0'
  secondary-fixed-dim: '#ebbf7f'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#5f410c'
  tertiary-fixed: '#ffdeab'
  tertiary-fixed-dim: '#e8c080'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5d420d'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  surface-white: '#FFFFFF'
  text-primary: '#1E3A5C'
  text-muted: rgba(30, 58, 92, 0.70)
  border-light: '#E7E8E9'
  success: '#2D6A4F'
typography:
  display-lg:
    fontFamily: IBM Plex Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  caption:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  container-max: 1280px
  accent-bar: 4px
---

## Brand & Style
The design system establishes a visual language that bridges the gap between traditional academic authority and modern digital efficiency. It targets lifelong learners and professionals who seek high-value, credible education.

The style is **Corporate / Modern** with a focus on structural integrity and prestige. It utilizes a restrained color palette and precise geometric shapes to evoke an emotional response of security, ambition, and refinement. Whitespace is used strategically to denote "premium" space, ensuring the interface feels organized and high-end rather than cluttered or transactional. Structural elements are anchored in deep, trustworthy tones, while high-value interactions are highlighted with a sophisticated metallic warmth.

## Colors
The palette is centered around **Deep Navy (#1E3A5C)** to project institutional trust and intellectual depth. This color is the foundation of the system, used for all structural elements, headers, standard buttons, and primary navigation.

**Warm Gold (#C9A063)** serves as the sophisticated accent and "Call to Action" driver. It is reserved exclusively for high-value information—specifically course pricing, primary "Enroll" buttons, achievement badges, and active navigational indicators.

Backgrounds follow an "Airy" philosophy using **Surface White (#FFFFFF)** for main content cards and **Neutral Light Gray (#F8F9FA)** for page backgrounds to provide subtle section grouping. Secondary text should utilize the Primary Navy with reduced opacity (70%) to maintain harmony while establishing clear hierarchy.

## Typography
The system uses **IBM Plex Sans** (with full Thai script support) across all roles to ensure a technical yet humanist feel that is highly legible.

- **Headings:** Utilize semi-bold weights with generous top margins to separate course modules and sections. Headers must always be set in the Primary Deep Navy.
- **Body:** Standardized at 16px for optimal readability of educational content. 
- **Letter Spacing:** Headlines use a slight negative tracking (-0.01em to -0.02em) to appear more "locked-in" and authoritative.
- **Vertical Rhythm:** Line heights are kept generous (1.5x for body) to reduce cognitive load during long reading sessions.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop (12 columns) to maintain the "University" feel of structured stability, transitioning to a fluid layout for mobile devices.

- **The Gold Accent Bar:** A signature 4px gold bar is used to denote focus. It can be applied vertically to the left side of active list items or horizontally at the top of section headers.
- **Rhythm:** An 8px base unit governs all padding and margins. 
- **Breakpoints:**
  - **Desktop:** 12 columns, 40px margins, 24px gutters.
  - **Tablet:** 8 columns, 24px margins, 16px gutters.
  - **Mobile:** 4 columns, 16px margins, 16px gutters.

## Elevation & Depth
Depth is used sparingly to maintain a modern aesthetic with tactile cues only on interactive elements.

- **Base Layer:** Pure white or light gray surfaces with minimal shadows.
- **Card Elevation:** Use an extremely soft, diffused navy-tinted shadow: `0px 4px 20px rgba(30, 58, 92, 0.08)`. On hover, the shadow deepens and the card translates -4px on the Y-axis.
- **Depth Tiers:**
  - **Tier 1 (Navigation):** Fixed bars use a 1px bottom border in `#E7E8E9` rather than a shadow.
  - **Tier 2 (Cards):** Soft diffused shadows to separate content from the background.
  - **Tier 3 (Overlays):** Modals and dropdowns use high-contrast shadows to demand focus.

## Shapes
The shape language is "Rounded" but controlled to maintain a professional demeanor.

- **Global Radius:** 0.5rem (8px) for buttons and input fields to balance friendliness with professional structure.
- **Container Radius:** 1rem (16px) for course cards and large content containers.
- **Interactive Indicators:** Rectangular elements (like the Gold Accent Bar) should remain sharp or have a very minimal 2px radius to contrast against the softer UI elements.

## Components

### Buttons
- **Primary:** Deep Navy (#1E3A5C) background, White text. This is the standard button for most site actions.
- **Secondary (CTA):** Warm Gold (#C9A063) background, White or Navy text. Used exclusively for "Buy Now," "Enroll," or "Complete Purchase."
- **Ghost:** Navy outline (1px), transparent background. Used for secondary actions like "View Syllabus."

### Cards (Course Items)
- **Structure:** 16px radius, White background, Tier 2 elevation.
- **Visuals:** Course thumbnail with a 16:9 aspect ratio at the top.
- **Pricing:** Always displayed in **Warm Gold** using Headline-md typography to stand out against the navy text.

### Forms & Inputs
- **Default:** 1px Light Gray border, 8px radius.
- **Focus:** 2px Deep Navy (#1E3A5C) ring.
- **Labels:** Positioned above the field in Label-md style using 70% opacity Navy.

### Navigation
- **Active State:** A 4px Gold horizontal bar positioned at the bottom of the navigation link, matching the width of the text label.
- **Headers:** All top-level navigation text and logos must use the Primary Deep Navy.

### Status Badges
- **Style:** Small 8px dot + Label-md text.
- **Color Mapping:**
  - **Enrolled:** Green dot.
  - **In Progress:** Gold dot.
  - **Not Started:** Gray dot.