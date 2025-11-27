# VLX-ESTIMATOR - AI Project Guide

> This document is designed to help AI assistants (or future developers) quickly understand the VLX-ESTIMATOR web application, its architecture, key features, and recent development history.

---

## 📋 Project Overview

**VLX-ESTIMATOR** (also referred to as VLW-ESTIMATOR) is a web application for quoting windows in construction projects. It allows users to calculate the total selling price for window systems based on measurements, accessories, colors, glass types, and profiles.

### Core Purpose
- **Admin users** create and manage window system templates (profiles, glass types, accessories, panel configurations)
- **Regular users** create projects, add windows to those projects, configure dimensions/components, and get price quotes
- **PDF export** for quotations

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose ODM) |
| Frontend | EJS Templates + Tailwind CSS |
| Authentication | Express-session (session-based) |
| File Uploads | Multer + Sharp (image processing) |
| PDF Generation | PDFKit |
| Excel Import/Export | ExcelJS |

---

## 📁 Project Structure

```
VLX_V1/
├── server.js                 # Main entry point
├── models/                   # Mongoose schemas
│   ├── User.js              # User accounts (username, password hash, role)
│   ├── Project.js           # User projects
│   ├── Window.js            # Window system templates (admin-defined)
│   ├── WindowItem.js        # Individual configured windows in projects
│   ├── Profile.js           # Aluminum profiles (frame components)
│   ├── Glass.js             # Glass types with pricing
│   ├── Accessory.js         # Window accessories
│   ├── ComponentGroup.js    # Grouping for components
│   ├── CostSettings.js      # Global cost settings (freight, labor, etc.)
│   ├── SystemMetric.js      # System metrics tracking
│   └── UserActivity.js      # User activity logging
├── routes/
│   ├── authRoutes.js        # Login, register, logout
│   ├── dashboardRoutes.js   # Main dashboard
│   ├── projectRoutes.js     # Project CRUD + window configuration
│   ├── admin/               # Admin-only routes
│   │   ├── windowRoutes.js      # Window system management
│   │   ├── profileRoutes.js     # Profile management
│   │   ├── glassRoutes.js       # Glass type management
│   │   ├── accessoryRoutes.js   # Accessory management
│   │   ├── settingsRoutes.js    # Cost settings
│   │   ├── metricsRoutes.js     # Analytics/metrics
│   │   └── componentGroupRoutes.js
│   └── middleware/
│       ├── authMiddleware.js    # isAuthenticated check
│       └── adminMiddleware.js   # isAdmin check
├── views/
│   ├── admin/               # Admin panel views
│   │   ├── composeWindow.ejs    # Multi-step form to create window systems
│   │   ├── listWindowSystems.ejs
│   │   ├── editWindowSystem.ejs
│   │   └── ... (other admin views)
│   ├── projects/
│   │   ├── configureWindow.ejs  # User configures a window (dimensions, pricing)
│   │   ├── newProject.ejs
│   │   └── projectDetails.ejs
│   ├── partials/            # Reusable EJS components
│   ├── dashboard.ejs
│   ├── login.ejs
│   └── register.ejs
├── public/                  # Static assets (CSS, JS, images)
├── utils/
│   └── currencyConverter.js # COP/USD conversion utilities
└── uploads/                 # Uploaded images storage
```

---

## 🔑 Key Features

### 1. User Authentication
- Session-based authentication with roles: `admin` and `user`
- Password hashing with bcrypt
- Admin middleware protects admin routes

