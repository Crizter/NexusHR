import { connectToDb, getAllEmployees, updateEmployee } from "../core/db.js";
import { initSidebar } from "../components/sidebar.js";
import { checkLoggedin } from "../auth/auth-service.js";

const activeUser = sessionStorage.getItem('userId');
const currentUserRole = sessionStorage.getItem('role') ; 
checkLoggedin(activeUser);

// global variables 
let db;
let employeeCache = [];
let filteredEmployees = [];

const initializeSalaries = async () => {
    console.log(currentUserRole)
    if(currentUserRole !== 'hr_manager' &&  currentUserRole !== 'super_admin'){
        alert(`Not authenticated`) ; 
        window.location.href = 'index.html' ; 
        return ; 
    }
    try {
        console.log('[Salaries] Initializing...');
        
        // initialize sidebar
        initSidebar();
        db = await connectToDb(2);
        employeeCache = await getAllEmployees(db);
        filteredEmployees = [...employeeCache];
        
        // event listeners
        setupEventListeners();
        
        // render initial data 
        renderSalaryTable(filteredEmployees);
        updateStatsCards(filteredEmployees);
        
        console.log('[Salaries] Initialization complete');
        
    } catch (error) {
        console.error('Failed to initialize salaries', error);
        alert('Failed to load salary management: ' + error.message);
    }
};

