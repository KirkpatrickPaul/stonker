const Op = require('sequelize').Op;

const db = require('../../models');
const searchTrends = require('./searchTrends');
const checkHit = require('./checkHit');
const sequelize = require('sequelize');

const MINIMUM_TREND_INTERVAL = 20 * 1000; // 20 seconds in milliseconds
const MAXIMUM_ADDITIONAL_INTERVAL = 35 * 1000; // 35 seconds in milliseconds
MAXIMUM_RETRIES = 3;

const standardDev = function(array) {
  const mean = array.reduce((acc, num) => acc + num) / array.length;
  return Math.sqrt(
    array.reduce((acc, n) => acc + Math.pow(n - mean, 2)) / array.length - 1
  );
};

class TrendHandler {
  #midnight = new Date(new Date().setUTCHours(0, 0, 0, 0));
  #failures = {};
  #stoppedTrying = [];
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
    if (!silent && Object.keys(this.#failures).length > 0 ) {
      let message = 'The following stock symbols had failures to collect: ';
      for (const [symbol, count] of Object.entries(this.#failures)) {
        message += `${symbol} (${count} failures), `;
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
    let company = null;
    let counter = 0;
    while (!company) {
      if (counter > 10) break;
      company = await this.getCompany();
      counter++;
    }
    if (!company) {
      company = await this.getCompany(false);
      if (!company) {
        console.log('scheduleRecurringCollection: No company found to collect trends for.');
        this.stop();
        return;
      }
    }
    const trend = await this.createTrend(company);
    // console.log("trend: " + JSON.stringify(trend));
    if (trend && company.Trends && company.Trends[0]) {
      checkHit(company, trend);
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

  async createTrend(company) {
  try {
    const res = await searchTrends(company.symbol, this.#midnight);
    let failed = false;
    let trendResults = null;
    if (!res || res[0] === '<') failed = true;
    if (!failed) {
      trendResults = JSON.parse(res).default.timelineData;
      if (!trendResults || trendResults.length === 0 || !trendResults[0].value || trendResults[0].value.length === 0) failed = true;
    }
    if (failed) {
      if (this.#failures[company.symbol]) {
        this.#failures[company.symbol]++;
        console.error(`createTrend: Failed to get trends for ${company.symbol}. Attempt ${this.#failures[company.symbol]}.`);
        if (this.#failures[company.symbol] >= MAXIMUM_RETRIES) {
          console.log(`createTrend: Maximum retries reached for ${company.symbol}. Stopping attempts to collect trends for this company.`);
          this.#stoppedTrying.push(company.symbol);
          this.decrementToCollect();
        }
      } else {
        this.#failures[company.symbol] = 1;
        console.error(`createTrend: Failed to get trends for ${company.symbol}. Attempt 1.`);
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
    dbData.TrendTypeId = 1; // currently only one trend type, so hardcoding to 1. Will need to be dynamic if more trend types are added in the future.
    const newTrend = await db.Trend.create(dbData);
    const updated = await db.Company.update(
      { checkedAt: this.#midnight },
      { where: { id: dbData.CompanyId } }
    );
    if (updated && newTrend && newTrend.id) {
      this.decrementToCollect();
      return newTrend;
    } else console.log(`updated: ${updated}`)

  } catch (err) {
    console.error("createTrend: " + err);
  }
};

}

trendHandler = new TrendHandler();

const collectTrends = async () => {
  await trendHandler.initialize();
  await trendHandler.start();
}
module.exports = collectTrends;
