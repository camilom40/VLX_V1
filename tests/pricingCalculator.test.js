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

test('evaluate equation helpers use window dimensions correctly', () => {
  assert.equal(evaluateQuantityEquation('2 + (width / 20)', 40, 30), 4);
  nearlyEqual(evaluateLengthEquation('width - 25.4', 40, 30), 39);
});

test('user-configurable profiles use template length equations during pricing', () => {
  const pricing = calculateWindowConfigurationPricing({
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
  });

  nearlyEqual(pricing.profileCostTotal, 40 * 0.0254 * 10 * 2);
});

test('user-configurable profiles fall back to length discounts when no equation exists', () => {
  const pricing = calculateWindowConfigurationPricing({
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
  });

  const perimeterMeters = (2 * (40 + 30)) * 0.0254;
  const expectedLengthMeters = perimeterMeters - (10 * 0.0254);
  nearlyEqual(pricing.profileCostTotal, expectedLengthMeters * 5);
});

test('selected and auto-managed accessories are included once with currency conversion', () => {
  const pricing = calculateWindowConfigurationPricing({
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
      { accessoryId: 'acc-selected', quantity: 3 }
    ]
  });

  nearlyEqual(pricing.accessoryCostTotal, 7);
  nearlyEqual(pricing.baseCost, 7);
  nearlyEqual(pricing.additionalCosts, 0.7);
  nearlyEqual(pricing.totalPrice, 19.25);
  assert.equal(pricing.unitPrice, 9.63);
});

test('muntin pricing is included when enabled', () => {
  const pricing = calculateWindowConfigurationPricing({
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
  });

  const expectedLengthMeters = ((3 - 1) * 20 * 0.0254) + ((2 - 1) * 30 * 0.0254);
  nearlyEqual(pricing.muntinCost, expectedLengthMeters * 5);
});
