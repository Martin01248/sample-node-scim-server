let url = require('url');
let scimCore = require('../core/SCIMCore');
let db = require('../core/MockDatabase');
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

        req.on("data", function (data) {
            try {
                requestBody += data;
                let jsonReqBody;
                
                try {
                    jsonReqBody = JSON.parse(requestBody);
                    out.logToFile(requestBody);
                } catch (jsonError) {
                    out.log("ERROR", "Groups.patchGroup", "Failed to parse request JSON: " + jsonError.message);
                    res.writeHead(400, {"Content-Type": "application/scim+json"});
                    let errorResponse = scimCore.createSCIMError("Invalid JSON format", "400");
                    res.end(JSON.stringify(errorResponse));
                    return;
                }
                
                if (!jsonReqBody.Operations || !Array.isArray(jsonReqBody.Operations) || jsonReqBody.Operations.length === 0) {
                    out.log("ERROR", "Groups.patchGroup", "Missing or invalid Operations array");
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
                        out.log("ERROR", "Groups.patchGroup", "Missing value for operation: " + operation);
                        res.writeHead(400, {"Content-Type": "application/scim+json"});
                        let errorResponse = scimCore.createSCIMError("Missing value for operation", "400");
                        res.end(JSON.stringify(errorResponse));
                        return;
                    }
                    
                    const attribute = Object.keys(value)[0];
                    const attributeValue = value[attribute];
                    
                    db.patchGroup(attribute, attributeValue, groupId, reqUrl, function (result) {
                        if (result["status"] !== undefined) {
                            if (result["status"] === "400") {
                                res.writeHead(400, {"Content-Type": "application/scim+json"});
                            } else if (result["status"] === "409") {
                                res.writeHead(409, {"Content-Type": "application/scim+json"});
                            } else if (result["status"] === "404") {
                                res.writeHead(404, {"Content-Type": "application/scim+json"});
                            }

                            out.log("ERROR", "Groups.patchGroup", "Encountered error " + result["status"] + ": " + result["detail"]);
                        } else {
                            res.writeHead(200, {"Content-Type": "application/scim+json"});
                        }

                        let jsonResult = JSON.stringify(result);
                        out.logToFile(jsonResult);

                        res.end(jsonResult);
                    });
                } else if (operation === "remove") {
                    // Handle remove operation
                    out.log("WARN", "Groups.patchGroup", "Remove operation not fully implemented");
                    
                    // For now, just return success with the current group state
                    db.getGroup(groupId, reqUrl, function (result) {
                        if (result["status"] !== undefined) {
                            res.writeHead(result["status"], {"Content-Type": "application/scim+json"});
                            out.log("ERROR", "Groups.patchGroup", "Encountered error " + result["status"] + ": " + result["detail"]);
                        } else {
                            res.writeHead(200, {"Content-Type": "application/scim+json"});
                        }
                        
                        let jsonResult = JSON.stringify(result);
                        out.logToFile(jsonResult);
                        res.end(jsonResult);
                    });
                } else {
                    out.log("WARN", "Groups.patchGroup", "The requested operation, " + operation + ", is not supported!");

                    let scimError = scimCore.createSCIMError("Operation Not Supported", "403");
                    res.writeHead(403, {"Content-Type": "application/scim+json"});

                    let jsonResult = JSON.stringify(scimError);
                    out.logToFile(jsonResult);

                    res.end(jsonResult);
                }
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