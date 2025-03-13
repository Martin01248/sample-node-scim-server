# Okta-Scim-Server
Sample SCIM server written in NodeJS that supports Users and Groups (with group memberships!). This can be used in conjunction with the Okta SCIM application to test SCIM capabilities. Includes action logging.

## Users endpoint

1\. Create User (POST to {SCIM Base Url}/Users)


2\. Get Users (GET to {SCIM Base Url}/Users)


3\. Get User By Id (GET to {SCIM Base Url}/Users/:UserId)


4\. Deactivate User (PATCH to {SCIM Base Url}/Users/:UserId)


5\. Modify/Update User (PUT to {SCIM Base Url}/Users/:UserId)

## Groups endpoint

1\. Create Group (POST to {SCIM Base Url}/Groups)

2\. Get Groups (GET to {SCIM Base Url}/Groups)

3\. Get Group By Id (GET to {SCIM Base Url}/Groups/:GroupId)

4\. Modify Group Name (PATCH to {SCIM Base Url}/Groups/:GroupId)

5\. Update Group (PUT to {SCIM Base Url}/Groups/:GroupId)

# Required Packages
You need to install [NodeJS](https://nodejs.org/en/) and npm (comes with NodeJS). The project contains a `package.json` file that npm can use to install dependencies. To do this, follow these steps:

1\. Open Command Prompt (or Terminal)

2\. `cd` to the place where you extracted this project

3\. `npm install` in the folder where the `package.json` file is located

# Running and Testing the Server
Once all above is install run the node server "node SCIMServer.js". Make the following cals from any REST Client (Postman, cURL, etc.) or API validation tools Runscope.

__IMPORTANT: All requests must contain the following two headers:__
```json
Accept: application/scim+json
Content-Type: application/scim+json
```

You can use [ngrok](https://ngrok.com/) "ngrok http 8081" to make server available online. use https://xxxxx.ngrok.io in Okta SCIM app or Runscope to test online.

## Using Postman

You can get the collection for the supported actions by clicking [this link](https://www.getpostman.com/collections/0a38ba3aa0383bb9dc4f).

__IMPORTANT: If you change the body type to JSON, Postman will reset the `Content-Type` header to `application/json` and your calls will fail.__

## Requests

### Users

1\. POST {SCIM_Base_Url}/scim/v2/Users

```json
{  
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "username@example.com",
  "name":
  {  
    "givenName": "<GivenName>",
    "middleName": "undefined",
    "familyName": "<FaimlyName>"
  },
  "emails":
  [{
    "primary": true,
    "value": "username@example.com",
    "type": "work"
  }],
  "displayName": "<display name>",
  "externalId": "<externalId>",
  "groups": [],
  "active": true
}
```

2\. GET {SCIM_Base_Url}/scim/v2/Users?count=2&startIndex=1

3\. GET {SCIM_Base_Url}/scim/v2/Users?count=1&filter=userName eq "username@example.com"&startIndex=1

4\. PUT {SCIM_Base_Url}/scim/v2/Users/<UserID>

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "a5222dc0-4dec-11e6-866c-5b600f3e2809",
  "userName": "username@example.com",
  "name":
  {
    "givenName": "<GivenName>",
    "middleName": "undefined",
    "familyName": "<FamilyName>"
  },
  "active": "true",
  "meta":
  {
    "resourceType": "User",
    "location": "<location uri>"
  },
  "emails":
  [{
    "primary": true,
    "type": "work",
    "value": "username@example.com"
  }],
  "displayName": "<display Name>",
  "externalId": "<externalId>",
  "groups": []
}
```
5\. PATCH {SCIM_Base_Url}/scim/v2/Users/<UserID>
```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations":
  [{
    "op": "replace",
    "value": { "active":true }
  }]
}
```

### Groups

1\. POST {SCIM_Base_Url}/scim/v2/Groups
```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
  "displayName": "Test Group 1",
  "members":
  [{
    "value": "<UserID>",
    "$ref": "<UserSCIMLocation>",
    "display": "First Last"
  }]
}
```

2\. GET {SCIM_Base_Url}/scim/v2/Groups?count=2&startIndex=1

3\. GET {SCIM_Base_Url}/scim/v2/Groups?count=1&startIndex=1&filter=displayName eq Test Group 1

4\. PUT {SCIM_Base_Url}/scim/v2/Groups/<GroupID>
```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
  "id": "<GroupID>",
  "displayName": "<DisplayName>",
  "members":
  [{
    "value": "<UserID>",
    "$ref": "<UserSCIMLocation>",
    "display": "First Last"
  }]
}
```

5\. PATCH {SCIM_Base_Url}/scim/v2/Groups/<GroupID>
```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations":
  [{
    "op": "replace",
    "value": { "displayName":"Test" }
  }]
}
```

# Using In-Memory Database for PoC Testing

This project now supports an in-memory mock database for Proof of Concept (PoC) testing with Entra ID (formerly Azure AD) without needing to connect to a real database. 

## How It Works

The mock database:
- Initializes with sample users and groups in memory
- Persists data only for the lifetime of the server process
- Provides all SCIM endpoints with valid data for testing
- Automatically manages group memberships and user relationships

## Features

- Pre-populated with two sample users and two groups
- Full CRUD operations for users and groups
- Support for group membership operations
- Proper handling of user/group deletion with relationship cleanup

## Using the Mock Database

The application now uses the in-memory database by default. No configuration is required to use it.

If you wish to switch back to the SQLite database:
1. Edit `SCIMServer.js` to replace `require('./core/MockDatabase')` with `require('./core/Database')`
2. Make the same change in the components files (`components/Users.js` and `components/Groups.js`)
3. Update `core/SCIMCore.js` to use the original Database module

## Testing

Run the tests to ensure the SCIM endpoints work correctly with the mock database:

```
npm test
```

The tests verify:
- All CRUD operations for users and groups
- Group membership operations
- User deactivation behavior
- Group changes (adding/removing users)
- Deletion of users and groups with proper cleanup

# Storage Options

## File-Based Storage
The server now uses a file-based JSON storage system by default. This approach:
- Stores all data in a `data/db.json` file
- Persists data between server restarts locally
- Automatically initializes with sample users and groups if no data file exists
- Provides atomic file operations for data consistency

### Local Development
For local development and testing:
- Data is stored in the `data/db.json` file
- Changes persist between server restarts
- File is automatically created with sample data on first run

### Heroku Deployment
When deploying to Heroku, be aware that:
- The filesystem is ephemeral - files are not persisted between dyno restarts
- Each dyno restart will reinitialize the database with sample data
- This is suitable for demo/PoC purposes
- For production use, consider:
  1. Using a proper database service
  2. Using Heroku's config vars to store small amounts of data
  3. Using an external storage service

To use config vars for persistence on Heroku:
```bash
# Save current data to config var
heroku config:set SCIM_DB="$(cat data/db.json)"

# Update code to load from config var if available
if (process.env.SCIM_DB) {
  this.data = JSON.parse(process.env.SCIM_DB);
}
```