### 2. Window System Templates (Admin)
Admin creates window system "templates" that define:
- **Name & Type**: e.g., "Horizontal Roller", "Casement", "French Door"
- **Profiles**: Frame components with pricing, weight, length discounts
- **Accessories**: Hardware, handles, locks, etc.
- **Muntin Configuration**: Grid patterns for decorative glass divisions
- **Panel Configuration**: Defines the window layout (e.g., OXXO for sliding - X=Operable, O=Fixed)
  - `operationType`: sliding, casement, awning, fixed, single-hung, double-hung, french-door, etc.
  - `orientation`: horizontal or vertical
  - `panels`: Array of 'X' (Operable) and 'O' (Fixed) panels
  - `panelRatios`: Array of ratios for unequal panel sizes
  - `hasMullion`: Whether mullions exist between panels
  - `mullionWidth`: Width of mullions
  - `showLogo`: Whether to display VITRALUX logo on glass
  - `frenchDoor`: Special configuration for French doors (see below)

#### French Door Configuration
French doors have special configuration options:
- **Door Type**: Single or Double door
- **Hinge Side**: Left or Right (for single doors - determines which way door opens)
- **Left/Right Sidelites**: 0-4 sidelites on each side
- **Transom**: None, Full Width, or Over Door Only
- **Logo**: Show/hide VITRALUX logo on glass panels

### 3. Window Configuration (User)
Users configure windows within their projects:
- Select a window system template
- Enter dimensions (width × height) in inches or mm
- Unit conversion is automatic
- Dynamic visual preview shows the panel layout
- Real-time calculations: Area, Perimeter, Aspect Ratio, Glass Area
- Quantity selection
- Price calculation based on dimensions and components

### 4. Dynamic Visual Preview
The configure window page features a dynamic preview that:
- Shows the exact panel configuration (O/X panels)
- Displays operation indicators (arrows for sliding windows)
- Scales proportionally with entered dimensions
- Has a unit toggle (Imperial/Metric) that converts all displayed values
- Shows dimension labels that adjust position based on unit

### 5. Pricing System
- Component-based pricing (profiles, glass, accessories)
- Additional costs: freight, packaging, labor, indirect costs
- Currency conversion (COP ↔ USD) with live exchange rates
- Pricing tiers for different user levels

---

## 📊 Database Models

### Window (Window System Template)
```javascript
{
  name: String,
  type: String, // e.g., 'horizontal-roller', 'casement', 'french-door'
  profiles: [{ profile: ObjectId, quantity: Number, lengthDiscount: Number }],
  accessories: [{ accessory: ObjectId, quantity: Number, isOptional: Boolean }],
  muntinConfiguration: { type: String, horizontalBars: Number, verticalBars: Number, ... },
  panelConfiguration: {
    operationType: String,    // 'sliding', 'casement', 'fixed', 'french-door', etc.
    orientation: String,      // 'horizontal' or 'vertical'
    panels: [String],         // ['X', 'O', 'O', 'X'] for XOOX (X=Operable, O=Fixed)
    panelRatios: [Number],    // [0.25, 0.5, 0.25] for unequal panel widths
    hasMullion: Boolean,
    mullionWidth: Number,
    showLogo: Boolean,        // Show VITRALUX logo on glass
    frenchDoor: {             // Only for french-door operation type
      doorType: String,       // 'single' or 'double'
      hingeSide: String,      // 'left' or 'right' (for single doors)
      leftSidelites: Number,  // 0-4
      rightSidelites: Number, // 0-4
      transom: String,        // 'none', 'full', 'over-door'
      showLogo: Boolean
    }
  }
}
```

### WindowItem (Configured Window in Project)
```javascript
{
  project: ObjectId,
  windowSystem: ObjectId,
  reference: String,
  width: Number,
  height: Number,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  selectedGlass: ObjectId,
  selectedAccessories: [ObjectId],
  notes: String
}
```

### Profile
```javascript
{
  name: String,
  color: String,
  colorCode: String,   // Reference code
  pricePerMeter: Number,
  currency: String,    // 'COP' or 'USD'
  weight: Number,      // Optional (kg/m²)
  ammaCertification: String,  // '2603', '2604', '2605', or 'No Certification'
  isMuntin: Boolean,
  muntinType: String,   // 'none' or specific type
  muntinPattern: String,
  muntinSpacing: Number  // Optional, null if not a muntin
}
```

