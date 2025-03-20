let url = require('url');
let scimCore = require('../core/SCIMCore');
let dbFactory = require('../core/DatabaseFactory');
let user = require('../models/User');
let out = require('../core/Logs');

class Users {
    static listUsers(req, res) {
        out.log("INFO", "Users.listUsers", "Got request: " + req.url);
        Users.logAuthHeaders(req, "Users.listUsers");

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;

        let query = urlParts.query;
        let startIndex = query["startIndex"];
        let count = query["count"];
        let filter = query["filter"];

        // Get database instance
        const db = dbFactory.getDatabase();

        if (filter !== undefined) {
            let attributeName = String(filter.split("eq")[0]).trim();
            let attributeValue = String(filter.split("eq")[1]).trim();

            db.getFilteredUsers(attributeName, attributeValue, startIndex, count, reqUrl, function (result) {
                if (result["status"] !== undefined) {
                    if (result["status"] === "400") {
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                    } else if (result["status"] === "409") {
                        res.writeHead(409, {"Content-Type": "application/scim+json"});
                    }

                    out.log("ERROR", "Users.listUsers", "Encountered error " + result["status"] + ": " + result["detail"]);
                } else {
                    res.writeHead(200, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);

                res.end(jsonResult);
            });
        } else {
            db.getAllUsers(startIndex, count, reqUrl, function (result) {
                if (result["status"] !== undefined) {
                    if (result["status"] === "400") {
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                    } else if (result["status"] === "409") {
                        res.writeHead(409, {"Content-Type": "application/scim+json"});
                    }

                    out.log("ERROR", "Users.listUsers", "Encountered error " + result["status"] + ": " + result["detail"]);
                } else {
                    res.writeHead(200, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);

                res.end(jsonResult);
            });
        }
    }

    static getUser(req, res) {
        out.log("INFO", "Users.getUser", "Got request: " + req.url);
        Users.logAuthHeaders(req, "Users.getUser");

        let reqUrl = req.url;

        let userId = req.params.userId;

        // Get database instance
        const db = dbFactory.getDatabase();

        db.getUser(userId, reqUrl, function (result) {
            if (result["status"] !== undefined) {
                if (result["status"] === "400") {
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                } else if (result["status"] === "409") {
                    res.writeHead(409, {"Content-Type": "application/scim+json"});
                }

                out.log("ERROR", "Users.listUsers", "Encountered error " + result["status"] + ": " + result["detail"]);
            } else {
                res.writeHead(200, {"Content-Type": "application/scim+json"});
            }

            let jsonResult = JSON.stringify(result);
            out.logToFile(jsonResult);

            res.end(jsonResult);
        });
    }

    static createUser(req, res) {
        out.log("INFO", "Users.createUser", "Got request: " + req.url);
        Users.logAuthHeaders(req, "Users.createUser");

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;
        let requestBody = "";

        // Get database instance
        const db = dbFactory.getDatabase();

        req.on('data', function (data) {
            try {
                requestBody += data;
                let userJsonData;
                
                try {
                    userJsonData = JSON.parse(requestBody);
                    
                    // Log the full request data for debugging
                    out.log("DEBUG", "Users.createUser", "Received data: " + JSON.stringify(userJsonData));
                    
                    // Specifically log groups data if present
                    if (userJsonData.groups) {
                        out.log("DEBUG", "Users.createUser", "Received groups: " + JSON.stringify(userJsonData.groups));
                    } else {
                        out.log("WARN", "Users.createUser", "No groups data in request");
                    }
                    
                    out.logToFile(requestBody);
                } catch (jsonError) {
                    out.log("ERROR", "Users.createUser", "Failed to parse request JSON: " + jsonError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid JSON format", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }

                try {
                    out.log("INFO", "Users.createUser", "Parsing user data");
                    let userModel = user.parseFromSCIMResource(userJsonData);
                    out.log("INFO", "Users.createUser", "Creating user: " + JSON.stringify(userModel));
                    
                    db.createUser(userModel, reqUrl, function (result) {
                        if (result["status"] !== undefined) {
                            if (result["status"] === "400") {
                                res.writeHead(400, {"Content-Type": "application/scim+json"});
                            } else if (result["status"] === "409") {
                                res.writeHead(409, {"Content-Type": "application/scim+json"});
                            }

                            out.log("ERROR", "Users.createUser", "Encountered error " + result["status"] + ": " + result["detail"]);
                        } else {
                            res.writeHead(201, {"Content-Type": "application/scim+json"});
                        }

                        let jsonResult = JSON.stringify(result);
                        out.logToFile(jsonResult);

                        res.end(jsonResult);
                    });
                } catch (parseError) {
                    out.log("ERROR", "Users.createUser", "Failed to process user data: " + parseError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid SCIM user data: " + parseError.message, "400");
                    res.end(JSON.stringify(errorResponse));
                }
            } catch (error) {
                out.log("ERROR", "Users.createUser", "Unexpected error: " + error.message);
                res.writeHead(500, {"Content-Type": "application/scim+json"});
                let errorResponse = scimCore.createSCIMError("Internal server error", "500");
                res.end(JSON.stringify(errorResponse));
            }
        });

        req.on('error', function(error) {
            out.log("ERROR", "Users.createUser", "Request error: " + error.message);
            res.writeHead(500, {"Content-Type": "application/scim+json"});
            let errorResponse = scimCore.createSCIMError("Request handling error", "500");
            res.end(JSON.stringify(errorResponse));
        });
    }

    static patchUser(req, res) {
        out.log("INFO", "Users.patchUser", "Got request: " + req.url);

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;

        let userId = req.params.userId;

        let requestBody = "";

        // Get database instance
        const db = dbFactory.getDatabase();

        req.on("data", function (data) {
            requestBody += data;
        });

        req.on("end", function() {
            try {
                let jsonReqBody;
                
                try {
                    jsonReqBody = JSON.parse(requestBody);
                    out.log("DEBUG", "Users.patchUser", "Received JSON body: " + JSON.stringify(jsonReqBody));
                } catch (jsonError) {
                    out.log("ERROR", "Users.patchUser", "Failed to parse request JSON: " + jsonError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid JSON format", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }
                
                // Pass the operations to the database
                db.patchUser(jsonReqBody, userId, reqUrl, function(result) {
                    // Handle response
                    if (result && result.schemas && result.schemas.includes("urn:ietf:params:scim:api:messages:2.0:Error")) {
                        // Error response
                        const statusCode = result.status || 500;
                        res.writeHead(parseInt(statusCode), {"Content-Type": "application/scim+json"});
                        out.log("ERROR", "Users.patchUser", `Error: ${result.detail || "Unknown error"}`);
                    } else {
                        // Success response
                        res.writeHead(200, {"Content-Type": "application/scim+json"});
                        out.log("INFO", "Users.patchUser", "User updated successfully");
                    }
                    
                    const responseJson = JSON.stringify(result);
                    out.log("DEBUG", "Users.patchUser", "Sending response: " + responseJson);
                    res.end(responseJson);
                });
            } catch (error) {
                out.log("ERROR", "Users.patchUser", "Unexpected error: " + error.message);
                res.writeHead(500, {"Content-Type": "application/scim+json"});
                let errorResponse = scimCore.createSCIMError("Internal server error", "500");
                res.end(JSON.stringify(errorResponse));
            }
        });

        req.on('error', function(error) {
            out.log("ERROR", "Users.patchUser", "Request error: " + error.message);
            res.writeHead(500, {"Content-Type": "application/scim+json"});
            let errorResponse = scimCore.createSCIMError("Request handling error", "500");
            res.end(JSON.stringify(errorResponse));
        });
    }

    static updateUser(req, res) {
        out.log("INFO", "Users.updateUser", "Got request: " + req.url);

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;

        let userId = req.params.userId;

        let requestBody = "";

        // Get database instance
        const db = dbFactory.getDatabase();

        req.on("data", function (data) {
            requestBody += data;
            let userJsonData = JSON.parse(requestBody);

            out.logToFile(requestBody);

            let userModel = user.parseFromSCIMResource(userJsonData);
            out.log("INFO", "Users.updateUser", "Updating user: " + JSON.stringify(userModel));
            db.updateUser(userModel, userId, reqUrl, function (result) {
                if (result["status"] !== undefined) {
                    if (result["status"] === "400") {
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                    } else if (result["status"] === "409") {
                        res.writeHead(409, {"Content-Type": "application/scim+json"});
                    }

                    out.log("ERROR", "Users.listUsers", "Encountered error " + result["status"] + ": " + result["detail"]);
                } else {
                    res.writeHead(200, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);

                res.end(jsonResult);
            });
        });
    }

    static deleteUser(req, res) {
        out.log("INFO", "Users.deleteUser", "Got request: " + req.url);

        let userId = req.params.userId;

        // Get database instance
        const db = dbFactory.getDatabase();

        db.deleteUser(userId, function(result) {
            if (result && result["status"] !== undefined) {
                if (result["status"] === "400") {
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                } else if (result["status"] === "404") {
                    res.writeHead(404, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);
                out.log("ERROR", "Users.deleteUser", "Encountered error " + result["status"] + ": " + result["detail"]);
                
                res.end(jsonResult);
            } else {
                res.writeHead(204); // No content response for successful deletion
                res.end();
            }
        });
    }

    static logAuthHeaders(req, action) {
        const auth = req.headers.authorization || 'No authorization provided';
        out.log("INFO", action, `request.headers.authorization: ${auth}`);

        //Users.logRequestHeaders(req, action);
    }

    static logRequestHeaders(req, action) {
        const headers = req.headers;
        const headerLog = [];
        
        for (const [key, value] of Object.entries(headers)) {
            // Mask sensitive headers like authorization
            if (key.toLowerCase() === 'authorization' || key.toLowerCase().includes('token')) {
                const maskedValue = value.slice(-4).padStart(value.length, '*');
                headerLog.push(`${key}: ${maskedValue}`);
            } else {
                headerLog.push(`${key}: ${value}`);
            }
        }
        
        out.log("INFO", action, headerLog.join('\n'));
    }
}

module.exports = Users;