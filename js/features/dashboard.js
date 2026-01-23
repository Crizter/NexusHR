import { connectToDb, addAnnouncements,getAnnouncements } from "../core/db.js";
import { initSidebar } from "../components/sidebar.js";

// check the user login 
const activeUser = sessionStorage.getItem('userId') ; 
checkLoggedin(activeUser) ; 

let db ; 


const initializeDashboard = async ()=> { 
    try {
        initSidebar();
        db = await connectToDb(2) ; 
        
    } catch (error) {
        throw new Error('Failed to start dashboard');
    }
};




document.addEventListener('DOMContentLoaded', initializeDashboard) ; 