import { checkLoggedin } from "../auth/auth-service.js";
import { initSidebar } from "../components/sidebar.js";
import { connectToDb, applyLeave, getLeavesByEmployee,getEmployeeById, getLeavesByHr, updateLeaveStatus } from "../core/db.js";
import { tryCatchAsync, tryCatchSync } from "../utils/tryCatch.js";
import { 
    SERVER_PORT, 
    SERVER_URL, 
    LEAVE_STATUS, 
    LEAVE_TYPES, 
    ROLES, 
    DEPARTMENTS 
} from '../config.js';
import { socketService } from "../services/socketService.js";


// Authentication
const userId = sessionStorage.getItem("userId");
const userRole = sessionStorage.getItem("role");
const firstName = sessionStorage.getItem("firstName") ;
const userDeptId = sessionStorage.getItem("deptId"); 






checkLoggedin(userId);

// Memory Management 
const leaveMetadata = new WeakMap(); // Store full leave objects
const processingLeaves = new WeakSet(); // Track updating rows

// Global variables
let db;
let currentFilter = 'all';
let allLeaves = [];

// DOM Elements
const leavesListContainer = document.getElementById('leaves-list');
const emptyState = document.getElementById('empty-state');
const leaveModal = document.getElementById('leave-application-modal');
const leaveForm = document.getElementById('leave-application-form');
const filterTabs = document.querySelector('.filter-tabs');
const applyLeaveBtn = document.getElementById('apply-leave-btn');

/**
 * Main initialization function
 */
export const initLeavesModule = async () => {
    try {
        
        
        // Initialize sidebar
        const [sidebarErr] = tryCatchSync(() => initSidebar());
        if (sidebarErr) {
            console.error('[Leaves] Sidebar initialization failed:', sidebarErr);
        }

        // Connect to database
        const [dbErr, dbData] = await tryCatchAsync(connectToDb());
        if (dbErr) {
            console.error('[Leaves] Database connection failed:', dbErr);
            showNotification('Failed to connect to database', 'error');
            return;
        }
        db = dbData;
        // setupRoleBasedControl();        
        populateDeptDropdown();
        await loadLeavesData();
        socketService.connect() ; 
        setupEventListeners();
        setupFormHandlers();


    } catch (error) {
        console.error('[Leaves] Module initialization failed:', error);
        showNotification('Failed to initialize leaves module', 'error');
    }
};

/**
 * Connect to socket service 
*/
export const connectToSocket = (e) => { 
    const [error] = tryCatchSync(() => { 
        const data = e.detail ; 
        switch(data.type) { 
            case 'LEAVE_APPROVED' : 
                showNotification('Leave request approved.'); 
                loadLeavesData() ; 
                break ; 
            case 'LEAVE_REJECTED' : 
                showNotification('Leave request rejected'); 
                loadLeavesData() ; 
                break ; 
            case 'LEAVE_CANCELLED': 
                showNotification('Leave request cancelled');
                loadLeavesData() ; 
                break;
            default: 
                console.log('Unknown socket event', data.type) ; 

        }
    }) ; 
    if(error) { 
        console.error(`Error intializing socket`,error) ; 
    }
}
// LISTEN TO SOCKET 

/**
 * Role-based access control setup
 */
const setupRoleBasedControl = () => {
   
};

/**
 * Populate department dropdown from config
 */
const populateDeptDropdown = () => {
    //  department filter dropdown
    // TODO : ADD IN HTML 
    const deptSelect = document.getElementById('department-filter');
    if (deptSelect) {
        deptSelect.innerHTML = '<option value="">All Departments</option>';
        DEPARTMENTS.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.deptId;
            option.textContent = dept.deptName;
            deptSelect.appendChild(option);
        });
    }
};

/**
 * Load leaves data based on user role
 */
