document.addEventListener('DOMContentLoaded', () => {
    const welcomeContent = document.getElementById('welcomeContent');
    const signInContent = document.getElementById('signInContent');
    const signUpContent = document.getElementById('signUpContent');
    
    // Buttons to navigate between views
    const goToSignInBtn = document.getElementById('goToSignIn');
    const goToRegisterBtn = document.getElementById('goToRegister');
    const showSignUpLink = document.getElementById('showSignUp');
    const showSignInLink = document.getElementById('showSignIn');
    const backToWelcomeFromSignIn = document.getElementById('backToWelcomeFromSignIn');
    const backToWelcomeFromSignUp = document.getElementById('backToWelcomeFromSignUp');

    function showView(viewToShow) {
        welcomeContent.classList.add('hidden');
        signInContent.classList.add('hidden');
        signUpContent.classList.add('hidden');
        viewToShow.classList.remove('hidden');
    }

    // Event Listeners for navigation
    goToSignInBtn.addEventListener('click', (e) => { e.preventDefault(); showView(signInContent); });
    goToRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); showView(signUpContent); });
    showSignUpLink.addEventListener('click', (e) => { e.preventDefault(); showView(signUpContent); });
    showSignInLink.addEventListener('click', (e) => { e.preventDefault(); showView(signInContent); });
    backToWelcomeFromSignIn.addEventListener('click', (e) => { e.preventDefault(); showView(welcomeContent); });
    backToWelcomeFromSignUp.addEventListener('click', (e) => { e.preventDefault(); showView(welcomeContent); });
    
    // Show welcome screen by default
    showView(welcomeContent);

    // Login logic (UNTOUCHED)
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        try {
            await auth.signInWithEmailAndPassword(email, pass);
            window.location.href = 'profile.html';
        } catch (err) {
            alert(err.message);
        }
    });
    
    // Register logic (UNTOUCHED)
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const first = document.getElementById('regFirst').value.trim();
        const last = document.getElementById('regLast').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const age = document.getElementById('regAge').value.trim();
        const gender = document.getElementById('regGender').value;
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPassword').value;
        
        if (pass.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }

        try {
            const { user } = await auth.createUserWithEmailAndPassword(email, pass);
            await db.ref('users/' + user.uid).set({
                first, last, phone, age, gender, email
            });
            window.location.href = 'profile.html';
        } catch (err) {
            alert(err.message);
        }
    });
});
