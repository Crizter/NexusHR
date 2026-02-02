import { checkPermission } from "../auth/rbac.js";
import { PERMISSIONS, LEAVE_STATUS, ROLES } from "../config.js";
import { generateUUID } from "../utils/crypto.js";
import { tryCatchAsync, tryCatchSync } from "../utils/tryCatch.js";

const DB_NAME = "NexusDB";
const DB_VERSION = 9;

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

      if (!db.objectStoreNames.contains("users")) {
        const userStore = db.createObjectStore("users", { keyPath: "id" });
        userStore.createIndex("roleIndex", "role", { unique: false });
        userStore.createIndex("emailIndex", "email", { unique: true });
        userStore.createIndex("deptIndex", "department", { unique: false });
        userStore.createIndex("usernameIndex", "username", { unique: false });
      }

      if (!db.objectStoreNames.contains("payroll")) {
        const payrollStore = db.createObjectStore("payroll", {
          keyPath: "payrollId",
        });
        payrollStore.createIndex("userIndex", "userId", { unique: true });
      }
      if (!db.objectStoreNames.contains("counter")) {
        const counterStore = db.createObjectStore("counter", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("announcement")) {
        const announcementStore = db.createObjectStore("announcement", {
          keyPath: "id",
        });
        announcementStore.createIndex("priorityIndex", "priority", {
          unique: false,
        });
        announcementStore.createIndex("dateIndex", "date", { unique: false });
        announcementStore.createIndex("authorIndex", "author", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains("holidays")) {
        const holidayStore = db.createObjectStore("holidays", {
          keyPath: "id",
        });
        holidayStore.createIndex("dateIndex", "date", { unique: true });
        holidayStore.createIndex("typeIndex", "type", { unique: false });
      }

      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "idemPotencyKey" });
      }

      if (!db.objectStoreNames.contains("department")) {
        db.createObjectStore("department", { keyPath: "deptId" });
      }

      if (!db.objectStoreNames.contains("leave_requests")) {
        const leaveStore = db.createObjectStore("leave_requests", {
          keyPath: "id",
        });
        leaveStore.createIndex("statusIndex", "status", { unique: false });
        leaveStore.createIndex("employeeIndex", "employeeId", {
          unique: false,
        });
        leaveStore.createIndex("deptIndex", "deptId", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains("messages")) {
        const messageStore = db.createObjectStore("messages", {
          keyPath: "messageId",
        });
        messageStore.createIndex("conversationIndex", "conversationId", {
          unique: false,
        });
      }

      if (!db.objectStoreNames.contains("credentials")) {
        const credentialStore = db.createObjectStore("credentials", {
          keyPath: "email",
        });
        credentialStore.createIndex("emailIndex", "email", { unique: true });
        credentialStore.createIndex("userIdIndex", "userId", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      db.onversionchange = () => {
        console.warn(
          "[DB] Database version changed in another tab. Closing connection.",
        );
        db.close();

        dbInstance = null;
        connectionPromise = null;
      };

      resolve(db);
    };

    request.onerror = (event) => {
      console.error("[DB] Database connection failed:", event.target.error);
      reject(
        new Error(`Database connection failed: ${event.target.error.message}`),
      );
    };

    request.onblocked = () => {
      console.warn("[DB] Database upgrade blocked by another connection");
      reject(
        new Error(
          "Database upgrade blocked. Please close other tabs and try again.",
        ),
      );
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
    console.log("Database connection closed");
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
    isPending: !!connectionPromise,
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

export const addUserCredentials = async (
  db,
  credentialsData,
  currentUserRole,
) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error(
      "Access Denied: You do not have permission to add credentials.",
    );
  }

  const credStore = db
    .transaction(["credentials"], "readwrite")
    .objectStore("credentials");

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

export const updateSyncQueue = async (
  db,
  currentUserRole,
  idemPotencyKey,
  operationType,
  data,
) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit");
  }

  const queueStore = db
    .transaction(["syncQueue"], "readwrite")
    .objectStore("syncQueue");

  return new Promise((resolve, reject) => {
    const recordToSave = {
      operationType,
      data,
      timeStamp: Date.now(),
      idemPotencyKey,
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

export const updateEmployeeAttendance = async (
  db,
  currentUserRole,
  userId,
  attendanceData,
) => {
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
        lastUpdated: Date.now(),
      };

      const updateRequest = userStore.put(updatedUser);
      updateRequest.onsuccess = () => resolve(updatedUser);
      updateRequest.onerror = () =>
        reject(new Error("Failed to update attendance"));
    };

    getUserRequest.onerror = () => reject(new Error("Failed to retrieve user"));
  });
};

