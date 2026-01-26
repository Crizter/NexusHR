
import { connectToDb, seedDatabase, getAllEmployees, updateEmployee, getEmployeeById, updateSyncQueue , addUserCredentials} from "./core/db.js";
import { handleEmployeeUpdate, syncManager } from "./core/sync.js";
import { checkLoggedin } from "./auth/auth-service.js";
import { generateUUID } from "./utils/crypto.js";
import { initSidebar } from "./components/sidebar.js";


const activeUser = sessionStorage.getItem('userId') ; 
checkLoggedin(activeUser) ; 

 
let db ; 

// Department mapping
const DEPARTMENTS = {
    'Operations': { deptId: 'DEPT_001', deptName: 'Operations' },
    'Tech': { deptId: 'DEPT_002', deptName: 'Tech' },
    'Sales': { deptId: 'DEPT_003', deptName: 'Sales' },
    'HR': { deptId: 'DEPT_004', deptName: 'HR' }
};




// load the content and connect to indexdb
document.addEventListener('DOMContentLoaded',async (event) => { 
    console.log('Dom content loaded') ; 
    try {
        initSidebar() ; 
        db = await connectToDb() ; 
        await seedDatabase(db) ; 
        syncManager(db) ; 
        // get all the users from indexdb
        const users = await getAllEmployees(db) ; 
        renderUsers(users) ; 
         const currentUserRole = sessionStorage.getItem('role');
        const addBtn = document.getElementById('add-employee-btn');
        
        if (currentUserRole === 'hr_manager') {
            addBtn.style.display = 'flex'; // Show button for HR managers
            addBtn.addEventListener('click', () => {
                console.log('Add employee button clicked');
                document.getElementById('add-modal').showModal();
            });
        } else {
            addBtn.style.display = 'none'; // Hide for regular employees
        }

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
        // else {
        //     // Regular employees see nothing else, or a lock icon
        //     actionButtons += `<span class="locked-icon"></span>`;
        // }
        const row = document.createElement('tr'); 
        row.className = 'employee-row';
        // const departmentName = user.department.deptName || 'N/A'; 
        const departmentName = user?.department?.deptName ; 
       row.innerHTML = `
            <td class="employee-id">${user.id}</td>
            <td class="employee-name">${user.identity.firstName} ${user.identity.lastName}</td>
            <td><span class="role-badge ${user.role}">${user.role.replace('_', ' ')}</span></td>
             <td class="department">${departmentName}</td>
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
document.getElementById('employee-list').addEventListener('click', async(event) => { 
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
        try {
            // if(!db){
            //     return ; 
            // }
            const user = await getEmployeeById(db,id) ; 
            document.getElementById('edit-id').value = user.id;
            document.getElementById('edit-firstname').value = user.identity.firstName;
            document.getElementById('edit-lastname').value = user.identity.lastName;
            document.getElementById('edit-dept').value = user.department;
            document.getElementById('edit-role').value = user.role;

            // show the modal 
            document.getElementById('edit-modal').showModal() ; 
        } catch (error) {
            console.error("Could not load user for editing", error);
            alert("Failed to load user data.");
        }
    }
});

// Handle Form Submission
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    //  Capture Data
    const id = document.getElementById('edit-id').value;
    const currentUserRole = sessionStorage.getItem('role') ; 
    
    const originalUser = await getEmployeeById(db, id);
    // get the dept 
    const selectedDeptName = document.getElementById('edit-dept').value  ; 
    const departmentObj = DEPARTMENTS[selectedDeptName] ; 

    const updatedUser = {
        ...originalUser, // Keep existing fields
        identity: {
            ...originalUser.identity,
            firstName: document.getElementById('edit-firstname').value,
            lastName: document.getElementById('edit-lastname').value
        },
        department: departmentObj,
        role: document.getElementById('edit-role').value,
        lastUpdated: Date.now()
    };

    try {
        // handle the online/offline updates 
        await handleEmployeeUpdate(db, updatedUser,currentUserRole) ; 
        console.log('Employee update handled successfully') ; 
        document.getElementById('edit-modal').close();
        const users = await getAllEmployees(db);
        renderUsers(users);
    } catch (error) {
        console.error('Failed to update employee',error) ; 
        alert(error.message || 'Failed to update the employee') ; 
    }    
});

document.getElementById('add-form').addEventListener('submit', async(e) => { 
    e.preventDefault() ; 

    // const id = document.getElementById('edit-id').value ; 
    const currentUserRole = sessionStorage.getItem('role') ;
    const employeeId =  generateUUID() ; 
    const selectedDeptName = document.getElementById('add-dept').value ; 
    const deptObj = DEPARTMENTS[selectedDeptName]; 
    const userPassword = document.getElementById('add-password').value ; 
    const email = document.getElementById('add-email').value ; 
        const newCredentials = { 
            email : email,
            password: userPassword, 
            userId: employeeId
        }
       const newEmployee = {
        id: employeeId,
        role: document.getElementById('add-role').value,
        department: deptObj, // Use department object
        email: email,
        isDeleted: false,
        identity: {
            firstName: document.getElementById('add-firstname').value,
            lastName: document.getElementById('add-lastname').value,
            contactNumber: document.getElementById('add-contact').value || '',
            address: { 
                city:  document.getElementById('add-city')?.value || '',

             }, 
            
        },
        attendance: { status: "active", logs: [] }, // Default to active
        createdAt: Date.now()
    };
    try {
        await handleEmployeeUpdate(db,newEmployee,currentUserRole) ; 
        console.log('Employee added successfully') ; 
        await addUserCredentials(db,newCredentials,currentUserRole) ; 

        // clear form 
         document.getElementById('add-form').reset();
        document.getElementById('add-modal').close();
        
        // Refresh UI
        const users = await getAllEmployees(db);
        renderUsers(users);
        
        alert('Employee added successfully!');
    } catch (error) {
         console.error('Failed to add employee', error);
        alert(error.message || 'Failed to add the employee');
    }
})
