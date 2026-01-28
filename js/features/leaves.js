import { checkLoggedin } from "../auth/auth-service.js";
import { initSidebar } from "../components/sidebar.js";
import { SERVER_PORT,SERVER_URL } from '../config.js';

// check loggedin 

const userId= sessionStorage.getItem("userId") ; 
checkLoggedin(userId) ; 

let db ; 

 export const  initializeLeaves = async () => { 
    
}


document.addEventListener('DOMContentLoaded')