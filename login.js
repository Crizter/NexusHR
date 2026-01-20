import { connectToDb, seedDatabase } from "./core/db.js";
import { login } from "./auth/auth-service.js";

let db  ; 
document.addEventListener('DOMContentLoaded', async()=> { 
    try {
         db = await  connectToDb(2) ; 
        await seedDatabase(db) ; 
        console.log('database intialized') ;  
    } catch (error) {
        console.error('Failed to initialize login page.') ; 
    }
}) ; 

const loginForm = document.getElementById('login-form') ; 
const emailInput = document.getElementById('email') ; 
const passwordInput = document.getElementById('password') ; 
const loginBtn = document.querySelector('.login-btn') ; 






function setLoading(isLoading) { 
    if(isLoading) { 
        loginBtn.classList.add('loading') ; 
        loginBtn.disabled = true ; 
    } else { 
        loginBtn.classList.remove('loading') ; 
        loginBtn.disabled = false ; 
    }
}

// Add error display helper
function showError(message) {
    // Remove existing error
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Insert after form
    loginForm.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}


loginForm.addEventListener('submit', async(e) => { 
    e.preventDefault() ;  // prevents reload 
    const email = document.getElementById('email').value.trim() ; 
    const password = document.getElementById('password').value ; 

    if(!email || !password) { 
        showError('Please fill in all fields') ; 
        return ; 
    }
    setLoading(true) ; 
    try {
        if(!db){
            db = await connectToDb(2) ; 
        }
        const user = await login({email,password}, db) ; 

        console.log('Login success...') ; 
        // save the session 
        sessionStorage.setItem('userId', user.id) ; 
        sessionStorage.setItem('email',user.email) ;
        sessionStorage.setItem('role', user.role)  ;    
        // redirect to main app 
        window.location.href = `index.html` ; 
    } catch (error) {
        console.error('Login error', error); // See the error in console
        showError(error.message || 'Login failed') ; 
        // error styling in input 
        emailInput.parentNode.classList.add('error') ; 
        passwordInput.parentNode.classList.add('error') ; 
    
    } finally { 
        setLoading(false) ; 
    }
});


// FOR TESTING PURPOSE
// Auto-fill demo credentials on click
document.querySelectorAll('.credential-item').forEach(item => {
    item.addEventListener('click', () => {
        const text = item.querySelector('span').textContent;
        const [email, password] = text.split(' / ');
        
        emailInput.value = email;
        passwordInput.value = password;
        
        // Add visual feedback
        item.style.background = 'var(--accent-color)';
        item.style.color = 'var(--primary-background-color)';
        
        setTimeout(() => {
            item.style.background = '';
            item.style.color = '';
        }, 200);
    });
});