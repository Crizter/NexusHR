import { updateEmployee, updateSyncQueue } from "./db.js";
import { generateUUID } from "../utils/crypto.js";



let isOnline = navigator.onLine ;  // check the browser state current one 

export function syncManager(db, employeeData, currentUserRole) {
    
    window.addEventListener('online', () => {
        console.log("Back online! Syncing...");
        isOnline=true ; 
                
    });

    window.addEventListener('offline', () => {
        console.log("Connection lost. Switching to Persistence Tier.");
        isOnline=false ; 
         
    });
}

// handler for sync queue - once the user is offline 
const saveSyncQueue = async (db, employeeData, currentUserRole, uuid) => { 
    if(!db || !employeeData || !currentUserRole || !uuid){
        throw new Error('Missing fields') ; 
    }
    await updateSyncQueue(db, currentUserRole,uuid , employeeData) ; 
}

// function to be called when save button is called 
// checks if the user is online or offline and basis on that it will udpate 
export const handleEmployeeUpdate = async (db, employeeData, currentUserRole, uuid) => { 
    if(isOnline) { 
        // then save 
        return await updateEmployee(db,currentUserRole,employeeData) ; 
    } else { 
        console.log('Offline: Queueing for later...') ; 
        const uuid = generateUUID() ; 
        return await saveSyncQueue(db, employeeData,currentUserRole,uuid) ; 
    }
}