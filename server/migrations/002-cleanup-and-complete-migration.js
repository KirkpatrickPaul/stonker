/**
 * Migration: Clean up partial migration and properly apply changes
 * 
 * This migration:
 * 1. Removes the partially applied migration changes
 * 2. Applies the full migration correctly with proper table references
 */

module.exports = {
  up: async (sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // Check and remove columns if they exist from the failed migration
      const columns = await sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='top_hits' AND COLUMN_NAME IN ('z_score', 'standardDeviation', 'TrendTypeId')`,
        { transaction }
      );

      // Drop columns from failed attempt if they exist
      if (columns[0].length > 0) {
        // Drop foreign key if it exists
        try {
          await sequelize.query(
            `ALTER TABLE top_hits DROP FOREIGN KEY fk_top_hits_trend_type`,
            { transaction }
          );
        } catch (e) {
          // Foreign key may not exist, continue
        }

        // Drop the columns one by one
        for (const col of columns[0]) {
          try {
            await sequelize.query(
              `ALTER TABLE top_hits DROP COLUMN ${col.COLUMN_NAME}`,
              { transaction }
            );
          } catch (e) {
            // Column may not exist
          }
        }
      }

      // Now apply the migration properly
      await sequelize.query(
        `ALTER TABLE top_hits ADD COLUMN z_score FLOAT(5, 2) NULL`,
        { transaction }
      );

      // Copy indicator values multiplied by 2 to the new column
      await sequelize.query(
        `UPDATE top_hits SET z_score = indicator * 2 WHERE indicator IS NOT NULL`,
        { transaction }
      );

      // Add standardDeviation column
      await sequelize.query(
        `ALTER TABLE top_hits ADD COLUMN standardDeviation FLOAT(8, 4) NULL`,
        { transaction }
      );

      // Add TrendTypeId foreign key column
      await sequelize.query(
        `ALTER TABLE top_hits ADD COLUMN TrendTypeId INT NULL`,
        { transaction }
      );

      // Add foreign key constraint for TrendTypeId with correct table name
      await sequelize.query(
        `ALTER TABLE top_hits ADD CONSTRAINT fk_top_hits_trend_type 
         FOREIGN KEY (TrendTypeId) REFERENCES trend_types(id) ON DELETE SET NULL`,
        { transaction }
      );

      // Drop the old indicator column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN indicator`,
        { transaction }
      );

      // Create the notable_hits table
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS notable_hits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trigger_type ENUM('multi_trend_anomaly', 'composite_surge', 'sustained_spike') NOT NULL,
          composite_score FLOAT(8, 4) NOT NULL,
          company_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
          INDEX idx_company_id (company_id)
        )`,
        { transaction }
      );

      // Create the junction table for notable_hits and top_hits
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS notable_hits_top_hits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          notable_hits_id INT NOT NULL,
          top_hits_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_association (notable_hits_id, top_hits_id),
          FOREIGN KEY (notable_hits_id) REFERENCES notable_hits(id) ON DELETE CASCADE,
          FOREIGN KEY (top_hits_id) REFERENCES top_hits(id) ON DELETE CASCADE,
          INDEX idx_notable_hits_id (notable_hits_id),
          INDEX idx_top_hits_id (top_hits_id)
        )`,
        { transaction }
      );

      await transaction.commit();
      console.log('Migration: Successfully completed z_score, TrendTypeId, standardDeviation migration and created notable_hits tables');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  down: async (sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // Reverse the migration
      
      // Drop junction table
      await sequelize.query(
        `DROP TABLE IF EXISTS notable_hits_top_hits`,
        { transaction }
      );

      // Drop notable_hits table
      await sequelize.query(
        `DROP TABLE IF EXISTS notable_hits`,
        { transaction }
      );

      // Add back the indicator column
      await sequelize.query(
        `ALTER TABLE top_hits ADD COLUMN indicator FLOAT(5, 2) NULL`,
        { transaction }
      );

      // Copy z_score values divided by 2 back to indicator
      await sequelize.query(
        `UPDATE top_hits SET indicator = z_score / 2 WHERE z_score IS NOT NULL`,
        { transaction }
      );

      // Drop foreign key constraint
      try {
        await sequelize.query(
          `ALTER TABLE top_hits DROP FOREIGN KEY fk_top_hits_trend_type`,
          { transaction }
        );
      } catch (e) {
        // Constraint may not exist
      }

      // Drop TrendTypeId column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN IF EXISTS TrendTypeId`,
        { transaction }
      );

      // Drop standardDeviation column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN IF EXISTS standardDeviation`,
        { transaction }
      );

      // Drop z_score column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN IF EXISTS z_score`,
        { transaction }
      );

      await transaction.commit();
      console.log('Migration: Successfully reverted z_score, TrendTypeId, standardDeviation migration and dropped notable_hits tables');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
