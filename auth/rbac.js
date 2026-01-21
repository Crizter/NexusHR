// setting up the rbac context 
import { ROLE_PERMISSIONS } from "../config.js";
// pass the user object
// check the role and its perms 
export function checkPermission(userRole, action) { 
    const permissions = ROLE_PERMISSIONS[userRole] || [] ;
    return permissions.includes(action) ; 

}

// usage example 
/* 
    checkPermission('employee', delete_record) - this will return false 
*/
