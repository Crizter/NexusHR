export const createSidebar = () => {
    const currentUserRole = sessionStorage.getItem('role');
    const currentUser = sessionStorage.getItem('email');
    
    // Define menu items based on role
    const menuItems = [
           {
            id:'profile', 
            label: 'Profile', 
            icon:'', 
            href : 'profile.html',
            roles: ['hr_manager','employee','super_admin'],
        },
        { 
            id: 'index', 
            label: 'Dashboard', 
            icon: '', 
            href: 'index.html',
            roles: ['hr_manager', 'employee', 'super_admin']
        },
        { 
            id: 'directory', 
            label: 'Employee Directory', 
            icon: '', 
            href: 'directory.html',
            roles: ['hr_manager', 'employee', 'super_admin']
        },
        { 
            id: 'payroll', 
            label: 'Payroll', 
            icon: '', 
            href: 'payroll.html',
            roles: ['hr_manager', 'super_admin']
        },
        { 
            id: 'attendance', 
            label: 'Attendance', 
            icon: '', 
            href: 'attendance.html',
            roles: ['hr_manager', 'employee', 'super_admin']
        },
        { 
            id: 'salaries', 
            label: 'Salaries', 
            icon: '', 
            href: 'salaries.html',
            roles: ['hr_manager', 'super_admin']
        }, 
        {
            id:'leaves',
            label:'Leaves',
            icon: '',
            href: 'leaves.html',
            roles: ['hr_manager','employee'],
        },
        
     
    ];

    // Filter menu items based on user role
    const allowedItems = menuItems.filter(item => 
        item.roles.includes(currentUserRole)
    );

    // Create sidebar HTML
    const sidebarHTML = `
        <div class="sidebar" id="app-sidebar">
            <div class="sidebar-header">
                <h2 class="sidebar-title">NexusHR</h2>
                <button class="sidebar-toggle" id="sidebar-toggle">☰</button>
            </div>
            
            <nav class="sidebar-nav">
                <ul class="nav-list">
                    ${allowedItems.map(item => `
                        <li class="nav-item">
                            <a href="${item.href}" class="nav-link" data-page="${item.id}">
                                <span class="nav-icon">${item.icon}</span>
                                <span class="nav-label">${item.label}</span>
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </nav>
            
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar">👤</div>
                    <div class="user-details">
                        <div class="user-email">${currentUser}</div>
                        <div class="user-role">${currentUserRole.replace('_', ' ')}</div>
                    </div>
                </div>
                <button class="logout-btn" id="logout-btn">
                    <span class="logout-icon">🚪</span>
                    <span class="logout-label">Logout</span>
                </button>
            </div>
        </div>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    return sidebarHTML;
};

export const initSidebar = () => {
    // Insert sidebar into DOM
    const sidebarContainer = document.createElement('div');
    sidebarContainer.innerHTML = createSidebar();
    document.body.prepend(sidebarContainer.firstElementChild);
    document.body.appendChild(sidebarContainer.querySelector('.sidebar-overlay'));

    // Add body class for sidebar styling
    document.body.classList.add('has-sidebar');

    // Highlight current page
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    const currentLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (currentLink) {
        currentLink.classList.add('active');
    }

    // Add the Add Employee button to the directory page
    if (currentPage === 'directory') {
        addEmployeeButtonToDirectory();
    }

    // Add event listeners
    addSidebarEventListeners();
};

const addEmployeeButtonToDirectory = () => {
    const currentUserRole = sessionStorage.getItem('role');
    
    if (currentUserRole === 'hr_manager') {
        // Create a page header with the add button
        const pageHeader = document.createElement('div');
        pageHeader.className = 'page-header';
        pageHeader.innerHTML = `
            <h1>Employee Directory</h1>
            <button id="add-employee-btn" class="btn-primary">
                <span class="btn-icon">+</span>
                Add Employee
            </button>
        `;
        
        // Insert before the table container
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.parentNode.insertBefore(pageHeader, tableContainer);
        }
    }
};

const addSidebarEventListeners = () => {
    // Sidebar toggle
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    toggle?.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            // Mobile: toggle open/close
            sidebar.classList.toggle('open');
        } else {
            // Desktop: toggle collapsed
            sidebar.classList.toggle('collapsed');
            document.body.classList.toggle('sidebar-collapsed');
        }
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    });

    // Active link handling
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.closest('.nav-link').classList.add('active');
        });
    });
};