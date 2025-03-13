const fs = require('fs').promises;
const path = require('path');
const uuid = require('uuid');
const scimCore = require('./SCIMCore');
const out = require('./Logs');

class FileDatabase {
    static dataFile = path.join(__dirname, '../data/db.json');
    static initialized = false;
    static data = {
        users: [],
        groups: [],
        memberships: []
    };

    // Ensure the data file exists
    static async ensureDataFile() {
        try {
            await fs.access(this.dataFile);
        } catch (err) {
            // File doesn't exist, create directory if needed
            await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
            await this.saveData();
        }
    }

    // Load data from file
    static async loadData() {
        const fileContent = await fs.readFile(this.dataFile, 'utf8');
        this.data = JSON.parse(fileContent);
    }

    // Save data to file
    static async saveData() {
        await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2), 'utf8');
    }

    // Initialize with sample data
    static async dbInit() {
        if (this.initialized) {
            return;
        }

        await this.ensureDataFile();
        
        try {
            await this.loadData();
            if (!this.data.users || !this.data.groups || !this.data.memberships) {
                throw new Error('Invalid data structure');
            }
        } catch (err) {
            // If loading fails or data is invalid, initialize with sample data
            this.data = {
                users: [],
                groups: [],
                memberships: []
            };

            // Create sample users
            const user1Id = uuid.v4();
            const user2Id = uuid.v4();
            
            this.data.users.push({
                id: user1Id,
                active: true,
                userName: 'john.doe@example.com',
                givenName: 'John',
                middleName: '',
                familyName: 'Doe',
                email: 'john.doe@example.com'
            });
            
            this.data.users.push({
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
            
            this.data.groups.push({
                id: group1Id,
                displayName: 'Administrators'
            });
            
            this.data.groups.push({
                id: group2Id,
                displayName: 'Users'
            });

            // Create sample memberships
            this.data.memberships.push({
                id: uuid.v4(),
                groupId: group1Id,
                userId: user1Id
            });
            
            this.data.memberships.push({
                id: uuid.v4(),
                groupId: group2Id,
                userId: user1Id
            });
            
            this.data.memberships.push({
                id: uuid.v4(),
                groupId: group2Id,
                userId: user2Id
            });

            await this.saveData();
        }

        this.initialized = true;
        out.log("INFO", "FileDatabase.dbInit", "File database initialized");
    }

    // User CRUD operations
    static async getFilteredUsers(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        await this.dbInit();
        
        const filteredUsers = this.data.users.filter(user => 
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
        await this.dbInit();
        
        if (!startIndex) startIndex = 1;
        if (!count) count = this.data.users.length;
        
        const actualCount = Math.min(this.data.users.length, count);
        const usersToReturn = this.data.users.slice(startIndex - 1, startIndex - 1 + actualCount);
        
        // Add groups to each user
        for (let i = 0; i < usersToReturn.length; i++) {
            usersToReturn[i].groups = this.getGroupsForUser(usersToReturn[i].id);
        }

        callback(scimCore.createSCIMUserList(usersToReturn, startIndex, actualCount, reqUrl));
    }

    static async getUser(userId, reqUrl, callback) {
        await this.dbInit();
        
        const user = this.data.users.find(u => u.id === String(userId));
        
        if (!user) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        user.groups = this.getGroupsForUser(user.id);
        callback(scimCore.parseSCIMUser(user, reqUrl));
    }

    static async createUser(userModel, reqUrl, callback) {
        await this.dbInit();
        
        // Check if user already exists
        const existingUser = this.data.users.find(u => u.userName === userModel.userName);
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
        
        this.data.users.push(newUser);
        
        // Add group memberships if specified
        if (userModel.groups && userModel.groups.length > 0) {
            for (const group of userModel.groups) {
                this.data.memberships.push({
                    id: uuid.v4(),
                    groupId: group.value,
                    userId: userId
                });
            }
        }
        
        await this.saveData();
        newUser.groups = this.getGroupsForUser(userId);
        callback(scimCore.parseSCIMUser(newUser, reqUrl));
    }

    static async patchUser(attributeName, attributeValue, userId, reqUrl, callback) {
        await this.dbInit();
        
        const userIndex = this.data.users.findIndex(u => u.id === String(userId));
        
        if (userIndex === -1) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        this.data.users[userIndex][attributeName] = attributeValue;
        await this.saveData();
        
        const user = this.data.users[userIndex];
        user.groups = this.getGroupsForUser(userId);
        
        callback(scimCore.parseSCIMUser(user, reqUrl));
    }

    static async updateUser(userModel, userId, reqUrl, callback) {
        await this.dbInit();
        
        const userIndex = this.data.users.findIndex(u => u.id === String(userId));
        
        if (userIndex === -1) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        this.data.users[userIndex] = {
            id: userId,
            active: userModel.active,
            userName: userModel.userName,
            givenName: userModel.givenName,
            middleName: userModel.middleName,
            familyName: userModel.familyName,
            email: userModel.email
        };
        
        await this.saveData();
        const user = this.data.users[userIndex];
        user.groups = this.getGroupsForUser(userId);
        
        callback(scimCore.parseSCIMUser(user, reqUrl));
    }

    // Group CRUD operations
    static async getFilteredGroups(filterAttribute, filterValue, startIndex, count, reqUrl, callback) {
        await this.dbInit();
        
        const filteredGroups = this.data.groups.filter(group => 
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
        await this.dbInit();
        
        if (!startIndex) startIndex = 1;
        if (!count) count = this.data.groups.length;
        
        const actualCount = Math.min(this.data.groups.length, count);
        const groupsToReturn = this.data.groups.slice(startIndex - 1, startIndex - 1 + actualCount);
        
        // Add members to each group
        for (let i = 0; i < groupsToReturn.length; i++) {
            groupsToReturn[i].members = this.getUsersForGroup(groupsToReturn[i].id);
        }

        callback(scimCore.createSCIMGroupList(groupsToReturn, startIndex, actualCount, reqUrl));
    }

    static async getGroup(groupId, reqUrl, callback) {
        await this.dbInit();
        
        const group = this.data.groups.find(g => g.id === String(groupId));
        
        if (!group) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        group.members = this.getUsersForGroup(group.id);
        callback(scimCore.parseSCIMGroup(group, reqUrl));
    }

    static async createGroup(groupModel, reqUrl, callback) {
        await this.dbInit();
        
        // Check if group already exists
        const existingGroup = this.data.groups.find(g => g.displayName === groupModel.displayName);
        if (existingGroup) {
            callback(scimCore.createSCIMError("Group Already Exists", "409"));
            return;
        }
        
        const groupId = uuid.v4();
        const newGroup = {
            id: groupId,
            displayName: groupModel.displayName
        };
        
        this.data.groups.push(newGroup);
        
        // Add members if specified
        if (groupModel.members && groupModel.members.length > 0) {
            for (const member of groupModel.members) {
                this.data.memberships.push({
                    id: uuid.v4(),
                    groupId: groupId,
                    userId: member.value
                });
            }
        }
        
        await this.saveData();
        newGroup.members = this.getUsersForGroup(groupId);
        callback(scimCore.parseSCIMGroup(newGroup, reqUrl));
    }

    static async patchGroup(attributeName, attributeValue, groupId, reqUrl, callback) {
        await this.dbInit();
        
        const groupIndex = this.data.groups.findIndex(g => g.id === String(groupId));
        
        if (groupIndex === -1) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        this.data.groups[groupIndex][attributeName] = attributeValue;
        await this.saveData();
        
        const group = this.data.groups[groupIndex];
        group.members = this.getUsersForGroup(groupId);
        
        callback(scimCore.parseSCIMGroup(group, reqUrl));
    }

    static async updateGroup(groupModel, groupId, reqUrl, callback) {
        await this.dbInit();
        
        const groupIndex = this.data.groups.findIndex(g => g.id === String(groupId));
        
        if (groupIndex === -1) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        this.data.groups[groupIndex] = {
            id: groupId,
            displayName: groupModel.displayName
        };
        
        await this.saveData();
        const group = this.data.groups[groupIndex];
        group.members = this.getUsersForGroup(groupId);
        
        callback(scimCore.parseSCIMGroup(group, reqUrl));
    }

    // Delete operations
    static async deleteUser(userId, callback) {
        await this.dbInit();
        
        const userIndex = this.data.users.findIndex(u => u.id === String(userId));
        
        if (userIndex === -1) {
            callback(scimCore.createSCIMError("User Not Found", "404"));
            return;
        }
        
        // Remove user from all groups they are a member of
        this.data.memberships = this.data.memberships.filter(m => m.userId !== String(userId));
        
        // Remove the user
        this.data.users.splice(userIndex, 1);
        
        await this.saveData();
        callback();
    }

    static async deleteGroup(groupId, callback) {
        await this.dbInit();
        
        const groupIndex = this.data.groups.findIndex(g => g.id === String(groupId));
        
        if (groupIndex === -1) {
            callback(scimCore.createSCIMError("Group Not Found", "404"));
            return;
        }
        
        // Remove all membership records for this group
        this.data.memberships = this.data.memberships.filter(m => m.groupId !== String(groupId));
        
        // Remove the group
        this.data.groups.splice(groupIndex, 1);
        
        await this.saveData();
        callback();
    }

    // Helper methods
    static getGroupsForUser(userId) {
        const userMemberships = this.data.memberships.filter(m => m.userId === String(userId));
        const groups = [];
        
        for (const membership of userMemberships) {
            const group = this.data.groups.find(g => g.id === membership.groupId);
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
        const groupMemberships = this.data.memberships.filter(m => m.groupId === String(groupId));
        const members = [];
        
        for (const membership of groupMemberships) {
            const user = this.data.users.find(u => u.id === membership.userId);
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

module.exports = FileDatabase; 