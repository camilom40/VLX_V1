# VLX-ESTIMATOR - AI Project Guide - by camilo mejia

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
- **Calculation Details Modal**: Detailed breakdown of all cost components
- **Workshop Modal**: Production information showing quantity and length of each profile, accessory, and glass

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
  profiles: [{ 
    profile: ObjectId, 
    quantity: Number, 
    quantityEquation: String,  // Optional equation for dynamic quantity
    lengthEquation: String,    // Optional equation for dynamic length (e.g., "width", "height-(38*2)")
    lengthDiscount: Number, 
    showToUser: Boolean,
    position: String           // Optional position identifier (e.g., "sill", "stile", "head")
  }],
  accessories: [{ 
    accessory: ObjectId, 
    quantity: Number, 
    quantityEquation: String,  // Optional equation for dynamic quantity
    isOptional: Boolean,
    showToUser: Boolean
  }],
  muntinConfiguration: { type: String, horizontalBars: Number, verticalBars: Number, ... },
  flangeConfiguration: {
    hasFlange: Boolean,
    flangeSize: String,        // e.g., "1/2"
    isTrimable: Boolean
  },
  missileImpactConfiguration: {
    lmiCompatibleGlasses: [ObjectId],  // Glasses compatible with Large Missile Impact
    smiCompatibleGlasses: [ObjectId],  // Glasses compatible with Small Missile Impact
    glassWidthEquation: String,        // Optional equation for glass width (e.g., "width - 20")
    glassHeightEquation: String        // Optional equation for glass height (e.g., "height - 20")
  },
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
  projectId: ObjectId,
  itemName: String, // Unique within project (e.g., "V1", "W1", "D1")
  width: Number, // In inches
  height: Number, // In inches
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number, // Calculated automatically
  material: String,
  color: String,
  style: String,
  description: String,
  // ... other fields
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

### Window System Profiles (in Window model)
```javascript
{
  profile: ObjectId,           // Reference to Profile
  quantity: Number,             // Fixed quantity or calculated from quantityEquation
  quantityEquation: String,    // Optional equation for dynamic quantity (e.g., "2 * height")
  lengthEquation: String,      // Optional equation for dynamic length (e.g., "width", "height-(38*2)")
  lengthDiscount: Number,      // Optional length discount (in inches)
  showToUser: Boolean,         // Whether user can configure this profile
  position: String             // Optional position identifier (e.g., "sill", "stile", "head")
}
```

### Glass
```javascript
{
  glass_type: String,
  description: String,
  missile_type: String,  // 'LMI' or 'SMI'
  pricePerSquareMeter: Number,
  currency: String,      // 'COP' or 'USD'
  weight: Number,        // Optional (kg/m²)
  isLowE: Boolean,       // Low Emissivity coating (default: false)
  color: String          // Glass tint/color (e.g., Clear, Bronze, Blue, Gray) (default: '')
}
```

