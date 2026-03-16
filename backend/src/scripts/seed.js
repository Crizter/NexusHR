import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB    from '../config/db.js';              // ← ../  not ./
import bcrypt       from 'bcryptjs';
import Organization from '../models/Organization.models.js'; // ← ../
import User         from '../models/User.models.js';        // ← ../
import Department   from '../models/Department.models.js';   // ← ../
import LeaveRequest from '../models/LeaveRequest.models.js'; // ← ../
import Counter      from '../models/Counter.models.js';      // ← ../
// ============================================================================
// Seed Data (mirrored from mockApi.ts)
// ============================================================================

const organizations = [
  {
    _id:  new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaa001'),
    name: 'Nexus Tech',
    slug: 'nexus-tech',
    isActive: true,                  
    subscription: {
      plan:     'pro',
      status:   'active',
      maxUsers: 100,
    },
    settings: {
      leavePolicy: {
        casualLeaves: 16,
        sickLeaves:   12,
      },
      timezone: 'UTC',
      payroll: {                     
        currency: 'USD',
        payCycle: 'monthly',
      },
    },
  },
];

// ─── We need stable ObjectIds so department → org and user → dept refs resolve ─
// Map "mock string id" → real ObjectId
const orgId   = organizations[0]._id;

const deptIds = {
  'DEPT-1': new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbb0001'),
  'DEPT-2': new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbb0002'),
  'DEPT-3': new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbb0003'),
  'DEPT-4': new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbb0004'),
  'DEPT-5': new mongoose.Types.ObjectId('bbbbbbbbbbbbbbbbbbbb0005'),
};

const userIds = {
  'USER-1':  new mongoose.Types.ObjectId('cccccccccccccccccccc0001'),
  'USER-2':  new mongoose.Types.ObjectId('cccccccccccccccccccc0002'),
  'USER-3':  new mongoose.Types.ObjectId('cccccccccccccccccccc0003'),
  'USER-4':  new mongoose.Types.ObjectId('cccccccccccccccccccc0004'),
  'USER-5':  new mongoose.Types.ObjectId('cccccccccccccccccccc0005'),
  'USER-6':  new mongoose.Types.ObjectId('cccccccccccccccccccc0006'),
  'USER-7':  new mongoose.Types.ObjectId('cccccccccccccccccccc0007'),
  'USER-8':  new mongoose.Types.ObjectId('cccccccccccccccccccc0008'),
  'USER-9':  new mongoose.Types.ObjectId('cccccccccccccccccccc0009'),
  'USER-10': new mongoose.Types.ObjectId('cccccccccccccccccccc0010'),
  'USER-11': new mongoose.Types.ObjectId('cccccccccccccccccccc0011'),
  'USER-12': new mongoose.Types.ObjectId('cccccccccccccccccccc0012'),
  'USER-13': new mongoose.Types.ObjectId('cccccccccccccccccccc0013'),
  'USER-14': new mongoose.Types.ObjectId('cccccccccccccccccccc0014'),
  'USER-15': new mongoose.Types.ObjectId('cccccccccccccccccccc0015'),
  'USER-16': new mongoose.Types.ObjectId('cccccccccccccccccccc0016'),
  'USER-17': new mongoose.Types.ObjectId('cccccccccccccccccccc0017'),
  'USER-18': new mongoose.Types.ObjectId('cccccccccccccccccccc0018'),
  'USER-19': new mongoose.Types.ObjectId('cccccccccccccccccccc0019'),
  'USER-20': new mongoose.Types.ObjectId('cccccccccccccccccccc0020'),
  'USER-21': new mongoose.Types.ObjectId('cccccccccccccccccccc0021'),
  'USER-22': new mongoose.Types.ObjectId('cccccccccccccccccccc0022'),
  'USER-23': new mongoose.Types.ObjectId('cccccccccccccccccccc0023'),
  'USER-24': new mongoose.Types.ObjectId('cccccccccccccccccccc0024'),
  'USER-25': new mongoose.Types.ObjectId('cccccccccccccccccccc0025'),
  'USER-26': new mongoose.Types.ObjectId('cccccccccccccccccccc0026'),
  'USER-27': new mongoose.Types.ObjectId('cccccccccccccccccccc0027'),
  'USER-28': new mongoose.Types.ObjectId('cccccccccccccccccccc0028'),
  'USER-29': new mongoose.Types.ObjectId('cccccccccccccccccccc0029'),
  'USER-30': new mongoose.Types.ObjectId('cccccccccccccccccccc0030'),
  'USER-31': new mongoose.Types.ObjectId('cccccccccccccccccccc0031'),
  'USER-32': new mongoose.Types.ObjectId('cccccccccccccccccccc0032'),
};

