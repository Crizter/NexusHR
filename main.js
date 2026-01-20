
import { connectToDb, seedDatabase } from "./core/db.js";
import { syncManager } from "./core/sync.js";




// load the content and connect to indexdb
document.addEventListener('DOMContentLoaded',async (event) => { 
    console.log('Dom content loaded') ; 
    try {
        const db = await connectToDb(2) ; 
        await seedDatabase(db) ; 
        syncManager(db) ; 
        loadDirectory(db) ; 
    } catch (error) {
        console.error("Failed to start app:", error);
    }

})

// fetch the users from users ( indexdb) 
const loadDirectory = (db) => { 
    const transaction = db.transaction(['users']) ; 
    const userStore = transaction.objectStore("users") ; 
    const request = userStore.getAll() ; 

    request.onsuccess = () => { 
        const users = request.result ; 
        renderUsers(users) ; 
    };    
}

// render the users 
const renderUsers = (users) => { 
    const tbody = document.getElementById('employee-list') ; 
    tbody.innerHTML = '' ; // clear the current list 
    if(users.length === 0 ) { 
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No employees found</td></tr>';
        return ; 
    }
    // fragment for avoiding page reflow 

     const fragment = document.createDocumentFragment(); 

    users.forEach(user => {
        if (user.isDeleted) { 
            return; 
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
                <button class="btn btn-view" onclick="viewEmployee('${user.id}')">View</button>
                <button class="btn btn-edit" onclick="editEmployee('${user.id}')">Edit</button>
            </td>
        `;
        
        fragment.appendChild(row); 
    }); 
    
    tbody.appendChild(fragment); 
}