const request = require('supertest');
const { expect } = require('chai');
const app = require('../SCIMServer');
const db = require('../core/FileDatabase');

describe('SCIM API Tests', () => {
    before(async () => {
        // Initialize the database with mock data
        await db.dbInit();
    });

    describe('Users Endpoints', () => {
        let userId;

        it('GET /scim/v2/Users should list all users', async () => {
            const res = await request(app)
                .get('/scim/v2/Users')
                .expect(200);

            expect(res.body.schemas).to.include('urn:ietf:params:scim:api:messages:2.0:ListResponse');
            expect(res.body.Resources).to.be.an('array');
            expect(res.body.Resources.length).to.be.greaterThan(0);
            expect(res.body.Resources[0]).to.have.property('userName');
        });

        it('GET /scim/v2/Users with filter should return filtered users', async () => {
            // Get a sample user to filter by
            const allUsers = await request(app).get('/scim/v2/Users');
            const sampleUser = allUsers.body.Resources[0];
            
            const res = await request(app)
                .get(`/scim/v2/Users?filter=userName eq ${sampleUser.userName}`)
                .expect(200);

            expect(res.body.Resources).to.be.an('array');
            expect(res.body.Resources.length).to.equal(1);
            expect(res.body.Resources[0].userName).to.equal(sampleUser.userName);
        });

        it('POST /scim/v2/Users should create a new user', async () => {
            const newUser = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                userName: 'test.user@example.com',
                name: {
                    givenName: 'Test',
                    middleName: 'Middle',
                    familyName: 'User'
                },
                emails: [{
                    primary: true,
                    value: 'test.user@example.com',
                    type: 'work'
                }],
                active: true,
                groups: []
            };

            const res = await request(app)
                .post('/scim/v2/Users')
                .send(newUser)
                .expect(201);

            userId = res.body.id;
            expect(res.body.userName).to.equal(newUser.userName);
            expect(res.body.name.givenName).to.equal(newUser.name.givenName);
            expect(res.body.name.middleName).to.equal(newUser.name.middleName);
            expect(res.body.name.familyName).to.equal(newUser.name.familyName);
            expect(res.body.active).to.equal(newUser.active);
        });

        it('GET /scim/v2/Users/:userId should get a specific user', async () => {
            const res = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            expect(res.body.id).to.equal(userId);
            expect(res.body.userName).to.equal('test.user@example.com');
            expect(res.body.name.givenName).to.equal('Test');
            expect(res.body.name.familyName).to.equal('User');
        });

        it('PATCH /scim/v2/Users/:userId should update user attributes', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'replace',
                    value: {
                        givenName: 'Updated'
                    }
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Users/${userId}`)
                .send(patch)
                .expect(200);

            expect(res.body.name.givenName).to.equal('Updated');
        });

        it('PUT /scim/v2/Users/:userId should update entire user profile', async () => {
            const updatedUser = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                userName: 'test.user@example.com',
                name: {
                    givenName: 'Complete',
                    middleName: 'New',
                    familyName: 'Update'
                },
                emails: [{
                    primary: true,
                    value: 'test.user@example.com',
                    type: 'work'
                }],
                active: true,
                groups: []
            };

            const res = await request(app)
                .put(`/scim/v2/Users/${userId}`)
                .send(updatedUser)
                .expect(200);

            expect(res.body.name.givenName).to.equal('Complete');
            expect(res.body.name.middleName).to.equal('New');
            expect(res.body.name.familyName).to.equal('Update');
        });
    });

    describe('Groups Endpoints', () => {
        let groupId;

        it('GET /scim/v2/Groups should list all groups', async () => {
            const res = await request(app)
                .get('/scim/v2/Groups')
                .expect(200);

            expect(res.body.schemas).to.include('urn:ietf:params:scim:api:messages:2.0:ListResponse');
            expect(res.body.Resources).to.be.an('array');
            expect(res.body.Resources.length).to.be.greaterThan(0);
            expect(res.body.Resources[0]).to.have.property('displayName');
        });

        it('GET /scim/v2/Groups with filter should return filtered groups', async () => {
            // Get a sample group to filter by
            const allGroups = await request(app).get('/scim/v2/Groups');
            const sampleGroup = allGroups.body.Resources[0];
            
            const res = await request(app)
                .get(`/scim/v2/Groups?filter=displayName eq ${sampleGroup.displayName}`)
                .expect(200);

            expect(res.body.Resources).to.be.an('array');
            expect(res.body.Resources.length).to.equal(1);
            expect(res.body.Resources[0].displayName).to.equal(sampleGroup.displayName);
        });

        it('POST /scim/v2/Groups should create a new group', async () => {
            const newGroup = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                displayName: 'Test Group',
                members: []
            };

            const res = await request(app)
                .post('/scim/v2/Groups')
                .send(newGroup)
                .expect(201);

            groupId = res.body.id;
            expect(res.body.displayName).to.equal(newGroup.displayName);
        });

        it('GET /scim/v2/Groups/:groupId should get a specific group', async () => {
            const res = await request(app)
                .get(`/scim/v2/Groups/${groupId}`)
                .expect(200);

            expect(res.body.id).to.equal(groupId);
            expect(res.body.displayName).to.equal('Test Group');
        });

        it('PATCH /scim/v2/Groups/:groupId should update group attributes', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'replace',
                    value: {
                        displayName: 'Updated Group'
                    }
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Groups/${groupId}`)
                .send(patch)
                .expect(200);

            expect(res.body.displayName).to.equal('Updated Group');
        });

        it('PUT /scim/v2/Groups/:groupId should update entire group', async () => {
            const updatedGroup = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                displayName: 'Completely Updated Group',
                members: []
            };

            const res = await request(app)
                .put(`/scim/v2/Groups/${groupId}`)
                .send(updatedGroup)
                .expect(200);

            expect(res.body.displayName).to.equal('Completely Updated Group');
        });
    });

    describe('Group Membership Tests', () => {
        let userId;
        let groupId;

        before(async () => {
            // Create a test user
            const userRes = await request(app)
                .post('/scim/v2/Users')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'member.test@example.com',
                    name: {
                        givenName: 'Member',
                        familyName: 'Test'
                    },
                    emails: [{
                        primary: true,
                        value: 'member.test@example.com',
                        type: 'work'
                    }],
                    active: true
                });
            userId = userRes.body.id;

            // Create a test group
            const groupRes = await request(app)
                .post('/scim/v2/Groups')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    displayName: 'Membership Test Group',
                    members: []
                });
            groupId = groupRes.body.id;
        });

        it('should add a user to a group', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'add',
                    path: 'members',
                    value: [{
                        value: userId,
                        display: 'Member Test'
                    }]
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Groups/${groupId}`)
                .send(patch)
                .expect(200);

            expect(res.body.members).to.be.an('array');
            expect(res.body.members).to.have.lengthOf(1);
            expect(res.body.members[0].value).to.equal(userId);
        });

        it('should verify user is in group after addition', async () => {
            const res = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            expect(res.body.groups).to.be.an('array');
            const userInGroup = res.body.groups.some(g => g.value === groupId);
            expect(userInGroup).to.be.true;
        });

        it('should remove a user from a group', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'remove',
                    path: 'members',
                    value: [{
                        value: userId
                    }]
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Groups/${groupId}`)
                .send(patch)
                .expect(200);

            expect(res.body.members).to.be.an('array');
            expect(res.body.members).to.have.lengthOf(0);
        });

        it('should verify user is not in group after removal', async () => {
            const res = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            if (res.body.groups && res.body.groups.length > 0) {
                const userInGroup = res.body.groups.some(g => g.value === groupId);
                expect(userInGroup).to.be.false;
            } else {
                expect(res.body.groups).to.be.an('array');
                expect(res.body.groups.length).to.equal(0);
            }
        });
    });

    describe('User Deactivation Tests', () => {
        let userId;
        let groupId;

        before(async () => {
            // Create a test user
            const userRes = await request(app)
                .post('/scim/v2/Users')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'deactivate.test@example.com',
                    name: {
                        givenName: 'Deactivate',
                        familyName: 'Test'
                    },
                    emails: [{
                        primary: true,
                        value: 'deactivate.test@example.com',
                        type: 'work'
                    }],
                    active: true
                });
            userId = userRes.body.id;

            // Create a test group
            const groupRes = await request(app)
                .post('/scim/v2/Groups')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    displayName: 'Deactivation Test Group',
                    members: []
                });
            groupId = groupRes.body.id;

            // Add user to group
            await request(app)
                .patch(`/scim/v2/Groups/${groupId}`)
                .send({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                    Operations: [{
                        op: 'add',
                        path: 'members',
                        value: [{
                            value: userId,
                            display: 'Deactivate Test'
                        }]
                    }]
                });
        });

        it('should deactivate a user', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'replace',
                    value: {
                        active: false
                    }
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Users/${userId}`)
                .send(patch)
                .expect(200);

            expect(res.body.active).to.be.false;
        });

        it('should still remain in groups after deactivation', async () => {
            const groupRes = await request(app)
                .get(`/scim/v2/Groups/${groupId}`)
                .expect(200);

            const userInGroup = groupRes.body.members.some(m => m.value === userId);
            expect(userInGroup).to.be.true;
        });
    });

    describe('Group Changes Tests', () => {
        let userId;
        let originalGroupId;
        let newGroupId;

        before(async () => {
            // Create a test user
            const userRes = await request(app)
                .post('/scim/v2/Users')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'group.change@example.com',
                    name: {
                        givenName: 'Group',
                        familyName: 'Change'
                    },
                    emails: [{
                        primary: true,
                        value: 'group.change@example.com',
                        type: 'work'
                    }],
                    active: true
                });
            userId = userRes.body.id;

            // Create two test groups
            const group1Res = await request(app)
                .post('/scim/v2/Groups')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    displayName: 'Original Group',
                    members: []
                });
            originalGroupId = group1Res.body.id;

            const group2Res = await request(app)
                .post('/scim/v2/Groups')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    displayName: 'New Group',
                    members: []
                });
            newGroupId = group2Res.body.id;

            // Add user to original group
            await request(app)
                .patch(`/scim/v2/Groups/${originalGroupId}`)
                .send({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                    Operations: [{
                        op: 'add',
                        path: 'members',
                        value: [{
                            value: userId,
                            display: 'Group Change'
                        }]
                    }]
                });
        });

        it('should verify user is in original group', async () => {
            const res = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            const userInOriginalGroup = res.body.groups.some(g => g.value === originalGroupId);
            expect(userInOriginalGroup).to.be.true;
        });

        it('should add user to new group', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'add',
                    path: 'members',
                    value: [{
                        value: userId,
                        display: 'Group Change'
                    }]
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Groups/${newGroupId}`)
                .send(patch)
                .expect(200);

            const userInNewGroup = res.body.members.some(m => m.value === userId);
            expect(userInNewGroup).to.be.true;
        });

        it('should verify user is in both groups', async () => {
            const res = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            const userInOriginalGroup = res.body.groups.some(g => g.value === originalGroupId);
            const userInNewGroup = res.body.groups.some(g => g.value === newGroupId);
            
            expect(userInOriginalGroup).to.be.true;
            expect(userInNewGroup).to.be.true;
        });

        it('should remove user from original group', async () => {
            const patch = {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                Operations: [{
                    op: 'remove',
                    path: 'members',
                    value: [{
                        value: userId
                    }]
                }]
            };

            const res = await request(app)
                .patch(`/scim/v2/Groups/${originalGroupId}`)
                .send(patch)
                .expect(200);

            const userInOriginalGroup = res.body.members.some(m => m.value === userId);
            expect(userInOriginalGroup).to.be.false;
        });

        it('should verify user is only in new group', async () => {
            const res = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            expect(res.body.groups).to.be.an('array');
            expect(res.body.groups.length).to.equal(1);
            expect(res.body.groups[0].value).to.equal(newGroupId);
        });
    });

    describe('User Deletion Tests', () => {
        let userId;
        let groupId;
        let userWithGroups;

        before(async () => {
            // Create a test user
            const userRes = await request(app)
                .post('/scim/v2/Users')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'delete.test@example.com',
                    name: {
                        givenName: 'Delete',
                        familyName: 'Test'
                    },
                    emails: [{
                        primary: true,
                        value: 'delete.test@example.com',
                        type: 'work'
                    }],
                    active: true
                });
            userId = userRes.body.id;

            // Create a test group
            const groupRes = await request(app)
                .post('/scim/v2/Groups')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    displayName: 'Deletion Test Group',
                    members: []
                });
            groupId = groupRes.body.id;

            // Add user to group
            await request(app)
                .patch(`/scim/v2/Groups/${groupId}`)
                .send({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                    Operations: [{
                        op: 'add',
                        path: 'members',
                        value: [{
                            value: userId,
                            display: 'Delete Test'
                        }]
                    }]
                });

            // Check that user is in group
            const userWithGroupsRes = await request(app).get(`/scim/v2/Users/${userId}`);
            userWithGroups = userWithGroupsRes.body;
        });

        it('should have the user in the group before deletion', () => {
            expect(userWithGroups.groups).to.be.an('array');
            const userInGroup = userWithGroups.groups.some(g => g.value === groupId);
            expect(userInGroup).to.be.true;
        });

        it('should handle user deletion properly', async () => {
            // First verify that the user exists
            await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);

            // Delete the user
            await request(app)
                .delete(`/scim/v2/Users/${userId}`)
                .expect(204);
            
            // After deletion, attempts to get the user should fail
            await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(404);
                
            // The group should no longer contain the user after deletion
            const groupRes = await request(app)
                .get(`/scim/v2/Groups/${groupId}`)
                .expect(200);
                
            const userInGroup = groupRes.body.members.some(m => m.value === userId);
            expect(userInGroup).to.be.false;
        });
    });

    describe('Group Deletion Tests', () => {
        let userId;
        let groupId;
        
        before(async () => {
            // Create a test user
            const userRes = await request(app)
                .post('/scim/v2/Users')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    userName: 'group.deletion@example.com',
                    name: {
                        givenName: 'Group',
                        familyName: 'Deletion'
                    },
                    emails: [{
                        primary: true,
                        value: 'group.deletion@example.com',
                        type: 'work'
                    }],
                    active: true
                });
            userId = userRes.body.id;

            // Create a test group
            const groupRes = await request(app)
                .post('/scim/v2/Groups')
                .send({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                    displayName: 'Group To Delete',
                    members: []
                });
            groupId = groupRes.body.id;

            // Add user to group
            await request(app)
                .patch(`/scim/v2/Groups/${groupId}`)
                .send({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
                    Operations: [{
                        op: 'add',
                        path: 'members',
                        value: [{
                            value: userId,
                            display: 'Group Deletion'
                        }]
                    }]
                });
        });

        it('should delete a group and remove group from user memberships', async () => {
            // Verify group exists and has the user
            const groupRes = await request(app)
                .get(`/scim/v2/Groups/${groupId}`)
                .expect(200);
                
            const userInGroup = groupRes.body.members.some(m => m.value === userId);
            expect(userInGroup).to.be.true;
            
            // Verify user has the group
            const userRes = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);
                
            const userHasGroup = userRes.body.groups.some(g => g.value === groupId);
            expect(userHasGroup).to.be.true;
            
            // Delete the group
            await request(app)
                .delete(`/scim/v2/Groups/${groupId}`)
                .expect(204);
                
            // Group should no longer exist
            await request(app)
                .get(`/scim/v2/Groups/${groupId}`)
                .expect(404);
                
            // User should no longer have the group in their memberships
            const updatedUserRes = await request(app)
                .get(`/scim/v2/Users/${userId}`)
                .expect(200);
                
            const userStillHasGroup = updatedUserRes.body.groups.some(g => g.value === groupId);
            expect(userStillHasGroup).to.be.false;
        });
    });
}); 