// ─── Departments ──────────────────────────────────────────────────────────────
const departments = [
  { _id: deptIds['DEPT-1'], orgId, name: 'Operations', managerId: userIds['USER-1'],  createdAt: new Date('2024-01-15') },
  { _id: deptIds['DEPT-2'], orgId, name: 'Technology', managerId: userIds['USER-1'],  createdAt: new Date('2024-01-15') },
  { _id: deptIds['DEPT-3'], orgId, name: 'Finance',    managerId: userIds['USER-30'], createdAt: new Date('2024-01-15') },
  { _id: deptIds['DEPT-4'], orgId, name: 'Marketing',  managerId: userIds['USER-24'], createdAt: new Date('2024-01-15') },
  { _id: deptIds['DEPT-5'], orgId, name: 'HR',         managerId: userIds['USER-9'],  createdAt: new Date('2024-01-15') },
];

// ─── Users ────────────────────────────────────────────────────────────────────
// NOTE: passwordHash is stored as plain mock string here.
//       Replace with bcrypt hashes before going to production.
const MOCK_PASSWORD = await bcrypt.hash('password123', 10);  // ← real hash

const rawUsers = [
  { key: 'USER-1',  displayId: 'EMP-001', email: 'sarah.johnson@nexustech.com',    role: 'hr_manager', dept: 'DEPT-1', firstName: 'Sarah',       lastName: 'Johnson',   contact: '+1-555-0101', salary: 75000,  casual: 12, sick: 10, deleted: false, created: '2024-01-20', lastLogin: '2024-02-18' },
  { key: 'USER-2',  displayId: 'EMP-002', email: 'john.doe@nexustech.com',          role: 'employee',   dept: 'DEPT-2', firstName: 'John',         lastName: 'Doe',       contact: '+1-555-0102', salary: 65000,  casual: 10, sick: 8,  deleted: false, created: '2024-02-01', lastLogin: '2024-02-17' },
  { key: 'USER-3',  displayId: 'EMP-003', email: 'michael.brown@nexustech.com',     role: 'employee',   dept: 'DEPT-3', firstName: 'Michael',      lastName: 'Brown',     contact: '+1-555-0103', salary: 68000,  casual: 10, sick: 8,  deleted: false, created: '2024-02-05', lastLogin: '2024-02-18' },
  { key: 'USER-4',  displayId: 'EMP-004', email: 'emily.davis@nexustech.com',       role: 'employee',   dept: 'DEPT-2', firstName: 'Emily',        lastName: 'Davis',     contact: '+1-555-0104', salary: 72000,  casual: 15, sick: 12, deleted: false, created: '2023-11-15', lastLogin: '2024-02-19' },
  { key: 'USER-5',  displayId: 'EMP-005', email: 'chris.wilson@nexustech.com',      role: 'manager',    dept: 'DEPT-3', firstName: 'Chris',        lastName: 'Wilson',    contact: '+1-555-0105', salary: 95000,  casual: 8,  sick: 5,  deleted: false, created: '2023-08-20', lastLogin: '2024-02-19' },
  { key: 'USER-6',  displayId: 'EMP-006', email: 'amanda.martinez@nexustech.com',   role: 'employee',   dept: 'DEPT-4', firstName: 'Amanda',       lastName: 'Martinez',  contact: '+1-555-0106', salary: 61000,  casual: 12, sick: 10, deleted: false, created: '2024-01-10', lastLogin: '2024-02-16' },
  { key: 'USER-7',  displayId: 'EMP-007', email: 'david.anderson@nexustech.com',    role: 'employee',   dept: 'DEPT-4', firstName: 'David',        lastName: 'Anderson',  contact: '+1-555-0107', salary: 64000,  casual: 5,  sick: 2,  deleted: false, created: '2023-05-12', lastLogin: '2024-02-17' },
  { key: 'USER-8',  displayId: 'EMP-008', email: 'jessica.taylor@nexustech.com',    role: 'employee',   dept: 'DEPT-5', firstName: 'Jessica',      lastName: 'Taylor',    contact: '+1-555-0108', salary: 70000,  casual: 14, sick: 9,  deleted: false, created: '2023-09-30', lastLogin: '2024-02-18' },
  { key: 'USER-9',  displayId: 'EMP-009', email: 'james.thomas@nexustech.com',      role: 'manager',    dept: 'DEPT-5', firstName: 'James',        lastName: 'Thomas',    contact: '+1-555-0109', salary: 105000, casual: 20, sick: 15, deleted: false, created: '2022-11-01', lastLogin: '2024-02-19' },
  { key: 'USER-10', displayId: 'EMP-010', email: 'robert.jackson@nexustech.com',    role: 'employee',   dept: 'DEPT-1', firstName: 'Robert',       lastName: 'Jackson',   contact: '+1-555-0110', salary: 59000,  casual: 11, sick: 10, deleted: false, created: '2024-01-25', lastLogin: '2024-02-15' },
  { key: 'USER-11', displayId: 'EMP-011', email: 'mary.white@nexustech.com',        role: 'employee',   dept: 'DEPT-2', firstName: 'Mary',         lastName: 'White',     contact: '+1-555-0111', salary: 66000,  casual: 9,  sick: 4,  deleted: false, created: '2023-12-05', lastLogin: '2024-02-18' },
  { key: 'USER-12', displayId: 'EMP-012', email: 'patricia.harris@nexustech.com',   role: 'employee',   dept: 'DEPT-3', firstName: 'Patricia',     lastName: 'Harris',    contact: '+1-555-0112', salary: 71000,  casual: 12, sick: 12, deleted: false, created: '2023-06-18', lastLogin: '2024-02-14' },
  { key: 'USER-13', displayId: 'EMP-013', email: 'john.martin@nexustech.com',       role: 'employee',   dept: 'DEPT-4', firstName: 'John',         lastName: 'Martin',    contact: '+1-555-0113', salary: 63000,  casual: 6,  sick: 3,  deleted: false, created: '2023-10-22', lastLogin: '2024-02-19' },
  { key: 'USER-14', displayId: 'EMP-014', email: 'jennifer.thompson@nexustech.com', role: 'manager',    dept: 'DEPT-1', firstName: 'Jennifer',     lastName: 'Thompson',  contact: '+1-555-0114', salary: 98000,  casual: 18, sick: 14, deleted: false, created: '2022-08-14', lastLogin: '2024-02-19' },
  { key: 'USER-15', displayId: 'EMP-015', email: 'linda.garcia@nexustech.com',      role: 'employee',   dept: 'DEPT-2', firstName: 'Linda',        lastName: 'Garcia',    contact: '+1-555-0115', salary: 67000,  casual: 10, sick: 8,  deleted: false, created: '2023-11-02', lastLogin: '2024-02-17' },
  { key: 'USER-16', displayId: 'EMP-016', email: 'william.martinez@nexustech.com',  role: 'employee',   dept: 'DEPT-5', firstName: 'William',      lastName: 'Martinez',  contact: '+1-555-0116', salary: 69000,  casual: 7,  sick: 6,  deleted: true,  created: '2023-04-11', lastLogin: '2023-12-01' },
  { key: 'USER-17', displayId: 'EMP-017', email: 'elizabeth.robinson@nexustech.com',role: 'employee',   dept: 'DEPT-3', firstName: 'Elizabeth',    lastName: 'Robinson',  contact: '+1-555-0117', salary: 73000,  casual: 12, sick: 10, deleted: false, created: '2023-07-29', lastLogin: '2024-02-18' },
  { key: 'USER-18', displayId: 'EMP-018', email: 'richard.clark@nexustech.com',     role: 'employee',   dept: 'DEPT-4', firstName: 'Richard',      lastName: 'Clark',     contact: '+1-555-0118', salary: 62000,  casual: 8,  sick: 4,  deleted: false, created: '2024-01-05', lastLogin: '2024-02-16' },
  { key: 'USER-19', displayId: 'EMP-019', email: 'barbara.rodriguez@nexustech.com', role: 'manager',    dept: 'DEPT-2', firstName: 'Barbara',      lastName: 'Rodriguez', contact: '+1-555-0119', salary: 92000,  casual: 15, sick: 10, deleted: false, created: '2022-09-15', lastLogin: '2024-02-19' },
  { key: 'USER-20', displayId: 'EMP-020', email: 'susan.lewis@nexustech.com',       role: 'employee',   dept: 'DEPT-1', firstName: 'Susan',        lastName: 'Lewis',     contact: '+1-555-0120', salary: 60000,  casual: 10, sick: 5,  deleted: false, created: '2023-12-10', lastLogin: '2024-02-18' },
  { key: 'USER-21', displayId: 'EMP-021', email: 'joseph.lee@nexustech.com',        role: 'employee',   dept: 'DEPT-5', firstName: 'Joseph',       lastName: 'Lee',       contact: '+1-555-0121', salary: 68500,  casual: 11, sick: 7,  deleted: false, created: '2023-08-05', lastLogin: '2024-02-15' },
  { key: 'USER-22', displayId: 'EMP-022', email: 'margaret.walker@nexustech.com',   role: 'employee',   dept: 'DEPT-3', firstName: 'Margaret',     lastName: 'Walker',    contact: '+1-555-0122', salary: 74000,  casual: 14, sick: 11, deleted: false, created: '2023-03-22', lastLogin: '2024-02-17' },
  { key: 'USER-23', displayId: 'EMP-023', email: 'charles.hall@nexustech.com',      role: 'employee',   dept: 'DEPT-4', firstName: 'Charles',      lastName: 'Hall',      contact: '+1-555-0123', salary: 65500,  casual: 9,  sick: 6,  deleted: false, created: '2023-11-20', lastLogin: '2024-02-19' },
  { key: 'USER-24', displayId: 'EMP-024', email: 'dorothy.allen@nexustech.com',     role: 'manager',    dept: 'DEPT-4', firstName: 'Dorothy',      lastName: 'Allen',     contact: '+1-555-0124', salary: 91000,  casual: 16, sick: 12, deleted: false, created: '2022-12-05', lastLogin: '2024-02-18' },
  { key: 'USER-25', displayId: 'EMP-025', email: 'thomas.young@nexustech.com',      role: 'employee',   dept: 'DEPT-2', firstName: 'Thomas',       lastName: 'Young',     contact: '+1-555-0125', salary: 63500,  casual: 10, sick: 8,  deleted: false, created: '2024-01-30', lastLogin: '2024-02-16' },
  { key: 'USER-26', displayId: 'EMP-026', email: 'alice.hernandez@nexustech.com',   role: 'employee',   dept: 'DEPT-1', firstName: 'Alice',        lastName: 'Hernandez', contact: '+1-555-0126', salary: 58000,  casual: 12, sick: 9,  deleted: false, created: '2023-09-10', lastLogin: '2024-02-17' },
  { key: 'USER-27', displayId: 'EMP-027', email: 'christopher.king@nexustech.com',  role: 'employee',   dept: 'DEPT-3', firstName: 'Christopher',  lastName: 'King',      contact: '+1-555-0127', salary: 71500,  casual: 8,  sick: 5,  deleted: false, created: '2023-06-25', lastLogin: '2024-02-18' },
  { key: 'USER-28', displayId: 'EMP-028', email: 'betty.wright@nexustech.com',      role: 'employee',   dept: 'DEPT-5', firstName: 'Betty',        lastName: 'Wright',    contact: '+1-555-0128', salary: 69500,  casual: 13, sick: 10, deleted: true,  created: '2023-02-14', lastLogin: '2023-11-20' },
  { key: 'USER-29', displayId: 'EMP-029', email: 'matthew.lopez@nexustech.com',     role: 'employee',   dept: 'DEPT-4', firstName: 'Matthew',      lastName: 'Lopez',     contact: '+1-555-0129', salary: 64500,  casual: 7,  sick: 4,  deleted: false, created: '2023-10-05', lastLogin: '2024-02-19' },
  { key: 'USER-30', displayId: 'EMP-030', email: 'nancy.hill@nexustech.com',        role: 'manager',    dept: 'DEPT-3', firstName: 'Nancy',        lastName: 'Hill',      contact: '+1-555-0130', salary: 102000, casual: 19, sick: 14, deleted: false, created: '2022-07-30', lastLogin: '2024-02-18' },
  { key: 'USER-31', displayId: 'EMP-031', email: 'anthony.scott@nexustech.com',     role: 'employee',   dept: 'DEPT-1', firstName: 'Anthony',      lastName: 'Scott',     contact: '+1-555-0131', salary: 61500,  casual: 11, sick: 8,  deleted: false, created: '2023-12-20', lastLogin: '2024-02-15' },
  { key: 'USER-32', displayId: 'EMP-032', email: 'karen.green@nexustech.com',       role: 'employee',   dept: 'DEPT-2', firstName: 'Karen',        lastName: 'Green',     contact: '+1-555-0132', salary: 67500,  casual: 10, sick: 9,  deleted: false, created: '2023-05-28', lastLogin: '2024-02-18' },
];