### Glass
```javascript
{
  name: String,
  type: String,
  price: Number,
  weight: Number,      // Optional (kg/m²)
  missileType: String,
  // ... other fields
}
```

---

## 🌐 Key Routes

### Public Routes
- `GET /` - Landing page
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `GET /register` - Registration page
- `POST /register` - Create new user

### User Routes (Authenticated)
- `GET /dashboard` - User dashboard
- `GET /projects/new` - Create new project
- `POST /projects` - Save new project
- `GET /projects/:id` - Project details
- `GET /projects/:projectId/windows/new` - Configure a new window
- `POST /projects/:projectId/windows` - Save configured window

### Admin Routes
- `GET /admin/compose-window` - Multi-step window system creator
- `POST /admin/compose-window/compose` - Save new window system
- `GET /admin/window-systems` - List all window systems
- `GET /admin/window-systems/edit/:id` - Edit window system
- `GET /admin/profiles` - Manage profiles
- `GET /admin/glasses` - Manage glass types
- `GET /admin/accessories` - Manage accessories
- `GET /admin/settings` - Cost settings

---

## 🎨 UI/UX Details

### Modern Design System
The admin interface uses a consistent modern design system:
- **Font**: DM Sans (Google Fonts) applied across all admin pages
- **Color Scheme**: Gradient backgrounds (blue to indigo) with color-coded section icons
- **Layout**: Card-based design with shadows, rounded corners, and hover effects
- **Icons**: Gradient icon boxes for each section (amber/orange for accessories, cyan/blue for glasses, indigo/purple for profiles)
- **Buttons**: Modern button styling with icons, hover states, and consistent spacing
- **Forms**: 2-column responsive grid layout for better space utilization
- **Tables**: Modern table design with gradient headers, row hover effects, and badge styling

### Compose Window Form (Admin)
Multi-step wizard with 4 steps:
1. **Basic Info** - Name, type, panel configuration with live visual preview
   - **Window Name Validation**: Real-time check if name already exists in database
   - Operation type selector (sliding, casement, french-door, etc.)
   - Panel count and X/O toggle buttons
   - Draggable dividers for unequal panel sizes
   - French door special configuration (door type, sidelites, transom, hinge side)
   - Resizable preview area
   - VITRALUX logo toggle
2. **Profiles** - Add frame profiles with quantities and length discounts (supports inches/mm)
   - **Component Categories**: Organize profiles by Frame, Fixed Vent, or Operable Vent
   - **Search/Filter**: Type to search profiles by name or color, shows match count
   - **Profile Type Icons**: Visual icons identify profile types (Frame 🔲, Sash 🪟, Mullion ┃, Rail ═, etc.)
   - **Enter to Select**: Press Enter to auto-select when only one result matches
   - **Grouped Table**: Added profiles are organized by component category with visual headers
3. **Accessories** - Add hardware and accessories
4. **Muntins** - Configure decorative grid patterns

### Configure Window Form (User)
- Left side: Form inputs (dimensions, quantity, glass, accessories)
- Right side: Dynamic visual preview with:
  - **Matches admin compose window preview exactly**
  - Aluminum frame and realistic glass appearance
  - Panel layout with X/O indicators
  - Panel ratios displayed as percentages (e.g., "25% | 50% | 25%")
  - French door support (doors, sidelites, transoms, hinges, handles)
  - Operation indicators (arrows for sliding, door icons for casement)
  - VITRALUX logo watermark (if configured)
  - Dimension labels (width/height)
  - Unit toggle (Imperial/Metric)
  - Calculation displays (Area, Perimeter, Aspect Ratio, Glass Area)
  - Preview scales proportionally with entered dimensions

### Unit Handling
- The app supports both **inches** and **mm**
- User can toggle between units
- All calculations are done in inches internally, then converted for display
- When in metric mode:
  - Dimensions show in mm (no decimals)
  - Area shows in sq m
  - Perimeter shows in m
  - Labels adjust position to accommodate longer metric values

