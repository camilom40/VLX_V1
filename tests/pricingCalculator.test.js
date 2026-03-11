const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateWindowConfigurationPricing,
  evaluateLengthEquation,
  evaluateQuantityEquation
} = require('../utils/pricingCalculator');

function nearlyEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function buildPricingOptions(overrides = {}) {
  return {
    windowSystem: {
      profiles: [],
      accessories: [],
      muntinConfiguration: { enabled: false },
      ...overrides.windowSystem
    },
    selectedGlass: null,
    allProfiles: [],
    allAccessories: [],
    costSettings: null,
    exchangeRate: 4000,
    windowWidth: 40,
    windowHeight: 30,
    windowQuantity: 1,
    adminMarkupPercent: 0,
    selectedProfiles: [],
    selectedAccessories: [],
    muntinConfiguration: null,
    ...overrides
  };
}

test('evaluate equation helpers use window dimensions correctly', () => {
  assert.equal(evaluateQuantityEquation('2 + (width / 20)', 40, 30), 4);
  nearlyEqual(evaluateLengthEquation('width - 25.4', 40, 30), 39);
});

test('full pricing calculation stays consistent across glass, profiles, accessories, muntins, costs, and markup', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      glassWidthEquation: 'width - 25.4',
      glassHeightEquation: 'height - 50.8',
      profiles: [
        {
          showToUser: true,
          profile: 'profile-frame',
          quantity: 1,
          lengthEquation: 'width + height'
        },
        {
          showToUser: false,
          profile: 'profile-sash',
          quantityEquation: 'width / 20'
        }
      ],
      accessories: [
        {
          showToUser: true,
          accessory: 'acc-handle'
        },
        {
          showToUser: false,
          accessory: 'acc-screws',
          quantityEquation: 'perimeter / 50'
        }
      ],
      muntinConfiguration: {
        enabled: true,
        muntinProfile: 'muntin-profile'
      }
    },
    selectedGlass: {
      pricePerSquareMeter: 80000,
      currency: 'COP'
    },
    allProfiles: [
      { _id: 'profile-frame', name: 'Frame', pricePerMeter: 40000, currency: 'COP' },
      { _id: 'profile-sash', name: 'Sash', pricePerMeter: 5, currency: 'USD' },
      { _id: 'muntin-profile', name: 'Muntin', pricePerMeter: 4, currency: 'USD' }
    ],
    allAccessories: [
      { _id: 'acc-handle', name: 'Handle', price: 3, currency: 'USD' },
      { _id: 'acc-screws', name: 'Screw Pack', price: 2000, currency: 'COP' }
    ],
    costSettings: { packaging: 10, labor: 5, indirectCosts: 5 },
    windowWidth: 40,
    windowHeight: 60,
    windowQuantity: 2,
    adminMarkupPercent: 10,
    selectedProfiles: [
      { profileId: 'profile-frame', quantity: 2 }
    ],
    selectedAccessories: [
      { accessoryId: 'acc-handle', quantity: 1 },
      { accessoryId: 'acc-handle', quantity: 2 }
    ],
    muntinConfiguration: {
      enabled: true,
      horizontalDivisions: 3,
      verticalDivisions: 2,
      muntinProfileId: 'muntin-profile'
    }
  }));

  nearlyEqual(pricing.glassWidthInches, 39);
  nearlyEqual(pricing.glassHeightInches, 58);
  nearlyEqual(pricing.glassAreaSquareMeters, 2262 / 1550);
  nearlyEqual(pricing.glassPriceUSD, 20);
  nearlyEqual(pricing.glassCost, 29.18709677419355);
  nearlyEqual(pricing.profileCostTotal, 101.6);
  nearlyEqual(pricing.accessoryCostTotal, 11);
  nearlyEqual(pricing.muntinCost, 14.224);
  nearlyEqual(pricing.baseCost, 156.01109677419353);
  nearlyEqual(pricing.additionalCosts, 31.20221935483871);
  nearlyEqual(pricing.totalCostPerWindow, 187.21331612903225);
  nearlyEqual(pricing.totalPrice, 411.869295483871);
  assert.equal(pricing.unitPrice, 205.93);
  assert.equal(pricing.profileBreakdown.length, 2);
  assert.equal(pricing.accessoryBreakdown.length, 2);
  assert.equal(pricing.muntinDetails.name, 'Muntin');
});

