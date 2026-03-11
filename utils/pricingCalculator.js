function toFiniteNumber(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInt(value, fallback = 1) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed > 0 ? parsed : fallback;
}

function convertToUSD(price, currency, exchangeRate) {
  const numericPrice = toFiniteNumber(price, 0);
  const rate = toFiniteNumber(exchangeRate, 0);

  if (numericPrice <= 0) {
    return 0;
  }

  if (currency === 'COP') {
    return rate > 0 ? numericPrice / rate : 0;
  }

  return numericPrice;
}

function evaluateQuantityEquation(equation, width, height) {
  if (!equation || typeof equation !== 'string') {
    return null;
  }

  try {
    const perimeter = 2 * (width + height);
    const area = width * height;

    let expression = equation.trim();
    expression = expression.replace(/\bwidth\b/gi, width);
    expression = expression.replace(/\bheight\b/gi, height);
    expression = expression.replace(/\bperimeter\b/gi, perimeter);
    expression = expression.replace(/\barea\b/gi, area);

    const result = Function('"use strict"; return (' + expression + ')')();
    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      return Math.max(0, result);
    }

    return null;
  } catch (error) {
    return null;
  }
}

function evaluateLengthEquation(equation, width, height) {
  if (!equation || typeof equation !== 'string') {
    return null;
  }

  try {
    const perimeter = 2 * (width + height);
    const area = width * height;
    let expression = equation.trim().replace(/\s+/g, ' ');

    const variableNames = ['width', 'height', 'perimeter', 'area'];
    const placeholders = {};

    variableNames.forEach((varName, index) => {
      const placeholder = `__VAR${index}__`;
      placeholders[placeholder] = varName;
      expression = expression.replace(new RegExp(`\\b${varName}\\b`, 'gi'), placeholder);
    });

    expression = expression.replace(/\b(\d+\.?\d*)\b/g, (match, number, offset, fullString) => {
      const numValue = parseFloat(number);
      if (Number.isNaN(numValue)) {
        return match;
      }

      if (offset > 0) {
        const beforeChar = fullString[offset - 1];
        if (beforeChar === '*' || beforeChar === '/') {
          return match;
        }
      }

      return String(numValue / 25.4);
    });

    Object.keys(placeholders).forEach((placeholder) => {
      expression = expression.replace(new RegExp(placeholder, 'g'), placeholders[placeholder]);
    });

    expression = expression.replace(/\bperimeter\b/gi, `(${perimeter})`);
    expression = expression.replace(/\barea\b/gi, `(${area})`);
    expression = expression.replace(/\bwidth\b/gi, `(${width})`);
    expression = expression.replace(/\bheight\b/gi, `(${height})`);

    const result = Function('"use strict"; return (' + expression + ')')();
    if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
      return Math.max(0, result);
    }

    return null;
  } catch (error) {
    return null;
  }
}

function getProfileLengthMeters({ profileItem, selectedProfile, windowWidth, windowHeight, perimeterMeters }) {
  const lengthEquation = profileItem?.lengthEquation || null;
  if (lengthEquation) {
    const lengthInches = evaluateLengthEquation(lengthEquation, windowWidth, windowHeight);
    if (lengthInches !== null) {
      return Math.max(0, lengthInches * 0.0254);
    }
  }

  const selectedLengthDiscount = selectedProfile && selectedProfile.lengthDiscount !== undefined
    ? toFiniteNumber(selectedProfile.lengthDiscount, 0)
    : null;
  const fallbackDiscount = selectedLengthDiscount !== null
    ? selectedLengthDiscount
    : toFiniteNumber(profileItem?.lengthDiscount, 0);

  return Math.max(0, perimeterMeters - (fallbackDiscount * 0.0254));
}

function resolveProfileDoc(profileRef, allProfiles) {
  if (!profileRef) {
    return null;
  }

  if (profileRef.pricePerMeter !== undefined) {
    return profileRef;
  }

  const profileId = profileRef._id ? String(profileRef._id) : String(profileRef);
  return allProfiles.find((profile) => String(profile._id) === profileId) || null;
}

function resolveAccessoryDoc(accessoryRef, allAccessories) {
  if (!accessoryRef) {
    return null;
  }

  if (accessoryRef.price !== undefined) {
    return accessoryRef;
  }

  const accessoryId = accessoryRef._id ? String(accessoryRef._id) : String(accessoryRef);
  return allAccessories.find((accessory) => String(accessory._id) === accessoryId) || null;
}

function buildAccessoryQuantityMap(selectedAccessories) {
  const quantities = new Map();

  (selectedAccessories || []).forEach((accessory) => {
    if (!accessory || !accessory.accessoryId) {
      return;
    }

    const accessoryId = String(accessory.accessoryId);
    const quantity = toFiniteNumber(accessory.quantity, 0);
    if (quantity <= 0) {
      return;
    }

    quantities.set(accessoryId, (quantities.get(accessoryId) || 0) + quantity);
  });

  return quantities;
}

