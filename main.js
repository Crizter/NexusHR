
import { connectToDb, seedDatabase, getAllEmployees } from "./core/db.js";
import { syncManager } from "./core/sync.js";
import { checkLoggedin } from "./auth/auth-service.js";
import { checkPermission } from "./auth/rbac.js"; 


const activeUser = sessionStorage.getItem('userId') ; 
checkLoggedin(activeUser) ; 

 


// load the content and connect to indexdb
document.addEventListener('DOMContentLoaded',async (event) => { 
    console.log('Dom content loaded') ; 
    try {
        const db = await connectToDb(2) ; 
        await seedDatabase(db) ; 
        syncManager(db) ; 
        // get all the users from indexdb
        const users = await getAllEmployees(db) ; 
        renderUsers(users) ; 
    } catch (error) {
        console.error("Failed to start app:", error);
    }

}) ;

// render the users in directory 
const renderUsers = (users) => { 
    const tbody = document.getElementById('employee-list') ; 
    tbody.innerHTML = '' ; // clear the current list 
    if(users.length === 0 ) { 
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No employees found</td></tr>';
        return ; 
    }

    const currentUserRole = sessionStorage.getItem('role') ; // hr_manager, superadmin, employee 

    // fragment for avoiding page reflow 

     const fragment = document.createDocumentFragment(); 

    users.forEach(user => {
        if (user.isDeleted) { 
            return; 
        }
        let actionButtons = `<button class="btn btn-view" data-action="view" data-id="${user.id}">View</button>`
        if(currentUserRole === `hr_manager`){
            actionButtons += `
                <button class="btn btn-edit" data-action="edit" data-id="${user.id}">Edit</button>
            `;
        }
        else {
            // Regular employees see nothing else, or a lock icon
            actionButtons += `<span class="locked-icon"></span>`;
        }
        const row = document.createElement('tr'); 
        row.className = 'employee-row';
        
       row.innerHTML = `
            <td class="employee-id">${user.id}</td>
            <td class="employee-name">${user.identity.firstName} ${user.identity.lastName}</td>
            <td><span class="role-badge ${user.role}">${user.role.replace('_', ' ')}</span></td>
            <td class="department">${user.department}</td>
            <td class="email">${user.email}</td>
            <td class="contact">${user.identity.contactNumber || 'N/A'}</td>
            <td><span class="status ${user.attendance.status}">${user.attendance.status}</span></td>
            <td class="actions">
                ${actionButtons}
            </td>
        `;
        
        fragment.appendChild(row); 
    }); 
    
    tbody.appendChild(fragment); 
}

// event delegation 
document.getElementById('employee-list').addEventListener('click', (event) => { 
    const target = event.target ; // check where the user clicked 
    const action = target.dataset.action ; 
    const id = target.dataset.id ; 

    if(!action || !id) { 
        return ; 
    }
    if(action === `view`){
        // viewEmployeeId() ;
        console.log(`Viewing Profile...`) ; 
    } else if(action === `edit`){
        // handle the edit here 
        console.log(`Editing profile`) ; 
    }
})