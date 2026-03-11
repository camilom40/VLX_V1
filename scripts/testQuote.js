// scripts/testQuote.js
// DB-backed pricing verification using the same calculator as the app.
// Run: node scripts/testQuote.js

require('dotenv').config();
const mongoose = require('mongoose');
const Window = require('../models/Window');
const Profile = require('../models/Profile');
const Accessory = require('../models/Accessory');
const Glass = require('../models/Glass');
const CostSettings = require('../models/CostSettings');
const { calculateWindowConfigurationPricing } = require('../utils/pricingCalculator');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/vlx_v1';

const testConfig = {
  windowSystemName: 'Fixed',
  width: 1000, // mm
  height: 2000, // mm
  glassType: 'B',
  quantity: 1,
  exchangeRate: 4000,
  adminMarkupPercent: 0,
  selectedProfiles: [],
  selectedAccessories: [],
  muntinConfiguration: null
};

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mmToInches(mm) {
  return Number(mm) / 25.4;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatMeters(value) {
  return `${Number(value || 0).toFixed(4)} m`;
}

function buildSelectedProfiles(windowSystem, selectedProfilesConfig = []) {
  const userProfiles = (windowSystem.profiles || []).filter((profileItem) => profileItem.showToUser);

  return userProfiles.map((profileItem) => {
    const profileDoc = profileItem.profile;
    const override = selectedProfilesConfig.find((entry) => {
      const requested = entry.profileId || entry.profileName || entry.name;
      if (!requested || !profileDoc) {
        return false;
      }

      return String(profileDoc._id) === String(requested) || profileDoc.name === requested;
    });

    if (!override) {
      return null;
    }

    return {
      profileId: override.profileId || profileDoc._id,
      quantity: override.quantity ?? profileItem.quantity,
      lengthDiscount: override.lengthDiscount ?? profileItem.lengthDiscount
    };
  });
}

function buildSelectedAccessories(windowSystem, selectedAccessoriesConfig = []) {
  const configurableAccessoryIds = new Set(
    (windowSystem.accessories || [])
      .filter((accessoryItem) => accessoryItem.showToUser && accessoryItem.accessory)
      .map((accessoryItem) => String(accessoryItem.accessory._id || accessoryItem.accessory))
  );

  return selectedAccessoriesConfig
    .map((entry) => ({
      accessoryId: entry.accessoryId,
      accessoryName: entry.accessoryName || entry.name,
      quantity: entry.quantity
    }))
    .map((entry) => {
      const matchingAccessory = (windowSystem.accessories || []).find((accessoryItem) => {
        if (!accessoryItem.showToUser || !accessoryItem.accessory) {
          return false;
        }

        const accessoryDoc = accessoryItem.accessory;
        return (
          (entry.accessoryId && String(accessoryDoc._id) === String(entry.accessoryId)) ||
          (entry.accessoryName && accessoryDoc.name === entry.accessoryName)
        );
      });

      if (!matchingAccessory || !matchingAccessory.accessory) {
        return null;
      }

      return {
        accessoryId: String(matchingAccessory.accessory._id),
        quantity: entry.quantity
      };
    })
    .filter((entry) => entry && configurableAccessoryIds.has(String(entry.accessoryId)));
}

function printConfigurationSummary(windowSystem, selectedGlass, widthInches, heightInches, exchangeRate) {
  console.log('='.repeat(80));
  console.log('QUOTE CALCULATION TEST');
  console.log('='.repeat(80));
  console.log(`\nWindow System: ${windowSystem.type}`);
  console.log(`Dimensions: ${testConfig.width}mm × ${testConfig.height}mm`);
  console.log(`Dimensions (inches): ${widthInches.toFixed(2)}" × ${heightInches.toFixed(2)}"`);
  console.log(`Glass: ${selectedGlass ? selectedGlass.glass_type : 'None'}`);
  console.log(`Quantity: ${testConfig.quantity}`);
  console.log(`Exchange Rate: ${exchangeRate} COP/USD`);
  console.log(`Admin Markup: ${testConfig.adminMarkupPercent}%`);
}

function printPricingBreakdown(pricingResult, selectedGlass, costSettings) {
  console.log('\n📊 COST BREAKDOWN:');
  console.log('─'.repeat(80));

  if (selectedGlass) {
    console.log('\n1. Glass Cost:');
    console.log(`   Glass Type: ${selectedGlass.glass_type}`);
    console.log(`   Price: ${selectedGlass.pricePerSquareMeter} ${pricingResult.glassCurrency}/m²`);
    console.log(`   Price (USD): ${formatMoney(pricingResult.glassPriceUSD)}/m²`);
    console.log(`   Glass Size: ${pricingResult.glassWidthInches.toFixed(2)}" × ${pricingResult.glassHeightInches.toFixed(2)}"`);
    console.log(`   Area: ${pricingResult.glassAreaSquareMeters.toFixed(4)} m²`);
    console.log(`   Cost: ${formatMoney(pricingResult.glassCost)}`);
  }

  console.log('\n2. Profile Costs:');
  if (pricingResult.profileBreakdown.length === 0) {
    console.log('   No profiles priced.');
  } else {
    pricingResult.profileBreakdown.forEach((profile, index) => {
      console.log(`   ${index + 1}. ${profile.name}`);
      console.log(`      Quantity: ${profile.quantity}`);
      console.log(`      Length: ${formatMeters(profile.lengthMeters)}`);
      console.log(`      Price: ${profile.priceOriginal} ${profile.currency}/m`);
      console.log(`      Price (USD): ${formatMoney(profile.pricePerMeterUSD)}/m`);
      console.log(`      Cost: ${formatMoney(profile.cost)}`);
      console.log(`      Source: ${profile.isUserConfigurable ? 'User-configurable' : 'Auto-managed'}`);
    });
  }
  console.log(`   Total Profiles Cost: ${formatMoney(pricingResult.profileCostTotal)}`);

  console.log('\n3. Accessory Costs:');
  if (pricingResult.accessoryBreakdown.length === 0) {
    console.log('   No accessories priced.');
  } else {
    pricingResult.accessoryBreakdown.forEach((accessory, index) => {
      console.log(`   ${index + 1}. ${accessory.name}`);
      console.log(`      Quantity: ${accessory.quantity}`);
      console.log(`      Price: ${accessory.priceOriginal} ${accessory.currency}`);
      console.log(`      Price (USD): ${formatMoney(accessory.priceUSD)}`);
      console.log(`      Cost: ${formatMoney(accessory.cost)}`);
      console.log(`      Source: ${accessory.isUserConfigurable ? 'User-configurable' : 'Auto-managed'}`);
    });
  }
  console.log(`   Total Accessories Cost: ${formatMoney(pricingResult.accessoryCostTotal)}`);

  console.log('\n4. Muntin Cost:');
  if (!pricingResult.muntinDetails) {
    console.log('   No muntins priced.');
  } else {
    console.log(`   Profile: ${pricingResult.muntinDetails.name}`);
    console.log(`   Divisions: ${pricingResult.muntinDetails.horizontal} × ${pricingResult.muntinDetails.vertical}`);
    console.log(`   Length: ${formatMeters(pricingResult.muntinDetails.length)}`);
    console.log(`   Price (USD): ${formatMoney(pricingResult.muntinDetails.priceUSD)}/m`);
    console.log(`   Cost: ${formatMoney(pricingResult.muntinCost)}`);
  }

  console.log('\n5. Additional Costs:');
  console.log(`   Packaging: ${costSettings?.packaging || 0}%`);
  console.log(`   Labor: ${costSettings?.labor || 0}%`);
  console.log(`   Indirect Costs: ${costSettings?.indirectCosts || 0}%`);
  console.log(`   Additional Costs: ${formatMoney(pricingResult.additionalCosts)}`);
}

function printFinalTotals(pricingResult) {
  console.log('\n' + '='.repeat(80));
  console.log('FINAL PRICING');
  console.log('='.repeat(80));
  console.log(`Area: ${pricingResult.areaSquareMeters.toFixed(4)} m² (${pricingResult.areaInches.toFixed(2)} sq in)`);
  console.log(`Perimeter: ${formatMeters(pricingResult.perimeterMeters)} (${pricingResult.perimeterInches.toFixed(2)} in)`);
  console.log(`Base Cost: ${formatMoney(pricingResult.baseCost)}`);
  console.log(`Cost per Window: ${formatMoney(pricingResult.totalCostPerWindow)}`);
  console.log(`Unit Price: ${formatMoney(pricingResult.unitPrice)}`);
  console.log(`Quantity: ${pricingResult.quantity}`);
  console.log(`TOTAL PRICE: ${formatMoney(pricingResult.totalPrice)}`);
  console.log('='.repeat(80));
}

async function loadGlass(glassType) {
  if (!glassType) {
    return null;
  }

  const glass = await Glass.findOne({
    glass_type: { $regex: new RegExp(escapeRegex(glassType), 'i') }
  });

  if (glass) {
    return glass;
  }

  console.log(`❌ Glass type "${glassType}" not found.`);
  console.log('\nAvailable glasses:');
  const allGlasses = await Glass.find({}, 'glass_type').sort({ glass_type: 1 });
  allGlasses.forEach((item) => {
    console.log(`  - ${item.glass_type}`);
  });

  return null;
}

async function loadWindowSystem(windowSystemName) {
  const exactMatch = await Window.findOne({
    type: { $regex: new RegExp(`^${escapeRegex(windowSystemName)}$`, 'i') }
  })
    .populate('profiles.profile')
    .populate('accessories.accessory')
    .populate('muntinConfiguration.muntinProfile')
    .populate('missileImpactConfiguration.lmiGlasses')
    .populate('missileImpactConfiguration.smiGlasses');

  if (exactMatch) {
    return exactMatch;
  }

  const similarSystems = await Window.find({
    type: { $regex: new RegExp(escapeRegex(windowSystemName), 'i') }
  }, 'type')
    .sort({ type: 1 })
    .lean();

  console.log(`❌ Window system "${windowSystemName}" not found.`);
  if (similarSystems.length > 0) {
    console.log('\nSimilar window systems:');
    similarSystems.forEach((item) => {
      console.log(`  - ${item.type}`);
    });
  }

  return null;
}

async function testQuote() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const windowSystem = await loadWindowSystem(testConfig.windowSystemName);

    if (!windowSystem) {
      return;
    }

    const [selectedGlass, allProfiles, allAccessories, costSettings] = await Promise.all([
      loadGlass(testConfig.glassType),
      Profile.find({}),
      Accessory.find({}),
      CostSettings.findOne()
    ]);

    if (testConfig.glassType && !selectedGlass) {
      return;
    }

    const effectiveCostSettings = costSettings || {
      packaging: 5,
      labor: 15,
      indirectCosts: 10
    };
    const exchangeRate = testConfig.exchangeRate || 4000;
    const widthInches = mmToInches(testConfig.width);
    const heightInches = mmToInches(testConfig.height);
    const selectedProfiles = buildSelectedProfiles(windowSystem, testConfig.selectedProfiles);
    const selectedAccessories = buildSelectedAccessories(windowSystem, testConfig.selectedAccessories);

    const pricingResult = calculateWindowConfigurationPricing({
      windowSystem,
      selectedGlass,
      allProfiles,
      allAccessories,
      costSettings: effectiveCostSettings,
      exchangeRate,
      windowWidth: widthInches,
      windowHeight: heightInches,
      windowQuantity: testConfig.quantity,
      adminMarkupPercent: testConfig.adminMarkupPercent,
      selectedProfiles,
      selectedAccessories,
      muntinConfiguration: testConfig.muntinConfiguration
    });

    printConfigurationSummary(windowSystem, selectedGlass, widthInches, heightInches, exchangeRate);
    printPricingBreakdown(pricingResult, selectedGlass, effectiveCostSettings);
    printFinalTotals(pricingResult);

    if (selectedGlass && windowSystem.missileImpactConfiguration && windowSystem.missileImpactConfiguration.supportsLMI) {
      const lmiGlasses = windowSystem.missileImpactConfiguration.lmiGlasses || [];
      const glassInLMI = lmiGlasses.some((item) => String(item._id) === String(selectedGlass._id));

      if (glassInLMI) {
        console.log(`\n✅ Glass "${selectedGlass.glass_type}" is available for LMI configuration`);
      } else {
        console.log(`\n⚠️  Glass "${selectedGlass.glass_type}" is NOT in the LMI glasses list`);
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

testQuote();

