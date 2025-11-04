// account.js
(function() {
    "use strict"; 

    const API_URL = 'https://eidos-api.onrender.com';
    
    // --- Fonctions utilitaires d'authentification (copiées de app.js) ---
    
    /**
     * Récupère le token d'authentification depuis le localStorage.
     * Si le token n'est pas trouvé, redirige vers la page de connexion.
     * @returns {string|null} Le token ou null si non trouvé.
     */
    function getAuthToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error("Aucun token trouvé, redirection vers login.");
            window.location.href = 'auth.html';
            return null;
        }
        return token;
    }

    /**
     * Crée l'objet "headers" requis pour les requêtes API authentifiées.
     * @returns {Object} L'objet headers avec le token.
     */
    function getAuthHeaders() {
        const token = getAuthToken();
        if (!token) {
            throw new Error("Token non trouvé, impossible de créer les headers.");
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    /**
     * Gère les réponses non autorisées (401) en redirigeant vers le login.
     * @param {Response} response - La réponse de l'API.
     */
    function handleAuthError(response) {
        if (response.status === 401) {
            console.error("Token invalide ou expiré, redirection vers login.");
            localStorage.removeItem('authToken');
            window.location.href = 'auth.html';
            return true;
        }
        return false;
    }

    // --- Fonctions de Modale (copiées de app.js) ---
    let confirmCallback = null;

    function showDeleteConfirmation(message, callback) {
        const modal = document.getElementById('custom-confirm-modal');
        const modalBox = document.getElementById('custom-confirm-box');
        const titleEl = document.getElementById('custom-confirm-title');
        const messageEl = document.getElementById('custom-confirm-message');
        const cancelBtn = document.getElementById('custom-confirm-cancel');
        const okBtn = document.getElementById('custom-confirm-ok');

        cancelBtn.classList.remove('hidden');
        okBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
        okBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
        okBtn.textContent = 'Confirmer';

        titleEl.textContent = 'Confirmation requise';
        messageEl.textContent = message;

        confirmCallback = callback;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modalBox.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }
    
    function hideConfirmation() {
        const modal = document.getElementById('custom-confirm-modal');
        const modalBox = document.getElementById('custom-confirm-box');
        
        modalBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            confirmCallback = null;
        }, 200);
    }
    
    function showCustomAlert(title, message) {
        const modal = document.getElementById('custom-confirm-modal');
        const modalBox = document.getElementById('custom-confirm-box');
        const titleEl = document.getElementById('custom-confirm-title');
        const messageEl = document.getElementById('custom-confirm-message');
        const cancelBtn = document.getElementById('custom-confirm-cancel');
        const okBtn = document.getElementById('custom-confirm-ok');

        cancelBtn.classList.add('hidden');
        okBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
        okBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
        okBtn.textContent = 'Fermer';

        titleEl.textContent = title;
        messageEl.textContent = message;

        confirmCallback = null;
        
        modal.classList.remove('hidden');
        setTimeout(() => {
            modalBox.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }

    function setupModalListeners() {
        document.getElementById('custom-confirm-ok').addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            hideConfirmation();
        });
        document.getElementById('custom-confirm-cancel').addEventListener('click', hideConfirmation);
    }

    // --- Logique de la page de gestion de compte ---

    let tabButtons = {};
    let tabContents = {};

    /**
     * Gère le changement d'onglet
     * @param {string} tabId - L'ID de l'onglet à activer (ex: 'security')
     */
    function switchTab(tabId) {
        Object.values(tabButtons).forEach(btn => btn.classList.remove('active'));
        Object.values(tabContents).forEach(content => content.classList.remove('active'));

        if (tabButtons[tabId] && tabContents[tabId]) {
            tabButtons[tabId].classList.add('active');
            tabContents[tabId].classList.add('active');
        }
    }

    /**
     * Charge les détails du compte (plan, étudiants) depuis l'API
     */
    async function loadAccountDetails() {
        // Cacher l'onglet invitations par défaut
        const invitationsTab = document.getElementById('tab-invitations');
        invitationsTab.style.display = 'none'; 

        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type']; // GET request
            
            const response = await fetch(`${API_URL}/api/account/details`, { headers });

            if (handleAuthError(response)) return;
            if (!response.ok) {
                throw new Error("Impossible de charger les détails du compte.");
            }

            const data = await response.json();
            // data est supposé être : { plan: 'solo'|'pro'|'organisation', students: [...] }

            // Mettre à jour l'onglet "Abonnement"
            const planNameEl = document.getElementById('current-plan-name');
            const planDescEl = document.getElementById('plan-description');
            
            if (data.plan === 'pro') {
                planNameEl.textContent = "Pro (Formateur)";
                planDescEl.textContent = "Vous pouvez inviter jusqu'à 50 étudiants.";
                invitationsTab.style.display = 'flex'; // Afficher l'onglet
            } else if (data.plan === 'organisation') {
                planNameEl.textContent = "Organisation";
                planDescEl.textContent = "Vous pouvez inviter un nombre illimité d'étudiants.";
                invitationsTab.style.display = 'flex'; // Afficher l'onglet
            } else {
                planNameEl.textContent = "Solo";
                planDescEl.textContent = "Passez au plan Pro pour inviter des étudiants.";
            }

            // Si le plan le permet, afficher les étudiants
            if (data.plan !== 'solo') {
                renderStudentTable(data.students || []);
            }

        } catch (err) {
            console.error(err);
            // Simule un compte 'pro' en cas d'échec pour les tests
            showCustomAlert("Mode Démo", "Impossible de joindre le serveur. Affichage d'un compte 'Pro' par défaut.");
            document.getElementById('current-plan-name').textContent = "Pro (Démo)";
            document.getElementById('plan-description').textContent = "Vous pouvez inviter des étudiants.";
            invitationsTab.style.display = 'flex';
            renderStudentTable([]); // Affiche le tableau vide
        }
    }

    /**
     * Construit le tableau HTML des étudiants et de leurs permissions (MODIFIÉ)
     * @param {Array} students - La liste des objets étudiants
     */
    function renderStudentTable(students) {
        const tbody = document.getElementById('permissions-tbody');
        const title = document.querySelector('#content-invitations .card-header');
        title.textContent = `Gestion des étudiants (${students.length})`;

        if (students.length === 0) {
            // MODIFIÉ : colspan="13"
            tbody.innerHTML = `<tr><td colspan="13" class="p-4 text-center text-gray-500">Vous n'avez pas encore créé de compte étudiant.</td></tr>`;
            return;
        }

        let html = '';
        
        // MODIFIÉ : Mise à jour de la liste des permissions
        const permissionsList = [
            'header', 'admin', 'vie', 'observations', 
            'prescriptions_add', 'prescriptions_delete', 'prescriptions_validate',
            'transmissions', 'pancarte', 'diagramme', 'biologie'
        ];
        
        students.forEach(student => {
            html += `<tr>`;
            html += `<td class="p-2 font-medium">${student.login}</td>`;
            
            permissionsList.forEach(perm => {
                // S'assure que l'objet permissions existe avant d'essayer d'y accéder
                const isChecked = student.permissions && student.permissions[perm];
                html += `<td class="p-2 text-center">
                           <input type="checkbox" data-login="${student.login}" data-permission="${perm}" ${isChecked ? 'checked' : ''}>
                         </td>`;
            });
            
            html += `<td class="p-2 text-center">
                       <button title="Supprimer cet étudiant" data-login="${student.login}" class="delete-student-btn text-red-500 hover:text-red-700">
                         <i class="fas fa-trash"></i>
                       </button>
                     </td>`;
            html += `</tr>`;
        });

        tbody.innerHTML = html;
    }
    
    /**
     * Génère une chaîne aléatoire (pour login/mdp)
     * @param {number} length - Longueur de la chaîne
     */
    function generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // --- Gestionnaires d'événements ---

    /**
     * Gère la suggestion de login/mot de passe (MODIFIÉ)
     */
    function handleGenerateCredentials(e) {
        e.preventDefault();
        const generatedLogin = `etu${Math.floor(1000 + Math.random() * 9000)}`;
        const generatedPassword = generateRandomString(8);

        // MODIFIÉ : Remplit les champs de formulaire
        document.getElementById('student-login').value = generatedLogin;
        document.getElementById('student-password').value = generatedPassword;
    }

    /**
     * Gère la création d'un compte étudiant (MODIFIÉ)
     */
    async function handleCreateStudent(e) {
        e.preventDefault();
        
        // MODIFIÉ : Lit directement depuis les champs de formulaire
        const login = document.getElementById('student-login').value;
        const password = document.getElementById('student-password').value;

        if (!login || !password) {
            showCustomAlert("Erreur", "Veuillez saisir un identifiant et un mot de passe.");
            return;
        }

        try {
            const headers = getAuthHeaders();
            // NOTE : Route '/api/account/invite' à créer sur le backend
            const response = await fetch(`${API_URL}/api/account/invite`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ login, password })
            });

            if (handleAuthError(response)) return;
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Impossible de créer l'étudiant.");
            }
            
            showCustomAlert("Succès", `Le compte pour "${login}" a été créé.`);
            
            // Réinitialiser le formulaire
            document.getElementById('create-student-form').reset();

            // Recharger la liste des étudiants
            loadAccountDetails();

        } catch (err) {
            showCustomAlert("Erreur", err.message);
        }
    }

    /**
     * Gère le changement de mot de passe
     */
    async function handleChangePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showCustomAlert("Erreur", "Les nouveaux mots de passe ne correspondent pas.");
            return;
        }

        try {
            const headers = getAuthHeaders();
            // NOTE : Route '/api/account/change-password' à créer sur le backend
            const response = await fetch(`${API_URL}/api/account/change-password`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            if (handleAuthError(response)) return;
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Impossible de changer le mot de passe.");
            }
            
            showCustomAlert("Succès", "Votre mot de passe a été mis à jour.");
            document.getElementById('change-password-form').reset();

        } catch (err) {
            showCustomAlert("Erreur", err.message);
        }
    }

    /**
     * Gère la suppression du compte
     */
    function handleDeleteAccount() {
        showDeleteConfirmation(
            "Êtes-vous absolument sûr ? Cette action est irréversible et supprimera toutes vos données.",
            async () => {
                try {
                    const headers = getAuthHeaders();
                    // NOTE : Route '/api/account/delete' à créer sur le backend
                    const response = await fetch(`${API_URL}/api/account/delete`, {
                        method: 'DELETE',
                        headers: headers
                    });

                    if (handleAuthError(response)) return;

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || "Impossible de supprimer le compte.");
                    }

                    // Déconnexion
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('activePatientId');
                    localStorage.removeItem('activeTab');
                    
                    showCustomAlert("Compte supprimé", "Votre compte a été supprimé. Vous allez être redirigé.");
                    
                    setTimeout(() => {
                        window.location.href = 'auth.html';
                    }, 2000);

                } catch (err) {
                    showCustomAlert("Erreur", err.message);
                }
            }
        );
    }

    /**
     * Gère la mise à jour d'une permission (via délégation)
     */
    async function handlePermissionChange(e) {
        if (!e.target.matches('input[type="checkbox"]')) return;

        const checkbox = e.target;
        const login = checkbox.dataset.login;
        const permission = checkbox.dataset.permission;
        const value = checkbox.checked;

        try {
            const headers = getAuthHeaders();
            // NOTE : Route '/api/account/permissions' à créer sur le backend
            const response = await fetch(`${API_URL}/api/account/permissions`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ login, permission, value })
            });

            if (handleAuthError(response)) return;
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Erreur de mise à jour");
            }
            // On peut ajouter un feedback visuel ici si on veut
            console.log(`Permission ${permission} pour ${login} mise à jour: ${value}`);

        } catch (err) {
            showCustomAlert("Erreur", err.message);
            // Annuler le changement visuel
            checkbox.checked = !value;
        }
    }

    /**
     * Gère la suppression d'un étudiant (via délégation)
     */
    async function handleDeleteStudent(e) {
        const deleteBtn = e.target.closest('.delete-student-btn');
        if (!deleteBtn) return;

        const login = deleteBtn.dataset.login;

        showDeleteConfirmation(
            `Êtes-vous sûr de vouloir supprimer le compte étudiant "${login}" ?`,
            async () => {
                try {
                    const headers = getAuthHeaders();
                    // NOTE : Route '/api/account/student' à créer sur le backend
                    const response = await fetch(`${API_URL}/api/account/student`, {
                        method: 'DELETE',
                        headers: headers,
                        body: JSON.stringify({ login })
                    });
                    
                    if (handleAuthError(response)) return;
                    
                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || "Impossible de supprimer l'étudiant.");
                    }
                    
                    showCustomAlert("Succès", `Le compte "${login}" a été supprimé.`);
                    loadAccountDetails(); // Recharger la liste

                } catch (err) {
                    showCustomAlert("Erreur", err.message);
                }
            }
        );
    }

    /**
     * Initialisation de la page
     */
    function init() {
        // Vérifier le token au chargement
        if (!getAuthToken()) return;

        // Références des onglets
        tabButtons = {
            security: document.getElementById('tab-security'),
            subscription: document.getElementById('tab-subscription'),
            invitations: document.getElementById('tab-invitations')
        };
        tabContents = {
            security: document.getElementById('content-security'),
            subscription: document.getElementById('content-subscription'),
            invitations: document.getElementById('content-invitations')
        };

        // Listeners des onglets
        tabButtons.security.addEventListener('click', () => switchTab('security'));
        tabButtons.subscription.addEventListener('click', () => switchTab('subscription'));
        tabButtons.invitations.addEventListener('click', () => switchTab('invitations'));

        // Listeners des modales
        setupModalListeners();

        // Listeners de la section Sécurité
        document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
        document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);

        // Listeners de la section Invitations
        document.getElementById('create-student-form').addEventListener('submit', handleCreateStudent);
        document.getElementById('generate-credentials-btn').addEventListener('click', handleGenerateCredentials);
        
        // Listeners délégués pour le tableau des permissions
        const permissionsTbody = document.getElementById('permissions-tbody');
        permissionsTbody.addEventListener('change', handlePermissionChange);
        permissionsTbody.addEventListener('click', handleDeleteStudent);
        
        // Charger les données initiales
        loadAccountDetails();
        
        // Activer le premier onglet
        switchTab('security');
    }

    // Lancer l'initialisation
    document.addEventListener('DOMContentLoaded', init);


})();