---

## 📝 Development Log

### November 27, 2025 - Admin Pages Modernization & Profile Management

#### What We Worked On

1. **Modern Design System Applied Across Admin Pages**
   - **DM Sans Font**: Applied consistently across all admin pages
   - **Gradient Backgrounds**: Modern gradient backgrounds (blue to indigo) for headers and cards
   - **Card-Based Layout**: All pages now use modern card designs with shadows and rounded corners
   - **Color-Coded Section Icons**: Each section has a unique gradient icon (amber/orange for accessories, cyan/blue for glasses, indigo/purple for profiles)
   - **Consistent Button Styling**: Modern buttons with hover effects and icons

2. **Edit Pages Redesign** (`editAccessory.ejs`, `editGlass.ejs`, `editProfile.ejs`)
   - **Clean Header Design**: White background with gradient icon box
   - **2-Column Responsive Layout**: Better use of space on larger screens
   - **Section Icons**: Visual icons for each section (Basic Info, Pricing, etc.)
   - **Modern Input Styling**: Clean input fields with focus states
   - **Required Badges**: Clear "Required" badges for mandatory fields
   - **Help Text**: Contextual help text below inputs
   - **Error Validation**: Improved error message display
   - **Delete Button**: Prominent delete button with confirmation dialog
   - **Weight Field Handling**: Displays "N/A" when weight is null/undefined

3. **List Pages Redesign** (`listAccessories.ejs`, `listGlasses.ejs`, `listProfiles.ejs`)
   - **Modern Header**: Gradient icon box with title and subtitle
   - **Stats Cards**: Visual stat cards showing key metrics:
     - Accessories: Total Accessories, Providers
     - Glasses: Total Glass Types, Missile Types, With Weight Data
     - Profiles: Total Profiles, AMMA Certifications, With Weight Data
   - **Search Bar**: Real-time search with match counter
   - **Currency Toggle**: Toggle between COP and USD for price display
   - **Bulk Actions**: 
     - Checkbox selection for multiple items
     - Bulk delete with confirmation
     - Import from Excel button
     - Export to Excel button
   - **Modern Table Design**:
     - Gradient table header
     - Row hover effects
     - Badge styling for different data types
     - Action buttons with hover states
     - Image thumbnails (for accessories)
   - **Empty State**: Centered empty state with icon and call-to-action
   - **Null Value Handling**: Displays "N/A" for null weight values in both display and export

4. **Add Pages Redesign** (`addAccessory.ejs`, `addGlass.ejs`, `addProfile.ejs`)
   - **Clean Header**: White background with gradient icon box
   - **2-Column Layout**: Responsive grid layout
   - **Section Icons**: Color-coded icons for each section
   - **Modern Card Design**: Consistent card styling
   - **Required Badges**: Clear indication of required fields
   - **Help Text**: Contextual guidance for users
   - **Muntin Configuration Simplified**: 
     - Removed irrelevant fields (spacing, pattern type, pattern description)
     - Now only a toggle switch to indicate if profile is a muntin
   - **AMMA Certification**: Added "No Certification" option to dropdown

5. **Profile Management Enhancements**
   - **Profile Search/Filter**: 
     - Search box to quickly find profiles by name or code
     - Match counter showing number of results
     - Auto-select on Enter when only one result matches
     - Search by color functionality
   - **Profile Type Icons**: Visual icons distinguish profile types (Frame 🔲, Sash 🪟, Mullion ┃, Rail ═, etc.)
   - **Component Categories**: Organize added profiles by category (Frame, Fixed Vent, Operable Vent, Other)
   - **Centered Table Columns**: Information centered in columns (except Profile name which remains left-aligned)
   - **Removed Profile Info Display**: Removed the "Profile Info Display" that showed detected type and color badge
   - **Removed Magnifying Glass**: Removed magnifying glass icon from search input

