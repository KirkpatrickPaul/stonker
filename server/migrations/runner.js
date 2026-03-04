#!/usr/bin/env node

/**
 * Migration Runner
 * 
 * Usage:
 *   node server/migrations/runner.js up    - Run pending migrations
 *   node server/migrations/runner.js down  - Rollback the last migration
 */

const path = require('path');
const db = require('../models');

const args = process.argv.slice(2);
const command = args[0];

if (!command || !['up', 'down'].includes(command)) {
  console.error('Please specify up or down');
  console.error('Usage: node server/migrations/runner.js [up|down]');
  process.exit(1);
}

// Get all migration files
const fs = require('fs');
const migrationsDir = __dirname;
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.startsWith('00') && file.endsWith('.js'))
  .sort();

async function runMigration() {
  try {
    if (migrationFiles.length === 0) {
      console.log('No migrations found');
      process.exit(0);
    }

    // Run the latest/first migration
    const migrationFile = migrationFiles[migrationFiles.length - 1];
    const migration = require(path.join(migrationsDir, migrationFile));

    console.log(`Running migration: ${migrationFile} (${command})`);

    if (command === 'up') {
      await migration.up(db.sequelize);
    } else {
      await migration.down(db.sequelize);
    }

    console.log(`✓ Migration ${migrationFile} completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
