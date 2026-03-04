const db = require('../../models');
const { Op } = require('sequelize');

// Minimum movement threshold as a percentage (4% minimum to avoid noise)
const MINIMUM_MOVEMENT_PERCENTAGE = 0.04;
// Minimum composite score threshold for notable hits
const MINIMUM_COMPOSITE_SCORE = 0.10; // 10%

/**
 * Check if a company has a sustained spike (topHits for multiple consecutive days)
 * Returns { triggered: boolean, daysWithHits: number, hitIds: [] }
 */
const checkSustainedSpike = async (company, midnight) => {
  try {
    const topHits = await db.top_hits.findAll({
      where: {
        CompanyId: company.id
      },
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    if (!topHits || topHits.length === 0) {
      return { triggered: false, daysWithHits: 0, hitIds: [] };
    }

    // Group hits by day
    const hitsByDay = new Map();
    const dayInMs = 24 * 60 * 60 * 1000;

    topHits.forEach(hit => {
      const hitDay = Math.floor((hit.createdAt.getTime()) / dayInMs);
      if (!hitsByDay.has(hitDay)) {
        hitsByDay.set(hitDay, []);
      }
      hitsByDay.get(hitDay).push(hit.id);
    });

    // Check for multiple consecutive or near-consecutive days
    const sortedDays = Array.from(hitsByDay.keys()).sort((a, b) => b - a);
    
    if (sortedDays.length < 3) {
      return { triggered: false, daysWithHits: sortedDays.length, hitIds: [] };
    }

    // Check if hits span at least 3 days (can have gaps)
    const daySpan = sortedDays[0] - sortedDays[sortedDays.length - 1];
    
    if (daySpan >= 2) {
      // At least 3 days with hits in the last several days
      const allHitIds = topHits.map(h => h.id);
      return { triggered: true, daysWithHits: sortedDays.length, hitIds: allHitIds };
    }

    return { triggered: false, daysWithHits: sortedDays.length, hitIds: [] };
  } catch (err) {
    console.error(`checkSustainedSpike: Error checking sustained spike for ${company.symbol}: ${err.message}`);
    return { triggered: false, daysWithHits: 0, hitIds: [] };
  }
};

/**
 * Check for multi-trend anomaly (multiple trendTypes showing anomalies)
 * Returns { triggered: boolean, score: number, hitIds: [] }
 */
const checkMultiTrendAnomaly = async (company, midnight) => {
  try {
    // Get topHits from today grouped by trendType
    const topHits = await db.top_hits.findAll({
      where: {
        CompanyId: company.id,
        createdAt: { [Op.gte]: midnight }
      }
    });

    if (!topHits || topHits.length === 0) {
      return { triggered: false, score: 0, hitIds: [] };
    }

    // Check if we have hits from multiple trendTypes
    const trendTypeIds = new Set(topHits.map(hit => hit.TrendTypeId));

    if (trendTypeIds.size < 2) {
      return { triggered: false, score: trendTypeIds.size, hitIds: [] };
    }

    // Calculate composite score from z-scores
    let totalZScore = 0;
    topHits.forEach(hit => {
      totalZScore += Math.abs(hit.z_score || 0);
    });

    const compositeScore = totalZScore / topHits.length;

    // Check if composite score meets minimum threshold
    if (compositeScore < MINIMUM_MOVEMENT_PERCENTAGE) {
      return { triggered: false, score: compositeScore, hitIds: [] };
    }

    const hitIds = topHits.map(h => h.id);
    return { triggered: true, score: compositeScore, hitIds };
  } catch (err) {
    console.error(`checkMultiTrendAnomaly: Error checking multi-trend anomaly for ${company.symbol}: ${err.message}`);
    return { triggered: false, score: 0, hitIds: [] };
  }
};

/**
 * Check for composite surge (sum of z-scores exceeds threshold)
 * Returns { triggered: boolean, score: number, hitIds: [] }
 */
const checkCompositeSurge = async (company, midnight) => {
  try {
    const topHits = await db.top_hits.findAll({
      where: {
        CompanyId: company.id,
        createdAt: { [Op.gte]: midnight }
      }
    });

    if (!topHits || topHits.length === 0) {
      return { triggered: false, score: 0, hitIds: [] };
    }

    // Sum up the z-scores
    let totalScore = 0;
    topHits.forEach(hit => {
      totalScore += Math.abs(hit.z_score || 0);
    });

    // Check if composite score meets minimum threshold (10%)
    if (totalScore < MINIMUM_COMPOSITE_SCORE) {
      return { triggered: false, score: totalScore, hitIds: [] };
    }

    const hitIds = topHits.map(h => h.id);
    return { triggered: true, score: totalScore, hitIds };
  } catch (err) {
    console.error(`checkCompositeSurge: Error checking composite surge for ${company.symbol}: ${err.message}`);
    return { triggered: false, score: 0, hitIds: [] };
  }
};

/**
 * Main function to check for all notable hit types for a company
 * Returns array of notable_hit objects to create
 */
const checkNotableHit = async (company, midnight) => {
  try {
    const notableHits = [];

    // Check sustained spike
    const sustainedSpike = await checkSustainedSpike(company, midnight);
    if (sustainedSpike.triggered) {
      notableHits.push({
        trigger_type: 'sustained_spike',
        composite_score: sustainedSpike.daysWithHits * 0.025, // Score based on number of days
        topHitIds: sustainedSpike.hitIds
      });
    }

    // Check multi-trend anomaly
    const multiTrend = await checkMultiTrendAnomaly(company, midnight);
    if (multiTrend.triggered) {
      notableHits.push({
        trigger_type: 'multi_trend_anomaly',
        composite_score: multiTrend.score,
        topHitIds: multiTrend.hitIds
      });
    }

    // Check composite surge
    const compositeSurge = await checkCompositeSurge(company, midnight);
    if (compositeSurge.triggered) {
      notableHits.push({
        trigger_type: 'composite_surge',
        composite_score: compositeSurge.score,
        topHitIds: compositeSurge.hitIds
      });
    }

    // Create notable_hits and associations
    for (const notableHitData of notableHits) {
      try {
        const createdNotableHit = await db.notable_hits.create({
          trigger_type: notableHitData.trigger_type,
          composite_score: notableHitData.composite_score,
          CompanyId: company.id
        });

        // Create associations with topHits
        if (notableHitData.topHitIds && notableHitData.topHitIds.length > 0) {
          for (const topHitId of notableHitData.topHitIds) {
            try {
              await db.notable_hits_top_hits.create({
                notable_hits_id: createdNotableHit.id,
                top_hits_id: topHitId
              });
            } catch (assocErr) {
              // Skip if association already exists
              if (assocErr.name !== 'SequelizeUniqueConstraintError') {
                console.error(`checkNotableHit: Error creating association for notable hit ${createdNotableHit.id}: ${assocErr.message}`);
              }
            }
          }
        }

        console.log(`checkNotableHit: Created ${notableHitData.trigger_type} notable hit for ${company.symbol} with score ${notableHitData.composite_score}`);
      } catch (createErr) {
        console.error(`checkNotableHit: Error creating notable hit for ${company.symbol}: ${createErr.message}`);
      }
    }

    return notableHits;
  } catch (err) {
    console.error(`checkNotableHit: Error checking notable hits for ${company.symbol}: ${err.message}`);
    return [];
  }
};

module.exports = checkNotableHit;
