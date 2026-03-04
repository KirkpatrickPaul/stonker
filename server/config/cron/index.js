const Op = require('sequelize').Op;

const db = require('../../models');
const searchTrends = require('./searchTrends');
const checkHit = require('./checkHit');
const checkNotableHit = require('./checkNotableHit');
const sequelize = require('sequelize');

const MINIMUM_TREND_INTERVAL = 20 * 1000; // 20 seconds in milliseconds
const MAXIMUM_ADDITIONAL_INTERVAL = 35 * 1000; // 35 seconds in milliseconds
const MAXIMUM_RETRIES = 3;

const standardDev = function(array) {
  const mean = array.reduce((acc, num) => acc + num) / array.length;
  return Math.sqrt(
    array.reduce((acc, n) => acc + Math.pow(n - mean, 2)) / array.length - 1
  );
};

class TrendHandler {
  #midnight = new Date(new Date().setUTCHours(0, 0, 0, 0));
  #failures = {}; // { symbol: { trendTypeId: retryCount } }
  #stoppedTrying = []; // { symbol, trendTypeId }
  #toCollectCount = 0;
  #timerId = null;
  trendTypes = null;
  
  set newDay(date) {
    this.#midnight = new Date(date);
    this.#midnight.setUTCHours(0, 0, 0, 0);
  }

