
import { connectToDb, getEmployeeById, updateEmployee } from "../core/db.js";
import { checkLoggedin } from "../auth/auth-service.js";
import { initSidebar } from "../components/sidebar.js";

// Check authentication
        const userId = sessionStorage.getItem('userId');
        checkLoggedin(userId);


// Global variables
let db;
let currentUser;
let isEditing = false;
let userSkills = [];
let originalContactData = {};

/**
 * Initialize Profile Page
 */
const initializeProfile = async () => {
    try {
        console.log('[Profile] Initializing...');
        
        // Initialize sidebar
        initSidebar();
        
        
        
        // Connect to database
        db = await connectToDb();
        
        // Load user data
        await loadUserProfile(userId);
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('[Profile] Initialization complete');
        
    } catch (error) {
        console.error('[Profile] Initialization failed:', error);
        showNotification('Failed to load profile. Please refresh the page.', 'error');
    }
};

/**
 * Load user profile data
 */
const loadUserProfile = async (userId) => {
    try {
        showLoading(true);
        
        currentUser = await getEmployeeById(db, userId);
        
        if (!currentUser) {
            throw new Error('User not found');
        }
        
        // Populate identity card
        populateIdentityCard(currentUser);
        
        // Populate contact information
        populateContactInfo(currentUser);
        
        // Populate skills
        populateSkills(currentUser);
        
        // Update additional info
        updateAdditionalInfo(currentUser);
        
        showLoading(false);
        
    } catch (error) {
        console.error('[Profile] Failed to load user profile:', error);
        showLoading(false);
        showNotification('Failed to load profile data.', 'error');
    }
};

/**
 * Populate identity card section
 */
const populateIdentityCard = (user) => {
    try {
        const nameElement = document.getElementById('employee-name');
        const roleElement = document.getElementById('employee-role');
        const idElement = document.getElementById('employee-id');
        const departmentElement = document.getElementById('employee-department');
        const joinDateElement = document.getElementById('employee-join-date');
        const salaryElement = document.getElementById('employee-salary');
        const avatarInitials = document.getElementById('avatar-initials');
        
        // Basic info
        const fullName = `${user.identity?.firstName || ''} ${user.identity?.lastName || ''}`.trim();
        nameElement.textContent = fullName || 'Unknown User';
        roleElement.textContent = formatRole(user.role || 'Employee');
        
        // System data
        idElement.textContent = user.id || 'N/A';
        departmentElement.textContent = user.department?.deptName || 'N/A';
        
        // Format join date
        const joinDate = user.createdAt ? new Date(user.createdAt) : new Date();
        joinDateElement.textContent = joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        // Format salary
        const salary = user.financial?.baseSalary || 0;
        const currency = user.financial?.currency || 'USD';
        salaryElement.textContent = formatCurrency(salary, currency);
        
        // Avatar initials
        const initials = getInitials(user.identity?.firstName, user.identity?.lastName);
        avatarInitials.textContent = initials;
        
        console.log('[Profile] Identity card populated');
        
    } catch (error) {
        console.error('[Profile] Failed to populate identity card:', error);
    }
};

/**
 * Populate contact information
 */
const populateContactInfo = (user) => {
    try {
        const phoneElement = document.getElementById('phone-number');
        const emailElement = document.getElementById('personal-email');
        const addressElement = document.getElementById('address');
        const emergencyContactElement = document.getElementById('emergency-contact');
        const emergencyPhoneElement = document.getElementById('emergency-phone');
        
        // Contact info
        phoneElement.value = user.identity?.contactNumber || '';
        emailElement.value = user.personalEmail || '';
        addressElement.value = formatAddress(user.identity?.address) || '';
        emergencyContactElement.value = user.emergencyContact?.name || '';
        emergencyPhoneElement.value = user.emergencyContact?.phone || '';
        
        // Store original data for cancel functionality
        originalContactData = {
            phoneNumber: phoneElement.value,
            personalEmail: emailElement.value,
            address: addressElement.value,
            emergencyContact: emergencyContactElement.value,
            emergencyPhone: emergencyPhoneElement.value
        };
        
        console.log('[Profile] Contact info populated');
        
    } catch (error) {
        console.error('[Profile] Failed to populate contact info:', error);
    }
};

/**
 * Populate skills section
 */
const populateSkills = (user) => {
    try {
        userSkills = user.skills || [];
        renderSkills();
        updateSkillsCount();
        
        console.log('[Profile] Skills populated');
        
    } catch (error) {
        console.error('[Profile] Failed to populate skills:', error);
    }
};

/**
 * Update additional info section
 */
