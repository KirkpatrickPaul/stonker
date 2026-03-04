/**
 * Migration: Add z_score and standardDeviation fields to top_hits, add TrendTypeId, and create notable_hits table
 * 
 * This migration:
 * 1. Adds TrendTypeId foreign key column to top_hits
 * 2. Renames indicator column to z_score
 * 3. Adds standardDeviation column to top_hits
 * 4. Multiplies all existing indicator values by 2
 * 5. Creates the new notable_hits table
 */

module.exports = {
  up: async (sequelize) => {
    const transaction = await sequelize.transaction();
    try {
      // Start transaction for data consistency
      
      // First, add the new z_score column with temporary name to preserve data
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

      // Add foreign key constraint for TrendTypeId
      await sequelize.query(
        `ALTER TABLE top_hits ADD CONSTRAINT fk_top_hits_trend_type 
         FOREIGN KEY (TrendTypeId) REFERENCES TrendTypes(id) ON DELETE SET NULL`,
        { transaction }
      );

      // Drop the old indicator column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN indicator`,
        { transaction }
      );

      // Create the notable_hits table
      await sequelize.query(
        `CREATE TABLE notable_hits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trigger_type ENUM('multi_trend_anomaly', 'composite_surge', 'sustained_spike') NOT NULL,
          composite_score FLOAT(8, 4) NOT NULL,
          CompanyId INT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (CompanyId) REFERENCES companies(id) ON DELETE CASCADE,
          INDEX idx_company_id (CompanyId)
        )`,
        { transaction }
      );

      // Create the junction table for notable_hits and top_hits
      await sequelize.query(
        `CREATE TABLE notable_hits_top_hits (
          id INT AUTO_INCREMENT PRIMARY KEY,
          notable_hits_id INT NOT NULL,
          top_hits_id INT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_association (notable_hits_id, top_hits_id),
          FOREIGN KEY (notable_hits_id) REFERENCES notable_hits(id) ON DELETE CASCADE,
          FOREIGN KEY (top_hits_id) REFERENCES top_hits(id) ON DELETE CASCADE,
          INDEX idx_notable_hits_id (notable_hits_id),
          INDEX idx_top_hits_id (top_hits_id)
        )`,
        { transaction }
      );

      await transaction.commit();
      console.log('Migration: Successfully added z_score and TrendTypeId to top_hits, added standardDeviation, and created notable_hits table');
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
      await sequelize.query(
        `ALTER TABLE top_hits DROP FOREIGN KEY fk_top_hits_trend_type`,
        { transaction }
      );

      // Drop TrendTypeId column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN TrendTypeId`,
        { transaction }
      );

      // Drop standardDeviation column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN standardDeviation`,
        { transaction }
      );

      // Drop z_score column
      await sequelize.query(
        `ALTER TABLE top_hits DROP COLUMN z_score`,
        { transaction }
      );

      await transaction.commit();
      console.log('Migration: Successfully reverted z_score, TrendTypeId, standardDeviation migration and dropped notable_hits table');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
