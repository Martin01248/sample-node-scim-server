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

# Storage Options

## PostgreSQL Database
The server now supports PostgreSQL database integration for persistent storage:
- Stores all data in a PostgreSQL database
- Provides robust data persistence and relational integrity
- Uses connection pooling for efficient database connections
- Supports comprehensive SCIM operations for users and groups
- Handles transactions properly for data consistency

### Setting Up PostgreSQL
1. Install PostgreSQL on your system or use a cloud-based PostgreSQL service
2. Create a new database for the SCIM server: `createdb scimdb`
3. Configure your connection in the `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database
   ```
4. The database schema will be automatically created when the server starts

### Local Development
For local development:
- Install PostgreSQL locally
- Update the `.env` file with your local PostgreSQL credentials
- Run the server: `node SCIMServer.js`
- Tables will be created automatically on first run

### Heroku Deployment
For Heroku deployment:
1. Add the PostgreSQL add-on:
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```
2. The `DATABASE_URL` will be automatically set by Heroku
3. Deploy your app as usual

## PostgreSQL Database Connection
The server now exclusively uses PostgreSQL for data storage:
- All mock/file-based databases have been removed
- The server will fail to start if PostgreSQL connection fails
- SSL certificate validation can be configured for security

### Setting Up PostgreSQL Connection
1. Configure your connection in the `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database
   ```

2. If using SSL with self-signed certificates, add:
   ```
   REJECT_UNAUTHORIZED=false
   ```

3. If you have a CA certificate, add:
   ```
   SSL_CA_CERT=your_certificate_content_here
   ```

### Testing PostgreSQL Connection
Before starting the server, you can test your PostgreSQL connection:

```bash
node testDBConnection.js
```

This test script will:
- Verify connection to the database
- Test query functionality
- Check if SCIM tables exist
- Provide troubleshooting information if connection fails

### Troubleshooting Database Connection
If you encounter connection issues:

1. **Self-signed Certificate Errors**:
   - Set `REJECT_UNAUTHORIZED=false` in your `.env` file
   - This is common when using cloud PostgreSQL instances

2. **Connection Refused**:
   - Check if your database is running
   - Verify network access and firewall settings

3. **Authentication Failed**:
   - Verify username and password in your DATABASE_URL
   - Check that the user has proper permissions

4. **Database Name Issues**:
   - Ensure the database exists on the server
   - Create it manually if needed: `CREATE DATABASE yourdbname;`

# Deployment

## Heroku Deployment with PostgreSQL

### Setting Up Heroku
1. Install the Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```
3. Add PostgreSQL add-on:
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```
4. Configure SSL for the database (for self-signed certificates):
   ```bash
   heroku config:set REJECT_UNAUTHORIZED=false
   heroku config:set NODE_ENV=production
   ```

### Deploying to Heroku
1. Push your code to Heroku:
   ```bash
   git push heroku master
   ```
2. The database schema will be automatically created on first startup

### Monitoring the Database
1. View database connection info:
   ```bash
   heroku pg:info
   ```
2. Access the PostgreSQL database directly:
   ```bash
   heroku pg:psql
   ```
3. View the tables:
   ```sql
   \dt
   ```
4. Check users in the database:
   ```sql
   SELECT * FROM "Users";
   ```
5. Check groups in the database:
   ```sql
   SELECT * FROM "Groups";
   ```

### Troubleshooting Heroku Deployment
1. View logs to diagnose issues:
   ```bash
   heroku logs --tail
   ```
2. Restart the app if needed:
   ```bash
   heroku restart
   ```
3. Run database connection test:
   ```bash
   heroku run node testDBConnection.js
   ```

## Local Development
For local development:
1. Install PostgreSQL locally
2. Create a database: `createdb scimdb`
3. Configure your `.env` file:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scimdb
   NODE_ENV=development
   ```
4. Run the server:
   ```bash
   node SCIMServer.js
   ```

# Important Note for Deployment

Before deploying to production, make sure to update your `.env` file with the correct PostgreSQL connection string:

```
# For cloud database (like Heroku or OVH)
DATABASE_URL=postgres://username:password@hostname:port/database?sslmode=require
REJECT_UNAUTHORIZED=false  # Only if using self-signed certificates
NODE_ENV=production
```

If your deployment is failing with database connection errors, run the database test:

```bash
# Locally
npm run test:db

# On Heroku
heroku run npm run test:db
```

This will provide detailed information about your database connection.

# Handling Database Permission Issues

If you encounter a "permission denied for schema public" error, your database user lacks permissions to create tables. To resolve this:

## Option 1: Create tables manually

1. Connect to your PostgreSQL database using your provider's SQL interface
2. Run the SQL script in `database-setup.sql` to create the required tables

```bash
# If you have psql access, you can run:
psql -U yourusername -d yourdatabase -f database-setup.sql
```

Once the tables are created, the application will detect them and won't try to create them again.

## Option 2: Request elevated permissions

Contact your database provider to grant CREATE TABLE permissions to your database user.

## Option 3: Use a different schema

Modify `PostgresDatabase.js` to use a schema where you have permissions:

```javascript
// Example of using a custom schema
await client.query(`
    CREATE TABLE IF NOT EXISTS "your_schema"."Users" (
        ...
    )
`);
```
