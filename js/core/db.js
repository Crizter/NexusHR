
import { checkPermission } from "../auth/rbac.js";
import { PERMISSIONS } from "../config.js";
import { generateUUID } from "../utils/crypto.js";


const DB_NAME = 'NexusDB';
const DB_VERSION = 6;


let dbInstance = null;
let connectionPromise = null;

/**
 * Singleton Database Connection
 * Returns the same database instance across all modules
 */
export const connectToDb = async () => {
  
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  
  
  if (connectionPromise) {
    return connectionPromise;
  }
  
  
  connectionPromise = openConnection();
  
  try {
    dbInstance = await connectionPromise;
    return dbInstance;
  } catch (error) {
    
    connectionPromise = null;
    throw error;
  } finally {
    
    connectionPromise = null;
  }
};

/**
 * Internal function to open IndexedDB connection
 */
async function openConnection() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;
      
      console.log(`[DB] Upgrading database from version ${oldVersion} to ${newVersion}`);

      
      if (!db.objectStoreNames.contains("users")) {
        const userStore = db.createObjectStore("users", { keyPath: "id" });
        userStore.createIndex("roleIndex", "role", { unique: false });
        userStore.createIndex("emailIndex", "email", { unique: true });
        userStore.createIndex("deptIndex", "department", { unique: false });
        userStore.createIndex("usernameIndex", "username", { unique: false });
        console.log("[DB] Created 'users' object store");
      }

      
      if (!db.objectStoreNames.contains("payroll")) {
        const payrollStore = db.createObjectStore("payroll", { keyPath: "payrollId" });
        payrollStore.createIndex("userIndex", "userId", { unique: true });
        console.log("[DB] Created 'payroll' object store");
      }

      
      if (!db.objectStoreNames.contains("announcement")) {
        const announcementStore = db.createObjectStore("announcement", { keyPath: "id" });
        announcementStore.createIndex("priorityIndex", "priority", { unique: false });
        announcementStore.createIndex("dateIndex", "date", { unique: false });
        announcementStore.createIndex("authorIndex", "author", { unique: false });
        console.log("[DB] Created 'announcement' object store");
      }

      
      if (!db.objectStoreNames.contains("holidays")) {
        const holidayStore = db.createObjectStore("holidays", { keyPath: "id" });
        holidayStore.createIndex("dateIndex", "date", { unique: true });
        holidayStore.createIndex("typeIndex", "type", { unique: false });
        console.log("[DB] Created 'holidays' object store");
      }

      
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "idemPotencyKey" });
        console.log("[DB] Created 'syncQueue' object store");
      }

      if (!db.objectStoreNames.contains("department")) {
        db.createObjectStore("department", { keyPath: "deptId" });
        console.log("[DB] Created 'department' object store");
      }

      if (!db.objectStoreNames.contains("leave_requests")) {
        const leaveStore = db.createObjectStore("leave_requests", { keyPath: "requestId" });
        leaveStore.createIndex("statusIndex", "status", { unique: false });
        leaveStore.createIndex("employeeIndex", "employeeId", { unique: false });
        console.log("[DB] Created 'leave_requests' object store");
      }

      if (!db.objectStoreNames.contains("messages")) {
        const messageStore = db.createObjectStore("messages", { keyPath: "messageId" });
        messageStore.createIndex("conversationIndex", "conversationId", { unique: false });
        console.log("[DB] Created 'messages' object store");
      }

      if (!db.objectStoreNames.contains("credentials")) {
        const credentialStore = db.createObjectStore("credentials", { keyPath: "email" });
        credentialStore.createIndex("emailIndex", "email", { unique: true });
        credentialStore.createIndex("userIdIndex", "userId", { unique: false });
        console.log("[DB] Created 'credentials' object store");
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log(`[DB] Database '${DB_NAME}' version ${DB_VERSION} initialized successfully`);
      
      
      db.onversionchange = () => {
        console.warn("[DB] Database version changed in another tab. Closing connection.");
        db.close();
        
        dbInstance = null;
        connectionPromise = null;
      };
      
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("[DB] Database connection failed:", event.target.error);
      reject(new Error(`Database connection failed: ${event.target.error.message}`));
    };

    request.onblocked = () => {
      console.warn("[DB] Database upgrade blocked by another connection");
      reject(new Error("Database upgrade blocked. Please close other tabs and try again."));
    };
  });
}