const updateAdditionalInfo = (user) => {
    try {
        const lastLoginElement = document.getElementById('last-login');
        const accountStatusElement = document.getElementById('account-status');
        const completionProgressElement = document.getElementById('completion-progress');
        
        // Last login
        const lastLogin = user.attendance?.lastLogin ? new Date(user.attendance.lastLogin) : new Date();
        lastLoginElement.textContent = getTimeAgo(lastLogin);
        
        // Account status
        const status = user.attendance?.status || 'active';
        accountStatusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        accountStatusElement.className = `info-value status-${status}`;
        
        // Profile completion
        const completion = calculateProfileCompletion(user);
        completionProgressElement.style.width = `${completion}%`;
        completionProgressElement.parentNode.nextElementSibling.textContent = `${completion}%`;
        
    } catch (error) {
        console.error('[Profile] Failed to update additional info:', error);
    }
};

/**
 * Setup event listeners
 */
const setupEventListeners = () => {
    // Avatar upload
    const avatarContainer = document.getElementById('avatar-container');
    const avatarUpload = document.getElementById('avatar-upload');
    
    avatarContainer.addEventListener('click', () => {
        avatarUpload.click();
    });
    
    avatarUpload.addEventListener('change', handleAvatarUpload);
    
    // Contact form editing
    const editContactBtn = document.getElementById('edit-contact-btn');
    const cancelContactBtn = document.getElementById('cancel-contact-btn');
    const contactForm = document.getElementById('contact-form');
    
    editContactBtn.addEventListener('click', toggleContactEdit);
    cancelContactBtn.addEventListener('click', cancelContactEdit);
    contactForm.addEventListener('submit', handleContactSubmit);
    
    // Skills functionality
    const addSkillBtn = document.getElementById('add-skill-btn');
    const skillInput = document.getElementById('skill-input');
    
    addSkillBtn.addEventListener('click', addSkill);
    skillInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSkill();
        }
    });
    
    // Skill suggestions
    const suggestionPills = document.querySelectorAll('.suggestion-pill');
    suggestionPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const skill = pill.dataset.skill;
            if (skill) {
                addSkillFromSuggestion(skill);
            }
        });
    });
};

/**
 * Handle avatar upload
 */
const handleAvatarUpload = async (event) => {
    try {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select a valid image file.', 'error');
            return;
        }
        
        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showNotification('Image size must be less than 5MB.', 'error');
            return;
        }
        
        showLoading(true);
        
        // Convert to base64 for storage 
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const avatarImage = document.getElementById('avatar-image');
                const avatarPlaceholder = document.querySelector('.avatar-placeholder');
                
                // Show the uploaded image
                avatarImage.src = e.target.result;
                avatarImage.style.display = 'block';
                avatarPlaceholder.style.display = 'none';
                
                // Update user data (in a real app, you'd save this to the server)
                currentUser.avatar = e.target.result;
                
                showLoading(false);
                showNotification('Profile picture updated successfully!', 'success');
                
            } catch (error) {
                console.error('[Profile] Failed to process avatar:', error);
                showLoading(false);
                showNotification('Failed to update profile picture.', 'error');
            }
        };
        
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('[Profile] Avatar upload error:', error);
        showLoading(false);
        showNotification('Failed to upload avatar.', 'error');
    }
};

/**
 * Toggle contact form editing
 */
const toggleContactEdit = () => {
    isEditing = !isEditing;
    const inputs = document.querySelectorAll('#contact-form input, #contact-form textarea');
    const editBtn = document.getElementById('edit-contact-btn');
    const formActions = document.getElementById('contact-form-actions');
    
    inputs.forEach(input => {
        input.readOnly = !isEditing;
    });
    
    if (isEditing) {
        editBtn.innerHTML = '<span class="edit-icon">✏️</span> Editing...';
        editBtn.disabled = true;
        formActions.style.display = 'flex';
    } else {
        editBtn.innerHTML = '<span class="edit-icon">✏️</span> Edit';
        editBtn.disabled = false;
        formActions.style.display = 'none';
    }
};

/**
 * Cancel contact form editing
 */
const cancelContactEdit = () => {
    // Restore original values
    document.getElementById('phone-number').value = originalContactData.phoneNumber;
    document.getElementById('personal-email').value = originalContactData.personalEmail;
    document.getElementById('address').value = originalContactData.address;
    document.getElementById('emergency-contact').value = originalContactData.emergencyContact;
    document.getElementById('emergency-phone').value = originalContactData.emergencyPhone;
    
    toggleContactEdit();
};

/**
 * Handle contact form submission
 */
