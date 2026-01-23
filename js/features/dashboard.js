import { connectToDb, getAnnouncements, getHolidays, getEmployeeById, addAnnouncements, addHoliday, getAllEmployees } from '../core/db.js';
import { checkLoggedin } from '../auth/auth-service.js';
import { initSidebar } from '../components/sidebar.js';
// Constants
const CACHE_KEY = 'nexus_dashboard_cache';
const FILTER_PREF_KEY = 'nexus_pref_news_filter';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Global variables
let db;
let currentUser;

/**
 * Initialize Dashboard
 */
const initializeDashboard = async () => {
    try {
        console.log('[Dashboard] Initializing...');
        
        // Initialize sidebar
        initSidebar();
        
        // Check authentication
        const userId = sessionStorage.getItem('userId');
        checkLoggedin(userId);
        
        // Load cached data first
        loadStaleDataFromCache();
        
        // Connect to database
        db = await connectToDb(2);
        
        // Fetch fresh data
        await fetchFreshDataAndUpdateCache();
        
        // Setup UI
        setupEventListeners();
        createModals();
        setGreeting();
        applyStoredFilters();
        
        console.log('[Dashboard] Initialization complete');
        
    } catch (error) {
        console.error('[Dashboard] Initialization failed:', error);
        loadStaleDataFromCache();
    }
};

/**
 * Load cached data for immediate display
 */
const loadStaleDataFromCache = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            console.log('[Dashboard] Loading cached data...');
            
            if (data.announcements) renderAnnouncements(data.announcements);
            if (data.holidays) renderHolidays(data.holidays);
            if (data.attendance) updateAttendanceChart(data.attendance);
            if (data.teamActivity) renderTeamActivity(data.teamActivity);
            
            const age = Date.now() - timestamp;
            console.log(`[Dashboard] Cache age: ${Math.round(age / 1000)}s`);
        } else {
            showLoadingStates();
        }
    } catch (error) {
        console.error('[Dashboard] Cache load failed:', error);
        showLoadingStates();
    }
};

/**
 * Fetch fresh data and update cache
 */
const fetchFreshDataAndUpdateCache = async () => {
    try {
        console.log('[Dashboard] Fetching fresh data...');
        
        const userRole = sessionStorage.getItem('role');
        const userId = sessionStorage.getItem('userId');
        
        // Fetch all data
        const [announcements, holidays, employee, allEmployees, teamActivity] = await Promise.all([
            getAnnouncements(db, userRole),
            getHolidays(db, userRole),
            getEmployeeById(db, userId),
            getAllEmployees(db),
            generateMockTeamActivity()
        ]);
        
        // Prepare fresh data
        const freshData = {
            announcements: announcements || [],
            holidays: holidays || [],
            attendance: employee?.attendance || { logs: [] },
            teamActivity
        };
        
        // Update UI
        renderAnnouncements(freshData.announcements);
        renderHolidays(freshData.holidays);
        updateAttendanceChart(freshData.attendance);
        renderTeamActivity(freshData.teamActivity);
        updateStatsCards(freshData, allEmployees);
        
        // Cache data
        const cacheData = {
            data: freshData,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        
        console.log('[Dashboard] Fresh data loaded and cached');
        
    } catch (error) {
        console.error('[Dashboard] Failed to fetch fresh data:', error);
    }
};

/**
 * Set greeting based on time
 */
const setGreeting = () => {
    const now = new Date();
    const hour = now.getHours();
    
    
    let greeting;
    if (hour >= 5 && hour < 12) {
        greeting = 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
        greeting = 'Good Afternoon';
    } else {
        greeting = 'Good Evening';
    }
    
    const greetingElement = document.getElementById('dashboard-greeting');
    if (greetingElement) {
        greetingElement.textContent = `${greeting}, ${userName}`;
    }
};

/**
 * Update attendance chart
 */
const updateAttendanceChart = (attendanceData) => {
    try {
        const chartBars = document.querySelectorAll('.chart-bar');
        const logs = attendanceData.logs || [];
        
        // Get last 7 days
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split('T')[0];
        });
        
        let totalHours = 0;
        
        chartBars.forEach((bar, index) => {
            if (index >= last7Days.length) return;
            
            const targetDate = last7Days[index];
            const dayLog = logs.find(log => log.date === targetDate);
            const hoursWorked = dayLog ? dayLog.hoursWorked || 0 : 0;
            
            // Calculate percentage (8 hours = 100%)
            const percentage = Math.min((hoursWorked / 8) * 100, 100);
            bar.style.height = `${percentage}%`;
            
            // Remove existing classes
            bar.classList.remove('goal-met', 'goal-missed');
            
            // Add appropriate class
            if (hoursWorked >= 8) {
                bar.classList.add('goal-met');
            } else if (hoursWorked > 0) {
                bar.classList.add('goal-missed');
            }
            
            totalHours += hoursWorked;
        });
        
        // Update attendance percentage
        const attendancePercentage = Math.round((totalHours / (7 * 8)) * 100);
        const percentageElement = document.getElementById('attendance-percentage');
        if (percentageElement) {
            percentageElement.textContent = `${attendancePercentage}%`;
        }
        
        console.log('[Dashboard] Attendance chart updated');
        
    } catch (error) {
        console.error('[Dashboard] Failed to update attendance chart:', error);
    }
};