const loadLeavesData = async () => {
    try {
        showLoadingState();

        let leaves = [];
        
        if (userRole === ROLES.hr_manager) {
            // HR sees all leaves for their department
            const [hrLeavesErr, hrLeaves] = await tryCatchAsync(
                getLeavesByHr(db, userRole, userDeptId)
            );
            
            if (hrLeavesErr) {
                console.error('[Leaves] Failed to fetch HR leaves:', hrLeavesErr);
                showNotification('Failed to load leave requests', 'error');
                return;
            }
            
            leaves = hrLeaves || [];
        } else {
            // Employee sees only their leaves
            const [empLeavesErr, empLeaves] = await tryCatchAsync(
                getLeavesByEmployee(db, userId)
            );
            
            if (empLeavesErr) {
                console.error('[Leaves] Failed to fetch employee leaves:', empLeavesErr);
                showNotification('Failed to load your leave requests', 'error');
                return;
            }
            
            leaves = empLeaves || [];
        }

        allLeaves = leaves;
        renderLeavesList(leaves);
        updateStatsBar(leaves);

    } catch (error) {
        console.error('[Leaves] Error loading leaves data:', error);
        showNotification('Failed to load leave data', 'error');
    }
};

/**
 * Render leaves list with proper DOM creation and WeakMap storage
 */
const renderLeavesList = (leaves) => {
    try {
        // Clear container
        leavesListContainer.innerHTML = '';

        if (!leaves || leaves.length === 0) {
            showEmptyState();
            return;
        }

        hideEmptyState();

        leaves.forEach(leave => {
            const cardElement = createLeaveCard(leave);
            if (cardElement) {
                // Store full leave object in WeakMap
                leaveMetadata.set(cardElement, leave);
                leavesListContainer.appendChild(cardElement);
                
                // Add fade-in animation
                requestAnimationFrame(() => {
                    cardElement.classList.add('fade-in');
                });
            }
        });

    } catch (error) {
        console.error('[Leaves] Error rendering leaves list:', error);
    }
};

/**
 * Create individual leave card DOM element
 */
const createLeaveCard = (leave) => {
    try {
        const card = document.createElement('article');
        card.className = 'leave-card';
        card.setAttribute('data-id', leave.id);

        // Calculate duration 
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        // Format dates
        const dateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        
        // Get leave type badge class
        const leaveTypeClass = getLeaveTypeBadgeClass(leave.type);
        
        // Get status badge class
        const statusClass = leave.status || LEAVE_STATUS.PENDING;
        // employee name 
        const employeeName = userRole === ROLES.hr_manager ? 
            (leave.employeeName || 'Unknown Employee') : 
            firstName ; 

        card.innerHTML = `
            <div class="leave-card-header">
                <div class="leave-dates">
                    <span class="date-range">${dateRange}</span>
                    <span class="leave-duration">${duration} day${duration > 1 ? 's' : ''}</span>
                </div>
                <div class="leave-type-badge ${leaveTypeClass}">${getLeaveTypeDisplay(leave.type)}</div>
            </div>
            
            <div class="leave-card-body">
                <div class="leave-reason">
                    <h4>Reason:</h4>
                    <p>${leave.reason}</p>
                </div>
                 <div class="leave-applicant">
                    <span class="applicant-name">${employeeName}</span>
                    <span class="applicant-department">${leave.deptName || getDepartmentName(leave.deptId)}</span>
                </div>
            </div>
            
            <div class="leave-card-footer">
                <div class="status-badge ${statusClass}">${getStatusDisplay(statusClass)}</div>
                <div class="leave-actions">
                    ${generateActionButtons(leave)}
                </div>
            </div>
        `;

        // Store leave data in WeakMap
        leaveMetadata.set(card, leave);

        return card;

    } catch (error) {
        console.error('[Leaves] Error creating leave card:', error);
        return null;
    }
};
/**
 * Generate action buttons based on leave status and user role
 */
