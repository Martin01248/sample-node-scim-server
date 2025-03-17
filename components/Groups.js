let url = require('url');
let scimCore = require('../core/SCIMCore');
let dbFactory = require('../core/DatabaseFactory');
let group = require('../models/Group');
let out = require('../core/Logs');

class Groups {
    static listGroups(req, res) {
        out.log("INFO", "Groups.listGroups", "Got request: " + req.url);

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

            db.getFilteredGroups(attributeName, attributeValue, startIndex, count, reqUrl, function (result) {
                if (result["status"] !== undefined) {
                    if (result["status"] === "400") {
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                    } else if (result["status"] === "409") {
                        res.writeHead(409, {"Content-Type": "application/scim+json"});
                    }

                    out.log("ERROR", "Groups.listGroups", "Encountered error " + result["status"] + ": " + result["detail"]);
                } else {
                    res.writeHead(200, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);

                res.end(jsonResult);
            });
        } else {
            db.getAllGroups(startIndex, count, reqUrl, function (result) {
                if (result["status"] !== undefined) {
                    if (result["status"] === "400") {
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                    } else if (result["status"] === "409") {
                        res.writeHead(409, {"Content-Type": "application/scim+json"});
                    }

                    out.log("ERROR", "Groups.listGroups", "Encountered error " + result["status"] + ": " + result["detail"]);
                } else {
                    res.writeHead(200, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);

                res.end(jsonResult);
            });
        }
    }

    static getGroup(req, res) {
        out.log("INFO", "Groups.getGroup", "Got request: " + req.url);

        let reqUrl = req.url;

        let groupId = req.params.groupId;

        // Get database instance
        const db = dbFactory.getDatabase();

        db.getGroup(groupId, reqUrl, function (result) {
            if (result["status"] !== undefined) {
                if (result["status"] === "400") {
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                } else if (result["status"] === "409") {
                    res.writeHead(409, {"Content-Type": "application/scim+json"});
                }

                out.log("ERROR", "Groups.getGroup", "Encountered error " + result["status"] + ": " + result["detail"]);
            } else {
                res.writeHead(200, {"Content-Type": "application/scim+json"});
            }

            let jsonResult = JSON.stringify(result);
            out.logToFile(jsonResult);

            res.end(jsonResult);
        });
    }

    static createGroup(req, res) {
        out.log("INFO", "Groups.createGroup", "Got request: " + req.url);

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;
        let requestBody = "";

        // Get database instance
        const db = dbFactory.getDatabase();

        req.on('data', function (data) {
            try {
                requestBody += data;
                let groupJsonData;
                
                try {
                    groupJsonData = JSON.parse(requestBody);
                    out.logToFile(requestBody);
                } catch (jsonError) {
                    out.log("ERROR", "Groups.createGroup", "Failed to parse request JSON: " + jsonError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid JSON format", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }

                try {
                    out.log("INFO", "Groups.createGroup", "Parsing group data");
                    let groupModel = group.parseFromSCIMResource(groupJsonData);
                    out.log("INFO", "Groups.createGroup", "Creating group: " + JSON.stringify(groupModel));
                    
                    db.createGroup(groupModel, reqUrl, function (result) {
                        if (result["status"] !== undefined) {
                            if (result["status"] === "400") {
                                res.writeHead(400, {"Content-Type": "application/scim+json"});
                            } else if (result["status"] === "409") {
                                res.writeHead(409, {"Content-Type": "application/scim+json"});
                            }

                            out.log("ERROR", "Groups.createGroup", "Encountered error " + result["status"] + ": " + result["detail"]);
                        } else {
                            res.writeHead(201, {"Content-Type": "application/scim+json"});
                        }

                        let jsonResult = JSON.stringify(result);
                        out.logToFile(jsonResult);

                        res.end(jsonResult);
                    });
                } catch (parseError) {
                    out.log("ERROR", "Groups.createGroup", "Failed to process group data: " + parseError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid SCIM group data: " + parseError.message, "400");
                    res.end(JSON.stringify(errorResponse));
                }
            } catch (error) {
                out.log("ERROR", "Groups.createGroup", "Unexpected error: " + error.message);
                res.writeHead(500, {"Content-Type": "application/scim+json"});
                let errorResponse = scimCore.createSCIMError("Internal server error", "500");
                res.end(JSON.stringify(errorResponse));
            }
        });

        req.on('error', function(error) {
            out.log("ERROR", "Groups.createGroup", "Request error: " + error.message);
            res.writeHead(500, {"Content-Type": "application/scim+json"});
            let errorResponse = scimCore.createSCIMError("Request handling error", "500");
            res.end(JSON.stringify(errorResponse));
        });
    }

    static patchGroup(req, res) {
        out.log("INFO", "Groups.patchGroup", "Got request: " + req.url);

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;

        let groupId = req.params.groupId;

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
                    out.log("DEBUG", "Groups.patchGroup", "Received JSON body: " + JSON.stringify(jsonReqBody));
                } catch (jsonError) {
                    out.log("ERROR", "Groups.patchGroup", "Failed to parse request JSON: " + jsonError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid JSON format", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }
                
                // Pass the operations to the database
                db.patchGroup(jsonReqBody, groupId, reqUrl, function(result) {
                    // Handle response
                    if (result && result.schemas && result.schemas.includes("urn:ietf:params:scim:api:messages:2.0:Error")) {
                        // Error response
                        const statusCode = result.status || 500;
                        res.writeHead(parseInt(statusCode), {"Content-Type": "application/scim+json"});
                        out.log("ERROR", "Groups.patchGroup", `Error: ${result.detail || "Unknown error"}`);
                    } else {
                        // Success response
                        res.writeHead(200, {"Content-Type": "application/scim+json"});
                        out.log("INFO", "Groups.patchGroup", "Group updated successfully");
                    }
                    
                    const responseJson = JSON.stringify(result);
                    out.log("DEBUG", "Groups.patchGroup", "Sending response: " + responseJson);
                    res.end(responseJson);
                });
            } catch (error) {
                out.log("ERROR", "Groups.patchGroup", "Unexpected error: " + error.message);
                res.writeHead(500, {"Content-Type": "application/scim+json"});
                let errorResponse = scimCore.createSCIMError("Internal server error", "500");
                res.end(JSON.stringify(errorResponse));
            }
        });

        req.on('error', function(error) {
            out.log("ERROR", "Groups.patchGroup", "Request error: " + error.message);
            res.writeHead(500, {"Content-Type": "application/scim+json"});
            let errorResponse = scimCore.createSCIMError("Request handling error", "500");
            res.end(JSON.stringify(errorResponse));
        });
    }

    static updateGroup(req, res) {
        out.log("INFO", "Groups.updateGroup", "Got request: " + req.url);

        let urlParts = url.parse(req.url, true);
        let reqUrl = urlParts.pathname;

        let groupId = req.params.groupId;

        let requestBody = "";

        // Get database instance
        const db = dbFactory.getDatabase();

        req.on("data", function (data) {
            requestBody += data;
            let groupJsonData = JSON.parse(requestBody);

            out.logToFile(requestBody);

            let groupModel = group.parseFromSCIMResource(groupJsonData);

            db.updateGroup(groupModel, groupId, reqUrl, function (result) {
                if (result["status"] !== undefined) {
                    if (result["status"] === "400") {
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                    } else if (result["status"] === "409") {
                        res.writeHead(409, {"Content-Type": "application/scim+json"});
                    }

                    out.log("ERROR", "Groups.updateGroup", "Encountered error " + result["status"] + ": " + result["detail"]);
                } else {
                    res.writeHead(200, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);

                res.end(jsonResult);
            });
        });
    }

    static deleteGroup(req, res) {
        out.log("INFO", "Groups.deleteGroup", "Got request: " + req.url);

        let groupId = req.params.groupId;

        // Get database instance
        const db = dbFactory.getDatabase();

        db.deleteGroup(groupId, function(result) {
            if (result && result["status"] !== undefined) {
                if (result["status"] === "400") {
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                } else if (result["status"] === "404") {
                    res.writeHead(404, {"Content-Type": "application/scim+json"});
                }

                let jsonResult = JSON.stringify(result);
                out.logToFile(jsonResult);
                out.log("ERROR", "Groups.deleteGroup", "Encountered error " + result["status"] + ": " + result["detail"]);
                
                res.end(jsonResult);
            } else {
                res.writeHead(204); // No content response for successful deletion
                res.end();
            }
        });
    }
}

module.exports = Groups;