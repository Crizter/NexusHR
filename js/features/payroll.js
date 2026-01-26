import { connectToDb, getAllEmployees } from '../core/db.js';
import { initSidebar } from '../components/sidebar.js';
import { checkLoggedin } from '../auth/auth-service.js';

// Global variables
let db;
let payrollWorker;
let currentPayrollData = [];

// Check authentication
const activeUser = sessionStorage.getItem('userId');
checkLoggedin(activeUser);

// Enhanced LED control with status updates
const updateWorkerLED = (state) => {
    const led = document.getElementById('worker-led');
    const workerStatus = led?.parentElement;
    
    if (!led) return;
    
    // Remove all state classes
    led.classList.remove('idle', 'processing', 'success', 'error', 'active');
    workerStatus?.classList.remove('processing', 'success', 'error', 'active');
    
    // Add new state
    led.classList.add(state);
    workerStatus?.classList.add(state);
    
    console.log(`[Payroll] Worker LED updated to: ${state}`);
    
    // Auto-reset error and success states after delay
    if (state === 'error') {
        setTimeout(() => {
            if (led.classList.contains('error')) {
                updateWorkerLED('idle');
            }
        }, 5000); // Reset error after 5 seconds
    }
};

// Add worker heartbeat monitoring
let workerHeartbeat = null;
const startWorkerHeartbeat = () => {
    clearInterval(workerHeartbeat);
    updateWorkerLED('processing');
    
    // Pulse effect during processing
    workerHeartbeat = setInterval(() => {
        if (document.getElementById('worker-led')?.classList.contains('processing')) {
            // Add extra pulse intensity during heavy processing
            const led = document.getElementById('worker-led');
            led?.style.setProperty('animation-duration', '1s');
        }
    }, 1000);
};

const stopWorkerHeartbeat = () => {
    clearInterval(workerHeartbeat);
    const led = document.getElementById('worker-led');
    led?.style.removeProperty('animation-duration');
};

// Initialize the payroll module
const initializePayroll = async () => {
    try {
        // Initialize sidebar
        initSidebar();
        
        // Add toast styles
        addToastStyles();
        
        // Connect to database
        db = await connectToDb();
        console.log('[Payroll] Database connected');
        
        // Initialize worker
        payrollWorker = new Worker('js/workers/payroll.worker.js');
        setupWorkerHandlers();
        updateWorkerLED('active'); // Show worker is ready
        console.log('[Payroll] Worker initialized');
        
        // Set up event listeners
        setupEventListeners();
        
        // Set default month to current
        setDefaultMonth();
        
        // Load existing payroll data if any
        await loadExistingPayroll();
        
        // Set LED to idle after initialization
        setTimeout(() => updateWorkerLED('idle'), 1000);
        
        console.log('[Payroll] Module initialized successfully');
        
    } catch (error) {
        console.error('[Payroll] Initialization failed:', error);
        updateWorkerLED('error');
        alert('Failed to initialize payroll module: ' + error.message);
    }
};

// Set up worker event handlers
const setupWorkerHandlers = () => {
    payrollWorker.onmessage = async (event) => {
        const { type, data, metrics, message } = event.data;
        
        if (type === 'RESULT') {
            console.log('[Payroll] Worker completed calculations:', metrics);
            stopWorkerHeartbeat();
            
            try {
                // Save payroll data to database
                await savePayrollBatch(db, data);
                console.log('[Payroll] Payroll data saved to database');
                
                // Update UI with success state
                updateWorkerLED('success');
                hideProcessingOverlay();
                
                // Store current data and render
                currentPayrollData = data;
                renderPayrollTable(data);
                updateStatsCards(data);
                enableActionButtons();
                
                // Show success message with processing time
                showSuccessMessage(`Payroll processed successfully in ${metrics.processingTime.toFixed(0)}ms`);
                
                // Reset LED after 3 seconds
                setTimeout(() => {
                    updateWorkerLED('idle');
                }, 3000);
                
            } catch (error) {
                console.error('[Payroll] Failed to save payroll data:', error);
                stopWorkerHeartbeat();
                updateWorkerLED('error');
                hideProcessingOverlay();
                alert('Failed to save payroll data: ' + error.message);
            }
            
        } else if (type === 'ERROR') {
            console.error('[Payroll] Worker error:', message);
            stopWorkerHeartbeat();
            updateWorkerLED('error');
            hideProcessingOverlay();
            alert('Payroll calculation failed: ' + message);
        }
    };
    
    payrollWorker.onerror = (error) => {
        console.error('[Payroll] Worker error:', error);
        stopWorkerHeartbeat();
        updateWorkerLED('error');
        hideProcessingOverlay();
        alert('Worker error occurred');
    };
};

