// auth.js
(function() {
    "use strict";

    // MODIFIÉ : Assurez-vous que c'est bien l'URL de VOTRE API Render
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

    // --- Gestion de la sélection de plan ---
    const planCards = signupSection.querySelectorAll('.plan-card');
    let selectedPlan = 'free'; // 'free' par défaut

    planCards.forEach(card => {
        if (card.dataset.plan === 'free') {
            card.classList.add('selected');
        }
        card.addEventListener('click', () => {
            planCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedPlan = card.dataset.plan;
        });
    });
    // --- FIN ---


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
        window.location.hash = 'signup'; // Ajoute le hash à l'URL
    });
    showLoginLink1.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
        history.pushState("", document.title, window.location.pathname + window.location.search); // Supprime le hash
    });
    showLoginLink2.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
        history.pushState("", document.title, window.location.pathname + window.location.search); // Supprime le hash
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

    async function handleLogin(e) {
        e.preventDefault();
        
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
                body: JSON.stringify({ email, password, plan: selectedPlan })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de l\'inscription');
            }

            // Succès ! On passe à la vérification
            document.getElementById('verify-email').value = email;
            document.getElementById('verify-email-display').textContent = email;
            
            const testCodeDisplay = document.getElementById('test-code-display');
            if (data._test_code) {
                testCodeDisplay.textContent = `(Code pour test : ${data._test_code})`;
                testCodeDisplay.classList.remove('hidden');
            }

            showSection(verifySection);
            signupForm.reset(); 

            planCards.forEach(c => c.classList.remove('selected'));
            planCards[0].classList.add('selected');
            selectedPlan = 'free';


        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
        } finally {
            signupBtn.disabled = false;
            signupBtn.textContent = 'S\'inscrire';
        }
    }
    
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

            successMsg.textContent = 'Compte vérifié avec succès ! Vous pouvez maintenant vous connecter.';
            successMsg.classList.remove('hidden');
            
            document.getElementById('test-code-display').classList.add('hidden');
            
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

    // --- NOUVEAU : Gestion du hash au chargement ---
    
    /**
     * Vérifie le hash de l'URL et affiche la bonne section.
     */
    function handleHashChange() {
        const hash = window.location.hash;
        if (hash === '#signup') {
            showSection(signupSection);
        } else {
            showSection(loginSection); // Par défaut, on montre le login
        }
    }

    // Écoute les changements de hash (si l'utilisateur clique sur Précédent/Suivant)
    window.addEventListener('hashchange', handleHashChange);

    // Vérifie le hash au premier chargement de la page
    document.addEventListener('DOMContentLoaded', handleHashChange);

})();