6. **Data Model Updates**
   - **Weight Field Made Optional**: 
     - `Glass` model: `weight` field changed from `required: true` to `required: false`
     - `Profile` model: `weight` field changed from `required: true` to `required: false`
     - Backend routes handle empty string weight values by converting to `undefined`
     - Frontend displays "N/A" when weight is null/undefined
   - **Muntin Spacing Fix**: Fixed `NaN` error when `muntinSpacing` is empty or invalid
     - Added validation: `!isNaN(Number(muntinSpacing))` before conversion
     - Empty/invalid values set to `null` instead of `NaN`

7. **Excel Import/Export**
   - **Export to Excel**: All list pages support exporting data to Excel format (.xlsx)
   - **Import from Excel**: Import functionality for bulk data entry
   - **Proper Data Handling**: Export correctly handles null values and currency conversion

8. **Window System Management Improvements**
   - **List Window Systems Page**: 
     - Removed "Image" column (replaced with dynamic mini-preview)
     - Removed "Muntins", "Accessories", and "Profiles" columns
     - Removed "Auto/User Config" badges
     - Modern card-based grid layout
     - Dynamic mini-preview based on panel configuration
   - **Edit Window System Page**:
     - Step-based layout matching compose window
     - Removed image upload section
     - Simplified muntin section
     - Added live preview for panel configuration
     - Profile search/filter and component categories
     - Length discount units (in/mm) correctly displayed and changeable
     - "Save & Exit" button for quick saving
     - All operation types available in dropdown
     - All changes properly saved to database

#### Key Files Modified
- `views/admin/editAccessory.ejs` - Modern redesign
- `views/admin/editGlass.ejs` - Modern redesign matching editAccessory
- `views/admin/editProfile.ejs` - Modern redesign matching editAccessory
- `views/admin/listAccessories.ejs` - Modern redesign with search, stats, bulk actions
- `views/admin/listGlasses.ejs` - Modern redesign matching listAccessories
- `views/admin/listProfiles.ejs` - Modern redesign matching listAccessories
- `views/admin/addAccessory.ejs` - Modern redesign
- `views/admin/addGlass.ejs` - Modern redesign matching addAccessory
- `views/admin/addProfile.ejs` - Modern redesign matching addAccessory, simplified muntin config
- `views/admin/listWindowSystems.ejs` - Card-based layout, dynamic preview
- `views/admin/editWindowSystem.ejs` - Step-based layout, live preview, profile search
- `views/admin/composeWindow.ejs` - Profile search/filter, component categories, window name validation
- `routes/admin/profileRoutes.js` - Fixed muntinSpacing NaN error, weight optional handling
- `routes/admin/glassRoutes.js` - Weight optional handling
- `models/Profile.js` - Weight field made optional
- `models/Glass.js` - Weight field made optional

#### Technical Notes
- **Modern Design System**: Consistent use of DM Sans font, gradient backgrounds, card layouts, and modern button styles
- **Null Value Handling**: All pages properly handle null/undefined weight values, displaying "N/A" in UI and exporting empty strings in Excel
- **Excel Export**: Uses SheetJS (XLSX) library for client-side Excel file generation
- **Currency Conversion**: Real-time conversion between COP and USD using exchange rate from CostSettings
- **Bulk Operations**: Checkbox selection system with visual feedback and confirmation dialogs
- **Search Functionality**: Real-time filtering with match counting and keyboard shortcuts (Enter to select)
- **Component Categories**: Profiles organized by Frame, Fixed Vent, Operable Vent, or Other categories
- **Profile Type Detection**: Icons automatically assigned based on profile name patterns

---

### November 27, 2025 - Compose Window Enhancements

#### What We Worked On

1. **Panel Configuration Improvements**
   - Changed panel convention: `X` = Operable, `O` = Fixed (swapped from before)
   - Default panel count now starts at 2
   - Added validation for minimum panels (Single Hung: 2+, Double Hung: 2+, Sliding: 2+)
   - Enforced default orientations: Sliding → horizontal, Single Hung → vertical
   - Fixed operation type cannot have operable panels

