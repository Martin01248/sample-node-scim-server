/**
 * PostgreSQL Database Connection Test
 * 
 * Run this script to test the PostgreSQL connection without starting the full server
 */

// Load environment variables
require('dotenv').config();

const { Pool } = require('pg');
const out = require('./core/Logs');

// Create a test function
async function testConnection() {
    console.log("Testing PostgreSQL connection...");
    console.log("DATABASE_URL:", process.env.DATABASE_URL || 'not set');
    
    // Create postgres connection with same settings as in PostgresDatabase.js
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scimdb',
        ssl: process.env.NODE_ENV === 'production' 
            ? { 
                rejectUnauthorized: process.env.REJECT_UNAUTHORIZED !== 'false',
                ca: process.env.SSL_CA_CERT || undefined
              } 
            : false
    });
    
    try {
        // Test connection
        console.log("Connecting to PostgreSQL...");
        const client = await pool.connect();
        console.log("Connection successful!");
        
        // Test a query
        console.log("Testing a simple query...");
        const result = await client.query('SELECT NOW() as current_time');
        console.log("Query successful. Current server time:", result.rows[0].current_time);
        
        // Check if our tables exist
        console.log("Checking if SCIM tables exist...");
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('Users', 'Groups', 'GroupMemberships')
        `);
        
        console.log(`Found ${tableCheck.rowCount} SCIM tables:`);
        tableCheck.rows.forEach(row => console.log(`- ${row.table_name}`));
        
        if (tableCheck.rowCount < 3) {
            console.log("Not all SCIM tables exist yet. They will be created when the server starts.");
        }
        
        // Release client
        client.release();
        console.log("Connection test completed successfully!");
        
    } catch (err) {
        console.error("CONNECTION ERROR:");
        console.error(err.message);
        console.error("\nPossible solutions:");
        console.error("1. Check that your DATABASE_URL is correct in .env file");
        console.error("2. If using SSL, you may need to set REJECT_UNAUTHORIZED=false for self-signed certificates");
        console.error("3. Verify your database is running and accessible from your current network");
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the test
testConnection(); 