const generateActionButtons = (leave) => {
    const status = leave.status || LEAVE_STATUS.PENDING;
    let buttons = '';

    // HR Manager permissions: Approve/Reject pending leaves only
    if (userRole === ROLES.hr_manager && status === LEAVE_STATUS.PENDING) {
        buttons += `
            <button class="btn-action btn-approve hr-only" data-action="approve">
                <span class="action-icon">✓</span>
                Approve
            </button>
            <button class="btn-action btn-reject hr-only" data-action="reject">
                <span class="action-icon">✗</span>
                Reject
            </button>
        `;
    }

    // Employee permissions: Cancel their own leaves (pending or approved)
    if (userRole === ROLES.employee && (status === LEAVE_STATUS.PENDING || status === LEAVE_STATUS.APPROVED)) {
        // Only show cancel for the employee's own leaves
        if (leave.employeeId === userId) {
            buttons += `
                <button class="btn-action btn-cancel" data-action="cancel">
                    <span class="action-icon">🗙</span>
                    Cancel
                </button>
            `;
        }
    }

    // Reapply option for rejected leaves (both HR and employees)
    if (status === LEAVE_STATUS.REJECTED) {
        // For HR viewing other employees' rejected leaves, or employees viewing their own
        if (userRole === ROLES.hr_manager || leave.employeeId === userId) {
            buttons += `
                <button class="btn-action btn-reapply" data-action="reapply">
                    <span class="action-icon">↻</span>
                    Reapply
                </button>
            `;
        }
    }
    
    return buttons;
};

/**
 * Setup event listeners
 */
const setupEventListeners = () => {
    // Event delegation for leave actions
    if (leavesListContainer) {
        leavesListContainer.addEventListener('click', handleLeaveAction);
    }

    // Filter tabs
    if (filterTabs) {
        filterTabs.addEventListener('click', handleFilterChange);
    }

    // Apply leave button
    if (applyLeaveBtn) {
        applyLeaveBtn.addEventListener('click', showLeaveModal);
    }

    // Modal close handlers
    const closeModalBtn = document.getElementById('close-leave-modal');
    const cancelBtn = document.getElementById('cancel-leave-application');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideLeaveModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideLeaveModal);
    }

    // Close modal on backdrop click
    if (leaveModal) {
        leaveModal.addEventListener('click', (e) => {
            if (e.target === leaveModal) {
                hideLeaveModal();
            }
        });
    }
    // listen for websocket 
    window.addEventListener('socket-event', connectToSocket); 

    // Character counter for reason textarea
    const reasonTextarea = document.getElementById('leave-reason');
    const reasonCounter = document.getElementById('reason-counter');
    
    if (reasonTextarea && reasonCounter) {
        reasonTextarea.addEventListener('input', (e) => {
            const length = e.target.value.length;
            reasonCounter.textContent = length;
            
            if (length > 500) {
                reasonCounter.style.color = 'var(--status-rejected)';
            } else {
                reasonCounter.style.color = 'var(--text-muted)';
            }
        });
    }
};

/**
 * Handle leave actions using event delegation
 */
const handleLeaveAction = async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    const card = actionBtn.closest('.leave-card');
    
    if (!card || processingLeaves.has(card)) {
        return; // Prevent double-clicks
    }

    // Get leave data from WeakMap
    const leave = leaveMetadata.get(card);
    if (!leave) {
        console.error('[Leaves] No leave data found for card');
        return;
    }

    // Add to processing set
    processingLeaves.add(card);
    
    try {
        await processLeaveAction(action, leave, card);
    } finally {
        // Remove from processing set
        processingLeaves.delete(card);
    }
};

/**
 * Process specific leave action
 */
