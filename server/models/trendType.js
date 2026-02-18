module.exports = function(sequelize, DataTypes) {
  const TrendType = sequelize.define('TrendType', {
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    // column from Company used to generate this trend type
    fieldUsed: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    // what is actually searched for using the fieldUsed. Example: "%f stock" where %f is the fieldUsed
    syntax: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  });

  TrendType.associate = function(models) {
    TrendType.hasMany(models.Trend, {
      foreignKey: {
        allowNull: false
      },
      onDelete: "set null"
    });
  };
  return TrendType;
};