export const addAnnouncements = async (
  db,
  currentUserRole,
  announcementData,
) => {
  if (!checkPermission(currentUserRole, PERMISSIONS.EDIT_RECORD)) {
    throw new Error("Access Denied: You do not have permission to edit");
  }

  const tx = db.transaction(["announcement"], "readwrite");
  const announcementStore = tx.objectStore("announcement");

  const updatedData = {
    ...announcementData,
    id: generateUUID(),
    date: Date.now(),
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

  const tx = db.transaction(["announcement"], "readonly");
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

  const tx = db.transaction(["holidays"], "readwrite");
  const store = tx.objectStore("holidays");

  const newHoliday = {
    id: generateUUID(),
    name: holidayData.name,
    date: holidayData.date,
    type: holidayData.type || "public",
    createdAt: Date.now(),
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

  const tx = db.transaction(["holidays"], "readonly");
  const store = tx.objectStore("holidays");

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const sorted = req.result.sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
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
            { deptId: "DEP-004", deptName: "Support" },
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
              userId: "sarah-unique-id",
            },
            {
              email: "john@nexushr.com",
              password: "john123",
              userId: "john-unique-id",
            },
          ];

          credentials.forEach((cred) => credStore.add(cred));
          console.log("[DB] Credentials seeded successfully");
        }
      };

      // Seed Counter and Users
      const userTx = db.transaction(["users", "counter"], "readwrite");
      const userStore = userTx.objectStore("users");
      const counterStore = userTx.objectStore("counter");
      const userCountReq = userStore.count();

      userCountReq.onsuccess = () => {
        if (userCountReq.result === 0) {
          console.log("[DB] Seeding Counter and Users...");

          //  initialize the counter
          const counterData = { id: "employee_counter", val: 0 };
          const counterReq = counterStore.add(counterData);

          counterReq.onsuccess = () => {
            console.log("[DB] Counter initialized successfully");

            // Now seed users with displayId
            const seedUsers = [
              {
                id: crypto.randomUUID(),
                displayId: "POS-1", // First employee
                identity: {
                  firstName: "Sarah",
                  lastName: "Connor",
                  contactNumber: "555-0199",
                  address: { city: "Los Angeles" },
                },
                role: "hr_manager",
                department: { deptId: "DEP-003", deptName: "Operations" },
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
              {
                id: crypto.randomUUID(),
                displayId: "POS-2", // Second employee
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

            // Add users to the store
            seedUsers.forEach((user) => userStore.add(user));
            console.log("[DB] Users seeded successfully with displayId");

            // Update counter to reflect the number of users added
            const updateCounterData = { id: "employee_counter", val: 2 };
            const updateCounterReq = counterStore.put(updateCounterData);

            updateCounterReq.onsuccess = () => {
              console.log("[DB] Counter updated to 2");
            };

            updateCounterReq.onerror = (e) => {
              console.error("[DB] Failed to update counter:", e.target.error);
            };
          };

          counterReq.onerror = (e) => {
            console.error("[DB] Failed to initialize counter:", e.target.error);
            reject(e.target.error);
          };
        }

        // Resolve when all seeding is complete
        userTx.oncomplete = () => {
          console.log("[DB] All seeding operations completed successfully");
          resolve();
        };
      };

      userTx.onerror = (e) => reject(e);
    } catch (error) {
      reject(error);
    }
  });
};