// Set up UI event listeners
const setupEventListeners = () => {
    // Generate payroll button
    const generateBtn = document.getElementById('generate-payroll-btn');
    generateBtn?.addEventListener('click', handleGeneratePayroll);
    
    // Month selector
    const monthSelector = document.getElementById('month-selector');
    monthSelector?.addEventListener('change', handleMonthChange);
    
    // Export and print buttons
    const exportBtn = document.getElementById('export-btn');
    const printBtn = document.getElementById('print-btn');
    
    exportBtn?.addEventListener('click', handleExportCSV);
    printBtn?.addEventListener('click', handlePrintReport);
    
    // Modal close handlers
    const modal = document.getElementById('payroll-detail-modal');
    const downloadSlipBtn = document.getElementById('download-slip-btn');
    downloadSlipBtn?.addEventListener('click', handleDownloadSlip);
};



// Add this function before handleGeneratePayroll
const validateAndFixEmployeeData = (employees) => {
    return employees.map(employee => {
        // Ensure financial data exists
        if (!employee.financial) {
            console.warn(`[Payroll] Employee ${employee.identity?.firstName || 'Unknown'} missing financial data, adding defaults`);
            employee.financial = {
                baseSalary: 50000, // Default salary
                currency: 'USD',
                taxBrackets: 'tier_1', // Default tax bracket
                bankDetail: { bankName: 'Chase', accountNumber: '****0000' }
            };
        }
        
        // Ensure all required financial fields exist
        employee.financial.baseSalary = employee.financial.baseSalary || 50000;
        employee.financial.currency = employee.financial.currency || 'USD';
        employee.financial.taxBrackets = employee.financial.taxBrackets || 'tier_1';
        employee.financial.bankDetail = employee.financial.bankDetail || { bankName: 'Chase', accountNumber: '****0000' };
        
        return employee;
    });
};

// Update the handleGeneratePayroll function:
const handleGeneratePayroll = async () => {
    try {
        const monthSelector = document.getElementById('month-selector');
        const selectedMonth = monthSelector.value;
        
        if (!selectedMonth) {
            alert('Please select a month');
            return;
        }
        
        // Show processing UI
        showProcessingOverlay();
        startWorkerHeartbeat(); // Start LED pulsing
        disableActionButtons();
        
        // Fetch all employees
        const allEmployees = await getAllEmployees(db);
        console.log('[Payroll] Fetched employees:', allEmployees.length);
        
        // Filter for active employees only
        let activeEmployees = allEmployees.filter(emp => !emp.isDeleted);
        console.log('[Payroll] Active employees:', activeEmployees.length);
        
        if (activeEmployees.length === 0) {
            hideProcessingOverlay();
            stopWorkerHeartbeat();
            updateWorkerLED('idle');
            alert('No active employees found');
            return;
        }
        
        // Validate and fix employee data
        activeEmployees = validateAndFixEmployeeData(activeEmployees);
        console.log('[Payroll] Employee data validated');
        
        // Send to worker for processing
        payrollWorker.postMessage({
            action: 'CALCULATE_PAYROLL',
            employees: activeEmployees,
            month: selectedMonth
        });
        
        console.log('[Payroll] Sent data to worker for processing');
        
    } catch (error) {
        console.error('[Payroll] Generate payroll failed:', error);
        hideProcessingOverlay();
        stopWorkerHeartbeat();
        updateWorkerLED('error');
        alert('Failed to generate payroll: ' + error.message);
    }
};
// Save payroll batch to database
const savePayrollBatch = async (db, workerResults) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['payroll'], 'readwrite');
        const payrollStore = transaction.objectStore('payroll');
        const userIndex = payrollStore.index('userIndex');
        
        let completed = 0;
        const total = workerResults.length;
        
        transaction.oncomplete = () => {
            console.log(`[Payroll] Batch save completed: ${total} records processed`);
            resolve();
        };
        
        transaction.onerror = () => {
            console.error('[Payroll] Transaction error:', transaction.error);
            reject(transaction.error);
        };
        
        // Process each payroll result
        workerResults.forEach((result) => {
            const { userId, historyItem, snapshot } = result;
            
            // Check if user has existing payroll record
            const getUserRequest = userIndex.get(userId);
            
            getUserRequest.onsuccess = () => {
                const existingRecord = getUserRequest.result;
                
                if (existingRecord) {
                    // Update existing record
                    existingRecord.baseSalary = snapshot.baseSalary;
                    existingRecord.currency = snapshot.currency;
                    existingRecord.taxBrackets = snapshot.taxBrackets;
                    existingRecord.bankDetails = snapshot.bankDetails;
                    
                    // Add new history item
                    if (!existingRecord.payrollHistory) {
                        existingRecord.payrollHistory = [];
                    }
                    existingRecord.payrollHistory.push(historyItem);
                    
                    // Update in store
                    const updateRequest = payrollStore.put(existingRecord);
                    updateRequest.onsuccess = () => {
                        completed++;
                        console.log(`[Payroll] Updated record for user ${userId}`);
                    };
                    
                } else {
                    // Create new record
                    const newRecord = {
                        payrollId: crypto.randomUUID(),
                        userId: userId,
                        baseSalary: snapshot.baseSalary,
                        currency: snapshot.currency,
                        taxBrackets: snapshot.taxBrackets,
                        bankDetails: snapshot.bankDetails,
                        payrollHistory: [historyItem]
                    };
                    
                    const addRequest = payrollStore.add(newRecord);
                    addRequest.onsuccess = () => {
                        completed++;
                        console.log(`[Payroll] Created new record for user ${userId}`);
                    };
                }
            };
            
            getUserRequest.onerror = () => {
                console.error(`[Payroll] Error checking existing record for user ${userId}`);
                reject(getUserRequest.error);
            };
        });
    });
};

