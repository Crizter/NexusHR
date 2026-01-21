
import { checkPermission } from "../auth/rbac.js";
import { PERMISSIONS } from "../config.js";
// opening the database
export const connectToDb = async (version) => {
  return await openConnection("NEXUSHR_VAULT", version);
};

export async function openConnection(dbName, version = 1) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      //  users  and sync queue object store for the database
      if (!db.objectStoreNames.contains("users")) {
        const userStore = db.createObjectStore("users", { keyPath: "id" });
        // create the index roleIndex with keyproperty
        userStore.createIndex("roleIndex", "role", { unique: false });
        userStore.createIndex("emailIndex", "email", { unique: true });
        userStore.createIndex("deptIndex", "department", { unique: false });
      }
      // sync queue for offline management
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "idemPotencyKey" });
      }
      // department
      if (!db.objectStoreNames.contains("department")) {
        db.createObjectStore("department", { keyPath: "deptId" });
      }

      // leave_request store for employee leaves
      if (!db.objectStoreNames.contains("leave_requests")) {
        const leaveStore = db.createObjectStore("leave_requests", {
          keyPath: "requestId",
        });
        leaveStore.createIndex("statusIndex", "status", { unique: false });
        leaveStore.createIndex("employeeIndex", "employeeId", {
          unique: false,
        });
      }
      // messages store for managing the chats
      if (!db.objectStoreNames.contains("messages")) {
        const messageStore = db.createObjectStore("messages", {
          keyPath: "messageId",
        });
        messageStore.createIndex("conversationIndex", "conversationId", {
          unique: false,
        });
      }
      // payroll store
      //             userid
      // payrolll id :
      // baseSalary :
      // currency :
      // taxBrackets:
      // bankDetails {
      //     bankName :
      //     accountNumber :
      // }
      // payrollHistory : {
      //     [
      //     id :
      //     month:
      // generatedAt :
      //     calculations :
      //         {
      //             grossPay :
      //             taxDeduct :
      //                 netPay :
      //         }
      //     ]

      // }
      // salarySlip_Blob : binaryPdf
      if (!db.objectStoreNames.contains("payroll")) {
        const payrollStore = db.createObjectStore("payroll", {
          keyPath: "payrollId",
        });
        payrollStore.createIndex("userIndex", "userId", { unique: true });
      }
      // credentials store to manage user credentials
      // userId
      // email
      // password
      if (!db.objectStoreNames.contains("credentials")) {
        const credentialStore = db.createObjectStore("credentials", {
          keyPath: "email",
        });
        credentialStore.createIndex("emailIndex", "email");
      }
    };
    request.onsuccess = (event) => {
      console.log("Database initialized successfully.");
      resolve(event.target.result);
    };
    request.onerror = () => reject(request.error);
  });
}

// transactions
// send employee data and edit it
export const updateEmployee = async (db, currentUserRole, employeeData) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit.");
  }
  // open transaction
  const userStore = db.transaction(["users"], "readwrite").objectStore("users");
  //action
  return new Promise((resolve, reject) => {
    const request = userStore.put(employeeData);
    request.onsuccess = () => resolve("Update successful");
    request.onerror = () => reject("Update failed.");
  });
};

// get all employees
export const getAllEmployees = async (db) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users"], "readonly");
    const objectStore = transaction.objectStore("users");
    const objectStoreRequest = objectStore.getAll(); // get all the users
    objectStoreRequest.onsuccess = (e) => {
      resolve(objectStoreRequest.result);
    };
    objectStoreRequest.onerror = () => {
      reject(objectStoreRequest.error);
    };
  });
};

// get employee by id
export const getEmployeeById = async (db, id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users"], "readonly");
    const objectStore = transaction.objectStore("users");
    const objectStoreRequest = objectStore.get(id);
    objectStoreRequest.onsuccess = () => {
      resolve(objectStoreRequest.result);
    };
    objectStoreRequest.onerror = () => {
      reject(objectStoreRequest.error);
    };
  });
};
export const addUserCredentials = async (db, credentialsData, currentUserRole) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to add credentials.");
  }
  
  const credStore = db.transaction(["credentials"], "readwrite").objectStore("credentials");
  
  return new Promise((resolve, reject) => {
    const request = credStore.add(credentialsData);
    request.onsuccess = () => resolve("Credentials added successfully");
    request.onerror = (event) => {
      if (event.target.error.name === "ConstraintError") {
        reject(new Error("Email already exists"));
      } else {
        reject(new Error("Failed to add credentials"));
      }
    };
  });
};
// clear the store
// only for superadmin role
export const clearStore = async (db, currentUserRole) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.CLEAR_DIRECTORY)) {
    throw new Error("Access Denied: You do not have permission to delete.");
  }
  const userStore = db.transaction(["users"], "readwrite").objectStore("users");
  // action
  return new Promise((resolve, reject) => {
    const request = userStore.clear();
    request.onsuccess = () => resolve("Deleted successfully");
    request.onerror = () => reject("Failed to clear");
  });
};

