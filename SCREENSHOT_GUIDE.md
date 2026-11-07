# Landing Page Screenshot Guide

This guide explains how to capture proper mockup screenshots from the PrepSPSC app to replace the current SVG placeholders on the landing page.

## Screenshots Needed

You need to capture 4 screenshots for the landing page feature cards:

1. **Dashboard** (`dashboard-mockup.png`)
2. **Study Timer** (`timer-mockup.png`)
3. **Study Rooms** (`rooms-mockup.png`)
4. **Mock Tests** (`mock-tests-mockup.png`)

## Screenshot Specifications

- **Dimensions**: 1200x800px (or similar 3:2 aspect ratio)
- **Format**: PNG (for best quality with transparency support)
- **Quality**: High resolution, clear UI elements
- **Location**: Save to `/public/landing/` directory

## How to Capture Screenshots

### 1. Dashboard Screenshot
**URL**: `/dashboard`

**What to capture**:
- Main dashboard view with XP bar at top
- Stats cards showing study time, streak, level
- Achievement badges
- Weekly activity chart

**Steps**:
1. Log in to the app with a user account that has good data
2. Navigate to `/dashboard`
3. Ensure the page is fully loaded with data visible
4. Take a screenshot of the main content area (exclude navbar/sidebar if needed)
5. Crop to focus on the dashboard widgets
6. Save as `dashboard-mockup.png`

### 2. Study Timer Screenshot
**Component**: Study Timer Widget

**What to capture**:
- Timer widget showing the Pomodoro timer
- Focus/Break mode interface
- Start/Stop/Reset controls
- XP display

**Steps**:
1. Navigate to any room or page where timer widget is visible
2. Alternatively, find the timer component in dashboard
3. Capture the timer widget in an active state (showing time)
4. Include the glassmorphic card styling
5. Save as `timer-mockup.png`

### 3. Study Rooms Screenshot
**URL**: `/rooms`

**What to capture**:
- Study rooms grid view
- Multiple room cards showing:
  - Room names
  - Active user counts
  - Join buttons
- Glassmorphic card design

**Steps**:
1. Navigate to `/rooms`
2. Ensure there are multiple rooms visible in the grid
3. Capture the rooms grid layout
4. Include 4-6 room cards if possible
5. Save as `rooms-mockup.png`

### 4. Mock Tests Screenshot
**URL**: `/tests`

**What to capture**:
- Mock tests listing page
- Test cards showing:
  - Test titles
  - Subject categories
  - Question counts
  - Duration/time limits
- Start test buttons

**Steps**:
1. Navigate to `/tests`
2. Capture the test selection interface
3. Show multiple test cards in grid layout
4. Include the glassmorphic styling
5. Save as `mock-tests-mockup.png`

## Screenshot Tools

### macOS
- **Native**: `Cmd + Shift + 4` then drag to select area
- **Full window**: `Cmd + Shift + 4`, then press `Space`, click window

### Windows
- **Snipping Tool**: Search for "Snipping Tool" in Start menu
- **Keyboard**: `Win + Shift + S`

### Browser DevTools
- **Chrome DevTools**: F12 → `Cmd/Ctrl + Shift + P` → "Capture screenshot"
- **Firefox**: F12 → Click camera icon in developer tools

## Post-Processing (Optional)

If needed, you can edit the screenshots to:
- Remove personal information (usernames, emails)
- Blur sensitive data
- Crop to optimal composition
- Resize to exactly 1200x800px

Use tools like:
- **macOS**: Preview, Pixelmator
- **Windows**: Paint, Paint.NET
- **Cross-platform**: GIMP, Figma, Photoshop

## Updating the Landing Page

Once you have the screenshots:

1. Save them to `/public/landing/` directory:
   ```
   /public/landing/
   ├── dashboard-mockup.png
   ├── timer-mockup.png
   ├── rooms-mockup.png
   └── mock-tests-mockup.png
   ```

2. Update the file references in `/src/components/landing/hero-with-cards.tsx`:
   ```tsx
   // Change from .svg to .png
   image="/landing/dashboard-mockup.png"
   image="/landing/timer-mockup.png"
   image="/landing/rooms-mockup.png"
   image="/landing/mock-tests-mockup.png"
   ```

3. The Next.js Image component will automatically optimize the images

## Current Placeholder Files

The following SVG placeholders can be replaced (but keep them as backup):
- `dashboard-mockup.svg` → Replace with `dashboard-mockup.png`
- `timer-mockup.svg` → Replace with `timer-mockup.png`
- `rooms-mockup.svg` → Replace with `rooms-mockup.png`
- `achievements-mockup.svg` → Replace with `mock-tests-mockup.png` (feature changed)

## Tips for Best Results

1. **Use real data**: Log in with an account that has activity (study sessions, tests completed, etc.)
2. **Clean UI**: Hide any notifications or overlays that might distract
3. **Consistent theme**: Capture all screenshots in the same theme (dark mode)
4. **Good lighting**: Ensure the glassmorphic effects are visible
5. **Responsive view**: Capture at a desktop resolution (1920x1080 or similar)
6. **Centered content**: Make sure the main features are centered and visible

## Need Help?

If you need assistance capturing screenshots or have questions, reach out to the development team or refer to the main README.md for app navigation guidance.
