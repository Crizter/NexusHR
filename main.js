
import { connectToDb } from "./core/db.js";
import { syncManager } from "./core/sync.js";

const testBtn = document.querySelector('.test') ; 
testBtn.addEventListener('click',()=> { 
    connectToDb() ; 
}) ; 

async function startApp() { 
    const db = await connectToDb() ;
    console.log(db) ;  
    syncManager(db) ; 
    
}

startApp() ; 