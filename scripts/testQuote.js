// scripts/testQuote.js
// Test script to calculate pricing for a window configuration
// Run: node scripts/testQuote.js

require('dotenv').config();
const mongoose = require('mongoose');
const Window = require('../models/Window');
const Profile = require('../models/Profile');
const Accessory = require('../models/Accessory');
const Glass = require('../models/Glass');
const CostSettings = require('../models/CostSettings');

// MongoDB connection string
const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/vlx_v1';

// Test configuration
const testConfig = {
  windowSystemName: 'Fixed',
  width: 1000, // mm
  height: 2000, // mm
  glassType: 'Double Pane Low-E', // Looking for this glass type
  quantity: 1
};

// Currency conversion helper (simplified - should match your actual conversion)
function convertToUSD(price, currency, exchangeRate) {
  if (currency === 'USD') {
    return price;
  } else if (currency === 'COP') {
    return price / exchangeRate;
  }
  return price; // Default to USD
}

async function testQuote() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the window system
    const windowSystem = await Window.findOne({ 
      type: { $regex: new RegExp(`^${testConfig.windowSystemName}$`, 'i') }
    })
      .populate('profiles.profile')
      .populate('accessories.accessory')
      .populate('muntinConfiguration.muntinProfile')
      .populate('missileImpactConfiguration.lmiGlasses')
      .populate('missileImpactConfiguration.smiGlasses');

    if (!windowSystem) {
      console.log(`❌ Window system "${testConfig.windowSystemName}" not found.`);
      return;
    }

    // Find the glass
    const glass = await Glass.findOne({
      glass_type: { $regex: new RegExp(testConfig.glassType, 'i') }
    });

    if (!glass) {
      console.log(`❌ Glass type "${testConfig.glassType}" not found.`);
      console.log('\nAvailable glasses:');
      const allGlasses = await Glass.find({}, 'glass_type').sort({ glass_type: 1 });
      allGlasses.forEach(g => {
        console.log(`  - ${g.glass_type}`);
      });
      return;
    }

    // Get cost settings
    const costSettings = await CostSettings.findOne() || {
      packaging: 5,
      labor: 15,
      indirectCosts: 10
    };

    // Get exchange rate (default to 4000 if not set)
    const exchangeRate = 4000; // You may want to get this from your settings

    console.log('='.repeat(80));
    console.log('QUOTE CALCULATION TEST');
    console.log('='.repeat(80));
    console.log(`\nWindow System: ${windowSystem.type}`);
    console.log(`Dimensions: ${testConfig.width}mm × ${testConfig.height}mm`);
    console.log(`Glass: ${glass.glass_type}`);
    console.log(`Quantity: ${testConfig.quantity}`);
    console.log('');

    // Convert dimensions from mm to inches
    const widthInches = testConfig.width / 25.4;
    const heightInches = testConfig.height / 25.4;
    console.log(`Dimensions (inches): ${widthInches.toFixed(2)}" × ${heightInches.toFixed(2)}"`);

    // Calculate area and perimeter
    const areaInches = widthInches * heightInches;
    const areaSquareMeters = areaInches / 1550; // 1 sqm = 1550 sq inches
    const perimeterInches = 2 * (widthInches + heightInches);
    const perimeterMeters = perimeterInches / 39.37; // Convert to meters

    console.log(`Area: ${areaSquareMeters.toFixed(4)} m² (${areaInches.toFixed(2)} sq in)`);
    console.log(`Perimeter: ${perimeterMeters.toFixed(4)} m (${perimeterInches.toFixed(2)} in)`);
    console.log('');

    // ALL CALCULATIONS IN USD
    let totalCost = 0;
    const costBreakdown = {
      glass: 0,
      profiles: 0,
      accessories: 0,
      muntin: 0
    };

    // 1. Glass Cost
    console.log('📊 COST BREAKDOWN:');
    console.log('─'.repeat(80));
    const glassPriceUSD = convertToUSD(glass.pricePerSquareMeter, glass.currency || 'USD', exchangeRate);
    const glassCost = glassPriceUSD * areaSquareMeters;
    totalCost += glassCost;
    costBreakdown.glass = glassCost;
    console.log(`\n1. Glass Cost:`);
    console.log(`   Glass Type: ${glass.glass_type}`);
    console.log(`   Price: $${glass.pricePerSquareMeter} ${glass.currency || 'USD'}/m²`);
    console.log(`   Price (USD): $${glassPriceUSD.toFixed(2)}/m²`);
    console.log(`   Area: ${areaSquareMeters.toFixed(4)} m²`);
    console.log(`   Cost: $${glassPriceUSD.toFixed(2)} × ${areaSquareMeters.toFixed(4)} = $${glassCost.toFixed(2)}`);

    // 2. Profile Costs
    console.log(`\n2. Profile Costs:`);
    let profilesCost = 0;
    windowSystem.profiles.forEach((profileItem, index) => {
      if (profileItem.profile) {
        const profile = profileItem.profile;
        const pricePerMeterUSD = convertToUSD(profile.pricePerMeter, profile.currency || 'USD', exchangeRate);
        
        // Calculate adjusted length (perimeter minus length discount)
        const lengthDiscountMeters = (profileItem.lengthDiscount || 0) * 0.0254; // Convert inches to meters
        const adjustedLength = Math.max(0, perimeterMeters - lengthDiscountMeters);
        
        // Calculate cost for this profile
        const profileCost = pricePerMeterUSD * adjustedLength * profileItem.quantity;
        profilesCost += profileCost;
        
        console.log(`   ${index + 1}. ${profile.name}`);
        console.log(`      Quantity: ${profileItem.quantity}`);
        console.log(`      Orientation: ${profileItem.orientation}`);
        console.log(`      Price: $${profile.pricePerMeter} ${profile.currency || 'USD'}/m`);
        console.log(`      Price (USD): $${pricePerMeterUSD.toFixed(2)}/m`);
        console.log(`      Length Discount: ${profileItem.lengthDiscount || 0} in (${lengthDiscountMeters.toFixed(4)} m)`);
        console.log(`      Perimeter: ${perimeterMeters.toFixed(4)} m`);
        console.log(`      Adjusted Length: ${adjustedLength.toFixed(4)} m`);
        console.log(`      Cost: $${pricePerMeterUSD.toFixed(2)} × ${adjustedLength.toFixed(4)} × ${profileItem.quantity} = $${profileCost.toFixed(2)}`);
      }
    });
    totalCost += profilesCost;
    costBreakdown.profiles = profilesCost;
    console.log(`   Total Profiles Cost: $${profilesCost.toFixed(2)}`);

    // 3. Accessory Costs
    console.log(`\n3. Accessory Costs:`);
    let accessoriesCost = 0;
    windowSystem.accessories.forEach((accItem, index) => {
      if (accItem.accessory) {
        const accessory = accItem.accessory;
        const priceUSD = convertToUSD(accessory.price, accessory.currency || 'USD', exchangeRate);
        const accessoryCost = priceUSD * accItem.quantity;
        accessoriesCost += accessoryCost;
        
        console.log(`   ${index + 1}. ${accessory.name}`);
        console.log(`      Quantity: ${accItem.quantity} ${accItem.unit}`);
        console.log(`      Price: $${accessory.price} ${accessory.currency || 'USD'}/${accessory.unit}`);
        console.log(`      Price (USD): $${priceUSD.toFixed(2)}/${accessory.unit}`);
        console.log(`      Cost: $${priceUSD.toFixed(2)} × ${accItem.quantity} = $${accessoryCost.toFixed(2)}`);
      }
    });
    totalCost += accessoriesCost;
    costBreakdown.accessories = accessoriesCost;
    console.log(`   Total Accessories Cost: $${accessoriesCost.toFixed(2)}`);

    // 4. Muntin Cost (if applicable)
    if (windowSystem.muntinConfiguration && windowSystem.muntinConfiguration.enabled) {
      console.log(`\n4. Muntin Cost:`);
      console.log(`   (Muntin configuration is enabled but not calculated in this test)`);
    }

    // Base cost before additional costs
    const baseCost = totalCost;
    console.log(`\n   Base Cost (before additional costs): $${baseCost.toFixed(2)}`);

    // 5. Additional Costs (percentages)
    console.log(`\n4. Additional Costs (Percentages):`);
    const packagingPercent = costSettings.packaging || 5;
    const laborPercent = costSettings.labor || 15;
    const indirectPercent = costSettings.indirectCosts || 10;
    const totalPercent = packagingPercent + laborPercent + indirectPercent;
    
    const additionalCosts = baseCost * (totalPercent / 100);
    totalCost += additionalCosts;
    
    console.log(`   Packaging: ${packagingPercent}%`);
    console.log(`   Labor: ${laborPercent}%`);
    console.log(`   Indirect Costs: ${indirectPercent}%`);
    console.log(`   Total Percentage: ${totalPercent}%`);
    console.log(`   Additional Costs: $${baseCost.toFixed(2)} × ${(totalPercent / 100).toFixed(4)} = $${additionalCosts.toFixed(2)}`);

    // Final totals
    const costPerWindow = totalCost;
    const finalTotal = costPerWindow * testConfig.quantity;

    console.log('\n' + '='.repeat(80));
    console.log('FINAL PRICING:');
    console.log('='.repeat(80));
    console.log(`\nCost Breakdown:`);
    console.log(`  Glass Cost:        $${costBreakdown.glass.toFixed(2)}`);
    console.log(`  Profiles Cost:     $${costBreakdown.profiles.toFixed(2)}`);
    console.log(`  Accessories Cost:  $${costBreakdown.accessories.toFixed(2)}`);
    console.log(`  Additional Costs:  $${additionalCosts.toFixed(2)}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Cost per Window:   $${costPerWindow.toFixed(2)}`);
    console.log(`  Quantity:          ${testConfig.quantity}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  TOTAL PRICE:       $${finalTotal.toFixed(2)}`);
    console.log('='.repeat(80));

    // Verify glass is available for this window system
    if (windowSystem.missileImpactConfiguration && windowSystem.missileImpactConfiguration.supportsLMI) {
      const lmiGlasses = windowSystem.missileImpactConfiguration.lmiGlasses || [];
      const glassInLMI = lmiGlasses.some(g => g._id.toString() === glass._id.toString());
      if (glassInLMI) {
        console.log(`\n✅ Glass "${glass.glass_type}" is available for LMI configuration`);
      } else {
        console.log(`\n⚠️  Glass "${glass.glass_type}" is NOT in the LMI glasses list`);
        console.log(`   Available LMI glasses:`);
        lmiGlasses.forEach(g => {
          console.log(`     - ${g.glass_type}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error calculating quote:', error);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the test
testQuote();