/**
 * Close database connection and reset singleton
 * Useful for testing or manual cleanup
 */
export const closeDbConnection = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    connectionPromise = null;
    console.log("[DB] Database connection closed");
  }
};

/**
 * Get database info
 */
export const getDbInfo = () => {
  return {
    name: DB_NAME,
    version: DB_VERSION,
    isConnected: !!dbInstance,
    isPending: !!connectionPromise
  };
};




export const updateEmployee = async (db, currentUserRole, employeeData) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit.");
  }
  
  const userStore = db.transaction(["users"], "readwrite").objectStore("users");
  
  return new Promise((resolve, reject) => {
    const request = userStore.put(employeeData);
    request.onsuccess = () => resolve("Update successful");
    request.onerror = () => reject(new Error("Update failed"));
  });
};

export const getAllEmployees = async (db) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users"], "readonly");
    const objectStore = transaction.objectStore("users");
    const objectStoreRequest = objectStore.getAll();
    
    objectStoreRequest.onsuccess = () => {
      resolve(objectStoreRequest.result);
    };
    
    objectStoreRequest.onerror = () => {
      reject(new Error("Failed to fetch employees"));
    };
  });
};

export const getEmployeeById = async (db, id) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users"], "readonly");
    const objectStore = transaction.objectStore("users");
    const objectStoreRequest = objectStore.get(id);
    
    objectStoreRequest.onsuccess = () => {
      resolve(objectStoreRequest.result);
    };
    
    objectStoreRequest.onerror = () => {
      reject(new Error("Failed to fetch employee"));
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

export const clearStore = async (db, currentUserRole) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.CLEAR_DIRECTORY)) {
    throw new Error("Access Denied: You do not have permission to delete.");
  }
  
  const userStore = db.transaction(["users"], "readwrite").objectStore("users");
  
  return new Promise((resolve, reject) => {
    const request = userStore.clear();
    request.onsuccess = () => resolve("Deleted successfully");
    request.onerror = () => reject(new Error("Failed to clear store"));
  });
};

export const updateSyncQueue = async (db, currentUserRole, idemPotencyKey, operationType, data) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit");
  }
  
  const queueStore = db.transaction(["syncQueue"], "readwrite").objectStore("syncQueue");
  
  return new Promise((resolve, reject) => {
    const recordToSave = {
      operationType,
      data,
      timeStamp: Date.now(),
      idemPotencyKey
    };
    
    const request = queueStore.add(recordToSave);
    request.onsuccess = () => resolve("Added to sync queue");
    request.onerror = (event) => {
      if (event.target.error.name === "ConstraintError") {
        resolve("Duplicate found. Skipping add");
      } else {
        reject(new Error("Failed to add to queue"));
      }
    };
  });
};

export const updateEmployeeAttendance = async (db, currentUserRole, userId, attendanceData) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.ADD_ATTENDANCE)) {
    throw new Error("Access Denied: You do not have permissions");
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["users"], "readwrite");
    const userStore = transaction.objectStore("users");
    
    const getUserRequest = userStore.get(userId);
    
    getUserRequest.onsuccess = () => {
      const currentUser = getUserRequest.result;
      if (!currentUser) {
        reject(new Error("User not found"));
        return;
      }
      
      const updatedUser = {
        ...currentUser,
        attendance: attendanceData,
        lastUpdated: Date.now()
      };

      const updateRequest = userStore.put(updatedUser);
      updateRequest.onsuccess = () => resolve(updatedUser);
      updateRequest.onerror = () => reject(new Error("Failed to update attendance"));
    };
    
    getUserRequest.onerror = () => reject(new Error("Failed to retrieve user"));
  });
};

export const addAnnouncements = async (db, currentUserRole, announcementData) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit");
  }
  
  const tx = db.transaction(["announcement"], 'readwrite');
  const announcementStore = tx.objectStore("announcement");
  
  const updatedData = {
    ...announcementData,
    id: generateUUID(),
    date: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const request = announcementStore.add(updatedData);
    request.onsuccess = () => resolve(updatedData);
    request.onerror = () => reject(new Error("Failed to add announcement"));
  });
};