### User
```javascript
{
  username: String,        // Unique, required
  password: String,        // Hashed with bcrypt, required
  plainPassword: String,   // Stored for admin reference
  role: String,            // 'admin' or 'user', required
  pricingTier: String,     // 'tier1', 'tier2', 'tier3', 'tier4', or ''
  lastLogin: Date,         // Last login timestamp
  companyName: String,     // Required
  email: String,           // Required, validated
  firstName: String,       // Required
  lastName: String,        // Required
  city: String,            // Optional
  isActive: Boolean,       // Default: true, controls account access
  companyLogo: String,     // Path to uploaded company logo file
  createdAt: Date,         // Automatic timestamp
  updatedAt: Date          // Automatic timestamp
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
- `GET /dashboard` - User dashboard (displays company logo)
- `GET /projects` - List all user projects
- `GET /projects/new` - Create new project
- `POST /projects` - Save new project
- `GET /projects/:id` - Project details (with company logo, window items table)
- `GET /projects/:id/quote-preview` - Quote preview popup
- `GET /projects/:id/quote-pdf` - Download quote as PDF (accepts `unit` query param)
- `GET /projects/:projectId/windows/new` - Configure a new window
- `POST /projects/:projectId/windows/save` - Save configured window
- `POST /projects/:projectId/windows/:windowId/update` - Update configured window
- `POST /projects/:projectId/items/:itemId/duplicate` - Duplicate window item
- `POST /projects/:projectId/items/:itemId/delete` - Delete window item

### Admin Routes
- `GET /admin/compose-window` - Multi-step window system creator
- `POST /admin/compose-window/compose` - Save new window system
- `GET /admin/window-systems` - List all window systems
- `GET /admin/window-systems/edit/:id` - Edit window system
- `GET /admin/profiles` - Manage profiles
- `GET /admin/glasses` - Manage glass types
- `GET /admin/accessories` - Manage accessories
- `GET /admin/settings` - Cost settings
- `GET /admin/users` - List all users
- `GET /admin/users/add` - Add new user form
- `POST /admin/users/add` - Create new user
- `GET /admin/users/:id` - User detail/edit page
- `POST /admin/users/:id/update` - Update user
- `POST /admin/users/toggle-active` - Toggle user active status (AJAX)
- `POST /api/upload-logo` - Upload company logo (saves to user.companyLogo)

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

### December 2025 - Project Pages, User Management & Quote System Enhancements

#### What We Worked On

1. **Company Logo Management**
   - **Database Storage**: Company logos now stored in `user.companyLogo` field instead of file system
   - **Consistent Display**: Logo retrieval unified across all pages (dashboard, project details, quote preview)
   - **Upload Handler**: Logo upload route saves path to user record and deletes old logo file
   - **Logo Display**: Company logo appears in project details header and quote preview

2. **Project Pages Modernization**
   - **Projects List Page** (`/projects`):
     - Modern design matching admin pages (DM Sans font, gradient backgrounds, card layouts)
     - Stats cards showing project count and total value
     - Search functionality
     - Responsive table/card view toggle
   - **Project Details Page** (`/projects/:id`):
     - Modern header with gradient icon box, project name, client info
     - Stats cards: Window Items count, Total Project Value, Created/Updated dates
     - Company logo display in header
     - Sidebar layout: "Add New Window" form on left, full-width table on right
     - Window items table with mini preview diagrams
     - Unit toggle (inches/mm) with local storage persistence
     - Dimensions in millimeters display as whole numbers (no decimals)
     - Reordered columns: Item Name before Preview image
     - Removed "Available Window Systems" info section
     - Action buttons: Edit, Duplicate, Delete for each window item

3. **Quote Preview System**
   - **Popup Window**: Quote preview opens in popup window (not new tab)
   - **Valid Through Date**: Automatically calculated (one month after quote date)
   - **PDF Export**: Download quote as PDF with unit selection (inches/mm)
   - **Preview Column**: Mini window diagrams matching compose window styling
   - **Description Column**: Added to quote preview table
   - **Unit Toggle**: Inches/mm toggle with persistence, affects PDF export
   - **Styling**: Matches modern admin design system

4. **Window Item Management**
   - **Item Name Editing**: Window reference/item name field is now editable in configure window form
     - Field placed at top of form with full width
     - Required field with validation
   - **Duplicate Functionality**: 
     - Duplicate button (copy icon) next to edit button
     - Automatically generates unique names: "Item Name (2)", "Item Name (3)", etc.
     - Server-side validation prevents duplicate item names within a project
   - **Unique Name Validation**: 
     - Prevents duplicate item names when creating new items
     - Prevents duplicate names when editing existing items (excluding current item)
   - **Preview Rendering**: 
     - Fixed preview for "Single Hung - 2 Equal Lites" windows
     - Specialized rendering logic for single-hung operation type
     - Mini previews in project details table match compose window styling

5. **User Management System Overhaul**
   - **New User Fields**:
     - `companyName` (required) - Company name field
     - `email` (required) - Email address with validation
     - `firstName` (required) - Person's first name
     - `lastName` (required) - Person's last name
     - `city` (optional) - City location
     - `isActive` (Boolean, default: true) - Account active/inactive status
     - `createdAt` / `updatedAt` - Automatic timestamps
   - **User List Page** (`/admin/users`):
     - Modern design matching admin pages
     - Simplified table columns: Company, Username, Last Login, Created, Last Activity, Active, Actions
     - Removed columns: Pricing, Projects, User (moved to detail page)
     - Active/Inactive toggle switch with real-time AJAX updates
     - Inactive users displayed with reduced opacity
     - Clickable rows navigate to user detail page
     - Mobile-responsive card view
   - **User Detail Page** (`/admin/users/:id`):
     - Dedicated page for viewing/editing individual users
     - Left column: Editable fields (Username, Company Name, First Name, Last Name, Email, City, Role, Pricing Tier, Active Status)
     - Right column: Statistics (Total Projects, Total Project Value, Last Login, Created Date, Last Activity)
     - Activity History section showing recent user activities
     - Recent Projects section with links to user's projects
     - Password change modal
   - **Add User Page** (`/admin/users/add`):
     - Modern design matching admin pages
     - Field order: Company Name, First Name, Last Name, Email, City, Username, Password, Role, Pricing Tier
     - All required fields marked with red asterisk
     - Email validation (regex)
     - Password generator functionality
   - **Account Activation System**:
     - `isActive` field controls user access
     - Inactive users cannot log in
     - Middleware checks active status on authentication
     - Admin can toggle active status via AJAX (no page reload)
     - Reactivation script available for admin accounts

6. **Unit Conversion Improvements**
   - **Unit Toggle**: Inches/mm toggle on projects page and project details page
   - **Local Storage Persistence**: Unit preference saved in browser local storage
   - **Dimension Display**: 
     - Dimensions in millimeters show as whole numbers (no decimals)
     - Dimensions in inches show with decimals
   - **PDF Export**: Unit selection from preview affects PDF export
   - **Consistent Display**: Unit selection persists across page navigation

7. **Layout & UX Improvements**
   - **Project Details Layout**: Sidebar for "Add New Window" form, full-width main area for table
   - **Table Organization**: Better column ordering and spacing
   - **Window Preview Styling**: Preview images match compose window page (aluminum frame, realistic glass)
   - **Button Styling**: Consistent button styles across all pages
   - **Form Organization**: Better field grouping and visual hierarchy

#### Key Files Modified
- `models/User.js` - Added companyName, email, firstName, lastName, city, isActive fields, timestamps
- `routes/projectRoutes.js` - Company logo from database, quote PDF route, duplicate item route, unique name validation
- `routes/admin/windowRoutes.js` - User management routes, toggle active status, user detail page, aggregation queries
- `routes/authRoutes.js` - Active user check on login
- `routes/middleware/authMiddleware.js` - Active user check in authentication middleware
- `routes/middleware/adminMiddleware.js` - Active user check in admin middleware
- `views/projects/listProjects.ejs` - Modern design, stats cards, search
- `views/projects/projectDetails.ejs` - Modern design, sidebar layout, unit toggle, duplicate button, preview improvements
- `views/projects/quotePreview.ejs` - Popup window, valid through date, PDF export, unit toggle
- `views/projects/configureWindow.ejs` - Editable item name field, preview rendering fixes
- `views/admin/users.ejs` - Simplified table, active toggle, clickable rows
- `views/admin/userDetail.ejs` - New dedicated user detail/edit page
- `views/admin/addUser.ejs` - Modern design, new fields (company, email, first name, last name, city)
- `server.js` - Logo upload saves to user.companyLogo field
- `scripts/reactivate_admin.js` - Script to reactivate admin accounts

#### Technical Notes
- **Company Logo**: Stored in `user.companyLogo` field as file path, retrieved from database instead of file system
- **Unique Item Names**: Server-side validation ensures no duplicate item names within a project
- **Active User System**: `isActive` field prevents login and access for inactive users
- **AJAX Toggle**: Active status toggled via AJAX without page reload, updates both desktop and mobile hidden inputs
- **User Aggregation**: Efficient MongoDB aggregation queries for project counts, total values, and last activity
- **Unit Persistence**: Local storage key `dimensionUnit` stores user preference (inches/mm)
- **PDF Generation**: Quote PDF route accepts `unit` query parameter for dimension formatting
- **Window Preview**: Specialized rendering functions for different operation types (single-hung, casement, sliding, french-door)

---

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

## December 2025 - Glass Model Enhancements & Project Details Table Reorganization

### What We Worked On

1. **Glass Model Enhancements**
   - **Low E Field**: Added `isLowE` boolean field to indicate if glass has Low Emissivity coating
   - **Glass Color Field**: Added `color` string field to store glass tint/color (e.g., Clear, Bronze, Blue, Gray)
   - **UI Updates**: Added checkbox for Low E and text input for color on both add and edit glass pages
   - **List Table**: Added Color column to the glass management table with pink badge styling
   - **Excel Export**: Updated export functionality to include color field

2. **Project Details Table Reorganization**
   - **Removed Dimensions Column**: Dimensions moved into description column
   - **Structured Description Column**: Description now displays all specification details in organized format:
     - Dimensions (Width and Height with unit toggle support)
     - Missile Impact Rating
     - Aluminum Color
     - Glass Type (with full description)
     - Glass Color
     - Low E status
   - **Improved Table Layout**:
     - Better column width management
     - Consistent padding and alignment
     - Cleaner visual hierarchy
     - Compact, organized specification display
   - **Enhanced Styling**:
     - Fixed-width labels for alignment
     - Better spacing with `space-y-1.5`
     - Improved quantity badge (circular with centered text)
     - Better price formatting

#### Key Files Modified
- `models/Glass.js` - Added `isLowE` and `color` fields
- `routes/admin/glassRoutes.js` - Updated to handle new fields in add/update routes
- `views/admin/addGlass.ejs` - Added Low E checkbox and color input field
- `views/admin/editGlass.ejs` - Added Low E checkbox and color input field with pre-population
- `views/admin/listGlasses.ejs` - Added Color column to table, updated search and export
- `views/projects/projectDetails.ejs` - Reorganized table structure, moved dimensions to description column, improved layout and styling

#### Technical Notes
- **Glass Color**: Optional field, displayed as pink badge in list table when present
- **Low E**: Boolean field, displayed as "YES" or "NO" in project details
- **Description Parsing**: Glass information is parsed from description field in window items
- **Table Organization**: Description column uses flex layout with fixed-width labels for consistent alignment
- **Unit Toggle**: Dimension display in description column supports inches/mm toggle

---

## December 2025 - Global Preferences, Pricing Fixes & Window System Enhancements

### What We Worked On

1. **Global Currency and Unit Toggle System**
   - **Header Toggles**: Added persistent currency (COP/USD) and unit (inches/mm) toggle buttons in the main header (`_header.ejs`)
   - **Global Preferences**: Preferences stored in `localStorage` with keys `globalCurrency` and `globalUnit`
   - **Event System**: Custom events (`currencyChanged`, `unitChanged`) dispatched when toggles change
   - **Consistent Display**: All pages listen to global events and update displays accordingly
   - **Removed Local Toggles**: Removed redundant currency/unit toggles from individual pages:
     - `projectDetails.ejs` - Removed local currency toggle
     - `configureWindow.ejs` - Removed local currency and unit toggles
     - `quotePreview.ejs` - Removed local unit toggle
     - Admin list pages - Removed local currency toggles
   - **Integration**: All admin pages (list glasses, profiles, accessories) and window system creation/editing pages now use global preferences

2. **Pricing Calculation System Overhaul**
   - **Currency Consistency**: All internal calculations now performed in USD
   - **Database Storage**: All prices stored in USD in database (`unitPrice`, `totalPrice`)
   - **Currency Conversion Fix**: Fixed critical bug where accessories and muntins were using `convertToCOP` instead of `convertToUSD`, causing calculation mismatches
   - **Explicit totalPrice**: Set `totalPrice` explicitly in save/update routes to avoid rounding issues from pre-save hooks
   - **Calculation Matching**: Frontend and backend calculations now match exactly
   - **Unit Price Display**: Added "Unit Price" field in pricing summary on edit window page to match table display
   - **Validation**: Updated price validation to use USD-based limits ($1.5M USD per unit)

3. **Window System Enhancements**
   - **Flange Configuration**: 
     - Added flange options to window system creation (`composeWindow.ejs`)
     - Fields: `hasFlange` (boolean), `flangeSize` (string, e.g., "1/2"), `isTrimable` (boolean)
     - Flange size required when flange is enabled
     - Displayed in window item description as "Flanged: 1/2""
     - Shown on project details page below "Low E" (grayed out if "N/A")
   - **Missile Impact Configuration**:
     - Moved from glass-level to window system level
     - Window systems can specify which glass types are compatible with Large Missile Impact (LMI) and Small Missile Impact (SMI)
     - Multi-select dropdowns for LMI and SMI compatible glasses
     - Step 4 in window system creation: "Missile Type Configuration"
     - Step 5 renamed to "Others" (contains Muntins and Flange)
   - **Glass Model Update**: 
     - `missile_type` field in Glass model made optional (no longer required)
     - Removed missile type from glass management pages (add, edit, list)

4. **Window Configuration Flow**
   - **Missile Type Selection**: Users must select missile type (LMI or SMI) before selecting glass type
   - **Dynamic Glass Filtering**: Glass type dropdown populated only with glasses compatible with selected missile type
   - **Edit Mode**: Missile type and glass type pre-selected based on window item description
   - **Description Updates**: Missile impact type included in window item description

5. **Project Details Page Improvements**
   - **Dimension Separator**: Changed from "|" to "×" for dimension display
   - **Column Width Adjustments**: 
     - Item column: Reduced from `w-24` to `w-16`
     - Description column: Reduced from `min-w-96` to `min-w-48`
     - Preview column: Increased from `w-32` to `w-48`
   - **Preview Image Size**: Increased from 100×75px to 160×120px
   - **Flange Display**: Shows flange size below "Low E" (grayed out if "N/A")
   - **Price Formatting**: Prices formatted based on global currency preference
   - **Unit Display**: Dimensions formatted based on global unit preference

6. **Pricing Summary & Calculation Details**
   - **Calculation Breakdown Modal**: "Show Calculation Details" button displays detailed breakdown
   - **Pricing Summary**: Shows unit price and total price in pricing summary section
   - **Consistent Calculations**: All pricing calculations use same logic (frontend and backend)

#### Key Files Modified
- `views/partials/_header.ejs` - Added global currency and unit toggle buttons with event system
- `views/projects/projectDetails.ejs` - Removed local toggles, integrated global preferences, improved layout, added flange display
- `views/projects/configureWindow.ejs` - Removed local toggles, integrated global preferences, added unit price display, fixed pricing calculations
- `views/projects/quotePreview.ejs` - Removed local unit toggle, integrated global preferences
- `views/admin/composeWindow.ejs` - Added flange and missile impact configuration, integrated global unit preferences for length discounts
- `views/admin/editWindowSystem.ejs` - Added flange and missile impact configuration, integrated global unit preferences
- `views/admin/listGlasses.ejs` - Removed missile type column, integrated global currency preferences
- `views/admin/listProfiles.ejs` - Integrated global currency preferences
- `views/admin/listAccessories.ejs` - Integrated global currency preferences
- `routes/projectRoutes.js` - Fixed currency conversion (all calculations in USD), explicit totalPrice setting, added flange and missile type to description
- `routes/admin/windowRoutes.js` - Added flange and missile impact configuration handling
- `models/Window.js` - Added `flangeConfiguration` and `missileImpactConfiguration` schemas
- `models/Glass.js` - Made `missile_type` optional
- `utils/currencyConverter.js` - Enhanced with `convertToUSD` function

#### Technical Notes
- **Global Preferences**: Stored in `window.globalPreferences` object, initialized on `DOMContentLoaded`
- **Event System**: Custom events allow pages to react to preference changes without direct coupling
- **Currency Conversion**: All input prices converted to USD using `convertToUSD()` before calculations
- **Price Storage**: All prices stored in USD in database, converted for display using `formatCurrency()`
- **Unit Conversion**: Frontend displays in selected unit, but all values converted to inches before sending to backend
- **Flange Display**: Extracted from description using regex, displayed with single inch symbol (")
- **Missile Impact**: Window systems define compatible glasses, users select missile type first, then compatible glasses are filtered
- **Calculation Consistency**: Frontend `calculatePricingWithUnits()` matches backend calculation logic exactly

#### Migration Notes
- **Price Migration**: Existing prices in database may need migration from COP to USD (script: `scripts/migratePricesToUSD.js`)
- **Window Systems**: Existing window systems may need to be updated with new flange and missile impact configurations
- **Glass Types**: Existing glass types with `missile_type` field will continue to work (field is now optional)

---

## December 2025 - Inline Editing & Validation Enhancements

### What We Worked On

1. **Inline Editing for Item Names**
   - **Click-to-Edit**: Item names on the project details page can now be edited directly by clicking on them
   - **Real-time Validation**: Checks for duplicate names (case-insensitive) as user types
   - **Visual Feedback**: 
     - Yellow background while saving
     - Green background on success
     - Red background on error with error message
   - **API Endpoint**: `PATCH /projects/:projectId/items/:itemId/name`
   - **Case-Insensitive Validation**: "V1" and "v1" are considered the same name
   - **Works on Both Views**: Mobile card view and desktop table view

2. **Inline Editing for Quantity**
   - **Click-to-Edit**: Quantity values can be edited directly on the project details page
   - **Automatic Price Recalculation**: When quantity changes, the item's total price is automatically recalculated (unitPrice × quantity)
   - **Project Total Update**: Project total is automatically updated when quantity changes
   - **Validation**: Only accepts positive integers
   - **API Endpoint**: `PATCH /projects/:projectId/items/:itemId/quantity`
   - **Price Display Updates**: Both unit price and total price displays update correctly

3. **Real-time Name Validation in Configure Window Form**
   - **Debounced Validation**: Checks for duplicate names 500ms after user stops typing
   - **Error Display**: Shows error message immediately below the input field
   - **Form Submission Prevention**: Prevents form submission if name is duplicate
   - **Scroll to Error**: When form is submitted with duplicate name, page scrolls to top and highlights the error
   - **Edit Mode Support**: Excludes current item when checking for duplicates in edit mode
   - **API Endpoint**: `GET /projects/:projectId/check-item-name` (excludes current item if editing)

4. **Case-Insensitive Item Name Validation**
   - **All Validation Points Updated**: Item name validation now case-insensitive throughout the application
   - **Regex Pattern**: Uses MongoDB regex with `i` flag for case-insensitive matching
   - **Updated Routes**:
     - `POST /projects/:projectId/windows/save` - New window creation
     - `POST /projects/:projectId/windows/:windowId/update` - Window update
     - `PATCH /projects/:projectId/items/:itemId/name` - Name update
     - `GET /projects/:projectId/check-item-name` - Name validation check

5. **UI/UX Improvements**
   - **Hover Effects**: Item names and quantities show hover effects to indicate they're editable
   - **Input Field Styling**: Larger, more visible input fields with proper padding and font size
   - **Focus Management**: Input fields are automatically focused and selected when editing starts
   - **Keyboard Support**: 
     - Enter key to save
     - Escape key to cancel
     - Click outside (blur) to save
   - **Loading States**: Shows "Saving..." while updating
   - **Error Messages**: Clear error messages displayed below input fields

#### Key Files Modified
- `routes/projectRoutes.js` - Added PATCH endpoints for name and quantity updates, updated all name validation to be case-insensitive
- `views/projects/projectDetails.ejs` - Added inline editing JavaScript for item names and quantities, updated HTML to support editing
- `views/projects/configureWindow.ejs` - Added real-time name validation, scroll-to-error functionality

#### Technical Notes
- **Case-Insensitive Validation**: Uses MongoDB regex pattern `new RegExp(\`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$\`, 'i')` to match names regardless of case
- **API Response Format**: All API endpoints return JSON with `success`, `error`, and relevant data fields
- **Price Recalculation**: Quantity updates trigger automatic total price recalculation on the server, frontend updates displays accordingly
- **Event Handling**: Uses event delegation and debouncing for efficient real-time validation
- **Total Price Update**: When quantity changes, the element with class `text-green-700[data-price]` or `text-green-600[data-price]` is specifically targeted to update total price display

---

## December 2025 - Accessory Quantity Equations & Dashboard Currency Conversion

### What We Worked On

1. **Accessory Quantity Equations**
   - **Dynamic Quantity Calculation**: Accessories in window systems can now use equations instead of fixed quantities
   - **Equation Variables**: Supports `width`, `height`, `perimeter` (2*(width+height)), and `area` (width*height) as variables
   - **UI Enhancement**: Added "Quantity Type" selector (Fixed Quantity / Equation) in the compose window form
   - **Equation Input**: Text input field with placeholder examples and variable documentation
   - **Real-time Validation**: 
     - Validates variable names as user types (only allows valid variables: width, height, perimeter, area)
     - Validates equation syntax with sample values (width=10, height=20)
     - Shows visual feedback: green border for valid equations, red border for invalid
     - Displays preview calculation result with sample values
     - Error messages for invalid variables or syntax errors
   - **Backend Evaluation**: Added `evaluateQuantityEquation()` helper function that safely evaluates equations during pricing calculations
   - **Use Cases**: 
     - Weather stripping: `5 * height`
     - Gasket: `2 * perimeter`
     - Any custom formula based on window dimensions
   - **Equation Storage**: Equations stored in `quantityEquation` field in Window model (quantity field becomes optional when equation is provided)
   - **Display**: Equations shown in blue with monospace font in the accessories table

2. **Dashboard Currency Conversion**
   - **Currency Toggle Integration**: Dashboard now responds to global currency changes from header toggle
   - **Real-time Updates**: Project values update instantly when currency is switched between COP and USD
   - **Exchange Rate Integration**: Uses exchange rate from server for accurate conversion
   - **Visual Updates**: All project value displays update dynamically without page reload
   - **Data Attributes**: Project values stored with `data-value-usd` attributes for accurate conversion

#### Key Files Modified
- `models/Window.js` - Added `quantityEquation` field to accessories schema (optional string, quantity made optional when equation present)
- `views/admin/composeWindow.ejs` - Added quantity type selector, equation input field, real-time validation, and equation display in table
- `routes/admin/windowRoutes.js` - Updated create and update routes to handle `quantityEquation` field
- `routes/projectRoutes.js` - Added `evaluateQuantityEquation()` function, updated all accessory cost calculation locations to evaluate equations
- `views/dashboard.ejs` - Added currency conversion JavaScript, data attributes for project values
- `routes/dashboardRoutes.js` - Added exchange rate to dashboard route

#### Technical Notes
- **Equation Evaluation**: Uses Function constructor with strict mode for safe evaluation (prevents code injection)
- **Variable Replacement**: Variables replaced with actual values before evaluation (case-insensitive)
- **Validation**: Real-time validation with debouncing (300ms delay) to reduce API calls
- **Error Handling**: Comprehensive error handling for invalid variables, syntax errors, and invalid results
- **Equation Scope**: Equations only evaluated for auto-managed accessories (user-configurable accessories use user input quantities)
- **Currency Conversion**: All values stored in USD, converted to display currency (COP/USD) using exchange rate
- **Preview Calculation**: Sample calculation shown with width=10, height=20 for user feedback

#### Example Equations
- `5 * height` - Weather stripping (5 times the window height)
- `2 * perimeter` - Gasket (2 times the window perimeter)
- `width + height` - Sum of dimensions
- `3.5 * width` - Custom multiplier
- `perimeter / 2` - Half the perimeter

---

## January 2026 - Profile Length Equations, Workshop Modal & Price Calculation Fixes

### What We Worked On

1. **Profile Length Equations with Unit Conversion**
   - **Equation Support**: Profile lengths can now be calculated using mathematical equations instead of fixed values
   - **Equation Variables**: Supports `width`, `height`, `perimeter` (2*(width+height)), and `area` (width*height) as variables
   - **Numeric Constant Conversion**: Numeric constants in equations (e.g., `38` in `height-(38*2)`) are automatically converted from mm to inches, as equations are written with mm constants
   - **Multiplier Detection**: Smart detection prevents conversion of multipliers (e.g., `2` in `38*2` is not converted, only `38` is converted)
   - **Unit-Aware Validation**: Equation validation shows preview calculations in the current unit (inches/mm)
   - **Dynamic Unit Display**: Equation input labels update to show current global unit preference
   - **Backend Matching**: Backend `evaluateLengthEquation()` function now matches frontend behavior exactly, always converting numeric constants from mm to inches

2. **Glass Dimension Equations**
   - **Separate Width/Height Equations**: Replaced single `glassSizeEquation` with separate `glassWidthEquation` and `glassHeightEquation` fields
   - **Step 4 Renamed**: "Missile Type Configuration" renamed to "Glass Configuration" for clarity
   - **Equation Support**: Glass dimensions can now be calculated using equations (e.g., "width - 20", "height - 20")
   - **Real-time Validation**: Equation validation with preview calculations and unit-aware display
   - **Glass Cost Calculation**: Glass cost now uses calculated dimensions from equations instead of window dimensions
   - **Workshop Display**: Calculated glass dimensions (width and height in inches) shown in workshop modal

3. **Workshop Modal for Production Details**
   - **New Modal**: Added "Workshop" button below "Calculation Details" on configure window page
   - **Production Information**: Displays quantity and length for each profile, accessory, and glass component
   - **Unit Display**: Shows lengths in both inches and meters for production use
   - **Component Breakdown**: 
     - Profiles: Name, quantity, length (inches/meters), position (if specified)
     - Accessories: Name, quantity
     - Glass: Type, calculated width/height (inches), area (square meters), equations used
   - **Workshop-Ready Format**: Information formatted for production team use

4. **Price Calculation Consistency Fixes**
   - **Frontend-Backend Matching**: Fixed critical discrepancy where frontend showed $112.87 but backend saved $107.75
   - **Root Cause**: Backend's `evaluateLengthEquation()` was not converting numeric constants from mm to inches, causing incorrect profile length calculations
   - **Profile Cost Fix**: Profile costs now match between frontend and backend calculations
   - **WindowItem Model Fix**: Updated pre-save hook to preserve `totalPrice` when explicitly set, preventing recalculation from rounded `unitPrice`
   - **Price Precision**: `totalPrice` is now set directly from `finalPrice` to maintain precision, with `unitPrice` calculated from `totalPrice` for display

5. **Profile Position Field**
   - **New Field**: Added `position` field to profiles in window systems (informative field)
   - **Examples**: "sill", "stile", "head" - helps identify profile location in window assembly
   - **Database Storage**: Position stored in Window model's profiles sub-schema
   - **Display**: Position shown in workshop modal for production reference
   - **UI**: Position field added to compose window and edit window system forms (text input for flexibility)

6. **Form Validation & Error Fixes**
   - **Hidden Required Fields**: Fixed "An invalid form control with name='' is not focusable" error by removing `required` attribute from hidden profile-length-equation inputs
   - **Manual Validation**: Added JavaScript validation for length equations before form submission
   - **Exchange Rate Reference**: Fixed `ReferenceError: exchangeRate is not defined` by using correct variable name `exchangeRateValue`
   - **Calculation Modal Errors**: Fixed `Cannot read properties of undefined (reading 'toFixed')` by ensuring all calculation details are properly initialized

7. **Calculation Details Modal Improvements**
   - **Error Handling**: Fixed undefined value errors in calculation details modal
   - **Profile Details**: All profile calculation details now properly displayed (length, discount, adjusted length)
   - **Workshop Integration**: Workshop modal complements calculation details with production-focused information

#### Key Files Modified
- `views/projects/configureWindow.ejs` - Added workshop modal, fixed unit conversion in evaluateLengthEquation, fixed form validation, added position field support, added glass dimension equation evaluation and display
- `views/admin/composeWindow.ejs` - Added position field, fixed unit conversion in length equation validation, removed required attribute from hidden inputs, renamed Step 4 to "Glass Configuration", added separate glass width/height equation fields
- `views/admin/editWindowSystem.ejs` - Added position field, fixed unit conversion in length equation validation, removed required attribute from hidden inputs, renamed Step 4 to "Glass Configuration", added separate glass width/height equation fields
- `routes/projectRoutes.js` - Updated evaluateLengthEquation to always convert numeric constants from mm to inches, fixed price calculation consistency, added glass dimension equation evaluation for glass cost calculation
- `models/WindowItem.js` - Updated pre-save hook to preserve totalPrice when explicitly set
- `models/Window.js` - Added position field to profiles sub-schema, replaced glassSizeEquation with glassWidthEquation and glassHeightEquation in missileImpactConfiguration
- `routes/admin/windowRoutes.js` - Updated to save/retrieve position field for profiles, updated to save/retrieve glassWidthEquation and glassHeightEquation
- `routes/admin/profileRoutes.js` - Updated to handle position field (if needed)

#### Technical Notes
- **Equation Evaluation**: Both frontend and backend now use identical logic for evaluating length equations
- **Unit Conversion**: Numeric constants in equations are always converted from mm to inches (equations written with mm constants)
- **Multiplier Detection**: Regex-based detection identifies multipliers (right operand of * or /) to avoid incorrect conversion
- **Price Precision**: totalPrice stored with full precision, unitPrice rounded to 2 decimals for display
- **Pre-Save Hook Logic**: WindowItem model checks if totalPrice was explicitly set (differs from unitPrice*quantity by more than 1 cent) and preserves it
- **Workshop Data**: Workshop modal uses same calculation data as pricing, ensuring consistency
- **Position Field**: Optional text field, allows any value (not restricted to specific options for flexibility)

#### Example Length Equations
- `width` - Profile length equals window width
- `height-(38*2)` - Profile length equals height minus 76mm (38mm on each side)
- `perimeter / 2` - Profile length equals half the perimeter
- `width + 50` - Profile length equals width plus 50mm
- `2 * height` - Profile length equals twice the window height

#### Migration Notes
- **Existing Window Systems**: Existing window systems will work with new equation evaluation (numeric constants automatically converted)
- **Price Recalculation**: Existing window items may need to be recalculated if they were saved with incorrect prices due to the equation evaluation bug
- **Position Field**: Existing profiles without position will display empty in workshop modal (field is optional)

---

## January 2026 - Glass Type Display Fix & Edit Mode Improvements

### What We Worked On

1. **Glass Type Display Fix in Edit Mode**
   - **Problem**: When editing a saved window, the glass type dropdown showed the price (e.g., "$45.00") instead of the glass name (e.g., "Double Pane Clear - Clear")
   - **Root Cause**: The edit route wasn't passing `preSelectedGlassId` to the template, causing the template to try extracting the glass ID from the description string, which was unreliable
   - **Solution**: 
     - Updated edit route to extract `selectedGlassId` from saved window item and pass it as `preSelectedGlassId` to template
     - Added `data-pre-selected-glass-id` attribute to glass select element for JavaScript access
     - Updated JavaScript filtering functions to use the saved glass ID when restoring selections
     - Added comprehensive text reconstruction logic to fix corrupted option text (price instead of name)

2. **Template Variable Handling Fix**
   - **Temporal Dead Zone Issue**: Fixed JavaScript error "Cannot access 'preSelectedMissileType' before initialization"
   - **Solution**: Used eval() to safely access template variables before they're declared as const, avoiding temporal dead zone conflicts
   - **Variable Isolation**: Used intermediate variables (`editModeMissileType`, `editModeGlassId`) before setting final const variables

3. **Glass Option Text Reconstruction**
   - **Price Detection**: Added detection for option text that shows price format (e.g., "$45.00") instead of glass name
   - **Text Reconstruction**: Automatically reconstructs option text from `data-type` attribute when price is detected
   - **Multiple Fix Points**: 
     - Immediate fix function runs on page load
     - Fix applied when initializing glass options array
     - Fix applied when filtering/rebuilding options
     - MutationObserver watches for DOM changes and fixes corrupted text
   - **Regex Pattern**: Uses `/^\$?\d+\.?\d*$/` to detect price-only text

4. **Edit Mode Glass Selection Restoration**
   - **Pre-Selected Glass ID**: Edit route now passes `preSelectedGlassId` directly from `existingWindow.selectedGlassId`
   - **Pre-Selected Missile Type**: Edit route now passes `preSelectedMissileType` from `existingWindow.missileType`
   - **Data Attribute**: Glass select element includes `data-pre-selected-glass-id` attribute for JavaScript access
   - **Selection Restoration**: JavaScript uses saved glass ID to restore correct selection after filtering by missile type

5. **JavaScript Filtering Improvements**
   - **Parameter Passing**: Updated `filterGlassesByMissileType()` to accept optional `preSelectedGlassIdValue` parameter
   - **Selection Matching**: Improved glass ID matching with proper string comparison (handles ObjectId vs string)
   - **Option Text Preservation**: Ensures option text format is preserved when rebuilding options (glass_type - description)

#### Key Files Modified
- `routes/projectRoutes.js` - Updated edit route to extract and pass `preSelectedGlassId` and `preSelectedMissileType` to template
- `views/projects/configureWindow.ejs` - Added template variable handling with eval(), added `data-pre-selected-glass-id` attribute, added comprehensive glass option text fix functions, updated filtering functions to use saved glass ID

#### Technical Notes
- **Template Variables**: Template variables passed from route are safely accessed using eval() to avoid temporal dead zone issues
- **Price Detection**: Regex pattern `/^\$?\d+\.?\d*$/` detects if option text is a price format
- **Text Reconstruction**: Option text reconstructed from `data-type` attribute when price is detected
- **MutationObserver**: Watches for DOM changes to glass select and automatically fixes corrupted text
- **Multiple Fix Points**: Fix functions run at multiple stages (page load, DOM ready, after filtering) to ensure text is always correct
- **Selection Restoration**: Saved glass ID used to restore selection even when options are filtered by missile type

#### Example Fixes
- Before: Option text showed "$45.00"
- After: Option text shows "Double Pane Clear - Clear"
- The glass type name is correctly displayed in edit mode, matching what was saved

---

## January 2026 - Markup Functionality, Bulk Delete & Price Calculation Fixes

### What We Worked On

1. **Markup Functionality for Project Details**
   - **Individual Item Markup**: Each window item now has an editable markup percentage field in both desktop table and mobile card views
   - **Global Markup Control**: Added global markup input that displays the average of all item markups
   - **Auto-Apply Global Markup**: When user changes the global markup, all individual item markups update to that value
   - **Default Markup**: New items are saved with 0% markup (base price only), allowing users to add markup as needed
   - **Price Display**: Unit price and total price dynamically update when markup changes
   - **Backend Route**: Added `PATCH /projects/:projectId/items/:itemId/markup` endpoint for updating item markup
   - **Real-time Calculation**: Markup applied as `basePrice * (1 + markup/100)` on the frontend

2. **Multi-Select and Bulk Delete**
   - **Checkbox Selection**: Added checkboxes to each item row (desktop) and card (mobile)
   - **Select All**: Header checkbox to select/deselect all items at once
   - **Indeterminate State**: "Select All" checkbox shows indeterminate state when some items are selected
   - **Bulk Delete Button**: Appears when items are selected, shows count of selected items
   - **Backend Route**: Added `POST /projects/:projectId/items/bulk-delete` endpoint
   - **Confirmation Dialog**: Requires user confirmation before bulk deletion
   - **Loading States**: Shows loading indicator during bulk delete operation

3. **Desktop Table Visibility Fix**
   - **Problem**: Desktop table was not visible in full-screen mode, only appeared in mobile view
   - **Root Cause**: A missing closing `</div>` tag caused the desktop table container to be nested inside the mobile view container
   - **Solution**: Added the missing `</div>` tag to properly close the mobile card loop
   - **Additional Fixes**: Removed inline `style="display: none;"` and fixed Tailwind class conflicts

4. **Add Window Modal Blinking Fix**
   - **Problem**: In mobile mode, clicking "Add Window" caused the modal to rapidly blink on/off
   - **Root Cause**: Functions defined inside DOMContentLoaded weren't available on button click, and duplicate event listeners caused rapid state changes
   - **Solution**: 
     - Moved `openAddWindowModal()` and `closeAddWindowModal()` functions outside DOMContentLoaded
     - Added `isModalOpen` flag to prevent multiple rapid calls
     - Removed duplicate backdrop click listener
     - Added `e.stopPropagation()` to prevent click bubbling

5. **Price Calculation Triple-Counting Fix**
   - **Problem**: Project total was showing 3x the actual value (e.g., $244.81 instead of $81.60)
   - **Root Cause**: Each item had 3 elements with `data-base-total` (mobile card header, mobile card details, desktop table), all being summed
   - **Solution**: 
     - Added `.item-total-countable` class to only the desktop table total element
     - Updated all calculation selectors to use `.item-total-countable[data-base-total][data-markup]`
     - Removed `data-base-price` from `projectTotalDisplay` (it's a result, not a source)

6. **Markup 0% Display Fix**
   - **Problem**: Items with 0% markup were displaying with 20% markup applied
   - **Root Cause**: Code used `parseFloat(attr) || 20` which treated `0` as falsy, defaulting to 20
   - **Solution**: Changed to explicit null/undefined check: `(attr !== null && attr !== undefined && attr !== '') ? parseFloat(attr) : 20`
   - **Applied To**: `applyMarkupToPrices()`, `updateProjectTotalWithMarkup()`, `calculateProjectTotal()`, and inline input value attributes

7. **Quantity Change Total Update Fix**
   - **Problem**: When changing item quantity, the item total updated but the project total didn't
   - **Root Cause**: Quantity update handler only updated `data-price` attribute, but project total calculation uses `data-base-total`
   - **Solution**: 
     - Updated quantity change handler to update both `data-base-total` and `data-price`
     - Explicitly update the `.item-total-countable` element
     - Call `updateProjectTotalWithMarkup()` and `calculateProjectTotal()` immediately after save

8. **Dimension Conversion Reliability Fix**
   - **Problem**: Windows saved with mm dimensions were sometimes saved with incorrect values (1000mm becoming 25400mm)
   - **Root Cause**: Unit conversion logic wasn't reliably detecting when dimensions were in mm before converting to inches
   - **Solution**: 
     - Made conversion logic use the displayed unit label as the source of truth (not hidden inputs or variables)
     - Added `conversionApplied` flag to prevent double conversion
     - Added debug logging to trace conversion process
     - Added backend validation for dimension bounds

#### Key Files Modified
- `views/projects/projectDetails.ejs` - Markup functionality, bulk delete, triple-counting fix, modal fix, quantity update fix
- `routes/projectRoutes.js` - Added markup update route, bulk delete route, dimension validation
- `models/WindowItem.js` - Added `markup` field with default of 20, range 0-1000
- `views/projects/configureWindow.ejs` - Dimension conversion reliability improvements

#### Technical Notes
- **Markup Storage**: Markup percentage stored in `WindowItem.markup` field (default: 20, min: 0, max: 1000)
- **Price Calculation**: Base prices stored without markup, markup applied on frontend display
- **Countable Elements**: Only elements with `.item-total-countable` class are summed for project total
- **Debounced Save**: Markup changes use debounced save (300ms delay) to reduce API calls
- **Selection State**: Selected items tracked in `selectedItems` array, synced between desktop and mobile views
- **Unit Conversion**: Dimensions converted from mm to inches before form submission, using displayed unit as source of truth

#### Example Markup Calculation
- Base unit price: $81.60
- Markup: 20%
- Displayed unit price: $81.60 × 1.20 = $97.92
- Total price (qty 2): $97.92 × 2 = $195.84

---

## January 2026 - Optional Glass Configuration, COP Display & Duplicate Fixes

### What We Worked On

1. **Optional Glass Configuration for Window Systems**
   - **Glass No Longer Required**: Window systems can now be created without glass (profiles-only systems)
   - **Glass Equations Optional**: `glassWidthEquation` and `glassHeightEquation` fields are now optional in compose window form
   - **UI Updates**: 
     - Removed required asterisks from glass equation labels
     - Added "(Optional)" badge to glass equation labels
     - Updated Step 4 header to show "Glass Configuration (Optional)"
     - Added help text: "Skip this step if your system has no glass"
   - **Validation Removed**: Glass equations are only validated if provided (empty values allowed)

2. **Conditional Glass/Missile Type Display in Configure Window**
   - **Smart Detection**: System checks if `glassWidthEquation` or `glassHeightEquation` exists
   - **Glass Type Hidden**: If system has no glass config, glass type selector is hidden (replaced with hidden input)
   - **Missile Type Hidden**: Missile type selector also hidden when no glass (only relevant with glass)
   - **Backend Validation**: 
     - Glass is required only if system has glass configuration
     - Glass cost calculated as $0 when no glass selected
     - Description shows "Glass: None (profiles only)" for systems without glass

3. **JavaScript Fixes for Hidden Glass Elements**
   - **Problem**: JavaScript tried to access `.options` and `.selectedIndex` on hidden input element
   - **Solution**: Added `glassSelect.tagName === 'SELECT'` checks before accessing select-specific properties
   - **Functions Updated**:
     - `calculatePricingWithUnits()` - Glass cost calculation
     - `initializeGlassOptions()` - Glass options storage
     - `fixGlassOptionTexts()` - Text corruption fix
     - `setupGlassOptionTextWatcher()` - MutationObserver setup
     - `handleEditModeMissileType()` - Edit mode handling
     - `filterGlassesByMissileType()` - Glass filtering
     - Workshop modal glass info display

4. **500 Error Fix for Windows Without Glass**
   - **Problem**: `ReferenceError: glassPricePerSqM is not defined` when saving windows without glass
   - **Root Cause**: Debug console.log statements referenced variables only defined inside `if (selectedGlass)` block
   - **Solution**: Moved debug logging inside the if block, added else branch logging "No glass selected - glass cost: 0"

5. **Project ID Fix for Name Validation**
   - **Problem**: 404 error on `/projects//check-item-name` (double slash - missing project ID)
   - **Root Cause**: JavaScript looked for `data-project-id` attribute that didn't exist in HTML
   - **Solution**: Added `data-project-id` and `data-current-window-id` attributes to form element

6. **Price Display Fix in Edit Mode**
   - **Problem**: Displayed price didn't match calculated price (showed old saved value instead)
   - **Root Cause**: Code was overwriting calculated price with saved database value "as a temporary fix"
   - **Solution**: Removed the override code - display now always shows current calculated price

7. **COP Values in Calculation Details Modal**
   - **Dual Currency Display**: Every cost step now shows both USD and COP values
   - **Sections Updated**:
     - Glass Cost: USD and COP
     - Each Profile: Individual cost in USD and COP
     - Total Profiles Cost: USD and COP
     - Each Accessory: Individual cost in USD and COP
     - Total Accessories Cost: USD and COP
     - Muntin Cost (if applicable): USD and COP
     - Base Cost Summary: All line items in both currencies
     - Additional Costs: USD and COP
     - Final Calculation: All totals in both currencies
   - **COP Formatting**: Uses Colombian locale (es-CO) with no decimal places

8. **Markup Preservation on Duplicate**
   - **Single Item Duplicate**: Markup now preserved when duplicating a window item
   - **Project Duplicate**: All window items preserve their markup when duplicating entire project
   - **Default Value**: Falls back to 20% if original item has no markup defined

9. **Console Warning Cleanup**
   - **Reduced Noise**: `evaluateLengthEquation` warnings now only show when width/height > 0 (not on initial page load with 0 values)

#### Key Files Modified
- `views/admin/composeWindow.ejs` - Made glass equations optional, updated labels and validation
- `views/admin/editWindowSystem.ejs` - Made glass equations optional, updated labels and validation
- `views/projects/configureWindow.ejs` - Conditional glass/missile display, JavaScript fixes for hidden elements, added form data attributes, removed price override code, added formatCOP helper, updated calculation modal with dual currency
- `routes/projectRoutes.js` - Optional glass handling in save/update routes, glass cost $0 when no glass, description updates, debug logging fixes, markup preservation in duplicate routes

#### Technical Notes
- **Glass Detection**: `systemHasGlass = (glassWidthEquation?.trim()) || (glassHeightEquation?.trim())`
- **Hidden Element Handling**: Check `element.tagName === 'SELECT'` before accessing select-specific properties
- **COP Formatting**: `new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })`
- **Markup Default**: `markup !== undefined ? markup : 20` ensures 0% markup is preserved (not defaulted to 20%)
- **Glass-Free Systems**: Useful for aluminum frames, curtain walls, or other profile-only configurations

#### Example Use Cases
- **Profile-Only System**: Create window system with only profiles (no glass), skip Step 4 entirely
- **Mixed Systems**: Some window systems have glass, others don't - configure window page adapts automatically
- **Production Planning**: Workshop modal still shows profile/accessory info even without glass

---

## 🔮 TODO / Future Enhancements

- **Profile Quantity Equations**: Consider implementing equation support for profile quantities, similar to accessory equations. This would allow profiles to use formulas based on window dimensions (e.g., perimeter-based calculations for frame profiles).

---

*Last Updated: January 2026 - Optional Glass Configuration, COP Display & Duplicate Fixes*

