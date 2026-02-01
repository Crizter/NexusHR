import { checkLoggedin } from "../auth/auth-service.js";
import { initSidebar } from "../components/sidebar.js";
import { SERVER_PORT,SERVER_URL } from '../config.js';

// check loggedin 

const userId= sessionStorage.getItem("userId") ;
const userRole = sessionStorage.getItem("role") ;
checkLoggedin(userId) ; 

let db ; 

 export const  initializeLeaves = async () => { 
    initSidebar() ; 
}

const roleBasedControl = () => { 
    
}

document.addEventListener('DOMContentLoaded', initializeLeaves);