export const getAnnouncements = async (db, currentUserRole) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.VIEW_RECORD)) {
    throw new Error("Access Denied: You do not have permission to view");
  }
  
  const tx = db.transaction(["announcement"], 'readonly');
  const announcementStore = tx.objectStore("announcement");
  
  return new Promise((resolve, reject) => {
    const request = announcementStore.getAll();
    request.onsuccess = () => {
      const sorted = request.result.sort((a, b) => b.date - a.date);
      resolve(sorted);
    };
    request.onerror = () => reject(new Error("Failed to fetch announcements"));
  });
};

export const addHoliday = async (db, currentUserRole, holidayData) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit");
  }

  const tx = db.transaction(["holidays"], 'readwrite');
  const store = tx.objectStore("holidays");

  const newHoliday = {
    id: generateUUID(),
    name: holidayData.name,
    date: holidayData.date,
    type: holidayData.type || "public",
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const req = store.add(newHoliday);
    req.onsuccess = () => resolve(newHoliday);
    req.onerror = () => reject(new Error("Failed to add holiday"));
  });
};

export const getHolidays = async (db, currentUserRole) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.VIEW_RECORD)) {
    throw new Error("Access Denied: You do not have permission to view");
  }
  
  const tx = db.transaction(["holidays"], 'readonly');
  const store = tx.objectStore("holidays");
  
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const sorted = req.result.sort((a, b) => new Date(a.date) - new Date(b.date));
      resolve(sorted);
    };
    req.onerror = () => reject(new Error("Failed to fetch holidays"));
  });
};

export const seedDatabase = async (db) => {
  return new Promise((resolve, reject) => {
    try {
      // Seed Departments
      const deptTx = db.transaction(["department"], "readwrite");
      const deptStore = deptTx.objectStore("department");
      const deptCountReq = deptStore.count();

      deptCountReq.onsuccess = () => {
        if (deptCountReq.result === 0) {
          console.log("[DB] Seeding Departments...");
          
          const departments = [
            { deptId: "DEP-001", deptName: "Sales" },
            { deptId: "DEP-002", deptName: "Tech" },
            { deptId: "DEP-003", deptName: "Operations" },
            { deptId: "DEP-004", deptName: "Support" }
          ];

          departments.forEach((dept) => deptStore.add(dept));
          console.log("[DB] Departments seeded successfully");
        }
      };

      // Seed Credentials
      const credTx = db.transaction(["credentials"], "readwrite");
      const credStore = credTx.objectStore("credentials");
      const credCountReq = credStore.count();

      credCountReq.onsuccess = () => {
        if (credCountReq.result === 0) {
          console.log("[DB] Seeding Credentials...");
          
          const credentials = [
            {
              email: "sarah@nexushr.com",
              password: "sarah123",
              userId: "sarah-unique-id"
            },
            {
              email: "john@nexushr.com",
              password: "john123",
              userId: "john-unique-id"
            }
          ];

          credentials.forEach((cred) => credStore.add(cred));
          console.log("[DB] Credentials seeded successfully");
        }
      };

      // Seed Users
      const userTx = db.transaction(["users"], "readwrite");
      const userStore = userTx.objectStore("users");
      const userCountReq = userStore.count();

      userCountReq.onsuccess = () => {
        if (userCountReq.result === 0) {
          console.log("[DB] Seeding Users...");
          
          const seedUsers = [
            {
              id: crypto.randomUUID(),
              identity: {
                firstName: "Sarah",
                lastName: "Connor",
                contactNumber: "555-0199",
                address: { city: "Los Angeles" }
              },
              role: "hr_manager",
              department: { deptId: "DEP-003", deptName: "Operations" },
              email: "sarah@nexushr.com",
              isDeleted: false,
              attendance: {
                status: "active",
                lastLogin: Date.now(),
                logs: []
              },
              skills: ["Management", "Recruiting"],
              financial: {
                baseSalary: 85000,
                currency: "USD",
                taxBrackets: "tier_2",
                bankDetail: { bankName: "Chase", accountNumber: "****1234" }
              }
            },
            {
              id: crypto.randomUUID(),
              identity: {
                firstName: "John",
                lastName: "Doe",
                contactNumber: "555-0200",
                address: { city: "New York" }
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
                bankDetail: { bankName: "Citi", accountNumber: "****5678" }
              }
            }
          ];

          seedUsers.forEach((user) => userStore.add(user));
          console.log("[DB] Users seeded successfully");
        }
        
        // Resolve when all seeding is complete
        userTx.oncomplete = () => resolve();
      };

      userTx.onerror = (e) => reject(e);
      
    } catch (error) {
      reject(error);
    }
  });
};