  decrementToCollect() {
    console.log("decrementing toCollectCount. Current count: " + this.#toCollectCount);
    this.#toCollectCount--;
  }

  getFailureCount(symbol, trendTypeId) {
    if (!this.#failures[symbol]) {
      return 0;
    }
    return this.#failures[symbol][trendTypeId] || 0;
  }

  incrementFailure(symbol, trendTypeId) {
    if (!this.#failures[symbol]) {
      this.#failures[symbol] = {};
    }
    this.#failures[symbol][trendTypeId] = (this.#failures[symbol][trendTypeId] || 0) + 1;
  }

  hasStoppedTrying(symbol, trendTypeId) {
    return this.#stoppedTrying.some(item => item.symbol === symbol && item.trendTypeId === trendTypeId);
  }

  addToStoppedTrying(symbol, trendTypeId) {
    if (!this.hasStoppedTrying(symbol, trendTypeId)) {
      this.#stoppedTrying.push({ symbol, trendTypeId });
    }
  }

  isCompanyFullyStoppedTrying(symbol) {
    if (!this.trendTypes) return false;
    return this.trendTypes.every(tt => this.hasStoppedTrying(symbol, tt.id));
  }
  
  async initialize() {
    this.stop(true);
    this.#midnight = new Date();
    this.#midnight.setUTCHours(0, 0, 0, 0);
    this.trendTypes = null;
    try {
      const companyCount = await db.Company.count({
        where: { checkedAt: { [Op.lt]: this.#midnight } }
      });
      this.#toCollectCount = companyCount;

      this.trendTypes = await db.TrendType.findAll();
      if (!this.trendTypes || this.trendTypes.length === 0) console.log('initialize: No trend types found.');
    } catch (err) {
        console.error(err);
    }
  };

  async start() {
    console.log('Starting daily trend collection.');
        if (this.#toCollectCount <= 0) {
      console.log('No companies to collect trends for. Stopping trend collection.');
      this.stop();
      return;
    }
    this.scheduleRecurringCollection();
  }

  stop(silent = false) {
    if (!silent) console.log('Finished collecting trends for the day.');
    if (this.#toCollectCount > 0 && !silent) {
      console.log(`Stopped with ${this.#toCollectCount} companies left to collect.`);
    }
    if (!silent && Object.keys(this.#failures).length > 0) {
      let message = 'The following had failures to collect: ';
      for (const [symbol, trendTypeFailures] of Object.entries(this.#failures)) {
        for (const [trendTypeId, count] of Object.entries(trendTypeFailures)) {
          message += `${symbol}/TrendType${trendTypeId} (${count} failures), `;
        }
      }
      console.log(message);
    }
    this.#toCollectCount = 0;
    this.#failures = {};
    this.#stoppedTrying = [];
    if (this.#timerId) clearTimeout(this.#timerId);
    this.#timerId = null;
  }

  async scheduleRecurringCollection() {
    // Get a company with unchecked trendTypes for today
    const companyAndTrendType = await this.getCompanyWithUncheckedTrendType();
    
    if (!companyAndTrendType) {
      console.log('scheduleRecurringCollection: No company found with unchecked trend types.');
      this.stop();
      return;
    }

    const { company, trendType } = companyAndTrendType;
    const trend = await this.createTrend(company, trendType);
    
    if (trend) {
      // Check hit against new trend
      if (company.Trends && company.Trends[0]) {
        const topHit = await checkHit(company, trend);
        
        // Check for notable hits if a topHit was created
        if (topHit) {
          await checkNotableHit(company, this.#midnight);
        }
      }

      // Check if all trendTypes for this company have been collected
      const allCollected = await this.areAllTrendTypesCollected(company.id);
      if (allCollected) {
        // Update checked_at only when all trendTypes are done
        await db.Company.update(
          { checkedAt: this.#midnight },
          { where: { id: company.id } }
        );
        this.decrementToCollect();
        console.log(`scheduleRecurringCollection: All trend types collected for ${company.symbol}. Updated checked_at.`);
      }
    }

    const timer = setTimeout(() => {
      this.scheduleRecurringCollection();
    }, Math.floor((Math.random() * MAXIMUM_ADDITIONAL_INTERVAL) + MINIMUM_TREND_INTERVAL));
    this.#timerId = timer;
  }

  async getCompany(randomize = true) {
    try {
      let randomOffset = 0;
      if (randomize) randomOffset = Math.floor(Math.random() * (this.#toCollectCount + 1));
    const company = await db.Company.findOne({
      include: [db.Trend],
      // Op.lte should be less than or equal to
      where: { checkedAt: { [Op.lt]: this.#midnight }, symbol: { [Op.notIn]: this.#stoppedTrying } },
      offset: randomOffset
    });
    return company
  } catch (err) {
    console.error("getCompany: " + err);
  }
  }

  async getCompanyWithUncheckedTrendType(randomize = true) {
    try {
      let randomOffset = 0;
      if (randomize) {
        randomOffset = Math.floor(Math.random() * (this.#toCollectCount - 99));
        if (randomOffset < 0) randomOffset = 0;
      }
      
      // Get companies that haven't been fully checked
      const companies = await db.Company.findAll({
        include: [{
          model: db.Trend,
          where: {
            createdAt: { [Op.gte]: this.#midnight }
          },
          required: false
        }],
        where: { checkedAt: { [Op.lt]: this.#midnight } },
        offset: randomOffset,
        limit: 100
      });

      if (!companies || companies.length === 0) {
        return null;
      }

      // Filter out companies that are completely stopped trying
      const availableCompanies = companies.filter(
        company => !this.isCompanyFullyStoppedTrying(company.symbol)
      );

      if (availableCompanies.length === 0) {
        return null;
      }

      // Pick a random available company
      const company = availableCompanies[Math.floor(Math.random() * availableCompanies.length)];

      // Find unchecked trendTypes for this company
      const collectedTrendTypeIds = new Set(
        (company.Trends || []).map(t => t.TrendTypeId)
      );

      const uncheckedTrendTypes = this.trendTypes.filter(tt => 
        !collectedTrendTypeIds.has(tt.id) && !this.hasStoppedTrying(company.symbol, tt.id)
      );

      if (uncheckedTrendTypes.length === 0) {
        return null;
      }

      // Pick a random unchecked trendType
      const trendType = uncheckedTrendTypes[Math.floor(Math.random() * uncheckedTrendTypes.length)];

      return { company, trendType };
    } catch (err) {
      console.error("getCompanyWithUncheckedTrendType: " + err);
      return null;
    }
  }

  async areAllTrendTypesCollected(companyId) {
    try {
      const trendsToday = await db.Trend.findAll({
        where: {
          CompanyId: companyId,
          createdAt: { [Op.gte]: this.#midnight }
        }
      });

      const collectedTrendTypeIds = new Set(
        trendsToday.map(t => t.TrendTypeId)
      );

      // Check if all trendTypes have been collected
      return this.trendTypes.every(tt => collectedTrendTypeIds.has(tt.id));
    } catch (err) {
      console.error("areAllTrendTypesCollected: " + err);
      return false;
    }
  }

  async createTrend(company, trendType) {
  try {
    // Build the search query from trendType configuration
    const fieldValue = company[trendType.dataValues.fieldUsed];
    if (!fieldValue) {
      console.warn(`createTrend: Field '${trendType.dataValues.fieldUsed}' not found on company ${company.symbol}. Skipping trend collection for trend type '${trendType.dataValues.name}'.`);
      this.addToStoppedTrying(company.symbol, trendType.id);
      return;
    }
    
    // Replace %f in syntax with the actual field value
    const searchQuery = trendType.dataValues.syntax.replace('%f', fieldValue);
    console.log(`createTrend: Searching for '${searchQuery}' using trend type '${trendType.dataValues.name}' for company ${company.symbol}`);
    
    const res = await searchTrends(searchQuery, this.#midnight);
    let failed = false;
    let trendResults = null;
    if (!res || res[0] === '<') failed = true;
    if (!failed) {
      trendResults = JSON.parse(res).default.timelineData;
      if (!trendResults || trendResults.length === 0 || !trendResults[0].value || trendResults[0].value.length === 0) failed = true;
    }
    if (failed) {
      const failureCount = this.getFailureCount(company.symbol, trendType.id);
      this.incrementFailure(company.symbol, trendType.id);
      const newFailureCount = this.getFailureCount(company.symbol, trendType.id);
      
      console.error(`createTrend: Failed to get trends for ${company.symbol} with trend type '${trendType.dataValues.name}'. Attempt ${newFailureCount}.`);
      
      if (newFailureCount >= MAXIMUM_RETRIES) {
        console.log(`createTrend: Maximum retries reached for ${company.symbol} / ${trendType.dataValues.name}. Stopping attempts for this combo.`);
        this.addToStoppedTrying(company.symbol, trendType.id);
      }
      return;
    }

    const stdDev = standardDev(trendResults.map((obj) => obj.value[0]));
    const dayifier = 24 * 60 * 60;
    const day6 = this.#midnight / (dayifier * 1000);
    const dateMap = trendResults.reduce(
      (map, trend) => {
        const day = Math.trunc(day6 - parseInt(trend.time) / dayifier);
        switch (day) {
          case 0:
            map.set('day6', [...map.get('day6'), trend]);
            return map;
          case 1:
            map.set('day5', [...map.get('day5'), trend]);
            return map;
          case 2:
            map.set('day4', [...map.get('day4'), trend]);
            return map;
          case 3:
            map.set('day3', [...map.get('day3'), trend]);
            return map;
          case 4:
            map.set('day2', [...map.get('day2'), trend]);
            return map;
          case 5:
            map.set('day1', [...map.get('day1'), trend]);
            return map;
          default:
            map.set('day7', [trend]);
            return map;
        }
      }, new Map([
        ['day1', []],
        ['day2', []],
        ['day3', []],
        ['day4', []],
        ['day5', []],
        ['day6', []]
      ])
    );
    let dbData = {};
    dateMap.forEach((day, key) => {
      let max = 0;
      const avg =
        day.reduce((acc, trend) => {
          const val = trend.value[0];
          if (max < val) {
            max = val;
          }
          return acc + val;
        }, 1) / day.length;

      dbData[key + 'avg'] = avg.toFixed(3);
      dbData[key + 'max'] = max;
    });

    dbData.standardDeviation = stdDev.toFixed(3);
    dbData.CompanyId = company.id;
    dbData.TrendTypeId = trendType.id;
    const newTrend = await db.Trend.create(dbData);
    
    console.log(`createTrend: Successfully created trend for ${company.symbol} with trend type '${trendType.dataValues.name}'`);
    return newTrend;

  } catch (err) {
    console.error("createTrend: " + err);
    return null;
  }
};

}

trendHandler = new TrendHandler();

const collectTrends = async () => {
  await trendHandler.initialize();
  await trendHandler.start();
}
module.exports = collectTrends;
