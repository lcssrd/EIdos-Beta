// account.js (Modifié)
(function() {
    "use strict"; 

    // MODIFIÉ : L'URL de l'API est maintenant relative.
    // "http://localhost:3000" a été supprimé.
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

    // MODIFIÉ : Logique complète pour la cohérence des couleurs et l'état actif
    function updateSubscriptionButtons(activePlan, quoteUrl, quotePrice) {
        const planButtons = {
            'free': document.getElementById('sub-btn-free'),
            'independant': document.getElementById('sub-btn-independant'),
            'promo': document.getElementById('sub-btn-promo'),
            'centre': document.getElementById('sub-btn-centre')
        };
        
        // Définition des styles pour chaque plan (actif et inactif)
        const planStyles = {
            'free': {
                borderActive: 'border-yellow-300',
                badgeActive: ['bg-yellow-300', 'text-yellow-800'],
                btnActive: ['bg-yellow-100', 'text-yellow-800', 'font-semibold'],
                btnInactive: ['bg-yellow-50', 'hover:bg-yellow-100', 'text-yellow-700']
            },
            'independant': {
                borderActive: 'border-teal-600',
                badgeActive: ['bg-teal-600', 'text-white'],
                btnActive: ['bg-teal-100', 'text-teal-800', 'font-semibold'],
                btnInactive: ['bg-teal-600', 'hover:bg-teal-700', 'text-white']
            },
            'promo': {
                borderActive: 'border-blue-600',
                badgeActive: ['bg-blue-600', 'text-white'],
                btnActive: ['bg-blue-100', 'text-blue-800', 'font-semibold'],
                btnInactive: ['bg-blue-600', 'hover:bg-blue-700', 'text-white']
            },
            'centre': {
                borderActive: 'border-indigo-600',
                badgeActive: ['bg-indigo-600', 'text-white'],
                btnActive: ['bg-indigo-100', 'text-indigo-800', 'font-semibold'],
                // 'centre' a une logique inactive spéciale (devis ou contact)
                btnInactiveQuote: ['bg-green-600', 'hover:bg-green-700', 'text-white'],
                btnInactiveContact: ['bg-indigo-600', 'hover:bg-indigo-700', 'text-white']
            }
        };

        // --- 1. Réinitialiser TOUTES les cartes et TOUS les boutons ---
        for (const [plan, button] of Object.entries(planButtons)) {
            const card = button.closest('.card');
            const badge = card.querySelector('.js-active-plan-badge');
            
            // Réinitialiser la carte
            card.classList.remove('shadow-xl', 'border-2', ...Object.values(planStyles).map(s => s.borderActive));
            card.classList.add('hover:scale-[1.02]', 'hover:shadow-xl');
            
            // Cacher le badge
            badge.classList.add('hidden');
            badge.classList.remove(...Object.values(planStyles).flatMap(s => s.badgeActive)); // Retire toutes les couleurs de badge
            
            // Réinitialiser le bouton
            button.disabled = false;
            button.innerHTML = 'Choisir ce plan';
            button.classList.remove(
                ...Object.values(planStyles).flatMap(s => s.btnActive),
                ...Object.values(planStyles).flatMap(s => s.btnInactive),
                ...(planStyles.centre.btnInactiveQuote),
                ...(planStyles.centre.btnInactiveContact),
                'cursor-not-allowed'
            );

            // Appliquer le style INACTIF correct
            if (plan === 'centre') {
                if (quoteUrl) {
                    button.innerHTML = `Activer votre devis (${quotePrice || 'Voir devis'})`;
                    button.classList.add(...planStyles.centre.btnInactiveQuote);
                    button.onclick = () => { window.location.href = quoteUrl; };
                } else {
                    button.innerHTML = 'Demander un devis';
                    button.classList.add(...planStyles.centre.btnInactiveContact);
                    button.onclick = () => { switchTab('contact'); };
                }
            } else {
                button.classList.add(...planStyles[plan].btnInactive);
            }
        }
        
        // --- 2. Appliquer le style ACTIF au plan sélectionné ---
        if (planButtons[activePlan]) {
            const styles = planStyles[activePlan];
            const activeButton = planButtons[activePlan];
            const activeCard = activeButton.closest('.card');
            const activeBadge = activeCard.querySelector('.js-active-plan-badge');

            // Mettre la carte en surbrillance
            activeCard.classList.add('shadow-xl', 'border-2', styles.borderActive);
            activeCard.classList.remove('hover:scale-[1.02]', 'hover:shadow-xl'); // Supprimer le hover

            // Afficher et colorer le badge
            activeBadge.classList.remove('hidden');
            activeBadge.classList.add(...styles.badgeActive);
            
            // Styliser le bouton comme "Actif"
            activeButton.disabled = true;
            activeButton.innerHTML = '<i class="fas fa-check mr-2"></i> Plan actuel';
            activeButton.classList.remove(...Object.values(planStyles).flatMap(s => s.btnInactive)); // Nettoyer
            activeButton.classList.add(...styles.btnActive, 'cursor-not-allowed');
            
            // Le plan 'Centre' n'a pas besoin de .onclick_handler quand il est actif
            if (activePlan === 'centre') {
                activeButton.onclick = null; 
            }
        }
    }


    /**
     * Charge les détails du compte (plan, étudiants, organisation) depuis l'API
     */
    async function loadAccountDetails() {
        // Cacher les onglets spécifiques par défaut
        const invitationsTab = document.getElementById('tab-invitations');
        const centreTab = document.getElementById('tab-centre');
        invitationsTab.style.display = 'none'; 
        centreTab.style.display = 'none';

        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type']; // GET request
            
            // MODIFIÉ : Utilise API_URL
            const response = await fetch(`${API_URL}/api/account/details`, { headers });

            if (handleAuthError(response)) return;
            if (!response.ok) {
                throw new Error("Impossible de charger les détails du compte.");
            }

            const data = await response.json();
            /*
                data est supposé être : 
                { 
                    email: "user@email.com",
                    plan: 'free'|'independant'|'promo'|'centre', 
                    role: 'user' | 'owner' | 'formateur',
                    students: [...], 
                    organisation: {
                        name: "IFSI du Centre",
                        plan: "centre",
                        licences_utilisees: 3,
                        licences_max: 50,
                        formateurs: [ { email: "collegue1@ifsi.fr" }, ... ],
                        quote_url: "http://stripe.com/..." // (seulement si le compte est 'owner' et n'a pas payé)
                        quote_price: "2000€/an"
                    }
                }
            */

            // --- Logique d'affichage générale ---
            const planNameEl = document.getElementById('current-plan-name');
            const planDescEl = document.getElementById('plan-description');
            
            let displayPlan = data.plan;
            
            // Si l'utilisateur est un 'formateur' rattaché, il hérite du plan de l'organisation
            if (data.role === 'formateur' && data.organisation) {
                displayPlan = data.organisation.plan;
                planNameEl.textContent = `Plan ${displayPlan} (via ${data.organisation.name})`;
                planDescEl.textContent = `Vous êtes rattaché en tant que formateur.`;
                
                // Un formateur rattaché peut gérer ses étudiants
                invitationsTab.style.display = 'flex'; 
                renderStudentTable(data.students || []);

            } else if (data.role === 'owner' && data.organisation) {
                // C'est le propriétaire du plan Centre
                displayPlan = data.organisation.plan;
                planNameEl.textContent = `Plan ${displayPlan} (Propriétaire)`;
                planDescEl.textContent = `Vous gérez l'abonnement pour "${data.organisation.name}".`;
                
                // Le propriétaire gère les autres formateurs ET ses propres étudiants
                invitationsTab.style.display = 'flex';
                centreTab.style.display = 'flex';
                renderStudentTable(data.students || []);
                renderCentreDetails(data.organisation);
            
            } else {
                // C'est un utilisateur standard (free, independant, promo)
                displayPlan = data.plan;
                studentCount = data.students ? data.students.length : 0;

                if (displayPlan === 'promo') {
                    planNameEl.textContent = "Promo (Formateur)";
                    planDescEl.textContent = `Vous pouvez inviter jusqu'à 40 étudiants (${studentCount} / 40).`;
                    invitationsTab.style.display = 'flex';
                } else if (displayPlan === 'independant') {
                    planNameEl.textContent = "Indépendant";
                    planDescEl.textContent = `Sauvegardes illimitées, et jusqu'à 5 étudiants (${studentCount} / 5).`;
                    invitationsTab.style.display = 'flex';
                } else { // 'free'
                    planNameEl.textContent = "Free";
                    planDescEl.textContent = "Fonctionnalités de base, aucune sauvegarde de données, pas de comptes étudiants.";
                }
                
                if (displayPlan !== 'free') {
                    renderStudentTable(data.students || []);
                }
            }
            
            currentPlan = displayPlan; // Stocker le plan actif

            // Mettre à jour les boutons d'abonnement
            // On passe les infos de devis (meme si elles sont null)
            const quoteUrl = data.organisation ? data.organisation.quote_url : null;
            const quotePrice = data.organisation ? data.organisation.quote_price : null;
            updateSubscriptionButtons(displayPlan, quoteUrl, quotePrice);


        } catch (err) {
            console.error(err);
            showCustomAlert("Erreur", "Impossible de joindre le serveur. " + err.message);
        }
    }
    
    /**
     * NOUVEAU : Remplit la section "Gestion du Centre"
     */
    function renderCentreDetails(organisation) {
        document.getElementById('centre-plan-name').textContent = `Plan ${organisation.plan} ("${organisation.name}")`;
        document.getElementById('centre-plan-details').textContent = `Licences formateur utilisées : ${organisation.licences_utilisees} / ${organisation.licences_max || 'Illimitées'}`;
        
        const listContainer = document.getElementById('formateurs-list-container');
        document.getElementById('formateurs-loading').style.display = 'none';
        
        let html = '';
        if (!organisation.formateurs || organisation.formateurs.length === 0) {
            html = '<p class="text-sm text-gray-500">Vous n\'avez pas encore invité de formateur.</p>';
        } else {
            html = organisation.formateurs.map(formateur => `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
                    <span class="text-sm font-medium text-gray-700">${formateur.email}</span>
                    <button type="button" class="remove-formateur-btn text-xs text-red-500 hover:text-red-700" data-email="${formateur.email}" title="Retirer ce formateur">
                        <i class="fas fa-trash"></i> Retirer
                    </button>
                </div>
            `).join('');
        }
        listContainer.innerHTML = html;
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

        let limitReached = false;
        let limitMessage = "";

        if (currentPlan === 'independant' && students.length >= 5) {
            limitReached = true;
            limitMessage = "Limite de 5 étudiants atteinte pour le plan Indépendant.";
        } else if (currentPlan === 'promo' && students.length >= 40) {
            limitReached = true;
            limitMessage = "Limite de 40 étudiants atteinte pour le plan Promo.";
        }
        // Pour le plan 'centre', il n'y a pas de limite (ou elle est gérée par l'API)

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
            // MODIFICATION : Colspan mis à jour à 15
            tbody.innerHTML = `<tr><td colspan="15" class="p-4 text-center text-gray-500">Vous n'avez pas encore créé de compte étudiant.</td></tr>`;
            return;
        }

        let html = '';
        
        // MODIFICATION : Ajout de 'comptesRendus' à la liste
        const permissionsList = [
            'header', 'admin', 'vie', 'observations', 
            'comptesRendus',
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
     * NOUVEAU : Gère l'invitation d'un formateur
     */
    async function handleInviteFormateur(e) {
        e.preventDefault();
        const email = document.getElementById('invite-email').value;
        const button = document.getElementById('invite-formateur-btn');
        
        if (!email) {
            showCustomAlert("Erreur", "Veuillez saisir une adresse e-mail.");
            return;
        }

        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Envoi...';

        try {
            const headers = getAuthHeaders();
            // L'API devra gérer la logique d'invitation (vérifier limite de licences, etc.)
            const response = await fetch(`${API_URL}/api/organisation/invite`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ email: email })
            });

            if (handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Impossible d'envoyer l'invitation.");
            }
            
            showCustomAlert("Invitation envoyée", `Un e-mail d'invitation a été envoyé à ${email}.`);
            document.getElementById('invite-formateur-form').reset();
            loadAccountDetails(); // Recharger les détails pour mettre à jour la liste

        } catch (err) {
            showCustomAlert("Erreur", err.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Envoyer l\'invitation';
        }
    }
    
    /**
     * NOUVEAU : Gère le clic sur la liste des formateurs (suppression)
     */
    async function handleFormateursListClick(e) {
        const removeBtn = e.target.closest('.remove-formateur-btn');
        if (!removeBtn) return;
        
        const email = removeBtn.dataset.email;
        showDeleteConfirmation(
            `Êtes-vous sûr de vouloir retirer le formateur "${email}" de votre centre ? Son compte ne sera pas supprimé, mais il perdra l'accès à l'abonnement du centre.`,
            async () => {
                try {
                    const headers = getAuthHeaders();
                    const response = await fetch(`${API_URL}/api/organisation/remove`, {
                        method: 'POST', // Utiliser POST ou DELETE
                        headers: headers,
                        body: JSON.stringify({ email: email })
                    });

                    if (handleAuthError(response)) return;

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Impossible de retirer le formateur.");
                    }
                    
                    showCustomAlert("Formateur retiré", `${email} a été retiré de votre centre.`);
                    loadAccountDetails(); // Recharger

                } catch (err) {
                    showCustomAlert("Erreur", err.message);
                }
            }
        );
    }


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
            // MODIFIÉ : Utilise API_URL
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
     * Gère la changement de mot de passe
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
            // MODIFIÉ : Utilise API_URL
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
     * NOUVEAU : Gère la demande de changement d'e-mail
     */
    async function handleChangeEmail(e) {
        e.preventDefault();
        
        const newEmail = document.getElementById('new-email').value;
        const password = document.getElementById('current-password-for-email').value;
        
        if (!newEmail || !password) {
            showCustomAlert("Erreur", "Veuillez remplir tous les champs.");
            return;
        }
        
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_URL}/api/account/request-change-email`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ newEmail: newEmail, password: password })
            });

            if (handleAuthError(response)) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Impossible de traiter la demande.");
            }
            
            showCustomAlert("Demande envoyée", `Un e-mail de vérification a été envoyé à ${newEmail}. Veuillez cliquer sur le lien pour confirmer le changement.`);
            document.getElementById('change-email-form').reset();

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
                    // MODIFIÉ : Utilise API_URL
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
        // La logique du plan "Centre" est gérée par son propre bouton .onclick
        if (newPlan === 'centre') {
            switchTab('contact');
            return;
        }

        try {
            const headers = getAuthHeaders();
            // MODIFIÉ : Utilise API_URL
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
            // MODIFIÉ : Utilise API_URL
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
                        // MODIFIÉ : Utilise API_URL
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
            // MODIFIÉ : Utilise API_URL
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
            centre: document.getElementById('tab-centre'), // NOUVEAU
            invitations: document.getElementById('tab-invitations'),
            contact: document.getElementById('tab-contact')
        };
        tabContents = {
            security: document.getElementById('content-security'),
            subscription: document.getElementById('content-subscription'),
            centre: document.getElementById('content-centre'), // NOUVEAU
            invitations: document.getElementById('content-invitations'),
            contact: document.getElementById('content-contact')
        };

        // Listeners des onglets
        tabButtons.security.addEventListener('click', () => switchTab('security'));
        tabButtons.subscription.addEventListener('click', () => switchTab('subscription'));
        tabButtons.centre.addEventListener('click', () => switchTab('centre')); // NOUVEAU
        tabButtons.invitations.addEventListener('click', () => switchTab('invitations'));
        tabButtons.contact.addEventListener('click', () => switchTab('contact')); 

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
        document.getElementById('change-email-form').addEventListener('submit', handleChangeEmail); // NOUVEAU
        document.getElementById('delete-account-btn').addEventListener('click', handleDeleteAccount);
        
        // MODIFIÉ : Listeners de la section Abonnement
        document.getElementById('sub-btn-free').addEventListener('click', () => handleChangeSubscription('free'));
        document.getElementById('sub-btn-independant').addEventListener('click', () => handleChangeSubscription('independant'));
        document.getElementById('sub-btn-promo').addEventListener('click', () => handleChangeSubscription('promo'));
        // Le bouton "Centre" est géré dynamiquement dans updateSubscriptionButtons

        // NOUVEAU : Listeners de la section Centre
        document.getElementById('invite-formateur-form').addEventListener('submit', handleInviteFormateur);
        document.getElementById('formateurs-list-container').addEventListener('click', handleFormateursListClick);

        // Listeners de la section Invitations (Étudiants)
        document.getElementById('create-student-form').addEventListener('submit', handleCreateStudent);
        document.getElementById('generate-credentials-btn').addEventListener('click', handleGenerateCredentials);
        
        // Listeners délégués pour le tableau des permissions (Étudiants)
        const permissionsTbody = document.getElementById('permissions-tbody');
        permissionsTbody.addEventListener('change', handlePermissionChange);
        permissionsTbody.addEventListener('click', handleTableClicks); 
        
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