/**
 * Render announcements
 */
const renderAnnouncements = (announcements) => {
    try {
        const container = document.getElementById('news-feed-container');
        if (!container) return;
        
        // Apply RBAC for add button
        const addNewsBtn = document.getElementById('btn-add-news');
        const userRole = sessionStorage.getItem('role');
        
        if (addNewsBtn) {
            addNewsBtn.style.display = userRole === 'hr_manager' ? 'flex' : 'none';
        }
        
        container.innerHTML = '';
        
        if (!announcements || announcements.length === 0) {
            container.innerHTML = '<div class="no-data">No announcements available.</div>';
            return;
        }
        
        // Apply filter
        const currentFilter = localStorage.getItem(FILTER_PREF_KEY) || 'all';
        const filteredAnnouncements = filterAnnouncementsByBranch(announcements, currentFilter);
        
        filteredAnnouncements.forEach(announcement => {
            container.appendChild(createAnnouncementElement(announcement));
        });
        
        console.log(`[Dashboard] Rendered ${filteredAnnouncements.length} announcements`);
        
    } catch (error) {
        console.error('[Dashboard] Failed to render announcements:', error);
    }
};

/**
 * Create announcement element
 */
const createAnnouncementElement = (announcement) => {
    const newsItem = document.createElement('div');
    newsItem.className = `news-item priority-${announcement.priority || 'normal'}`;
    
    const date = new Date(announcement.date);
    const timeAgo = getTimeAgo(date);
    
    const title = announcement.title || 'No Title';
    const content = announcement.content || 'No Content';
    const author = announcement.author || 'Anonymous';
    const priority = announcement.priority || 'normal';
    
    newsItem.innerHTML = `
        <div class="news-header">
            <h4>${title}</h4>
            <span class="news-date">${timeAgo}</span>
        </div>
        <p class="news-content">${content}</p>
        <div class="news-footer">
            <span class="news-author">${author}</span>
            <span class="news-priority">${priority === 'high' ? 'High Priority' : 'Normal'}</span>
        </div>
    `;
    
    return newsItem;
};

/**
 * Render holidays
 */
