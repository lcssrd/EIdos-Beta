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
    
    // NOUVEAU : Référence au socket
    let socket = null;

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
        uiService.fillCrCardsFromState(state.comptesRendus); 
        
        uiService.updateAgeDisplay();
        uiService.updateJourHosp(); 
        uiService.calculateAndDisplayIMC();
        uiService.updatePancarteChart();
        
        if (entryDateStr) {
            uiService.updateDynamicDates(new Date(entryDateStr));
        }
    }


    // --- Fonctions de Service (exposées) ---

    // NOUVEAU : Initialise et écoute le socket
    function initializeSocket() {
        socket = apiService.connectSocket();
        if (!socket) {
            console.error("Échec de la connexion au socket, le temps réel est désactivé.");
            return;
        }

        socket.on('patient_updated', (data) => {
            console.log("Événement 'patient_updated' reçu :", data);

            // 1. Vérifier si la mise à jour concerne le patient actuel
            if (data.patientId !== activePatientId) {
                console.log("Mise à jour pour un autre patient, ignorée.");
                // Mettre à jour le nom dans la sidebar si nécessaire
                if (data.dossierData.sidebar_patient_name) {
                     uiService.updateSidebarEntryName(data.patientId, data.dossierData.sidebar_patient_name);
                }
                return;
            }
            
            // 2. Vérifier si nous sommes l'expéditeur (normalement géré par le serveur, mais double sécurité)
            if (data.sender === socket.id) {
                console.log("Mise à jour de notre propre envoi, ignorée.");
                return;
            }

            // --- C'est une mise à jour pour nous ! ---
            console.log("Application de la mise à jour en temps réel...");
            
            // Mettre à jour l'état local
            currentPatientState = data.dossierData;
            
            // Mettre en pause la sauvegarde automatique
            isLoadingData = true;
            
            // Appliquer les changements à l'interface
            loadPatientDataIntoUI(currentPatientState);
            
            // Mettre à jour le nom dans la sidebar
            uiService.updateSidebarEntryName(activePatientId, currentPatientState.sidebar_patient_name);
            
            // Indiquer que les données sont à jour
            uiService.updateSaveStatus('saved');
            uiService.showToast("Dossier mis à jour en temps réel.", 'success');
            
            // Réactiver la sauvegarde auto après un court délai
            setTimeout(() => {
                isLoadingData = false;
            }, 500);
        });
    }


    async function initialize() {
        try {
            const userData = await apiService.fetchUserPermissions();
            
            userPermissions.subscription = userData.subscription || 'free';
            userPermissions.allowedRooms = userData.allowedRooms || []; 

            if (userData.role === 'etudiant' && userData.permissions) {
                userPermissions = { ...userPermissions, ...userData.permissions, isStudent: true, role: 'etudiant' };
                patientList = userPermissions.allowedRooms
                    .map(roomId => ({ id: roomId, room: roomId.split('_')[1] }))
                    .sort((a, b) => a.room.localeCompare(b.room));
            } else {
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
                patientList = Array.from({ length: 10 }, (_, i) => ({
                    id: `chambre_${101 + i}`,
                    room: `${101 + i}`
                }));
            }
        } catch (error) {
            console.error("Échec critique de l'initialisation des permissions.", error);
            // MODIFIÉ : Garde l'alerte bloquante pour une erreur critique
            uiService.showCustomAlert("Erreur critique", "Impossible de charger les permissions utilisateur. L'application ne peut pas démarrer.");
            return; // MODIFIÉ : Retourne false au lieu de rien
        }

        // NOUVEAU : Initialiser le socket APRÈS avoir eu les permissions
        // Le plan 'free' n'a pas besoin de temps réel (car pas de sauvegarde)
        if (userPermissions.subscription !== 'free' || userPermissions.isStudent) {
            initializeSocket();
        }

        uiService.applyPermissions(userPermissions);

        if (userPermissions.isStudent && patientList.length === 0) {
            document.getElementById('patient-list').innerHTML = '<li class="p-2 text-sm text-gray-500">Aucune chambre ne vous a été assignée.</li>';
            document.getElementById('main-content-wrapper').innerHTML = '<div class="p-8 text-center text-gray-600">Aucune chambre ne vous a été assignée. Veuillez contacter votre formateur.</div>';
            document.querySelectorAll('#main-header button').forEach(btn => btn.disabled = true);
            return false; // MODIFIÉ : Retourne false
        }

        const storedPatientId = localStorage.getItem('activePatientId');
        if (storedPatientId && patientList.find(p => p.id === storedPatientId)) {
            activePatientId = storedPatientId;
        } else {
            activePatientId = patientList[0].id;
        }

        await loadPatientList();
        await switchPatient(activePatientId, true); 
        
        return true; 
    }
    
    async function loadPatientList() {
        let patientMap = new Map();
        // MODIFIÉ : Vérifie si l'utilisateur n'est pas 'free' OU s'il est étudiant
        if (userPermissions.subscription !== 'free' || userPermissions.isStudent) {
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
    
    async function switchPatient(newPatientId, skipSave = false) {
        if (!skipSave && activePatientId) {
            await saveCurrentPatientData();
        }
        
        isLoadingData = true;
        activePatientId = newPatientId;
        localStorage.setItem('activePatientId', newPatientId); 
        
        uiService.resetForm(); 
        
        try {
            currentPatientState = await apiService.fetchPatientData(newPatientId);
        } catch (error) {
            console.error(`Échec du chargement du patient ${newPatientId}`, error);
            currentPatientState = {}; 
        }
        
        loadPatientDataIntoUI(currentPatientState);
        
        uiService.updateSidebarActiveState(newPatientId);
        document.getElementById('main-content-wrapper').scrollTo({ top: 0, behavior: 'smooth' });
        
        uiService.applyPermissions(userPermissions);
        
        isLoadingData = false;
        uiService.updateSaveStatus('saved');
    }
    
    async function saveCurrentPatientData() {
        // ***** MODIFICATION : CONDITION MISE À JOUR *****
        if (isLoadingData || !activePatientId) {
            return;
        }
        // Cette logique permet aux étudiants (isStudent) de sauvegarder,
        // mais bloque les utilisateurs du plan "Free" qui ne sont pas étudiants.
        if (userPermissions.subscription === 'free' && !userPermissions.isStudent) {
            return;
        }
        // ***** FIN DE LA MODIFICATION *****

        uiService.updateSaveStatus('saving');
        
        const state = collectPatientStateFromUI();
        currentPatientState = state; 
        
        try {
            await apiService.saveChamberData(activePatientId, state, state.sidebar_patient_name);
            uiService.updateSidebarEntryName(activePatientId, state.sidebar_patient_name);
            uiService.updateSaveStatus('saved');
            
        } catch (error) {
            console.error("Échec de la sauvegarde :", error);
            
            uiService.updateSaveStatus('dirty');
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast("Erreur de sauvegarde. Vos modifications n'ont pas été enregistrées.", 'error');
        }
    }
    
    function debouncedSave() {
        if (!isLoadingData) {
            uiService.updateSaveStatus('dirty');
        }
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveCurrentPatientData();
        }, 500); 
    }
    
    async function forceSaveAndRefresh() {
        // ***** MODIFICATION : '!activePatientId' est la SEULE condition bloquante *****
        if (!activePatientId) return;

        // Force l'état de chargement à false pour "débloquer"
        isLoadingData = false; 
        // ***** FIN DE LA MODIFICATION *****

        console.log('Forçage de la sauvegarde et du rafraîchissement...');
        clearTimeout(saveTimeout); 
        
        await saveCurrentPatientData();
        
        uiService.updateSaveStatus('saving'); 
        
        setTimeout(async () => {
            await switchPatient(activePatientId, true); 
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast("Dossier synchronisé avec le serveur.");
        }, 250);
    }


    async function saveCurrentPatientAsCase() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            return;
        }

        const state = collectPatientStateFromUI();
        const patientName = state.sidebar_patient_name;

        if (!patientName || patientName.startsWith('Chambre ')) {
            // Garde l'alerte bloquante car c'est une erreur utilisateur
            uiService.showCustomAlert("Sauvegarde impossible", "Veuillez d'abord donner un Nom et un Prénom au patient dans l'en-tête.");
            return;
        }

        try {
            await apiService.saveCaseData(state, patientName);
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast(`Dossier "${patientName}" sauvegardé avec succès.`);
        } catch (error) {
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast(error.message, 'error');
        }
    }
    
    async function openLoadPatientModal() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            return;
        }

        let savedPatients = [];
        try {
            const allPatients = await apiService.fetchPatientList();
            savedPatients = allPatients.filter(p => p.patientId.startsWith('save_'));
        } catch (error) {
            // Garde l'alerte bloquante car la modale ne peut pas s'ouvrir
            uiService.showCustomAlert("Erreur", "Impossible de charger la liste des dossiers sauvegardés.");
        }
        
        uiService.openLoadPatientModal(savedPatients);
    }
    
    async function loadCaseIntoCurrentPatient(patientIdToLoadFrom, patientName) {
        const roomToLoadInto = activePatientId.split('_')[1];
        const message = `Êtes-vous sûr de vouloir écraser le dossier de la chambre ${roomToLoadInto} avec les données de "${patientName}" ?`;

        // Garde la confirmation bloquante
        uiService.showDeleteConfirmation(message, async () => {
            try {
                const dossierToLoad = await apiService.fetchPatientData(patientIdToLoadFrom);
                if (!dossierToLoad || Object.keys(dossierToLoad).length === 0) {
                    uiService.showCustomAlert("Erreur", "Le dossier que vous essayez de charger est vide.");
                    return;
                }

                const patientName = dossierToLoad.sidebar_patient_name;
                // MODIFIÉ : La sauvegarde déclenchera l'événement socket pour les autres
                await apiService.saveChamberData(activePatientId, dossierToLoad, patientName);

                uiService.hideLoadPatientModal();
                await switchPatient(activePatientId, true); 
                await loadPatientList(); 
                // MODIFIÉ : Remplacé showCustomAlert par showToast
                uiService.showToast(`Dossier "${patientName}" chargé dans la chambre ${roomToLoadInto}.`);

            } catch (err) {
                // MODIFIÉ : Remplacé showCustomAlert par showToast
                uiService.showToast(err.message, 'error');
            }
        });
    }

    async function deleteCase(patientIdToDelete, patientName) {
        // Garde la confirmation bloquante
        uiService.showDeleteConfirmation(`Êtes-vous sûr de vouloir supprimer la sauvegarde "${patientName}" ? Cette action est irréversible.`, async () => {
            try {
                await apiService.deleteSavedCase(patientIdToDelete);
                await openLoadPatientModal(); // Rafraîchit la liste
            } catch (err) {
                // MODIFIÉ : Remplacé showCustomAlert par showToast
                uiService.showToast(`Impossible de supprimer la sauvegarde: ${err.message}`, 'error');
            }
        });
    }

    async function importPatientData(jsonData) {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            return;
        }
        
        try {
            const patientName = jsonData.sidebar_patient_name || `Chambre ${activePatientId.split('_')[1]}`;
            // MODIFIÉ : La sauvegarde déclenchera l'événement socket pour les autres
            await apiService.saveChamberData(activePatientId, jsonData, patientName);
            
            await switchPatient(activePatientId, true); 
            await loadPatientList();
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast(`Fichier importé dans la chambre ${activePatientId.split('_')[1]}.`);

        } catch (error) {
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast(error.message, 'error');
        }
    }
    
    function exportPatientData() {
        if (userPermissions.isStudent || userPermissions.subscription === 'free') {
            // MODIFIÉ : Remplacé showCustomAlert par showToast
            uiService.showToast("L'exportation n'est pas disponible avec votre plan.", 'error');
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
    
    function clearCurrentPatient() {
        if (userPermissions.isStudent) return;
        
        const message = `Êtes-vous sûr de vouloir effacer les données de la chambre ${activePatientId.split('_')[1]} ? Les données sauvegardées sur le serveur pour cette chambre seront aussi réinitialisées.`;
        // Garde la confirmation bloquante
        uiService.showDeleteConfirmation(message, async () => {
            currentPatientState = {}; 
            uiService.resetForm();
            
            if (userPermissions.subscription === 'free') {
                return;
            }
            
            try {
                uiService.updateSaveStatus('saving');
                // MODIFIÉ : La sauvegarde déclenchera l'événement socket pour les autres
                await apiService.saveChamberData(activePatientId, {}, `Chambre ${activePatientId.split('_')[1]}`);
                uiService.updateSidebarEntryName(activePatientId, `Chambre ${activePatientId.split('_')[1]}`);
                uiService.updateSaveStatus('saved');
            } catch (err) {
                // MODIFIÉ : Remplacé showCustomAlert par showToast
                uiService.showToast("Impossible de réinitialiser la chambre sur le serveur.", 'error');
                uiService.updateSaveStatus('dirty'); 
            }
        });
    }

    function clearAllPatients() {
        if (userPermissions.isStudent) return;

        const message = "ATTENTION : Vous êtes sur le point de réinitialiser les 10 chambres du service sur le serveur. Les sauvegardes de cas ne sont pas affectées. Continuer ?";
        
        // Garde la confirmation bloquante
        uiService.showDeleteConfirmation(message, async () => {
            currentPatientState = {};
            uiService.resetForm();

            if (userPermissions.subscription === 'free') {
                return;
            }
            
            try {
                uiService.updateSaveStatus('saving');
                const allChamberIds = patientList.map(p => p.id);
                // MODIFIÉ : Ceci déclenchera 10 événements socket
                await apiService.clearAllChamberData(allChamberIds);
                await loadPatientList(); 
                // MODIFIÉ : Remplacé showCustomAlert par showToast
                uiService.showToast("Toutes les chambres ont été réinitialisées.");
                uiService.updateSaveStatus('saved');
            } catch (err) {
                 // MODIFIÉ : Remplacé showCustomAlert par showToast
                 uiService.showToast("Une erreur est survenue lors de la réinitialisation.", 'error');
                 uiService.updateSaveStatus('dirty');
            }
        });
    }

    // --- Fonctions de logique métier (Comptes Rendus) ---

    function getCrText(crId) {
        if (currentPatientState.comptesRendus && currentPatientState.comptesRendus[crId]) {
            return currentPatientState.comptesRendus[crId];
        }
        return '';
    }

    function handleCrModalSave(crId, crText) {
        if (!currentPatientState.comptesRendus) {
            currentPatientState.comptesRendus = {};
        }
        
        currentPatientState.comptesRendus[crId] = crText;
        
        uiService.updateCrCardCheckmark(crId, crText && crText.trim() !== '');
        
        uiService.closeCrModal();
        debouncedSave(); 
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
        forceSaveAndRefresh, 
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