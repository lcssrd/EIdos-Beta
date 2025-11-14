(function() {
    "use strict";

    // MODIFIÉ : L'URL de l'API est maintenant relative.
    // "http://localhost:3000" a été supprimé.
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
        // Sélectionner 'free' par défaut
        if (card.dataset.plan === 'free') {
            card.classList.add('selected');
        }

        card.addEventListener('click', () => {
            planCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedPlan = card.dataset.plan;
        });
    });
    
    // --- NOUVEAU : Gestion du token d'invitation ---
    let invitationToken = null;
    
    function checkForInvitationToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('invitation_token');
        
        if (token) {
            invitationToken = token;
            console.log("Token d'invitation détecté :", invitationToken);
            
            // Basculer automatiquement vers l'inscription
            showSection(signupSection);
            
            // Optionnel : Masquer la sélection de plan si l'invitation la définit
            // (Pour l'instant, on la laisse, mais on enverra le token)
            // const planSelectionUI = document.getElementById('signup-form').querySelector('.grid.grid-cols-4.gap-3').parentNode;
            // if (planSelectionUI) {
            //     planSelectionUI.innerHTML = '<p class="text-center text-indigo-600 font-medium">Vous avez été invité à rejoindre un centre de formation.</p>';
            // }
        }
    }
    // --- FIN NOUVEAU ---


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
        // MODIFIÉ : Met à jour le hash dans l'URL sans recharger
        window.history.pushState(null, '', '#signup');
    });
    showLoginLink1.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
         // MODIFIÉ : Met à jour le hash dans l'URL sans recharger
        window.history.pushState(null, '', '#login');
    });
    showLoginLink2.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
         // MODIFIÉ : Met à jour le hash dans l'URL sans recharger
        window.history.pushState(null, '', '#login');
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
     * Gère la soumission du formulaire de connexion (Inchangé)
     */
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
            // MODIFIÉ : Utilise API_URL (qui est vide, donc /auth/login)
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
                // MODIFIÉ : Redirige vers simul.html
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
     * Gère la soumission du formulaire d'inscription (MODIFIÉ)
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
        
        // --- NOUVEAU : Préparer le corps de la requête ---
        const requestBody = {
            email: email,
            password: password,
            plan: selectedPlan
        };
        
        // S'il y a un token d'invitation, on l'ajoute
        // Le backend l'utilisera pour lier l'utilisateur à l'organisation
        // et ignorer le 'selectedPlan' au profit du plan de l'organisation.
        if (invitationToken) {
            requestBody.token = invitationToken;
        }
        // --- FIN NOUVEAU ---

        try {
            // MODIFIÉ : Utilise API_URL (qui est vide, donc /auth/signup)
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // MODIFIÉ : Envoie le requestBody (qui contient le token si présent)
                body: JSON.stringify(requestBody)
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

            // Réinitialiser la sélection de plan au cas où l'utilisateur revient en arrière
            planCards.forEach(c => c.classList.remove('selected'));
            planCards[0].classList.add('selected');
            selectedPlan = 'free';
            
            // NOUVEAU : Effacer le token de l'URL pour éviter de le réutiliser
            if (invitationToken) {
                window.history.replaceState({}, document.title, window.location.pathname);
                invitationToken = null;
            }


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
            // MODIFIÉ : Utilise API_URL (qui est vide, donc /auth/verify)
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
    
    // NOUVEAU : Gère le hash dans l'URL au chargement
    function checkForHash() {
        if (window.location.hash === '#signup') {
            showSection(signupSection);
        }
    }

    // Lancer les vérifications au chargement de la page
    checkForInvitationToken();
    checkForHash(); // MODIFIÉ : Ajout de cette ligne

})();
