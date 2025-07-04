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
      
      // Update database with latest rate
      await updateDatabaseExchangeRate(rate);
      
      console.log(`Exchange rate updated: 1 USD = ${rate} COP`);
      return rate;
    }
  } catch (error) {
    console.error('Error fetching live exchange rate:', error.message);
  }
  
  // Return cached rate if API fails
  return exchangeRateCache.rate;
}

/**
 * Update database with latest exchange rate
 */
async function updateDatabaseExchangeRate(rate) {
  try {
    let costSettings = await CostSettings.findOne();
    if (costSettings) {
      costSettings.exchangeRate = rate;
      await costSettings.save();
    }
  } catch (error) {
    console.error('Error updating database exchange rate:', error.message);
  }
}

/**
 * Get current exchange rate (from cache, database, or API)
 */
async function getExchangeRate() {
  try {
    // First try to get from cache if recent
    const now = new Date().getTime();
    if (exchangeRateCache.lastFetch && 
        (now - exchangeRateCache.lastFetch) < exchangeRateCache.cacheExpiry) {
      return exchangeRateCache.rate;
    }

    // Try to get from database
    const costSettings = await CostSettings.findOne();
    if (costSettings && costSettings.exchangeRate) {
      exchangeRateCache.rate = costSettings.exchangeRate;
      exchangeRateCache.lastFetch = now;
      return costSettings.exchangeRate;
    }

    // Fallback to API
    return await fetchLiveExchangeRate();
  } catch (error) {
    console.error('Error getting exchange rate:', error.message);
    return exchangeRateCache.rate; // Return cached fallback
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