export const applyLeave = async (db, currentUserRole, userId, payload) => {
  if (!db || !userId) {
    return;
  }
  if (!checkPermission(currentUserRole, PERMISSIONS.APPLY_LEAVE)) {
    throw new Error("Access Denied: You do not have permission to add.");
  }

  const data = {
    id: payload.id,
    employeeId: userId,
    type: payload.type,
    // Flatten the department structure to avoid nested object issues
    deptId: payload.deptId,
    deptName: payload.deptName,
    reason: payload.reason,
    startDate: payload.date.startDate,
    endDate: payload.date.endDate,
    status: payload.status,
    timestamp: Date.now(),
  };

  const [error, successMsg] = await tryCatchAsync(
    new Promise((resolve, reject) => {
      const tx = db.transaction(["leave_requests"], "readwrite");
      const store = tx.objectStore("leave_requests");

      // First, check if ID already exists
      const checkReq = store.get(data.id);

      checkReq.onsuccess = () => {
        if (checkReq.result) {
          console.error("[DB] Duplicate ID detected:", data.id);
          reject(new Error(`Leave request with ID ${data.id} already exists`));
          return;
        }

        // Ensure all data types are correct for the flattened structure
        const sanitizedData = {
          id: String(data.id),
          employeeId: String(data.employeeId),
          type: String(data.type),
          deptId: String(data.deptId),
          deptName: String(data.deptName),
          reason: String(data.reason),
          startDate: String(data.startDate),
          endDate: String(data.endDate),
          status: String(data.status),
          timestamp: Number(data.timestamp),
        };

        const req = store.add(sanitizedData);

        req.onsuccess = () => {
          resolve("Leave successfully applied");
        };

        req.onerror = (e) => {
          console.error("[DB] IndexedDB add failed with detailed info:", {
            error: e.target.error,
            errorName: e.target.error?.name,
            errorMessage: e.target.error?.message,
            errorCode: e.target.error?.code,
            originalData: data,
            sanitizedData: sanitizedData,
            objectStoreName: store.name,
            keyPath: store.keyPath,
            indexNames: Array.from(store.indexNames),
          });

          // Try to provide more specific error messages
          if (e.target.error?.name === "ConstraintError") {
            reject(
              new Error(
                `Constraint violation: Possible duplicate key or invalid data structure`,
              ),
            );
          } else if (e.target.error?.name === "DataError") {
            reject(new Error(`Data error: Invalid data type or structure`));
          } else if (e.target.error?.name === "InvalidStateError") {
            reject(new Error(`Invalid state: Transaction may be inactive`));
          } else {
            reject(
              new Error(
                `Failed to add leave: ${e.target.error?.message || "Unknown IndexedDB error"}`,
              ),
            );
          }
        };
      };

      checkReq.onerror = (e) => {
        console.error("[DB] Error checking for existing ID:", e.target.error);
        reject(
          new Error(
            `Failed to check for duplicate ID: ${e.target.error?.message}`,
          ),
        );
      };
    }),
  );

  if (error) {
    console.error("Failed to apply for leave:", error);
    throw error;
  }
  return successMsg;
};

export const getLeavesByEmployee = async (db, userId) => {
  if (!db || !userId) {
    return;
  }
  const [error, leaves] = await tryCatchAsync(
    new Promise((resolve, reject) => {
      const tx = db.transaction(["leave_requests"], "readonly");
      const store = tx.objectStore("leave_requests");
      const index = store.index("employeeIndex");
      const request = index.getAll(userId);

      request.onsuccess = () => {
        //  Sort by date descending (Newest first)
        const sorted = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted);
      };
      request.onerror = (e) =>
        reject(`Failed to fetch leaves: ${e.target.error}`);
    }),
  );
  if (error) {
    console.error("Error getting leaves:", error);
    return [];
  }
  return leaves;
};