const renderHolidays = (holidays) => {
    try {
        const container = document.getElementById('holiday-list');
        if (!container) return;
        
        // Add holiday button for HR
        const userRole = sessionStorage.getItem('role');
        const holidaysSection = container.closest('.holidays-section');
        let addHolidayBtn = document.getElementById('btn-add-holiday');
        
        if (!addHolidayBtn && userRole === 'hr_manager' && holidaysSection) {
            const sectionActions = holidaysSection.querySelector('.section-actions');
            addHolidayBtn = document.createElement('button');
            addHolidayBtn.id = 'btn-add-holiday';
            addHolidayBtn.className = 'btn-primary';
            addHolidayBtn.innerHTML = '<span class="btn-icon">+</span> Add Holiday';
            addHolidayBtn.onclick = showHolidayModal;
            sectionActions.appendChild(addHolidayBtn);
        }
        
        container.innerHTML = '';
        
        if (!holidays || holidays.length === 0) {
            container.innerHTML = '<div class="no-data">No holidays scheduled.</div>';
            return;
        }
        
        // Sort and show next 4 holidays
        const upcomingHolidays = holidays
            .filter(holiday => new Date(holiday.date) >= new Date())
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 4);
        
        upcomingHolidays.forEach(holiday => {
            const holidayItem = document.createElement('div');
            holidayItem.className = 'holiday-item';
            
            const date = new Date(holiday.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            holidayItem.innerHTML = `
                <div class="holiday-date">${formattedDate}</div>
                <div class="holiday-name">${holiday.name}</div>
            `;
            container.appendChild(holidayItem);
        });
        
        console.log(`[Dashboard] Rendered ${upcomingHolidays.length} holidays`);
        
    } catch (error) {
        console.error('[Dashboard] Failed to render holidays:', error);
    }
};

/**
 * Generate mock team activity
 */
const generateMockTeamActivity = async () => {
    const mockAbsentees = [
        { name: 'Alice Johnson', department: 'Marketing', status: 'Sick', avatar: 'AJ' },
        { name: 'Bob Wilson', department: 'Engineering', status: 'Vacation', avatar: 'BW' },
        { name: 'Carol Davis', department: 'Sales', status: 'Personal', avatar: 'CD' },
        { name: 'David Brown', department: 'HR', status: 'Conference', avatar: 'DB' }
    ];
    
    const numberOfAbsentees = Math.floor(Math.random() * 3) + 2;
    const selectedAbsentees = mockAbsentees
        .sort(() => 0.5 - Math.random())
        .slice(0, numberOfAbsentees);
    
    return {
        absentees: selectedAbsentees,
        totalEmployees: 50,
        availability: Math.round(((50 - selectedAbsentees.length) / 50) * 100)
    };
};

/**
 * Render team activity
 */
const renderTeamActivity = (teamData) => {
    try {
        const container = document.getElementById('team-activity-list');
        const countElement = document.getElementById('activity-count');
        const summaryElement = document.getElementById('team-summary-text');
        
        if (!container) return;
        
        // Update count
        if (countElement) {
            countElement.textContent = `${teamData.absentees.length} absent`;
        }
        
        container.innerHTML = '';
        
        teamData.absentees.forEach(person => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            activityItem.innerHTML = `
                <div class="activity-avatar">${person.avatar}</div>
                <div class="activity-details">
                    <div class="activity-name">${person.name}</div>
                    <div class="activity-department">${person.department}</div>
                </div>
                <div class="status-badge status-${person.status.toLowerCase()}">${person.status}</div>
            `;
            
            container.appendChild(activityItem);
        });
        
        // Update summary
        if (summaryElement) {
            summaryElement.innerHTML = ` Team availability: <strong>${teamData.availability}%</strong>`;
        }
        
        console.log('[Dashboard] Team activity rendered');
        
    } catch (error) {
        console.error('[Dashboard] Failed to render team activity:', error);
    }
};

/**
 * Update stats cards
 */
const updateStatsCards = (data, allEmployees) => {
    const announcementsCount = document.getElementById('announcements-count');
    const holidaysCount = document.getElementById('holidays-count');
    const teamAvailability = document.getElementById('team-availability');
    
    if (announcementsCount) {
        announcementsCount.textContent = data.announcements.length;
    }
    
    if (holidaysCount) {
        const upcomingHolidays = data.holidays.filter(h => new Date(h.date) >= new Date());
        holidaysCount.textContent = upcomingHolidays.length;
    }
    
    if (teamAvailability) {
        teamAvailability.textContent = `${data.teamActivity.availability}%`;
    }
};