const handleContactSubmit = async (event) => {
    event.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(event.target);
        const currentUserRole = sessionStorage.getItem('role');
        
        // Update user object
        const updatedUser = {
            ...currentUser,
            identity: {
                ...currentUser.identity,
                contactNumber: formData.get('phoneNumber')
            },
            personalEmail: formData.get('personalEmail'),
            identity: {
                ...currentUser.identity,
                address: { city: formData.get('address') }
            },
            emergencyContact: {
                name: formData.get('emergencyContact'),
                phone: formData.get('emergencyPhone')
            },
            lastUpdated: Date.now()
        };
        
        // Save to database
        await updateEmployee(db, currentUserRole, updatedUser);
        
        // Update local reference
        currentUser = updatedUser;
        
        // Update original data for future cancels
        originalContactData = {
            phoneNumber: formData.get('phoneNumber'),
            personalEmail: formData.get('personalEmail'),
            address: formData.get('address'),
            emergencyContact: formData.get('emergencyContact'),
            emergencyPhone: formData.get('emergencyPhone')
        };
        
        toggleContactEdit();
        showLoading(false);
        showNotification('Contact information updated successfully!', 'success');
        
    } catch (error) {
        console.error('[Profile] Failed to save contact info:', error);
        showLoading(false);
        showNotification('Failed to save contact information.', 'error');
    }
};

/**
 * Add skill functionality
 */
const addSkill = () => {
    const skillInput = document.getElementById('skill-input');
    const skill = skillInput.value.trim();
    
    if (!skill) {
        showNotification('Please enter a skill.', 'error');
        return;
    }
    
    if (skill.length > 50) {
        showNotification('Skill name must be less than 50 characters.', 'error');
        return;
    }
    
    if (userSkills.includes(skill)) {
        showNotification('This skill already exists.', 'error');
        return;
    }
    
    if (userSkills.length >= 20) {
        showNotification('Maximum 20 skills allowed.', 'error');
        return;
    }
    
    userSkills.push(skill);
    skillInput.value = '';
    
    renderSkills();
    updateSkillsCount();
    saveSkillsToDatabase();
    
    showNotification(`Added "${skill}" to your skills!`, 'success');
};

/**
 * Add skill from suggestion
 */
const addSkillFromSuggestion = (skill) => {
    if (userSkills.includes(skill)) {
        showNotification('This skill already exists.', 'error');
        return;
    }
    
    if (userSkills.length >= 20) {
        showNotification('Maximum 20 skills allowed.', 'error');
        return;
    }
    
    userSkills.push(skill);
    renderSkills();
    updateSkillsCount();
    saveSkillsToDatabase();
    
    showNotification(`Added "${skill}" to your skills!`, 'success');
};

/**
 * Remove skill
 */
const removeSkill = (skillToRemove) => {
    userSkills = userSkills.filter(skill => skill !== skillToRemove);
    renderSkills();
    updateSkillsCount();
    saveSkillsToDatabase();
    
    showNotification(`Removed "${skillToRemove}" from your skills.`, 'success');
};

/**
 * Render skills list
 */
const renderSkills = () => {
    const skillsList = document.getElementById('skills-list');
    
    if (userSkills.length === 0) {
        skillsList.innerHTML = '<p class="no-skills">No skills added yet. Add your first skill above!</p>';
        return;
    }
    
    skillsList.innerHTML = userSkills.map(skill => `
        <div class="skill-pill">
            <span class="skill-name">${escapeHtml(skill)}</span>
            <button class="remove-skill" onclick="window.profileModule.removeSkill('${escapeHtml(skill)}')" 
                    title="Remove skill">
                ×
            </button>
        </div>
    `).join('');
};

/**
 * Update skills count
 */
const updateSkillsCount = () => {
    const skillsCount = document.getElementById('skills-count');
    const count = userSkills.length;
    skillsCount.textContent = `${count} skill${count === 1 ? '' : 's'}`;
};

/**
 * Save skills to database
 */
const saveSkillsToDatabase = async () => {
    try {
        const currentUserRole = sessionStorage.getItem('role');
        
        const updatedUser = {
            ...currentUser,
            skills: userSkills,
            lastUpdated: Date.now()
        };
        
        await updateEmployee(db, currentUserRole, updatedUser);
        currentUser = updatedUser;
        
    } catch (error) {
        console.error('[Profile] Failed to save skills:', error);
    }
};

/**
 * Utility functions
 */
const formatRole = (role) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

const getInitials = (firstName, lastName) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return (first + last) || 'U';
};

const formatAddress = (address) => {
    if (!address) return '';
    return typeof address === 'string' ? address : address.city || '';
};

const calculateProfileCompletion = (user) => {
    const fields = [
        user.identity?.firstName,
        user.identity?.lastName,
        user.identity?.contactNumber,
        user.email,
        user.department?.deptName,
        user.identity?.address?.city,
        user.personalEmail,
        user.skills?.length > 0
    ];
    
    const completed = fields.filter(field => field).length;
    return Math.round((completed / fields.length) * 100);
};

const getTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
        const days = Math.floor(diffInMinutes / 1440);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }
};

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

const showLoading = (show) => {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = show ? 'flex' : 'none';
};

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeProfile);

// Export functions for global access
window.profileModule = {
    removeSkill
};

// Export for module usage
export {
    initializeProfile,
    addSkill,
    removeSkill
};