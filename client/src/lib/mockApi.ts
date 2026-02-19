import type { Role } from './config.ts';

// ============================================================================
// TypeScript Interfaces (Matching MongoDB Schema)
// ============================================================================

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'past_due';
    maxUsers: number;
  };
  settings: {
    leavePolicy: {
      casualLeaves: number;
      sickLeaves: number;
    };
    timezone: string;
  };
  createdAt: Date;
}

export interface User {
  _id: string;
  orgId: string;
  displayId: string;
  email: string;
  passwordHash: string; // Mock string for development
  role: Role;
  departmentId: string;
  profile: {
    firstName: string;
    lastName: string;
    contactNumber: string;
    avatarUrl?: string;
  };
  financial: {
    baseSalary: number;
    currency: string;
  };
  leaveBalances: {
    casual: number;
    sick: number;
  };
  isDeleted: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Department {
  _id: string;
  orgId: string;
  name: string;
  managerId: string;
  createdAt: Date;
}

export interface LeaveRequest {
  _id: string;
  orgId: string;
  employeeId: string;
  departmentId: string;
  employeeName: string; // Denormalized for UI speed
  type: 'casual_leave' | 'sick_leave';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  dates: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
  };
  reason: string;
  workflow?: {
    actionedBy: string;
    actionedAt: Date;
    comments: string;
  };
  createdAt: Date;
}

// Auth Context compatible user format
export interface AuthUser {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
}

// Dashboard stats interface
export interface DashboardStats {
  totalEmployees: number;
  departmentsCount: number;
  pendingLeaves: number;
  approvedLeavesThisMonth: number;
  totalLeavesThisMonth: number;
  activeEmployees: number;
}

// ============================================================================
// In-Memory Database (Mock Data)
// ============================================================================

