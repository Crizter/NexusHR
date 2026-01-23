<!-- USERS  -->

{
  id: "uuid-string",
  identity: {
    firstName: "string",
    lastName: "string", 
    contactNumber: "string",
    address: { city: "string" }
  },
  role: "hr_manager" | "employee" | "super_admin",
  department: { 
    deptId: "DEP-001", 
    deptName: "Operations" 
  },
  email: "string@domain.com",
  isDeleted: boolean,
  attendance: {
    status: "active" | "inactive",
    lastLogin: timestamp,
    logs: []
  },
  skills: ["array", "of", "strings"],
  financial: {
    baseSalary: number,
    currency: "USD",
    taxBrackets: "tier_1" | "tier_2",
    bankDetail: { 
      bankName: "string", 
      accountNumber: "string" 
    }
  },
  createdAt?: timestamp,
  lastUpdated?: timestamp
}

<!-- // Indexes:
// - roleIndex: role (non-unique)
// - emailIndex: email (unique)
// - deptIndex: department (non-unique) -->

<!-- CREDENTIALS  -->
{
  email: "string@domain.com",  // Primary key
  password: "string",
  userId: "string"  // References users.id
}

<!-- // Indexes:
// - emailIndex: email -->

<!-- SYNC QUEUE  -->

{
  idemPotencyKey: "uuid-string",  // Primary key
  operationType: "UPDATE_EMPLOYEE" | "ADD_EMPLOYEE_WITH_CREDENTIALS",
  data: any,  // Employee data, credentials, or combined object
  timeStamp: timestamp
}

<!-- DEPARTMENT  -->
{
  deptId: "DEP-001",  // Primary key
  deptName: "Operations"
}

<!-- LEAVE REQUESTS  -->
{
  requestId: "string",  // Primary key
  // Other fields not defined in your code - you'll need to specify
  status: "string",     // Has index
  employeeId: "string"  // Has index
}

<!-- // Indexes: -->
<!-- // - statusIndex: status (non-unique) -->
<!-- // - employeeIndex: employeeId (non-unique) -->


<!-- MESSAGES  -->

{
  messageId: "string",      // Primary key
  conversationId: "string", // Has index
  // Other fields not defined in your code - you'll need to specify
}

<!-- // Indexes:
// - conversationIndex: conversationId (non-unique) -->


{
  payrollId: "string",  // Primary key
  userId: "string",     // References users.id, has unique index
  baseSalary: number,
  currency: "string",
  taxBrackets: "string",
  bankDetails: {
    bankName: "string",
    accountNumber: "string"
  },
  payrollHistory: [
    {
      id: "string",
      month: "string",
      generatedAt: timestamp,
      calculations: {
        grossPay: number,
        taxDeduct: number,
        netPay: number
      }
    }
  ],
  salarySlip_Blob: "binaryPdf"
}
<!-- 
// Indexes:
// - userIndex: userId (unique) -->