const renderSalaryTable = (employees) => {
    console.log('[Salaries] Rendering salary table with', employees.length, 'employees');
    
    const tbody = document.getElementById('salary-list');
    if (!tbody) {
        console.error('[Salaries] Table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    // Filter out deleted employees
    const activeEmployees = employees.filter(emp => !emp.isDeleted);
    
    if (activeEmployees.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="9" class="no-data">
                    <div class="empty-state">
                        <div class="empty-icon">💼</div>
                        <h3>No Employee Data</h3>
                        <p>No employees found matching your criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    activeEmployees.forEach((employee, index) => {
        const row = document.createElement('tr');
        row.className = 'salary-row';
        row.dataset.employeeId = employee.id;
        
        // Get financial data with defaults
        const financial = employee.financial || {};
        const baseSalary = financial.baseSalary || 0;
        const currency = financial.currency || 'USD';
        const taxBracket = financial.taxBrackets || 'tier_1';
        const bankDetail = financial.bankDetail || {};
        
        let salaryClass = 'low';
        if (baseSalary >= 80000) salaryClass = 'high';
        else if (baseSalary >= 50000) salaryClass = 'medium';
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox employee-checkbox" data-employee-id="${employee.id}">
            </td>
            <td>
                <div class="employee-cell">
                    <div class="employee-avatar-small">👤</div>
                    <div class="employee-info">
                        <div class="employee-name">${employee.identity.firstName} ${employee.identity.lastName}</div>
                        <div class="employee-id">${employee.id.substring(0, 8)}...</div>
                    </div>
                </div>
            </td>
            <td>${employee.department?.deptName || 'N/A'}</td>
            <td>
                <span class="salary-amount ${salaryClass}">
                    ${formatCurrency(baseSalary, currency)}
                </span>
            </td>
            <td>
                <span class="tax-bracket-badge ${taxBracket}">
                    ${taxBracket.toUpperCase().replace('_', ' ')}
                </span>
            </td>
            <td>
                <span class="currency-badge">${currency}</span>
            </td>
            <td>
                <div class="bank-details">
                    <div class="bank-name">${bankDetail.bankName || 'Not set'}</div>
                    <div class="account-number">${bankDetail.accountNumber || 'N/A'}</div>
                </div>
            </td>
            <td>
                <div class="last-updated">${formatDate(employee.lastUpdated || employee.createdAt)}</div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit-salary" data-employee-id="${employee.id}">
                        💰 Edit
                    </button>
                </div>
            </td>
        `;
        
        fragment.appendChild(row);
    });
    
    tbody.appendChild(fragment);
    
    console.log('[Salaries] Table rendered successfully');
};

const setupEventListeners = () => {
    console.log('[Salaries] Setting up event listeners');
    
    const searchInput = document.getElementById('employee-search');
    searchInput?.addEventListener('input', handleSearch);
    
    const departmentFilter = document.getElementById('department-filter');
    departmentFilter?.addEventListener('change', handleDepartmentFilter);
    
    const selectAllCheckbox = document.getElementById('select-all');
    selectAllCheckbox?.addEventListener('change', handleSelectAll);
    
    const bulkUpdateBtn = document.getElementById('bulk-update-btn');
    bulkUpdateBtn?.addEventListener('click', () => {
        document.getElementById('bulk-update-modal').showModal();
    });
    
    const exportBtn = document.getElementById('export-salaries-btn');
    exportBtn?.addEventListener('click', handleExport);
    
    const analyticsBtn = document.getElementById('salary-analytics-btn');
    analyticsBtn?.addEventListener('click', () => {
        generateAnalytics() ; 
        document.getElementById('analytics-modal').showModal();
    });
    
    // EVENT DELEGATION for table actions
    const salaryTable = document.getElementById('salary-table');
    salaryTable?.addEventListener('click', handleTableClick);
    salaryTable?.addEventListener('change', handleTableChange);
    
    // Edit salary form submission
    const editSalaryForm = document.getElementById('edit-salary-form');
    editSalaryForm?.addEventListener('submit', handleSalaryUpdate);
    
    console.log('[Salaries] Event listeners setup complete');
};

const updateStatsCards = (employees) => {
    const activeEmployees = employees.filter(u => !u.isDeleted);
    const totalEmployees = activeEmployees.length;

    // total and average salary
    const salaries = activeEmployees.map(emp => emp.financial?.baseSalary || 0);
    const totalPayroll = salaries.reduce((sum, salary) => sum + salary, 0);
    const averageSalary = totalEmployees > 0 ? totalPayroll / totalEmployees : 0;
    // pending salaries
    const pendingUpdates = activeEmployees.filter(emp => !emp.financial?.baseSalary).length;

    // update dom 
    document.getElementById('total-employees-count').textContent = totalEmployees.toLocaleString();
    document.getElementById('average-salary').textContent = `$${Math.round(averageSalary).toLocaleString()}`;
    document.getElementById('total-payroll').textContent = `$${totalPayroll.toLocaleString()}`;
    document.getElementById('pending-updates').textContent = pendingUpdates.toLocaleString();
    
    console.log('[Salaries] Stats updated');
};

const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Handle all table clicks using event delegation
const handleTableClick = (event) => {
    const target = event.target;
    
    // Handle edit salary button clicks
    if (target.classList.contains('btn-edit-salary') || target.closest('.btn-edit-salary')) {
        const button = target.closest('.btn-edit-salary') || target;
        const employeeId = button.dataset.employeeId;
        if (employeeId) {
            openEditSalaryModal(employeeId);
        }
    }
};

const handleTableChange = (event) => {
    const target = event.target;
    
    // Handle individual employee checkbox changes
    if (target.classList.contains('employee-checkbox')) {
        updateSelectAllState();
    }
};

const handleSearch = (event) => {
    const searchTerm = event.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredEmployees = [...employeeCache];
    } else {
        filteredEmployees = employeeCache.filter(emp => {
            const fullName = `${emp.identity.firstName} ${emp.identity.lastName}`.toLowerCase();
            const email = emp.email.toLowerCase();
            const department = emp.department?.deptName?.toLowerCase() || '';
            
            return fullName.includes(searchTerm) || 
                   email.includes(searchTerm) || 
                   department.includes(searchTerm);
        });
    }
    
    applyFilters();
};

const handleDepartmentFilter = (event) => {
    const selectedDepartment = event.target.value;
    
    if (!selectedDepartment) {
        filteredEmployees = [...employeeCache];
    } else {
        filteredEmployees = employeeCache.filter(emp => 
            emp.department?.deptName === selectedDepartment
        );
    }
    
    applyFilters();
};

const handleSelectAll = (event) => {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.employee-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
};

const updateSelectAllState = () => {
    const selectAllCheckbox = document.getElementById('select-all');
    const employeeCheckboxes = document.querySelectorAll('.employee-checkbox');
    const checkedBoxes = document.querySelectorAll('.employee-checkbox:checked');
    
    if (selectAllCheckbox) {
        if (checkedBoxes.length === 0) {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = false;
        } else if (checkedBoxes.length === employeeCheckboxes.length) {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = true;
        } else {
            selectAllCheckbox.indeterminate = true;
        }
    }
};

const applyFilters = () => {
    renderSalaryTable(filteredEmployees);
    updateStatsCards(filteredEmployees);
};

// Open and populate the edit salary modal
const openEditSalaryModal = (employeeId) => {
    console.log(`[Salaries] Opening edit modal for employee: ${employeeId}`);
    
    const employee = employeeCache.find(emp => emp.id === employeeId);
    if (!employee) {
        alert('Employee not found');
        return;
    }
    
    // Populate modal with employee data
    populateEditModal(employee);
    
    // Show the modal
    document.getElementById('edit-salary-modal').showModal();
};

// Populate the edit modal with employee data
const populateEditModal = (employee) => {
    const financial = employee.financial || {};
    const bankDetail = financial.bankDetail || {};
    
    // Set hidden employee ID
    document.getElementById('edit-employee-id').value = employee.id;
    
    // Display employee info
    document.getElementById('edit-employee-name').textContent = 
        `${employee.identity.firstName} ${employee.identity.lastName}`;
    document.getElementById('edit-employee-dept').textContent = 
        employee.department?.deptName || 'N/A';
    document.getElementById('edit-employee-role').textContent = 
        employee.role || 'Employee';
    
    // Populate form fields
    document.getElementById('edit-base-salary').value = financial.baseSalary || '';
    document.getElementById('edit-currency').value = financial.currency || 'USD';
    document.getElementById('edit-tax-bracket').value = financial.taxBrackets || 'tier_1';
    document.getElementById('edit-bank-name').value = bankDetail.bankName || '';
    document.getElementById('edit-account-number').value = bankDetail.accountNumber || '';
    
    // Set effective date to today by default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('edit-effective-date').value = today;
    
    console.log('[Salaries] Modal populated with employee data');
};

// Handle salary update form submission
const handleSalaryUpdate = async (event) => {
    event.preventDefault();
    
    const employeeId = document.getElementById('edit-employee-id').value;
    const baseSalary = parseFloat(document.getElementById('edit-base-salary').value);
    const currency = document.getElementById('edit-currency').value;
    const taxBracket = document.getElementById('edit-tax-bracket').value;
    const bankName = document.getElementById('edit-bank-name').value.trim();
    const accountNumber = document.getElementById('edit-account-number').value.trim();
    const effectiveDate = document.getElementById('edit-effective-date').value;
    
    try {
        console.log('[Salaries] Updating salary for employee:', employeeId);
        
        // Find the employee in cache
        const employeeIndex = employeeCache.findIndex(emp => emp.id === employeeId);
        if (employeeIndex === -1) {
            throw new Error('Employee not found');
        }
        
        // Update employee data
        const updatedEmployee = {
            ...employeeCache[employeeIndex],
            financial: {
                ...employeeCache[employeeIndex].financial,
                baseSalary,
                currency,
                taxBrackets: taxBracket,
                bankDetail: {
                    bankName,
                    accountNumber
                },
                effectiveDate
            },
            lastUpdated: Date.now()
        };
        
        // Update in database
        await updateEmployee(db, currentUserRole,updatedEmployee);
        
        // Update cache
        employeeCache[employeeIndex] = updatedEmployee;
        
        // Update filtered employees if this employee is in the current view
        const filteredIndex = filteredEmployees.findIndex(emp => emp.id === employeeId);
        if (filteredIndex !== -1) {
            filteredEmployees[filteredIndex] = updatedEmployee;
        }
        
        // Re-render table and update stats
        renderSalaryTable(filteredEmployees);
        updateStatsCards(filteredEmployees);
        
        // Close modal
        document.getElementById('edit-salary-modal').close();
        
        // Show success message
        showSuccessMessage(`Salary updated successfully for ${updatedEmployee.identity.firstName} ${updatedEmployee.identity.lastName}`);
        
        console.log('[Salaries] Salary updated successfully');
        
    } catch (error) {
        console.error('[Salaries] Failed to update salary:', error);
        alert('Failed to update salary: ' + error.message);
    }
};

// Show success message
const showSuccessMessage = (message) => {
    // Create a simple success toast
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    
    // Add animation styles if they don't exist
    if (!document.getElementById('toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const handleExport = () => {
    if (!filteredEmployees.length) {
        alert("No data to export.");
        return;
    }

    // 1. Define Headers
    const headers = ["ID", "Name", "Department", "Role", "Salary", "Currency", "Tax Tier"];
    
    // 2. Map Data
    const rows = filteredEmployees.map(emp => [
        emp.id,
        `${emp.identity.firstName} ${emp.identity.lastName}`,
        emp.department?.deptName || "N/A",
        emp.role,
        emp.financial?.baseSalary || 0,
        emp.financial?.currency || "USD",
        emp.financial?.taxBrackets || "tier_1"
    ]);

    // 3. Convert to CSV String
    const csvContent = [
        headers.join(","), 
        ...rows.map(row => row.join(","))
    ].join("\n");

    // 4. Trigger Download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus_salaries_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
};

const generateAnalytics = () => {
    // 1. Group Data by Dept
    const deptStats = {};
    filteredEmployees.forEach(emp => {
        const dept = emp.department?.deptName || 'Unassigned';
        deptStats[dept] = (deptStats[dept] || 0) + (emp.financial?.baseSalary || 0);
    });

    // 2. Render Chart
    const container = document.getElementById('department-chart');
    container.innerHTML = '';
    
    const maxVal = Math.max(...Object.values(deptStats));

    Object.entries(deptStats).forEach(([dept, total]) => {
        const percentage = (total / maxVal) * 100;
        
        const barItem = document.createElement('div');
        barItem.className = 'chart-item';
        barItem.innerHTML = `
            <div class="chart-label">${dept}</div>
            <div class="chart-bar-container">
                <div class="chart-bar" style="width: ${percentage}%"></div>
                <span class="chart-value">$${(total/1000).toFixed(0)}k</span>
            </div>
        `;
        container.appendChild(barItem);
    });
};


document.addEventListener('DOMContentLoaded', initializeSalaries);