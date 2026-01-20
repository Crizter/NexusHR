`use strict`
// hr portal roles for role based access control 
export  const ROLES = {
    SUPER_ADMIN: "superadmin", 
    HR_MANAGER: "hr_manager", 
    EMPLOYEE : 'employee', 
} ; 


// create a structure for permissions 
export const PERMISSIONS = { 
   ADMIN_VIEW: 'admin_view', 
   VIEW_RECORD: 'view_record', 
   DELETE_RECORD: 'delete_record', 
   EDIT_RECORD: 'edit_record',
   PAYROLL_RECORD: 'payroll_record', 
   LEAVE_APPROVE: 'leave_approve', 
   CLEAR_DIRECTORY: 'clear_directory' // deletes the entire records 
} ;


// export the perms of each roles 

export const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN] : Object.values(PERMISSIONS), 
    [ROLES.HR_MANAGER] : [ PERMISSIONS.VIEW_RECORD, PERMISSIONS.DELETE_RECORD, PERMISSIONS.EDIT_RECORD, PERMISSIONS.PAYROLL_RECORD, PERMISSIONS.LEAVE_APPROVE] , 
    [ROLES.EMPLOYEE] : [PERMISSIONS.VIEW_RECORD],
}

