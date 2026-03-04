const db = require('../../models');

const checkHit = (company, newTrend) => {
  if (newTrend.day6max === 100) {
    const lastTrend = company.dataValues.Trends.reduce((acc, trend) =>
      acc.createdAt < trend.createdAt ? trend : acc
    );
    const daysDiff = Math.round(
      (newTrend.createdAt - lastTrend.createdAt) / (24 * 60 * 60 * 1000)
    );
    if (daysDiff < 6) {
      // this will exclude days which lastTrend and newTrend don't have in common
      let lastTrendAvgs = new Map();
      for (let i = 6; i > daysDiff; i--) {
        lastTrendAvgs.set(i, lastTrend[`day${i}avg`]);
      }
      const topAvg = { avg: 0, day: 0 };
      lastTrendAvgs.forEach((avg, key) => {
        if (topAvg.avg < avg) {
          topAvg.avg = avg;
          topAvg.day = key;
        }
      });

      const compAvg = newTrend[`day${topAvg.day - daysDiff}avg`];
      const drop = topAvg.avg - compAvg;
      const z_score = drop / lastTrend.standardDeviation;
      
      db.top_hits.create({
        CompanyId: company.dataValues.id,
        z_score: z_score,
        standardDeviation: lastTrend.standardDeviation
      });
    }
  }
};

module.exports = checkHit;
