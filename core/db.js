import { checkPermission } from "../auth/rbac.js";

// opening the database 
export const connectToDb = async  () => { 
    
    return await openConnection("NEXUSHR_VAULT") ;        
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
            }
            if(!db.objectStoreNames.contains("sync_queue")){
                db.createObjectStore("syncQueue", {keyPath: 'idemPotencyKey'}) ; 
            }
            
        }
        request.onsuccess = () => resolve(request.result) ; 
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