const users = rawUsers.map(u => ({
  _id:          userIds[u.key],
  orgId,
  displayId:    u.displayId,
  email:        u.email,
  passwordHash: MOCK_PASSWORD,
  role:         u.role,
  departmentId: deptIds[u.dept],
  profile: {
    firstName:     u.firstName,
    lastName:      u.lastName,
    contactNumber: u.contact,
    avatarUrl:     `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.firstName}`,
  },
  financial: {
    baseSalary: u.salary,
    currency:   'USD',
  },
  leaveBalances: {
    casual: u.casual,
    sick:   u.sick,
  },
  isDeleted: u.deleted,
  createdAt: new Date(u.created),
  lastLogin: new Date(u.lastLogin),
}));

// ─── Leave Requests ───────────────────────────────────────────────────────────
const leaves = [
  {
    _id:          new mongoose.Types.ObjectId('eeeeeeeeeeeeeeeeeeee0001'),
    orgId,
    employeeId:   userIds['USER-2'],
    departmentId: deptIds['DEPT-2'],
    employeeName: 'John Doe',
    type:         'casual_leave',
    status:       'pending',
    dates: {
      startDate: new Date('2024-02-25'),
      endDate:   new Date('2024-02-27'),
      totalDays: 3,
    },
    reason:    'Family vacation',
    createdAt: new Date('2024-02-15'),
  },
  {
    _id:          new mongoose.Types.ObjectId('eeeeeeeeeeeeeeeeeeee0002'),
    orgId,
    employeeId:   userIds['USER-2'],
    departmentId: deptIds['DEPT-2'],
    employeeName: 'John Doe',
    type:         'sick_leave',
    status:       'approved',
    dates: {
      startDate: new Date('2024-02-05'),
      endDate:   new Date('2024-02-05'),
      totalDays: 1,
    },
    reason: 'Medical appointment',
    workflow: {
      actionedBy: userIds['USER-1'],
      actionedAt: new Date('2024-02-04'),
      comments:   'Approved for medical reasons',
    },
    createdAt: new Date('2024-02-03'),
  },
];

