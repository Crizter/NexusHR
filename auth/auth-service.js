
export const login = async (user, db) => {
  return new Promise((resolve, reject) => {
    // destructure the user object
    const { email, password } = user;
    if (!email || !password) {
      throw new Error("User credentials not valid");
    }
    // check for password and email
    const transaction = db.transaction(["users", "credentials"], "readonly");

    const credentialStore = transaction.objectStore("credentials");
    const userStore = transaction.objectStore("users");

    const requestCreds = credentialStore.get(email);
    // check if the password matches
    requestCreds.onsuccess = (event) => {
      const storedCred = event.target.result;
      // check for the user and password
      if (storedCred && storedCred.password === password) {
        const index = userStore.index("emailIndex") ; 
        const requestUser = index.get(email) ; 
        requestUser.onsuccess = (e) => {
          const userProfile = e.target.result;
          if (userProfile) {
            resolve(userProfile);
          } else {
            reject(new Error(`Profile not found for this user.`));
          }
        };
        requestUser.onerror = () => reject(new Error("Failed to fetch user"));
      }
    };
    requestCreds.onerror = (event) => {
      reject(new Error("Database error during login"));
    };
  });
};

// check user logged in 

export const checkLoggedin = (activeUser) => { 
    if(!activeUser) { 
        window.location.href = 'login.html' ; 
    } else { 
        console.log('Welcome back', activeUser) ;         
    }
}

