import { updateEmployee, updateSyncQueue } from "./db.js";
import { generateUUID } from "../utils/crypto.js";



let isOnline = navigator.onLine ;  // check the browser state current one 

export const syncManager = (db) => {
    

    const flushQueue = async () => {
       console.log('Network restored')
        
        const tx = db.transaction(['syncQueue', 'users'], 'readwrite'); 
        const queueStore = tx.objectStore('syncQueue');

        // get pending tasks
        const request = queueStore.getAll();

        request.onsuccess = async () => {
            const tasks = request.result;
            
            if (tasks.length === 0) {
                console.log("queue is empty...");
                return;
            }

            console.log(`flusing offline tasks `);

            // Process each task
            for (const task of tasks) {
                try {
                    // get the user role from session storage
                    const currentUserRole = sessionStorage.getItem('role');
                    
                    
                    await updateEmployee(db, currentUserRole, task); 
                    
                    // Delete from Queue
                    const deleteTx = db.transaction(['syncQueue'], 'readwrite');
                    deleteTx.objectStore('syncQueue').delete(task.idemPotencyKey);
                    
                    console.log(`Synced: ${task.idemPotencyKey}`);
                    
                } catch (err) {
                    console.error(`Failed to sync task ${task.idemPotencyKey}`, err);
                }
            }

            //  Refresh UI
            alert(` Connection restored ${tasks.length}`);
            window.location.reload(); 
        };
    };

    // check for online 
    window.addEventListener('online', () => {
        console.log("Back online! Syncing...");
        isOnline = true;
        flushQueue();
    });

    window.addEventListener('offline', () => {
        console.log("Connection lost. Switching to Persistence Tier.");
        isOnline = false;
    });

    // Check immediately on load (in case we started offline but are now online)
    if (navigator.onLine) {
        flushQueue();
    }
};
// handler for sync queue - once the user is offline 
const saveSyncQueue = async (db, employeeData, currentUserRole, uuid) => { 
    if(!db || !employeeData || !currentUserRole || !uuid){
        throw new Error('Missing fields') ; 
    }
    await updateSyncQueue(db, currentUserRole,uuid , employeeData) ; 
}

// function to be called when save button is called 
// checks if the user is online or offline and basis on that it will udpate 
export const handleEmployeeUpdate = async (db, employeeData, currentUserRole) => { 
    if(isOnline) { 
        // then save 
        console.log('Online, saving directly to DB') ; 
        return await updateEmployee(db,currentUserRole,employeeData) ; 
    } else { 
        console.log('Offline: Queueing for later...') ; 
        const uuid = generateUUID() ; 
        await saveSyncQueue(db, employeeData,currentUserRole,uuid) ; 
        alert('Offline, changes saved to sync queue') ; 
        return "Queued for sync" ; 
    }
}