
import { connectToDb, seedDatabase, getAllEmployees,updateCounter, updateEmployee, getEmployeeById, updateSyncQueue , addUserCredentials,deleteEmployee} from "./core/db.js";
import { handleEmployeeUpdate, syncManager } from "./core/sync.js";
import { checkLoggedin } from "./auth/auth-service.js";
import { generateUUID } from "./utils/crypto.js";
import { initSidebar } from "./components/sidebar.js";
import { tryCatchAsync } from "./utils/tryCatch.js";

const activeUser = sessionStorage.getItem('userId') ; 
checkLoggedin(activeUser) ; 

 
let db ; 

// Department mapping
const DEPARTMENTS = {
    'Operations': { deptId: 'DEP-003', deptName: 'Operations' },
    'Tech': { deptId: 'DEP-002', deptName: 'Tech' },
    'Sales': { deptId: 'DEP-001', deptName: 'Sales' },
    'Support': { deptId: 'DEP-004', deptName: 'Support' }
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
        
        // Build action buttons based on role - FIXED: Initialize as empty string
        let actionButtons = '';
        
        if(currentUserRole === 'hr_manager'){
            actionButtons = `
                <button class="btn btn-edit" data-action="edit" data-id="${user.id}" title="Edit Employee">
                    <span class="btn-icon">✏️</span> Edit
                </button>
                <button class="btn btn-delete" data-action="delete" data-id="${user.id}" title="Delete Employee">
                    <span class="btn-icon">🗑️</span> Delete
                </button>
            `;
        } else {
            // Regular employees see no action buttons
            actionButtons = '<span class="no-actions">No actions available</span>';
        }
        
        const row = document.createElement('tr'); 
        row.className = 'employee-row';
        
        const departmentName = user?.department?.deptName ; 
        row.innerHTML = `
            <td class="employee-id">${user.displayId || user.id} </td>
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

const handleDeleteEmployee = async (employeeId) => {
    console.log('Delete employee function called for ID:', employeeId);
    
    const currentUserRole = sessionStorage.getItem('role');
    
    try {
        const result = await deleteEmployee(db, currentUserRole, employeeId);
        console.log('Delete result:', result);
        return result;
    } catch (error) {
        console.error('Error deleting employee:', error);
        throw error;
    }
};


// event delegation 
document.getElementById('employee-list').addEventListener('click', async(event) => { 
    const target = event.target.closest('button'); // Use closest to handle icon clicks
    
    if (!target) return;
    
    const action = target.dataset.action ; 
    const id = target.dataset.id ; 

    console.log('Button clicked:', { action, id }); // Debug log

    if(!action || !id) { 
        console.log('Missing action or id');
        return ; 
    }
    
    if(action === 'edit'){
        console.log('Editing profile for ID:', id); 
        try {
            const user = await getEmployeeById(db, id) ; 
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
    } else if(action === 'delete') {
        console.log('Delete requested for ID:', id);
        
        // Get employee info for confirmation
        try {
            const user = await getEmployeeById(db, id);
            const employeeName = `${user.identity.firstName} ${user.identity.lastName}`;
            
            // Enhanced confirmation dialog
            const confirmed = confirm(
                `DELETE EMPLOYEE\n\n` +
                `Employee: ${employeeName}\n` +
                `Email: ${user.email}\n` +
                `Department: ${user.department?.deptName || 'N/A'}\n\n` +
                `This will mark the employee as deleted and remove their access.\n\n` +
                `Are you sure you want to proceed?`
            );
            
            if (confirmed) {
                // Disable the button to prevent double-clicks
                target.disabled = true;
                target.innerHTML = '<span class="btn-icon">⏳</span> Deleting...';
                
                try {
                    // Call delete function
                    const currentUserRole = sessionStorage.getItem('role');
                    const result = await deleteEmployee(db, currentUserRole, id);
                    
                    console.log('Delete result:', result);
                    
                    // Show success message
                    alert(`Success!\n\nEmployee "${employeeName}" has been deleted.`);
                    
                    // Refresh the employee list
                    const users = await getAllEmployees(db);
                    renderUsers(users);
                    
                } catch (deleteError) {
                    // Re-enable button on error
                    target.disabled = false;
                    target.innerHTML = '<span class="btn-icon">🗑️</span> Delete';
                    throw deleteError;
                }
            }
        } catch (error) {
            console.error("Error during deletion:", error);
            
            let errorMessage = "Failed to delete employee.";
            if (error.message.includes("Access Denied")) {
                errorMessage = "You don't have permission to delete employees.";
            } else if (error.message.includes("not found")) {
                errorMessage = "Employee not found.";
            } else if (error.message.includes("cannot delete your own")) {
                errorMessage = "You cannot delete your own account.";
            }
            
            alert(`Error: ${errorMessage}\n\nPlease try again or contact support.`);
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
    const nextSequence = await updateCounter(db,"employee_counter") ; 
    

    // const id = document.getElementById('edit-id').value ; 
    const currentUserRole = sessionStorage.getItem('role') ;
    const employeeId =  generateUUID() ; 
    const displayId = `POS-${nextSequence}`;
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
        displayId: displayId,
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
});