function calculateWindowConfigurationPricing(options) {
  const {
    windowSystem,
    selectedGlass = null,
    allProfiles = [],
    allAccessories = [],
    costSettings = null,
    exchangeRate = 0,
    windowWidth,
    windowHeight,
    windowQuantity = 1,
    adminMarkupPercent = 0,
    selectedProfiles = [],
    selectedAccessories = [],
    muntinConfiguration = null
  } = options;

  const widthInches = toFiniteNumber(windowWidth, 0);
  const heightInches = toFiniteNumber(windowHeight, 0);
  const quantity = toPositiveInt(windowQuantity, 1);
  const perimeterInches = 2 * (widthInches + heightInches);
  const perimeterMeters = perimeterInches * 0.0254;

  let glassWidthInches = widthInches;
  let glassHeightInches = heightInches;
  let glassCost = 0;
  let glassPriceOriginal = 0;
  let glassCurrency = 'USD';
  let glassPriceUSD = 0;
  let glassAreaInches = 0;
  let glassAreaSquareMeters = 0;

  if (selectedGlass) {
    if (windowSystem.glassWidthEquation) {
      const calculatedWidth = evaluateLengthEquation(windowSystem.glassWidthEquation, widthInches, heightInches);
      if (calculatedWidth !== null && calculatedWidth > 0) {
        glassWidthInches = calculatedWidth;
      }
    }

    if (windowSystem.glassHeightEquation) {
      const calculatedHeight = evaluateLengthEquation(windowSystem.glassHeightEquation, widthInches, heightInches);
      if (calculatedHeight !== null && calculatedHeight > 0) {
        glassHeightInches = calculatedHeight;
      }
    }

    glassAreaInches = glassWidthInches * glassHeightInches;
    glassAreaSquareMeters = glassAreaInches / 1550;
    glassPriceOriginal = toFiniteNumber(selectedGlass.pricePerSquareMeter, 0);
    glassCurrency = selectedGlass.currency || 'USD';
    glassPriceUSD = convertToUSD(glassPriceOriginal, glassCurrency, exchangeRate);
    glassCost = glassPriceUSD * glassAreaSquareMeters;
  }

  const profileBreakdown = [];
  let profileCostTotal = 0;

  const userConfigurableProfiles = (windowSystem.profiles || []).filter((profile) => profile.showToUser);
  userConfigurableProfiles.forEach((profileItem, index) => {
    const selectedProfile = selectedProfiles[index] || null;
    const profileDoc = resolveProfileDoc(selectedProfile?.profileId || profileItem.profile, allProfiles);
    if (!profileDoc) {
      return;
    }

    let profileQuantity = selectedProfile && selectedProfile.quantity !== undefined
      ? toPositiveInt(selectedProfile.quantity, toPositiveInt(profileItem.quantity, 1))
      : toPositiveInt(profileItem.quantity, 1);

    if ((!selectedProfile || selectedProfile.quantity === undefined) && profileItem.quantityEquation) {
      const calculatedQuantity = evaluateQuantityEquation(profileItem.quantityEquation, widthInches, heightInches);
      if (calculatedQuantity !== null) {
        profileQuantity = Math.round(calculatedQuantity);
      }
    }

    const lengthMeters = getProfileLengthMeters({
      profileItem,
      selectedProfile,
      windowWidth: widthInches,
      windowHeight: heightInches,
      perimeterMeters
    });

    const pricePerMeterUSD = convertToUSD(profileDoc.pricePerMeter, profileDoc.currency || 'USD', exchangeRate);
    const profileCost = pricePerMeterUSD * lengthMeters * profileQuantity;
    profileCostTotal += profileCost;

    profileBreakdown.push({
      name: profileDoc.name,
      quantity: profileQuantity,
      lengthMeters,
      perimeterMeters,
      priceOriginal: toFiniteNumber(profileDoc.pricePerMeter, 0),
      currency: profileDoc.currency || 'USD',
      pricePerMeterUSD,
      cost: profileCost,
      isUserConfigurable: true
    });
  });

  (windowSystem.profiles || []).filter((profile) => !profile.showToUser).forEach((profileItem) => {
    const profileDoc = resolveProfileDoc(profileItem.profile, allProfiles);
    if (!profileDoc) {
      return;
    }

    let profileQuantity = toPositiveInt(profileItem.quantity, 1);
    if (profileItem.quantityEquation) {
      const calculatedQuantity = evaluateQuantityEquation(profileItem.quantityEquation, widthInches, heightInches);
      if (calculatedQuantity !== null) {
        profileQuantity = Math.round(calculatedQuantity);
      }
    }

    const lengthMeters = getProfileLengthMeters({
      profileItem,
      selectedProfile: null,
      windowWidth: widthInches,
      windowHeight: heightInches,
      perimeterMeters
    });

    const pricePerMeterUSD = convertToUSD(profileDoc.pricePerMeter, profileDoc.currency || 'USD', exchangeRate);
    const profileCost = pricePerMeterUSD * lengthMeters * profileQuantity;
    profileCostTotal += profileCost;

    profileBreakdown.push({
      name: profileDoc.name,
      quantity: profileQuantity,
      lengthMeters,
      perimeterMeters,
      priceOriginal: toFiniteNumber(profileDoc.pricePerMeter, 0),
      currency: profileDoc.currency || 'USD',
      pricePerMeterUSD,
      cost: profileCost,
      isUserConfigurable: false
    });
  });

  const selectedAccessoryQuantities = buildAccessoryQuantityMap(selectedAccessories);
  const accessoryBreakdown = [];
  let accessoryCostTotal = 0;

  (windowSystem.accessories || []).forEach((accessoryItem) => {
    const accessoryDoc = resolveAccessoryDoc(accessoryItem.accessory, allAccessories);
    if (!accessoryDoc) {
      return;
    }

    const accessoryId = String(accessoryDoc._id || accessoryItem.accessory);
    let quantityForCost;

    if (accessoryItem.showToUser) {
      if (!selectedAccessoryQuantities.has(accessoryId)) {
        return;
      }
      quantityForCost = selectedAccessoryQuantities.get(accessoryId);
    } else {
      quantityForCost = toFiniteNumber(accessoryItem.quantity, 1);
      if (accessoryItem.quantityEquation) {
        const calculatedQuantity = evaluateQuantityEquation(accessoryItem.quantityEquation, widthInches, heightInches);
        if (calculatedQuantity !== null) {
          quantityForCost = calculatedQuantity;
        }
      }
    }

    const priceUSD = convertToUSD(accessoryDoc.price, accessoryDoc.currency || 'USD', exchangeRate);
    const accessoryCost = priceUSD * quantityForCost;
    accessoryCostTotal += accessoryCost;

    accessoryBreakdown.push({
      name: accessoryDoc.name,
      quantity: quantityForCost,
      priceOriginal: toFiniteNumber(accessoryDoc.price, 0),
      currency: accessoryDoc.currency || 'USD',
      priceUSD,
      cost: accessoryCost,
      isUserConfigurable: Boolean(accessoryItem.showToUser)
    });
  });

  let muntinCost = 0;
  let muntinDetails = null;
  if (
    muntinConfiguration &&
    muntinConfiguration.enabled &&
    windowSystem.muntinConfiguration &&
    windowSystem.muntinConfiguration.enabled
  ) {
    const horizontalDivisions = toPositiveInt(muntinConfiguration.horizontalDivisions, 1);
    const verticalDivisions = toPositiveInt(muntinConfiguration.verticalDivisions, 1);
    const muntinProfileId = muntinConfiguration.muntinProfileId || windowSystem.muntinConfiguration.muntinProfile;
    const muntinProfile = resolveProfileDoc(muntinProfileId, allProfiles);

    if (muntinProfile) {
      const muntinPricePerMeterUSD = convertToUSD(muntinProfile.pricePerMeter, muntinProfile.currency || 'USD', exchangeRate);
      const horizontalMuntins = horizontalDivisions - 1;
      const verticalMuntins = verticalDivisions - 1;
      const horizontalLength = horizontalMuntins * widthInches * 0.0254;
      const verticalLength = verticalMuntins * heightInches * 0.0254;
      const totalMuntinLength = horizontalLength + verticalLength;
      muntinCost = muntinPricePerMeterUSD * totalMuntinLength;
      muntinDetails = {
        name: muntinProfile.name,
        priceOriginal: toFiniteNumber(muntinProfile.pricePerMeter, 0),
        currency: muntinProfile.currency || 'USD',
        priceUSD: muntinPricePerMeterUSD,
        horizontal: horizontalDivisions,
        vertical: verticalDivisions,
        length: totalMuntinLength,
        cost: muntinCost
      };
    }
  }

  const baseCost = glassCost + profileCostTotal + accessoryCostTotal + muntinCost;
  const areaInches = widthInches * heightInches;
  const areaSquareMeters = areaInches / 1550;
  const additionalCostFactor = costSettings
    ? (
      (toFiniteNumber(costSettings.packaging, 0) / 100) +
      (toFiniteNumber(costSettings.labor, 0) / 100) +
      (toFiniteNumber(costSettings.indirectCosts, 0) / 100)
    )
    : 0;
  const additionalCosts = baseCost * additionalCostFactor;
  const totalCostPerWindow = baseCost + additionalCosts;
  const adminMarkupFactor = 1 + (toFiniteNumber(adminMarkupPercent, 0) / 100);
  const totalPrice = totalCostPerWindow * quantity * adminMarkupFactor;
  const unitPrice = quantity > 0 ? parseFloat((totalPrice / quantity).toFixed(2)) : 0;

  return {
    glassCost,
    profileCostTotal,
    accessoryCostTotal,
    muntinCost,
    baseCost,
    additionalCosts,
    totalCostPerWindow,
    totalPrice,
    unitPrice,
    quantity,
    areaInches,
    areaSquareMeters,
    perimeterInches,
    perimeterMeters,
    glassPriceOriginal,
    glassCurrency,
    glassPriceUSD,
    glassWidthInches,
    glassHeightInches,
    glassAreaInches,
    glassAreaSquareMeters,
    profileBreakdown,
    accessoryBreakdown,
    muntinDetails
  };
}

module.exports = {
  evaluateQuantityEquation,
  evaluateLengthEquation,
  convertToUSD,
  calculateWindowConfigurationPricing
};