const processLeaveAction = async (action, leave, cardElement) => {
    try {
        // Permission checks
        if (action === 'approve' || action === 'reject') {
            if (userRole !== ROLES.hr_manager) {
                showNotification('Only HR managers can approve or reject leave requests', 'error');
                return;
            }
            if (leave.status !== LEAVE_STATUS.PENDING) {
                showNotification('Can only approve or reject pending leave requests', 'error');
                return;
            }
        }

        if (action === 'cancel') {
            // Employees can only cancel their own leaves
            if (userRole === ROLES.employee && leave.employeeId !== userId) {
                showNotification('You can only cancel your own leave requests', 'error');
                return;
            }
            // HR cannot cancel leaves
            if (userRole === ROLES.hr_manager) {
                showNotification('HR managers cannot cancel leave requests. Use approve or reject instead.', 'error');
                return;
            }
        }

        let newStatus;
        let successMessage;

        switch (action) {
            case 'approve':
                newStatus = LEAVE_STATUS.APPROVED;
                successMessage = 'Leave request approved successfully';
                break;
            case 'reject':
                newStatus = LEAVE_STATUS.REJECTED;
                successMessage = 'Leave request rejected successfully';
                break;
            case 'cancel':
                newStatus = LEAVE_STATUS.CANCELLED;
                successMessage = 'Leave request cancelled successfully';
                break;
            case 'reapply':
                // Handle reapply by showing modal with pre-filled data
                showLeaveModal(leave);
                return;
            default:
                console.error('[Leaves] Unknown action:', action);
                return;
        }

        // Show loading state on card
        showCardLoadingState(cardElement);

        // Update leave status in database
        const [updateErr, result] = await tryCatchAsync(
            updateLeaveStatus(db, userRole, leave.id, leave.deptId, newStatus)
        );

        if (updateErr) {
            console.error('[Leaves] Failed to update leave status:', updateErr);
            showNotification('Failed to update leave status', 'error');
            hideCardLoadingState(cardElement);
            return;
        }
        // send websocket message 
        const socketMessage = { 
            type: `LEAVE_${newStatus.toUpperCase()}`,
            leaveId: leave.id,
            employeeId: leave.employeeId,
            employeeName: leave.employeeName || 'Unknown Employee',
            newStatus: newStatus,
            updatedBy: userId,
            timestamp: Date.now()
        } ; 
        socketService.send('LEAVE_UPDATE',socketMessage) ; 
        console.log(`Websocket sent message`) ; 


        // Update local data
        leave.status = newStatus;
        leaveMetadata.set(cardElement, leave);

        // Update card UI
        updateCardStatus(cardElement, newStatus);
        showNotification(successMessage, 'success');

        // Refresh stats
        updateStatsBar(allLeaves);

    } catch (error) {
        console.error('[Leaves] Error processing leave action:', error);
        showNotification('An error occurred while processing the request', 'error');
        hideCardLoadingState(cardElement);
    }
};

/**
 * Handle filter changes
 */
const handleFilterChange = (e) => {
    const filterBtn = e.target.closest('.tab-btn');
    if (!filterBtn) return;

    const filter = filterBtn.getAttribute('data-filter');
    if (filter === currentFilter) return;

    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    filterBtn.classList.add('active');

    currentFilter = filter;
    applyFilter(filter);
};

/**
 * Apply filter to leaves list
 */
const applyFilter = (filter) => {
    let filteredLeaves = allLeaves;

    if (filter !== 'all') {
        filteredLeaves = allLeaves.filter(leave => 
            (leave.status || LEAVE_STATUS.PENDING) === filter
        );
    }

    renderLeavesList(filteredLeaves);
};

/**
 * Setup form handlers
 */
const setupFormHandlers = () => {
    if (leaveForm) {
        leaveForm.addEventListener('submit', handleLeaveFormSubmit);
    }

    // Date validation
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    if (startDateInput && endDateInput) {
        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        startDateInput.min = today;
        endDateInput.min = today;

        startDateInput.addEventListener('change', (e) => {
            endDateInput.min = e.target.value;
            if (endDateInput.value && endDateInput.value < e.target.value) {
                endDateInput.value = e.target.value;
            }
        });
    }
};

/**
 *  leave form submission
 */
