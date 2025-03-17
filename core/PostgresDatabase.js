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

            // Create Users table if not exists
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

            // Create Groups table if not exists
            await client.query(`
                CREATE TABLE IF NOT EXISTS "Groups" (
                    id VARCHAR(255) PRIMARY KEY,
                    "displayName" VARCHAR(255) UNIQUE
                )
            `);

            // Create GroupMemberships table if not exists
            await client.query(`
                CREATE TABLE IF NOT EXISTS "GroupMemberships" (
                    id VARCHAR(255) PRIMARY KEY,
                    "groupId" VARCHAR(255) REFERENCES "Groups"(id) ON DELETE CASCADE,
                    "userId" VARCHAR(255) REFERENCES "Users"(id) ON DELETE CASCADE,
                    UNIQUE("groupId", "userId")
                )
            `);

            // Check if we need to add sample data
            const userCount = await client.query('SELECT COUNT(*) FROM "Users"');
            
            if (parseInt(userCount.rows[0].count) === 0) {
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
            callback(scimCore.createSCIMError(err.message, "500"));
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
            
            // Create a copy of the existing user
            const user = { ...existingUser.rows[0] };
            
            // Apply operations
            for (const operation of operations) {
                const op = operation.op.toLowerCase();
                
                if (op === "replace") {
                    if (operation.path === "active") {
                        user.active = operation.value === "true" || operation.value === true;
                    } else if (operation.path === "userName") {
                        user.userName = operation.value;
                    } else if (operation.path === "givenName") {
                        user.givenName = operation.value;
                    } else if (operation.path === "middleName") {
                        user.middleName = operation.value;
                    } else if (operation.path === "familyName") {
                        user.familyName = operation.value;
                    } else if (operation.path === "email") {
                        user.email = operation.value;
                    }
                }
            }
            
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
            
            callback(scimCore.parseSCIMUser(updatedUser.rows[0], reqUrl));
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.patchUser", err);
            callback(scimCore.createSCIMError(err.message, "500"));
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
            
            // Create a copy of the existing group
            const group = { ...existingGroup.rows[0] };
            
            // Get current members
            const memberships = await this.getGroupMembershipsInternal();
            group.members = this.getUsersForGroup(groupId, memberships);
            
            // Apply operations
            for (const operation of operations) {
                const op = operation.op.toLowerCase();
                
                if (op === "replace" && operation.path === "displayName") {
                    group.displayName = operation.value;
                } else if (op === "add" && operation.path === "members") {
                    // Add new members
                    const newMembers = Array.isArray(operation.value) ? operation.value : [operation.value];
                    
                    for (const member of newMembers) {
                        const userId = member.value;
                        // Verify user exists
                        const userCheck = await client.query('SELECT * FROM "Users" WHERE id = $1', [userId]);
                        
                        if (userCheck.rows.length === 0) {
                            await client.query('ROLLBACK');
                            callback(scimCore.createSCIMError(`User with id ${userId} not found`, "400"));
                            return;
                        }
                        
                        // Check if membership already exists
                        const membershipCheck = await client.query(
                            'SELECT * FROM "GroupMemberships" WHERE "groupId" = $1 AND "userId" = $2', 
                            [groupId, userId]
                        );
                        
                        if (membershipCheck.rows.length === 0) {
                            // Create membership if it doesn't exist
                            await client.query(`
                                INSERT INTO "GroupMemberships" (id, "groupId", "userId")
                                VALUES ($1, $2, $3)
                            `, [uuid.v4(), groupId, userId]);
                        }
                    }
                } else if (op === "remove" && operation.path === "members") {
                    // Remove members
                    const membersToRemove = Array.isArray(operation.value) ? operation.value : [operation.value];
                    
                    for (const member of membersToRemove) {
                        const userId = member.value;
                        // Delete membership
                        await client.query(
                            'DELETE FROM "GroupMemberships" WHERE "groupId" = $1 AND "userId" = $2', 
                            [groupId, userId]
                        );
                    }
                }
            }
            
            // Update group name if changed
            if (group.displayName !== existingGroup.rows[0].displayName) {
                await client.query(`
                    UPDATE "Groups"
                    SET "displayName" = $1
                    WHERE id = $2
                `, [group.displayName, groupId]);
            }
            
            // Commit transaction
            await client.query('COMMIT');
            
            // Get updated group with members
            const updatedGroup = await pool.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
            const updatedMemberships = await this.getGroupMembershipsInternal();
            updatedGroup.rows[0].members = this.getUsersForGroup(groupId, updatedMemberships);
            
            callback(scimCore.parseSCIMGroup(updatedGroup.rows[0], reqUrl));
        } catch (err) {
            await client.query('ROLLBACK');
            out.error("PostgresDatabase.patchGroup", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        } finally {
            client.release();
        }
    }

    static async deleteGroup(groupId, callback) {
        try {
            // Check if group exists
            const existingGroup = await pool.query('SELECT * FROM "Groups" WHERE id = $1', [groupId]);
            
            if (existingGroup.rows.length === 0) {
                callback(scimCore.createSCIMError("Group not found", "404"));
                return;
            }
            
            // Delete group (cascade will handle memberships)
            await pool.query('DELETE FROM "Groups" WHERE id = $1', [groupId]);
            
            callback(null);
        } catch (err) {
            out.error("PostgresDatabase.deleteGroup", err);
            callback(scimCore.createSCIMError(err.message, "500"));
        }
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
}

module.exports = PostgresDatabase; 