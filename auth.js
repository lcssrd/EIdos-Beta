// auth.js
(function() {
    "use strict";

    const API_URL = 'https://eidos-api.onrender.com';
    
    // Sélection des 3 sections principales
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const verifySection = document.getElementById('verify-section');

    // Sélection des formulaires
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const verifyForm = document.getElementById('verify-form');
    
    // Sélection des liens de navigation
    const showSignupLink = document.getElementById('show-signup-link');
    const showLoginLink1 = document.getElementById('show-login-link-1');
    const showLoginLink2 = document.getElementById('show-login-link-2');

    // --- Gestionnaires d'affichage ---
    function showSection(sectionToShow) {
        loginSection.classList.add('hidden');
        signupSection.classList.add('hidden');
        verifySection.classList.add('hidden');
        sectionToShow.classList.remove('hidden');
    }

    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(signupSection);
    });
    showLoginLink1.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
    });
    showLoginLink2.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
    });

    // --- Gestionnaires de formulaires ---

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    if (verifyForm) {
        verifyForm.addEventListener('submit', handleVerify);
    }

    /**
     * Gère la soumission du formulaire de connexion (MODIFIÉ)
     */
    async function handleLogin(e) {
        e.preventDefault();
        
        // MODIFIÉ : Récupère l'identifiant (email ou login)
        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;
        const errorMsg = document.getElementById('login-error-message');
        const loginBtn = document.getElementById('login-btn');
        
        errorMsg.classList.add('hidden');
        loginBtn.disabled = true;
        loginBtn.textContent = 'Connexion en cours...';

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // MODIFIÉ : Envoie 'identifier' au lieu de 'email'
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Identifiants invalides');
            }

            if (data.token) {
                localStorage.setItem('authToken', data.token);
                window.location.href = 'simul.html';
            } else {
                throw new Error('Aucun token reçu du serveur.');
            }

        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Connexion';
        }
    }

    /**
     * Gère la soumission du formulaire d'inscription (Inchangé)
     */
    async function handleSignup(e) {
        e.preventDefault();

        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorMsg = document.getElementById('signup-error-message');
        const signupBtn = document.getElementById('signup-btn');

        errorMsg.classList.add('hidden');
        signupBtn.disabled = true;
        signupBtn.textContent = 'Inscription en cours...';

        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de l\'inscription');
            }

            // Succès ! On passe à la vérification
            document.getElementById('verify-email').value = email;
            document.getElementById('verify-email-display').textContent = email;
            
            // Affiche le code de test (pour la démo)
            const testCodeDisplay = document.getElementById('test-code-display');
            if (data._test_code) {
                testCodeDisplay.textContent = `(Code pour test : ${data._test_code})`;
                testCodeDisplay.classList.remove('hidden');
            }

            showSection(verifySection);
            signupForm.reset(); // Vider le formulaire d'inscription

        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        } finally {
            signupBtn.disabled = false;
            signupBtn.textContent = 'S\'inscrire';
        }
    }
    
    /**
     * Gère la soumission du formulaire de vérification (Inchangé)
     */
    async function handleVerify(e) {
        e.preventDefault();

        const email = document.getElementById('verify-email').value;
        const code = document.getElementById('verify-code').value;
        const errorMsg = document.getElementById('verify-error-message');
        const successMsg = document.getElementById('verify-success-message');
        const verifyBtn = document.getElementById('verify-btn');

        errorMsg.classList.add('hidden');
        successMsg.classList.add('hidden');
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Vérification...';

        try {
            const response = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la vérification');
            }

            // Succès !
            successMsg.textContent = 'Compte vérifié avec succès ! Vous pouvez maintenant vous connecter.';
            successMsg.classList.remove('hidden');
            
            // Cacher le code de test
            document.getElementById('test-code-display').classList.add('hidden');
            
            // Rediriger vers la connexion après 2 secondes
            setTimeout(() => {
                showSection(loginSection);
                verifyForm.reset();
                successMsg.classList.add('hidden');
            }, 2000);


        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Vérifier';
        }
    }


})();
