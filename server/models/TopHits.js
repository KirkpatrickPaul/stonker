module.exports = function(sequelize, DataTypes) {
  const TopHit = sequelize.define('top_hits', {
    z_score: {
      type: DataTypes.FLOAT(5, 2),
      field: 'z_score'
    },
    standardDeviation: {
      type: DataTypes.FLOAT(8, 4),
    },
  });

  TopHit.associate = function(models) {
    TopHit.belongsTo(models.Company, {
      foreignKey: {
        allowNull: true
      }
    });
    TopHit.belongsTo(models.TrendType, {
      foreignKey: {
        allowNull: true
      }
    });
    TopHit.belongsToMany(models.notable_hits, {
      through: 'notable_hits_top_hits',
      foreignKey: 'top_hits_id',
      otherKey: 'notable_hits_id'
    });
    TopHit.hasMany(models.Comment, {
      onDelete: 'set null'
    });
  };

  return TopHit;
};