const handleLeaveFormSubmit = async (e) => {
    e.preventDefault();

    try {
        const formData = new FormData(e.target);

        const leaveData = {
            id: generateLeaveId(),            
            type: mapFormTypeToConfig(formData.get('leaveType')),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            reason: formData.get('reason'),
            deptId: userDeptId,
            deptName: getDepartmentName(userDeptId),
            status: LEAVE_STATUS.PENDING
        };

        
        if (!validateLeaveData(leaveData)) {
            return;
        }
        // create card 
        const optimisticLeave = { ...leaveData, status: 'syncing' };
        const optimisticCard = createOptimisticCard(optimisticLeave);
        
        // Add to list immediately
        leavesListContainer.insertBefore(optimisticCard, leavesListContainer.firstChild);
        leaveMetadata.set(optimisticCard, optimisticLeave);

        // Hide modal
        hideLeaveModal();

        // Submit to database
        const [submitErr, result] = await tryCatchAsync(
            applyLeave(db, userRole, userId, {
                id: leaveData.id,      
                type: leaveData.type,
                deptId: userDeptId,
                deptName: leaveData.deptName,
                reason: leaveData.reason,
                date : { 
                    startDate: leaveData.startDate, 
                    endDate : leaveData.endDate,
                },
                status: LEAVE_STATUS.PENDING
            })
        );

        if (submitErr) {
            console.error('[Leaves] Failed to submit leave application:', submitErr);
            optimisticCard.remove();
            showNotification('Failed to submit leave application', 'error');
            return;
        }

        // Update optimistic card to show success
        optimisticLeave.status = LEAVE_STATUS.PENDING;
        leaveMetadata.set(optimisticCard, optimisticLeave);
        updateCardStatus(optimisticCard, LEAVE_STATUS.PENDING);
        
        // Add to allLeaves array
        allLeaves.unshift(optimisticLeave);
        
        showNotification('Leave application submitted successfully', 'success');
        updateStatsBar(allLeaves);

    } catch (error) {
        console.error('[Leaves] Error submitting leave application:', error);
        showNotification('An error occurred while submitting your application', 'error');
    }
};

/**
 * Create optimistic UI card for immediate feedback
 */
const createOptimisticCard = (leave) => {
    const card = createLeaveCard(leave);
    
    // Add syncing indicator
    const statusBadge = card.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.className = 'status-badge syncing';
        statusBadge.textContent = 'Syncing...';
        statusBadge.style.background = 'rgba(59, 130, 246, 0.2)';
        statusBadge.style.color = 'var(--accent-primary)';
    }
    
    return card;
};

/**
 * Update card status display
 */
const updateCardStatus = (cardElement, newStatus) => {
    const statusBadge = cardElement.querySelector('.status-badge');
    const actionsContainer = cardElement.querySelector('.leave-actions');
    
    if (statusBadge) {
        statusBadge.className = `status-badge ${newStatus}`;
        statusBadge.textContent = getStatusDisplay(newStatus);
    }
    
    if (actionsContainer) {
        const leave = leaveMetadata.get(cardElement);
        if (leave) {
            actionsContainer.innerHTML = generateActionButtons({...leave, status: newStatus});
        }
    }
};

/**
 * Show/hide modal functions
 */
const showLeaveModal = (prefillData = null) => {
    if (leaveModal) {
        if (prefillData) {
            prefillLeaveForm(prefillData);
        } else {
            leaveForm.reset();
            document.getElementById('reason-counter').textContent = '0';
        }
        leaveModal.showModal();
        document.getElementById('leave-type').focus();
    }
};

const hideLeaveModal = () => {
    if (leaveModal) {
        leaveModal.close();
        leaveForm.reset();
    }
};

/**
 * Prefill form for reapply functionality
 */
const prefillLeaveForm = (leave) => {
    if (leave.type) {
        document.getElementById('leave-type').value = mapConfigTypeToForm(leave.type);
    }
    if (leave.startDate && leave.endDate) {
        document.getElementById('start-date').value = leave.startDate;
        document.getElementById('end-date').value = leave.endDate;
    }
    if (leave.reason) {
        const reasonTextarea = document.getElementById('leave-reason');
        reasonTextarea.value = leave.reason;
        
        // Update character counter
        const counter = document.getElementById('reason-counter');
        if (counter) {
            counter.textContent = leave.reason.length;
        }
    }
};

/**
 * Update stats bar with current data
 */