// UI Helper Functions
const showProcessingOverlay = () => {
    const overlay = document.getElementById('processing-status');
    overlay?.classList.remove('hidden');
    
    // Start progress animation
    updateProgress(0);
    simulateProgress();
};

const hideProcessingOverlay = () => {
    const overlay = document.getElementById('processing-status');
    overlay?.classList.add('hidden');
};

const updateProgress = (percentage) => {
    const progressFill = document.getElementById('progress-fill');
    const progressDetails = document.getElementById('processing-details');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressDetails) {
        if (percentage < 30) {
            progressDetails.textContent = 'Fetching employee data...';
        } else if (percentage < 60) {
            progressDetails.textContent = 'Processing payroll calculations...';
        } else if (percentage < 90) {
            progressDetails.textContent = 'Saving to database...';
        } else {
            progressDetails.textContent = 'Finalizing results...';
        }
    }
};

const simulateProgress = () => {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        updateProgress(progress);
    }, 200);
};

const disableActionButtons = () => {
    const exportBtn = document.getElementById('export-btn');
    const printBtn = document.getElementById('print-btn');
    const generateBtn = document.getElementById('generate-payroll-btn');
    
    exportBtn?.setAttribute('disabled', 'true');
    printBtn?.setAttribute('disabled', 'true');
    generateBtn?.setAttribute('disabled', 'true');
};

const enableActionButtons = () => {
    const exportBtn = document.getElementById('export-btn');
    const printBtn = document.getElementById('print-btn');
    const generateBtn = document.getElementById('generate-payroll-btn');
    
    exportBtn?.removeAttribute('disabled');
    printBtn?.removeAttribute('disabled');
    generateBtn?.removeAttribute('disabled');
};

