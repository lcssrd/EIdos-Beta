(function() {
    "use strict";

    /**
     * Point d'entrée principal de l'application.
     * S'exécute lorsque le DOM est chargé.
     */
    async function initApp() {
        // 1. Initialiser les composants UI (références DOM pour les modales, etc.)
        uiService.initUIComponents();
        uiService.setupModalListeners(); // Configure les boutons "OK/Annuler" des modales

        // 2. Initialiser le service patient (permissions, liste des patients, patient actif)
        const initialized = await patientService.initialize();
        
        // 3. Si l'initialisation échoue (ex: étudiant sans chambre), arrêter ici.
        if (!initialized) {
            console.warn("Initialisation du patientService arrêtée (ex: étudiant sans chambre).");
            // Les écouteurs de base (logout, etc.) sont quand même attachés
            setupBaseEventListeners();
            return;
        }

        // 4. Configurer tous les écouteurs d'événements
        setupEventListeners();

        // 5. Charger le premier onglet (lu depuis localStorage)
        const activeTabId = localStorage.getItem('activeTab') || 'administratif';
        uiService.changeTab(activeTabId);
        
        // 6. Démarrer le tutoriel si c'est la première visite
        if (!localStorage.getItem('tutorialCompleted')) {
            setTimeout(uiService.startTutorial, 500);
        }
    }

    /**
     * Configure les écouteurs de base (toujours actifs, même si l'init échoue).
     */
    function setupBaseEventListeners() {
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('activePatientId');
            localStorage.removeItem('activeTab');
            window.location.href = 'auth.html';
        });

        document.getElementById('account-management-btn')?.addEventListener('click', (e) => {
            if (patientService.getUserPermissions().isStudent) {
                e.preventDefault();
            }
        });

        document.getElementById('toggle-fullscreen-btn')?.addEventListener('click', uiService.toggleFullscreen);
    }

    /**
     * Configure tous les écouteurs d'événements pour l'application principale.
     */
    function setupEventListeners() {
        
        // --- Écouteurs de base (redondant mais sûr) ---
        setupBaseEventListeners();
        
        // --- Header (Sauvegarde, Chargement, etc.) ---
        document.getElementById('start-tutorial-btn').addEventListener('click', uiService.startTutorial);
        document.getElementById('clear-all-data-btn').addEventListener('click', patientService.clearAllPatients);
        document.getElementById('save-patient-btn').addEventListener('click', patientService.saveCurrentPatientAsCase);
        document.getElementById('load-patient-btn').addEventListener('click', patientService.openLoadPatientModal);
        document.getElementById('export-json-btn').addEventListener('click', patientService.exportPatientData);
        document.getElementById('clear-current-patient-btn').addEventListener('click', patientService.clearCurrentPatient);

        // --- Importation de fichier ---
        document.getElementById('import-json-btn').addEventListener('click', () => {
            if (!patientService.getUserPermissions().isStudent && patientService.getUserPermissions().subscription !== 'free') {
                document.getElementById('import-file').click();
            }
        });
        document.getElementById('import-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    patientService.importPatientData(jsonData);
                } catch (error) {
                    uiService.showCustomAlert("Erreur de Fichier", `Le fichier n'est pas un JSON valide: ${error.message}`);
                }
            };
            reader.readAsText(file);
            event.target.value = ''; // Permet de ré-importer le même fichier
        });
        
        // --- Navigation (Onglets & Patients) ---
        document.getElementById('tabs-nav').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-tab-id]');
            if (button) {
                uiService.changeTab(button.dataset.tabId);
            }
        });
        
        document.getElementById('patient-list').addEventListener('click', (e) => {
            const button = e.target.closest('button[data-patient-id]');
            if (button) {
                patientService.switchPatient(button.dataset.patientId);
            }
        });
        
        // --- Sauvegarde automatique (Debounce) ---
        const mainContent = document.querySelector('main');
        mainContent.addEventListener('input', patientService.debouncedSave);
        mainContent.addEventListener('change', patientService.debouncedSave);

        // --- Mises à jour auto de l'UI (Header & Vie) ---
        document.getElementById('patient-entry-date').addEventListener('input', () => {
            uiService.updateJourHosp();
            uiService.refreshAllRelativeDates();
        });
        document.getElementById('patient-dob').addEventListener('input', uiService.updateAgeDisplay);
        document.getElementById('admin-dob').addEventListener('input', uiService.updateAgeDisplay);
        document.getElementById('vie-poids').addEventListener('input', uiService.calculateAndDisplayIMC);
        document.getElementById('vie-taille').addEventListener('input', uiService.calculateAndDisplayIMC);

        // --- Ajout d'entrées (Observations, Transmissions, etc.) ---
        document.getElementById('add-observation-btn').addEventListener('click', () => {
            const data = uiService.readObservationForm();
            if (data) uiService.addObservation(data, false);
        });
        document.getElementById('add-transmission-btn').addEventListener('click', () => {
            const data = uiService.readTransmissionForm();
            if (data) uiService.addTransmission(data, false);
        });
        document.getElementById('add-prescription-btn').addEventListener('click', () => {
            const data = uiService.readPrescriptionForm();
            if (data) uiService.addPrescription(data, false);
        });
        document.getElementById('add-care-diagram-btn').addEventListener('click', () => {
            const data = uiService.readCareDiagramForm();
            if (data) uiService.addCareDiagramRow(data);
        });
        
        // --- Boutons de tri ---
        document.getElementById('sort-observations-btn').addEventListener('click', () => uiService.toggleSort('observations'));
        document.getElementById('sort-transmissions-btn').addEventListener('click', () => uiService.toggleSort('transmissions'));

        // --- Suppression d'entrées (Listes) ---
        document.getElementById('observations-list').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn && !patientService.getUserPermissions().isStudent) { // TODO: Gérer perm
                uiService.showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer cette entrée ?", () => {
                    if (uiService.deleteEntry(deleteBtn)) patientService.debouncedSave();
                });
            }
        });
        document.getElementById('transmissions-list-ide').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn && !patientService.getUserPermissions().isStudent) { // TODO: Gérer perm
                uiService.showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer cette entrée ?", () => {
                    if (uiService.deleteEntry(deleteBtn)) patientService.debouncedSave();
                });
            }
        });
        
        // --- Suppression d'entrées (Tables) ---
        document.getElementById('prescription-tbody').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn && !patientService.getUserPermissions().isStudent) { // TODO: Gérer perm
                uiService.showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer cette prescription ?", () => {
                    if (uiService.deletePrescription(deleteBtn)) patientService.debouncedSave();
                });
            }
        });
        document.getElementById('care-diagram-tbody').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn && !patientService.getUserPermissions().isStudent) { // TODO: Gérer perm
                uiService.showDeleteConfirmation("Êtes-vous sûr de vouloir supprimer ce soin ?", () => {
                    if (uiService.deleteCareDiagramRow(deleteBtn)) patientService.debouncedSave();
                });
            }
        });
        
        // --- Pancarte (Graphique) ---
        document.getElementById('pancarte-tbody').addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT') uiService.updatePancarteChart();
        });
        
        // --- Logique Comptes Rendus (CR) ---
        document.getElementById('cr-card-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.cr-card');
            if (!card) return;
            
            const crId = card.dataset.crId;
            const crTitle = card.dataset.crTitle;
            const crText = patientService.getCrText(crId);
            
            uiService.openCrModal(crId, crTitle, crText);
        });
        
        document.getElementById('cr-modal-save-btn').addEventListener('click', () => {
            const crId = document.getElementById('cr-modal-active-id').value;
            const crText = document.getElementById('cr-modal-textarea').value;
            patientService.handleCrModalSave(crId, crText);
        });

        // --- Logique Barres IV ---
        document.addEventListener('mousedown', uiService.handleIVMouseDown);
        document.addEventListener('mousemove', uiService.handleIVMouseMove);
        document.addEventListener('mouseup', uiService.handleIVMouseUp);
        
        // Écouteur personnalisé pour déclencher une sauvegarde (utilisé par les barres IV)
        document.addEventListener('uiNeedsSave', patientService.debouncedSave);

        // --- Tutoriel ---
        document.getElementById('tutorial-overlay').addEventListener('click', () => uiService.endTutorial(true));
        document.getElementById('tutorial-step-box').addEventListener('click', (e) => e.stopPropagation());
        document.getElementById('tutorial-skip-btn').addEventListener('click', () => uiService.endTutorial(true));
        document.getElementById('tutorial-next-btn').addEventListener('click', uiService.incrementTutorialStep);

        // --- Modale "Charger Patient" ---
        document.getElementById('load-patient-list-container').addEventListener('click', async (e) => {
            const loadBtn = e.target.closest('.load-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (loadBtn) {
                const id = loadBtn.dataset.patientId;
                const name = loadBtn.closest('.flex').querySelector('.font-medium').textContent;
                patientService.loadCaseIntoCurrentPatient(id, name);
            }
            if (deleteBtn) {
                const id = deleteBtn.dataset.patientId;
                const name = deleteBtn.dataset.patientName;
                patientService.deleteCase(id, name);
            }
        });
    }

    // Lancer l'application
    document.addEventListener('DOMContentLoaded', initApp);

})();