// ─── Counters ─────────────────────────────────────────────────────────────────
const counters = [
  { _id: 'ORG-1001_employee_seq', sequenceValue: 32 }, // Last EMP-032
];

// ============================================================================
// Seeder
// ============================================================================
const seed = async () => {
  try {
    await connectDB();
    console.log('\n Starting seed...\n');

    // ── Wipe existing data (order matters — children before parents) ──────────
    console.log('🗑️  Clearing existing collections...');
    await LeaveRequest.deleteMany({});
    await User.deleteMany({});
    await Department.deleteMany({});
    await Organization.deleteMany({});
    await Counter.deleteMany({});
    console.log(' All collections cleared\n');

    // ── Insert in dependency order ────────────────────────────────────────────

    // 1. Organizations
    await Organization.insertMany(organizations);
    console.log(` Organizations : ${organizations.length} inserted`);

    // 2. Departments (need orgId)
    //    insertMany bypasses the unique index check per-document so we use
    //    ordered:true (default) to stop on first duplicate
    await Department.insertMany(departments);
    console.log(`  Departments   : ${departments.length} inserted`);

    // 3. Users (need orgId + departmentId)
    //    passwordHash has select:false — insertMany still writes it
    await User.collection.insertMany(users); // bypass Mongoose middleware so select:false doesn't strip the field
    console.log(` Users         : ${users.length} inserted`);

    // 4. Leave Requests (need orgId + employeeId + departmentId)
    await LeaveRequest.insertMany(leaves);
    console.log(`   Leave requests: ${leaves.length} inserted`);

    // 5. Counters
    await Counter.insertMany(counters);
    console.log(`  Counters      : ${counters.length} inserted`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n Seed complete!\n');
    console.log('─────────────────────────────────────────');
    console.log('  Login with: sarah.johnson@nexustech.com');
    console.log('  Password:   any string (mock auth)     ');
    console.log('─────────────────────────────────────────\n');

  } catch (err) {
    console.error('\n Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
    process.exit(0);
  }
};

seed();