/** 
 * Mock Database implementation for SCIM server
 * Uses in-memory data structures instead of connecting to a real database
 */

const uuid = require('uuid');
const scimCore = require('./SCIMCore');
const out = require('./Logs');

class MockDatabase {
    constructor() {
        this.users = [];
        this.groups = [];
        this.memberships = [];
        this.initialized = false;
    }

    // Initialize with sample data
    static dbInit() {
        if (this.initialized) {
            return;
        }

        // Clear existing data
        this.users = [];
        this.groups = [];
        this.memberships = [];

        // Create sample users
        const user1Id = uuid.v4();
        const user2Id = uuid.v4();
        
        this.users.push({
            id: user1Id,
            active: true,
            userName: 'john.doe@example.com',
            givenName: 'John',
            middleName: '',
            familyName: 'Doe',
            email: 'john.doe@example.com'
        });
        
        this.users.push({
            id: user2Id,
            active: true,
            userName: 'jane.smith@example.com',
            givenName: 'Jane',
            middleName: '',
            familyName: 'Smith',
            email: 'jane.smith@example.com'
        });

        // Create sample groups
        const group1Id = uuid.v4();
        const group2Id = uuid.v4();
        
        this.groups.push({
            id: group1Id,
            displayName: 'Administrators'
        });
        
        this.groups.push({
            id: group2Id,
            displayName: 'Users'
        });

        // Create sample memberships
        this.memberships.push({
            id: uuid.v4(),
            groupId: group1Id,
            userId: user1Id
        });
        
        this.memberships.push({
            id: uuid.v4(),
            groupId: group2Id,
            userId: user1Id
        });
        
        this.memberships.push({
            id: uuid.v4(),
            groupId: group2Id,
            userId: user2Id
        });

        this.initialized = true;
        out.log("INFO", "MockDatabase.dbInit", "Mock database initialized with sample data");
    }

    // User CRUD operations
    static async getFilteredUsers(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        this.dbInit();
        
        const filteredUsers = this.users.filter(user => 
            String(user[filterAttribute]) === String(filterValue)
        );
        
        if (filteredUsers.length === 0) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }

        const actualCount = Math.min(filteredUsers.length, count || filteredUsers.length);
        const usersToReturn = filteredUsers.slice(startIndex - 1, startIndex - 1 + actualCount);
        
        // Add groups to each user
        for (let i = 0; i < usersToReturn.length; i++) {
            usersToReturn[i].groups = this.getGroupsForUser(usersToReturn[i].id);
        }

