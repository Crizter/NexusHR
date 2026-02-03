`use strict`

// export variables 
export const SERVER_PORT=`3001`
export const SERVER_URL=`http://localhost:` ; 

// hr portal roles for role based access control 
export  const ROLES = Object.freeze({
    super_admin: "super_admin", 
    hr_manager: "hr_manager", 
    employee : 'employee', 
}) ; 

// create a structure for permissions 
export const PERMISSIONS =Object.freeze( { 
   ADMIN_VIEW: 'admin_view', 
   VIEW_RECORD: 'view_record', 
   DELETE_RECORD: 'delete_record', 
   EDIT_RECORD: 'edit_record',
   PAYROLL_RECORD: 'payroll_record', 
   LEAVE_APPROVE: 'leave_approve', 
   CLEAR_DIRECTORY: 'clear_directory' ,// deletes the entire records 
   ADD_ATTENDANCE : 'add_attendance',
   ADD_PROFILE: 'add_profile',
   APPLY_LEAVE: 'apply_leave', // employee & hr both can apply 
   UPDATE_LEAVE: 'update_leave',  // only for hr 
   CANCEL_LEAVE : 'cancel_leave', //  for employee and hr 
}) ;

// export the perms of each roles 
export const ROLE_PERMISSIONS = {
    [ROLES.super_admin] : Object.values(PERMISSIONS), 
    [ROLES.hr_manager] : [PERMISSIONS.APPLY_LEAVE,PERMISSIONS.UPDATE_LEAVE,PERMISSIONS.CANCEL_LEAVE, PERMISSIONS.ADD_ATTENDANCE, PERMISSIONS.VIEW_RECORD, PERMISSIONS.DELETE_RECORD, PERMISSIONS.EDIT_RECORD, PERMISSIONS.PAYROLL_RECORD, PERMISSIONS.LEAVE_APPROVE] , 
    [ROLES.employee] : [PERMISSIONS.APPLY_LEAVE,PERMISSIONS.CANCEL_LEAVE, PERMISSIONS.VIEW_RECORD, PERMISSIONS.ADD_ATTENDANCE, PERMISSIONS.ADD_PROFILE]
};

// leaves type 
export const LEAVE_TYPES = Object.freeze( { 
    CASUAL_LEAVE : 'casual_leave',
    SICK_LEAVE : 'sick_leave',
    OPTIONAL_LEAVE: 'optional_leave',
    NOPAY_LEAVE : 'nopay_leave',
});

export const LEAVE_STATUS = Object.freeze({
    PENDING : 'pending', 
    APPROVED: 'approved', 
    REJECTED: 'rejected', 
    CANCELLED: 'cancelled',
}) ; 

// setup department 
export const DEPARTMENTS = Object.freeze([
        { deptId: "DEP-001", deptName: "Sales" },
            { deptId: "DEP-002", deptName: "Tech" },
            { deptId: "DEP-003", deptName: "Operations" },
            { deptId: "DEP-004", deptName: "Support" }
]);