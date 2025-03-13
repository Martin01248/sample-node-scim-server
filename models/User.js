/** Copyright © 2016-2018, Okta, Inc.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

class User  {
    static parseFromSCIMResource(userJsonData) {
        let user = {
            "active": false,
            "userName": "",
            "givenName": "",
            "middleName": "",
            "familyName": "",
            "email": "",
            "groups": []
        };

        // Safely access properties with fallbacks to default values
        user["active"] = userJsonData["active"] !== undefined ? userJsonData["active"] : false;
        user["userName"] = userJsonData["userName"] || "";
        
        // Safely access nested name properties
        const name = userJsonData["name"] || {};
        user["givenName"] = name["givenName"] || "";
        user["middleName"] = name["middleName"] || "";
        user["familyName"] = name["familyName"] || "";
        
        // Safely access email
        const emails = userJsonData["emails"] || [];
        user["email"] = emails.length > 0 && emails[0]["value"] ? emails[0]["value"] : "";

        // Safely handle groups
        let groups = [];
        if (userJsonData["groups"] && Array.isArray(userJsonData["groups"])) {
            for (let i = 0; i < userJsonData["groups"].length; i++) {
                if (userJsonData["groups"][i]) {
                    groups.push(this.parseGroups(userJsonData["groups"][i]));
                }
            }
        }
        user["groups"] = groups;

        return user;
    }

    static parseGroups(userGroupJsonData) {
        if (!userGroupJsonData) {
            return { value: null, ref: null, display: null };
        }
        
        let group = {
            "value": null,
            "ref": null,
            "display": null
        };

        // Microsoft Entra ID might send 'value' for group ID
        group["value"] = userGroupJsonData["value"] || null;
        
        // Handle both ref types: $ref (standard) and ref (sometimes used)
        group["ref"] = userGroupJsonData["$ref"] || userGroupJsonData["ref"] || null;
        
        // Handle display field for the group name
        group["display"] = userGroupJsonData["display"] || userGroupJsonData["displayName"] || null;
        
        // Log the parsed group for debugging
        if (process.env.NODE_ENV !== 'production') {
            const out = require('../core/Logs');
            out.log("DEBUG", "User.parseGroups", "Parsed group: " + JSON.stringify(group) + " from " + JSON.stringify(userGroupJsonData));
        }

        return group;
    }

    static createGroup(groupId, displayName) {
        let group = {
            "value": null,
            "$ref": null,
            "display": null
        };

        group["value"] = groupId || null;
        group["$ref"] = groupId ? "../Groups/" + groupId : null;
        group["display"] = displayName || null;

        return group;
    }
}

module.exports = User;