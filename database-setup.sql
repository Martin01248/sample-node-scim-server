-- Create Users table
CREATE TABLE IF NOT EXISTS "Users" (
    id VARCHAR(255) PRIMARY KEY,
    active BOOLEAN,
    "userName" VARCHAR(255) UNIQUE,
    "givenName" VARCHAR(255),
    "middleName" VARCHAR(255),
    "familyName" VARCHAR(255),
    email VARCHAR(255)
);

-- Create Groups table 
CREATE TABLE IF NOT EXISTS "Groups" (
    id VARCHAR(255) PRIMARY KEY,
    "displayName" VARCHAR(255) UNIQUE
);

-- Create GroupMemberships table
CREATE TABLE IF NOT EXISTS "GroupMemberships" (
    id VARCHAR(255) PRIMARY KEY,
    "groupId" VARCHAR(255) REFERENCES "Groups"(id) ON DELETE CASCADE,
    "userId" VARCHAR(255) REFERENCES "Users"(id) ON DELETE CASCADE,
    UNIQUE("groupId", "userId")
);

-- Insert sample data (optional - uncomment if you want sample data)
/*
-- Sample users
INSERT INTO "Users" (id, active, "userName", "givenName", "middleName", "familyName", email)
VALUES 
('cf87ed10-f8e8-11ee-a704-0242ac120002', true, 'john.doe@example.com', 'John', '', 'Doe', 'john.doe@example.com'),
('d50a8a02-f8e8-11ee-a704-0242ac120002', true, 'jane.smith@example.com', 'Jane', '', 'Smith', 'jane.smith@example.com');

-- Sample groups
INSERT INTO "Groups" (id, "displayName")
VALUES 
('db39b0e8-f8e8-11ee-a704-0242ac120002', 'Administrators'),
('df3dc75a-f8e8-11ee-a704-0242ac120002', 'Users');

-- Sample memberships
INSERT INTO "GroupMemberships" (id, "groupId", "userId")
VALUES 
('e36db1b0-f8e8-11ee-a704-0242ac120002', 'db39b0e8-f8e8-11ee-a704-0242ac120002', 'cf87ed10-f8e8-11ee-a704-0242ac120002'),
('e775bb30-f8e8-11ee-a704-0242ac120002', 'df3dc75a-f8e8-11ee-a704-0242ac120002', 'cf87ed10-f8e8-11ee-a704-0242ac120002'),
('eac31d4e-f8e8-11ee-a704-0242ac120002', 'df3dc75a-f8e8-11ee-a704-0242ac120002', 'd50a8a02-f8e8-11ee-a704-0242ac120002');
*/ 