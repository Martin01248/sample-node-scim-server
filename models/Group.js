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

class Group  {
    static parseFromSCIMResource(groupJsonData) {
        if (!groupJsonData) {
            return {
                "id": null,
                "displayName": null,
                "members": []
            };
        }
        
        let group = {
            "id": null,
            "displayName": null,
            "members": []
        };

        group["id"] = groupJsonData["id"] || null;
        group["displayName"] = groupJsonData["displayName"] || null;

        let members = [];

        // Safely handle members array
        if (groupJsonData["members"] && Array.isArray(groupJsonData["members"])) {
            for (let i = 0; i < groupJsonData["members"].length; i++) {
                if (groupJsonData["members"][i]) {
                    members.push(this.parseMemberships(groupJsonData["members"][i]));
                }
            }
        }

        group["members"] = members;

        return group;
    }

    static parseMemberships(groupMembersJsonData) {
        if (!groupMembersJsonData) {
            return { value: null, ref: null, display: null };
        }
        
        let member = {
            "value": null,
            "ref": null,
            "display": null
        };

        member["value"] = groupMembersJsonData["value"] || null;
        member["ref"] = groupMembersJsonData["$ref"] || null;
        member["display"] = groupMembersJsonData["display"] || null;

        return member;
    }

    static createUser(userId, displayName) {
        let user = {
            "value": null,
            "$ref": null,
            "display": null
        };

        user["value"] = userId || null;
        user["$ref"] = userId ? "../Users/" + userId : null;
        user["display"] = displayName || null;

        return user;
    }
}

module.exports = Group;