/** Copyright © 2016-2018, Okta, Inc.
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

const { Pool } = require('pg');
const uuid = require('uuid');
const scimCore = require('./SCIMCore');
const out = require('./Logs');
const mUser = require('../models/User');
const mGroup = require('../models/Group');
const mGroupMembership = require('../models/GroupMembership');

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/scimdb',
    ssl: process.env.NODE_ENV === 'production' 
        ? { 
            rejectUnauthorized: process.env.REJECT_UNAUTHORIZED !== 'false', // Set to false to accept self-signed certificates
            ca: process.env.SSL_CA_CERT || undefined
          } 
        : false
});

class PostgresDatabase {
    // Initialize database schema
    static async dbInit() {
        const client = await pool.connect();
        try {
            // Begin transaction
            await client.query('BEGIN');

            // Check database permissions first
            let canCreateTables = true;
            try {
                // Try to create a test table to check permissions
                await client.query(`
                    CREATE TABLE IF NOT EXISTS "permission_test" (id VARCHAR(255));
                    DROP TABLE IF EXISTS "permission_test";
                `);
                out.log("INFO", "PostgresDatabase.dbInit", "User has permission to create tables");
            } catch (err) {
                canCreateTables = false;
                out.log("WARN", "PostgresDatabase.dbInit", "User does not have permission to create tables: " + err.message);
                out.log("WARN", "PostgresDatabase.dbInit", "Will attempt to use existing tables if they exist");
            }

            // Check if tables exist regardless of permissions
            const tableCheck = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('Users', 'Groups', 'GroupMemberships')
            `);
            
            const existingTables = tableCheck.rows.map(row => row.table_name);
            out.log("INFO", "PostgresDatabase.dbInit", `Found existing tables: ${existingTables.join(', ') || 'none'}`);
            
            // If we have all required tables, we can proceed
            if (existingTables.length === 3) {
                out.log("INFO", "PostgresDatabase.dbInit", "All required tables exist, skipping table creation");
            } else if (!canCreateTables) {
                // We don't have all tables and can't create them
                throw new Error("Missing required tables and don't have permission to create them. Please contact your database administrator.");
            } else {
                // Create tables if we have permission and tables don't exist
                // Create Users table if not exists
                if (!existingTables.includes('Users')) {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS "Users" (
                            id VARCHAR(255) PRIMARY KEY,
                            active BOOLEAN,
                            "userName" VARCHAR(255) UNIQUE,
                            "givenName" VARCHAR(255),
                            "middleName" VARCHAR(255),
                            "familyName" VARCHAR(255),
                            email VARCHAR(255)
                        )
                    `);
                    out.log("INFO", "PostgresDatabase.dbInit", "Created Users table");
                }

                // Create Groups table if not exists
                if (!existingTables.includes('Groups')) {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS "Groups" (
                            id VARCHAR(255) PRIMARY KEY,
                            "displayName" VARCHAR(255) UNIQUE
                        )
                    `);
                    out.log("INFO", "PostgresDatabase.dbInit", "Created Groups table");
                }

                // Create GroupMemberships table if not exists
                if (!existingTables.includes('GroupMemberships')) {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS "GroupMemberships" (
                            id VARCHAR(255) PRIMARY KEY,
                            "groupId" VARCHAR(255) REFERENCES "Groups"(id) ON DELETE CASCADE,
                            "userId" VARCHAR(255) REFERENCES "Users"(id) ON DELETE CASCADE,
                            UNIQUE("groupId", "userId")
                        )
                    `);
                    out.log("INFO", "PostgresDatabase.dbInit", "Created GroupMemberships table");
                }
            }

            // Check if we need to add sample data
            const userCount = await client.query('SELECT COUNT(*) FROM "Users"');
            
            if (parseInt(userCount.rows[0].count) === 0) {
                out.log("INFO", "PostgresDatabase.dbInit", "No users found, adding sample data");
                
                // Insert sample data
                const user1Id = uuid.v4();
                const user2Id = uuid.v4();
                const group1Id = uuid.v4();
                const group2Id = uuid.v4();

                // Insert sample users
                await client.query(`
                    INSERT INTO "Users" (id, active, "userName", "givenName", "middleName", "familyName", email)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [user1Id, true, 'john.doe@example.com', 'John', '', 'Doe', 'john.doe@example.com']);

                await client.query(`
                    INSERT INTO "Users" (id, active, "userName", "givenName", "middleName", "familyName", email)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [user2Id, true, 'jane.smith@example.com', 'Jane', '', 'Smith', 'jane.smith@example.com']);

                // Insert sample groups
                await client.query(`
                    INSERT INTO "Groups" (id, "displayName")
                    VALUES ($1, $2)
                `, [group1Id, 'Administrators']);

                await client.query(`
                    INSERT INTO "Groups" (id, "displayName")
                    VALUES ($1, $2)
                `, [group2Id, 'Users']);

                // Insert sample memberships
                await client.query(`
                    INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                    VALUES ($1, $2, $3)
                `, [uuid.v4(), group1Id, user1Id]);

                await client.query(`
                    INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                    VALUES ($1, $2, $3)
                `, [uuid.v4(), group2Id, user1Id]);

                await client.query(`
                    INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                    VALUES ($1, $2, $3)
                `, [uuid.v4(), group2Id, user2Id]);

                out.log("INFO", "PostgresDatabase.dbInit", "PostgreSQL database initialized with sample data");
            } else {
                out.log("INFO", "PostgresDatabase.dbInit", `Database contains ${userCount.rows[0].count} users, skipping sample data`);
            }

            // Commit transaction
            await client.query('COMMIT');
            out.log("INFO", "PostgresDatabase.dbInit", "PostgreSQL database schema initialized");
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.dbInit", err);
            throw err;
        } finally {
            client.release();
        }
    }

    // Users CRUD operations
    static async listUsers(startIndex, count, reqUrl, callback) {
        // Ensure callback is a function
        if (!this._ensureCallback(callback, "listUsers")) return;
        
        try {
            const result = await pool.query('SELECT * FROM "Users" ORDER BY "userName" LIMIT $1 OFFSET $2', [count, startIndex - 1]);
            
            if (result.rows.length === 0) {
                callback(scimCore.createSCIMError("No users found", "404"));
                return;
            }

            // Get group memberships for all users
            const memberships = await this.getGroupMembershipsInternal();
            
            // Add groups to each user
            for (let i = 0; i < result.rows.length; i++) {
                result.rows[i].groups = this.getGroupsForUser(result.rows[i].id, memberships);
            }
            
            callback(scimCore.createSCIMUserList(result.rows, startIndex, result.rows.length, reqUrl));
        } catch (err) {
            out.error("PostgresDatabase.listUsers", err);
            if (typeof callback === 'function') {
                callback(scimCore.createSCIMError(err.message, "500"));
            }
        }
    }

    static async getFilteredUsers(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        // Create a safe callback wrapper
        const safeCallback = this._safeCallback(callback, "getFilteredUsers");
        
        try {
            let query;
            let queryParams;
            
            // Remove quotes if present in the filter value
            if (filterValue.startsWith('"') && filterValue.endsWith('"')) {
                filterValue = filterValue.substring(1, filterValue.length - 1);
            }
            
            // Map filter attribute to the database column
            let dbColumn;
            switch (filterAttribute) {
                case 'userName':
                    dbColumn = '"userName"';
                    break;
                case 'id':
                    dbColumn = 'id';
                    break;
                case 'email':
                    dbColumn = 'email';
                    break;
                case 'givenName':
                    dbColumn = '"givenName"';
                    break;
                case 'familyName':
                    dbColumn = '"familyName"';
                    break;
                default:
                    safeCallback(scimCore.createSCIMError(`Unsupported filter attribute: ${filterAttribute}`, "400"));
                    return;
            }
            
            // Construct the query with proper parameterization to prevent SQL injection
            query = `SELECT * FROM "Users" WHERE ${dbColumn} = $1 ORDER BY "userName" LIMIT $2 OFFSET $3`;
            queryParams = [filterValue, count, startIndex - 1];
            
            out.log("DEBUG", "PostgresDatabase.getFilteredUsers", `Query: ${query}, Params: ${JSON.stringify(queryParams)}`);
            
            const result = await pool.query(query, queryParams);
            
            if (result.rows.length === 0) {
                safeCallback(scimCore.createSCIMError("No users found matching filter", "404"));
                return;
            }
            
            // Get group memberships for all users
            const memberships = await this.getGroupMembershipsInternal();
            
            // Add groups to each user
            for (let i = 0; i < result.rows.length; i++) {
                result.rows[i].groups = this.getGroupsForUser(result.rows[i].id, memberships);
            }
            
            safeCallback(scimCore.createSCIMUserList(result.rows, startIndex, result.rows.length, reqUrl));
        } catch (err) {
            out.error("PostgresDatabase.getFilteredUsers", err);
            safeCallback(scimCore.createSCIMError(err.message, "500"));
        }
    }

    static async getUser(userId, reqUrl, callback) {
        try {
            const result = await pool.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
            
            if (result.rows.length === 0) {
                callback(scimCore.createSCIMError("User not found", "404"));
                return;
            }

            // Get group memberships
            const memberships = await this.getGroupMembershipsInternal();
            result.rows[0].groups = this.getGroupsForUser(userId, memberships);
            
            callback(scimCore.parseSCIMUser(result.rows[0], reqUrl));
        } catch (err) {
            out.error("PostgresDatabase.getUser", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        }
    }

    static async createUser(userModel, reqUrl, callback) {
        const client = await pool.connect();
        try {
            // Begin transaction
            await client.query('BEGIN');
            
            // Check if user exists
            const existingUser = await client.query('SELECT * FROM "Users" WHERE "userName" = $1', [userModel.userName]);
            
            if (existingUser.rows.length > 0) {
                callback(scimCore.createSCIMError("User Already Exists", "409"));
                await client.query('ROLLBACK');
                return;
            }
            
            // Generate user ID
            const userId = uuid.v4();
            
            // Insert user
            await client.query(`
                INSERT INTO "Users" (id, active, "userName", "givenName", "middleName", "familyName", email)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId, 
                userModel.active || true, 
                userModel.userName, 
                userModel.givenName || '', 
                userModel.middleName || '', 
                userModel.familyName || '', 
                userModel.email || ''
            ]);
            
            // Add group memberships if specified
            if (userModel.groups && userModel.groups.length > 0) {
                for (const group of userModel.groups) {
                    const groupId = group.value;
                    // Verify group exists
                    const groupCheck = await client.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
                    
                    if (groupCheck.rows.length === 0) {
                        await client.query('ROLLBACK');
                        callback(scimCore.createSCIMError(`Group with id ${groupId} not found`, "400"));
                        return;
                    }
                    
                    // Create membership
                    await client.query(`
                        INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                        VALUES ($1, $2, $3)
                    `, [uuid.v4(), groupId, userId]);
                }
            }
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Get updated user with groups
            const newUser = {
                id: userId,
                active: userModel.active || true,
                userName: userModel.userName,
                givenName: userModel.givenName || '',
                middleName: userModel.middleName || '',
                familyName: userModel.familyName || '',
                email: userModel.email || '',
                groups: userModel.groups || []
            };
            
            callback(scimCore.parseSCIMUser(newUser, reqUrl));
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.createUser", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        } finally {
            client.release();
        }
    }

    static async updateUser(userModel, userId, reqUrl, callback) {
        const client = await pool.connect();
        try {
            // Begin transaction
            await client.query('BEGIN');
            
            // Check if user exists
            const existingUser = await client.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
            
            if (existingUser.rows.length === 0) {
                callback(scimCore.createSCIMError("User not found", "404"));
                await client.query('ROLLBACK');
                return;
            }
            
            // Update user
            await client.query(`
                UPDATE "Users"
                SET "userName" = $1, "givenName" = $2, "middleName" = $3, "familyName" = $4, email = $5
                WHERE id = $6
            `, [
                userModel.userName || existingUser.rows[0].userName,
                userModel.givenName || existingUser.rows[0].givenName,
                userModel.middleName || existingUser.rows[0].middleName,
                userModel.familyName || existingUser.rows[0].familyName,
                userModel.email || existingUser.rows[0].email,
                userId
            ]);
            
            // Update group memberships if specified
            if (userModel.groups) {
                // Remove existing memberships
                await client.query('DELETE FROM "GroupMemberships" WHERE "userId" = $1', [userId]);
                
                // Add new memberships
                for (const group of userModel.groups) {
                    const groupId = group.value;
                    // Verify group exists
                    const groupCheck = await client.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
                    
                    if (groupCheck.rows.length === 0) {
                        await client.query('ROLLBACK');
                        callback(scimCore.createSCIMError(`Group with id ${groupId} not found`, "400"));
                        return;
                    }
                    
                    // Create membership
                    await client.query(`
                        INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                        VALUES ($1, $2, $3)
                    `, [uuid.v4(), groupId, userId]);
                }
            }
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Get updated user with groups
            const updatedUser = await pool.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
            const memberships = await this.getGroupMembershipsInternal();
            updatedUser.rows[0].groups = this.getGroupsForUser(userId, memberships);
            
            callback(scimCore.parseSCIMUser(updatedUser.rows[0], reqUrl));
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.updateUser", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        } finally {
            client.release();
        }
    }

    static async patchUser(operations, userId, reqUrl, callback) {
        // Create a safe callback wrapper
        const safeCallback = this._safeCallback(callback, "patchUser");
        
        const client = await pool.connect();
        try {
            // Begin transaction
            await client.query('BEGIN');
            
            // Check if user exists
            const existingUser = await client.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
            
            if (existingUser.rows.length === 0) {
                safeCallback(scimCore.createSCIMError("User not found", "404"));
                await client.query('ROLLBACK');
                return;
            }
            
            // Create a copy of the existing user
            const user = { ...existingUser.rows[0] };
            
            out.log("DEBUG", "PostgresDatabase.patchUser", `Received operations: ${JSON.stringify(operations)}`);
            
            // Handle both single operation and array of operations
            const operationsArray = Array.isArray(operations) ? operations : [operations];
            
            // Apply operations
            for (const operation of operationsArray) {
                // Handle Microsoft Entra ID format which might send Operations inside an object
                const op = operation.op ? operation.op.toLowerCase() : 
                          (operation.Operations && operation.Operations[0] && operation.Operations[0].op) 
                           ? operation.Operations[0].op.toLowerCase() : '';
                
                out.log("DEBUG", "PostgresDatabase.patchUser", `Processing operation: ${op}`);
                
                if (op === "replace") {
                    // Handle direct object with operations inside
                    if (operation.Operations && operation.Operations.length > 0) {
                        // Microsoft Entra ID format with nested Operations array
                        for (const nestedOp of operation.Operations) {
                            if (nestedOp.op && nestedOp.op.toLowerCase() === "replace") {
                                if (nestedOp.value && typeof nestedOp.value === 'object') {
                                    // Handle value as object (eg: {active: true})
                                    Object.keys(nestedOp.value).forEach(key => {
                                        const value = nestedOp.value[key];
                                        if (key === "active") {
                                            user.active = value === "true" || value === true;
                                        } else if (key === "userName" || key === "username") {
                                            user.userName = value;
                                        } else if (key === "givenName" || key === "givenname") {
                                            user.givenName = value;
                                        } else if (key === "middleName" || key === "middlename") {
                                            user.middleName = value;
                                        } else if (key === "familyName" || key === "familyname") {
                                            user.familyName = value;
                                        } else if (key === "email") {
                                            user.email = value;
                                        }
                                    });
                                }
                            }
                        }
                    } else if (operation.value && typeof operation.value === 'object') {
                        // Handle case where value is an object with attributes
                        Object.keys(operation.value).forEach(key => {
                            const value = operation.value[key];
                            if (key === "active") {
                                user.active = value === "true" || value === true;
                            } else if (key === "userName" || key === "username") {
                                user.userName = value;
                            } else if (key === "givenName" || key === "givenname") {
                                user.givenName = value;
                            } else if (key === "middleName" || key === "middlename") {
                                user.middleName = value;
                            } else if (key === "familyName" || key === "familyname") {
                                user.familyName = value;
                            } else if (key === "email") {
                                user.email = value;
                            }
                        });
                    } else if (operation.path) {
                        // Handle path-specific update
                        const path = operation.path.toLowerCase();
                        if (path === "active") {
                            user.active = operation.value === "true" || operation.value === true;
                        } else if (path === "username") {
                            user.userName = operation.value;
                        } else if (path === "givenname") {
                            user.givenName = operation.value;
                        } else if (path === "middlename") {
                            user.middleName = operation.value;
                        } else if (path === "familyname") {
                            user.familyName = operation.value;
                        } else if (path === "email") {
                            user.email = operation.value;
                        }
                    }
                }
            }
            
            out.log("DEBUG", "PostgresDatabase.patchUser", `User after patch: ${JSON.stringify(user)}`);
            
            // Update user
            await client.query(`
                UPDATE "Users"
                SET active = $1, "userName" = $2, "givenName" = $3, "middleName" = $4, "familyName" = $5, email = $6
                WHERE id = $7
            `, [user.active, user.userName, user.givenName, user.middleName, user.familyName, user.email, userId]);
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Get updated user with groups
            const updatedUser = await pool.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
            const memberships = await this.getGroupMembershipsInternal();
            updatedUser.rows[0].groups = this.getGroupsForUser(userId, memberships);
            
            safeCallback(scimCore.parseSCIMUser(updatedUser.rows[0], reqUrl));
        } catch (err) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                out.error("PostgresDatabase.patchUser", "Error during rollback: " + rollbackErr.message);
            }
            
            out.error("PostgresDatabase.patchUser", err);
            safeCallback(scimCore.createSCIMError(err.message, "500"));
        } finally {
            client.release();
        }
    }

    static async deleteUser(userId, callback) {
        try {
            // Check if user exists
            const existingUser = await pool.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
            
            if (existingUser.rows.length === 0) {
                callback(scimCore.createSCIMError("User not found", "404"));
                return;
            }
            
            // Delete user (cascade will handle memberships)
            await pool.query('DELETE FROM "Users" WHERE id = $1', [userId]);
            
            callback(null);
        } catch (err) {
            out.error("PostgresDatabase.deleteUser", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        }
    }

    // Groups CRUD operations
    static async listGroups(startIndex, count, reqUrl, callback) {
        try {
            const result = await pool.query('SELECT * FROM "Groups" ORDER BY "displayName" LIMIT $1 OFFSET $2', [count, startIndex - 1]);
            
            if (result.rows.length === 0) {
                callback(scimCore.createSCIMError("No groups found", "404"));
                return;
            }

            // Get group memberships for all groups
            const memberships = await this.getGroupMembershipsInternal();
            
            // Add members to each group
            for (let i = 0; i < result.rows.length; i++) {
                result.rows[i].members = this.getUsersForGroup(result.rows[i].id, memberships);
            }
            
            callback(scimCore.createSCIMGroupList(result.rows, startIndex, result.rows.length, reqUrl));
        } catch (err) {
            out.error("PostgresDatabase.listGroups", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        }
    }

    static async getFilteredGroups(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        try {
            let query;
            let queryParams;
            
            // Remove quotes if present in the filter value
            if (filterValue.startsWith('"') && filterValue.endsWith('"')) {
                filterValue = filterValue.substring(1, filterValue.length - 1);
            }
            
            // Map filter attribute to the database column
            let dbColumn;
            switch (filterAttribute) {
                case 'displayName':
                    dbColumn = '"displayName"';
                    break;
                case 'id':
                    dbColumn = 'id';
                    break;
                default:
                    callback(scimCore.createSCIMError(`Unsupported filter attribute: ${filterAttribute}`, "400"));
                    return;
            }
            
            // Construct the query with proper parameterization to prevent SQL injection
            query = `SELECT * FROM "Groups" WHERE ${dbColumn} = $1 ORDER BY "displayName" LIMIT $2 OFFSET $3`;
            queryParams = [filterValue, count, startIndex - 1];
            
            out.log("DEBUG", "PostgresDatabase.getFilteredGroups", `Query: ${query}, Params: ${JSON.stringify(queryParams)}`);
            
            const result = await pool.query(query, queryParams);
            
            if (result.rows.length === 0) {
                callback(scimCore.createSCIMError("No groups found matching filter", "404"));
                return;
            }
            
            // Get group memberships for all groups
            const memberships = await this.getGroupMembershipsInternal();
            
            // Add members to each group
            for (let i = 0; i < result.rows.length; i++) {
                result.rows[i].members = this.getUsersForGroup(result.rows[i].id, memberships);
            }
            
            callback(scimCore.createSCIMGroupList(result.rows, startIndex, result.rows.length, reqUrl));
        } catch (err) {
            out.error("PostgresDatabase.getFilteredGroups", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        }
    }

    static async getGroup(groupId, reqUrl, callback) {
        try {
            const result = await pool.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
            
            if (result.rows.length === 0) {
                callback(scimCore.createSCIMError("Group not found", "404"));
                return;
            }

            // Get group memberships
            const memberships = await this.getGroupMembershipsInternal();
            result.rows[0].members = this.getUsersForGroup(groupId, memberships);
            
            callback(scimCore.parseSCIMGroup(result.rows[0], reqUrl));
        } catch (err) {
            out.error("PostgresDatabase.getGroup", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        }
    }

    static async createGroup(groupModel, reqUrl, callback) {
        const client = await pool.connect();
        try {
            // Begin transaction
            await client.query('BEGIN');
            
            // Check if group exists
            const existingGroup = await client.query('SELECT * FROM "Groups" WHERE "displayName" = $1', [groupModel.displayName]);
            
            if (existingGroup.rows.length > 0) {
                callback(scimCore.createSCIMError("Group Already Exists", "409"));
                await client.query('ROLLBACK');
                return;
            }
            
            // Generate group ID
            const groupId = uuid.v4();
            
            // Insert group
            await client.query(`
                INSERT INTO "Groups" (id, "displayName")
                VALUES ($1, $2)
            `, [groupId, groupModel.displayName]);
            
            // Add members if specified
            if (groupModel.members && groupModel.members.length > 0) {
                for (const member of groupModel.members) {
                    const userId = member.value;
                    // Verify user exists
                    const userCheck = await client.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
                    
                    if (userCheck.rows.length === 0) {
                        await client.query('ROLLBACK');
                        callback(scimCore.createSCIMError(`User with id ${userId} not found`, "400"));
                        return;
                    }
                    
                    // Create membership
                    await client.query(`
                        INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                        VALUES ($1, $2, $3)
                    `, [uuid.v4(), groupId, userId]);
                }
            }
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Get updated group with members
            const newGroup = {
                id: groupId,
                displayName: groupModel.displayName,
                members: groupModel.members || []
            };
            
            callback(scimCore.parseSCIMGroup(newGroup, reqUrl));
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.createGroup", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        } finally {
            client.release();
        }
    }

    static async updateGroup(groupModel, groupId, reqUrl, callback) {
        const client = await pool.connect();
        try {
            // Begin transaction
            await client.query('BEGIN');
            
            // Check if group exists
            const existingGroup = await client.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
            
            if (existingGroup.rows.length === 0) {
                callback(scimCore.createSCIMError("Group not found", "404"));
                await client.query('ROLLBACK');
                return;
            }
            
            // Update group
            await client.query(`
                UPDATE "Groups"
                SET "displayName" = $1
                WHERE id = $2
            `, [groupModel.displayName || existingGroup.rows[0].displayName, groupId]);
            
            // Update members if specified
            if (groupModel.members !== undefined) {
                // Remove existing memberships
                await client.query('DELETE FROM "GroupMemberships" WHERE "groupId" = $1', [groupId]);
                
                // Add new memberships
                if (groupModel.members && groupModel.members.length > 0) {
                    for (const member of groupModel.members) {
                        const userId = member.value;
                        // Verify user exists
                        const userCheck = await client.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
                        
                        if (userCheck.rows.length === 0) {
                            await client.query('ROLLBACK');
                            callback(scimCore.createSCIMError(`User with id ${userId} not found`, "400"));
                            return;
                        }
                        
                        // Create membership
                        await client.query(`
                            INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                            VALUES ($1, $2, $3)
                        `, [uuid.v4(), groupId, userId]);
                    }
                }
            }
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Get updated group with members
            const updatedGroup = await pool.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
            const memberships = await this.getGroupMembershipsInternal();
            updatedGroup.rows[0].members = this.getUsersForGroup(groupId, memberships);
            
            callback(scimCore.parseSCIMGroup(updatedGroup.rows[0], reqUrl));
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.updateGroup", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        } finally {
            client.release();
        }
    }

    static async patchGroup(operations, groupId, reqUrl, callback) {
        const safeCallback = this._safeCallback(callback);
        
        out.log("DEBUG", "PostgresDatabase.patchGroup", `Patching group ${groupId} with operations: ${JSON.stringify(operations)}`);
        
        // First check if the group exists
        pool.query('SELECT * FROM "Groups" WHERE id = $1', [groupId], (err, result) => {
            if (err) {
                out.log("ERROR", "PostgresDatabase.patchGroup", `Error checking group existence: ${err.message}`);
                return safeCallback(scimCore.createSCIMError("Database error", "500", err.message));
            }
            
            if (result.rows.length === 0) {
                out.log("WARN", "PostgresDatabase.patchGroup", `Group ${groupId} not found`);
                return safeCallback(scimCore.createSCIMError("Group not found", "404"));
            }
            
            const group = result.rows[0];
            out.log("DEBUG", "PostgresDatabase.patchGroup", `Found group: ${JSON.stringify(group)}`);
            
            let operationsArray = [];
            
            // Handle different operation formats (Operations vs operations)
            if (operations.Operations && Array.isArray(operations.Operations)) {
                operationsArray = operations.Operations;
            } else if (operations.operations && Array.isArray(operations.operations)) {
                operationsArray = operations.operations;
            } else if (operations.op) {
                // Single operation
                operationsArray = [operations];
            } else {
                out.log("ERROR", "PostgresDatabase.patchGroup", "Invalid operations format");
                return safeCallback(scimCore.createSCIMError("Invalid operations format", "400"));
            }
            
            out.log("DEBUG", "PostgresDatabase.patchGroup", `Processing operations: ${JSON.stringify(operationsArray)}`);
            
            // Begin database transaction
            pool.query('BEGIN', (err) => {
                if (err) {
                    out.log("ERROR", "PostgresDatabase.patchGroup", `Error beginning transaction: ${err.message}`);
                    return safeCallback(scimCore.createSCIMError("Database error", "500", err.message));
                }
                
                // Process each operation
                let updatedGroup = { ...group };
                let queries = [];
                
                try {
                    for (const operation of operationsArray) {
                        const op = operation.op ? operation.op.toLowerCase() : '';
                        
                        if (op === 'replace' || op === 'add') {
                            if (operation.value) {
                                // Direct value update (e.g., { "displayName": "New Name" })
                                if (typeof operation.value === 'object') {
                                    Object.keys(operation.value).forEach(key => {
                                        // Map SCIM attributes to database columns
                                        const dbColumn = PostgresDatabase._mapAttributeToColumn(key);
                                        if (dbColumn) {
                                            updatedGroup[dbColumn] = operation.value[key];
                                            queries.push({
                                                text: `UPDATE "Groups" SET ${dbColumn} = $1 WHERE id = $2`,
                                                values: [operation.value[key], groupId]
                                            });
                                        }
                                    });
                                }
                            } else if (operation.path && operation.value !== undefined) {
                                // Path/value format (e.g., { "path": "displayName", "value": "New Name" })
                                const path = operation.path.replace(/^members/, 'members');
                                
                                if (path === 'displayName') {
                                    updatedGroup.displayName = operation.value;
                                    queries.push({
                                        text: 'UPDATE "Groups" SET "displayName" = $1 WHERE id = $2',
                                        values: [operation.value, groupId]
                                    });
                                } else if (path === 'members') {
                                    // Handle membership updates
                                    if (Array.isArray(operation.value)) {
                                        // Add new members
                                        for (const member of operation.value) {
                                            if (member.value) {
                                                queries.push({
                                                    text: 'INSERT INTO "GroupMemberships" (id, "groupId", "userId") VALUES ($1, $2, $3) ON CONFLICT ("groupId", "userId") DO NOTHING',
                                                    values: [uuid.v4(), groupId, member.value]
                                                });
                                            }
                                        }
                                    } else if (typeof operation.value === 'string') {
                                        // Add single member by ID
                                        queries.push({
                                            text: 'INSERT INTO "GroupMemberships" (id, "groupId", "userId") VALUES ($1, $2, $3) ON CONFLICT ("groupId", "userId") DO NOTHING',
                                            values: [uuid.v4(), groupId, operation.value]
                                        });
                                    }
                                }
                            }
                        } else if (op === 'remove') {
                            if (operation.path) {
                                const path = operation.path.replace(/^members/, 'members');
                                
                                if (path.startsWith('members[value eq ')) {
                                    // Extract user ID from path like "members[value eq \"123\"]"
                                    const match = path.match(/members\[value eq ["'](.+)["']\]/);
                                    if (match && match[1]) {
                                        const userId = match[1];
                                        queries.push({
                                            text: 'DELETE FROM "GroupMemberships" WHERE "groupId" = $1 AND "userId" = $2',
                                            values: [groupId, userId]
                                        });
                                    }
                                } else if (path === 'members') {
                                    // Remove all members
                                    queries.push({
                                        text: 'DELETE FROM "GroupMemberships" WHERE "groupId" = $1',
                                        values: [groupId]
                                    });
                                }
                            }
                        }
                    }
                    
                    // Execute all queries in sequence
                    const executeQueries = (index) => {
                        if (index >= queries.length) {
                            // All queries completed, commit the transaction
                            pool.query('COMMIT', (err) => {
                                if (err) {
                                    out.log("ERROR", "PostgresDatabase.patchGroup", `Error committing transaction: ${err.message}`);
                                    pool.query('ROLLBACK', () => {
                                        return safeCallback(scimCore.createSCIMError("Database error", "500", err.message));
                                    });
                                    return;
                                }
                                
                                // Get the updated group with memberships
                                PostgresDatabase.getGroup(groupId, reqUrl, (result) => {
                                    out.log("INFO", "PostgresDatabase.patchGroup", `Group ${groupId} updated successfully`);
                                    safeCallback(result);
                                });
                            });
                            return;
                        }
                        
                        // Execute the current query
                        const query = queries[index];
                        out.log("DEBUG", "PostgresDatabase.patchGroup", `Executing query: ${query.text} with values: ${JSON.stringify(query.values)}`);
                        
                        pool.query(query.text, query.values, (err) => {
                            if (err) {
                                out.log("ERROR", "PostgresDatabase.patchGroup", `Error executing query: ${err.message}`);
                                pool.query('ROLLBACK', () => {
                                    return safeCallback(scimCore.createSCIMError("Database error", "500", err.message));
                                });
                                return;
                            }
                            
                            // Move to the next query
                            executeQueries(index + 1);
                        });
                    };
                    
                    // Start executing queries
                    if (queries.length > 0) {
                        executeQueries(0);
                    } else {
                        // No changes needed, just commit and return the current group
                        pool.query('COMMIT', (err) => {
                            if (err) {
                                out.log("ERROR", "PostgresDatabase.patchGroup", `Error committing transaction: ${err.message}`);
                                pool.query('ROLLBACK', () => {
                                    return safeCallback(scimCore.createSCIMError("Database error", "500", err.message));
                                });
                                return;
                            }
                            
                            PostgresDatabase.getGroup(groupId, reqUrl, (result) => {
                                safeCallback(result);
                            });
                        });
                    }
                } catch (error) {
                    out.log("ERROR", "PostgresDatabase.patchGroup", `Error processing operations: ${error.message}`);
                    pool.query('ROLLBACK', () => {
                        return safeCallback(scimCore.createSCIMError("Error processing operations", "500", error.message));
                    });
                }
            });
        });
    }
    
    // Helper method to map SCIM attributes to database columns
    static _mapAttributeToColumn(attribute) {
        const mapping = {
            'displayName': 'display_name',
            'externalId': 'external_id'
        };
        
        return mapping[attribute] || attribute.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
    }

    // Helper methods
    static async getGroupMembershipsInternal() {
        try {
            const query = `
                SELECT m.id, m."groupId", m."userId", g."displayName" as "groupDisplay", 
                    u."givenName", u."familyName"
                FROM "GroupMemberships" m
                LEFT JOIN "Groups" g ON m."groupId" = g.id
                LEFT JOIN "Users" u ON m."userId" = u.id
            `;
            
            const result = await pool.query(query);
            
            if (result.rows.length === 0) {
                return [];
            }
            
            const memberships = [];
            
            for (const row of result.rows) {
                const userDisplay = `${row.givenName} ${row.familyName}`.trim();
                memberships.push(mGroupMembership.createMembership(
                    row.groupId, 
                    row.userId,
                    row.groupDisplay, 
                    userDisplay
                ));
            }
            
            return memberships;
        } catch (err) {
            out.error("PostgresDatabase.getGroupMembershipsInternal", err);
            return [];
        }
    }

    static async getGroupMemberships(callback) {
        try {
            const memberships = await this.getGroupMembershipsInternal();
            callback(null, memberships);
        } catch (err) {
            out.error("PostgresDatabase.getGroupMemberships", err);
            callback(err, null);
        }
    }

    static getGroupsForUser(userId, memberships) {
        const userGroups = [];
        
        for (const membership of memberships) {
            if (membership.userId === String(userId)) {
                userGroups.push(mUser.createGroup(membership.groupId, membership.groupDisplay));
            }
        }
        
        return userGroups;
    }

    static getUsersForGroup(groupId, memberships) {
        const groupUsers = [];
        
        for (const membership of memberships) {
            if (membership.groupId === String(groupId)) {
                groupUsers.push(mGroup.createUser(membership.userId, membership.userDisplay));
            }
        }
        
        return groupUsers;
    }

    // Helper function to validate callbacks
    static _ensureCallback(callbackFn, methodName) {
        if (typeof callbackFn !== 'function') {
            out.error(`PostgresDatabase.${methodName}`, "Callback is not a function");
            return false;
        }
        return true;
    }

    // Helper function to create a safe callback wrapper
    static _safeCallback(callback, methodName) {
        return (...args) => {
            if (typeof callback === 'function') {
                try {
                    callback(...args);
                } catch (err) {
                    out.error(`PostgresDatabase.${methodName}.callback`, err);
                }
            } else {
                out.error(`PostgresDatabase.${methodName}`, "Callback is not a function");
            }
        };
    }
}

module.exports = PostgresDatabase; 