// add data in sync queue
export const updateSyncQueue = async (
  db,
  currentUserRole,
  idemPotencyKey,
  operationType, 
  data,
) => {
  // check for the permission if its allowed to update
  if (!checkPermission(currentUserRole, "edit_record")) {
    throw new Error("Access Denied: You do not have permission to edit");
  }
  // get a queue object store and start a transaction
  const queueStore = db
    .transaction(["syncQueue"], "readwrite")
    .objectStore("syncQueue");
  // action
  return new Promise((resolve, reject) => {
    const recordToSave = {
      operationType: operationType, 
      data: data, 
      timeStamp:Date.now(),
      idemPotencyKey: idemPotencyKey,
    };
    // if it already exists then it won't update
    const request = queueStore.add(recordToSave);
    request.onsuccess = () => resolve("Added to sync queue");
    request.onerror = (event) => {
      if (event.target.error.name === "ConstraintError") {
        resolve("Duplicate found. Skipping add");
      } else {
        reject("Failed to add to queue.");
      }
    };
  });
};

export const seedDatabase = async (db) => {
  return new Promise((resolve, reject) => {
    // We run two transactions: one for Users, one for Departments
    // This ensures they don't block each other

    // --- 1. SEED DEPARTMENTS ---
    const deptTx = db.transaction(["department"], "readwrite");
    const deptStore = deptTx.objectStore("department");

    const deptCountReq = deptStore.count();

    deptCountReq.onsuccess = () => {
      if (deptCountReq.result === 0) {
        console.log(" Seeding Departments...");

        const departments = [
          { deptId: "DEP-001", deptName: "Sales" },
          { deptId: "DEP-002", deptName: "Tech" },
          { deptId: "DEP-003", deptName: "Operations" },
          { deptId: "DEP-004", deptName: "Support" },
        ];

        departments.forEach((dept) => {
          deptStore.add(dept);
        });
        console.log(" Departments seeded successfully.");
      }
    };

    const credTx = db.transaction(["credentials"], "readwrite");
    const credStore = credTx.objectStore("credentials");
    const credCountReq = credStore.count();

    credCountReq.onsuccess = () => {
      if (credCountReq.result === 0) {
        console.log("Seeding Credentials...");

        const credentials = [
          {
            email: "sarah@nexushr.com",
            password: "sarah123",
            userId: "sarah-unique-id", // You might want to match this with actual user IDs
          },
          {
            email: "john@nexushr.com",
            password: "john123",
            userId: "john-unique-id",
          },
        ];

        credentials.forEach((cred) => {
          credStore.add(cred);
        });
        console.log("Credentials seeded successfully.");
      }
    };

    // --- 2. SEED USERS (Your existing logic) ---
    // We verify users exist, if not we add them using the NEW schema structure
    const userTx = db.transaction(["users"], "readwrite");
    const userStore = userTx.objectStore("users");
    const userCountReq = userStore.count();

    userCountReq.onsuccess = () => {
      if (userCountReq.result === 0) {
        console.log("Seeding Users...");

        // Example Seed User matching your NEW Complex Schema
        const seedUsers = [
          {
            id: crypto.randomUUID(),
            identity: {
              firstName: "Sarah",
              lastName: "Connor",
              contactNumber: "555-0199",
              address: { city: "Los Angeles" },
            },
            role: "hr_manager",
            department: { deptId: "DEP-003", deptName: "Operations" }, // Matches Dept Store
            email: "sarah@nexushr.com",
            isDeleted: false,
            attendance: {
              status: "active",
              lastLogin: Date.now(),
              logs: [],
            },
            skills: ["Management", "Recruiting"],
            financial: {
              baseSalary: 85000,
              currency: "USD",
              taxBrackets: "tier_2",
              bankDetail: { bankName: "Chase", accountNumber: "****1234" },
            },
          },
          // Add a Tech Employee
          {
            id: crypto.randomUUID(),
            identity: {
              firstName: "John",
              lastName: "Doe",
              contactNumber: "555-0200",
              address: { city: "New York" },
            },
            role: "employee",
            department: { deptId: "DEP-002", deptName: "Tech" },
            email: "john@nexushr.com",
            isDeleted: false,
            attendance: { status: "active", lastLogin: Date.now(), logs: [] },
            skills: ["JavaScript", "React", "Node.js"],
            financial: {
              baseSalary: 65000,
              currency: "USD",
              taxBrackets: "tier_1",
              bankDetail: { bankName: "Citi", accountNumber: "****5678" },
            },
          },
        ];

        seedUsers.forEach((user) => {
          userStore.add(user);
        });
        console.log("Users seeded successfully.");
      }

      // Resolve the Promise when transactions are done
      userTx.oncomplete = () => resolve();
    };

    userTx.onerror = (e) => reject(e);
  });
};
