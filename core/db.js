import { checkPermission } from "../auth/rbac.js";

// opening the database 
export const connectToDb = async  (version) => { 
    
    return await openConnection("NEXUSHR_VAULT", version) ;        
} ; 


export async function openConnection(dbName, version=1 ) { 
    return new Promise((resolve,reject) => { 
        const request = indexedDB.open(dbName, version) ; 

        request.onupgradeneeded = (event) => { 
            const db = event.target.result ; 
            
            //  users  and sync queue object store for the database 
            if(!db.objectStoreNames.contains("users")){
                const userStore = db.createObjectStore("users",{keyPath: "id"}) ; 
                // create the index roleIndex with keyproperty
                userStore.createIndex("roleIndex", "role", {unique: false}) ;
                userStore.createIndex("emailIndex", "email", {unique: true}) ;      
                userStore.createIndex("deptIndex", "department", {unique: false}) ;      
                
            }
            // sync queue for offline management
            if(!db.objectStoreNames.contains("sync_queue")){
                db.createObjectStore("sync_queue", {keyPath: 'idemPotencyKey'}) ; 
            }
            if(!db.objectStoreNames.contains("leave_requests")){
                const leaveStore = db.createObjectStore("leave_requests", {keyPath: 'requestId'}) ; 
                leaveStore.createIndex("statusIndex", "status", {unique:false}) ; 
                leaveStore.createIndex("employeeIndex", "employeeId", {unique:false});                             
            }
            if(!db.objectStoreNames.contains("messages")){
                const messageStore = db.createObjectStore("messages",{keyPath: 'messageId'} ) ; 
                messageStore.createIndex('conversationIndex', 'conversationId', {unique: false }) ; 
            }
            if (!db.objectStoreNames.contains('payroll')) {
                const payrollStore = db.createObjectStore('payroll', { keyPath: 'payrollId' });
                payrollStore.createIndex('userIndex', 'userId', { unique: true });
            }
            
            
        }
        request.onsuccess = (event) => { 
            console.log(
                'Database initialized successfully.'
            ) ; 
            resolve(event.target.result) ; 
        } ; 
        request.onerror = () => reject(request.error) ; 
    }) ; 
};

// transactions 
// send employee data and edit it 
export const  updateEmployee = async (db,currentUserRole,employeeData ) => { 
    if(!checkPermission(currentUserRole, 'edit_record')){ 
        throw new Error("Access Denied: You do not have permission to edit.");
    }
    // open transaction 
    const userStore = db.transaction(["users"],"readwrite").objectStore("users")   ;   
    //action
    return new Promise((resolve,reject) => { 
        const request = userStore.put(employeeData) ; 
        request.onsuccess = () => resolve('Update successful') ; 
        request.onerror = () => reject('Update failed.') ; 
    })
} ;
// clear the store 
// only for superadmin role
export const clearStore = async(db, currentUserRole, employeeId) => { 
    if(!checkPermission(currentUserRole, 'delete_record')){
        throw new Error("Access Denied: You do not have permission to delete.");
    }
    const userStore = db.transaction(["users"], "readwrite").objectStore("users") ; 
    // action
    return new Promise((resolve,reject) => { 
        const request = userStore.clear() ; 
        request.onsuccess = () => resolve('Deleted successfully'); 
        request.onerror = () => reject('Failed to clear') ;
    }) ; 
} ; 

// add data in sync queue 
export const updateSyncQueue = async(db, currentUserRole, idemPotencyKey, employeeData) => { 
    // check for the permission if its allowed to update 
    if(!checkPermission(currentUserRole, 'edit_record')){ 
        throw new Error('Access Denied: You do not have permission to edit') ; 
    }
    // get a queue object store and start a transaction 
    const queueStore = db.transaction(["syncQueue"], "readwrite").objectStore("syncQueue") ; 
    // action 
    return new Promise((resolve, reject) => { 
        const recordToSave = {
            ...employeeData,
            idemPotencyKey: idemPotencyKey, 
        }
        // if it already exists then it won't update 
        const request = queueStore.add(recordToSave) ; 
        request.onsuccess = () => resolve('Added to sync queue') ; 
        request.onerror = (event) => { 
            if(event.target.error.name === "ConstraintError"){
                resolve('Duplicate found. Skipping add') ;
            } else { 
                reject('Failed to add to queue.') ; 
            }
        }
    }); 
}; 

export const seedDatabase = async (db) => {
    const userTx = db.transaction(['users'], 'readwrite');
    const payrollTx = db.transaction(['payroll'], 'readwrite');

    const userStore = userTx.objectStore('users');
    const payrollStore = payrollTx.objectStore('payroll');

    const countRequest = userStore.count();
    
    countRequest.onsuccess = () => {
        if (countRequest.result === 0) {
            console.log("Seeding Split Database...");
            
            // --- EMPLOYEE 1: SARAH ---
            // 1. The User Profile
            userStore.add({
                id: "EMP_001",
                role: "hr_manager",
                department: "Operations",
                email: "sarah@nexushr.com",
                isDeleted: false,
                identity: {
                    firstName: "Sarah",
                    lastName: "Connor",
                    contactNumber: "555-0199",
                    // Added Identity Scans for Requirement 10
                    id_scans: [{ type: "passport", blob: "binary_placeholder" }] 
                },
                // NOTE: No financial data here anymore!
                attendance: { status: "active", logs: [] }
            });

            // 2. The Payroll Record (Linked by userId)
            payrollStore.add({
                payrollId: "PAY_001",
                userId: "EMP_001", // <--- THE LINK
                baseSalary: 85000,
                currency: "USD",
                taxBracket: "T2",
                bankDetails: { bankName: "Chase", accountNumber: "1234" },
                payrollHistory: [] // History lives here now
            });

            // --- EMPLOYEE 2: JOHN ---
            userStore.add({
                id: "EMP_002",
                role: "employee",
                department: "Tech",
                email: "john@nexushr.com",
                isDeleted: false,
                identity: { firstName: "John", lastName: "Doe" },
                attendance: { status: "inactive", logs: [] }
            });

            payrollStore.add({
                payrollId: "PAY_002",
                userId: "EMP_002",
                baseSalary: 120000,
                currency: "USD",
                taxBracket: "T1",
                bankDetails: { bankName: "BoA", accountNumber: "5678" },
                payrollHistory: []
            });

            console.log("Database Seeded with Normalized Structure!");
        }
    };
};