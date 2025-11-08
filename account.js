// account.js (Modifié)
(function() {
    "use strict"; 

    const API_URL = 'https://eidos-api.onrender.com:3000'; 

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
    let currentPlan = 'free';
    let studentCount = 0; 
    
    // NOUVEAU : Variables pour la modale des chambres
    let roomModal, roomModalBox, roomModalForm, roomModalList, roomModalTitle, roomModalLoginInput;


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

    // MODIFIÉ : Met à jour l'état des boutons d'abonnement avec les NOUVEAUX NOMS
    function updateSubscriptionButtons(activePlan) {
        const planButtons = {
            'free': document.getElementById('sub-btn-free'),
            'independant': document.getElementById('sub-btn-independant'),
            'promo': document.getElementById('sub-btn-promo'),
            'centre': document.getElementById('sub-btn-centre')
        };

        // Réinitialiser tous les boutons (sauf 'centre' qui est spécial)
        for (const [plan, button] of Object.entries(planButtons)) {
            if (plan !== 'centre') {
                button.disabled = false;
                button.textContent = 'Choisir ce plan';
                button.classList.remove('bg-gray-200', 'cursor-not-allowed');
                // Ré-appliquer les couleurs d'origine
                if(plan === 'free') button.classList.add('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700'); // Modifié pour le style gris
                if(plan === 'independant') button.classList.add('bg-teal-600', 'hover:bg-teal-700', 'text-white');
                if(plan === 'promo') button.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white');
            }
        }

        // Définir le bouton actif
        if (planButtons[activePlan] && activePlan !== 'centre') {
            const activeButton = planButtons[activePlan];
            activeButton.disabled = true;
            activeButton.textContent = 'Plan actuel';
            activeButton.classList.add('bg-gray-200', 'cursor-not-allowed', 'text-gray-700'); // Style unifié pour bouton désactivé
            // Retirer les couleurs
            if(activePlan === 'independant') activeButton.classList.remove('bg-teal-600', 'hover:bg-teal-700', 'text-white');
            if(activePlan === 'promo') activeButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'text-white');
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
            // data est supposé être : { plan: 'free'|'independant'|'promo'|'centre', students: [...] }

            // Mettre à jour l'abonnement
            currentPlan = data.plan; // Stocker le plan actuel
            studentCount = data.students ? data.students.length : 0; // Stocker le nombre d'étudiants

            const planNameEl = document.getElementById('current-plan-name');
            const planDescEl = document.getElementById('plan-description');
            
            // MODIFIÉ : Logique des plans mise à jour
            if (data.plan === 'promo') {
                planNameEl.textContent = "Promo (Formateur)";
                planDescEl.textContent = `Vous pouvez inviter jusqu'à 40 étudiants (${studentCount} / 40).`;
                invitationsTab.style.display = 'flex'; // Afficher l'onglet
            } else if (data.plan === 'centre') {
                planNameEl.textContent = "Centre";
                planDescEl.textContent = "Vous pouvez inviter un nombre illimité d'étudiants et gérer plusieurs formateurs.";
                invitationsTab.style.display = 'flex'; // Afficher l'onglet
            } else if (data.plan === 'independant') {
                planNameEl.textContent = "Indépendant";
                planDescEl.textContent = `Sauvegardes illimitées, et jusqu'à 5 étudiants (${studentCount} / 5).`;
                invitationsTab.style.display = 'flex'; // Afficher l'onglet
            } else { // 'free'
                planNameEl.textContent = "Free";
                planDescEl.textContent = "Fonctionnalités de base, aucune sauvegarde de données, pas de comptes étudiants.";
            }
            // FIN MODIFICATION

            // Mettre à jour les boutons d'abonnement
            updateSubscriptionButtons(data.plan);

            // Si le plan le permet, afficher les étudiants
            if (data.plan === 'independant' || data.plan === 'promo' || data.plan === 'centre') {
                renderStudentTable(data.students || []);
            }

        } catch (err) {
            console.error(err);
            showCustomAlert("Erreur", "Impossible de joindre le serveur. " + err.message);
        }
    }

    /**
     * Construit le tableau HTML des étudiants et de leurs permissions (MODIFIÉ)
     * @param {Array} students - La liste des objets étudiants
     */
    function renderStudentTable(students) {
        const tbody = document.getElementById('permissions-tbody');
        const title = document.getElementById('student-list-title');
        title.textContent = `Gestion des étudiants (${students.length})`;

        // Gérer la limite d'étudiants
        const createBtn = document.getElementById('create-student-submit-btn');
        const loginInput = document.getElementById('student-login');
        const passwordInput = document.getElementById('student-password');

        // MODIFIÉ : Logique des limites mise à jour
        let limitReached = false;
        let limitMessage = "";

        if (currentPlan === 'independant' && students.length >= 5) {
            limitReached = true;
            limitMessage = "Limite de 5 étudiants atteinte pour le plan Indépendant.";
        } else if (currentPlan === 'promo' && students.length >= 40) {
            limitReached = true;
            limitMessage = "Limite de 40 étudiants atteinte pour le plan Promo.";
        }
        // FIN MODIFICATION

        if (limitReached) {
            createBtn.disabled = true;
            loginInput.disabled = true;
            passwordInput.disabled = true;
            createBtn.title = limitMessage;
            createBtn.classList.add('cursor-not-allowed', 'bg-gray-400');
            createBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        } else {
            createBtn.disabled = false;
            loginInput.disabled = false;
            passwordInput.disabled = false;
            createBtn.title = "";
            createBtn.classList.remove('cursor-not-allowed', 'bg-gray-400');
            createBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }


        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-gray-500">Vous n'avez pas encore créé de compte étudiant.</td></tr>`; // MODIFIÉ: colspan 14
            return;
        }

        let html = '';
        
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
            
            // NOUVEAU : Cellule pour le bouton de gestion des chambres
            const allowedRooms = student.allowedRooms || [];
            const roomCount = allowedRooms.length;
            html += `<td class="p-2 text-center">
                       <button type="button" 
                               class="manage-rooms-btn text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                               data-login="${student.login}"
                               data-name="${student.login}" 
                               data-rooms='${JSON.stringify(allowedRooms)}'>
                         Gérer (${roomCount}/10)
                       </button>
                     </td>`;
            // FIN NOUVEAU
            
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
     * NOUVEAU : Gère la copie de l'email dans le presse-papiers
     */
    function handleCopyEmail() {
        const emailText = document.getElementById('contact-email').textContent;

        if (emailText === '[Email à remplir]') {
            showCustomAlert('Information', "L'adresse email n'a pas encore été configurée.");
            return;
        }

        navigator.clipboard.writeText(emailText).then(() => {
            showCustomAlert('Copié !', "L'adresse email a été copiée dans le presse-papiers.");
        }).catch(err => {
            console.error('Erreur de copie: ', err);
            showCustomAlert('Erreur', "Impossible de copier l'adresse. Veuillez le faire manuellement.");
        });
    }

    /**
     * Gère la suggestion de login/mot de passe
     */
    function handleGenerateCredentials(e) {
        e.preventDefault();
        const generatedLogin = `etu${Math.floor(1000 + Math.random() * 9000)}`;
        const generatedPassword = generateRandomString(8);

        document.getElementById('student-login').value = generatedLogin;
        document.getElementById('student-password').value = generatedPassword;
    }

    /**
     * Gère la création d'un compte étudiant (MODIFIÉ)
     */
    async function handleCreateStudent(e) {
        e.preventDefault();
        
        // MODIFIÉ : Vérification côté client
        if (currentPlan === 'independant' && studentCount >= 5) {
            showCustomAlert("Limite atteinte", "Vous avez atteint la limite de 5 étudiants pour le plan Indépendant.");
            return;
        }
         if (currentPlan === 'promo' && studentCount >= 40) {
            showCustomAlert("Limite atteinte", "Vous avez atteint la limite de 40 étudiants pour le plan Promo.");
            return;
        }
        // FIN MODIFICATION
        
        const login = document.getElementById('student-login').value;
        const password = document.getElementById('student-password').value;

        if (!login || !password) {
            showCustomAlert("Erreur", "Veuillez saisir un identifiant et un mot de passe.");
            return;
        }

        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_URL}/api/account/invite`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ login, password })
            });

            if (handleAuthError(response)) return;

            if (!response.ok) {
                let errorMsg = "Impossible de créer l'étudiant.";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || response.statusText;
                } catch (e) {
                    errorMsg = response.statusText;
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            showCustomAlert("Succès", `Le compte pour "${login}" a été créé.`);
            
            // Réinitialiser le formulaire
            document.getElementById('create-student-form').reset();

            // Recharger la liste des étudiants (mettra à jour le compteur et l'état du bouton)
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
            const response = await fetch(`${API_URL}/api/account/change-password`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            if (handleAuthError(response)) return;

            if (!response.ok) {
                let errorMsg = "Impossible de changer le mot de passe.";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || response.statusText;
                } catch (e) {
                    errorMsg = response.statusText;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            
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
                    const response = await fetch(`${API_URL}/api/account/delete`, {
                        method: 'DELETE',
                        headers: headers
                    });

                    if (handleAuthError(response)) return;

                    if (!response.ok) {
                        let errorMsg = "Impossible de supprimer le compte.";
                        try {
                            const errorData = await response.json();
                            errorMsg = errorData.error || response.statusText;
                        } catch (e) {
                            errorMsg = response.statusText;
                        }
                        throw new Error(errorMsg);
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
    
    // Gère le clic sur un bouton de changement d'abonnement
    async function handleChangeSubscription(newPlan) {
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_URL}/api/account/change-subscription`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ newPlan })
            });

            if (handleAuthError(response)) return;

            if (!response.ok) {
                let errorMsg = "Erreur lors du changement d'abonnement.";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || response.statusText;
                } catch (e) {
                    errorMsg = response.statusText || `Erreur ${response.status}`;
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            showCustomAlert("Abonnement mis à jour", `Vous êtes maintenant sur le plan ${newPlan}.`);
            
            // Recharger tous les détails pour refléter le changement
            loadAccountDetails();

        } catch (err) {
            showCustomAlert("Erreur", err.message);
        }
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
            const response = await fetch(`${API_URL}/api/account/permissions`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ login, permission, value })
            });

            if (handleAuthError(response)) return;
            
            if (!response.ok) {
                let errorMsg = "Erreur de mise à jour";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || response.statusText;
                } catch (e) {
                    errorMsg = response.statusText;
                }
                throw new Error(errorMsg);
            }
            
            console.log(`Permission ${permission} pour ${login} mise à jour: ${value}`);

        } catch (err) {
            showCustomAlert("Erreur", err.message);
            // Annuler le changement visuel
            checkbox.checked = !value;
        }
    }

    /**
     * Gère la suppression d'un étudiant ou l'ouverture de la modale chambre (via délégation)
     */
    async function handleTableClicks(e) {
        // Gestion suppression
        const deleteBtn = e.target.closest('.delete-student-btn');
        if (deleteBtn) {
            const login = deleteBtn.dataset.login;
            showDeleteConfirmation(
                `Êtes-vous sûr de vouloir supprimer le compte étudiant "${login}" ?`,
                async () => {
                    try {
                        const headers = getAuthHeaders();
                        const response = await fetch(`${API_URL}/api/account/student`, {
                            method: 'DELETE',
                            headers: headers,
                            body: JSON.stringify({ login })
                        });
                        
                        if (handleAuthError(response)) return;
                        
                        if (!response.ok) {
                            let errorMsg = "Impossible de supprimer l'étudiant.";
                            try {
                                const errorData = await response.json();
                                errorMsg = errorData.error || response.statusText;
                            } catch (e) {
                                errorMsg = response.statusText;
                            }
                            throw new Error(errorMsg);
                        }
                        
                        showCustomAlert("Succès", `Le compte "${login}" a été supprimé.`);
                        loadAccountDetails(); // Recharger la liste

                    } catch (err) {
                        showCustomAlert("Erreur", err.message);
                    }
                }
            );
            return; // Stop ici si c'est un clic de suppression
        }

        // NOUVEAU : Gestion ouverture modale chambre
        const manageRoomsBtn = e.target.closest('.manage-rooms-btn');
        if (manageRoomsBtn) {
            handleOpenRoomModal(manageRoomsBtn);
        }
    }


    // --- NOUVELLES FONCTIONS : Gestion Modale Chambres ---
    
    function hideRoomModal() {
        roomModalBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            roomModal.classList.add('hidden');
        }, 200);
    }

    function handleOpenRoomModal(button) {
        const login = button.dataset.login;
        const name = button.dataset.name;
        const rooms = JSON.parse(button.dataset.rooms || '[]');
        
        roomModalTitle.textContent = `Gérer les chambres pour ${name}`;
        roomModalLoginInput.value = login;

        let roomCheckboxesHTML = '';
        for (let i = 101; i <= 110; i++) {
            const roomId = `chambre_${i}`;
            const isChecked = rooms.includes(roomId);
            roomCheckboxesHTML += `
                <label class="flex items-center space-x-2 p-2 border rounded-md ${isChecked ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50'
                } cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" name="room" value="${roomId}" ${isChecked ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
                    <span class="font-medium text-sm">${i}</span>
                </label>
            `;
        }
        roomModalList.innerHTML = roomCheckboxesHTML;

        roomModal.classList.remove('hidden');
        setTimeout(() => {
            roomModalBox.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }

    async function handleSaveStudentRooms(e) {
        e.preventDefault();
        
        const login = roomModalLoginInput.value;
        const selectedRooms = Array.from(roomModalForm.querySelectorAll('input[name="room"]:checked'))
                                     .map(cb => cb.value);

        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_URL}/api/account/student/rooms`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ login: login, rooms: selectedRooms })
            });

            if (handleAuthError(response)) return;
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erreur lors de la mise à jour");
            }

            // Mettre à jour le bouton dans le tableau
            const button = document.querySelector(`.manage-rooms-btn[data-login="${login}"]`);
            if (button) {
                button.textContent = `Gérer (${selectedRooms.length}/10)`;
                button.dataset.rooms = JSON.stringify(selectedRooms);
            }

            hideRoomModal();
            
        } catch (err) {
            showCustomAlert("Erreur", err.message);
        }
    }
    // --- FIN NOUVELLES FONCTIONS ---

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
            invitations: document.getElementById('tab-invitations'),
            contact: document.getElementById('tab-contact') // AJOUTÉ
        };
        tabContents = {
            security: document.getElementById('content-security'),
            subscription: document.getElementById('content-subscription'),
            invitations: document.getElementById('content-invitations'),
            contact: document.getElementById('content-contact') // AJOUTÉ
        };

        // Listeners des onglets
        tabButtons.security.addEventListener('click', () => switchTab('security'));
        tabButtons.subscription.addEventListener('click', () => switchTab('subscription'));
        tabButtons.invitations.addEventListener('click', () => switchTab('invitations'));
        tabButtons.contact.addEventListener('click', () => switchTab('contact')); // AJOUTÉ

        // Listeners des modales
        setupModalListeners();
        
        // NOUVEAU : Références modale chambres
        roomModal = document.getElementById('room-modal');
        roomModalBox = document.getElementById('room-modal-box');
        roomModalForm = document.getElementById('room-modal-form');
        roomModalList = document.getElementById('room-modal-list');
        roomModalTitle = document.getElementById('room-modal-title');
        roomModalLoginInput = document.getElementById('room-modal-login');

        // NOUVEAU : Listeners modale chambres
        document.getElementById('room-modal-cancel').addEventListener('click', hideRoomModal);
        roomModalForm.addEventListener('submit', handleSaveStudentRooms);

        // Listeners de la section Sécurité
        document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
        document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);
        
        // MODIFIÉ : Listeners de la section Abonnement
        document.getElementById('sub-btn-free').addEventListener('click', () => handleChangeSubscription('free'));
        document.getElementById('sub-btn-independant').addEventListener('click', () => handleChangeSubscription('independant'));
        document.getElementById('sub-btn-promo').addEventListener('click', () => handleChangeSubscription('promo'));
        // Pas de listener pour 'centre' car il est désactivé

        // Listeners de la section Invitations
        document.getElementById('create-student-form').addEventListener('submit', handleCreateStudent);
        document.getElementById('generate-credentials-btn').addEventListener('click', handleGenerateCredentials);
        
        // Listeners délégués pour le tableau des permissions
        const permissionsTbody = document.getElementById('permissions-tbody');
        permissionsTbody.addEventListener('change', handlePermissionChange);
        permissionsTbody.addEventListener('click', handleTableClicks); // MODIFIÉ : Utilise la nouvelle fonction
        
        // NOUVEAU : Listener pour la page Contact
        document.getElementById('copy-email-btn').addEventListener('click', handleCopyEmail);

        // Charger les données initiales
        loadAccountDetails();
        
        // Activer le premier onglet
        switchTab('security');
    }

    // Lancer l'initialisation
    document.addEventListener('DOMContentLoaded', init);


})();
