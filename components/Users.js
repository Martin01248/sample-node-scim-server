let url = require('url');
let scimCore = require('../core/SCIMCore');
let db = require('../core/MockDatabase');
let user = require('../models/User');
let out = require('../core/Logs');

class Users {
    static listUsers(req, res) {
        out.log("INFO", "Users.listUsers", "Got request: " + req.url);

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;

        let query = urlParts.query;
        let startIndex = query["startIndex"];
        let count = query["count"];
        let filter = query["filter"];

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

        let reqUrl = req.url;

        let userId = req.params.userId;

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

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;
        let requestBody = "";

        req.on('data', function (data) {
            try {
                requestBody += data;
                let userJsonData;
                
                try {
                    userJsonData = JSON.parse(requestBody);
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

        req.on("data", function (data) {
            try {
                requestBody += data;
                let jsonReqBody;
                
                try {
                    jsonReqBody = JSON.parse(requestBody);
                    out.logToFile(requestBody);
                } catch (jsonError) {
                    out.log("ERROR", "Users.patchUser", "Failed to parse request JSON: " + jsonError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid JSON format", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }
                
                if (!jsonReqBody.Operations || !Array.isArray(jsonReqBody.Operations) || jsonReqBody.Operations.length === 0) {
                    out.log("ERROR", "Users.patchUser", "Missing or invalid Operations array");
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Missing or invalid Operations array", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }

                const operation = jsonReqBody.Operations[0].op ? jsonReqBody.Operations[0].op.toLowerCase() : '';
                const value = jsonReqBody.Operations[0].value;
                
                // Handle different operation types (case-insensitive)
                if (operation === "replace" || operation === "add") {
                    if (!value) {
                        out.log("ERROR", "Users.patchUser", "Missing value for operation: " + operation);
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                        let errorResponse = scimCore.createSCIMError("Missing value for operation", "400");
                        res.end(JSON.stringify(errorResponse));
                        return;
                    }
                    
                    const attribute = Object.keys(value)[0];
                    const attributeValue = value[attribute];
                    
                    db.patchUser(attribute, attributeValue, userId, reqUrl, function (result) {
                        if (result["status"] !== undefined) {
                            if (result["status"] === "400") {
                                res.writeHead(400, {"Content-Type": "application/scim+json"});
                            } else if (result["status"] === "409") {
                                res.writeHead(409, {"Content-Type": "application/scim+json"});
                            } else if (result["status"] === "404") {
                                res.writeHead(404, {"Content-Type": "application/scim+json"});
                            }

                            out.log("ERROR", "Users.patchUser", "Encountered error " + result["status"] + ": " + result["detail"]);
                        } else {
                            res.writeHead(200, {"Content-Type": "application/scim+json"});
                        }

                        let jsonResult = JSON.stringify(result);
                        out.logToFile(jsonResult);

                        res.end(jsonResult);
                    });
                } else if (operation === "remove") {
                    // Handle remove operation
                    out.log("WARN", "Users.patchUser", "Remove operation not fully implemented");
                    
                    // For now, just return success with the current user state
                    db.getUser(userId, reqUrl, function (result) {
                        if (result["status"] !== undefined) {
                            res.writeHead(result["status"], {"Content-Type": "application/scim+json"});
                            out.log("ERROR", "Users.patchUser", "Encountered error " + result["status"] + ": " + result["detail"]);
                        } else {
                            res.writeHead(200, {"Content-Type": "application/scim+json"});
                        }
                        
                        let jsonResult = JSON.stringify(result);
                        out.logToFile(jsonResult);
                        res.end(jsonResult);
                    });
                } else {
                    out.log("WARN", "Users.patchUser", "The requested operation, " + operation + ", is not supported!");

                    let scimError = scimCore.createSCIMError("Operation Not Supported", "403");
                    res.writeHead(403, {"Content-Type": "application/scim+json"});

                    let jsonResult = JSON.stringify(scimError);
                    out.logToFile(jsonResult);

                    res.end(jsonResult);
                }
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
}

module.exports = Users;