/**
 * Filter announcements by branch
 */
const filterAnnouncementsByBranch = (announcements, branch) => {
    if (branch === 'all') return announcements;
    
    return announcements.filter(announcement => {
        const announcementBranch = announcement.branch || '';
        const announcementAuthor = announcement.author || '';
        
        return announcementBranch.toLowerCase() === branch.toLowerCase() || 
               announcementAuthor.toLowerCase().includes(branch.toLowerCase());
    });
};

/**
 * Apply stored filters
 */
const applyStoredFilters = () => {
    const filterSelect = document.getElementById('dashboard-filter');
    if (!filterSelect) return;
    
    const storedFilter = localStorage.getItem(FILTER_PREF_KEY) || 'all';
    filterSelect.value = storedFilter;
};

/**
 * Create modals using main.css styles
 */
const createModals = () => {
    createAnnouncementModal();
    createHolidayModal();
};

/**
 * Create announcement modal using main.css style
 */
const createAnnouncementModal = () => {
    const modal = document.createElement('dialog');
    modal.id = 'announcement-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Add New Announcement</h2>
            <button type="button" class="btn-close" id="close-announcement-modal">&times;</button>
        </div>
        <form id="announcement-form">
            <div class="form-group">
                <label for="announcement-title">Title:</label>
                <input type="text" id="announcement-title" name="title" required>
            </div>
            <div class="form-group">
                <label for="announcement-content">Content:</label>
                <textarea id="announcement-content" name="content" rows="4" required></textarea>
            </div>
            <div class="form-group">
                <label for="announcement-priority">Priority:</label>
                <select id="announcement-priority" name="priority">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                </select>
            </div>
            <div class="form-group">
                <label for="announcement-branch">Branch:</label>
                <select id="announcement-branch" name="branch">
                    <option value="all">All Branches</option>
                    <option value="operations">Operations</option>
                    <option value="tech">Tech</option>
                    <option value="sales">Sales</option>
                    <option value="hr">HR</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" id="cancel-announcement">Cancel</button>
                <button type="submit" class="btn-save">Post Announcement</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('close-announcement-modal').addEventListener('click', hideAnnouncementModal);
    document.getElementById('cancel-announcement').addEventListener('click', hideAnnouncementModal);
    document.getElementById('announcement-form').addEventListener('submit', handleAnnouncementSubmit);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideAnnouncementModal();
        }
    });
};

/**
 * Create holiday modal using main.css style
 */
const createHolidayModal = () => {
    const modal = document.createElement('dialog');
    modal.id = 'holiday-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Add New Holiday</h2>
            <button type="button" class="btn-close" id="close-holiday-modal">&times;</button>
        </div>
        <form id="holiday-form">
            <div class="form-group">
                <label for="holiday-name">Holiday Name:</label>
                <input type="text" id="holiday-name" name="name" required>
            </div>
            <div class="form-group">
                <label for="holiday-date">Date:</label>
                <input type="date" id="holiday-date" name="date" required>
            </div>
            <div class="form-group">
                <label for="holiday-type">Type:</label>
                <select id="holiday-type" name="type">
                    <option value="public">Public Holiday</option>
                    <option value="company">Company Holiday</option>
                    <option value="religious">Religious Holiday</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-cancel" id="cancel-holiday">Cancel</button>
                <button type="submit" class="btn-save">Add Holiday</button>
            </div>
        </form>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('close-holiday-modal').addEventListener('click', hideHolidayModal);
    document.getElementById('cancel-holiday').addEventListener('click', hideHolidayModal);
    document.getElementById('holiday-form').addEventListener('submit', handleHolidaySubmit);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideHolidayModal();
        }
    });
};

/**
 * Modal display functions
 */
const showAnnouncementModal = () => {
    const modal = document.getElementById('announcement-modal');
    modal.showModal();
    document.getElementById('announcement-title').focus();
};