2. **Draggable Panel Dividers**
   - Replaced slider with draggable dividers for unequal panel sizes
   - Users can drag mullions between panels to resize them
   - Panel ratios displayed as percentages (e.g., "25% | 50% | 25%")
   - "Reset to equal sizes" button available
   - Works for both Sliding and Single Hung window types

3. **Enhanced Live Preview**
   - Made preview resizable (drag corner to resize, 280×180 to 600×450)
   - Realistic window appearance with aluminum frame and mullions
   - Bluer glass with reflections and depth
   - Darker frame profiles with metallic gradient
   - Visual indicators for draggable dividers (grip dots, hover effects, pulsing animation)
   - VITRALUX logo watermark on glass panels (toggleable via checkbox)
   - **Casement windows** now show realistic hardware:
     - 3 hinges on the hinge side (alternating sides for multi-panel)
     - Handle/crank on the opposite side
     - Subtle swing direction indicators (curved lines)
   - **Sliding/Roller windows** now show realistic hardware:
     - Vertical pull handle on operable panels
     - Rail indicators at top and bottom showing the sliding track
     - Direction arrows indicating sliding motion
   - **Single Hung windows** now show realistic hardware:
     - Lift handles at bottom of operable sash
     - Sash lock at the meeting rail
     - Rail grooves on sides showing the track
     - Up arrow indicator showing sliding direction
     - Prominent meeting rail between sashes

4. **French Door Operation Type**
   - Added new `french-door` operation type
   - Configuration options:
     - Door type: Single or Double
     - Hinge side for single doors (Left/Right - determines opening direction)
     - Left sidelites: 0-4 sidelites
     - Right sidelites: 0-4 sidelites
     - Transom: None, Full Width, Over Door Only
   - Special preview rendering with door-like appearance:
     - Door handles positioned based on hinge side
     - Hinge indicators on door edges
     - Sidelites extend full height when transom is "Over Door Only"
   - VITRALUX logo toggle specific to French doors

5. **Data Persistence**
   - All preview configuration now saved to database
   - Updated `Window.js` model with new fields:
     - `panelRatios` array for unequal sizes
     - `showLogo` boolean
     - `frenchDoor` sub-schema with all French door options
   - Updated `windowRoutes.js` to save/retrieve all new fields

6. **User Configure Window Page Enhanced**
   - Updated `configureWindow.ejs` to match admin preview exactly
   - Dynamic JavaScript rendering based on stored `panelConfiguration`
   - Supports all features:
     - Panel ratios (unequal sizes displayed as percentages)
     - All operation types with correct indicators
     - French doors with transoms, sidelites, door handles, hinges
     - VITRALUX logo display
   - Aluminum frame and glass styling matches compose window
   - Preview updates proportionally with dimension inputs

#### Key Files Modified
- `views/admin/composeWindow.ejs` - Major UI enhancements
- `views/projects/configureWindow.ejs` - Enhanced preview to match admin
- `routes/admin/windowRoutes.js` - Updated data handling
- `models/Window.js` - Extended schema for new features
- `AI_PROJECT_GUIDE.md` - Documentation update

---

### November 25, 2025 - Session Summary

#### What We Worked On

1. **Configure Window Page (`/projects/:projectId/windows/new`)**
   - Dynamic visual preview based on panel configuration
   - Visual shows X (Operable) and O (Fixed) panels
   - Sliding windows show direction arrows
   - Preview scales with dimension inputs

2. **Unit Toggle System**
   - Added Imperial/Metric toggle button in the preview section
   - Both toggles (main form and preview) are synchronized
   - When switching units:
     - Width/height values convert automatically
     - Area changes from sq ft → sq m
     - Perimeter changes from ft → m
     - Glass Area changes from sq ft → sq m
     - Metric values display without decimals
   