export const getLeavesByHr = async (db, userRole, hrDeptId) => {
  if (!checkPermission(userRole, PERMISSIONS.VIEW_RECORD)) {
    console.error("Access Denied: User role cannot view leave records.");
    return [];
  }

  const [error, leaves] = await tryCatchAsync(
    new Promise((resolve, reject) => {
      const tx = db.transaction(["leave_requests", "users"], "readonly");
      const leaveStore = tx.objectStore("leave_requests");
      const userStore = tx.objectStore("users");

      const request = leaveStore.getAll();

      request.onsuccess = () => {
        const deptLeaves = request.result.filter((leave) => {
          return leave.deptId === hrDeptId;
        });

        if (deptLeaves.length === 0) {
          resolve([]);
          return;
        }

        const enhancedLeaves = [];
        let completed = 0;

        deptLeaves.forEach((leave, index) => {
          const getUserReq = userStore.get(leave.employeeId);

          getUserReq.onsuccess = () => {
            const user = getUserReq.result;

            const enhancedLeave = {
              ...leave,
              employeeName: user
                ? `${user.identity.firstName} ${user.identity.lastName}`
                : "Unknown Employee",
            };

            enhancedLeaves.push(enhancedLeave);
            completed++;

            // When all user lookups are complete
            if (completed === deptLeaves.length) {
              const sorted = enhancedLeaves.sort(
                (a, b) => b.timestamp - a.timestamp,
              );

              resolve(sorted);
            }
          };

          getUserReq.onerror = (e) => {
            console.error(
              `[DB] Failed to get user for employeeId ${leave.employeeId}:`,
              e.target.error,
            );

            // Even if user lookup fails, include the leave
            enhancedLeaves.push({
              ...leave,
              employeeName: "Unknown Employee",
            });
            completed++;

            if (completed === deptLeaves.length) {
              const sorted = enhancedLeaves.sort(
                (a, b) => b.timestamp - a.timestamp,
              );
              resolve(sorted);
            }
          };
        });
      };

      request.onerror = (e) => {
        console.error("[DB] Failed to get all leave requests:", e.target.error);
        reject(`Failed to fetch dept leaves: ${e.target.error}`);
      };
    }),
  );

  if (error) {
    console.error("Error getting employee leaves:", error);
    return [];
  }

  return leaves;
};

export const updateLeaveStatus = async (
  db,
  userRole,
  requestId,
  deptId,
  newStatus,
) => {
  // Validate status
  if (!Object.values(LEAVE_STATUS).includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const [error, result] = await tryCatchAsync(
    new Promise((resolve, reject) => {
      const tx = db.transaction(["leave_requests"], "readwrite");
      const store = tx.objectStore("leave_requests");
      const getReq = store.get(requestId);

      getReq.onsuccess = () => {
        const leaveReq = getReq.result;

        if (!leaveReq) {
          reject(new Error("Leave request not found"));
          return;
        }

        // Role-based validation
        if (
          leaveReq.status !== LEAVE_STATUS.PENDING &&
          userRole === ROLES.employee
        ) {
          reject(new Error("Cannot modify a processed leave request"));
          return;
        }

        // Update status
        leaveReq.status = newStatus;
        leaveReq.lastModified = Date.now();
        leaveReq.modifiedBy = userRole;

        const putReq = store.put(leaveReq);
        putReq.onsuccess = () => resolve("Leave status updated successfully");
        putReq.onerror = (e) =>
          reject(new Error(`Update failed: ${e.target.error.message}`));
      };

      getReq.onerror = (e) => {
        reject(
          new Error(
            `Failed to retrieve leave request: ${e.target.error.message}`,
          ),
        );
      };
    }),
  );

  if (error) {
    console.error("Error updating employee leave:", error);
    throw error; // Re-throw so the UI can handle it
  }

  return result;
};

// counter handler to update/retrieve the value  
export const updateCounter = (db, counterName) => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["counter"], "readwrite");
    const store = tx.objectStore("counter");
    const req = store.get(counterName);

    req.onsuccess = () => {
      let data = req.result;

      if (!data) {
        data = { id: counterName, val: 0 };
      }
      data.val++;

      const updateReq = store.put(data);

      updateReq.onsuccess = () => {
        resolve(data.val);
      };

      updateReq.onerror = () => {
        reject(updateReq.error);
      };
    };

    req.onerror = () => {
      reject("Failed to fetch counter");
    };
  });
};