test('invalid glass equations fall back to the raw opening dimensions', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      glassWidthEquation: 'width + ',
      glassHeightEquation: 'invalid(height)'
    },
    selectedGlass: {
      pricePerSquareMeter: 10,
      currency: 'USD'
    }
  }));

  nearlyEqual(pricing.glassWidthInches, 40);
  nearlyEqual(pricing.glassHeightInches, 30);
  nearlyEqual(pricing.glassAreaSquareMeters, 1200 / 1550);
  nearlyEqual(pricing.glassCost, (1200 / 1550) * 10);
});

test('user-configurable profiles use template length equations during pricing', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [
        {
          showToUser: true,
          profile: 'profile-a',
          quantity: 1,
          lengthEquation: 'width'
        }
      ],
      accessories: [],
      muntinConfiguration: { enabled: false }
    },
    selectedGlass: null,
    allProfiles: [
      { _id: 'profile-a', name: 'Frame A', pricePerMeter: 10, currency: 'USD' }
    ],
    allAccessories: [],
    costSettings: null,
    exchangeRate: 4000,
    windowWidth: 40,
    windowHeight: 30,
    windowQuantity: 1,
    adminMarkupPercent: 0,
    selectedProfiles: [
      { profileId: 'profile-a', quantity: 2, lengthDiscount: 0 }
    ],
    selectedAccessories: []
  }));

  nearlyEqual(pricing.profileCostTotal, 40 * 0.0254 * 10 * 2);
});

test('user-configurable profiles fall back to length discounts when no equation exists', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [
        {
          showToUser: true,
          profile: 'profile-a',
          quantity: 1,
          lengthDiscount: 4
        }
      ],
      accessories: [],
      muntinConfiguration: { enabled: false }
    },
    selectedGlass: null,
    allProfiles: [
      { _id: 'profile-a', name: 'Frame A', pricePerMeter: 5, currency: 'USD' }
    ],
    allAccessories: [],
    costSettings: null,
    exchangeRate: 4000,
    windowWidth: 40,
    windowHeight: 30,
    windowQuantity: 1,
    adminMarkupPercent: 0,
    selectedProfiles: [
      { profileId: 'profile-a', quantity: 1, lengthDiscount: 10 }
    ],
    selectedAccessories: []
  }));

  const perimeterMeters = (2 * (40 + 30)) * 0.0254;
  const expectedLengthMeters = perimeterMeters - (10 * 0.0254);
  nearlyEqual(pricing.profileCostTotal, expectedLengthMeters * 5);
});

test('auto-managed profiles round quantity equations before pricing', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [
        {
          showToUser: false,
          profile: 'profile-auto',
          quantityEquation: 'width / 15',
          lengthEquation: 'height'
        }
      ]
    },
    allProfiles: [
      { _id: 'profile-auto', name: 'Auto Mullion', pricePerMeter: 10, currency: 'USD' }
    ]
  }));

  assert.equal(pricing.profileBreakdown[0].quantity, 3);
  nearlyEqual(pricing.profileBreakdown[0].lengthMeters, 30 * 0.0254);
  nearlyEqual(pricing.profileCostTotal, 3 * (30 * 0.0254) * 10);
});

test('selected accessories are merged and combined with auto-managed accessory costs', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [],
      accessories: [
        {
          showToUser: true,
          accessory: 'acc-selected',
          quantity: 1
        },
        {
          showToUser: false,
          accessory: 'acc-auto',
          quantityEquation: 'width / 25'
        }
      ],
      muntinConfiguration: { enabled: false }
    },
    selectedGlass: null,
    allProfiles: [],
    allAccessories: [
      { _id: 'acc-selected', name: 'Handle', price: 4000, currency: 'COP' },
      { _id: 'acc-auto', name: 'Screw Pack', price: 2, currency: 'USD' }
    ],
    costSettings: { packaging: 10, labor: 0, indirectCosts: 0 },
    exchangeRate: 4000,
    windowWidth: 50,
    windowHeight: 40,
    windowQuantity: 2,
    adminMarkupPercent: 25,
    selectedProfiles: [],
    selectedAccessories: [
      { accessoryId: 'acc-selected', quantity: 1 },
      { accessoryId: 'acc-selected', quantity: 2 }
    ]
  }));

  nearlyEqual(pricing.accessoryCostTotal, 7);
  nearlyEqual(pricing.baseCost, 7);
  nearlyEqual(pricing.additionalCosts, 0.7);
  nearlyEqual(pricing.totalPrice, 19.25);
  assert.equal(pricing.unitPrice, 9.63);
});

