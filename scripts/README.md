# Scripts Directory

This directory contains utility scripts for the VLX V1 application.

## createMuntinProfiles.js

This script creates sample muntin profiles in the database for testing and development purposes.

### What it does:
- Creates 4 sample muntin profiles with different types (colonial, geometric, custom)
- Sets appropriate pricing, colors, and specifications
- Only creates profiles if none exist (prevents duplicates)

### How to run:

1. **Make sure MongoDB is running** and accessible
2. **Update the connection string** in the script if needed:
   ```javascript
   const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vlx_v1';
   ```
3. **Run the script**:
   ```bash
   node scripts/createMuntinProfiles.js
   ```

### Sample profiles created:

1. **Colonial Muntin Profile**
   - Price: $25.00/meter
   - Type: Colonial
   - Color: White
   - Weight: 0.5 kg/meter

2. **Geometric Muntin Profile**
   - Price: $30.00/meter
   - Type: Geometric
   - Color: Black
   - Weight: 0.6 kg/meter

3. **Custom Muntin Profile**
   - Price: $35.00/meter
   - Type: Custom
   - Color: Bronze
   - Weight: 0.7 kg/meter

4. **Thin Colonial Muntin**
   - Price: $20.00/meter
   - Type: Colonial
   - Color: White
   - Weight: 0.3 kg/meter

### After running:

Once you have muntin profiles in your database, you can:
1. **Create window systems** with muntin configuration enabled
2. **Select muntin profiles** from the dropdown in the compose window form
3. **Configure muntin settings** like divisions and spacing
4. **Use muntins in user quotes** with proper pricing calculations

### Troubleshooting:

- **"MongoDB connection failed"**: Check if MongoDB is running and the connection string is correct
- **"No profiles created"**: Check if profiles already exist with `isMuntin: true`
- **"Permission denied"**: Ensure you have write access to the database

### Manual profile creation:

If you prefer to create profiles manually through the admin interface:

1. Go to Profile Management
2. Create a new profile or edit existing one
3. Set `isMuntin` to `true`
4. Set `muntinType` to one of: `colonial`, `geometric`, `custom`
5. Set `muntinPattern` and `muntinSpacing` as needed
6. Save the profile

The muntin profile dropdown will automatically populate with these profiles.