const hideAnnouncementModal = () => {
    const modal = document.getElementById('announcement-modal');
    modal.close();
    document.getElementById('announcement-form').reset();
};

const showHolidayModal = () => {
    const modal = document.getElementById('holiday-modal');
    modal.showModal();
    document.getElementById('holiday-name').focus();
};

const hideHolidayModal = () => {
    const modal = document.getElementById('holiday-modal');
    modal.close();
    document.getElementById('holiday-form').reset();
};

/**
 * Form submission handlers
 */
const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const userRole = sessionStorage.getItem('role');
        const userName = sessionStorage.getItem('firstName') || sessionStorage.getItem('username');
        
        const announcementData = {
            title: formData.get('title'),
            content: formData.get('content'),
            priority: formData.get('priority'),
            branch: formData.get('branch'),
            author: userName
        };
        
        await addAnnouncements(db, userRole, announcementData);
        
        await fetchFreshDataAndUpdateCache();
        hideAnnouncementModal();
        showNotification('Announcement posted successfully!', 'success');
        
    } catch (error) {
        console.error('[Dashboard] Failed to add announcement:', error);
        showNotification('Failed to post announcement. Please try again.', 'error');
    }
};

const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    
    try {
        const formData = new FormData(e.target);
        const userRole = sessionStorage.getItem('role');
        
        const holidayData = {
            name: formData.get('name'),
            date: formData.get('date'),
            type: formData.get('type')
        };
        
        await addHoliday(db, userRole, holidayData);
        
        await fetchFreshDataAndUpdateCache();
        hideHolidayModal();
        showNotification('Holiday added successfully!', 'success');
        
    } catch (error) {
        console.error('[Dashboard] Failed to add holiday:', error);
        showNotification('Failed to add holiday. Please try again.', 'error');
    }
};

/**
 * Setup event listeners
 */
const setupEventListeners = () => {
    // Filter handling
    const filterSelect = document.getElementById('dashboard-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            const selectedFilter = e.target.value;
            localStorage.setItem(FILTER_PREF_KEY, selectedFilter);
            
            // Re-render announcements with new filter
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data } = JSON.parse(cached);
                renderAnnouncements(data.announcements);
            }
        });
    }
    
    // Quick action buttons
    const clockInBtn = document.querySelector('.clock-in-btn');
    const payrollBtn = document.querySelector('.payroll-btn');
    const directoryBtn = document.querySelector('.directory-btn');
    
    if (clockInBtn) {
        clockInBtn.addEventListener('click', () => {
            window.location.href = 'attendance.html';
        });
    }
    
    if (payrollBtn) {
        payrollBtn.addEventListener('click', () => {
            window.location.href = 'payroll.html';
        });
    }
    
    if (directoryBtn) {
        directoryBtn.addEventListener('click', () => {
            window.location.href = 'directory.html';
        });
    }
    
    // Add announcement button
    const addNewsBtn = document.getElementById('btn-add-news');
    if (addNewsBtn) {
        addNewsBtn.addEventListener('click', showAnnouncementModal);
    }
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
    }, 3000);
};

/**
 * Utility functions
 */
const showLoadingStates = () => {
    const containers = [
        { selector: '#news-feed-container', message: 'Loading announcements...' },
        { selector: '#holiday-list', message: 'Loading holidays...' },
        { selector: '#team-activity-list', message: 'Loading team activity...' }
    ];
    
    containers.forEach(({ selector, message }) => {
        const element = document.querySelector(selector);
        if (element) {
            element.innerHTML = `<div class="loading-state">${message}</div>`;
        }
    });
};

const getTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        const days = Math.floor(diffInMinutes / 1440);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
};

const clearDashboardCache = () => {
    localStorage.removeItem(CACHE_KEY);
    console.log('[Dashboard] Cache cleared');
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Export functions
export {
    initializeDashboard,
    setGreeting,
    updateAttendanceChart,
    renderAnnouncements,
    clearDashboardCache
};