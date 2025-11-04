// Enveloppe de l'IIFE pour encapsuler le code et éviter la pollution globale
(function() {
    "use strict"; 

    const API_URL = 'http://localhost:3000'; 

    // --- NOUVEAU : Gestion des permissions ---
    let userPermissions = { 
        isStudent: false 
        // Par défaut, l'utilisateur a tous les droits (n'est pas étudiant)
        // Si isStudent = true, on lira :
        // header: true/false,
        // admin: true/false,
        // ...
        // prescriptions_add: true/false,
        // prescriptions_delete: true/false,
        // prescriptions_validate: true/false,
        // ...
    };
    // ------------------------------------------

    // --- Fonction utilitaire pour l'authentification ---
    
    /**
     * Récupère le token d'authentification depuis le localStorage.
     * Si le token n'est pas trouvé, redirige vers la page de connexion.
     * @returns {string|null} Le token ou null si non trouvé.
     */
    function getAuthToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error("Aucun token trouvé, redirection vers login.");
            // Redirige l'utilisateur s'il n'est pas connecté
            window.location.href = 'auth.html'; // Redirigé vers auth.html
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
            // Cette vérification est redondante si getAuthToken redirige, mais c'est une sécurité
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
            window.location.href = 'auth.html'; // Redirigé vers auth.html
            return true;
        }
        return false;
    }
    // -----------------------------------------------------------

    // --- NOUVEAU : Récupère les permissions de l'utilisateur ---
    async function loadUserPermissions() {
        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type'];

            // NOTE : Cette route /api/auth/me doit être créée sur le backend.
            // Elle doit renvoyer les infos de l'utilisateur, y compris son rôle et ses permissions.
            const response = await fetch(`${API_URL}/api/auth/me`, { headers });

            if (handleAuthError(response)) return;
            if (!response.ok) {
                throw new Error("Impossible de récupérer les informations utilisateur.");
            }

            const userData = await response.json();
            
            // Si l'utilisateur est un étudiant, on stocke ses permissions
            if (userData.role === 'etudiant' && userData.permissions) {
                userPermissions = {
                    ...userData.permissions,
                    isStudent: true
                };
                console.log("Compte étudiant chargé. Permissions appliquées :", userPermissions);
            } else {
                // C'est un 'solo', 'pro' ou 'admin', il a tous les droits.
                userPermissions = { isStudent: false };
                console.log("Compte formateur chargé. Tous droits activés.");
            }
        } catch (err) {
            console.error(err);
            // En cas d'erreur, on garde les droits par défaut (non-étudiant)
            userPermissions = { isStudent: false };
            showCustomAlert("Erreur de permissions", "Impossible de vérifier les permissions du compte. Tous les droits sont activés par défaut.");
        }
    }

    // --- NOUVEAU : Applique les restrictions de permissions à l'UI ---
    function applyPermissions() {
        // Si l'utilisateur n'est pas un étudiant, il a tous les droits, on ne fait rien.
        if (!userPermissions.isStudent) return;

        // 1. Cacher les boutons de haut niveau
        const studentForbiddenButtons = [
            '#save-patient-btn',
            '#load-patient-btn',
            '#import-json-btn',
            '#clear-current-patient-btn',
            '#clear-all-data-btn',
            '#account-management-btn' // (Bouton sur simul.html)
        ];
        studentForbiddenButtons.forEach(selector => {
            const btn = document.querySelector(selector);
            if (btn) btn.style.display = 'none';
        });

        // 2. Verrouiller les sections (En-tête, Admin, Vie)
        if (!userPermissions.header) {
            const btn = document.getElementById('lock-header-btn');
            if (btn) {
                btn.style.display = 'none';
                // Force le verrouillage (le 'true' final force l'état 'is-locked')
                toggleLock('patient-header-form', 'lock-header-btn', true);
            }
        }
        if (!userPermissions.admin) {
            const btn = document.getElementById('lock-admin-btn');
            if (btn) {
                btn.style.display = 'none';
                toggleLock('administratif', 'lock-admin-btn', true);
            }
        }
        if (!userPermissions.vie) {
            const btn = document.getElementById('lock-vie-btn');
            if (btn) {
                btn.style.display = 'none';
                toggleLock('mode-de-vie', 'lock-vie-btn', true);
            }
        }

        // 3. Cacher les formulaires d'ajout
        if (!userPermissions.observations) {
            const form = document.getElementById('new-observation-form');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.transmissions) {
            const form = document.getElementById('new-transmission-form-2');
            if (form) form.style.display = 'none';
        }
        // MODIFIÉ : Utilisation de la permission granulaire
        if (!userPermissions.prescriptions_add) {
            const form = document.getElementById('new-prescription-form');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.diagramme) {
            const form = document.getElementById('new-care-form');
            if (form) form.style.display = 'none';
        }

        // 4. Désactiver les inputs directs (Pancarte, Bio)
        if (!userPermissions.pancarte) {
            document.querySelectorAll('#pancarte-table input').forEach(el => el.disabled = true);
        }
        if (!userPermissions.biologie) {
            document.querySelectorAll('#bio-table input').forEach(el => el.disabled = true);
        }
    }
    // -----------------------------------------------------------


    // --- Références pour la modale "Charger Patient" ---
    let loadPatientModal, loadPatientBox, loadPatientListContainer;
    // -----------------------------------------------------------

    // Verrou pour empêcher l'auto-save pendant le chargement
    let isLoadingData = false;

    let pancarteChartInstance;
    const patients = Array.from({ length: 10 }, (_, i) => ({
        id: `chambre_${101 + i}`,
        room: `${101 + i}`
    }));
    let activePatientId = localStorage.getItem('activePatientId') || patients[0].id; 

    let ivInteraction = {
        active: false, mode: null, targetBar: null, targetCell: null,
        startX: 0, startLeft: 0, startWidth: 0,
        startLeftPx: 0,
    };

    const nfsData = { "Hématies (T/L)": "4.5-5.5", "Hémoglobine (g/dL)": "13-17", "Hématocrite (%)": "40-52", "VGM (fL)": "80-100", "Leucocytes (G/L)": "4-10", "Plaquettes (G/L)": "150-400" };
    const ionoData = { "Sodium (mmol/L)": "136-145", "Potassium (mmol/L)": "3.5-5.1", "Chlore (mmol/L)": "98-107", "Bicarbonates (mmol/L)": "22-29", "Urée (mmol/L)": "2.8-7.2", "Créatinine (µmol/L)": "62-106" };
    const hepatiqueData = { "ASAT (UI/L)": "< 40", "ALAT (UI/L)": "< 41", "Gamma-GT (UI/L)": "11-50", "PAL (UI/L)": "40-129", "Bilirubine totale (µmol/L)": "5-21" };
    const lipidiqueData = { "Cholestérol total (g/L)": "< 2.0", "Triglycérides (g/L)": "< 1.5", "HDL Cholestérol (g/L)": "> 0.4", "LDL Cholestérol (g/L)": "< 1.6" };
    const gdsData = { "pH": "7.35-7.45", "PaCO2 (mmHg)": "35-45", "PaO2 (mmHg)": "80-100", "HCO3- (mmol/L)": "22-26", "SaO2 (%)": "> 95" };
    const inflammationData = { "CRP (mg/L)": "< 5" };
    const pancarteData = {
        'Pouls (/min)': [], 'Tension (mmHg)': [], 'Température (°C)': [], 'SpO2 (%)': [], 'Douleur (EVA /10)': []
    };

    /**
     * Arrondit un objet Date à l'intervalle de 15 minutes le plus proche.
     * @param {Date} date - La date à arrondir.
     * @returns {Date} La date arrondie.
     */
    function roundDateTo15Min(date) {
        const ms = 1000 * 60 * 15; // 15 minutes en millisecondes
        // Utilise Math.round() pour trouver le multiple de 15min le plus proche
        return new Date(Math.round(date.getTime() / ms) * ms);
    }

    // =================================================================
    // MODIFIÉ : Sauvegarde les données de la CHAMBRE sur le SERVEUR
    // =================================================================
    async function saveData(patientId) {
        // MODIFIÉ : La sauvegarde est activée pour TOUS (le serveur filtrera)
        
        if (!patientId) return;
        
        if (!patientId.startsWith('chambre_')) {
            console.warn('La sauvegarde automatique ne concerne que les chambres.');
            return;
        }

        const state = {};

        // 1. Collecte du 'state'
        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') { state[id] = el.checked; } else { state[id] = el.value; }
        });
        const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
        dynamicContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) state[id + '_html'] = el.innerHTML;
        });
        const bioData = { dates: [], analyses: {} };
        document.querySelectorAll('#bio-table thead input[type="text"]').forEach(input => bioData.dates.push(input.value));
        document.querySelectorAll('#bio-table tbody tr').forEach(row => {
            if (row.cells.length > 1 && row.cells[0].classList.contains('font-semibold')) { 
                const analyseName = row.cells[0].textContent.trim();
                if (analyseName) {
                    bioData.analyses[analyseName] = [];
                    row.querySelectorAll('input[type="text"]').forEach(input => bioData.analyses[analyseName].push(input.value));
                }
            }
        });
        state.biologie = bioData;
        const pancarteData = {};
        document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
            const paramName = row.cells[0].textContent.trim();
            if (paramName) {
                pancarteData[paramName] = [];
                row.querySelectorAll('input').forEach(input => pancarteData[paramName].push(input.value));
            }
        });
        state.pancarte = pancarteData;
        
        state.prescriptions = [];
        document.querySelectorAll('#prescription-tbody tr').forEach(row => {
            const prescriptionData = {
                name: row.cells[0].querySelector('span').textContent,
                posologie: row.cells[1].textContent,
                voie: row.cells[2].textContent,
                startDate: row.cells[3].textContent,
                type: row.dataset.type
            };

            prescriptionData.bars = Array.from(row.querySelectorAll('.iv-bar')).map(bar => ({ 
                left: bar.style.left, 
                width: bar.style.width, 
                title: bar.title 
            }));
            
            state.prescriptions.push(prescriptionData);
        });
        
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);
        state.lockButtonStates = {};
        document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
            state.lockButtonStates[btn.id] = btn.classList.contains('is-locked');
        });
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        const patientName = `${nomUsage} ${prenom}`.trim();
        state['sidebar_patient_name'] = patientName;
        // ... (Fin de la collecte de 'state') ...

        
        try {
            const headers = getAuthHeaders(); 
            if (!headers) return;

            // Appelle la route POST standard pour mettre à jour la chambre
            const response = await fetch(`${API_URL}/api/patients/${patientId}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    dossierData: state,
                    sidebar_patient_name: patientName || `Chambre ${patientId.split('_')[1]}`
                })
            });

            if (handleAuthError(response)) return;
            
        } catch (err) {
            console.error("Erreur lors de la sauvegarde sur le serveur:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
        }
        
        // Mettre à jour la barre latérale
        const sidebarEntry = document.querySelector(`#patient-list button[data-patient-id="${patientId}"] .patient-name`);
        if (sidebarEntry) {
            sidebarEntry.textContent = patientName || `Chambre ${patientId.split('_')[1]}`;
        }
    }

    // =================================================================
    // MODIFIÉ : Charge les données depuis le SERVEUR (avec Auth)
    // =================================================================
    async function loadData(patientId) {
        if (!patientId) return;
        
        isLoadingData = true;
        
        let state;
        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            delete headers['Content-Type'];

            const response = await fetch(`${API_URL}/api/patients/${patientId}`, {
                headers: headers
            });

            if (handleAuthError(response)) return;

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Dossier ${patientId} non trouvé sur le serveur, initialisation locale.`);
                    state = {};
                } else {
                    throw new Error('Erreur réseau');
                }
            } else {
                 state = await response.json();
            }

        } catch (err) {
            console.error("Erreur de chargement des données:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
            state = {}; 
        }

        if (!state || Object.keys(state).length === 0) {
            resetForm();
        } else {
            // Logique de remplissage (inchangée)
            Object.keys(state).forEach(id => {
                if (id === 'biologie' || id === 'pancarte' || id === 'prescriptions' || id ==='lockButtonStates' || id === 'careDiagramCheckboxes' || id.endsWith('_html')) return;
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = state[id]; } else { el.value = state[id]; }
                }
            });
            const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
            dynamicContentIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && state[id + '_html']) {
                    el.innerHTML = state[id + '_html'];
                } else if (id === 'care-diagram-tbody' && (!state[id + '_html'])) {
                    el.innerHTML = getDefaultForCareDiagramTbody();
                }
            });
            if (state.prescriptions) {
                const tbody = document.getElementById('prescription-tbody');
                tbody.innerHTML = '';
                // addPrescription va maintenant vérifier les permissions
                state.prescriptions.forEach(pData => addPrescription(pData, true));
            }
            if (state.careDiagramCheckboxes && !state['care-diagram-tbody_html']) {
                document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]').forEach((cb, index) => {
                    cb.checked = state.careDiagramCheckboxes[index] || false;
                });
            }
            if (state.biologie) {
                document.querySelectorAll('#bio-table thead input[type="text"]').forEach((input, index) => {
                    if (state.biologie.dates && state.biologie.dates[index]) { input.value = state.biologie.dates[index]; }
                });
                document.querySelectorAll('#bio-table tbody tr').forEach(row => {
                    if (row.cells.length > 1 && row.cells[0].classList.contains('font-semibold')) {
                        const analyseName = row.cells[0].textContent.trim();
                        if (analyseName && state.biologie.analyses && state.biologie.analyses[analyseName]) {
                            row.querySelectorAll('input[type="text"]').forEach((input, index) => {
                                input.value = state.biologie.analyses[analyseName][index] || '';
                            });
                        }
                    }
                });
            }
            if (state.pancarte) {
                document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
                    const paramName = row.cells[0].textContent.trim();
                    if (paramName && state.pancarte && state.pancarte[paramName]) {
                        row.querySelectorAll('input').forEach((input, index) => { input.value = state.pancarte[paramName][index] || ''; });
                    }
                });
            }
            const entryDateValue = document.getElementById('patient-entry-date').value;
            if (entryDateValue) {
                const entryDate = new Date(entryDateValue);
                if (!isNaN(entryDate.getTime())) { updateDynamicDates(entryDate); }
            }
            if (state.lockButtonStates) {
                Object.keys(state.lockButtonStates).forEach(buttonId => {
                    if (state.lockButtonStates[buttonId]) { 
                        const button = document.getElementById(buttonId);
                        if (button && !button.classList.contains('is-locked')) { 
                            let containerId;
                            if (buttonId === 'lock-header-btn') containerId = 'patient-header-form';
                            if (buttonId === 'lock-admin-btn') containerId = 'administratif';
                            if (buttonId === 'lock-vie-btn') containerId = 'mode-de-vie';
                            if (containerId) { toggleLock(containerId, buttonId, true); }
                        }
                    }
                });
            }
        }
        
        const roomDisplay = document.querySelector(`#patient-list button[data-patient-id="${patientId}"] .patient-room`);
        if (roomDisplay) {
            const patientRoomEl = document.getElementById('patient-room');
            if (patientRoomEl) patientRoomEl.value = roomDisplay.textContent;
        }
        
        updateAgeDisplay();
        updateJourHosp(); 
        
        calculateAndDisplayIMC();

        setTimeout(() => { isLoadingData = false; }, 0);
    }

    // =================================================================
    // Efface les données LOCALES de la chambre actuelle
    // =================================================================
    function clearCurrentPatientData() {
        if (userPermissions.isStudent) return;
        
        const message = `Êtes-vous sûr de vouloir effacer les données de la chambre ${activePatientId.split('_')[1]} ? Cela réinitialisera l'affichage. Aucune donnée ne sera supprimée du serveur.`;
        showDeleteConfirmation(message, async () => {
            
            resetForm();
            
            const btn = document.querySelector(`#patient-list button[data-patient-id="${activePatientId}"]`);
            const nameEl = btn.querySelector('.patient-name');
            const roomEl = btn.querySelector('.patient-room');
            if (nameEl && roomEl) {
                nameEl.textContent = `Chambre ${roomEl.textContent}`;
            }
            
            const headers = getAuthHeaders();
            if (!headers) return;
            try {
                await fetch(`${API_URL}/api/patients/${activePatientId}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        dossierData: {}, 
                        sidebar_patient_name: `Chambre ${activePatientId.split('_')[1]}`
                    })
                });
            } catch (err) {
                console.error("Erreur lors de la réinitialisation (POST) de la chambre:", err);
            }
        });
    }

    // =================================================================
    // "Vider tous les dossiers" (localement)
    // =================================================================
    function clearAllData() {
        if (userPermissions.isStudent) return;

        const message = "ATTENTION : Vous êtes sur le point de réinitialiser les 10 chambres du service. Les sauvegardes ne sont pas affectées. Continuer ?";
        
        showDeleteConfirmation(message, async () => {
            
            document.querySelectorAll('#patient-list button').forEach(btn => {
                const nameEl = btn.querySelector('.patient-name');
                const roomEl = btn.querySelector('.patient-room');
                if (nameEl && roomEl) {
                    nameEl.textContent = `Chambre ${roomEl.textContent}`;
                }
            });
            
            resetForm();
            
            const headers = getAuthHeaders();
            if (!headers) return;
            const allChambreIds = patients.map(p => p.id);
            const clearPromises = [];

            for (const patientId of allChambreIds) {
                const promise = fetch(`${API_URL}/api/patients/${patientId}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        dossierData: {},
                        sidebar_patient_name: `Chambre ${patientId.split('_')[1]}`
                    })
                });
                clearPromises.push(promise);
            }

            try {
                await Promise.all(clearPromises);
                showCustomAlert("Opération réussie", "Toutes les chambres ont été réinitialisées.");
            } catch (err) {
                 console.error("Erreur lors de la réinitialisation de toutes les chambres:", err);
                 showCustomAlert("Erreur", "Une erreur est survenue lors de la réinitialisation.");
            }
        });
    }

    // =================================================================
    // Sauvegarde le cas patient (distinct de saveData)
    // =================================================================
    async function savePatientAsCase() {
        if (userPermissions.isStudent) return;

        const state = {};
        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') { state[id] = el.checked; } else { state[id] = el.value; }
        });
        const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
        dynamicContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) state[id + '_html'] = el.innerHTML;
        });
        const bioData = { dates: [], analyses: {} };
        document.querySelectorAll('#bio-table thead input[type="text"]').forEach(input => bioData.dates.push(input.value));
        document.querySelectorAll('#bio-table tbody tr').forEach(row => {
            if (row.cells.length > 1 && row.cells[0].classList.contains('font-semibold')) { 
                const analyseName = row.cells[0].textContent.trim();
                if (analyseName) {
                    bioData.analyses[analyseName] = [];
                    row.querySelectorAll('input[type="text"]').forEach(input => bioData.analyses[analyseName].push(input.value));
                }
            }
        });
        state.biologie = bioData;
        const pancarteData = {};
        document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
            const paramName = row.cells[0].textContent.trim();
            if (paramName) {
                pancarteData[paramName] = [];
                row.querySelectorAll('input').forEach(input => pancarteData[paramName].push(input.value));
            }
        });
        state.pancarte = pancarteData;
        
        state.prescriptions = [];
        document.querySelectorAll('#prescription-tbody tr').forEach(row => {
            const prescriptionData = {
                name: row.cells[0].querySelector('span').textContent,
                posologie: row.cells[1].textContent,
                voie: row.cells[2].textContent,
                startDate: row.cells[3].textContent,
                type: row.dataset.type
            };
            prescriptionData.bars = Array.from(row.querySelectorAll('.iv-bar')).map(bar => ({ 
                left: bar.style.left, 
                width: bar.style.width, 
                title: bar.title 
            }));
            state.prescriptions.push(prescriptionData);
        });
        
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);
        state.lockButtonStates = {};
        document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
            state.lockButtonStates[btn.id] = btn.classList.contains('is-locked');
        });
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        const patientName = `${nomUsage} ${prenom}`.trim();
        state['sidebar_patient_name'] = patientName;
        
        if (!patientName || patientName.startsWith('Chambre ')) {
            showCustomAlert("Sauvegarde impossible", "Veuillez d'abord donner un Nom et un Prénom au patient dans l'en-tête (Champs 'Nom d'usage' et 'Prénom').");
            return;
        }

        try {
            const headers = getAuthHeaders();
            if (!headers) return;

            const response = await fetch(`${API_URL}/api/patients/save`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    dossierData: state,
                    sidebar_patient_name: patientName
                })
            });

            if (handleAuthError(response)) return;
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la sauvegarde');
            }
            
            showCustomAlert("Sauvegarde réussie", `Le dossier de "${patientName}" a été sauvegardé avec succès.`);

        } catch (err) {
            console.error("Erreur lors de la sauvegarde du cas:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            } else {
                showCustomAlert("Erreur", err.message);
            }
        }
    }

    // =================================================================
    // Fonction d'importation par fichier JSON
    // =================================================================
    function importCurrentPatientData(event) {
        if (userPermissions.isStudent) return;

        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();

        reader.onload = async (e) => {
            const content = e.target.result;
            try {
                if (!content || typeof content !== 'string' || content.trim().length === 0) {
                    throw new Error("Le contenu du fichier est vide ou invalide.");
                }
                const jsonData = JSON.parse(content); 
                if (typeof jsonData !== 'object' || jsonData === null) {
                    throw new Error("Le fichier JSON ne contient pas un objet valide.");
                }
                
                const patientName = jsonData.sidebar_patient_name || `Chambre ${activePatientId.split('_')[1]}`;
                
                const headers = getAuthHeaders();
                if (!headers) return;
                
                const response = await fetch(`${API_URL}/api/patients/${activePatientId}`, {
                    method: 'POST',
                    headers: headers, 
                    body: JSON.stringify({
                        dossierData: jsonData, 
                        sidebar_patient_name: patientName
                    })
                });

                if (handleAuthError(response)) return;

                await switchPatient(activePatientId, true); 
                await initSidebar(); // Mettre à jour la sidebar

            } catch (error) {
                console.error("Erreur d'importation:", error);
                if (error.message.includes("Token non trouvé")) {
                     window.location.href = 'auth.html';
                } else {
                    showCustomAlert("Erreur d'importation", `Le fichier n'est pas un JSON valide ou est corrompu. Erreur: ${error.message}`);
                }
            }
        };
        reader.onerror = (e) => {
            showCustomAlert("Erreur de lecture", "Impossible de lire le fichier sélectionné.");
        };

        reader.readAsText(file);
        event.target.value = '';
    }

    // =================================================================
    // Fonctions pour la modale "Charger Patient"
    // =================================================================
    function hideLoadPatientModal() {
        loadPatientBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            loadPatientModal.classList.add('hidden');
        }, 200);
    }

    async function openLoadPatientModal() {
        if (userPermissions.isStudent) return;

        loadPatientListContainer.innerHTML = '<p class="text-gray-500">Chargement des dossiers...</p>';
        loadPatientModal.classList.remove('hidden');
        setTimeout(() => {
            loadPatientBox.classList.remove('scale-95', 'opacity-0');
        }, 10);

        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            delete headers['Content-Type'];

            const response = await fetch(`${API_URL}/api/patients`, { headers: headers });
            if (handleAuthError(response)) return;

            const patientsData = await response.json();
            
            const savedPatients = patientsData.filter(p => p.patientId.startsWith('save_'));

             if (savedPatients.length === 0) {
                loadPatientListContainer.innerHTML = '<p class="text-gray-500">Aucun dossier patient n\'a encore été sauvegardé.</p>';
                return;
            }

            let html = '';
            savedPatients.sort((a, b) => a.sidebar_patient_name.localeCompare(b.sidebar_patient_name)).forEach(patient => {
                html += `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <p class="font-medium text-gray-800">${patient.sidebar_patient_name}</p>
                        </div>
                        <div class="space-x-2 flex-shrink-0">
                            <button type="button" class="load-btn px-3 py-1 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700" data-patient-id="${patient.patientId}">
                                <i class="fas fa-download mr-1"></i> Charger
                            </button>
                            <button type="button" class="delete-btn px-3 py-1 text-sm font-medium text-red-600 rounded-md hover:bg-red-100" data-patient-id="${patient.patientId}" data-patient-name="${patient.sidebar_patient_name}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            loadPatientListContainer.innerHTML = html;

        } catch (err) {
            console.error("Erreur lors du chargement de la liste des patients:", err);
            loadPatientListContainer.innerHTML = '<p class="text-red-500">Erreur lors du chargement des dossiers.</p>';
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
        }
    }

    // =================================================================
    // Initialise la sidebar depuis le SERVEUR (avec Auth)
    // =================================================================
    async function initSidebar() {
        const list = document.getElementById('patient-list');
        let listHTML = '';
        let patientMap = new Map();
        
        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            delete headers['Content-Type'];

            const response = await fetch(`${API_URL}/api/patients`, {
                headers: headers
            });

            if (handleAuthError(response)) return;

            const patientsData = await response.json();
            patientsData.forEach(p => {
                if (p.patientId.startsWith('chambre_')) {
                    patientMap.set(p.patientId, p.sidebar_patient_name);
                }
            });

        } catch (err) {
            console.error("Impossible de charger la liste des patients:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
        }

        patients.forEach(patient => {
            const patientName = patientMap.get(patient.id) || `Chambre ${patient.room}`;
            listHTML += `
                <li class="mb-1">
                    <button type="button" data-patient-id="${patient.id}">
                        <span class="patient-icon"><i class="fas fa-bed"></i></span>
                        <span class="patient-name">${patientName}</span>
                        <span class="patient-room">${patient.room}</span>
                    </button>
                </li>`;
        });
        list.innerHTML = listHTML;
    }

    // =================================================================
    // LE RESTE DU FICHIER EST INCHANGÉ (sauf setupEventListeners et initApp)
    // =================================================================
    
    function updateSidebarActiveState(patientId) {
        document.querySelectorAll('#patient-list button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.patientId === patientId) {
                btn.classList.add('active');
            }
        });
    }

    function resetForm() {
        document.querySelectorAll('#patient-header-form input, #patient-header-form textarea, main input, main textarea').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
            else if (el.type !== 'file') el.value = '';
        });

        ['observations-list', 'transmissions-list-ide', 'prescription-tbody'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        
        const careDiagramTbody = document.getElementById('care-diagram-tbody');
        if (careDiagramTbody) {
            careDiagramTbody.innerHTML = getDefaultForCareDiagramTbody();
        }

        document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
            if (btn.classList.contains('is-locked')) { 
                btn.click(); 
            }
        });
        
        calculateAndDisplayIMC();
        
        if (pancarteChartInstance) pancarteChartInstance.destroy();
    }

    async function switchPatient(newPatientId, skipSave = false) {
        if (activePatientId !== newPatientId && !skipSave) {
            await saveData(activePatientId); 
        }
        activePatientId = newPatientId;
        localStorage.setItem('activePatientId', newPatientId); 
        
        resetForm(); 
        
        await loadData(newPatientId); 
        
        updateSidebarActiveState(newPatientId);
        setTimeout(() => {
            document.querySelectorAll('textarea.info-value').forEach(autoResize);
        }, 0);
        updatePancarteChart();
        const mainContent = document.getElementById('main-content-wrapper');
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });

        // NOUVEAU : Réappliquer les permissions après le chargement/changement
        applyPermissions();
    }

    function generateBioRows(title, data) {
        let html = `<tr class="font-bold bg-purple-50 text-left"><td class="p-2" colspan="8">${title}</td></tr>`;
        for (const [key, value] of Object.entries(data)) {
            html += `<tr><td class="p-2 text-left font-semibold">${key}</td><td class="p-2 text-left text-xs">${value}</td>`;
            for (let i = 0; i < 6; i++) {
                html += '<td class="p-0"><input type="text"></td>';
            }
            html += '</tr>';
        }
        return html;
    }

    function initializeDynamicTables() {
        let html = '';

        const prescriptionThead = document.getElementById('prescription-thead');
        if (prescriptionThead) {
            html = '<tr><th class="p-2 text-left align-bottom min-w-[220px]" rowspan="2">Médicament / Soin</th><th class="p-2 text-left align-bottom min-w-[144px]" rowspan="2">Posologie</th><th class="p-2 text-left align-bottom min-w-[96px]" rowspan="2">Voie</th><th class="p-2 text-left align-bottom" rowspan="2" style="min-width: 100px;">Date de début</th>';
            for(let i=0; i<11; i++) { html += `<th class="p-2 text-center" colspan="8">Jour ${i}</th>`;}
            html += '</tr><tr>';
            const hours = ['0h', '3h', '6h', '9h', '12h', '15h', '18h', '21h'];
            for(let i=0; i<11; i++) { 
                for (const hour of hours) {
                    html += `<th class="p-1 text-center small-col">${hour}</th>`;
                }
            }
            html += '</tr>';
            prescriptionThead.innerHTML = html;
        }

        const bioThead = document.getElementById('bio-thead');
        if (bioThead) {
            html = '<tr><th class="p-2 text-left w-1/4">Analyse</th><th class="p-2 text-left w-1/4">Valeurs de référence</th>';
            for(let i=0; i<6; i++) {
                html += `<th class="p-1"><input type="text" placeholder="JJ/MM/AA" class="font-semibold text-center w-24 bg-transparent"></th>`;
            }
            html += '</tr>';
            bioThead.innerHTML = html;
        }

        const bioTbody = document.getElementById('bio-tbody');
        if (bioTbody) {
            html = '';
            html += generateBioRows('Numération Formule Sanguine (NFS)', nfsData);
            html += generateBioRows('Bilan Électrolytique', ionoData);
            html += generateBioRows('Bilan Hépatique', hepatiqueData);
            html += generateBioRows('Bilan Lipidique', lipidiqueData);
            html += generateBioRows('Gaz du Sang (artériel)', gdsData);
            html += generateBioRows('Marqueurs Inflammation', inflammationData);
            bioTbody.innerHTML = html;
        }

        const pancarteThead = document.getElementById('pancarte-thead');
        if (pancarteThead) {
            html = '<tr><th class="p-2 text-left" rowspan="2">Paramètres</th>';
            for(let i=0; i<11; i++) { html += `<th class="p-2 text-center" colspan="3">Jour ${i}</th>`;}
            html += '</tr><tr>';
            for(let i=0; i<11; i++) { html += `<th class="p-1 w-32">Matin</th><th class="p-1 w-32">Soir</th><th class="p-1 w-32">Nuit</th>`;}
            html += '</tr>';
            pancarteThead.innerHTML = html;
        }

        const pancarteTbody = document.getElementById('pancarte-tbody');
        if (pancarteTbody) {
            html = '';
            for (const param in pancarteData) {
                html += `<tr><td class="p-2 text-left font-semibold">${param}</td>`;
                let inputHtml = '<input type="text" value="">'; 
                if (param === 'Température (°C)') {
                    inputHtml = '<input type="number" step="0.1" value="">';
                }
                for(let i=0; i<33; i++) {
                    html += `<td class="p-0">${inputHtml}</td>`;
                }
                html += `</tr>`;
            }
            pancarteTbody.innerHTML = html;
        }

        const careDiagramThead = document.getElementById('care-diagram-thead');
        if (careDiagramThead) {
            html = '<tr><th class="p-2 text-left min-w-[220px]">Soin / Surveillance</th>';
            for(let i=0; i<11; i++) { html += `<th colspan="8" class="border-l">Jour ${i}</th>`;}
            html += '</tr><tr><th class="min-w-[220px]"></th>';
            const hours = ['0h', '3h', '6h', '9h', '12h', '15h', '18h', '21h'];
            for(let i=0; i<11; i++) { 
                for (let j = 0; j < hours.length; j++) {
                    const borderClass = (j === 0) ? 'border-l' : '';
                    html += `<th class="${borderClass} p-1 text-center small-col">${hours[j]}</th>`;
                }
            }

            html += '</tr>';
            careDiagramThead.innerHTML = html;
        }
    }

    // =================================================================
    // MODIFIÉ : setupEventListeners (ajout des vérifications de permissions)
    // =================================================================
    function setupEventListeners() {
        // Barre latérale
        document.getElementById('start-tutorial-btn').addEventListener('click', startTutorial);
        document.getElementById('clear-all-data-btn').addEventListener('click', clearAllData);
        // NOUVEAU : Listener pour le bouton de gestion de compte
        const accountBtn = document.getElementById('account-management-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', (e) => {
                if (userPermissions.isStudent) e.preventDefault(); // Double sécurité
            });
        }
        
        // Entête principale
        document.getElementById('save-patient-btn').addEventListener('click', savePatientAsCase);
        document.getElementById('load-patient-btn').addEventListener('click', openLoadPatientModal);
        document.getElementById('import-json-btn').addEventListener('click', () => {
             // NOUVEAU : Check
            if (userPermissions.isStudent) return;
            document.getElementById('import-file').click()
        });
        document.getElementById('import-file').addEventListener('change', importCurrentPatientData);
        
        document.getElementById('clear-current-patient-btn').addEventListener('click', clearCurrentPatientData);
        document.getElementById('toggle-fullscreen-btn').addEventListener('click', toggleFullscreen);

        // Entête Patient
        document.getElementById('lock-header-btn').addEventListener('click', () => toggleLock('patient-header-form', 'lock-header-btn'));
        document.getElementById('patient-entry-date').addEventListener('input', updateJourHosp);

        // Onglets de navigation (Délégation)
        document.getElementById('tabs-nav').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-tab-id]');
            if (button) {
                changeTab({ currentTarget: button }, button.dataset.tabId);
            }
        });

        // Liste des patients (Délégation)
        document.getElementById('patient-list').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-patient-id]');
            if (button) {
                switchPatient(button.dataset.patientId); 
            }
        });

        // Boutons "Valider" des sections
        document.getElementById('lock-admin-btn').addEventListener('click', () => toggleLock('administratif', 'lock-admin-btn'));
        document.getElementById('lock-vie-btn').addEventListener('click', () => toggleLock('mode-de-vie', 'lock-vie-btn'));

        // Formulaires d'ajout
        document.getElementById('add-observation-btn').addEventListener('click', addObservation);
        document.getElementById('add-prescription-btn').addEventListener('click', () => addPrescription(null, false));
        document.getElementById('add-transmission-btn').addEventListener('click', addTransmission);
        document.getElementById('add-care-diagram-btn').addEventListener('click', addCareDiagramRow);

        // Listes dynamiques pour suppression (Délégation) - AVEC CHECK DE PERMISSION
        document.getElementById('observations-list').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                if (userPermissions.isStudent && !userPermissions.observations) return;
                deleteEntry(deleteBtn);
            }
        });
        document.getElementById('transmissions-list-ide').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                if (userPermissions.isStudent && !userPermissions.transmissions) return;
                deleteEntry(deleteBtn);
            }
        });
        document.getElementById('prescription-tbody').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                // MODIFIÉ : Utilisation de la permission granulaire
                if (userPermissions.isStudent && !userPermissions.prescriptions_delete) return;
                deletePrescription(deleteBtn);
            }
        });
        document.getElementById('care-diagram-tbody').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                if (userPermissions.isStudent && !userPermissions.diagramme) return;
                deleteCareDiagramRow(deleteBtn);
            }
        });

        // Pancarte
        document.getElementById('pancarte-tbody').addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT') updatePancarteChart();
        });

        // AutoResize
        document.querySelector('main').addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('info-value')) {
                autoResize(e.target);
            }
        });
        
        // Calcul de l'IMC
        document.getElementById('vie-poids').addEventListener('input', calculateAndDisplayIMC);
        document.getElementById('vie-taille').addEventListener('input', calculateAndDisplayIMC);

        // Listeners globaux (souris)
        document.addEventListener('mousemove', handleIVMouseMove);
        document.addEventListener('mouseup', handleIVMouseUp);

        // Tuto
        document.getElementById('tutorial-overlay').addEventListener('click', () => endTutorial(true));
        document.getElementById('tutorial-step-box').addEventListener('click', (e) => e.stopPropagation());
        document.getElementById('tutorial-skip-btn').addEventListener('click', () => endTutorial(true));
        document.getElementById('tutorial-next-btn').addEventListener('click', () => {
            currentStepIndex++;
            showTutorialStep(currentStepIndex);
        });

        // Listeners pour la modale "Charger Patient"
        document.getElementById('load-patient-close-btn').addEventListener('click', hideLoadPatientModal);
        document.getElementById('load-patient-cancel-btn').addEventListener('click', hideLoadPatientModal);

        // Listener délégué pour les boutons dans la liste
        document.getElementById('load-patient-list-container').addEventListener('click', async (e) => {
            // NOUVEAU : Bloqué pour les étudiants
            if (userPermissions.isStudent) return;

            const loadBtn = e.target.closest('.load-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (loadBtn) {
                const patientIdToLoadFrom = loadBtn.dataset.patientId; // 'save_...' ID
                const patientIdToLoadInto = activePatientId; // 'chambre_...' ID
                
                const patientToLoadFromName = loadBtn.closest('.flex').querySelector('.font-medium').textContent;
                const roomToLoadInto = patientIdToLoadInto.split('_')[1];

                const message = `Êtes-vous sûr de vouloir écraser le dossier de la chambre ${roomToLoadInto} avec les données de "${patientToLoadFromName}" ?`;

                showDeleteConfirmation(message, async () => {
                    try {
                        let headers = getAuthHeaders();
                        if (!headers) return;
                        delete headers['Content-Type'];
                        
                        const responseGet = await fetch(`${API_URL}/api/patients/${patientIdToLoadFrom}`, { headers: headers });
                        if (handleAuthError(responseGet)) return;
                        const dossierToLoad = await responseGet.json();

                        if (!dossierToLoad || Object.keys(dossierToLoad).length === 0) {
                            showCustomAlert("Erreur", "Le dossier que vous essayez de charger est vide.");
                            return;
                        }

                        const patientName = dossierToLoad.sidebar_patient_name;
                        
                        headers = getAuthHeaders();
                        if (!headers) return;

                        const responsePost = await fetch(`${API_URL}/api/patients/${patientIdToLoadInto}`, {
                            method: 'POST',
                            headers: headers, 
                            body: JSON.stringify({
                                dossierData: dossierToLoad, 
                                sidebar_patient_name: patientName || `Chambre ${roomToLoadInto}`
                            })
                        });
                        
                        if (handleAuthError(responsePost)) return;

                        hideLoadPatientModal();
                        await switchPatient(patientIdToLoadInto, true);
                        await initSidebar();
                        showCustomAlert("Chargement réussi", `Le dossier de "${patientName}" a été chargé dans la chambre ${roomToLoadInto}.`);

                    } catch (err) {
                        console.error("Erreur lors du chargement du dossier:", err);
                        showCustomAlert("Erreur", "Une erreur est survenue pendant le chargement.");
                        if (err.message.includes("Token non trouvé")) {
                            window.location.href = 'auth.html';
                        }
                    }
                });
            }

            if (deleteBtn) {
                const patientId = deleteBtn.dataset.patientId; // 'save_...' ID
                const patientName = deleteBtn.dataset.patientName;
                
                showDeleteConfirmation(`Êtes-vous sûr de vouloir supprimer la sauvegarde "${patientName}" ? Cette action est irréversible.`, async () => {
                    try {
                        const headers = getAuthHeaders();
                        if (!headers) return;
                        delete headers['Content-Type']; 

                        const response = await fetch(`${API_URL}/api/patients/${patientId}`, { 
                            method: 'DELETE',
                            headers: headers
                        });

                        if (handleAuthError(response)) return;
                        
                        await openLoadPatientModal(); 

                    } catch (err) {
                        console.error("Erreur lors de la suppression:", err);
                        showCustomAlert("Erreur", "Impossible de supprimer la sauvegarde.");
                        if (err.message.includes("Token non trouvé")) {
                            window.location.href = 'auth.html';
                        }
                    }
                });
            }
        });
    }

    // =================================================================
    // MODIFIÉ : initApp (pour charger les permissions)
    // =================================================================
    async function initApp() {
        // 1. Vérifie le token au démarrage
        const token = getAuthToken();
        if (!token) return; // Stoppe l'app si pas de token (getAuthToken a redirigé)

        // 2. Initialise les variables de la modale
        loadPatientModal = document.getElementById('load-patient-modal');
        loadPatientBox = document.getElementById('load-patient-box');
        loadPatientListContainer = document.getElementById('load-patient-list-container');
        
        // 3. NOUVEAU : Charger les permissions
        await loadUserPermissions();

        // 4. Initialiser l'UI
        initializeDynamicTables();
        await initSidebar(); 
        
        // 5. Mettre en place les écouteurs (qui dépendent maintenant de userPermissions)
        setupEventListeners();
        setupModalListeners();
        setupSync(); 

        // 6. Mettre en place l'auto-sauvegarde (qui dépend aussi de userPermissions)
        let saveTimeout;
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                // MODIFIÉ : Sauvegarde toujours (le serveur filtre), sauf si chargement
                if (!isLoadingData) { 
                    saveData(activePatientId);
                }
            }, 500); 
        };
        document.querySelector('main').addEventListener('input', debouncedSave);
        document.querySelector('main').addEventListener('change', debouncedSave);

        // 7. Charger le premier patient (ce qui appellera loadData -> addPrescription)
        await switchPatient(activePatientId, true); 

        // 8. NOUVEAU : Appliquer les permissions (maintenant que tout est chargé)
        // applyPermissions(); // Déplacé à la fin de switchPatient pour s'exécuter à chaque fois

        // 9. Gérer l'onglet actif
        const activeTabId = localStorage.getItem('activeTab') || 'administratif';
        const activeTabButton = document.querySelector(`nav button[data-tab-id="${activeTabId}"]`);
        if (activeTabButton) {
            changeTab({ currentTarget: activeTabButton }, activeTabId);
        } else {
            const firstButton = document.querySelector('#tabs-nav button');
            if (firstButton) {
                firstButton.click();
            }
        }

        // 10. Gérer le tutoriel (inchangé)
        if (!localStorage.getItem('tutorialCompleted')) {
            tutorialSteps[3] = {
                element: '#save-patient-btn',
                text: "Ce bouton crée une 'Sauvegarde' du dossier actuel (patient, ATCD, etc.) que vous pouvez recharger plus tard.",
                position: 'bottom-left'
            };
            tutorialSteps[4] = {
                element: '#load-patient-btn',
                text: "Utilisez ce bouton pour charger une sauvegarde dans la chambre actuelle.",
                position: 'bottom-left'
            };
             tutorialSteps[5] = {
                element: '#import-json-btn',
                text: "Ce bouton vous permet d'importer un fichier JSON (ancien système) dans la chambre actuelle.",
                position: 'bottom-left'
            };
            tutorialSteps[6] = {
                element: '#clear-current-patient-btn',
                text: "Attention : Ce bouton efface les données *visibles* du patient actuel (réinitialise la chambre localement).",
                position: 'bottom-left'
            };
            tutorialSteps[7] = {
                element: 'button[id="clear-all-data-btn"]', 
                text: "ATTENTION : Ce bouton réinitialise *localement* les 10 chambres du service. Les sauvegardes ne sont pas effacées.",
                position: 'top'
            };
            
            setTimeout(startTutorial, 500);
        }
    }

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
    function setupModalListeners() {
        document.getElementById('custom-confirm-ok').addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            hideConfirmation();
        });
        document.getElementById('custom-confirm-cancel').addEventListener('click', hideConfirmation);
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

    /**
     * Calcule et affiche l'IMC à partir des champs poids et taille
     */
    function calculateAndDisplayIMC() {
        const poidsEl = document.getElementById('vie-poids');
        const tailleEl = document.getElementById('vie-taille');
        const imcEl = document.getElementById('vie-imc');

        if (!poidsEl || !tailleEl || !imcEl) return;

        const poids = parseFloat(poidsEl.value.replace(',', '.'));
        const taille = parseFloat(tailleEl.value.replace(',', '.'));

        if (poids > 0 && taille > 0) {
            const tailleEnMetres = taille / 100;
            const imc = poids / (tailleEnMetres * tailleEnMetres);
            imcEl.value = imc.toFixed(1);
        } else {
            imcEl.value = '';
        }
        autoResize(imcEl);
    }

    function updateJourHosp() {
        const entryDateEl = document.getElementById('patient-entry-date');
        const jourHospEl = document.getElementById('patient-jour-hosp');
        if (!entryDateEl.value) {
            jourHospEl.textContent = 'J-';
            return;
        }
        const entryDate = new Date(entryDateEl.value);
        if (isNaN(entryDate.getTime())) {
            jourHospEl.textContent = 'J-';
            return;
        }
        const today = new Date();
        entryDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = today - entryDate;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        jourHospEl.textContent = `J${diffDays}`;
    }
    function setupSync() {
        const syncMap = [
            ['patient-nom-usage', 'admin-nom-usage'],
            ['patient-prenom', 'admin-prenom'],
            ['patient-dob', 'admin-dob']
        ];
        syncMap.forEach(([id1, id2]) => {
            const el1 = document.getElementById(id1);
            const el2 = document.getElementById(id2);
            if (el1 && el2) {
                el1.addEventListener('input', () => {
                    if (!el2.disabled) {
                        el2.value = el1.value;
                        if (el2.tagName.toLowerCase() === 'textarea') autoResize(el2);
                        if(id1.includes('dob')) updateAgeDisplay();
                    }
                });
                el2.addEventListener('input', () => {
                    if (!el1.disabled) {
                        el1.value = el2.value; 
                        if (el1.tagName.toLowerCase() === 'textarea') autoResize(el1);
                        if(id2.includes('dob')) updateAgeDisplay();
                    }
                });
            }
        });
    }
    function calculateAge(dobString) {
        if (!dobString) return '';
        const dob = new Date(dobString);
        const today = new Date();
        if (isNaN(dob.getTime()) || dob > today) return '';
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age >= 0 ? `${age} ans` : '';
    }
    function updateAgeDisplay() {
        const dobHeader = document.getElementById('patient-dob').value;
        document.getElementById('patient-age').textContent = calculateAge(dobHeader);
        const dobAdmin = document.getElementById('admin-dob').value;
        document.getElementById('admin-age').textContent = calculateAge(dobAdmin);
    }
    function deleteEntry(button) {
        const entry = button.closest('.timeline-item');
        if (entry) {
            showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer cette entrée ?", () => {
                entry.remove();
                saveData(activePatientId);
            });
        }
    }
    function deletePrescription(button) {
        const row = button.closest('tr');
        if (row) {
            showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer cette prescription ?", () => {
                row.remove();
                saveData(activePatientId);
            });
        }
    }

    function deleteCareDiagramRow(button) {
        const row = button.closest('tr');
        if (row) {
            showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer ce soin du diagramme ?", () => {
                row.remove();
                saveData(activePatientId);
            });
        }
    }

    function getDefaultForCareDiagramTbody() {
        return ``;
    }

    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    function toggleFullscreen() {
        const elem = document.documentElement;
        const icon = document.getElementById('fullscreen-icon');
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => console.log(err.message));
            icon.classList.replace('fa-expand', 'fa-compress');
        } else {
            document.exitFullscreen();
            icon.classList.replace('fa-compress', 'fa-expand');
        }
    }
    function updateDynamicDates(startDate) {
        const updateHeaders = (selector) => {
            document.querySelectorAll(selector).forEach((th, index) => {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + index);
                const day = String(currentDate.getDate()).padStart(2, '0');
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                th.innerHTML = `Jour ${index}<br><span class="text-xs font-normal">${day}/${month}</span>`;
            });
        };
        updateHeaders('#prescription-table thead tr:first-child th[colspan="8"]');
        updateHeaders('#pancarte-table thead tr:first-child th[colspan="3"]');
        updateHeaders('#care-diagram-table thead tr:first-child th[colspan="8"]');
        if (pancarteChartInstance) updatePancarteChart();
    }
    
    function toggleLock(containerId, buttonId, forceLock = false) {
        const container = document.getElementById(containerId);
        const button = document.getElementById(buttonId);
        
        const isCurrentlyLocked = button.classList.contains('is-locked');
        
        // MODIFIÉ : Simplification de la logique de forçage
        let shouldLock;
        if (forceLock) {
            shouldLock = true;
        } else {
            shouldLock = !isCurrentlyLocked;
        }
        
        const isUnlocking = !shouldLock;
        // ---

        const inputs = container.querySelectorAll('.info-value, input[type=text], input[type=date]');
        
        if (shouldLock && containerId === 'patient-header-form') { // Appliquer les dates au moment du verrouillage
            const entryDateValue = document.getElementById('patient-entry-date').value;
            if (entryDateValue) {
                const entryDate = new Date(entryDateValue);
                if (!isNaN(entryDate.getTime())) {
                    updateDynamicDates(entryDate);
                    updateJourHosp();
                }
            }
        }
        inputs.forEach(input => {
            if (input.id === 'vie-imc') {
                input.disabled = true;
            } else {
                input.disabled = shouldLock; // Verrouille si shouldLock=true
            }
            if (input.tagName.toLowerCase() === 'textarea' && isUnlocking) autoResize(input);
        });
        const colorMap = {
            'lock-header-btn': { unlocked: ['border-teal-600', 'text-teal-700', 'hover:bg-teal-600'], locked: ['border-gray-400', 'text-gray-500', 'hover:bg-gray-400'] },
            'lock-admin-btn': { unlocked: ['border-teal-600', 'text-teal-700', 'hover:bg-teal-600'], locked: ['border-gray-400', 'text-gray-500', 'hover:bg-gray-400'] },
            'lock-vie-btn': { unlocked: ['border-blue-600', 'text-blue-700', 'hover:bg-blue-600'], locked: ['border-gray-400', 'text-gray-500', 'hover:bg-gray-400'] }
        };
        const styles = colorMap[buttonId];
        const baseUnlockedText = (buttonId === 'lock-header-btn') ? "Valider" : "Valider les données";
        
        if (isUnlocking) {
            button.innerHTML = `<i class="fas fa-check mr-2"></i> ${baseUnlockedText}`;
            button.classList.remove(...styles.locked, 'is-locked');
            button.classList.add(...styles.unlocked);
        } else {
            button.innerHTML = `<i class="fas fa-lock mr-2"></i> Lock`;
            button.classList.remove(...styles.unlocked);
            button.classList.add(...styles.locked, 'is-locked');
        }
    }

    function changeTab(event, tabId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        const activeSection = document.getElementById(tabId);
        activeSection.classList.add('active');
        const baseClasses = "min-h-[4rem] py-2 px-2 text-sm font-medium rounded-lg border focus:outline-none transition-all ease-in-out duration-300 flex-1 flex items-center justify-center text-center";
        const inactiveClasses = "text-gray-600 bg-white border-gray-200 hover:bg-gray-100";
        const activeClasses = { blue: "text-blue-900 border-blue-300 bg-gradient-to-br from-blue-200 to-cyan-200 shadow-inner", teal: "text-teal-900 border-teal-300 bg-gradient-to-br from-teal-200 to-green-200 shadow-inner", rose: "text-rose-900 border-rose-300 bg-gradient-to-br from-rose-200 to-pink-200 shadow-inner", indigo: "text-indigo-900 border-indigo-300 bg-gradient-to-br from-indigo-200 to-violet-200 shadow-inner", green: "text-green-900 border-green-300 bg-gradient-to-br from-green-200 to-lime-200 shadow-inner", purple: "text-purple-900 border-purple-300 bg-gradient-to-br from-purple-200 to-pink-200 shadow-inner", orange: "text-orange-900 border-orange-300 bg-gradient-to-br from-amber-200 to-orange-200 shadow-inner"};
        document.querySelectorAll('nav[aria-label="Tabs"] button').forEach(tab => tab.className = `${baseClasses} ${inactiveClasses}`);
        
        const clickedTab = event.currentTarget ? event.currentTarget : document.querySelector(`nav button[data-tab-id="${tabId}"]`);
        
        const color = clickedTab.dataset.color;
        clickedTab.className = `${baseClasses} ${activeClasses[color]}`;
        document.querySelectorAll('.card-header').forEach(h => Object.keys(activeClasses).forEach(c => h.classList.remove(`header-${c}`)));
        document.getElementById(tabId).querySelectorAll('.card-header').forEach(h => h.classList.add(`header-${color}`));
        localStorage.setItem('activeTab', tabId);
        setTimeout(() => {
            activeSection.querySelectorAll('textarea.info-value').forEach(autoResize);
        }, 0);
        if (tabId === 'pancarte') setTimeout(() => updatePancarteChart(), 50);
    }
    
    function addObservation() {
        // NOUVEAU : Check
        if (userPermissions.isStudent && !userPermissions.observations) return;
        
        const author = document.getElementById('new-observation-author').value.trim();
        const text = document.getElementById('new-observation-text').value.trim();
        const dateValue = document.getElementById('new-observation-date').value;
        if (!text || !author) return;

        const eventDate = dateValue ? new Date(dateValue) : new Date();
        const formattedDate = new Date(eventDate.getTime() - (eventDate.getTimezoneOffset() * 60000)).toLocaleDateString('fr-FR');

        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-dot dot-rose"></div>
            <div class="flex justify-between items-start">
                <h3 class="font-semibold text-gray-800"></h3>
                <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer l'observation">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
            <p class="text-gray-600 preserve-whitespace"></p>
        `;
        
        item.querySelector('h3').textContent = `${formattedDate} - ${author.toUpperCase()}`;
        item.querySelector('p').textContent = text;
        
        document.getElementById('observations-list').prepend(item);
        document.getElementById('new-observation-form').reset();
    }
    
    function addTransmission() {
        // NOUVEAU : Check
        if (userPermissions.isStudent && !userPermissions.transmissions) return;
        
        const author = document.getElementById('new-transmission-author-2').value.trim();
        const text = document.getElementById('new-transmission-text-2').value.trim();
        const dateValue = document.getElementById('new-transmission-date').value;
        if (!text || !author) return;

        const eventDate = dateValue ? new Date(dateValue) : new Date();
        const formattedDate = new Date(eventDate.getTime() - (eventDate.getTimezoneOffset() * 60000)).toLocaleDateString('fr-FR');
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-dot dot-green"></div>
            <div class="flex justify-between items-start">
                <h3 class="font-semibold text-gray-800"></h3>
                <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer la transmission">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
            <p class="text-gray-600 preserve-whitespace"></p>
        `;

        item.querySelector('h3').textContent = `${formattedDate} - ${author.toUpperCase()}`;
        
        const safeTextNode = document.createTextNode(text);
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(safeTextNode);
        
        const formattedText = tempDiv.innerHTML
            .replace(/Cible :/g, '<strong class="text-gray-900">Cible :</strong>')
            .replace(/Données :/g, '<br><strong class="text-gray-900">Données :</strong>')
            .replace(/Actions :/g, '<br><strong class="text-gray-900">Actions :</strong>')
            .replace(/Résultat :/g, '<br><strong class="text-gray-900">Résultat :</strong>');

        item.querySelector('p').innerHTML = formattedText;
        
        document.getElementById('transmissions-list-ide').prepend(item);
        document.getElementById('new-transmission-form-2').reset();
    }

    // =================================================================
    // MODIFIÉ : addPrescription (vérification des permissions)
    // =================================================================
    function addPrescription(data = null, fromLoad = false) {
        // MODIFIÉ : Check (pour l'ajout manuel)
        if (!fromLoad && userPermissions.isStudent && !userPermissions.prescriptions_add) {
            return;
        }

        let name, posologie, voie, startDate, type, checkboxes, bars;
        if (fromLoad) {
            ({ name, posologie, voie, startDate, type, checkboxes, bars } = data);
        } else {
            name = document.getElementById('med-name').value.trim();
            posologie = document.getElementById('med-posologie').value.trim();
            voie = document.getElementById('med-voie').value.trim();
            const startDateValue = document.getElementById('med-start-date').value;
            if (!name || !startDateValue) return;
            const [year, month, day] = startDateValue.split('-');
            startDate = `${day}/${month}/${year.slice(2)}`;
            type = voie.trim().toUpperCase() === 'IV' ? 'iv' : 'checkbox';
        }
        const tbody = document.getElementById("prescription-tbody");
        const newRow = tbody.insertRow();
        newRow.dataset.type = type;

        const baseCellsHTML = `
            <td class="p-2 text-left align-top min-w-[220px]">
                <div class="flex items-start justify-between">
                    <span>${name}</span>
                    <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer la prescription">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            </td>
            <td class="p-2 text-left align-top min-w-[144px]">${posologie}</td>
            <td class="p-2 text-left align-top min-w-[96px]">${voie}</td>
            <td class="p-2 text-left align-top" style="min-width: 100px;">${startDate}</td>
        `;

        newRow.innerHTML = baseCellsHTML;
        const timelineCell = newRow.insertCell();
        timelineCell.colSpan = 88; 
        timelineCell.className = 'iv-bar-container';

        if (type !== 'iv') {
            timelineCell.classList.add('marker-container');
        }
        
        // MODIFIÉ : N'ajoute l'écouteur que si l'utilisateur a la permission de "valider"
        if (!userPermissions.isStudent || userPermissions.prescriptions_validate) {
            timelineCell.addEventListener('mousedown', handleIVMouseDown);
        }
        
        const barsToCreate = [];
        if (fromLoad && bars && Array.isArray(bars)) {
            barsToCreate.push(...bars);
        } else if (fromLoad && data.left && data.width) { 
            barsToCreate.push({ left: data.left, width: data.width, title: data.title });
        }
        
        barsToCreate.forEach(barData => {
            if (barData && barData.left && (barData.width || barData.width === 0)) { // Accepte width 0 pour les marqueurs
                const bar = document.createElement('div');
                bar.className = 'iv-bar';
                
                if (type !== 'iv') {
                    bar.classList.add('marker-bar');
                }
                
                bar.style.left = barData.left;
                bar.style.width = barData.width;
                bar.title = barData.title || '';
                bar.dataset.barId = `bar-${Date.now() + Math.random()}`;

                bar.addEventListener('dblclick', handleIVDblClick);
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                bar.appendChild(handle);
                timelineCell.appendChild(bar);
                setTimeout(() => updateIVBarDetails(bar, timelineCell), 0);
            }
        });
        
        if (!fromLoad) {
            document.getElementById('new-prescription-form').reset();
        }
    }
    // =================================================================
    // FIN DE LA MODIFICATION
    // =================================================================
    
    function addCareDiagramRow() {
        // NOUVEAU : Check
        if (userPermissions.isStudent && !userPermissions.diagramme) return;

        const name = document.getElementById('care-name').value.trim();
        if (!name) return;
        const newRow = document.getElementById('care-diagram-tbody').insertRow();
        
        let cellsHTML = `
            <td class="p-2 text-left align-top">
                <div class="flex items-start justify-between">
                    <span>${name}</span>
                    <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer ce soin">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            </td>
        `;
        
        for(let i=0; i<11; i++) {
            for (let j = 0; j < 8; j++) {
                const borderClass = (j === 0) ? 'border-l' : '';
                cellsHTML += `<td class="${borderClass} p-0 small-col"><input type="checkbox"></td>`;
            }
        }
        
        newRow.innerHTML = cellsHTML;
        document.getElementById('new-care-form').reset();
    }

    function handleIVDblClick(e) {
        // MODIFIÉ : Check de la permission 'validate' (car c'est une modification de barre)
        if (userPermissions.isStudent && !userPermissions.prescriptions_validate) return;

        const bar = e.currentTarget;
        showDeleteConfirmation("Effacer cette barre de perfusion IV ?", () => {
            
            const cell = bar.parentElement;
            if(cell) {
                const barId = bar.dataset.barId;
                if (barId) {
                    cell.querySelectorAll(`.iv-time-label[data-bar-id="${barId}"]`).forEach(label => label.remove());
                }
            }

            bar.remove();
            saveData(activePatientId);
        });
    }

    function handleIVMouseDown(e) {
        // La permission 'prescriptions_validate' est déjà vérifiée avant que l'listener ne soit attaché
        
        if (e.target.classList.contains('iv-bar-container')) {
            ivInteraction.mode = 'draw';
            const cell = e.target;
            const rect = cell.getBoundingClientRect();
            
            const totalIntervals = 11 * 24 * 4;
            const intervalWidthPx = rect.width / totalIntervals;
            const rawStartXPx = e.clientX - rect.left;
            
            const snappedInterval = Math.round(rawStartXPx / intervalWidthPx);
            const startX = snappedInterval * intervalWidthPx;

            const newBar = document.createElement('div');
            newBar.className = 'iv-bar';
            
            if (cell.classList.contains('marker-container')) {
                newBar.classList.add('marker-bar');
            }
            
            newBar.style.left = `${(startX / rect.width) * 100}%`;
            newBar.style.width = '0px';
            newBar.dataset.barId = `bar-${Date.now()}`; 

            newBar.addEventListener('dblclick', handleIVDblClick);
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            newBar.appendChild(handle);
            cell.appendChild(newBar);
            
            ivInteraction = {
                ...ivInteraction,
                active: true,
                targetBar: newBar,
                targetCell: cell,
                startX: e.clientX,
                startLeftPx: startX,
            };
            document.body.classList.add('is-drawing-iv');
        
        } else if (e.target.classList.contains('resize-handle')) {
            
            const bar = e.target.parentElement;
            if (bar.classList.contains('marker-bar')) {
                return;
            }

            ivInteraction.mode = 'resize';
            const cell = bar.parentElement;
            ivInteraction = {
                ...ivInteraction,
                active: true,
                targetBar: bar,
                targetCell: cell,
                startX: e.clientX,
                startWidth: bar.offsetWidth,
            };
            document.body.classList.add('is-resizing-iv');
        } else if (e.target.classList.contains('iv-bar')) {
            ivInteraction.mode = 'move';
            const bar = e.target;
            const cell = bar.parentElement;
            ivInteraction = {
                ...ivInteraction,
                active: true,
                targetBar: bar,
                targetCell: cell,
                startX: e.clientX,
                startLeft: bar.offsetLeft,
            };
            document.body.classList.add('is-moving-iv');
        }
    }

    function handleIVMouseMove(e) {
        if (!ivInteraction.active) return;
        e.preventDefault();
        const { mode, targetBar, targetCell, startX, startWidth, startLeft, startLeftPx } = ivInteraction;
        const cellRect = targetCell.getBoundingClientRect();
        const dx = e.clientX - startX;

        const totalIntervals = 11 * 24 * 4;
        const intervalWidthPx = cellRect.width / totalIntervals;

        if (mode === 'draw' || mode === 'resize') {

            if (mode === 'draw' && targetCell.classList.contains('marker-container')) {
                
                let rawLeftPx = startLeftPx + dx;
                const snappedInterval = Math.round(rawLeftPx / intervalWidthPx);
                let newLeft = snappedInterval * intervalWidthPx;
                
                newLeft = Math.max(0, newLeft);
                newLeft = Math.min(newLeft, cellRect.width - targetBar.offsetWidth); 
                targetBar.style.left = `${(newLeft / cellRect.width) * 100}%`;
            
            } else { 
                let rawWidthPx = startWidth + dx;
                
                const snappedIntervals = Math.max(1, Math.round(rawWidthPx / intervalWidthPx));
                let newWidth = snappedIntervals * intervalWidthPx;

                newWidth = Math.min(newWidth, cellRect.width - targetBar.offsetLeft);
                targetBar.style.width = `${(newWidth / cellRect.width) * 100}%`;
            }

        } else if (mode === 'move') {
            let rawLeftPx = startLeft + dx;

            const snappedInterval = Math.round(rawLeftPx / intervalWidthPx);
            let newLeft = snappedInterval * intervalWidthPx;
            
            newLeft = Math.max(0, newLeft);
            newLeft = Math.min(newLeft, cellRect.width - targetBar.offsetWidth);
            targetBar.style.left = `${(newLeft / cellRect.width) * 100}%`;
        }
        updateIVBarDetails(targetBar, targetCell);
    }

    function handleIVMouseUp(e) {
        if (!ivInteraction.active) return;

        const { targetBar, targetCell } = ivInteraction;
        if (targetBar && targetCell) {
            const cellRect = targetCell.getBoundingClientRect();
            const totalIntervals = 11 * 24 * 4;
            const intervalWidthPx = cellRect.width / totalIntervals;

            const rawLeftPx = targetBar.offsetLeft;
            const snappedLeftInterval = Math.round(rawLeftPx / intervalWidthPx);
            let finalLeftPx = snappedLeftInterval * intervalWidthPx;
            
            let finalWidthPx;
            
            if (targetCell.classList.contains('marker-container')) {
                finalWidthPx = 0; // Largeur de 0px pour le triangle
            } else {
                const rawWidthPx = targetBar.offsetWidth;
                const snappedWidthIntervals = Math.max(1, Math.round(rawWidthPx / intervalWidthPx));
                finalWidthPx = snappedWidthIntervals * intervalWidthPx;
            }

            finalLeftPx = Math.max(0, finalLeftPx);
            finalLeftPx = Math.min(finalLeftPx, cellRect.width - finalWidthPx); 
            
            targetBar.style.left = `${(finalLeftPx / cellRect.width) * 100}%`;
            targetBar.style.width = `${(finalWidthPx / cellRect.width) * 100}%`;

            updateIVBarDetails(targetBar, targetCell);
        }

        document.body.className = document.body.className.replace(/is-(drawing|resizing|moving)-iv/g, '').trim().trim();
        ivInteraction = { active: false, mode: null, targetBar: null, targetCell: null, startX: 0, startLeft: 0, startWidth: 0, startLeftPx: 0 };
        saveData(activePatientId);
    }

    // =================================================================
    // MODIFIÉ : updateIVBarDetails (Offset supprimé)
    // =================================================================
    function updateIVBarDetails(bar, cell) {
        if (!bar || !cell) return;
        const tableStartDateStr = document.getElementById('patient-entry-date').value;
        if (!tableStartDateStr) return;
        
        const barId = bar.dataset.barId;
        if (!barId) return; 

        const tableStartDate = new Date(tableStartDateStr);
        const totalTimelineMillis = 11 * 24 * 60 * 60 * 1000;
        
        // --- MODIFICATION : Suppression de l'offset de 3.5h ---
        const timelineStartTime = tableStartDate.getTime();
        // --- FIN MODIFICATION ---

        const startPercent = parseFloat(bar.style.left);
        const widthPercent = parseFloat(bar.style.width);
        const endPercent = startPercent + widthPercent;
        
        const startOffsetMillis = (startPercent / 100) * totalTimelineMillis;
        const durationMillis = (widthPercent / 100) * totalTimelineMillis;
        
        const rawStartDateTime = new Date(timelineStartTime + startOffsetMillis);
        const rawEndDateTime = new Date(rawStartDateTime.getTime() + durationMillis);

        const startDateTime = roundDateTo15Min(rawStartDateTime);
        const endDateTime = roundDateTo15Min(rawEndDateTime);

        const formatTime = (date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
        
        if (cell.classList.contains('marker-container')) {
            bar.title = `Prise: ${startDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}`;
        } else {
            bar.title = `Début: ${startDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}\nFin: ${endDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}`;
        }
        
        let startLabel = cell.querySelector(`.iv-time-label.start[data-bar-id="${barId}"]`);
        if (!startLabel) {
            startLabel = document.createElement('span');
            startLabel.className = 'iv-time-label start';
            startLabel.dataset.barId = barId; 
            cell.appendChild(startLabel); 
        }
        let endLabel = cell.querySelector(`.iv-time-label.end[data-bar-id="${barId}"]`);
        if (!endLabel) {
            endLabel = document.createElement('span');
            endLabel.className = 'iv-time-label end';
            endLabel.dataset.barId = barId; 
            cell.appendChild(endLabel); 
        }
        
        startLabel.textContent = formatTime(startDateTime);
        endLabel.textContent = formatTime(endDateTime);

        startLabel.style.left = `${startPercent}%`;
        startLabel.style.top = '2px';
        startLabel.style.right = 'auto';
        startLabel.style.bottom = 'auto';
        startLabel.style.transform = 'translateX(-100%) translateX(-4px)'; 

        endLabel.style.left = `${endPercent}%`;
        endLabel.style.bottom = '2px';
        endLabel.style.right = 'auto';
        endLabel.style.top = 'auto';
        endLabel.style.transform = 'translateX(4px)';
    }
    
    function updatePancarteChart() {
        const table = document.getElementById('pancarte-table');
        const entryDateVal = document.getElementById('patient-entry-date').value;
        const startDate = entryDateVal ? new Date(entryDateVal) : new Date();
        const labels = Array.from({ length: 33 }).map((_, i) => {
            const dayOffset = Math.floor(i / 3);
            const timeOfDay = ['Matin', 'Soir', 'Nuit'][i % 3];
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + dayOffset);
            return `${currentDate.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'})} ${timeOfDay}`;
        });
        const dataSetsConfig = { 'Pouls (/min)': { yAxisID: 'y1', borderColor: '#ef4444' }, 'Tension (mmHg)': { type: 'bar', yAxisID: 'y', backgroundColor: '#f9731640' }, 'Température (°C)': { yAxisID: 'y3', borderColor: '#3b82f6' }, 'SpO2 (%)': { yAxisID: 'y4', borderColor: '#10b981' }, 'Douleur (EVA /10)': { yAxisID: 'y2', borderColor: '#8b5cf6' }};
        const datasets = Array.from(table.querySelectorAll('tbody tr')).map(row => {
            const paramName = row.cells[0].textContent.trim();
            let data = Array.from(row.querySelectorAll('input')).map(input => {
                if (paramName === 'Tension (mmHg)' && input.value.includes('/')) {
                    const parts = input.value.split('/');
                    return [parseFloat(parts[1]), parseFloat(parts[0])];
                }
                const value = parseFloat(input.value.replace(',', '.'));
                return isNaN(value) ? null : value;
            }); 
            return { label: paramName, data, type: 'line', tension: 0.2, borderWidth: 2, spanGaps: true, pointBackgroundColor: dataSetsConfig[paramName].borderColor, ...dataSetsConfig[paramName] };
        });
        const ctx = document.getElementById('pancarteChart').getContext('2d');
        if (pancarteChartInstance) pancarteChartInstance.destroy();
        pancarteChartInstance = new Chart(ctx, {
            type: 'bar', data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { position: 'left', title: { display: true, text: 'Tension (mmHg)' }, min: 0, max: 200 },
                    y1: { position: 'right', title: { display: true, text: 'Pouls' }, grid: { drawOnChartArea: false }, min: 0, max: 200 },
                    y2: { position: 'right', title: { display: true, text: 'Douleur' }, grid: { drawOnChartArea: false }, max: 10, min: 0 },
                    y3: { position: 'right', title: { display: true, text: 'Température' }, grid: { drawOnChartArea: false }, min: 36, max: 41, ticks: { stepSize: 0.5 } },
                    y4: { position: 'right', title: { display: true, text: 'SpO2' }, grid: { drawOnChartArea: false }, min: 50, max: 100 }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: ctx => ctx.dataset.label === 'Tension (mmHg)' && ctx.raw?.length === 2 ? `${ctx.dataset.label}: ${ctx.raw[1]}/${ctx.raw[0]}` : `${ctx.dataset.label}: ${ctx.formattedValue}` }}
                }
            }
        });
    }

    // --- Section Tutoriel (modifiée) ---
    const tutorialSteps = [
        {
            element: '#patient-list li:first-child button',
            text: "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier. (Vous pouvez remplir le dossier pour voir un nom ici).",
            position: 'right'
        },
        {
            element: '#patient-header-form',
            text: "Cet en-tête contient les informations principales du patient. Remplissez-le et cliquez sur 'Valider' pour verrouiller les champs et définir la date d'entrée.",
            position: 'bottom'
        },
        {
            element: '#tabs-nav-container',
            text: "Utilisez ces onglets pour naviguer entre les différentes sections du dossier : Administratif, Prescriptions, Transmissions, etc.",
            position: 'bottom'
        },
        {
            element: '#save-patient-btn',
            text: "Ce bouton crée une 'Sauvegarde' du dossier actuel (patient, ATCD, etc.) que vous pouvez recharger plus tard.",
            position: 'bottom-left'
        },
        {
            element: '#load-patient-btn',
            text: "Utilisez ce bouton pour charger une sauvegarde dans la chambre actuelle.",
            position: 'bottom-left'
        },
        {
            element: '#import-json-btn',
            text: "Ce bouton vous permet d'importer un fichier JSON (ancien système) dans la chambre actuelle.",
            position: 'bottom-left'
        },
        // MODIFIÉ : Texte du tutoriel
        {
            element: '#clear-current-patient-btn',
            text: "Ce bouton efface les données de la chambre actuelle et la réinitialise sur le serveur.",
            position: 'bottom-left'
        },
        // MODIFIÉ : Texte du tutoriel
        {
            element: 'button[id="clear-all-data-btn"]', 
            text: "Ce bouton réinitialise les 10 chambres du service. Les sauvegardes ne sont pas effacées.",
            position: 'top'
        },
        {
            element: 'button[id="start-tutorial-btn"]', 
            text: "Vous avez terminé ! Vous pouvez relancer ce tutoriel à tout moment en cliquant sur ce bouton.",
            position: 'top'
        }
    ];

    let currentStepIndex = 0;
    let highlightedElement = null;

    function startTutorial() {
        currentStepIndex = 0;
        document.getElementById('tutorial-overlay').classList.remove('hidden');
        showTutorialStep(currentStepIndex);
    }

    function endTutorial(setFlag = false) {
        document.getElementById('tutorial-overlay').classList.add('hidden');
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
            if (highlightedElement.closest('#header-buttons')) {
                highlightedElement.style = '';
            }
            highlightedElement = null;
        }
        if (setFlag) {
            localStorage.setItem('tutorialCompleted', 'true');
        }
    }

    function showTutorialStep(index) {
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
            if (highlightedElement.closest('#header-buttons')) {
                highlightedElement.style = '';
            }
        }

        if (index >= tutorialSteps.length) {
            endTutorial(true);
            return;
        }

        const step = tutorialSteps[index];
        const element = document.querySelector(step.element);
        const stepBox = document.getElementById('tutorial-step-box');
        const stepText = document.getElementById('tutorial-text');
        const nextButton = document.getElementById('tutorial-next-btn');

        if (!element) {
            if (index === 0) {
                tutorialSteps[0].element = '#sidebar';
                tutorialSteps[0].text = "Bienvenue ! Voici la barre latérale où les patients apparaîtront. Pour l'instant, elle est vide. Vous pouvez commencer par remplir les dossiers.";
                showTutorialStep(index);
            } else {
                currentStepIndex++;
                showTutorialStep(currentStepIndex);
            }
            return;
        }

        stepText.textContent = step.text;

        if (index === tutorialSteps.length - 1) {
            nextButton.textContent = "Terminer";
        } else {
            nextButton.textContent = "Suivant";
        }
        
        element.classList.add('tutorial-highlight');
        highlightedElement = element;

        if (element.closest('#header-buttons')) {
            element.style.setProperty('z-index', '9997', 'important');
            element.style.setProperty('position', 'relative', 'important');
        }

        const rect = element.getBoundingClientRect();
        const boxRect = stepBox.getBoundingClientRect();
        const margin = 15;

        let top = rect.bottom + margin;
        let left = rect.left + (rect.width / 2) - (boxRect.width / 2);

        if (step.position === 'right') {
            top = rect.top + (rect.height / 2) - (boxRect.height / 2);
            left = rect.right + margin;
        } else if (step.position === 'left') {
            top = rect.top + (rect.height / 2) - (boxRect.height / 2);
            left = rect.left - boxRect.width - margin;
        } else if (step.position === 'top') {
            top = rect.top - boxRect.height - margin;
            left = rect.left + (rect.width / 2) - (boxRect.width / 2);
        } else if (step.position === 'bottom-left') {
            top = rect.bottom + margin;
            left = rect.right - boxRect.width;
        }

        if (top < margin) top = margin;
        if (left < margin) left = margin;
        if (top + boxRect.height > window.innerHeight - margin) {
            top = window.innerHeight - boxRect.height - margin;
            if (step.position === 'top') top = rect.bottom + margin;
        }
        if (left + boxRect.width > window.innerWidth - margin) {
            left = window.innerWidth - boxRect.width - margin;
        }

        stepBox.style.top = `${top}px`;
        stepBox.style.left = `${left}px`;
    }
    
    // Point d'entrée principal de l'application
    initApp(); 

})(); // Fin de l'IIFE