const db = {
  organizations: [
    {
      _id: 'ORG-1001',
      name: 'Nexus Tech',
      slug: 'nexus-tech',
      subscription: {
        plan: 'pro' as const,
        status: 'active' as const,
        maxUsers: 100,
      },
      settings: {
        leavePolicy: {
          casualLeaves: 12,
          sickLeaves: 10,
        },
        timezone: 'UTC',
      },
      createdAt: new Date('2024-01-01'),
    },
  ] as Organization[],

  departments: [
    {
      _id: 'DEPT-1',
      orgId: 'ORG-1001',
      name: 'Operations',
      managerId: 'USER-1', // Sarah will be the manager
      createdAt: new Date('2024-01-15'),
    },
    {
      _id: 'DEPT-2',
      orgId: 'ORG-1001',
      name: 'Technology',
      managerId: 'USER-1', // Sarah manages both for now
      createdAt: new Date('2024-01-15'),
    },
  ] as Department[],

  users: [
    {
      _id: 'USER-1',
      orgId: 'ORG-1001',
      displayId: 'EMP-001',
      email: 'sarah.johnson@nexustech.com',
      passwordHash: 'mock_hashed_password_123', // In real app, this would be bcrypt hash
      role: 'hr_manager' as Role,
      departmentId: 'DEPT-1',
      profile: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        contactNumber: '+1-555-0101',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      },
      financial: {
        baseSalary: 75000,
        currency: 'USD',
      },
      leaveBalances: {
        casual: 12,
        sick: 10,
      },
      isDeleted: false,
      createdAt: new Date('2024-01-20'),
      lastLogin: new Date('2024-02-18'),
    },
    {
      _id: 'USER-2',
      orgId: 'ORG-1001',
      displayId: 'EMP-002',
      email: 'john.doe@nexustech.com',
      passwordHash: 'mock_hashed_password_456',
      role: 'employee' as Role,
      departmentId: 'DEPT-2',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        contactNumber: '+1-555-0102',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      },
      financial: {
        baseSalary: 65000,
        currency: 'USD',
      },
      leaveBalances: {
        casual: 10,
        sick: 8,
      },
      isDeleted: false,
      createdAt: new Date('2024-02-01'),
      lastLogin: new Date('2024-02-17'),
    },
    {
    _id: 'USER-3',
    orgId: 'ORG-1001',
    displayId: 'EMP-003',
    email: 'michael.brown@nexustech.com',
    passwordHash: 'mock_hashed_password_789',
    role: 'employee' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Michael',
      lastName: 'Brown',
      contactNumber: '+1-555-0103',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    },
    financial: { baseSalary: 68000, currency: 'USD' },
    leaveBalances: { casual: 10, sick: 8 },
    isDeleted: false,
    createdAt: new Date('2024-02-05'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-4',
    orgId: 'ORG-1001',
    displayId: 'EMP-004',
    email: 'emily.davis@nexustech.com',
    passwordHash: 'mock_hashed_password_101',
    role: 'employee' as Role,
    departmentId: 'DEPT-2',
    profile: {
      firstName: 'Emily',
      lastName: 'Davis',
      contactNumber: '+1-555-0104',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    },
    financial: { baseSalary: 72000, currency: 'USD' },
    leaveBalances: { casual: 15, sick: 12 },
    isDeleted: false,
    createdAt: new Date('2023-11-15'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-5',
    orgId: 'ORG-1001',
    displayId: 'EMP-005',
    email: 'chris.wilson@nexustech.com',
    passwordHash: 'mock_hashed_password_102',
    role: 'manager' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Chris',
      lastName: 'Wilson',
      contactNumber: '+1-555-0105',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chris',
    },
    financial: { baseSalary: 95000, currency: 'USD' },
    leaveBalances: { casual: 8, sick: 5 },
    isDeleted: false,
    createdAt: new Date('2023-08-20'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-6',
    orgId: 'ORG-1001',
    displayId: 'EMP-006',
    email: 'amanda.martinez@nexustech.com',
    passwordHash: 'mock_hashed_password_103',
    role: 'employee' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'Amanda',
      lastName: 'Martinez',
      contactNumber: '+1-555-0106',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amanda',
    },
    financial: { baseSalary: 61000, currency: 'USD' },
    leaveBalances: { casual: 12, sick: 10 },
    isDeleted: false,
    createdAt: new Date('2024-01-10'),
    lastLogin: new Date('2024-02-16'),
  },
  {
    _id: 'USER-7',
    orgId: 'ORG-1001',
    displayId: 'EMP-007',
    email: 'david.anderson@nexustech.com',
    passwordHash: 'mock_hashed_password_104',
    role: 'employee' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'David',
      lastName: 'Anderson',
      contactNumber: '+1-555-0107',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    },
    financial: { baseSalary: 64000, currency: 'USD' },
    leaveBalances: { casual: 5, sick: 2 },
    isDeleted: false,
    createdAt: new Date('2023-05-12'),
    lastLogin: new Date('2024-02-17'),
  },
  {
    _id: 'USER-8',
    orgId: 'ORG-1001',
    displayId: 'EMP-008',
    email: 'jessica.taylor@nexustech.com',
    passwordHash: 'mock_hashed_password_105',
    role: 'employee' as Role,
    departmentId: 'DEPT-5',
    profile: {
      firstName: 'Jessica',
      lastName: 'Taylor',
      contactNumber: '+1-555-0108',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica',
    },
    financial: { baseSalary: 70000, currency: 'USD' },
    leaveBalances: { casual: 14, sick: 9 },
    isDeleted: false,
    createdAt: new Date('2023-09-30'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-9',
    orgId: 'ORG-1001',
    displayId: 'EMP-009',
    email: 'james.thomas@nexustech.com',
    passwordHash: 'mock_hashed_password_106',
    role: 'manager' as Role,
    departmentId: 'DEPT-5',
    profile: {
      firstName: 'James',
      lastName: 'Thomas',
      contactNumber: '+1-555-0109',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    },
    financial: { baseSalary: 105000, currency: 'USD' },
    leaveBalances: { casual: 20, sick: 15 },
    isDeleted: false,
    createdAt: new Date('2022-11-01'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-10',
    orgId: 'ORG-1001',
    displayId: 'EMP-010',
    email: 'robert.jackson@nexustech.com',
    passwordHash: 'mock_hashed_password_107',
    role: 'employee' as Role,
    departmentId: 'DEPT-1',
    profile: {
      firstName: 'Robert',
      lastName: 'Jackson',
      contactNumber: '+1-555-0110',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Robert',
    },
    financial: { baseSalary: 59000, currency: 'USD' },
    leaveBalances: { casual: 11, sick: 10 },
    isDeleted: false,
    createdAt: new Date('2024-01-25'),
    lastLogin: new Date('2024-02-15'),
  },
  {
    _id: 'USER-11',
    orgId: 'ORG-1001',
    displayId: 'EMP-011',
    email: 'mary.white@nexustech.com',
    passwordHash: 'mock_hashed_password_108',
    role: 'employee' as Role,
    departmentId: 'DEPT-2',
    profile: {
      firstName: 'Mary',
      lastName: 'White',
      contactNumber: '+1-555-0111',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mary',
    },
    financial: { baseSalary: 66000, currency: 'USD' },
    leaveBalances: { casual: 9, sick: 4 },
    isDeleted: false,
    createdAt: new Date('2023-12-05'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-12',
    orgId: 'ORG-1001',
    displayId: 'EMP-012',
    email: 'patricia.harris@nexustech.com',
    passwordHash: 'mock_hashed_password_109',
    role: 'employee' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Patricia',
      lastName: 'Harris',
      contactNumber: '+1-555-0112',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Patricia',
    },
    financial: { baseSalary: 71000, currency: 'USD' },
    leaveBalances: { casual: 12, sick: 12 },
    isDeleted: false,
    createdAt: new Date('2023-06-18'),
    lastLogin: new Date('2024-02-14'),
  },
  {
    _id: 'USER-13',
    orgId: 'ORG-1001',
    displayId: 'EMP-013',
    email: 'john.martin@nexustech.com',
    passwordHash: 'mock_hashed_password_110',
    role: 'employee' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'John',
      lastName: 'Martin',
      contactNumber: '+1-555-0113',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JohnMartin',
    },
    financial: { baseSalary: 63000, currency: 'USD' },
    leaveBalances: { casual: 6, sick: 3 },
    isDeleted: false,
    createdAt: new Date('2023-10-22'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-14',
    orgId: 'ORG-1001',
    displayId: 'EMP-014',
    email: 'jennifer.thompson@nexustech.com',
    passwordHash: 'mock_hashed_password_111',
    role: 'manager' as Role,
    departmentId: 'DEPT-1',
    profile: {
      firstName: 'Jennifer',
      lastName: 'Thompson',
      contactNumber: '+1-555-0114',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jennifer',
    },
    financial: { baseSalary: 98000, currency: 'USD' },
    leaveBalances: { casual: 18, sick: 14 },
    isDeleted: false,
    createdAt: new Date('2022-08-14'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-15',
    orgId: 'ORG-1001',
    displayId: 'EMP-015',
    email: 'linda.garcia@nexustech.com',
    passwordHash: 'mock_hashed_password_112',
    role: 'employee' as Role,
    departmentId: 'DEPT-2',
    profile: {
      firstName: 'Linda',
      lastName: 'Garcia',
      contactNumber: '+1-555-0115',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linda',
    },
    financial: { baseSalary: 67000, currency: 'USD' },
    leaveBalances: { casual: 10, sick: 8 },
    isDeleted: false,
    createdAt: new Date('2023-11-02'),
    lastLogin: new Date('2024-02-17'),
  },
  {
    _id: 'USER-16',
    orgId: 'ORG-1001',
    displayId: 'EMP-016',
    email: 'william.martinez@nexustech.com',
    passwordHash: 'mock_hashed_password_113',
    role: 'employee' as Role,
    departmentId: 'DEPT-5',
    profile: {
      firstName: 'William',
      lastName: 'Martinez',
      contactNumber: '+1-555-0116',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=William',
    },
    financial: { baseSalary: 69000, currency: 'USD' },
    leaveBalances: { casual: 7, sick: 6 },
    isDeleted: true, // Example of a deleted user for UI testing
    createdAt: new Date('2023-04-11'),
    lastLogin: new Date('2023-12-01'),
  },
  {
    _id: 'USER-17',
    orgId: 'ORG-1001',
    displayId: 'EMP-017',
    email: 'elizabeth.robinson@nexustech.com',
    passwordHash: 'mock_hashed_password_114',
    role: 'employee' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Elizabeth',
      lastName: 'Robinson',
      contactNumber: '+1-555-0117',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elizabeth',
    },
    financial: { baseSalary: 73000, currency: 'USD' },
    leaveBalances: { casual: 12, sick: 10 },
    isDeleted: false,
    createdAt: new Date('2023-07-29'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-18',
    orgId: 'ORG-1001',
    displayId: 'EMP-018',
    email: 'richard.clark@nexustech.com',
    passwordHash: 'mock_hashed_password_115',
    role: 'employee' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'Richard',
      lastName: 'Clark',
      contactNumber: '+1-555-0118',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Richard',
    },
    financial: { baseSalary: 62000, currency: 'USD' },
    leaveBalances: { casual: 8, sick: 4 },
    isDeleted: false,
    createdAt: new Date('2024-01-05'),
    lastLogin: new Date('2024-02-16'),
  },
  {
    _id: 'USER-19',
    orgId: 'ORG-1001',
    displayId: 'EMP-019',
    email: 'barbara.rodriguez@nexustech.com',
    passwordHash: 'mock_hashed_password_116',
    role: 'manager' as Role,
    departmentId: 'DEPT-2',
    profile: {
      firstName: 'Barbara',
      lastName: 'Rodriguez',
      contactNumber: '+1-555-0119',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Barbara',
    },
    financial: { baseSalary: 92000, currency: 'USD' },
    leaveBalances: { casual: 15, sick: 10 },
    isDeleted: false,
    createdAt: new Date('2022-09-15'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-20',
    orgId: 'ORG-1001',
    displayId: 'EMP-020',
    email: 'susan.lewis@nexustech.com',
    passwordHash: 'mock_hashed_password_117',
    role: 'employee' as Role,
    departmentId: 'DEPT-1',
    profile: {
      firstName: 'Susan',
      lastName: 'Lewis',
      contactNumber: '+1-555-0120',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Susan',
    },
    financial: { baseSalary: 60000, currency: 'USD' },
    leaveBalances: { casual: 10, sick: 5 },
    isDeleted: false,
    createdAt: new Date('2023-12-10'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-21',
    orgId: 'ORG-1001',
    displayId: 'EMP-021',
    email: 'joseph.lee@nexustech.com',
    passwordHash: 'mock_hashed_password_118',
    role: 'employee' as Role,
    departmentId: 'DEPT-5',
    profile: {
      firstName: 'Joseph',
      lastName: 'Lee',
      contactNumber: '+1-555-0121',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joseph',
    },
    financial: { baseSalary: 68500, currency: 'USD' },
    leaveBalances: { casual: 11, sick: 7 },
    isDeleted: false,
    createdAt: new Date('2023-08-05'),
    lastLogin: new Date('2024-02-15'),
  },
  {
    _id: 'USER-22',
    orgId: 'ORG-1001',
    displayId: 'EMP-022',
    email: 'margaret.walker@nexustech.com',
    passwordHash: 'mock_hashed_password_119',
    role: 'employee' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Margaret',
      lastName: 'Walker',
      contactNumber: '+1-555-0122',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Margaret',
    },
    financial: { baseSalary: 74000, currency: 'USD' },
    leaveBalances: { casual: 14, sick: 11 },
    isDeleted: false,
    createdAt: new Date('2023-03-22'),
    lastLogin: new Date('2024-02-17'),
  },
  {
    _id: 'USER-23',
    orgId: 'ORG-1001',
    displayId: 'EMP-023',
    email: 'charles.hall@nexustech.com',
    passwordHash: 'mock_hashed_password_120',
    role: 'employee' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'Charles',
      lastName: 'Hall',
      contactNumber: '+1-555-0123',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charles',
    },
    financial: { baseSalary: 65500, currency: 'USD' },
    leaveBalances: { casual: 9, sick: 6 },
    isDeleted: false,
    createdAt: new Date('2023-11-20'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-24',
    orgId: 'ORG-1001',
    displayId: 'EMP-024',
    email: 'dorothy.allen@nexustech.com',
    passwordHash: 'mock_hashed_password_121',
    role: 'manager' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'Dorothy',
      lastName: 'Allen',
      contactNumber: '+1-555-0124',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dorothy',
    },
    financial: { baseSalary: 91000, currency: 'USD' },
    leaveBalances: { casual: 16, sick: 12 },
    isDeleted: false,
    createdAt: new Date('2022-12-05'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-25',
    orgId: 'ORG-1001',
    displayId: 'EMP-025',
    email: 'thomas.young@nexustech.com',
    passwordHash: 'mock_hashed_password_122',
    role: 'employee' as Role,
    departmentId: 'DEPT-2',
    profile: {
      firstName: 'Thomas',
      lastName: 'Young',
      contactNumber: '+1-555-0125',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas',
    },
    financial: { baseSalary: 63500, currency: 'USD' },
    leaveBalances: { casual: 10, sick: 8 },
    isDeleted: false,
    createdAt: new Date('2024-01-30'),
    lastLogin: new Date('2024-02-16'),
  },
  {
    _id: 'USER-26',
    orgId: 'ORG-1001',
    displayId: 'EMP-026',
    email: 'alice.hernandez@nexustech.com',
    passwordHash: 'mock_hashed_password_123',
    role: 'employee' as Role,
    departmentId: 'DEPT-1',
    profile: {
      firstName: 'Alice',
      lastName: 'Hernandez',
      contactNumber: '+1-555-0126',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    },
    financial: { baseSalary: 58000, currency: 'USD' },
    leaveBalances: { casual: 12, sick: 9 },
    isDeleted: false,
    createdAt: new Date('2023-09-10'),
    lastLogin: new Date('2024-02-17'),
  },
  {
    _id: 'USER-27',
    orgId: 'ORG-1001',
    displayId: 'EMP-027',
    email: 'christopher.king@nexustech.com',
    passwordHash: 'mock_hashed_password_124',
    role: 'employee' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Christopher',
      lastName: 'King',
      contactNumber: '+1-555-0127',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Christopher',
    },
    financial: { baseSalary: 71500, currency: 'USD' },
    leaveBalances: { casual: 8, sick: 5 },
    isDeleted: false,
    createdAt: new Date('2023-06-25'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-28',
    orgId: 'ORG-1001',
    displayId: 'EMP-028',
    email: 'betty.wright@nexustech.com',
    passwordHash: 'mock_hashed_password_125',
    role: 'employee' as Role,
    departmentId: 'DEPT-5',
    profile: {
      firstName: 'Betty',
      lastName: 'Wright',
      contactNumber: '+1-555-0128',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Betty',
    },
    financial: { baseSalary: 69500, currency: 'USD' },
    leaveBalances: { casual: 13, sick: 10 },
    isDeleted: true,
    createdAt: new Date('2023-02-14'),
    lastLogin: new Date('2023-11-20'),
  },
  {
    _id: 'USER-29',
    orgId: 'ORG-1001',
    displayId: 'EMP-029',
    email: 'matthew.lopez@nexustech.com',
    passwordHash: 'mock_hashed_password_126',
    role: 'employee' as Role,
    departmentId: 'DEPT-4',
    profile: {
      firstName: 'Matthew',
      lastName: 'Lopez',
      contactNumber: '+1-555-0129',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Matthew',
    },
    financial: { baseSalary: 64500, currency: 'USD' },
    leaveBalances: { casual: 7, sick: 4 },
    isDeleted: false,
    createdAt: new Date('2023-10-05'),
    lastLogin: new Date('2024-02-19'),
  },
  {
    _id: 'USER-30',
    orgId: 'ORG-1001',
    displayId: 'EMP-030',
    email: 'nancy.hill@nexustech.com',
    passwordHash: 'mock_hashed_password_127',
    role: 'manager' as Role,
    departmentId: 'DEPT-3',
    profile: {
      firstName: 'Nancy',
      lastName: 'Hill',
      contactNumber: '+1-555-0130',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nancy',
    },
    financial: { baseSalary: 102000, currency: 'USD' },
    leaveBalances: { casual: 19, sick: 14 },
    isDeleted: false,
    createdAt: new Date('2022-07-30'),
    lastLogin: new Date('2024-02-18'),
  },
  {
    _id: 'USER-31',
    orgId: 'ORG-1001',
    displayId: 'EMP-031',
    email: 'anthony.scott@nexustech.com',
    passwordHash: 'mock_hashed_password_128',
    role: 'employee' as Role,
    departmentId: 'DEPT-1',
    profile: {
      firstName: 'Anthony',
      lastName: 'Scott',
      contactNumber: '+1-555-0131',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anthony',
    },
    financial: { baseSalary: 61500, currency: 'USD' },
    leaveBalances: { casual: 11, sick: 8 },
    isDeleted: false,
    createdAt: new Date('2023-12-20'),
    lastLogin: new Date('2024-02-15'),
  },
  {
    _id: 'USER-32',
    orgId: 'ORG-1001',
    displayId: 'EMP-032',
    email: 'karen.green@nexustech.com',
    passwordHash: 'mock_hashed_password_129',
    role: 'employee' as Role,
    departmentId: 'DEPT-2',
    profile: {
      firstName: 'Karen',
      lastName: 'Green',
      contactNumber: '+1-555-0132',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Karen',
    },
    financial: { baseSalary: 67500, currency: 'USD' },
    leaveBalances: { casual: 10, sick: 9 },
    isDeleted: false,
    createdAt: new Date('2023-05-28'),
    lastLogin: new Date('2024-02-18'),
  },
  ] as User[],

  leaves: [
    {
      _id: 'LEAVE-1',
      orgId: 'ORG-1001',
      employeeId: 'USER-2',
      departmentId: 'DEPT-2',
      employeeName: 'John Doe',
      type: 'casual_leave' as const,
      status: 'pending' as const,
      dates: {
        startDate: new Date('2024-02-25'),
        endDate: new Date('2024-02-27'),
        totalDays: 3,
      },
      reason: 'Family vacation',
      createdAt: new Date('2024-02-15'),
    },
    {
      _id: 'LEAVE-2',
      orgId: 'ORG-1001',
      employeeId: 'USER-2',
      departmentId: 'DEPT-2',
      employeeName: 'John Doe',
      type: 'sick_leave' as const,
      status: 'approved' as const,
      dates: {
        startDate: new Date('2024-02-05'),
        endDate: new Date('2024-02-05'),
        totalDays: 1,
      },
      reason: 'Medical appointment',
      workflow: {
        actionedBy: 'USER-1',
        actionedAt: new Date('2024-02-04'),
        comments: 'Approved for medical reasons',
      },
      createdAt: new Date('2024-02-03'),
    },
  ] as LeaveRequest[],
};

// ============================================================================
// Mock API Client
// ============================================================================

/**
 * Simulates network latency
 */
const delay = (ms: number = 500): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a unique ID for new records
 */
const generateId = (prefix: string): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}`;
};

export const mockApi = {
  /**
   * Authenticates user by email and password
   * Returns user data formatted for AuthContext
   */
  async login(email: string, password: string): Promise<AuthUser> {
    await delay();
    
    const user = db.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    if (user.isDeleted) {
      throw new Error('Account has been deactivated');
    }
    
    // In a real app, you'd compare password with bcrypt
    // For mock purposes, any password works
    
    // Update last login
    user.lastLogin = new Date();
    
    return {
      id: user._id,
      orgId: user.orgId,
      name: `${user.profile.firstName} ${user.profile.lastName}`,
      email: user.email,
      role: user.role,
    };
  },

  /**
   * Gets dashboard statistics for the organization
   * Enforces orgId tenant isolation
   */
  async getDashboardStats(orgId: string): Promise<DashboardStats> {
    await delay();
    
    // Filter all data by orgId for tenant isolation
    const orgUsers = db.users.filter(u => u.orgId === orgId && !u.isDeleted);
    const orgDepartments = db.departments.filter(d => d.orgId === orgId);
    const orgLeaves = db.leaves.filter(l => l.orgId === orgId);
    
    // Calculate current month stats
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const leavesThisMonth = orgLeaves.filter(leave => {
      const leaveMonth = leave.createdAt.getMonth();
      const leaveYear = leave.createdAt.getFullYear();
      return leaveMonth === currentMonth && leaveYear === currentYear;
    });
    
    return {
      totalEmployees: orgUsers.length,
      departmentsCount: orgDepartments.length,
      pendingLeaves: orgLeaves.filter(l => l.status === 'pending').length,
      approvedLeavesThisMonth: leavesThisMonth.filter(l => l.status === 'approved').length,
      totalLeavesThisMonth: leavesThisMonth.length,
      activeEmployees: orgUsers.filter(u => u.lastLogin && 
        Date.now() - u.lastLogin.getTime() < 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
      ).length,
    };
  },

  /**
   * Gets all employees for the organization
   * Enforces orgId tenant isolation
   */
  async getEmployees(orgId: string): Promise<User[]> {
    await delay();
    
    return db.users
      .filter(user => user.orgId === orgId && !user.isDeleted)
      .sort((a, b) => a.profile.firstName.localeCompare(b.profile.firstName));
  },

  /**
   * Gets departments for the organization
   * Enforces orgId tenant isolation
   */
  async getDepartments(orgId: string): Promise<Department[]> {
    await delay();
    
    return db.departments
      .filter(dept => dept.orgId === orgId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Gets leave requests for the organization
   * Optionally filters by specific employee
   * Enforces orgId tenant isolation
   */
  async getLeaves(orgId: string, employeeId?: string): Promise<LeaveRequest[]> {
    await delay();
    
    let filteredLeaves = db.leaves.filter(leave => leave.orgId === orgId);
    
    if (employeeId) {
      filteredLeaves = filteredLeaves.filter(leave => leave.employeeId === employeeId);
    }
    
    // Sort by creation date (newest first)
    return filteredLeaves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /**
   * Applies for a new leave
   * Enforces orgId tenant isolation
   */
  async applyLeave(
    orgId: string, 
    payload: Omit<LeaveRequest, '_id' | 'orgId' | 'createdAt'>
  ): Promise<LeaveRequest> {
    await delay();
    
    // Validate that employee belongs to the organization
    const employee = db.users.find(u => u._id === payload.employeeId && u.orgId === orgId);
    if (!employee) {
      throw new Error('Employee not found in organization');
    }
    
    // Create new leave request
    const newLeave: LeaveRequest = {
      _id: generateId('LEAVE'),
      orgId,
      ...payload,
      createdAt: new Date(),
    };
    
    // Add to database
    db.leaves.push(newLeave);
    
    return newLeave;
  },

  /**
   * Updates leave status (approve/reject)
   * Enforces orgId tenant isolation
   */
  async updateLeaveStatus(
    orgId: string,
    leaveId: string,
    status: 'approved' | 'rejected',
    actionedBy: string,
    comments?: string
  ): Promise<LeaveRequest> {
    await delay();
    
    const leaveIndex = db.leaves.findIndex(l => l._id === leaveId && l.orgId === orgId);
    if (leaveIndex === -1) {
      throw new Error('Leave request not found');
    }
    
    // Update leave status
    db.leaves[leaveIndex].status = status;
    db.leaves[leaveIndex].workflow = {
      actionedBy,
      actionedAt: new Date(),
      comments: comments || '',
    };
    
    return db.leaves[leaveIndex];
  },

  /**
   * Adds a new employee to the organization
   * Enforces orgId tenant isolation
   */
  async addEmployee(
    orgId: string,
    employeeData: Omit<User, '_id' | 'orgId' | 'createdAt' | 'isDeleted'>
  ): Promise<User> {
    await delay();
    
    // Validate unique email within organization
    const existingUser = db.users.find(u => 
      u.email === employeeData.email && u.orgId === orgId && !u.isDeleted
    );
    
    if (existingUser) {
      throw new Error('Email already exists in organization');
    }
    
    // Validate department belongs to organization
    const department = db.departments.find(d => 
      d._id === employeeData.departmentId && d.orgId === orgId
    );
    
    if (!department) {
      throw new Error('Department not found in organization');
    }
    
    const newUser: User = {
      _id: generateId('USER'),
      orgId,
      ...employeeData,
      isDeleted: false,
      createdAt: new Date(),
    };
    
    db.users.push(newUser);
    return newUser;
  },

  /**
   * Soft deletes an employee
   * Enforces orgId tenant isolation
   */
  async deleteEmployee(orgId: string, userId: string): Promise<boolean> {
    await delay();
    
    const userIndex = db.users.findIndex(u => u._id === userId && u.orgId === orgId);
    if (userIndex === -1) {
      throw new Error('Employee not found in organization');
    }
    
    db.users[userIndex].isDeleted = true;
    return true;
  },

  /**
   * Gets organization info by orgId
   */
  async getOrganization(orgId: string): Promise<Organization> {
    await delay();
    
    const org = db.organizations.find(o => o._id === orgId);
    if (!org) {
      throw new Error('Organization not found');
    }
    
    return org;
  },
};

// Export the database for testing purposes (optional)
export const __mockDb = db;


// email: 'sarah.johnson@nexustech.com',
//       passwordHash: 'mock_hashed_password_123', 