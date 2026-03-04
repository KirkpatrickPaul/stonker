module.exports = function(sequelize, DataTypes) {
  const NotableHits = sequelize.define('notable_hits', {
    trigger_type: {
      type: DataTypes.ENUM('multi_trend_anomaly', 'composite_surge', 'sustained_spike'),
      allowNull: false
    },
    composite_score: {
      type: DataTypes.FLOAT(8, 4),
      allowNull: false
    }
  });

  NotableHits.associate = function(models) {
    NotableHits.belongsTo(models.Company, {
      foreignKey: {
        allowNull: false
      }
    });
    NotableHits.belongsToMany(models.top_hits, {
      through: 'notable_hits_top_hits',
      foreignKey: 'notable_hits_id',
      otherKey: 'top_hits_id'
    });
  };

  return NotableHits;
};
