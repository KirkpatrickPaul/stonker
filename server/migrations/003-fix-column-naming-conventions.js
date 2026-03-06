/**
 * Migration: Fix column naming conventions in top_hits table
 * 
 * This migration:
 * 1. Renames 'standardDeviation' to 'standard_deviation'
 * 2. Renames 'TrendTypeId' to 'trend_type_id' (if exists)
 * Ensures consistency with Sequelize snake_case conventions
 */

module.exports = {
  up: async (sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // Check if standardDeviation column exists and rename it
      const columns = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='top_hits' AND COLUMN_NAME='standardDeviation'`,
        { transaction }
      );

      if (columns[0] && columns[0].length > 0) {
        console.log('Migration: Found standardDeviation column, renaming to standard_deviation...');
        await sequelize.query(
          `ALTER TABLE top_hits CHANGE COLUMN standardDeviation standard_deviation FLOAT(8, 4) NULL`,
          { transaction }
        );
      }

      // Check if TrendTypeId column exists and rename it
      const trendTypeIdColumns = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='top_hits' AND COLUMN_NAME='TrendTypeId'`,
        { transaction }
      );

      if (trendTypeIdColumns[0] && trendTypeIdColumns[0].length > 0) {
        console.log('Migration: Found TrendTypeId column, renaming to trend_type_id...');
        
        // Drop foreign key if it exists
        try {
          await sequelize.query(
            `ALTER TABLE top_hits DROP FOREIGN KEY fk_top_hits_trend_type`,
            { transaction }
          );
        } catch (e) {
          // Foreign key may not exist
        }

        // Rename the column
        await sequelize.query(
          `ALTER TABLE top_hits CHANGE COLUMN TrendTypeId trend_type_id INT NULL`,
          { transaction }
        );

        // Recreate foreign key with correct column name
        await sequelize.query(
          `ALTER TABLE top_hits ADD CONSTRAINT fk_top_hits_trend_type 
           FOREIGN KEY (trend_type_id) REFERENCES trend_types(id) ON DELETE SET NULL`,
          { transaction }
        );
      }

      await transaction.commit();
      console.log('Migration: Successfully fixed column naming conventions in top_hits table');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // Reverse the migration - rename columns back to camelCase
      
      const columns = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='top_hits' AND COLUMN_NAME='standard_deviation'`,
        { transaction }
      );

      if (columns[0] && columns[0].length > 0) {
        console.log('Migration rollback: Renaming standard_deviation back to standardDeviation...');
        await sequelize.query(
          `ALTER TABLE top_hits CHANGE COLUMN standard_deviation standardDeviation FLOAT(8, 4) NULL`,
          { transaction }
        );
      }

      const trendTypeIdColumns = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='top_hits' AND COLUMN_NAME='trend_type_id'`,
        { transaction }
      );

      if (trendTypeIdColumns[0] && trendTypeIdColumns[0].length > 0) {
        console.log('Migration rollback: Renaming trend_type_id back to TrendTypeId...');
        
        // Drop foreign key
        try {
          await sequelize.query(
            `ALTER TABLE top_hits DROP FOREIGN KEY fk_top_hits_trend_type`,
            { transaction }
          );
        } catch (e) {
          // Foreign key may not exist
        }

        // Rename the column back
        await sequelize.query(
          `ALTER TABLE top_hits CHANGE COLUMN trend_type_id TrendTypeId INT NULL`,
          { transaction }
        );

        // Recreate foreign key with old column name
        await sequelize.query(
          `ALTER TABLE top_hits ADD CONSTRAINT fk_top_hits_trend_type 
           FOREIGN KEY (TrendTypeId) REFERENCES trend_types(id) ON DELETE SET NULL`,
          { transaction }
        );
      }

      await transaction.commit();
      console.log('Migration rollback: Successfully reverted column naming');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