// Render payroll table
const renderPayrollTable = async (payrollData) => {
    const tbody = document.getElementById('payroll-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (payrollData.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="9" class="no-data">
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <h3>No Payroll Data</h3>
                        <p>Generate payroll for the selected month to view details</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Get employee details for each payroll record
    const employees = await getAllEmployees(db);
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    
    const fragment = document.createDocumentFragment();
    
    payrollData.forEach((payrollItem, index) => {
        const employee = employeeMap.get(payrollItem.userId);
        if (!employee) return;
        
        const { historyItem, snapshot } = payrollItem;
        const { calculations } = historyItem;
        
        const row = document.createElement('tr');
        row.className = 'payroll-row';
        
        const taxRate = snapshot.taxBrackets === 'tier_2' ? '20%' : '10%';
        
        row.innerHTML = `
            <td>
                <div class="employee-cell">
                    <div class="employee-avatar-small">👤</div>
                    <div class="employee-info">
                        <div class="employee-name">${employee.identity.firstName} ${employee.identity.lastName}</div>
                        <div class="employee-id">${employee.id.substring(0, 8)}...</div>
                    </div>
                </div>
            </td>
            <td>${employee?.department?.deptName}</td>
            <td><span class="currency">$${snapshot.baseSalary.toLocaleString()}</span></td>
            <td><span class="tax-bracket ${snapshot.taxBrackets}">${snapshot.taxBrackets.toUpperCase()} (${taxRate})</span></td>
            <td><span class="currency positive">$${calculations.grossPay.toLocaleString()}</span></td>
            <td><span class="currency negative">$${calculations.taxDeduct.toLocaleString()}</span></td>
            <td><span class="currency positive">$${calculations.netPay.toLocaleString()}</span></td>
            <td><span class="status-badge processed">Processed</span></td>
            <td class="actions">
                <button class="btn btn-view" data-action="view" data-index="${index}">View</button>
            </td>
        `;
        
        fragment.appendChild(row);
    });
    
    tbody.appendChild(fragment);
    
    // Add event listeners for view buttons
    tbody.addEventListener('click', handleTableAction);
};

// Handle table actions
const handleTableAction = (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const index = target.dataset.index;
    
    if (action === 'view' && index !== undefined) {
        showPayrollDetail(parseInt(index));
    }
};

// Show payroll detail modal
const showPayrollDetail = async (index) => {
    if (!currentPayrollData[index]) return;
    
    const payrollItem = currentPayrollData[index];
    const employees = await getAllEmployees(db);
    const employee = employees.find(emp => emp.id === payrollItem.userId);
    
    if (!employee) return;
    
    const { historyItem, snapshot } = payrollItem;
    const { calculations } = historyItem;
    const taxRate = snapshot.taxBrackets === 'tier_2' ? '20%' : '10%';
    
    // Populate modal
    document.getElementById('modal-employee-name').textContent = 
        `${employee.identity.firstName} ${employee.identity.lastName}`;
    document.getElementById('modal-employee-dept').textContent = employee.department.deptName;
    document.getElementById('modal-employee-id').textContent = employee.id;
    
    document.getElementById('modal-base-salary').textContent = `$${snapshot.baseSalary.toLocaleString()}`;
    document.getElementById('modal-gross-pay').textContent = `$${calculations.grossPay.toLocaleString()}`;
    document.getElementById('modal-tax-rate').textContent = taxRate;
    document.getElementById('modal-tax-deduction').textContent = `$${calculations.taxDeduct.toLocaleString()}`;
    document.getElementById('modal-total-deductions').textContent = `$${calculations.taxDeduct.toLocaleString()}`;
    document.getElementById('modal-net-pay').textContent = `$${calculations.netPay.toLocaleString()}`;
    
    document.getElementById('modal-generated-date').textContent = 
        new Date(historyItem.generatedAt).toLocaleDateString();
    document.getElementById('modal-pay-period').textContent = historyItem.month;
    document.getElementById('modal-payment-status').textContent = 'Processed';
    
    // Show modal
    document.getElementById('payroll-detail-modal').showModal();
};

// Update stats cards
const updateStatsCards = (payrollData) => {
    const totalEmployees = payrollData.length;
    const totalGross = payrollData.reduce((sum, item) => sum + item.historyItem.calculations.grossPay, 0);
    const totalDeductions = payrollData.reduce((sum, item) => sum + item.historyItem.calculations.taxDeduct, 0);
    const totalNet = payrollData.reduce((sum, item) => sum + item.historyItem.calculations.netPay, 0);
    
    document.getElementById('total-employees').textContent = totalEmployees.toLocaleString();
    document.getElementById('total-gross').textContent = `$${totalGross.toLocaleString()}`;
    document.getElementById('total-deductions').textContent = `$${totalDeductions.toLocaleString()}`;
    document.getElementById('total-net').textContent = `$${totalNet.toLocaleString()}`;
};

// Set default month
const setDefaultMonth = () => {
    const monthSelector = document.getElementById('month-selector');
    if (monthSelector) {
        const currentDate = new Date();
        const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Find and select current month
        for (let option of monthSelector.options) {
            if (option.value === currentMonth) {
                option.selected = true;
                break;
            }
        }
    }
};

// Event handlers
const handleMonthChange = () => {
    // Reset data when month changes
    currentPayrollData = [];
    renderPayrollTable([]);
    updateStatsCards([]);
    disableActionButtons();
    document.getElementById('generate-payroll-btn')?.removeAttribute('disabled');
};

const handleExportCSV = () => {
    if (currentPayrollData.length === 0) {
        alert('No payroll data to export');
        return;
    }
    
    // Implementation for CSV export
    console.log('[Payroll] Exporting CSV...');
    alert('CSV export feature coming soon');
};

const handlePrintReport = () => {
    if (currentPayrollData.length === 0) {
        alert('No payroll data to print');
        return;
    }
    
    // Implementation for print report
    console.log('[Payroll] Printing report...');
    window.print();
};

const handleDownloadSlip = () => {
    console.log('[Payroll] Downloading pay slip...');
    alert('Pay slip download feature coming soon');
};

// Load existing payroll data
const loadExistingPayroll = async () => {
    // Implementation to load existing payroll for the selected month
    console.log('[Payroll] Loading existing payroll data...');
};

// Add success message display
const showSuccessMessage = (message) => {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-toast';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-color);
        color: var(--primary-background-color);
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
};

// Add CSS for toast animations
const addToastStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePayroll);

// Export for use in other modules
export { initializePayroll, savePayrollBatch };