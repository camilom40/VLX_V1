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
- **Name & Type**: e.g., "Horizontal Roller", "Casement"
- **Profiles**: Frame components with pricing, weight, length discounts
- **Accessories**: Hardware, handles, locks, etc.
- **Muntin Configuration**: Grid patterns for decorative glass divisions
- **Panel Configuration**: Defines the window layout (e.g., OXXO for sliding)
  - `operationType`: sliding, casement, awning, fixed, etc.
  - `orientation`: horizontal or vertical
  - `panels`: Array of 'O' (Operable) and 'X' (Fixed) panels
  - `hasMullion`: Whether mullions exist between panels
  - `mullionWidth`: Width of mullions

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
  type: String, // e.g., 'horizontal-roller', 'casement'
  profiles: [{ profile: ObjectId, quantity: Number, lengthDiscount: Number }],
  accessories: [{ accessory: ObjectId, quantity: Number, isOptional: Boolean }],
  muntinConfiguration: { type: String, horizontalBars: Number, verticalBars: Number, ... },
  panelConfiguration: {
    operationType: String,  // 'sliding', 'casement', 'fixed', etc.
    orientation: String,    // 'horizontal' or 'vertical'
    panels: [String],       // ['O', 'X', 'X', 'O'] for OXXO
    hasMullion: Boolean,
    mullionWidth: Number
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
  code: String,
  price: Number,
  weight: Number,
  color: String,
  type: String,        // 'frame', 'sash', 'muntin', etc.
  isMuntin: Boolean,
  amaCertified: Boolean
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

### Compose Window Form (Admin)
Multi-step wizard with 4 steps:
1. **Basic Info** - Name, type, panel configuration with visual preview
2. **Profiles** - Add frame profiles with quantities and length discounts (supports inches/mm)
3. **Accessories** - Add hardware and accessories
4. **Muntins** - Configure decorative grid patterns

### Configure Window Form (User)
- Left side: Form inputs (dimensions, quantity, glass, accessories)
- Right side: Dynamic visual preview with:
  - Panel layout visualization
  - Dimension labels (width/height)
  - Unit toggle (Imperial/Metric)
  - Calculation displays (Area, Perimeter, Aspect Ratio, Glass Area)

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

### November 25, 2025 - Session Summary

#### What We Worked On

1. **Configure Window Page (`/projects/:projectId/windows/new`)**
   - Dynamic visual preview based on panel configuration
   - Visual shows O (Operable) and X (Fixed) panels
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
- Panel configuration stored as: `{ operationType, orientation, panels: ['O','X','X','O'], hasMullion, mullionWidth }`

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

*Last Updated: November 25, 2025*