3. **Dimension Label Positioning**
   - Made width/height labels always display on one line (`whitespace-nowrap`)
   - Centered the bottom width label with the preview
   - Adjusted vertical height label to move further right in metric mode (longer values)

4. **Compose Window Form (`/admin/compose-window`)**
   - Previously removed "Glass Restrictions" step (Step 5) - validation now happens at configuration time
   - Added unit switcher (inches/mm) for Length Discount in Profiles section
   - Unit locks after first profile is added for consistency
   - Added Panel Configuration section in Step 1:
     - Operation type dropdown
     - Orientation selector
     - Panel count with interactive O/X toggle buttons
     - Mullion settings
     - Live visual preview of panel layout

#### Key Files Modified
- `views/projects/configureWindow.ejs` - User window configuration
- `views/admin/composeWindow.ejs` - Admin window system creator
- `routes/admin/windowRoutes.js` - Backend for window system CRUD
- `models/Window.js` - Added panelConfiguration schema

#### Technical Notes
- `currentUnit` global variable tracks current unit state
- `updateCalculations()` function handles unit-aware display
- `switchUnits()` and `switchUnitsFromPreview()` keep toggles synced
- `updateWindowPreview()` updates visual and calculations on dimension change
- Panel configuration stored as: `{ operationType, orientation, panels: ['X','O','O','X'], panelRatios, hasMullion, mullionWidth, showLogo, frenchDoor }`

#### Compose Window Technical Notes (Admin)
- `panelConfig` array tracks X/O panel types
- `panelRatios` array tracks relative sizes of each panel
- `frenchDoorConfig` object stores French door specific settings
- `updatePanelPreview()` renders the live window preview
- `renderFrenchDoorPreview()` handles French door specific rendering
- `renderCasementPreview()` handles casement window rendering with hinges and handles
- `renderSlidingPreview()` handles sliding window rendering with handles and rail indicators
- `renderSingleHungPreview()` handles single hung window rendering with lift handles and sash locks
- Draggable dividers use mouse events (mousedown, mousemove, mouseup) for resizing
- `createGlassPanel()`, `createDoorPanel()`, `createAluminumMullion()` helper functions for preview elements

#### Configure Window Technical Notes (User)
- `panelConfiguration` loaded from server via `<%- JSON.stringify(selectedWindowSystem.panelConfiguration) %>`
- `renderWindowPreview()` renders panels based on stored configuration
- `renderFrenchDoorPreview()` handles French door specific rendering (mirrors admin version)
- `renderCasementPreview()` handles casement window rendering with hinges and handles
- `renderSlidingPreview()` handles sliding window rendering with handles and rail indicators
- `renderSingleHungPreview()` handles single hung window rendering with lift handles and sash locks
- `getOperationIndicator()` returns appropriate icon for each operation type
- Helper functions create glass panels, door panels, and aluminum mullions
- Preview initializes on DOMContentLoaded and updates with dimension changes

---

## 🚀 Quick Start for AI Assistants

When working on this project:

1. **To understand the data flow**: Start with `models/Window.js` and `models/WindowItem.js`
2. **To modify admin features**: Check `routes/admin/windowRoutes.js` and `views/admin/composeWindow.ejs`
3. **To modify user features**: Check `routes/projectRoutes.js` and `views/projects/configureWindow.ejs`
4. **For styling**: The project uses Tailwind CSS classes
5. **For dynamic behavior**: JavaScript is embedded in EJS templates (bottom of files)

### Common Patterns
- Unit conversion: `inchesToMm()` and `mmToInches()` helper functions
- Form data is often passed as JSON strings and parsed on the backend
- Dynamic previews update via JavaScript functions called on input change
- Tailwind classes are used for conditional styling (toggle active states, positioning)

---

## 🔗 Useful Commands

```bash
# Start the application
npm start

# Development with auto-reload
npm run dev

# The app runs on http://localhost:3000
```

---

*Last Updated: November 27, 2025 - Admin Pages Modernization*

