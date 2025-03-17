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
     * Initialize PostgreSQL database only - no fallback
     */
    static async initDatabase() {
        // Initialize PostgreSQL database only
        out.log("INFO", "DatabaseFactory", "Initializing PostgreSQL database");
        const PostgresDatabase = require('./PostgresDatabase');
        
        try {
            // Test connection
            await PostgresDatabase.dbInit();
            
            databaseImplementation = PostgresDatabase;
            out.log("INFO", "DatabaseFactory", "Successfully initialized PostgreSQL database");
        } catch (err) {
            out.error("DatabaseFactory", `PostgreSQL initialization failed: ${err.message}`);
            // No fallback - explicitly throw error
            throw new Error(`PostgreSQL connection failed: ${err.message}. Please check your database configuration.`);
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