const updateStatsBar = (leaves) => {
    const total = leaves.length;
    const pending = leaves.filter(l => (l.status || LEAVE_STATUS.PENDING) === LEAVE_STATUS.PENDING).length;
    const approved = leaves.filter(l => l.status === LEAVE_STATUS.APPROVED).length;
    const rejected = leaves.filter(l => l.status === LEAVE_STATUS.REJECTED).length;

    const statElements = document.querySelectorAll('.total-leaves-count');
    if (statElements.length >= 4) {
        statElements[0].textContent = total;
        statElements[1].textContent = pending;
        statElements[2].textContent = approved;
        statElements[3].textContent = rejected;
    }
};

/**
 * Utility functions
 */
const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
};

const getLeaveTypeBadgeClass = (type) => {
    const typeMap = {
        [LEAVE_TYPES.SICK_LEAVE]: 'sick-leave',
        [LEAVE_TYPES.CASUAL_LEAVE]: 'vacation',
        [LEAVE_TYPES.OPTIONAL_LEAVE]: 'personal',
        [LEAVE_TYPES.NOPAY_LEAVE]: 'emergency'
    };
    return typeMap[type] || 'personal';
};

const getLeaveTypeDisplay = (type) => {
    const displayMap = {
        [LEAVE_TYPES.SICK_LEAVE]: 'Sick Leave',
        [LEAVE_TYPES.CASUAL_LEAVE]: 'Casual Leave',
        [LEAVE_TYPES.OPTIONAL_LEAVE]: 'Optional Leave',
        [LEAVE_TYPES.NOPAY_LEAVE]: 'No Pay Leave'
    };
    return displayMap[type] || 'Unknown';
};

const mapConfigTypeToForm = (configType) => {
    const reverseMap = {
        [LEAVE_TYPES.SICK_LEAVE]: 'sick',
        [LEAVE_TYPES.CASUAL_LEAVE]: 'casual',
        [LEAVE_TYPES.OPTIONAL_LEAVE]: 'optional',
        [LEAVE_TYPES.NOPAY_LEAVE]: 'nopay'
    };
    return reverseMap[configType] || configType;
};


const getStatusDisplay = (status) => {
    const displayMap = {
        [LEAVE_STATUS.PENDING]: 'Pending',
        [LEAVE_STATUS.APPROVED]: 'Approved',
        [LEAVE_STATUS.REJECTED]: 'Rejected',
        [LEAVE_STATUS.CANCELLED]: 'Cancelled'
    };
    return displayMap[status] || 'Unknown';
};

const getDepartmentName = (deptId) => {
    const dept = DEPARTMENTS.find(d => d.deptId === deptId);
    return dept ? dept.deptName : 'Unknown';
};

const generateLeaveId = () => {
    return `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const validateLeaveData = (data) => {
    // Updated validation for flattened structure
    if (!data.type || !data.startDate || !data.endDate || !data.reason) {
        return false;
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    if (endDate < startDate) {
        return false;
    }

    if (data.reason.length > 500) {
        return false;
    }

    return true;
};

/**
 * UI state management functions
 */
const showLoadingState = () => {
    if (leavesListContainer) {
        leavesListContainer.innerHTML = '<div class="loading-state">Loading leave requests...</div>';
    }
};

const showEmptyState = () => {
    if (emptyState) {
        emptyState.style.display = 'block';
    }
};

const hideEmptyState = () => {
    if (emptyState) {
        emptyState.style.display = 'none';
    }
};

const showCardLoadingState = (cardElement) => {
    cardElement.style.opacity = '0.6';
    cardElement.style.pointerEvents = 'none';
};

const hideCardLoadingState = (cardElement) => {
    cardElement.style.opacity = '1';
    cardElement.style.pointerEvents = 'auto';
};

/**
 * Notification system
 */
const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 600;
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;

    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
};

const mapFormTypeToConfig = (formType) => {
    const typeMap = {
        'sick': LEAVE_TYPES.SICK_LEAVE,
        'casual': LEAVE_TYPES.CASUAL_LEAVE,  
        'optional': LEAVE_TYPES.OPTIONAL_LEAVE,
        'nopay': LEAVE_TYPES.NOPAY_LEAVE
    };
    return typeMap[formType] || formType;
};


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initLeavesModule);    