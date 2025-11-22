/**
 * Test setup and utilities
 */

import { config } from 'dotenv';

// Load environment variables
config();

// Set default test environment variables if not present
process.env.DB_TEST = process.env.DB_TEST || 'sequelize_version_test';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PWD = process.env.DB_PWD || 'postgres';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
