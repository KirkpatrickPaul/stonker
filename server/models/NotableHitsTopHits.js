module.exports = function(sequelize, DataTypes) {
  const NotableHitsTopHits = sequelize.define('notable_hits_top_hits', {
    // junction table - no additional fields needed beyond foreign keys
  }, {
    timestamps: true
  });

  NotableHitsTopHits.associate = function(models) {
    NotableHitsTopHits.belongsTo(models.notable_hits, {
      foreignKey: {
        allowNull: false
      }
    });
    NotableHitsTopHits.belongsTo(models.top_hits, {
      foreignKey: {
        allowNull: false
      }
    });
  };

  return NotableHitsTopHits;
};
