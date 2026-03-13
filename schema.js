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
        casualLeaves:  Number,
        sickLeaves:  Number,
      },
      timezone: String,      
      // NEW PAYROLL SETTINGS
      currency: String,
      payCycle: stringify ( enum : ['monthly', 'bi-weekly'], default:'monthly'),
      taxId: String // Employer Identification Number (EIN)
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



// payslips (The Monthly Payroll Records)
// Production Indexes: 
// * { orgId: 1, employeeId: 1, 'payPeriod.year': -1, 'payPeriod.month': -1 } (For employee viewing their history)
// * { orgId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 } (For HR viewing the whole company's monthly run)
// * { orgId: 1, employeeId: 1, 'payPeriod.month': 1, 'payPeriod.year': 1 } (UNIQUE - Prevents double-paying someone)

{
  _id: ObjectId,             // e.g., "75f8b..."
  orgId: ObjectId,           // THE TENANT LOCK (Ref: Organization)
  employeeId: ObjectId,      // Ref: User (Whose money this is)

  // The specific month and year this payslip covers
  payPeriod: {
    month: Number,           // e.g., 2 (for February)
    year: Number             // e.g., 2026
  },

  // Money going IN
  earnings: {
    baseSalary: Number,      // e.g., 5000 (Pulled from User.financial.baseSalary at time of generation)
    bonus: Number,           // e.g., 500 (Manual input by HR)
    allowances: Number       // e.g., 100 (Internet, travel, etc.)
  },

  // Money coming OUT
  deductions: {
    tax: Number,             // e.g., 800 (Calculated or manual)
    healthInsurance: Number, // e.g., 150
    unpaidLeave: Number      // e.g., 0 (Calculated based on LeaveRequests in this month)
  },

  // The final take-home amount
  netPay: Number,            // e.g., 4650 (Auto-calculated: Total Earnings - Total Deductions)
  
  // The Workflow State
  status: String,            // "draft" | "processed" | "paid"
  paymentDate: Date,         // Stamped when HR changes status to "paid"

  createdAt: Date,
  updatedAt: Date
}


// ANALYTICS MODELS SCHEMA 
// Shape of the MonthlyTrend Materialized View
{
  _id: { 
    orgId: ObjectId, 
    month: "2026-02" // YYYY-MM format for easy sorting
  },
  metrics: {
    totalHeadcount: 524,
    momGrowthPct: 4.2,        // Pre-calculated percentage!
    totalSalaryBurn: 450000,  // Pre-calculated cost of base + allowances
    leaveDaysTaken: 142       // For the Peak Leave Heatmap
  },
  // We can even store a pre-calculated mini-heatmap for the month
  dailyLeaveHeatmap: [
    { date: "2026-02-01", leaves: 5 },
    { date: "2026-02-02", leaves: 12 }, // e.g., A long weekend
    // ...
  ],
  lastCalculatedAt: Date
}


// Schema 2: DeptStats (Categorical & Comparison Data)


{
  _id: { 
    orgId: ObjectId, 
    departmentId: ObjectId 
  },
  departmentName: "Engineering", // Duplicate this here so UI doesn't need a $lookup!
  metrics: {
    headcount: 120,
    avgEngagementScore: 8.4,  // The algorithmic score
    globalPerformanceRank: 2, // Ranked against other departments
  },
  leaveTypeBreakdown: {
    casual: 450,
    sick: 120,
    unpaid: 15
  },
  lastCalculatedAt: Date
}

// chema 3: OrgSummary (High-Level Snapshot)

{
  _id: ObjectId, // This IS the orgId
  retentionCohorts: {
    underOneYear: 45,
    oneToThreeYears: 150,
    threeToFiveYears: 80,
    fivePlusYears: 30
  },
  burnoutPredictor: {
    highRiskCount: 12, // Pre-counted number of people with 0 leaves in 8 months
    atRiskEmployees: [ // Store the top 5 names directly for the dashboard UI
      { employeeId: ObjectId, name: "John Doe", daysSinceLastLeave: 240 }
    ]
  },
  lastCalculatedAt: Date
}






// -------------- HIRING/ATS SCHEMA ----------------------


// CANDIDATE SCHEMA 
const candidateSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobOpening", required: true },
    

     email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },

     passwordHash: {
      type: String,
      select: false, // Never returned in queries by default
    },

    profile:{
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      contactNumber: { type: String, trim: true },
      location: {type:String}
    },

    
    socialProfiles: {
      linkedIn: { type: String },
      github: { type: String },
      portfolio: { type: String }
    },

    // 2. Documents (Secure S3 Paths)
    documents: {
      resumeS3Key: { type: String, required: true },
      coverLetterS3Key: { type: String },
      experienceLettersS3Keys: [{ type: String }] // Array for multiple previous companies
    },

    // 3. Dynamic Answers (Mapped to JobOpening.screeningQuestions)
    questionnaireAnswers: [
      {
        questionId: { type: Schema.Types.ObjectId },
        questionText: { type: String },
        answer: { type: Schema.Types.Mixed } // Can be a string, boolean, etc.
      }
    ],

    // 4. Parsed Data (For your D3.js UI and Elasticsearch)
    parsedData: {
      rawText: { type: String }, // The massive blob of text we send to Elasticsearch
      extractedSkills: [
        {
          name: { type: String },
          yearsExperience: { type: Number } // Populates the bubble sizes in your UI
        }
      ]
    },

    // 5. ATS Pipeline Tracking (Recruiter side)
    pipeline: {
      currentStage: { type: String, required: true }, // Must match a stage in JobOpening
      status: { type: String, enum: ["Active", "Rejected", "Withdrawn", "Hired"], default: "Active" },
      labels: [{ type: String }], // e.g., ["Good PHP", "Promising"]
      matchScore: { type: Number } // The Elasticsearch BM25 score cached for easy sorting
    },

    // 6. Internal Collaboration
    comments: [
      {
        recruiterId: { type: Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Indexes for fast recruiter dashboard loading
candidateSchema.index({ orgId: 1, jobId: 1, "pipeline.currentStage": 1 });
candidateSchema.index({ email: 1, jobId: 1 }, { unique: true }); // Prevent applying twice to same job


//--------------------- JobOpening SCHEMA ---------------------



const jobOpeningSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    title: { type: String, required: true }, // e.g., "Senior PHP Developer"
    department: { type: String },
    location: { type: String }, // e.g., "Warsaw, Poland" or "Remote"
    
    // The rich text description
    description: { type: String, required: true },
    
    // For Elasticsearch boosting (from your mockup)
    technologies: [
      {
        name: { type: String, required: true }, // e.g., "PHP", "Symfony"
        yearsRequired: { type: Number, default: 0 },
        weight: { type: Number, default: 1 }, // Elasticsearch BM25 boost multiplier
      }
    ],
    
    salaryRange: {
      min: { type: Number },
      max: { type: Number }, // e.g., 8000
      currency: { type: String, default: "USD" }
    },

    // The Kanban board columns (from your mockup)
    stages: [{ type: String }], // e.g., ["Screening", "Phone Interview", "Tech Test", "Offer"]
    
    // Dynamic Application Form Builder
    screeningQuestions: [
      {
        questionText: { type: String, required: true },
        answerType: { type: String, enum: ["text", "boolean", "multipleChoice"], required: true },
        isRequired: { type: Boolean, default: true },
        options: [{ type: String }] // Only used if multipleChoice
      }
    ],

    status: { type: String, enum: ["Draft", "Published", "Closed"], default: "Draft" }
  },
  { timestamps: true }
);


// http://localhost:5173/careers/aaaaaaaaaaaaaaaaaaaaa001