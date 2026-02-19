export const ROLES = {
  super_admin: "super_admin",
  hr_manager: "hr_manager", 
  employee: "employee",
} as const;


export const PERMISSIONS = {
  ADMIN_VIEW: 'admin_view',
  VIEW_RECORD: 'view_record', 
  DELETE_RECORD: 'delete_record',
  EDIT_RECORD: 'edit_record',
  PAYROLL_RECORD: 'payroll_record',
  LEAVE_APPROVE: 'leave_approve',
  CLEAR_DIRECTORY: 'clear_directory',
  ADD_ATTENDANCE: 'add_attendance',
  ADD_PROFILE: 'add_profile', 
  APPLY_LEAVE: 'apply_leave',
  UPDATE_LEAVE: 'update_leave',
  CANCEL_LEAVE: 'cancel_leave',
} as const;


export const ROLE_PERMISSIONS = {
  [ROLES.super_admin]: Object.values(PERMISSIONS),
  [ROLES.hr_manager]: [
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.UPDATE_LEAVE, 
    PERMISSIONS.CANCEL_LEAVE,
    PERMISSIONS.ADD_ATTENDANCE,
    PERMISSIONS.VIEW_RECORD,
    PERMISSIONS.DELETE_RECORD,
    PERMISSIONS.EDIT_RECORD,
    PERMISSIONS.PAYROLL_RECORD,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.ADD_PROFILE,
  ],
  [ROLES.employee]: [
    PERMISSIONS.APPLY_LEAVE,
    PERMISSIONS.CANCEL_LEAVE,
    PERMISSIONS.VIEW_RECORD,
    PERMISSIONS.ADD_ATTENDANCE,    
  ]
} as const;


export type Role = typeof ROLES[keyof typeof ROLES] ; 
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS] ; 