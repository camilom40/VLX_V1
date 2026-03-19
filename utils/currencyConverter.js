const CostSettings = require('../models/CostSettings');
const axios = require('axios');

// Cache for exchange rate to avoid excessive API calls
let exchangeRateCache = {
  rate: 4000, // Default fallback rate
  lastFetch: null,
  cacheExpiry: 60 * 60 * 1000 // 1 hour cache
};

/**
 * Fetch live exchange rate from API
 */
async function fetchLiveExchangeRate() {
  try {
    // Check cache first
    const now = new Date().getTime();
    if (exchangeRateCache.lastFetch && 
        (now - exchangeRateCache.lastFetch) < exchangeRateCache.cacheExpiry) {
      return exchangeRateCache.rate;
    }

    console.log('Fetching live exchange rate from API...');
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    const rate = response.data.rates.COP;
    
    if (rate && rate > 0) {
      exchangeRateCache.rate = rate;
      exchangeRateCache.lastFetch = now;
      // Do not write API rate to MongoDB — TRM for pricing is set in Admin → Cost Settings.
      console.log(`Exchange rate (market reference cached): 1 USD = ${rate} COP`);
      return rate;
    }
  } catch (error) {
    console.error('Error fetching live exchange rate:', error.message);
  }
  
  // Return cached rate if API fails
  return exchangeRateCache.rate;
}

/**
 * Get current exchange rate according to Admin → Cost Settings (manual vs market).
 */
async function getExchangeRate() {
  try {
    const costSettings = await CostSettings.findOne();
    const source = costSettings?.exchangeRateSource === 'market' ? 'market' : 'manual';

    if (source === 'market') {
      try {
        const live = await fetchLiveExchangeRate();
        if (live && live > 0) {
          return live;
        }
      } catch (e) {
        console.warn('Market TRM unavailable, using fallback:', e.message);
      }
      const fallback = costSettings?.exchangeRate && costSettings.exchangeRate > 0
        ? costSettings.exchangeRate
        : exchangeRateCache.rate;
      return fallback > 0 ? fallback : 4000;
    }

    // Manual: always use value stored in DB
    if (costSettings?.exchangeRate && costSettings.exchangeRate > 0) {
      exchangeRateCache.rate = costSettings.exchangeRate;
      exchangeRateCache.lastFetch = Date.now();
      return costSettings.exchangeRate;
    }

    return exchangeRateCache.rate > 0 ? exchangeRateCache.rate : 4000;
  } catch (error) {
    console.error('Error getting exchange rate:', error.message);
    return exchangeRateCache.rate > 0 ? exchangeRateCache.rate : 4000;
  }
}

/**
 * Convert price from one currency to another
 * @param {number} price - The price to convert
 * @param {string} fromCurrency - Source currency ('COP' or 'USD')
 * @param {string} toCurrency - Target currency ('COP' or 'USD')
 * @param {number} exchangeRate - Custom exchange rate (optional)
 * @returns {number} - Converted price
 */
function convertPrice(price, fromCurrency, toCurrency, exchangeRate = null) {
  // Validate input price
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice < 0) {
    console.warn(`Invalid price for conversion: ${price}`);
    return 0;
  }
  
  // Validate currencies
  if (!fromCurrency || !toCurrency) {
    console.warn(`Invalid currencies: from=${fromCurrency}, to=${toCurrency}`);
    return numPrice;
  }
  
  // If same currency, return as-is
  if (fromCurrency === toCurrency) {
    return numPrice;
  }
  
  // Get exchange rate and validate
  const rate = exchangeRate || exchangeRateCache.rate;
  if (isNaN(rate) || rate <= 0) {
    console.warn(`Invalid exchange rate: ${rate}`);
    return numPrice; // Return original price if rate is invalid
  }
  
  if (fromCurrency === 'USD' && toCurrency === 'COP') {
    return numPrice * rate;
  } else if (fromCurrency === 'COP' && toCurrency === 'USD') {
    return numPrice / rate;
  }
  
  return numPrice; // fallback
}

/**
 * Convert any price to COP for calculations
 * @param {number} price - The price to convert
 * @param {string} currency - Source currency ('COP' or 'USD')
 * @param {number} exchangeRate - Custom exchange rate (optional)
 * @returns {number} - Price in COP
 */
function convertToCOP(price, currency, exchangeRate = null) {
  return convertPrice(price, currency, 'COP', exchangeRate);
}

/**
 * Convert any price to USD for calculations
 * @param {number} price - The price to convert
 * @param {string} currency - Source currency ('COP' or 'USD')
 * @param {number} exchangeRate - Custom exchange rate (optional)
 * @returns {number} - Price in USD
 */
function convertToUSD(price, currency, exchangeRate = null) {
  return convertPrice(price, currency, 'USD', exchangeRate);
}

// Initialize exchange rate on module load
(async () => {
  try {
    await getExchangeRate();
  } catch (error) {
    console.error('Error initializing exchange rate:', error.message);
  }
})();

// Auto-update exchange rate every hour
setInterval(async () => {
  try {
    await fetchLiveExchangeRate();
  } catch (error) {
    console.error('Error in scheduled exchange rate update:', error.message);
  }
}, 60 * 60 * 1000); // 1 hour

module.exports = {
  convertPrice,
  convertToCOP,
  convertToUSD,
  getExchangeRate,
  fetchLiveExchangeRate
}; 