//  organizations (The Tenants)
// Production Indexes: { slug: 1 } (Unique)
{
  _id: ObjectId,             // e.g., "65d4a..."
  name: String,              // "Nexus Tech"
  slug: String,              // "nexus-tech" (Unique, used for login URLs)
  subscription: {
    plan: String,            // "free" | "pro" | "enterprise"
    status: String,          // "active" | "past_due"
    maxUsers: Number
  },
  settings: {
    leavePolicy: {
      casualLeaves: Number,
      sickLeaves: Number
    },
    timezone: String
  },
  createdAt: Date
}


// users ( employees and hr )
// Production Indexes: * { orgId: 1, email: 1 } (Unique - An email can only exist once per company)

// { orgId: 1, departmentId: 1 } (Fast lookup for HR viewing a department)
{
  _id: ObjectId,
  orgId: ObjectId,           // THE TENANT LOCK (Ref: Organization)
  displayId: String,         // "EMP-001" (Human readable ID)
  email: String,             
  passwordHash: String,      // Hashed by bcrypt
  role: String,              // "super_admin" | "hr_manager" | "employee"
  departmentId: ObjectId,    // Ref: Department
  
  // Embedded Data (Doesn't grow infinitely)
  profile: {
    firstName: String,
    lastName: String,
    contactNumber: String,
    avatarUrl: String
  },
  financial: {
    baseSalary: Number,
    currency: String
  },
  
  // Denormalized Totals for fast dashboard loading
  leaveBalances: {
    casual: Number,
    sick: Number
  },
  
  isDeleted: Boolean,        // Soft Delete flag
  createdAt: Date,
  lastLogin: Date
}



// departments 
// Production Indexes: { orgId: 1, name: 1 }
{
  _id: ObjectId,
  orgId: ObjectId,           // THE TENANT LOCK
  name: String,              // "Engineering"
  managerId: ObjectId,       // Ref: User (Who heads this dept)
  createdAt: Date
}

// Production Indexes: { orgId: 1, name: 1 }



// leave_requests
// { orgId: 1, employeeId: 1, createdAt: -1 } 
// (For an employee's personal history)

// { orgId: 1, departmentId: 1, status: 1 } 
// (For HR filtering "Pending" leaves in "Engineering")

{
  _id: ObjectId,
  orgId: ObjectId,           //  THE TENANT LOCK
  employeeId: ObjectId,      // Ref: User
  departmentId: ObjectId,    // Ref: Department (Embedded for fast filtering)
  
  // Denormalized for UI Speed
  employeeName: String,      // "John Doe"
  
  type: String,              // "casual_leave" | "sick_leave"
  status: String,            // "pending" | "approved" | "rejected" | "cancelled"
  
  dates: {
    startDate: Date,
    endDate: Date,
    totalDays: Number
  },
  reason: String,
  
  workflow: {
    actionedBy: ObjectId,    // Who approved/rejected it
    actionedAt: Date,
    comments: String
  },
  
  createdAt: Date            // Automatically indexed for sorting newest first
}

// counters 
{
  _id: String,               // e.g., "ORG-1001_employee_counter"
  sequenceValue: Number      // e.g., 42
}

// announcemtns and holidays 

// Announcements
{
  _id: ObjectId,
  orgId: ObjectId,           //  THE TENANT LOCK
  title: String,
  content: String,
  priority: String,          // "low" | "high"
  authorId: ObjectId,
  createdAt: Date
}

// Holidays
{
  _id: ObjectId,
  orgId: ObjectId,           //  THE TENANT LOCK
  name: String,
  date: Date,
  type: String,              // "public" | "optional"
}
// Production Indexes: { orgId: 1, date: 1 } 
// (To quickly fetch upcoming holidays for a company).