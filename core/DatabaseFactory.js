/** Copyright © 2016-2023
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const out = require('./Logs');
let databaseImplementation = null;

class DatabaseFactory {
    /**
     * Initialize the appropriate database implementation
     * Will try PostgreSQL first, then fall back to MockDatabase
     */
    static async initDatabase() {
        try {
            // First try PostgreSQL
            out.log("INFO", "DatabaseFactory", "Attempting to initialize PostgreSQL database");
            const PostgresDatabase = require('./PostgresDatabase');
            
            // Test connection
            await PostgresDatabase.dbInit();
            
            databaseImplementation = PostgresDatabase;
            out.log("INFO", "DatabaseFactory", "Successfully initialized PostgreSQL database");
        } catch (err) {
            out.log("WARN", "DatabaseFactory", `PostgreSQL initialization failed: ${err.message}`);
            out.log("WARN", "DatabaseFactory", "Falling back to MockDatabase");
            
            // Fall back to MockDatabase
            const MockDatabase = require('./MockDatabase');
            await MockDatabase.dbInit();
            
            databaseImplementation = MockDatabase;
            out.log("INFO", "DatabaseFactory", "Successfully initialized MockDatabase as fallback");
        }
        
        return databaseImplementation;
    }
    
    /**
     * Get the initialized database implementation
     */
    static getDatabase() {
        if (!databaseImplementation) {
            throw new Error("Database not initialized. Call initDatabase() first.");
        }
        
        return databaseImplementation;
    }
}

module.exports = DatabaseFactory; 