test('cop-priced components drop to zero when exchange rate is unavailable', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [
        {
          showToUser: false,
          profile: 'profile-cop',
          quantity: 1
        }
      ],
      accessories: [
        {
          showToUser: true,
          accessory: 'acc-cop'
        }
      ]
    },
    selectedGlass: {
      pricePerSquareMeter: 50000,
      currency: 'COP'
    },
    allProfiles: [
      { _id: 'profile-cop', name: 'COP Profile', pricePerMeter: 30000, currency: 'COP' }
    ],
    allAccessories: [
      { _id: 'acc-cop', name: 'COP Accessory', price: 10000, currency: 'COP' }
    ],
    exchangeRate: 0,
    selectedAccessories: [
      { accessoryId: 'acc-cop', quantity: 2 }
    ]
  }));

  nearlyEqual(pricing.glassPriceUSD, 0);
  nearlyEqual(pricing.glassCost, 0);
  nearlyEqual(pricing.profileBreakdown[0].pricePerMeterUSD, 0);
  nearlyEqual(pricing.profileCostTotal, 0);
  nearlyEqual(pricing.accessoryBreakdown[0].priceUSD, 0);
  nearlyEqual(pricing.accessoryCostTotal, 0);
  nearlyEqual(pricing.totalPrice, 0);
});

test('muntin pricing is included when enabled', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [],
      accessories: [],
      muntinConfiguration: {
        enabled: true,
        muntinProfile: 'muntin-profile'
      }
    },
    selectedGlass: null,
    allProfiles: [
      { _id: 'muntin-profile', name: 'Muntin', pricePerMeter: 5, currency: 'USD' }
    ],
    allAccessories: [],
    costSettings: null,
    exchangeRate: 4000,
    windowWidth: 20,
    windowHeight: 30,
    windowQuantity: 1,
    adminMarkupPercent: 0,
    selectedProfiles: [],
    selectedAccessories: [],
    muntinConfiguration: {
      enabled: true,
      horizontalDivisions: 3,
      verticalDivisions: 2,
      muntinProfileId: 'muntin-profile'
    }
  }));

  const expectedLengthMeters = ((3 - 1) * 20 * 0.0254) + ((2 - 1) * 30 * 0.0254);
  nearlyEqual(pricing.muntinCost, expectedLengthMeters * 5);
});

test('muntin pricing is skipped when the window system does not enable muntins', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      profiles: [],
      accessories: [],
      muntinConfiguration: {
        enabled: false,
        muntinProfile: 'muntin-profile'
      }
    },
    allProfiles: [
      { _id: 'muntin-profile', name: 'Muntin', pricePerMeter: 5, currency: 'USD' }
    ],
    muntinConfiguration: {
      enabled: true,
      horizontalDivisions: 3,
      verticalDivisions: 2,
      muntinProfileId: 'muntin-profile'
    }
  }));

  nearlyEqual(pricing.muntinCost, 0);
  assert.equal(pricing.muntinDetails, null);
});

test('window quantity falls back to one and unit price is rounded to cents', () => {
  const pricing = calculateWindowConfigurationPricing(buildPricingOptions({
    windowSystem: {
      accessories: [
        {
          showToUser: false,
          accessory: 'acc-rounding',
          quantity: 1
        }
      ]
    },
    allAccessories: [
      { _id: 'acc-rounding', name: 'Rounding Accessory', price: 10.005, currency: 'USD' }
    ],
    windowQuantity: 0
  }));

  assert.equal(pricing.quantity, 1);
  nearlyEqual(pricing.totalPrice, 10.005);
  assert.equal(pricing.unitPrice, 10.01);
});
