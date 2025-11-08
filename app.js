// app.js (Modifié)
// Enveloppe de l'IIFE pour encapsuler le code et éviter la pollution globale
(function() {
    "use strict"; 

    // MODIFIÉ : L'URL de l'API est maintenant relative.
    // "http://localhost:3000" a été supprimé.
    const API_URL = 'https://eidos-api.onrender.com'; 

    // --- Gestion des permissions ---
    let userPermissions = { 
        isStudent: false,
        subscription: 'free', 
        allowedRooms: [] 
        // ... (permissions)
    };
    
    // --- Fonctions Utilitaires pour les Dates Relatives ---

    /**
     * Calcule la différence en jours entre deux dates.
     * @param {string} entryDateStr - La date d'entrée (ex: '2025-11-08')
     * @param {string} eventDateStr - La date de l'événement (ex: '2025-11-10')
     * @returns {number} Le nombre de jours de décalage (ex: 2)
     */
    function _calculateDaysOffset(entryDateStr, eventDateStr) {
        if (!entryDateStr || !eventDateStr) {
            return 0;
        }
        try {
            // Utilise UTC pour éviter les problèmes de fuseau horaire et de DST
            const entryDate = new Date(entryDateStr + 'T00:00:00Z');
            const eventDate = new Date(eventDateStr + 'T00:00:00Z');
            
            const diffTime = eventDate.getTime() - entryDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays;
        } catch (e) {
            console.error("Erreur de calcul d'offset de date:", e);
            return 0;
        }
    }

    /**
     * Calcule une date absolue à partir d'une date d'entrée et d'un décalage en jours.
     * @param {string} entryDateStr - La date d'entrée (ex: '2025-11-08')
     * @param {number} offsetDays - Le décalage (ex: 2)
     * @returns {Date} La nouvelle date absolue (ex: Date object for 2025-11-10)
     */
    function _calculateDateFromOffset(entryDateStr, offsetDays) {
        if (!entryDateStr) {
            // Retourne la date d'aujourd'hui si pas de date d'entrée
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        }
        
        try {
            // Ne pas utiliser UTC ici, sinon on peut avoir un décalage d'un jour
            // On se base sur la date locale de l'ordinateur
            const entryDate = new Date(entryDateStr + 'T00:00:00'); 
            
            // Crée une nouvelle date
            const targetDate = new Date(entryDate.getTime());
            // setDate gère correctement les changements de mois/année
            targetDate.setDate(entryDate.getDate() + parseInt(offsetDays, 10));
            
            return targetDate;
        } catch (e) {
            console.error("Erreur de calcul de date depuis offset:", e);
            return new Date();
        }
    }

    /**
     * Formate un objet Date en "JJ/MM/AAAA".
     * @param {Date} date - L'objet Date à formater.
     * @returns {string} La date formatée.
     */
    function _formatDate(date) {
        if (!date || isNaN(date.getTime())) {
            return "??/??/????";
        }
         // Utilise 'fr-CA' pour le format YYYY-MM-DD (pour les inputs)
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    /**
     * Formate un objet Date en "YYYY-MM-DD" pour les inputs <input type="date">.
     * @param {Date} date - L'objet Date à formater.
     * @returns {string} La date formatée.
     */
    function _formatDateForInput(date) {
        if (!date || isNaN(date.getTime())) {
            return "";
        }
        // Crée une date qui n'est pas affectée par le fuseau horaire
        const adjustedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return adjustedDate.toISOString().split('T')[0];
    }

    // --- Fin des fonctions utilitaires de date ---
    

    // --- Fonction utilitaire pour l'authentification ---
    
    function getAuthToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error("Aucun token trouvé, redirection vers login.");
            window.location.href = 'auth.html'; 
            return null;
        }
        return token;
    }

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

    function handleAuthError(response) {
        if (response.status === 401) {
            console.error("Token invalide ou expiré, redirection vers login.");
            localStorage.removeItem('authToken');
            window.location.href = 'auth.html'; 
            return true;
        }
        return false;
    }
    // -----------------------------------------------------------

    async function loadUserPermissions() {
        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type'];

            // MODIFIÉ : Utilise API_URL
            const response = await fetch(`${API_URL}/api/auth/me`, { headers });

            if (handleAuthError(response)) return;
            if (!response.ok) {
                throw new Error("Impossible de récupérer les informations utilisateur.");
            }

            const userData = await response.json();
            
            userPermissions.subscription = userData.subscription || 'free';
            userPermissions.allowedRooms = userData.allowedRooms || []; 

            if (userData.role === 'etudiant' && userData.permissions) {
                userPermissions = {
                    ...userPermissions, 
                    ...userData.permissions,
                    isStudent: true
                };
                
                if (userPermissions.allowedRooms.length > 0) {
                    patients = userPermissions.allowedRooms
                        .map(roomId => ({ id: roomId, room: roomId.split('_')[1] }))
                        .sort((a, b) => a.room.localeCompare(b.room)); 
                } else {
                    patients = []; 
                }
                
                console.log(`Compte étudiant chargé (Plan: ${userPermissions.subscription}). ${patients.length} chambres autorisées.`);
            } else {
                patients = [...defaultPatients]; 
                userPermissions = { 
                    ...userPermissions, 
                    isStudent: false 
                };
                console.log(`Compte formateur chargé (Plan: ${userPermissions.subscription}). Tous droits activés.`);
            }
        } catch (err) {
            console.error(err);
            userPermissions = { isStudent: false, subscription: 'free', allowedRooms: [] };
            patients = [...defaultPatients]; 
            showCustomAlert("Erreur de permissions", "Impossible de vérifier les permissions du compte. Les droits par défaut sont appliqués.");
        }
    }

    function disableSectionInputs(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const inputs = container.querySelectorAll('.info-value, input[type=text], input[type=date]');
        inputs.forEach(input => {
            if (input.id !== 'vie-imc') { 
                input.disabled = true;
            }
        });
    }

    function applyPermissions() {
        
        if (userPermissions.subscription === 'free' && !userPermissions.isStudent) {
            const saveBtn = document.getElementById('save-patient-btn');
            if (saveBtn) saveBtn.style.display = 'none';
        }

        if (!userPermissions.isStudent) return;

        const studentForbiddenButtons = [
            '#save-patient-btn',
            '#load-patient-btn',
            '#import-json-btn',
            '#export-json-btn', 
            '#clear-current-patient-btn',
            '#clear-all-data-btn',
            '#account-management-btn'
        ];
        studentForbiddenButtons.forEach(selector => {
            const btn = document.querySelector(selector);
            if (btn) btn.style.display = 'none';
        });

        if (!userPermissions.header) {
            disableSectionInputs('patient-header-form'); 
        }
        if (!userPermissions.admin) {
            disableSectionInputs('administratif'); 
        }
        if (!userPermissions.vie) {
            disableSectionInputs('mode-de-vie'); 
        }
        if (!userPermissions.observations) {
            const form = document.getElementById('new-observation-form');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.transmissions) {
            const form = document.getElementById('new-transmission-form-2');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.prescriptions_add) {
            const form = document.getElementById('new-prescription-form');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.diagramme) {
            const form = document.getElementById('new-care-form');
            if (form) form.style.display = 'none';
        }
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

    let isLoadingData = false;
    let pancarteChartInstance;
    
    const defaultPatients = Array.from({ length: 10 }, (_, i) => ({
        id: `chambre_${101 + i}`,
        room: `${101 + i}`
    }));
    let patients = [...defaultPatients]; 
    
    let activePatientId = localStorage.getItem('activePatientId'); 


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

    function roundDateTo15Min(date) {
        const newDate = new Date(date.getTime()); 
        const minutes = newDate.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        newDate.setMinutes(roundedMinutes); 
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
        return newDate;
    }

    async function saveData(patientId) {
        if (userPermissions.subscription === 'free') {
            console.log("Plan 'Free' : Sauvegarde automatique désactivée.");
            return;
        }
        if (!patientId || !patientId.startsWith('chambre_')) {
            console.warn('La sauvegarde automatique ne concerne que les chambres.');
            return;
        }

        const state = {};
        const entryDateStr = document.getElementById('patient-entry-date').value;

        // 1. Collecte des inputs simples
        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') { state[id] = el.checked; } else { state[id] = el.value; }
        });

        // 2. Collecte des Observations (en tant que data)
        state.observations = [];
        document.querySelectorAll('#observations-list .timeline-item').forEach(item => {
            state.observations.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });

        // 3. Collecte des Transmissions (en tant que data)
        state.transmissions = [];
        document.querySelectorAll('#transmissions-list-ide .timeline-item').forEach(item => {
            state.transmissions.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });

        // 4. Collecte du Diagramme de Soins (HTML + Checkboxes)
        const careDiagramTbody = document.getElementById('care-diagram-tbody');
        if (careDiagramTbody) state['care-diagram-tbody_html'] = careDiagramTbody.innerHTML;
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);

        
        // 5. Collecte de la Biologie (avec offsets)
        const bioData = { dateOffsets: [], analyses: {} };
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            const offset = _calculateDaysOffset(entryDateStr, input.value);
            bioData.dateOffsets.push(offset);
            input.dataset.dateOffset = offset;
        });
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
        
        // 6. Collecte Pancarte (inchangé)
        const pancarteData = {};
        document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
            const paramName = row.cells[0].textContent.trim();
            if (paramName) {
                pancarteData[paramName] = [];
                row.querySelectorAll('input').forEach(input => pancarteData[paramName].push(input.value));
            }
        });
        state.pancarte = pancarteData;
        
        // 7. Collecte Prescriptions (avec offsets)
        state.prescriptions = [];
        document.querySelectorAll('#prescription-tbody tr').forEach(row => {
            state.prescriptions.push({
                name: row.cells[0].querySelector('span').textContent,
                posologie: row.cells[1].textContent,
                voie: row.cells[2].textContent,
                dateOffset: parseInt(row.dataset.dateOffset, 10) || 0,
                type: row.dataset.type,
                bars: Array.from(row.querySelectorAll('.iv-bar')).map(bar => ({ 
                    left: bar.style.left, 
                    width: bar.style.width, 
                    title: bar.title 
                }))
            });
        });
        
        // 8. Nom du patient (inchangé)
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        const patientName = `${nomUsage} ${prenom}`.trim();
        state['sidebar_patient_name'] = patientName;
        // ... (Fin de la collecte de 'state') ...
        
        try {
            const headers = getAuthHeaders(); 
            if (!headers) return;

            // MODIFIÉ : Utilise API_URL
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
        
        const sidebarEntry = document.querySelector(`#patient-list button[data-patient-id="${patientId}"] .patient-name`);
        if (sidebarEntry) {
            sidebarEntry.textContent = patientName || `Chambre ${patientId.split('_')[1]}`;
        }
    }

    async function loadData(patientId) {
        if (!patientId) return;
        
        isLoadingData = true;
        
        let state;

        if (userPermissions.subscription === 'free') {
            console.log("Plan 'Free' : Chargement d'un dossier vide.");
            state = {};
        } else {
            try {
                const headers = getAuthHeaders();
                if (!headers) return;
                delete headers['Content-Type'];

                // MODIFIÉ : Utilise API_URL
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
        }


        if (!state || Object.keys(state).length === 0) {
            resetForm();
        } else {
            // Logique de remplissage
            
            // 1. Remplir les inputs simples (inchangé)
            Object.keys(state).forEach(id => {
                if (id === 'observations' || id === 'transmissions' || id === 'biologie' || id === 'pancarte' || id === 'prescriptions' || id ==='lockButtonStates' || id === 'careDiagramCheckboxes' || id.endsWith('_html')) return;
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = state[id]; } else { el.value = state[id]; }
                }
            });
            
            const entryDateStr = document.getElementById('patient-entry-date').value;

            // 2. Charger les Observations (avec rétro-compatibilité)
            const obsList = document.getElementById('observations-list');
            obsList.innerHTML = ''; 
            if (state.observations) {
                state.observations.forEach(obsData => {
                    let dateOffset = obsData.dateOffset;
                    let formattedDate;

                    if (dateOffset === undefined && obsData.date) { // === Ancien format JSON ===
                        dateOffset = _calculateDaysOffset(entryDateStr, obsData.date);
                        formattedDate = _formatDate(new Date(obsData.date + 'T00:00:00'));
                    } else { // === Nouveau format ===
                        const targetDate = _calculateDateFromOffset(entryDateStr, dateOffset);
                        formattedDate = _formatDate(targetDate);
                    }
                    
                    addObservation({ ...obsData, dateOffset: dateOffset, formattedDate: formattedDate }, true);
                });
            }

            // 3. Charger les Transmissions (avec rétro-compatibilité)
            const transList = document.getElementById('transmissions-list-ide');
            transList.innerHTML = ''; 
            if (state.transmissions) {
                state.transmissions.forEach(transData => {
                    let dateOffset = transData.dateOffset;
                    let formattedDate;

                    if (dateOffset === undefined && transData.date) { // === Ancien format JSON ===
                        dateOffset = _calculateDaysOffset(entryDateStr, transData.date);
                        formattedDate = _formatDate(new Date(transData.date + 'T00:00:00'));
                    } else { // === Nouveau format ===
                        const targetDate = _calculateDateFromOffset(entryDateStr, dateOffset);
                        formattedDate = _formatDate(targetDate);
                    }
                    
                    addTransmission({ ...transData, dateOffset: dateOffset, formattedDate: formattedDate }, true);
                });
            }

            // 4. Charger le Diagramme de Soins (inchangé)
            const careDiagramTbody = document.getElementById('care-diagram-tbody');
            if (careDiagramTbody && state['care-diagram-tbody_html']) {
                careDiagramTbody.innerHTML = state['care-diagram-tbody_html'];
            } else if (careDiagramTbody) {
                careDiagramTbody.innerHTML = getDefaultForCareDiagramTbody();
            }
            if (state.careDiagramCheckboxes) {
                document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]').forEach((cb, index) => {
                    if (state.careDiagramCheckboxes[index] !== undefined) {
                        cb.checked = state.careDiagramCheckboxes[index];
                    }
                });
            }
            
            // 5. Charger les Prescriptions (avec rétro-compatibilité)
            const prescrTbody = document.getElementById('prescription-tbody');
            prescrTbody.innerHTML = ''; 
            if (state.prescriptions) {
                state.prescriptions.forEach(pData => {
                    let dateOffset = pData.dateOffset;

                    if (dateOffset === undefined && pData.startDate) { // === Ancien format JSON ===
                        // L'ancien format était YYYY-MM-DD ou JJ/MM/AA, _calculateDaysOffset gère les deux
                        let oldStartDate = pData.startDate;
                        if (oldStartDate.includes('/')) { // Convertir JJ/MM/AAAA en YYYY-MM-DD
                             const parts = oldStartDate.split('/');
                             if (parts.length === 3) {
                                 oldStartDate = `20${parts[2]}-${parts[1]}-${parts[0]}`;
                             }
                        }
                        dateOffset = _calculateDaysOffset(entryDateStr, oldStartDate);
                    }
                    
                    addPrescription({ ...pData, dateOffset: dateOffset }, true);
                });
            }

            // 6. Charger la Biologie (avec rétro-compatibilité)
            if (state.biologie) {
                document.querySelectorAll('#bio-table thead input[type="date"]').forEach((input, index) => {
                    let offset = undefined;
                    
                    if (state.biologie.dateOffsets && state.biologie.dateOffsets[index] !== undefined) {
                        // === Nouveau format ===
                        offset = state.biologie.dateOffsets[index];
                    } 
                    else if (state.biologie.dates && state.biologie.dates[index]) {
                        // === Ancien format ===
                         const oldDateStr = state.biologie.dates[index];
                         if (oldDateStr) { // S'assure que la date n'est pas vide
                            offset = _calculateDaysOffset(entryDateStr, oldDateStr);
                         }
                    }

                    if (offset !== undefined) {
                        const targetDate = _calculateDateFromOffset(entryDateStr, offset);
                        input.value = _formatDateForInput(targetDate);
                        input.dataset.dateOffset = offset;
                    }
                });
                // Le remplissage des analyses est inchangé
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
            
            // 7. Charger Pancarte (inchangé)
            if (state.pancarte) {
                document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
                    const paramName = row.cells[0].textContent.trim();
                    if (paramName && state.pancarte && state.pancarte[paramName]) {
                        row.querySelectorAll('input').forEach((input, index) => { input.value = state.pancarte[paramName][index] || ''; });
                    }
                });
            }
            
            if (entryDateStr) {
                const entryDate = new Date(entryDateStr);
                if (!isNaN(entryDate.getTime())) { updateDynamicDates(entryDate); }
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
    
    function refreshAllRelativeDates() {
        const entryDateStr = document.getElementById('patient-entry-date').value;
        if (!entryDateStr) return; 
        
        // 1. Rafraîchir les Observations
        document.querySelectorAll('#observations-list .timeline-item').forEach(item => {
            const offset = parseInt(item.dataset.dateOffset, 10);
            if (!isNaN(offset)) {
                const targetDate = _calculateDateFromOffset(entryDateStr, offset);
                const formattedDate = _formatDate(targetDate);
                item.querySelector('h3').textContent = `${formattedDate} - ${item.dataset.author.toUpperCase()}`;
            }
        });
        
        // 2. Rafraîchir les Transmissions
        document.querySelectorAll('#transmissions-list-ide .timeline-item').forEach(item => {
            const offset = parseInt(item.dataset.dateOffset, 10);
            if (!isNaN(offset)) {
                const targetDate = _calculateDateFromOffset(entryDateStr, offset);
                const formattedDate = _formatDate(targetDate);
                item.querySelector('h3').textContent = `${formattedDate} - ${item.dataset.author.toUpperCase()}`;
            }
        });
        
        // 3. Rafraîchir les Prescriptions
        document.querySelectorAll('#prescription-tbody tr').forEach(row => {
            const offset = parseInt(row.dataset.dateOffset, 10);
            if (!isNaN(offset)) {
                const targetDate = _calculateDateFromOffset(entryDateStr, offset);
                const formattedDate = _formatDate(targetDate).slice(0, 8); // JJ/MM/AA
                row.cells[3].textContent = formattedDate;
            }
        });

        // 4. Rafraîchir les Dates de Biologie
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            const offset = parseInt(input.dataset.dateOffset, 10);
             if (!isNaN(offset)) {
                const targetDate = _calculateDateFromOffset(entryDateStr, offset);
                input.value = _formatDateForInput(targetDate);
            }
        });
        
        // 5. Rafraîchir les barres IV (elles dépendent de la date d'entrée)
        document.querySelectorAll('#prescription-tbody .iv-bar').forEach(bar => {
            updateIVBarDetails(bar, bar.closest('.iv-bar-container'));
        });
    }

    function exportPatientAsJson() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
             showCustomAlert("Exportation impossible", "L'exportation de dossiers n'est pas disponible avec votre plan.");
            return;
        }

        // --- Copie la logique de saveData pour assembler l'état ---
        const state = {};
        const entryDateStr = document.getElementById('patient-entry-date').value;

        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') { state[id] = el.checked; } else { state[id] = el.value; }
        });
        state.observations = [];
        document.querySelectorAll('#observations-list .timeline-item').forEach(item => {
            state.observations.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });
        state.transmissions = [];
        document.querySelectorAll('#transmissions-list-ide .timeline-item').forEach(item => {
            state.transmissions.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });
        const careDiagramTbody = document.getElementById('care-diagram-tbody');
        if (careDiagramTbody) state['care-diagram-tbody_html'] = careDiagramTbody.innerHTML;
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);
        const bioData = { dateOffsets: [], analyses: {} };
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            const offset = _calculateDaysOffset(entryDateStr, input.value);
            bioData.dateOffsets.push(offset);
        });
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
            state.prescriptions.push({
                name: row.cells[0].querySelector('span').textContent,
                posologie: row.cells[1].textContent,
                voie: row.cells[2].textContent,
                dateOffset: parseInt(row.dataset.dateOffset, 10) || 0,
                type: row.dataset.type,
                bars: Array.from(row.querySelectorAll('.iv-bar')).map(bar => ({ 
                    left: bar.style.left, 
                    width: bar.style.width, 
                    title: bar.title 
                }))
            });
        });
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        const patientName = `${nomUsage} ${prenom}`.trim();
        state['sidebar_patient_name'] = patientName;
        // --- Fin de la copie ---

        // Créer le nom du fichier
        let fileName = "dossier_patient.json";
        if (patientName) {
            // Nettoie le nom pour le système de fichiers
            fileName = `${nomUsage.toLowerCase()}_${prenom.toLowerCase()}.json`.replace(/[^a-z0-9_.]/g, '_');
        }

        // Créer le contenu du fichier
        const jsonString = JSON.stringify(state, null, 2); // 'null, 2' pour un joli formatage
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Créer un lien de téléchargement et simuler un clic
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Nettoyer
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function clearCurrentPatientData() {
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
            
            if (userPermissions.subscription === 'free') {
                return;
            }

            const headers = getAuthHeaders();
            if (!headers) return;
            try {
                // MODIFIÉ : Utilise API_URL
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

    async function clearAllData() {
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

            if (userPermissions.subscription === 'free') {
                return;
            }
            
            const headers = getAuthHeaders();
            if (!headers) return;
            
            const allChambreIds = patients.map(p => p.id);
            const clearPromises = [];

            for (const patientId of allChambreIds) {
                // MODIFIÉ : Utilise API_URL
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

    async function savePatientAsCase() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') return;

        // --- Copie la logique de saveData ---
        const state = {};
        const entryDateStr = document.getElementById('patient-entry-date').value;
        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') { state[id] = el.checked; } else { state[id] = el.value; }
        });
        state.observations = [];
        document.querySelectorAll('#observations-list .timeline-item').forEach(item => {
            state.observations.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });
        state.transmissions = [];
        document.querySelectorAll('#transmissions-list-ide .timeline-item').forEach(item => {
            state.transmissions.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });
        const careDiagramTbody = document.getElementById('care-diagram-tbody');
        if (careDiagramTbody) state['care-diagram-tbody_html'] = careDiagramTbody.innerHTML;
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);
        const bioData = { dateOffsets: [], analyses: {} };
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            const offset = _calculateDaysOffset(entryDateStr, input.value);
            bioData.dateOffsets.push(offset);
        });
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
            state.prescriptions.push({
                name: row.cells[0].querySelector('span').textContent,
                posologie: row.cells[1].textContent,
                voie: row.cells[2].textContent,
                dateOffset: parseInt(row.dataset.dateOffset, 10) || 0,
                type: row.dataset.type,
                bars: Array.from(row.querySelectorAll('.iv-bar')).map(bar => ({ 
                    left: bar.style.left, 
                    width: bar.style.width, 
                    title: bar.title 
                }))
            });
        });
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        const patientName = `${nomUsage} ${prenom}`.trim();
        state['sidebar_patient_name'] = patientName;
        // --- Fin de la copie ---
        
        if (!patientName || patientName.startsWith('Chambre ')) {
            showCustomAlert("Sauvegarde impossible", "Veuillez d'abord donner un Nom et un Prénom au patient dans l'en-tête (Champs 'Nom d'usage' et 'Prénom').");
            return;
        }

        try {
            const headers = getAuthHeaders();
            if (!headers) return;

            // MODIFIÉ : Utilise API_URL
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

    function importCurrentPatientData(event) {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            showCustomAlert("Importation impossible", "L'importation de dossiers n'est pas disponible avec votre plan.");
            return;
        }
        
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
                
                if (jsonData['patient-entry-date']) {
                    document.getElementById('patient-entry-date').value = jsonData['patient-entry-date'];
                }
                
                // MODIFIÉ : Utilise API_URL
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
                await initSidebar(); 

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

    function hideLoadPatientModal() {
        loadPatientBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            loadPatientModal.classList.add('hidden');
        }, 200);
    }

    async function openLoadPatientModal() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') return;

        loadPatientListContainer.innerHTML = '<p class="text-gray-500">Chargement des dossiers...</p>';
        loadPatientModal.classList.remove('hidden');
        setTimeout(() => {
            loadPatientBox.classList.remove('scale-95', 'opacity-0');
        }, 10);

        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            delete headers['Content-Type'];

            // MODIFIÉ : Utilise API_URL
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

    async function initSidebar() {
        const list = document.getElementById('patient-list');
        let listHTML = '';
        let patientMap = new Map();

        if (userPermissions.subscription === 'free') {
            console.log("Plan 'Free' : Initialisation de la sidebar en local uniquement.");
        } else {
            try {
                const headers = getAuthHeaders();
                if (!headers) return;
                delete headers['Content-Type'];

                // MODIFIÉ : Utilise API_URL
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
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            input.value = '';
            delete input.dataset.dateOffset;
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

        applyPermissions();
    }

    // =================================================================
    // MODIFIÉ : initializeDynamicTables (pancarte 150px)
    // =================================================================
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
                html += `<th class="p-1"><input type="date" placeholder="JJ/MM/AA" class="font-semibold text-center w-24 bg-transparent"></th>`;
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
            // --- MODIFICATION ICI ---
            for(let i=0; i<11; i++) { 
                html += `<th class="p-1" style="min-width: 70px;">Matin</th>`;
                html += `<th class="p-1" style="min-width: 70px;">Soir</th>`;
                html += `<th class="p-1" style="min-width: 70px;">Nuit</th>`;
            }
            // --- FIN MODIFICATION ---
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
                    // --- MODIFICATION ICI ---
                    html += `<td class="p-0" style="min-width: 70px;">${inputHtml}</td>`;
                    // --- FIN MODIFICATION ---
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

    function handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('activePatientId');
        localStorage.removeItem('activeTab');
        window.location.href = 'auth.html';
    }

    function setupEventListeners() {
        document.getElementById('start-tutorial-btn').addEventListener('click', startTutorial);
        document.getElementById('clear-all-data-btn').addEventListener('click', clearAllData);
        document.getElementById('logout-btn').addEventListener('click', handleLogout); 
        const accountBtn = document.getElementById('account-management-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', (e) => {
                if (userPermissions.isStudent) e.preventDefault(); 
            });
        }
        document.getElementById('save-patient-btn').addEventListener('click', savePatientAsCase);
        document.getElementById('load-patient-btn').addEventListener('click', openLoadPatientModal);
        document.getElementById('import-json-btn').addEventListener('click', () => {
            if (userPermissions.isStudent || userPermissions.subscription === 'free') return;
            document.getElementById('import-file').click()
        });
        document.getElementById('import-file').addEventListener('change', importCurrentPatientData);
        
        document.getElementById('export-json-btn').addEventListener('click', exportPatientAsJson);
        
        document.getElementById('clear-current-patient-btn').addEventListener('click', clearCurrentPatientData);
        document.getElementById('toggle-fullscreen-btn').addEventListener('click', toggleFullscreen);

        document.getElementById('patient-entry-date').addEventListener('input', () => {
            updateJourHosp(); 
            
            const entryDateValue = document.getElementById('patient-entry-date').value;
            if (entryDateValue) {
                const entryDate = new Date(entryDateValue);
                if (!isNaN(entryDate.getTime())) {
                    updateDynamicDates(entryDate);
                }
            }
            
            refreshAllRelativeDates(); 
        });


        document.getElementById('tabs-nav').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-tab-id]');
            if (button) {
                changeTab({ currentTarget: button }, button.dataset.tabId);
            }
        });
        document.getElementById('patient-list').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-patient-id]');
            if (button) {
                switchPatient(button.dataset.patientId); 
            }
        });
        document.getElementById('add-observation-btn').addEventListener('click', () => addObservation(null, false));
        document.getElementById('add-prescription-btn').addEventListener('click', () => addPrescription(null, false));
        document.getElementById('add-transmission-btn').addEventListener('click', () => addTransmission(null, false));
        document.getElementById('add-care-diagram-btn').addEventListener('click', addCareDiagramRow);

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

        document.getElementById('pancarte-tbody').addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT') updatePancarteChart();
        });
        document.querySelector('main').addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('info-value')) {
                autoResize(e.target);
            }
        });
        document.getElementById('vie-poids').addEventListener('input', calculateAndDisplayIMC);
        document.getElementById('vie-taille').addEventListener('input', calculateAndDisplayIMC);

        document.addEventListener('mousemove', handleIVMouseMove);
        document.addEventListener('mouseup', handleIVMouseUp);

        document.getElementById('tutorial-overlay').addEventListener('click', () => endTutorial(true));
        document.getElementById('tutorial-step-box').addEventListener('click', (e) => e.stopPropagation());
        document.getElementById('tutorial-skip-btn').addEventListener('click', () => endTutorial(true));
        document.getElementById('tutorial-next-btn').addEventListener('click', () => {
            currentStepIndex++;
            showTutorialStep(currentStepIndex);
        });

        document.getElementById('load-patient-close-btn').addEventListener('click', hideLoadPatientModal);
        document.getElementById('load-patient-cancel-btn').addEventListener('click', hideLoadPatientModal);

        document.getElementById('load-patient-list-container').addEventListener('click', async (e) => {
            if (userPermissions.isStudent || userPermissions.subscription === 'free') return;

            const loadBtn = e.target.closest('.load-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (loadBtn) {
                const patientIdToLoadFrom = loadBtn.dataset.patientId; 
                const patientIdToLoadInto = activePatientId; 
                
                const patientToLoadFromName = loadBtn.closest('.flex').querySelector('.font-medium').textContent;
                const roomToLoadInto = patientIdToLoadInto.split('_')[1];

                const message = `Êtes-vous sûr de vouloir écraser le dossier de la chambre ${roomToLoadInto} avec les données de "${patientToLoadFromName}" ?`;

                showDeleteConfirmation(message, async () => {
                    try {
                        let headers = getAuthHeaders();
                        if (!headers) return;
                        delete headers['Content-Type'];
                        
                        // MODIFIÉ : Utilise API_URL
                        const responseGet = await fetch(`${API_URL}/api/patients/${patientIdToLoadFrom}`, { headers: headers });
                        if (handleAuthError(responseGet)) return;
                        const dossierToLoad = await responseGet.json();

                        if (!dossierToLoad || Object.keys(dossierToLoad).length === 0) {
                            showCustomAlert("Erreur", "Le dossier que vous essayez de charger est vide.");
                            return;
                        }

                        const patientName = dossierToLoad.sidebar_patient_name;
                        
                        if (dossierToLoad['patient-entry-date']) {
                            document.getElementById('patient-entry-date').value = dossierToLoad['patient-entry-date'];
                        }

                        headers = getAuthHeaders();
                        if (!headers) return;

                        // MODIFIÉ : Utilise API_URL
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
                const patientId = deleteBtn.dataset.patientId;
                const patientName = deleteBtn.dataset.patientName;
                
                showDeleteConfirmation(`Êtes-vous sûr de vouloir supprimer la sauvegarde "${patientName}" ? Cette action est irréversible.`, async () => {
                    try {
                        const headers = getAuthHeaders();
                        if (!headers) return;
                        delete headers['Content-Type']; 

                        // MODIFIÉ : Utilise API_URL
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

    async function initApp() {
        const token = getAuthToken();
        if (!token) return; 

        loadPatientModal = document.getElementById('load-patient-modal');
        loadPatientBox = document.getElementById('load-patient-box');
        loadPatientListContainer = document.getElementById('load-patient-list-container');
        
        await loadUserPermissions();

        initializeDynamicTables();
        
        if (userPermissions.isStudent && patients.length === 0) {
            document.getElementById('patient-list').innerHTML = '<li class="p-2 text-sm text-gray-500">Aucune chambre ne vous a été assignée.</li>';
            document.getElementById('main-content-wrapper').innerHTML = '<div class="p-8 text-center text-gray-600">Aucune chambre ne vous a été assignée. Veuillez contacter votre formateur.</div>';
            document.querySelectorAll('#main-header button').forEach(btn => btn.disabled = true);
            
            setupModalListeners(); 
            document.getElementById('logout-btn').addEventListener('click', handleLogout);
            const accountBtn = document.getElementById('account-management-btn');
            if (accountBtn) {
                accountBtn.classList.add('opacity-50', 'cursor-not-allowed');
                accountBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                });
            }
            return;
        }

        if (!activePatientId || !patients.find(p => p.id === activePatientId)) {
            activePatientId = patients[0].id; 
        }
        
        await initSidebar(); 
        
        setupEventListeners();
        setupModalListeners();
        setupSync(); 

        let saveTimeout;
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (!isLoadingData) { 
                    saveData(activePatientId);
                }
            }, 500); 
        };
        document.querySelector('main').addEventListener('input', debouncedSave);
        document.querySelector('main').addEventListener('change', debouncedSave);

        await switchPatient(activePatientId, true); 

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
                text: "Ce bouton vous permet d'importer un fichier JSON dans la chambre actuelle.",
                position: 'bottom-left'
            };
            tutorialSteps[6] = {
                element: '#export-json-btn',
                text: "Et celui-ci vous permet d'exporter le dossier actuel en fichier .json (pour le partager).",
                position: 'bottom-left'
            };
            tutorialSteps[7] = {
                element: '#clear-current-patient-btn',
                text: "Attention : Ce bouton efface les données *visibles* du patient actuel (réinitialise la chambre localement).",
                position: 'bottom-left'
            };
            tutorialSteps[8] = {
                element: 'button[id="clear-all-data-btn"]', 
                text: "ATTENTION : Ce bouton réinitialise *localement* les 10 chambres du service. Les sauvegardes ne sont pas effacées.",
                position: 'top'
            };
            
            setTimeout(startTutorial, 500);
        }
    }

    // --- Modales (inchangées) ---
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

    // --- Fonctions d'UI (inchangées) ---
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
    
    function addObservation(data = null, fromLoad = false) {
        if (!fromLoad && userPermissions.isStudent && !userPermissions.observations) return;
        
        let author, text, formattedDate, dateOffset;
        
        if (fromLoad) {
            author = data.author;
            text = data.text;
            formattedDate = data.formattedDate; // Pré-calculé par loadData
            dateOffset = data.dateOffset;
        } else {
            author = document.getElementById('new-observation-author').value.trim();
            text = document.getElementById('new-observation-text').value.trim();
            const dateValue = document.getElementById('new-observation-date').value;
            const entryDateStr = document.getElementById('patient-entry-date').value;
            
            if (!text || !author || !dateValue || !entryDateStr) {
                if(!entryDateStr) showCustomAlert("Action impossible", "Veuillez d'abord définir une date d'entrée pour le patient.");
                return;
            }

            const eventDate = new Date(dateValue + 'T00:00:00');
            formattedDate = _formatDate(eventDate);
            dateOffset = _calculateDaysOffset(entryDateStr, dateValue);
        }

        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.dataset.author = author;
        item.dataset.text = text;
        item.dataset.dateOffset = dateOffset;
        
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
        if (!fromLoad) {
            document.getElementById('new-observation-form').reset();
        }
    }
    
    function addTransmission(data = null, fromLoad = false) {
        if (!fromLoad && userPermissions.isStudent && !userPermissions.transmissions) return;
        
        let author, text, formattedDate, dateOffset;
        
        if (fromLoad) {
            author = data.author;
            text = data.text;
            formattedDate = data.formattedDate; // Pré-calculé par loadData
            dateOffset = data.dateOffset;
        } else {
            author = document.getElementById('new-transmission-author-2').value.trim();
            text = document.getElementById('new-transmission-text-2').value.trim();
            const dateValue = document.getElementById('new-transmission-date').value;
            const entryDateStr = document.getElementById('patient-entry-date').value;
            
            if (!text || !author || !dateValue || !entryDateStr) {
                 if(!entryDateStr) showCustomAlert("Action impossible", "Veuillez d'abord définir une date d'entrée pour le patient.");
                return;
            }

            const eventDate = new Date(dateValue + 'T00:00:00');
            formattedDate = _formatDate(eventDate);
            dateOffset = _calculateDaysOffset(entryDateStr, dateValue);
        }

        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.dataset.author = author;
        item.dataset.text = text;
        item.dataset.dateOffset = dateOffset;
        
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
        if (!fromLoad) {
            document.getElementById('new-transmission-form-2').reset();
        }
    }

    function addPrescription(data = null, fromLoad = false) {
        if (!fromLoad && userPermissions.isStudent && !userPermissions.prescriptions_add) {
            return;
        }

        let name, posologie, voie, type, bars, dateOffset, formattedStartDate;
        const entryDateStr = document.getElementById('patient-entry-date').value;

        if (fromLoad) {
            ({ name, posologie, voie, type, bars, dateOffset } = data);
            
            if (isNaN(parseInt(dateOffset, 10))) dateOffset = 0;

            const targetDate = _calculateDateFromOffset(entryDateStr, dateOffset);
            formattedStartDate = _formatDate(targetDate).slice(0, 8); // JJ/MM/AA
        } else {
            name = document.getElementById('med-name').value.trim();
            posologie = document.getElementById('med-posologie').value.trim();
            voie = document.getElementById('med-voie').value.trim();
            const startDateValue = document.getElementById('med-start-date').value;
            
            if (!name || !startDateValue || !entryDateStr) {
                if(!entryDateStr) showCustomAlert("Action impossible", "Veuillez d'abord définir une date d'entrée pour le patient.");
                return;
            }

            const [year, month, day] = startDateValue.split('-');
            formattedStartDate = `${day}/${month}/${year.slice(2)}`;
            type = voie.trim().toUpperCase() === 'IV' ? 'iv' : 'checkbox';
            
            dateOffset = _calculateDaysOffset(entryDateStr, startDateValue);
        }
        
        const tbody = document.getElementById("prescription-tbody");
        const newRow = tbody.insertRow();
        newRow.dataset.type = type;
        newRow.dataset.dateOffset = dateOffset;

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
            <td class="p-2 text-left align-top" style="min-width: 100px;">${formattedStartDate}</td>
        `;

        newRow.innerHTML = baseCellsHTML;
        const timelineCell = newRow.insertCell();
        timelineCell.colSpan = 88; 
        timelineCell.className = 'iv-bar-container';

        if (type !== 'iv') {
            timelineCell.classList.add('marker-container');
        }
        
        if (!userPermissions.isStudent || userPermissions.prescriptions_validate) {
            timelineCell.addEventListener('mousedown', handleIVMouseDown);
        }
        
        const barsToCreate = [];
        if (fromLoad && bars && Array.isArray(bars)) {
            barsToCreate.push(...bars);
        }
        
        barsToCreate.forEach(barData => {
            if (barData && barData.left && (barData.width || barData.width === 0)) {
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
    
    function addCareDiagramRow() {
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

    // --- Fonctions IV (inchangées) ---
    function handleIVDblClick(e) {
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
                finalWidthPx = 0; 
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
    
    function updateIVBarDetails(bar, cell) {
        if (!bar || !cell) return;
        const tableStartDateStr = document.getElementById('patient-entry-date').value;
        if (!tableStartDateStr) return;
        
        const barId = bar.dataset.barId;
        if (!barId) return; 

        const tableStartDate = new Date(tableStartDateStr + 'T00:00:00');
        const totalTimelineMinutes = 11 * 24 * 60;
        const startPercent = parseFloat(bar.style.left);
        const widthPercent = parseFloat(bar.style.width);
        const startOffsetMinutes = (startPercent / 100) * totalTimelineMinutes;
        const durationMinutes = (widthPercent / 100) * totalTimelineMinutes;
        const rawStartDateTime = new Date(tableStartDate.getTime());
        rawStartDateTime.setMinutes(rawStartDateTime.getMinutes() + startOffsetMinutes);
        const rawEndDateTime = new Date(rawStartDateTime.getTime());
        rawEndDateTime.setMinutes(rawEndDateTime.getMinutes() + durationMinutes);
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

        const endPercent = startPercent + widthPercent;
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

    // --- Section Tutoriel (inchangée) ---
    const tutorialSteps = [
        {
            element: '#patient-list li:first-child button',
            text: "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier. (Vous pouvez remplir le dossier pour voir un nom ici).",
            position: 'right'
        },
        {
            element: '#patient-header-form',
            text: "Cet en-tête contient les informations principales. La 'Date d'entrée' est cruciale : toutes les autres dates du dossier (observations, prescriptions...) seront automatiquement recalculées à partir de celle-ci.",
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
            text: "Ce bouton vous permet d'importer un fichier JSON dans la chambre actuelle.",
            position: 'bottom-left'
        },
        {
            element: '#export-json-btn',
            text: "Et celui-ci vous permet d'exporter le dossier actuel en fichier .json (pour le partager).",
            position: 'bottom-left'
        },
        {
            element: '#clear-current-patient-btn',
            text: "Ce bouton efface les données de la chambre actuelle et la réinitialise sur le serveur.",
            position: 'bottom-left'
        },
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
        
        tutorialSteps[0] = {
            element: '#patient-list li:first-child button',
            text: "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier. (Vous pouvez remplir le dossier pour voir un nom ici).",
            position: 'right'
        };
        tutorialSteps[1] = {
            element: '#patient-header-form',
            text: "Cet en-tête contient les informations principales. La 'Date d'entrée' est cruciale : toutes les autres dates du dossier (observations, prescriptions...) seront automatiquement recalculées à partir de celle-ci.",
            position: 'bottom'
        };
        
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
                const patientList = document.getElementById('patient-list');
                if (patientList.children.length > 0 && patientList.firstElementChild.tagName === 'LI') {
                     tutorialSteps[0].element = '#patient-list li:first-child button';
                     tutorialSteps[0].text = "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier. (Vous pouvez remplir le dossier pour voir un nom ici).";
                } else {
                    tutorialSteps[0].element = '#sidebar';
                    tutorialSteps[0].text = "Bienvenue ! Voici la barre latérale où les patients apparaîtront. Pour l'instant, elle est vide ou vous n'avez pas encore accès à une chambre.";
                }
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