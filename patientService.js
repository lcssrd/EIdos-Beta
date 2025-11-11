(function() {
    "use strict";

    // --- État de l'application ---
    
    // Contient l'objet 'user' complet de l'API (permissions, rôle, etc.)
    let userPermissions = {}; 
    
    // Contient la liste des chambres (ex: [{id: 'chambre_101', room: '101'}, ...])
    let patientList = []; 
    
    // L'ID du patient actuellement affiché (ex: 'chambre_101')
    let activePatientId = null;
    
    // L'objet complet (dossierData) du patient actuellement affiché
    let currentPatientState = {};
    
    // Un drapeau pour empêcher les sauvegardes pendant un chargement
    let isLoadingData = false;
    
    // Pour la sauvegarde automatique
    let saveTimeout;

    /**
     * Lit TOUS les champs de l'interface utilisateur et les assemble
     * en un seul objet 'dossierData'.
     * @returns {Object} L'objet dossierData complet.
     */
    function collectPatientStateFromUI() {
        const state = {};
        const entryDateStr = document.getElementById('patient-entry-date').value;

        // 1. Inputs simples (Header, Admin, Vie, ATCD)
        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            // Exclure les champs de formulaire qui ne font pas partie de l'état
            if (el.id.startsWith('new-') || el.id.startsWith('cr-modal-') || el.type === 'file') {
                return;
            }
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') { state[id] = el.checked; } 
            else { state[id] = el.value; }
        });

        // 2. Observations
        state.observations = [];
        document.querySelectorAll('#observations-list .timeline-item').forEach(item => {
            state.observations.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });

        // 3. Transmissions
        state.transmissions = [];
        document.querySelectorAll('#transmissions-list-ide .timeline-item').forEach(item => {
            state.transmissions.push({
                author: item.dataset.author || '',
                text: item.dataset.text || '',
                dateOffset: parseInt(item.dataset.dateOffset, 10) || 0
            });
        });
        
        // 4. Comptes Rendus (Nouvelle logique : stocke l'état actuel)
        // On préserve l'état existant (currentPatientState)
        state.comptesRendus = currentPatientState.comptesRendus || {};

        // 5. Diagramme de Soins
        const careDiagramTbody = document.getElementById('care-diagram-tbody');
        if (careDiagramTbody) state['care-diagram-tbody_html'] = careDiagramTbody.innerHTML;
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);

        // 6. Biologie
        const bioData = { dateOffsets: [], analyses: {} };
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            const offset = utils.calculateDaysOffset(entryDateStr, input.value);
            bioData.dateOffsets.push(offset);
            input.dataset.dateOffset = offset; // Assure que le DOM est à jour
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
        
        // 7. Pancarte & Glycémie
        const pancarteTableData = {};
        document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
            const paramName = row.cells[0].textContent.trim();
            if (paramName) {
                pancarteTableData[paramName] = [];
                row.querySelectorAll('input').forEach(input => pancarteTableData[paramName].push(input.value));
            }
        });
        state.pancarte = pancarteTableData;
        
        const glycemieTableData = {};
        document.querySelectorAll('#glycemie-table tbody tr').forEach(row => {
            const paramName = row.cells[0].textContent.trim();
             if (paramName) {
                glycemieTableData[paramName] = [];
                row.querySelectorAll('input').forEach(input => glycemieTableData[paramName].push(input.value));
            }
        });
        state.glycemie = glycemieTableData;

        // 8. Prescriptions
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
        
        // 9. Nom (pour la sidebar)
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        state['sidebar_patient_name'] = `${nomUsage} ${prenom}`.trim();

        return state;
    }
    
    /**
     * Prend un objet dossierData et l'utilise pour remplir tout le formulaire via uiService.
     * @param {Object} state - L'objet dossierData.
     */
    function loadPatientDataIntoUI(state) {
        const entryDateStr = state['patient-entry-date'] || '';
        
        uiService.fillFormFromState(state);
        uiService.fillListsFromState(state, entryDateStr);
        uiService.fillCareDiagramFromState(state);
        uiService.fillPrescriptionsFromState(state, entryDateStr);
        uiService.fillBioFromState(state, entryDateStr);
        uiService.fillPancarteFromState(state);
        uiService.fillCrCardsFromState(state.comptesRendus); // Nouvelle fonction pour les cartes
        
        // Mettre à jour les affichages calculés
        uiService.updateAgeDisplay();
        uiService.updateJourHosp(); 
        uiService.calculateAndDisplayIMC();
        uiService.updatePancarteChart();
        
        if (entryDateStr) {
            uiService.updateDynamicDates(new Date(entryDateStr));
        }
    }


    // --- Fonctions de Service (exposées) ---

    /**
     * Initialise le service, récupère les permissions et la liste des patients.
     */
    async function initialize() {
        // 1. Récupérer les permissions
        try {
            const userData = await apiService.fetchUserPermissions();
            
            // Stocker les permissions
            userPermissions.subscription = userData.subscription || 'free';
            userPermissions.allowedRooms = userData.allowedRooms || []; 

            if (userData.role === 'etudiant' && userData.permissions) {
                userPermissions = { ...userPermissions, ...userData.permissions, isStudent: true, role: 'etudiant' };
                // Les étudiants voient seulement leurs chambres autorisées
                patientList = userPermissions.allowedRooms
                    .map(roomId => ({ id: roomId, room: roomId.split('_')[1] }))
                    .sort((a, b) => a.room.localeCompare(b.room));
            } else {
                // Formateurs / Propriétaires / Indépendants
                let effectivePlan = userData.subscription || 'free';
                let role = userData.role || 'user';
                if ((role === 'formateur' || role === 'owner') && userData.organisation) {
                    effectivePlan = userData.organisation.plan;
                }
                
                userPermissions = { 
                    isStudent: false, role: role, subscription: effectivePlan,
                    header: true, admin: true, vie: true, observations: true, 
                    prescriptions_add: true, prescriptions_delete: true, prescriptions_validate: true,
                    transmissions: true, pancarte: true, diagramme: true, biologie: true,
                    comptesRendus: true
                };
                // Les formateurs voient les 10 chambres par défaut
                patientList = Array.from({ length: 10 }, (_, i) => ({
                    id: `chambre_${101 + i}`,
                    room: `${101 + i}`
                }));
            }
        } catch (error) {
            console.error("Échec critique de l'initialisation des permissions.", error);
            uiService.showCustomAlert("Erreur critique", "Impossible de charger les permissions utilisateur. L'application ne peut pas démarrer.");
            return;
        }

        // 2. Appliquer les permissions à l'UI
        uiService.applyPermissions(userPermissions);

        // 3. Gérer l'état "étudiant sans chambre"
        if (userPermissions.isStudent && patientList.length === 0) {
            document.getElementById('patient-list').innerHTML = '<li class="p-2 text-sm text-gray-500">Aucune chambre ne vous a été assignée.</li>';
            document.getElementById('main-content-wrapper').innerHTML = '<div class="p-8 text-center text-gray-600">Aucune chambre ne vous a été assignée. Veuillez contacter votre formateur.</div>';
            document.querySelectorAll('#main-header button').forEach(btn => btn.disabled = true);
            return; // Bloquer l'initialisation
        }

        // 4. Déterminer l'ID du patient actif
        const storedPatientId = localStorage.getItem('activePatientId');
        if (storedPatientId && patientList.find(p => p.id === storedPatientId)) {
            activePatientId = storedPatientId;
        } else {
            activePatientId = patientList[0].id;
        }

        // 5. Charger la liste des patients dans la sidebar
        await loadPatientList();

        // 6. Charger le patient actif
        await switchPatient(activePatientId, true); // true = skipSave
        
        return true; // Succès
    }
    
    /**
     * Charge la liste des patients (chambres) et met à jour la sidebar.
     */
    async function loadPatientList() {
        let patientMap = new Map();
        if (userPermissions.subscription !== 'free') {
            try {
                const allPatients = await apiService.fetchPatientList();
                allPatients.forEach(p => {
                    if (p.patientId.startsWith('chambre_')) {
                        patientMap.set(p.patientId, p.sidebar_patient_name);
                    }
                });
            } catch (error) {
                console.error("Impossible de charger le nom des patients pour la sidebar.", error);
            }
        }
        uiService.initSidebar(patientList, patientMap);
    }
    
    /**
     * Change le patient actif, sauvegarde l'ancien et charge le nouveau.
     * @param {string} newPatientId - L'ID du patient à charger.
     * @param {boolean} [skipSave=false] - Si true, ne sauvegarde pas le patient actuel.
     */
    async function switchPatient(newPatientId, skipSave = false) {
        if (!skipSave && activePatientId) {
            await saveCurrentPatientData();
        }
        
        isLoadingData = true;
        activePatientId = newPatientId;
        localStorage.setItem('activePatientId', newPatientId); 
        
        uiService.resetForm(); 
        
        // Charger les données depuis l'API
        try {
            currentPatientState = await apiService.fetchPatientData(newPatientId);
        } catch (error) {
            console.error(`Échec du chargement du patient ${newPatientId}`, error);
            currentPatientState = {}; // Revenir à un état vide en cas d'erreur
        }
        
        // Remplir l'UI avec les nouvelles données
        loadPatientDataIntoUI(currentPatientState);
        
        uiService.updateSidebarActiveState(newPatientId);
        document.getElementById('main-content-wrapper').scrollTo({ top: 0, behavior: 'smooth' });
        
        // Ré-appliquer les permissions (surtout pour les étudiants)
        uiService.applyPermissions(userPermissions);
        
        isLoadingData = false;
    }
    
    /**
     * Collecte l'état de l'UI et le sauvegarde sur le serveur (pour la chambre active).
     */
    async function saveCurrentPatientData() {
        if (isLoadingData || !activePatientId || userPermissions.subscription === 'free') {
            return;
        }

        const state = collectPatientStateFromUI();
        currentPatientState = state; // Met à jour l'état local
        
        try {
            await apiService.saveChamberData(activePatientId, state, state.sidebar_patient_name);
            uiService.updateSidebarEntryName(activePatientId, state.sidebar_patient_name);
        } catch (error) {
            console.error("Échec de la sauvegarde automatique :", error);
            // Ne pas montrer d'alerte pour ne pas déranger l'utilisateur
        }
    }
    
    /**
     * Déclenche une sauvegarde automatique avec un délai (debounce).
     */
    function debouncedSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveCurrentPatientData();
        }, 500);
    }
    
    /**
     * Gère la création d'une sauvegarde de cas (archive).
     */
    async function saveCurrentPatientAsCase() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            return;
        }

        const state = collectPatientStateFromUI();
        const patientName = state.sidebar_patient_name;

        if (!patientName || patientName.startsWith('Chambre ')) {
            uiService.showCustomAlert("Sauvegarde impossible", "Veuillez d'abord donner un Nom et un Prénom au patient dans l'en-tête.");
            return;
        }

        try {
            await apiService.saveCaseData(state, patientName);
            uiService.showCustomAlert("Sauvegarde réussie", `Le dossier de "${patientName}" a été sauvegardé avec succès.`);
        } catch (error) {
            uiService.showCustomAlert("Erreur de sauvegarde", error.message);
        }
    }
    
    /**
     * Ouvre la modale de chargement de cas.
     */
    async function openLoadPatientModal() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            return;
        }

        let savedPatients = [];
        try {
            const allPatients = await apiService.fetchPatientList();
            savedPatients = allPatients.filter(p => p.patientId.startsWith('save_'));
        } catch (error) {
            uiService.showCustomAlert("Erreur", "Impossible de charger la liste des dossiers sauvegardés.");
        }
        
        uiService.openLoadPatientModal(savedPatients);
    }
    
    /**
     * Gère le clic sur "Charger" dans la modale de chargement.
     * @param {string} patientIdToLoadFrom - L'ID 'save_...' à charger.
     * @param {string} patientName - Le nom du dossier à charger (pour l'alerte).
     */
    async function loadCaseIntoCurrentPatient(patientIdToLoadFrom, patientName) {
        const roomToLoadInto = activePatientId.split('_')[1];
        const message = `Êtes-vous sûr de vouloir écraser le dossier de la chambre ${roomToLoadInto} avec les données de "${patientName}" ?`;

        uiService.showDeleteConfirmation(message, async () => {
            try {
                // 1. Récupérer les données de la sauvegarde
                const dossierToLoad = await apiService.fetchPatientData(patientIdToLoadFrom);
                if (!dossierToLoad || Object.keys(dossierToLoad).length === 0) {
                    uiService.showCustomAlert("Erreur", "Le dossier que vous essayez de charger est vide.");
                    return;
                }

                // 2. Écraser la chambre active avec ces données
                const patientName = dossierToLoad.sidebar_patient_name;
                await apiService.saveChamberData(activePatientId, dossierToLoad, patientName);

                // 3. Rafraîchir l'interface
                uiService.hideLoadPatientModal();
                await switchPatient(activePatientId, true); // true = skipSave
                await loadPatientList(); // Mettre à jour la sidebar
                uiService.showCustomAlert("Chargement réussi", `Le dossier de "${patientName}" a été chargé dans la chambre ${roomToLoadInto}.`);

            } catch (err) {
                uiService.showCustomAlert("Erreur", `Une erreur est survenue pendant le chargement: ${err.message}`);
            }
        });
    }

    /**
     * Gère le clic sur "Supprimer" dans la modale de chargement.
     * @param {string} patientIdToDelete - L'ID 'save_...' à supprimer.
     * @param {string} patientName - Le nom du dossier (pour l'alerte).
     */
    async function deleteCase(patientIdToDelete, patientName) {
        uiService.showDeleteConfirmation(`Êtes-vous sûr de vouloir supprimer la sauvegarde "${patientName}" ? Cette action est irréversible.`, async () => {
            try {
                await apiService.deleteSavedCase(patientIdToDelete);
                await openLoadPatientModal(); // Rafraîchit la liste dans la modale
            } catch (err) {
                uiService.showCustomAlert("Erreur", `Impossible de supprimer la sauvegarde: ${err.message}`);
            }
        });
    }

    /**
     * Gère l'importation d'un fichier JSON.
     * @param {Object} jsonData - Les données parsées du fichier.
     */
    async function importPatientData(jsonData) {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            return;
        }
        
        try {
            const patientName = jsonData.sidebar_patient_name || `Chambre ${activePatientId.split('_')[1]}`;
            
            // Sauvegarde les nouvelles données dans la chambre active
            await apiService.saveChamberData(activePatientId, jsonData, patientName);
            
            // Recharge l'interface
            await switchPatient(activePatientId, true); 
            await loadPatientList();
            uiService.showCustomAlert("Importation réussie", `Le fichier a été importé dans la chambre ${activePatientId.split('_')[1]}.`);

        } catch (error) {
            uiService.showCustomAlert("Erreur d'importation", error.message);
        }
    }
    
    /**
     * Exporte le patient actuel en fichier JSON.
     */
    function exportPatientData() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            uiService.showCustomAlert("Exportation impossible", "L'exportation de dossiers n'est pas disponible avec votre plan.");
            return;
        }

        const state = collectPatientStateFromUI();
        const patientName = state.sidebar_patient_name;
        
        let fileName = "dossier_patient.json";
        if (patientName) {
            const nomUsage = document.getElementById('patient-nom-usage').value.trim();
            const prenom = document.getElementById('patient-prenom').value.trim();
            fileName = `${nomUsage.toLowerCase()}_${prenom.toLowerCase()}.json`.replace(/[^a-z0-9_.]/g, '_');
        }

        const jsonString = JSON.stringify(state, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Efface les données de la chambre active.
     */
    function clearCurrentPatient() {
        if (userPermissions.isStudent) return;
        
        const message = `Êtes-vous sûr de vouloir effacer les données de la chambre ${activePatientId.split('_')[1]} ? Les données sauvegardées sur le serveur pour cette chambre seront aussi réinitialisées.`;
        uiService.showDeleteConfirmation(message, async () => {
            currentPatientState = {}; // Efface l'état local
            uiService.resetForm();
            
            if (userPermissions.subscription === 'free') {
                return;
            }
            
            try {
                await apiService.saveChamberData(activePatientId, {}, `Chambre ${activePatientId.split('_')[1]}`);
                uiService.updateSidebarEntryName(activePatientId, `Chambre ${activePatientId.split('_')[1]}`);
            } catch (err) {
                uiService.showCustomAlert("Erreur", "Impossible de réinitialiser la chambre sur le serveur.");
            }
        });
    }

    /**
     * Efface les données de TOUTES les chambres.
     */
    function clearAllPatients() {
        if (userPermissions.isStudent) return;

        const message = "ATTENTION : Vous êtes sur le point de réinitialiser les 10 chambres du service sur le serveur. Les sauvegardes de cas ne sont pas affectées. Continuer ?";
        
        uiService.showDeleteConfirmation(message, async () => {
            currentPatientState = {};
            uiService.resetForm();

            if (userPermissions.subscription === 'free') {
                return;
            }
            
            try {
                const allChamberIds = patientList.map(p => p.id);
                await apiService.clearAllChamberData(allChamberIds);
                await loadPatientList(); // Rafraîchit la sidebar
                uiService.showCustomAlert("Opération réussie", "Toutes les chambres ont été réinitialisées.");
            } catch (err) {
                 uiService.showCustomAlert("Erreur", "Une erreur est survenue lors de la réinitialisation.");
            }
        });
    }

    // --- Fonctions de logique métier (Comptes Rendus) ---

    /**
     * Récupère le texte pour une carte CR spécifique depuis l'état.
     * @param {string} crId - L'ID de la carte (ex: 'cr-consultation').
     * @returns {string} Le texte du compte rendu.
     */
    function getCrText(crId) {
        if (currentPatientState.comptesRendus && currentPatientState.comptesRendus[crId]) {
            return currentPatientState.comptesRendus[crId];
        }
        return '';
    }

    /**
     * Gère le clic sur "Enregistrer" dans la modale CR.
     * @param {string} crId - L'ID de la carte.
     * @param {string} crText - Le nouveau texte.
     */
    function handleCrModalSave(crId, crText) {
        if (!currentPatientState.comptesRendus) {
            currentPatientState.comptesRendus = {};
        }
        
        currentPatientState.comptesRendus[crId] = crText;
        
        // Mettre à jour la coche
        uiService.updateCrCardCheckmark(crId, crText && crText.trim() !== '');
        
        uiService.closeCrModal();
        debouncedSave(); // Déclencher une sauvegarde
    }
    
    // --- Exposition du service ---

    window.patientService = {
        // Initialisation
        initialize,
        
        // Gestion de l'état
        switchPatient,
        getActivePatientId: () => activePatientId,
        getPatientList: () => patientList,
        getUserPermissions: () => userPermissions,
        
        // Actions de sauvegarde/chargement
        debouncedSave,
        saveCurrentPatientAsCase,
        openLoadPatientModal,
        loadCaseIntoCurrentPatient,
        deleteCase,
        importPatientData,
        exportPatientData,
        
        // Actions de suppression
        clearCurrentPatient,
        clearAllPatients,
        
        // Logique métier
        getCrText,
        handleCrModalSave
    };

})();