        callback(scimCore.createSCIMUserList(usersToReturn, startIndex, actualCount, reqUrl));
    }

    static async getAllUsers(startIndex, count, reqUrl, callback) {
        this.dbInit();
        
        if (!startIndex) startIndex = 1;
        if (!count) count = this.users.length;
        
        const actualCount = Math.min(this.users.length, count);
        const usersToReturn = this.users.slice(startIndex - 1, startIndex - 1 + actualCount);
        
        // Add groups to each user
        for (let i = 0; i < usersToReturn.length; i++) {
            usersToReturn[i].groups = this.getGroupsForUser(usersToReturn[i].id);
        }

        callback(scimCore.createSCIMUserList(usersToReturn, startIndex, actualCount, reqUrl));
    }

    static async getUser(userId, reqUrl, callback) {
        this.dbInit();
        
        const user = this.users.find(u => u.id === String(userId));
        
        if (!user) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        user.groups = this.getGroupsForUser(user.id);
        callback(scimCore.parseSCIMUser(user, reqUrl));
    }

    static async createUser(userModel, reqUrl, callback) {
        this.dbInit();
        
        // Check if user already exists
        const existingUser = this.users.find(u => u.userName === userModel.userName);
        if (existingUser) {
            callback(scimCore.createSCIMError("User Already Exists", "409"));
            return;
        }
        
        const userId = uuid.v4();
        const newUser = {
            id: userId,
            active: userModel.active,
            userName: userModel.userName,
            givenName: userModel.givenName,
            middleName: userModel.middleName,
            familyName: userModel.familyName,
            email: userModel.email
        };
        
        this.users.push(newUser);
        
        // Add group memberships if specified
        if (userModel.groups && userModel.groups.length > 0) {
            out.log("DEBUG", "MockDatabase.createUser", "Processing groups: " + JSON.stringify(userModel.groups));
            
            for (const group of userModel.groups) {
                out.log("DEBUG", "MockDatabase.createUser", "Processing group: " + JSON.stringify(group));
                
                // Try to find the group by value (id) first
                let groupId = group.value;
                let targetGroup = this.groups.find(g => g.id === groupId);
                
                // If not found by ID, try by displayName (Microsoft Entra may send displayName)
                if (!targetGroup && group.display) {
                    targetGroup = this.groups.find(g => g.displayName === group.display);
                    if (targetGroup) {
                        groupId = targetGroup.id;
                        out.log("INFO", "MockDatabase.createUser", "Found group by display name: " + group.display);
                    }
                }
                
                // If still not found and we have display name, create the group
                if (!targetGroup && group.display) {
                    groupId = uuid.v4();
                    out.log("INFO", "MockDatabase.createUser", "Creating new group: " + group.display);
                    
                    this.groups.push({
                        id: groupId,
                        displayName: group.display
                    });
                }
                
                // Only add membership if we have a valid groupId
                if (groupId) {
                    out.log("INFO", "MockDatabase.createUser", "Adding user to group: " + groupId);
                    this.memberships.push({
                        id: uuid.v4(),
                        groupId: groupId,
                        userId: userId
                    });
                } else {
                    out.log("WARN", "MockDatabase.createUser", "Cannot add user to group, invalid group reference: " + JSON.stringify(group));
                }
            }
        }
        
        newUser.groups = this.getGroupsForUser(userId);
        out.log("DEBUG", "MockDatabase.createUser", "User created with groups: " + JSON.stringify(newUser.groups));
        callback(scimCore.parseSCIMUser(newUser, reqUrl));
    }

    static async patchUser(attributeName, attributeValue, userId, reqUrl, callback) {
        this.dbInit();
        
        const userIndex = this.users.findIndex(u => u.id === String(userId));
        
        if (userIndex === -1) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        this.users[userIndex][attributeName] = attributeValue;
        const user = this.users[userIndex];
        user.groups = this.getGroupsForUser(userId);
        
        callback(scimCore.parseSCIMUser(user, reqUrl));
    }

    static async updateUser(userModel, userId, reqUrl, callback) {
        this.dbInit();
        
        const userIndex = this.users.findIndex(u => u.id === String(userId));
        
        if (userIndex === -1) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        this.users[userIndex] = {
            id: userId,
            active: userModel.active,
            userName: userModel.userName,
            givenName: userModel.givenName,
            middleName: userModel.middleName,
            familyName: userModel.familyName,
            email: userModel.email
        };
        
        const user = this.users[userIndex];
        user.groups = this.getGroupsForUser(userId);
        
        callback(scimCore.parseSCIMUser(user, reqUrl));
    }

    // Group CRUD operations
    static async getFilteredGroups(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        this.dbInit();
        
        const filteredGroups = this.groups.filter(group => 
            String(group[filterAttribute]) === String(filterValue)
        );
        
        if (filteredGroups.length === 0) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }

        const actualCount = Math.min(filteredGroups.length, count || filteredGroups.length);
        const groupsToReturn = filteredGroups.slice(startIndex - 1, startIndex - 1 + actualCount);
        
        // Add members to each group
        for (let i = 0; i < groupsToReturn.length; i++) {
            groupsToReturn[i].members = this.getUsersForGroup(groupsToReturn[i].id);
        }

        callback(scimCore.createSCIMGroupList(groupsToReturn, startIndex, actualCount, reqUrl));
    }

    static async getAllGroups(startIndex, count, reqUrl, callback) {
        this.dbInit();
        
        if (!startIndex) startIndex = 1;
        if (!count) count = this.groups.length;
        
        const actualCount = Math.min(this.groups.length, count);
        const groupsToReturn = this.groups.slice(startIndex - 1, startIndex - 1 + actualCount);
        
        // Add members to each group
        for (let i = 0; i < groupsToReturn.length; i++) {
            groupsToReturn[i].members = this.getUsersForGroup(groupsToReturn[i].id);
        }

        callback(scimCore.createSCIMGroupList(groupsToReturn, startIndex, actualCount, reqUrl));
    }

    static async getGroup(groupId, reqUrl, callback) {
        this.dbInit();
        
        const group = this.groups.find(g => g.id === String(groupId));
        
        if (!group) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        group.members = this.getUsersForGroup(group.id);
        callback(scimCore.parseSCIMGroup(group, reqUrl));
    }

    static async createGroup(groupModel, reqUrl, callback) {
        this.dbInit();
        
        // Check if group already exists
        const existingGroup = this.groups.find(g => g.displayName === groupModel.displayName);
        if (existingGroup) {
            callback(scimCore.createSCIMError("Group Already Exists", "409"));
            return;
        }
        
        const groupId = uuid.v4();
        const newGroup = {
            id: groupId,
            displayName: groupModel.displayName
        };
        
        this.groups.push(newGroup);
        
        // Add members if specified
        if (groupModel.members && groupModel.members.length > 0) {
            for (const member of groupModel.members) {
                this.memberships.push({
                    id: uuid.v4(),
                    groupId: groupId,
                    userId: member.value
                });
            }
        }
        
        newGroup.members = this.getUsersForGroup(groupId);
        callback(scimCore.parseSCIMGroup(newGroup, reqUrl));
    }

    static async patchGroup(attributeName, attributeValue, groupId, reqUrl, callback) {
        this.dbInit();
        
        const groupIndex = this.groups.findIndex(g => g.id === String(groupId));
        
        if (groupIndex === -1) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        this.groups[groupIndex][attributeName] = attributeValue;
        const group = this.groups[groupIndex];
        group.members = this.getUsersForGroup(groupId);
        
        callback(scimCore.parseSCIMGroup(group, reqUrl));
    }

    static async updateGroup(groupModel, groupId, reqUrl, callback) {
        this.dbInit();
        
        const groupIndex = this.groups.findIndex(g => g.id === String(groupId));
        
        if (groupIndex === -1) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        this.groups[groupIndex] = {
            id: groupId,
            displayName: groupModel.displayName
        };
        
        const group = this.groups[groupIndex];
        group.members = this.getUsersForGroup(groupId);
        
        callback(scimCore.parseSCIMGroup(group, reqUrl));
    }

    // Delete a user and remove from any groups
    static async deleteUser(userId, callback) {
        this.dbInit();
        
        const userIndex = this.users.findIndex(u => u.id === String(userId));
        
        if (userIndex === -1) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        // Remove user from all groups they are a member of
        this.memberships = this.memberships.filter(m => m.userId !== String(userId));
        
        // Remove the user
        this.users.splice(userIndex, 1);
        
        callback();
    }

    // Delete a group
    static async deleteGroup(groupId, callback) {
        this.dbInit();
        
        const groupIndex = this.groups.findIndex(g => g.id === String(groupId));
        
        if (groupIndex === -1) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        // Remove all membership records for this group
        this.memberships = this.memberships.filter(m => m.groupId !== String(groupId));
        
        // Remove the group
        this.groups.splice(groupIndex, 1);
        
        callback();
    }

    // Group membership methods
    static async getGroupMemberships(callback) {
        this.dbInit();
        callback(null, this.memberships);
    }

    static getGroupsForUser(userId) {
        this.dbInit();
        
        const userMemberships = this.memberships.filter(m => m.userId === String(userId));
        const groups = [];
        
        for (const membership of userMemberships) {
            const group = this.groups.find(g => g.id === membership.groupId);
            if (group) {
                groups.push({
                    value: group.id,
                    $ref: `../Groups/${group.id}`,
                    display: group.displayName
                });
            }
        }
        
        return groups;
    }

    static getUsersForGroup(groupId) {
        this.dbInit();
        
        const groupMemberships = this.memberships.filter(m => m.groupId === String(groupId));
        const members = [];
        
        for (const membership of groupMemberships) {
            const user = this.users.find(u => u.id === membership.userId);
            if (user) {
                members.push({
                    value: user.id,
                    $ref: `../Users/${user.id}`,
                    display: `${user.givenName} ${user.familyName}`
                });
            }
        }
        
        return members;
    }
}

module.exports = MockDatabase; 