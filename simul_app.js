/*
    EIdos - Simulation de Dossier Patient
    Logique applicative
    
    Ce fichier contient toute la logique de l'application EIdos.
    Il est encapsulé dans un objet 'EIdosApp' pour éviter de polluer
    le scope global et améliorer la maintenabilité.
*/

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ET CONSTANTES ---

    // Configuration de la liste des patients
    const PATIENTS = Array.from({ length: 10 }, (_, i) => ({
        id: `chambre_${101 + i}`,
        room: `${101 + i}`
    }));

    // Configuration des tables de biologie
    const BIO_TABLE_CONFIG = {
        "Numération Formule Sanguine (NFS)": {
            "Hématies (T/L)": "4.5-5.5",
            "Hémoglobine (g/dL)": "13-17",
            "Hématocrite (%)": "40-52",
            "VGM (fL)": "80-100",
            "Leucocytes (G/L)": "4-10",
            "Plaquettes (G/L)": "150-400"
        },
        "Bilan Électrolytique": {
            "Sodium (mmol/L)": "136-145",
            "Potassium (mmol/L)": "3.5-5.1",
            "Chlore (mmol/L)": "98-107",
            "Bicarbonates (mmol/L)": "22-29",
            "Urée (mmol/L)": "2.8-7.2",
            "Créatinine (µmol/L)": "62-106"
        },
        "Bilan Hépatique": {
            "ASAT (UI/L)": "< 40",
            "ALAT (UI/L)": "< 41",
            "Gamma-GT (UI/L)": "11-50",
            "PAL (UI/L)": "40-129",
            "Bilirubine totale (µmol/L)": "5-21"
        },
        "Bilan Lipidique": {
            "Cholestérol total (g/L)": "< 2.0",
            "Triglycérides (g/L)": "< 1.5",
            "HDL Cholestérol (g/L)": "> 0.4",
            "LDL Cholestérol (g/L)": "< 1.6"
        },
        "Gaz du Sang (artériel)": {
            "pH": "7.35-7.45",
            "PaCO2 (mmHg)": "35-45",
            "PaO2 (mmHg)": "80-100",
            "HCO3- (mmol/L)": "22-26",
            "SaO2 (%)": "> 95"
        }
    };

    // Configuration des lignes de la pancarte
    const PANCARTE_PARAMS = {
        'Pouls (/min)': { type: 'text' },
        'Tension (mmHg)': { type: 'text' },
        'Température (°C)': { type: 'number', step: '0.1' },
        'SpO2 (%)': { type: 'text' },
        'Douleur (EVA /10)': { type: 'text' }
    };
    
    // Configuration du graphique Pancarte
    const PANCARTE_CHART_CONFIG = {
        'Pouls (/min)': { yAxisID: 'y1', borderColor: '#ef4444' },
        'Tension (mmHg)': { type: 'bar', yAxisID: 'y', backgroundColor: '#f9731640' },
        'Température (°C)': { yAxisID: 'y3', borderColor: '#3b82f6' },
        'SpO2 (%)': { yAxisID: 'y4', borderColor: '#10b981' },
        'Douleur (EVA /10)': { yAxisID: 'y2', borderColor: '#8b5cf6' }
    };

    // Configuration des étapes du tutoriel
    const TUTORIAL_STEPS = [
        {
            element: '#patient-list li:first-child button',
            text: "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier. (Vous pouvez remplir le dossier pour voir un nom ici).",
            position: 'right',
            fallback: { // Au cas où la liste est vide
                element: '#sidebar',
                text: "Bienvenue ! Voici la barre latérale où les patients apparaîtront. Vous pouvez commencer par remplir les dossiers.",
            }
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
            element: '#header-buttons button[title*="Exporter"]',
            text: "Ce bouton vous permet d'exporter le dossier du patient actuel au format JSON, pour le sauvegarder ou le partager.",
            position: 'bottom-left'
        },
        {
            element: '#header-buttons button[title*="Importer"]',
            text: "Utilisez ce bouton pour importer un fichier JSON et charger les données d'un patient dans ce dossier.",
            position: 'bottom-left'
        },
        {
            element: '#header-buttons button[title*="Effacer"]',
            text: "Attention : Ce bouton efface toutes les données du patient actuellement sélectionné.",
            position: 'bottom-left'
        },
        {
            element: 'button[onclick*="clearAllData"]',
            text: "ATTENTION : Ce bouton supprime DÉFINITIVEMENT tous les dossiers de tous les patients. À n'utiliser que pour réinitialiser la simulation.",
            position: 'top'
        },
        {
            element: 'button[onclick*="startTutorial"]',
            text: "Vous avez terminé ! Vous pouvez relancer ce tutoriel à tout moment en cliquant sur ce bouton.",
            position: 'top'
        }
    ];

    // --- OBJET PRINCIPAL DE L'APPLICATION ---

    window.EIdosApp = {
        
        // --- État de l'application ---
        pancarteChartInstance: null,
        activePatientId: null,
        ivInteraction: {
            active: false,
            mode: null,
            targetBar: null,
            targetCell: null,
            startX: 0,
            startLeft: 0,
            startWidth: 0,
        },
        tutorialState: {
            currentStepIndex: 0,
            highlightedElement: null,
        },
        confirmCallback: null,
        saveTimeout: null,

        // --- Initialisation ---

        /**
         * Initialise l'application au chargement de la page.
         */
        init: function() {
            this.activePatientId = localStorage.getItem('activePatientId') || PATIENTS[0].id;

            this.initDynamicTables();
            this.initSidebar();
            this.setupListeners();
            
            this.switchPatient(this.activePatientId, true); // true = skip save on init
            
            this.setupSync();

            // Restaurer le dernier onglet actif
            const activeTabId = localStorage.getItem('activeTab') || 'administratif';
            const activeTabButton = document.querySelector(`nav button[onclick*="'${activeTabId}'"]`);
            if (activeTabButton) {
                this.changeTab({ currentTarget: activeTabButton }, activeTabId);
            } else {
                document.querySelector('nav[aria-label="Tabs"] button').click();
            }

            // Lancement automatique du tutoriel
            if (!localStorage.getItem('tutorialCompleted')) {
                setTimeout(() => this.startTutorial(), 500);
            }
        },

        /**
         * Met en place les écouteurs d'événements globaux.
         */
        setupListeners: function() {
            // Sauvegarde décalée (debounce)
            const debouncedSave = () => {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => this.saveData(), 500);
            };
            document.querySelector('main').addEventListener('input', debouncedSave);
            document.querySelector('main').addEventListener('change', debouncedSave);

            // Listeners pour la modal de confirmation
            document.getElementById('custom-confirm-ok').addEventListener('click', () => {
                if (typeof this.confirmCallback === 'function') {
                    this.confirmCallback();
                }
                this.hideConfirmation();
            });
            document.getElementById('custom-confirm-cancel').addEventListener('click', () => this.hideConfirmation());
            
            // Listeners pour l'interaction avec les barres IV (drag/resize)
            document.addEventListener('mousemove', this.handleIVMouseMove.bind(this));
            document.addEventListener('mouseup', this.handleIVMouseUp.bind(this));

            // Listener pour le champ "Date d'entrée"
            document.getElementById('patient-entry-date').addEventListener('input', () => this.updateJourHosp());
            
            // Listener pour le bouton "Suivant" du tutoriel
             document.getElementById('tutorial-next-btn').addEventListener('click', () => {
                this.tutorialState.currentStepIndex++;
                this.showTutorialStep(this.tutorialState.currentStepIndex);
            });
        },
        
        // --- Génération des Tableaux Dynamiques ---
        
        /**
         * Appelle toutes les fonctions de génération de tableaux.
         */
        initDynamicTables: function() {
            this.generatePrescriptionHeaders();
            this.generatePancarteHeadersAndRows();
            this.generateDiagramHeaders();
            this.generateBioTable();
        },
        
        /**
         * Génère les en-têtes du tableau des prescriptions.
         */
        generatePrescriptionHeaders: function() {
            const thead = document.getElementById('prescription-table').querySelector('thead');
            let headerRow1 = `
                <tr>
                    <th class="p-2 text-left align-bottom" rowspan="2">Médicament / Soin</th>
                    <th class="p-2 text-left align-bottom" rowspan="2">Posologie</th>
                    <th class="p-2 text-left align-bottom" rowspan="2">Voie</th>
                    <th class="p-2 text-left align-bottom" rowspan="2">Date de début</th>`;
            let headerRow2 = '<tr>';
            
            for(let i=0; i<11; i++) {
                headerRow1 += `<th class="p-2 text-center" colspan="4">Jour ${i}</th>`;
                headerRow2 += `<th class="p-1 text-center w-8">M</th><th class="p-1 text-center w-8">Mi</th><th class="p-1 text-center w-8">S</th><th class="p-1 text-center w-8">N</th>`;
            }
            headerRow1 += '</tr>';
            headerRow2 += '</tr>';
            thead.innerHTML = headerRow1 + headerRow2;
        },

        /**
         * Génère les en-têtes et les lignes du tableau de la pancarte.
         */
        generatePancarteHeadersAndRows: function() {
            const table = document.getElementById('pancarte-table');
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            
            let headerRow1 = '<tr><th class="p-2 text-left" rowspan="2">Paramètres</th>';
            let headerRow2 = '<tr>';
            
            for(let i=0; i<11; i++) {
                headerRow1 += `<th class="p-2 text-center" colspan="3">Jour ${i}</th>`;
                headerRow2 += `<th class="p-1 w-32">Matin</th><th class="p-1 w-32">Soir</th><th class="p-1 w-32">Nuit</th>`;
            }
            headerRow1 += '</tr>';
            headerRow2 += '</tr>';
            thead.innerHTML = headerRow1 + headerRow2;
            
            tbody.innerHTML = ''; // Clear body
            for (const [param, config] of Object.entries(PANCARTE_PARAMS)) {
                let row = `<tr><td class="p-2 text-left font-semibold">${param}</td>`;
                let inputHtml = `<input type="${config.type}" ${config.step ? `step="${config.step}"` : ''} value="" onchange="EIdosApp.updatePancarteChart()">`;
                for(let i=0; i<33; i++) {
                    row += `<td class="p-0">${inputHtml}</td>`;
                }
                row += `</tr>`;
                tbody.innerHTML += row;
            }
        },

        /**
         * Génère les en-têtes du diagramme de soins.
         */
        generateDiagramHeaders: function() {
            const thead = document.getElementById('care-diagram-table').querySelector('thead');
            let headerRow1 = '<tr><th class="p-2 text-left">Soin / Surveillance</th>';
            let headerRow2 = '<tr><th></th>';
            
            for(let i=0; i<11; i++) {
                headerRow1 += `<th colspan="3" class="border-l">Jour ${i}</th>`;
                headerRow2 += `<th class="border-l">M</th><th>S</th><th>N</th>`;
            }
            headerRow1 += '</tr>';
            headerRow2 += '</tr>';
            thead.innerHTML = headerRow1 + headerRow2;
        },
        
        /**
         * Génère le contenu du tableau de biologie à partir de la config.
         */
        generateBioTable: function() {
            const table = document.getElementById('bio-table');
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');

            let dateHeaders = '';
            for(let i=0; i<6; i++) {
                dateHeaders += `<th class="p-1"><input type="text" placeholder="JJ/MM/AA" class="font-semibold text-center w-24 bg-transparent"></th>`;
            }
            thead.querySelector('tr').innerHTML = `
                <th class="p-2 text-left w-1/4">Analyse</th>
                <th class="p-2 text-left w-1/4">Valeurs de référence</th>
                ${dateHeaders}
            `;
            
            tbody.innerHTML = ''; // Clear body
            for (const [sectionTitle, items] of Object.entries(BIO_TABLE_CONFIG)) {
                let sectionHtml = `<tr class="font-bold bg-purple-50 text-left"><td class="p-2" colspan="8">${sectionTitle}</td></tr>`;
                for (const [key, value] of Object.entries(items)) {
                    sectionHtml += `<tr><td class="p-2 text-left font-semibold">${key}</td><td class="p-2 text-left text-xs">${value}</td>`;
                    for(let i=0; i<6; i++) {
                        sectionHtml += '<td class="p-0"><input type="text"></td>';
                    }
                    sectionHtml += '</tr>';
                }
                tbody.innerHTML += sectionHtml;
            }
        },

        // --- Gestion des Données (Sauvegarde/Chargement) ---

        /**
         * Récupère la clé de sauvegarde pour un patient donné.
         */
        getSaveKey: function(patientId) {
            return `dossierPatientData_${patientId}`;
        },

        /**
         * Sauvegarde les données du patient actif dans le localStorage.
         */
        saveData: function() {
            const patientId = this.activePatientId;
            if (!patientId) return;
            
            const SAVE_KEY = this.getSaveKey(patientId);
            const state = {};

            // Sauvegarder tous les inputs et textareas avec un ID
            document.querySelectorAll('input[id], textarea[id]').forEach(el => {
                const id = el.id;
                if (el.type === 'checkbox' || el.type === 'radio') {
                    state[id] = el.checked;
                } else {
                    state[id] = el.value;
                }
            });

            // Sauvegarder le HTML du contenu dynamique
            const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
            dynamicContentIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) state[id + '_html'] = el.innerHTML;
            });

            // Sauvegarder les tables spécifiques
            state.bioTableValues = Array.from(document.querySelectorAll('#bio-table tbody input[type="text"]')).map(input => input.value);
            state.bioTableDateHeaders = Array.from(document.querySelectorAll('#bio-table thead input[type="text"]')).map(input => input.value);
            state.pancarteValues = Array.from(document.querySelectorAll('#pancarte-table tbody input')).map(input => input.value);
            
            // Sauvegarder les prescriptions (gère les checkboxes et les barres IV)
            state.prescriptions = [];
            document.querySelectorAll('#prescription-tbody tr').forEach(row => {
                const isIV = row.dataset.type === 'iv';
                const prescriptionData = {
                    name: row.cells[0].querySelector('span').textContent,
                    posologie: row.cells[1].textContent,
                    voie: row.cells[2].textContent,
                    startDate: row.cells[3].textContent,
                    type: isIV ? 'iv' : 'checkbox'
                };

                if (isIV) {
                    prescriptionData.bars = Array.from(row.querySelectorAll('.iv-bar')).map(bar => ({
                        left: bar.style.left,
                        width: bar.style.width,
                        title: bar.title
                    }));
                } else {
                    prescriptionData.checkboxes = Array.from(row.querySelectorAll('input[type="checkbox"]')).map(cb => cb.checked);
                }
                state.prescriptions.push(prescriptionData);
            });
            
            // Sauvegarder l'état des boutons de verrouillage
            state.lockButtonStates = {};
            document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
                state.lockButtonStates[btn.id] = btn.innerHTML.includes('fa-lock');
            });

            // Sauvegarder le nom pour la sidebar
            const nomUsage = document.getElementById('patient-nom-usage').value.trim();
            const prenom = document.getElementById('patient-prenom').value.trim();
            const patientName = `${nomUsage} ${prenom}`.trim();
            state['sidebar_patient_name'] = patientName;
            
            // Écrire dans localStorage
            localStorage.setItem(SAVE_KEY, JSON.stringify(state));

            // Mettre à jour la sidebar
            const sidebarEntry = document.querySelector(`#patient-list button[data-patient-id="${patientId}"] .patient-name`);
            if (sidebarEntry) {
                sidebarEntry.textContent = patientName || `Chambre ${patientId.split('_')[1]}`;
            }
        },

        /**
         * Charge les données du patient actif depuis le localStorage.
         */
        loadData: function() {
            const patientId = this.activePatientId;
            if (!patientId) return;

            const SAVE_KEY = this.getSaveKey(patientId);
            const savedState = localStorage.getItem(SAVE_KEY);

            if (!savedState || savedState === '{}') {
                this.resetForm(); // Réinitialise si pas de données
            } else {
                const state = JSON.parse(savedState);
                
                // Restaurer tous les inputs et textareas
                Object.keys(state).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (el.type === 'checkbox' || el.type === 'radio') {
                            el.checked = state[id];
                        } else {
                            el.value = state[id];
                        }
                    }
                });

                // Restaurer le contenu HTML dynamique
                const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
                dynamicContentIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && state[id + '_html']) {
                        el.innerHTML = state[id + '_html'];
                    }
                });

                // Restaurer les prescriptions
                if (state.prescriptions) {
                    const tbody = document.getElementById('prescription-tbody');
                    tbody.innerHTML = '';
                    state.prescriptions.forEach(pData => {
                        this.addPrescription(pData, true); // true = fromLoad
                    });
                }

                // Restaurer les tables spécifiques
                if (state.bioTableValues) {
                    document.querySelectorAll('#bio-table tbody input[type="text"]').forEach((input, index) => {
                        input.value = state.bioTableValues[index] || '';
                    });
                }
                if (state.bioTableDateHeaders) {
                    document.querySelectorAll('#bio-table thead input[type="text"]').forEach((input, index) => {
                        input.value = state.bioTableDateHeaders[index] || '';
                    });
                }
                if (state.pancarteValues) {
                    document.querySelectorAll('#pancarte-table tbody input').forEach((input, index) => {
                        input.value = state.pancarteValues[index] || '';
                    });
                }
                
                // Mettre à jour les dates dynamiques si la date d'entrée existe
                const entryDateValue = document.getElementById('patient-entry-date').value;
                if (entryDateValue) {
                    const entryDate = new Date(entryDateValue);
                    if (!isNaN(entryDate.getTime())) {
                        this.updateDynamicDates(entryDate);
                    }
                }
                
                // Restaurer l'état des boutons de verrouillage
                if (state.lockButtonStates) {
                    Object.keys(state.lockButtonStates).forEach(buttonId => {
                        if (state.lockButtonStates[buttonId]) {
                            const button = document.getElementById(buttonId);
                            if (button && button.innerHTML.includes('fa-check')) { // S'il est déverrouillé
                                let containerId;
                                if (buttonId === 'lock-header-btn') containerId = 'patient-header-form';
                                if (buttonId === 'lock-admin-btn') containerId = 'administratif';
                                if (buttonId === 'lock-vie-btn') containerId = 'mode-de-vie';
                                if (containerId) this.toggleLock(containerId, buttonId); // Le re-verrouiller
                            }
                        }
                    });
                }
            }
            
            // Mettre à jour l'âge et le jour d'hospitalisation
            this.updateAgeDisplay();
            this.updateJourHosp();
        },

        /**
         * Réinitialise tous les champs du formulaire principal.
         */
        resetForm: function() {
            document.querySelectorAll('main input, main textarea').forEach(el => {
                if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
                else if (el.type !== 'file') el.value = '';
            });
            
            // Vider les listes dynamiques (sauf la structure de base du diagramme de soins)
            ['observations-list', 'transmissions-list-ide', 'prescription-tbody'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
            // Réinitialiser le diagramme de soins plus spécifiquement
            document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]').forEach(cb => cb.checked = false);
            document.querySelectorAll('#care-diagram-tbody tr').forEach(row => {
                // Supprimer les lignes ajoutées dynamiquement (celles qui n'ont pas de classe 'bg-blue-50' ou de texte fixe)
                if(!row.classList.contains('font-bold') && !row.querySelector('td')?.textContent.includes('Toilette')) {
                     // Logique de suppression plus ciblée si nécessaire, pour l'instant on reset juste les inputs
                }
            });
            
            // Réinitialiser les tables de bio et pancarte (qui sont générées par JS)
            this.generateBioTable();
            this.generatePancarteHeadersAndRows();

            // Déverrouiller tous les boutons
            document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
                if (btn.innerHTML.includes('fa-lock')) { // S'il est verrouillé
                    btn.click(); // Simule un clic pour le déverrouiller
                }
            });

            if (this.pancarteChartInstance) {
                this.pancarteChartInstance.destroy();
                this.pancarteChartInstance = null;
            }
        },

        // --- Gestion des Patients et Sidebar ---

        /**
         * Initialise la liste des patients dans la sidebar.
         */
        initSidebar: function() {
            const list = document.getElementById('patient-list');
            let listHTML = '';
            PATIENTS.forEach(patient => {
                const savedState = JSON.parse(localStorage.getItem(this.getSaveKey(patient.id)) || '{}');
                const patientName = savedState.sidebar_patient_name || `Chambre ${patient.room}`;
                listHTML += `
                    <li class="mb-1">
                        <button type="button" data-patient-id="${patient.id}" onclick="EIdosApp.switchPatient('${patient.id}')">
                            <span class="patient-icon"><i class="fas fa-bed"></i></span>
                            <span class="patient-name">${patientName}</span>
                            <span class="patient-room">${patient.room}</span>
                        </button>
                    </li>`;
            });
            list.innerHTML = listHTML;
        },

        /**
         * Met à jour l'état actif dans la sidebar.
         */
        updateSidebarActiveState: function(patientId) {
            document.querySelectorAll('#patient-list button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.patientId === patientId) {
                    btn.classList.add('active');
                }
            });
        },

        /**
         * Change le patient actif.
         */
        switchPatient: function(newPatientId, skipSave = false) {
            if (this.activePatientId !== newPatientId && !skipSave) {
                this.saveData();
            }
            this.activePatientId = newPatientId;
            localStorage.setItem('activePatientId', newPatientId);
            
            this.resetForm();
            this.loadData();
            this.updateSidebarActiveState(newPatientId);
            
            // Redimensionner les textareas après le chargement
            setTimeout(() => {
                document.querySelectorAll('textarea.info-value').forEach(ta => this.autoResize(ta));
            }, 0);

            this.updatePancarteChart();
            
            // Remonter en haut de la page de contenu
            const mainContent = document.getElementById('main-content-wrapper');
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        },

        // --- Actions (Import/Export/Suppression) ---

        /**
         * Efface les données du patient actuel.
         */
        clearCurrentPatientData: function() {
            const message = `Êtes-vous sûr de vouloir effacer le dossier du patient dans la chambre ${this.activePatientId.split('_')[1]} ? Cette action est irréversible.`;
            this.showCustomModal('Confirmation de suppression', message, 'confirm', () => {
                localStorage.removeItem(this.getSaveKey(this.activePatientId));
                this.switchPatient(this.activePatientId, true); // true = skip save
            });
        },

        /**
         * Efface TOUTES les données de TOUS les patients.
         */
        clearAllData: function() {
            const message = "ATTENTION : Vous êtes sur le point de supprimer TOUS les dossiers de tous les patients. Cette action est irréversible. Continuer ?";
            this.showCustomModal('Suppression Totale', message, 'confirm', () => {
                localStorage.clear();
                location.reload();
            });
        },

        /**
         * Exporte les données du patient actuel en fichier JSON.
         */
        exportCurrentPatientData: function() {
            this.saveData(); // Assure que les dernières données sont sauvegardées
            const SAVE_KEY = this.getSaveKey(this.activePatientId);
            const dataStr = localStorage.getItem(SAVE_KEY);
            if (!dataStr || dataStr === '{}') {
                this.showCustomModal('Exportation impossible', 'Le dossier est vide, rien à exporter.', 'alert', null, 'OK');
                return;
            }
            
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const patientName = (document.getElementById('patient-nom-usage').value.trim() || this.activePatientId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.download = `dossier_${patientName}.json`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
        },

        /**
         * Importe un fichier JSON pour le patient actuel.
         */
        importCurrentPatientData: function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    JSON.parse(content); // Valide que c'est bien du JSON
                    const SAVE_KEY = this.getSaveKey(this.activePatientId);
                    localStorage.setItem(SAVE_KEY, content);
                    location.reload(); // Recharge pour appliquer les nouvelles données
                } catch (error) {
                    this.showCustomModal('Erreur d\'importation', 'Le fichier sélectionné n\'est pas un fichier JSON valide ou est corrompu.', 'alert', null, 'OK');
                }
            };
            reader.readText(file);
            event.target.value = ''; // Réinitialise le champ d'upload
        },

        // --- Gestion de l'Interface (Tabs, Modals, Locks) ---
        
        /**
         * Affiche une modal personnalisée (confirmation ou alerte).
         * @param {string} title - Le titre de la modal.
         * @param {string} message - Le message à afficher.
         * @param {string} type - 'confirm' (par défaut) ou 'alert'.
         * @param {function} okCallback - Fonction à appeler si on clique sur OK.
         * @param {string} okText - Texte pour le bouton OK (optionnel).
         */
        showCustomModal: function(title, message, type = 'confirm', okCallback = null, okText = 'Confirmer') {
            const modal = document.getElementById('custom-confirm-modal');
            const modalBox = document.getElementById('custom-confirm-box');
            const modalTitle = document.getElementById('custom-confirm-title');
            const modalMessage = document.getElementById('custom-confirm-message');
            const okButton = document.getElementById('custom-confirm-ok');
            const cancelButton = document.getElementById('custom-confirm-cancel');

            modalTitle.textContent = title;
            modalMessage.textContent = message;
            
            this.confirmCallback = okCallback; // Utilise la variable existante

            if (type === 'alert') {
                cancelButton.classList.add('hidden');
                okButton.textContent = okText || 'OK';
                okButton.classList.remove('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
                okButton.classList.add('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
            } else { // 'confirm'
                cancelButton.classList.remove('hidden');
                okButton.textContent = okText || 'Confirmer';
                // Assurer que les classes de danger sont là pour la confirmation de suppression
                okButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
                okButton.classList.add('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
            }

            modal.classList.remove('hidden');
            setTimeout(() => {
                modalBox.classList.remove('scale-95', 'opacity-0');
            }, 10);
        },

        /**
         * Cache la modal de confirmation.
         */
        hideConfirmation: function() {
            const modal = document.getElementById('custom-confirm-modal');
            const modalBox = document.getElementById('custom-confirm-box');
            modalBox.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
                this.confirmCallback = null;
            }, 200);
        },

        /**
         * Change l'onglet actif.
         */
        changeTab: function(event, tabId) {
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            const activeSection = document.getElementById(tabId);
            activeSection.classList.add('active');

            const baseClasses = "min-h-[4rem] py-2 px-2 text-sm font-medium rounded-lg border focus:outline-none transition-all ease-in-out duration-300 flex-1 flex items-center justify-center text-center";
            const inactiveClasses = "text-gray-600 bg-white border-gray-200 hover:bg-gray-100";
            const activeClasses = {
                blue: "text-blue-900 border-blue-300 bg-gradient-to-br from-blue-200 to-cyan-200 shadow-inner",
                teal: "text-teal-900 border-teal-300 bg-gradient-to-br from-teal-200 to-green-200 shadow-inner",
                rose: "text-rose-900 border-rose-300 bg-gradient-to-br from-rose-200 to-pink-200 shadow-inner",
                indigo: "text-indigo-900 border-indigo-300 bg-gradient-to-br from-indigo-200 to-violet-200 shadow-inner",
                green: "text-green-900 border-green-300 bg-gradient-to-br from-green-200 to-lime-200 shadow-inner",
                purple: "text-purple-900 border-purple-300 bg-gradient-to-br from-purple-200 to-pink-200 shadow-inner",
                violet: "text-violet-900 border-violet-300 bg-gradient-to-br from-violet-200 to-fuchsia-200 shadow-inner",
                orange: "text-orange-900 border-orange-300 bg-gradient-to-br from-amber-200 to-orange-200 shadow-inner"
            };
            
            document.querySelectorAll('nav[aria-label="Tabs"] button').forEach(tab => tab.className = `${baseClasses} ${inactiveClasses}`);
            const clickedTab = event.currentTarget;
            const color = clickedTab.dataset.color;
            clickedTab.className = `${baseClasses} ${activeClasses[color]}`;

            document.querySelectorAll('.card-header').forEach(h => Object.keys(activeClasses).forEach(c => h.classList.remove(`header-${c}`)));
            activeSection.querySelectorAll('.card-header').forEach(h => h.classList.add(`header-${color}`));

            localStorage.setItem('activeTab', tabId);
            
            setTimeout(() => {
                activeSection.querySelectorAll('textarea.info-value').forEach(ta => this.autoResize(ta));
            }, 0);

            if (tabId === 'pancarte') {
                setTimeout(() => this.updatePancarteChart(), 50);
            }
        },

        /**
         * Verrouille ou déverrouille une section du formulaire.
         */
        toggleLock: function(containerId, buttonId) {
            const container = document.getElementById(containerId);
            const button = document.getElementById(buttonId);
            const inputs = container.querySelectorAll('.info-value, input[type=text], input[type=date]');
            const isUnlocking = button.innerHTML.includes('fa-lock');

            if (!isUnlocking && containerId === 'patient-header-form') {
                const entryDateValue = document.getElementById('patient-entry-date').value;
                if (entryDateValue) {
                    const entryDate = new Date(entryDateValue);
                    if (!isNaN(entryDate.getTime())) {
                        this.updateDynamicDates(entryDate);
                        this.updateJourHosp();
                    }
                }
            }

            inputs.forEach(input => {
                input.disabled = !isUnlocking;
                if (input.tagName.toLowerCase() === 'textarea' && isUnlocking) {
                    this.autoResize(input);
                }
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
                button.classList.remove(...styles.locked);
                button.classList.add(...styles.unlocked);
            } else {
                button.innerHTML = `<i class="fas fa-lock mr-2"></i> Lock`;
                button.classList.remove(...styles.unlocked);
                button.classList.add(...styles.locked);
            }
        },

        /**
         * Bascule en mode plein écran.
         */
        toggleFullscreen: function() {
            const elem = document.documentElement;
            const icon = document.getElementById('fullscreen-icon');
            if (!document.fullscreenElement) {
                elem.requestFullscreen().catch(err => console.error(err));
                icon.classList.replace('fa-expand', 'fa-compress');
            } else {
                document.exitFullscreen();
                icon.classList.replace('fa-compress', 'fa-expand');
            }
        },

        // --- Ajout de Contenu Dynamique ---

        /**
         * Ajoute une nouvelle observation médicale.
         */
        addObservation: function() {
            const author = document.getElementById('new-observation-author').value.trim();
            const text = document.getElementById('new-observation-text').value.trim();
            const dateValue = document.getElementById('new-observation-date').value;
            if (!text || !author) return;

            const eventDate = dateValue ? new Date(dateValue) : new Date();
            const formattedDate = new Date(eventDate.getTime() - (eventDate.getTimezoneOffset() * 60000)).toLocaleDateString('fr-FR');
            
            const newHTML = `
                <div class="timeline-item">
                    <div class="timeline-dot dot-rose"></div>
                    <div class="flex justify-between items-start">
                        <h3 class="font-semibold text-gray-800">${formattedDate} - ${author.toUpperCase()}</h3>
                        <button type="button" onclick="EIdosApp.deleteEntry(this)" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer l'observation">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                    <p class="text-gray-600 preserve-whitespace">${text}</p>
                </div>`;
            document.getElementById('observations-list').insertAdjacentHTML('afterbegin', newHTML);
            document.getElementById('new-observation-form').reset();
        },

        /**
         * Ajoute une nouvelle transmission soignante.
         */
        addTransmission: function() {
            const author = document.getElementById('new-transmission-author-2').value.trim();
            const text = document.getElementById('new-transmission-text-2').value.trim();
            const dateValue = document.getElementById('new-transmission-date').value;
            if (!text || !author) return;

            const eventDate = dateValue ? new Date(dateValue) : new Date();
            const formattedDate = new Date(eventDate.getTime() - (eventDate.getTimezoneOffset() * 60000)).toLocaleDateString('fr-FR');
            
            const formattedText = text
                .replace(/Cible :/g, '<strong class="text-gray-900">Cible :</strong>')
                .replace(/Données :/g, '<br><strong class="text-gray-900">Données :</strong>')
                .replace(/Actions :/g, '<br><strong class="text-gray-900">Actions :</strong>')
                .replace(/Résultats :/g, '<br><strong class="text-gray-900">Résultats :</strong>');
            
            const newHTML = `
                <div class="timeline-item">
                    <div class="timeline-dot dot-green"></div>
                    <div class="flex justify-between items-start">
                        <h3 class="font-semibold text-gray-800">${formattedDate} - ${author.toUpperCase()}</h3>
                        <button type="button" onclick="EIdosApp.deleteEntry(this)" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer la transmission">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                    <p class="text-gray-600 preserve-whitespace">${formattedText}</p>
                </div>`;
            document.getElementById('transmissions-list-ide').insertAdjacentHTML('afterbegin', newHTML);
            document.getElementById('new-transmission-form-2').reset();
        },

        /**
         * Ajoute une nouvelle ligne de prescription.
         */
        addPrescription: function(data = null, fromLoad = false) {
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
            const newRow = tbody.insertRow(0); // Insère au début
            newRow.dataset.type = type;
            
            const baseCellsHTML = `
                <td class="p-2 text-left align-top">
                    <div class="flex items-start justify-between">
                        <span>${name}</span>
                        <button type="button" onclick="EIdosApp.deletePrescription(this)" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer la prescription">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                </td>
                <td class="p-2 text-left align-top">${posologie}</td>
                <td class="p-2 text-left align-top">${voie}</td>
                <td class="p-2 text-left align-top">${startDate}</td>
            `;

            if (type === 'iv') {
                newRow.innerHTML = baseCellsHTML;
                const timelineCell = newRow.insertCell();
                timelineCell.colSpan = 44;
                timelineCell.className = 'iv-bar-container';
                timelineCell.addEventListener('mousedown', this.handleIVMouseDown.bind(this));

                if (fromLoad && bars && Array.isArray(bars)) {
                    bars.forEach(barData => {
                        if (barData && barData.left && barData.width) {
                            this.createIVBar(barData, timelineCell);
                        }
                    });
                }
            } else {
                let checkboxCellsHTML = '';
                for (let i = 0; i < 11; i++) {
                    for (let j = 0; j < 4; j++) {
                        const cbIndex = i * 4 + j;
                        const isChecked = fromLoad && checkboxes && checkboxes[cbIndex];
                        checkboxCellsHTML += `<td class="p-0"><input type="checkbox" ${isChecked ? 'checked' : ''}></td>`;
                    }
                }
                newRow.innerHTML = baseCellsHTML + checkboxCellsHTML;
            }

            if (!fromLoad) {
                document.getElementById('new-prescription-form').reset();
            }
        },
        
        /**
         * Crée un élément barre IV (helper pour addPrescription).
         */
        createIVBar: function(barData, cell) {
            const bar = document.createElement('div');
            bar.className = 'iv-bar';
            bar.style.left = barData.left;
            bar.style.width = barData.width;
            bar.title = barData.title || '';
            bar.addEventListener('dblclick', this.handleIVDblClick.bind(this));
            
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            bar.appendChild(handle);
            cell.appendChild(bar);
            
            setTimeout(() => this.updateIVBarDetails(bar, cell), 0);
        },

        /**
         * Ajoute une nouvelle ligne au diagramme de soins.
         */
        addCareDiagramRow: function() {
            const name = document.getElementById('care-name').value.trim();
            if (!name) return;
            
            const newRow = document.getElementById('care-diagram-tbody').insertRow(); // Ajoute à la fin
            let cellsHTML = `<td class="text-left p-2">${name}</td>`;
            for(let i=0; i<11; i++) {
                cellsHTML += `<td class="border-l"><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="checkbox"></td>`;
            }
            newRow.innerHTML = cellsHTML;
            document.getElementById('new-care-form').reset();
        },
        
        /**
         * Supprime une entrée (observation, transmission).
         */
        deleteEntry: function(button) {
            const entry = button.closest('.timeline-item');
            if (entry) {
                this.showCustomModal('Confirmation de suppression', "Êtes-vous sûr de vouloir supprimer cette entrée ?", 'confirm', () => {
                    entry.remove();
                    this.saveData();
                });
            }
        },

        /**
         * Supprime une ligne de prescription.
         */
        deletePrescription: function(button) {
            const row = button.closest('tr');
            if (row) {
                this.showCustomModal('Confirmation de suppression', "Êtes-vous sûr de vouloir supprimer cette prescription ?", 'confirm', () => {
                    row.remove();
                    this.saveData();
                });
            }
        },

        // --- Logique Spécifique (IV, Chart, Dates) ---

        /**
         * Gère le double-clic sur une barre IV (suppression).
         */
        handleIVDblClick: function(e) {
            const bar = e.currentTarget;
            this.showCustomModal('Confirmation de suppression', "Effacer cette barre de perfusion IV ?", 'confirm', () => {
                const cell = bar.parentElement;
                if(cell) {
                    // Supprimer aussi les labels de temps associés
                    cell.querySelectorAll('.iv-time-label').forEach(label => label.remove());
                }
                bar.remove();
                this.saveData();
            });
        },

        /**
         * Gère le clic souris (mousedown) sur une cellule IV.
         */
        handleIVMouseDown: function(e) {
            if (e.target.classList.contains('iv-bar-container')) {
                // --- Démarrer le DESSIN ---
                const cell = e.target;
                const rect = cell.getBoundingClientRect();
                const startX = e.clientX - rect.left;
                
                const newBar = document.createElement('div');
                newBar.className = 'iv-bar';
                newBar.style.left = `${(startX / rect.width) * 100}%`;
                newBar.style.width = '0px';
                newBar.addEventListener('dblclick', this.handleIVDblClick.bind(this));
                
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                newBar.appendChild(handle);
                cell.appendChild(newBar);

                this.ivInteraction = {
                    active: true,
                    mode: 'draw',
                    targetBar: newBar,
                    targetCell: cell,
                    startX: e.clientX,
                    startWidth: 0, // startWidth est 0 pour le dessin
                    startLeft: newBar.offsetLeft // startLeft est la position de départ
                };
                document.body.classList.add('is-drawing-iv');
                
            } else if (e.target.classList.contains('resize-handle')) {
                // --- Démarrer le REDIMENSIONNEMENT ---
                const bar = e.target.parentElement;
                this.ivInteraction = {
                    active: true,
                    mode: 'resize',
                    targetBar: bar,
                    targetCell: bar.parentElement,
                    startX: e.clientX,
                    startWidth: bar.offsetWidth,
                    startLeft: bar.offsetLeft
                };
                document.body.classList.add('is-resizing-iv');
                
            } else if (e.target.classList.contains('iv-bar')) {
                // --- Démarrer le DÉPLACEMENT ---
                const bar = e.target;
                this.ivInteraction = {
                    active: true,
                    mode: 'move',
                    targetBar: bar,
                    targetCell: bar.parentElement,
                    startX: e.clientX,
                    startWidth: bar.offsetWidth,
                    startLeft: bar.offsetLeft
                };
                document.body.classList.add('is-moving-iv');
            }
        },

        /**
         * Gère le mouvement de la souris (pour IV).
         */
        handleIVMouseMove: function(e) {
            if (!this.ivInteraction.active) return;
            e.preventDefault();
            
            const { mode, targetBar, targetCell, startX, startWidth, startLeft } = this.ivInteraction;
            const cellRect = targetCell.getBoundingClientRect();
            const dx = e.clientX - startX;

            if (mode === 'draw' || mode === 'resize') {
                let newWidth = startWidth + dx;
                newWidth = Math.max(5, newWidth); // Largeur minimale
                newWidth = Math.min(newWidth, cellRect.width - startLeft); // Ne pas dépasser la cellule
                targetBar.style.width = `${(newWidth / cellRect.width) * 100}%`;
                
            } else if (mode === 'move') {
                let newLeft = startLeft + dx;
                newLeft = Math.max(0, newLeft); // Ne pas aller avant 0
                newLeft = Math.min(newLeft, cellRect.width - targetBar.offsetWidth); // Ne pas dépasser la fin
                targetBar.style.left = `${(newLeft / cellRect.width) * 100}%`;
            }
            
            this.updateIVBarDetails(targetBar, targetCell);
        },

        /**
         * Gère le relâchement de la souris (fin d'interaction IV).
         */
        handleIVMouseUp: function(e) {
            if (!this.ivInteraction.active) return;
            document.body.className = document.body.className.replace(/is-(drawing|resizing|moving)-iv/g, '').trim();
            this.ivInteraction.active = false;
            this.saveData();
        },

        /**
         * Met à jour les labels de temps d'une barre IV.
         */
        updateIVBarDetails: function(bar, cell) {
            if (!bar || !cell) return;
            
            const tableStartDateStr = document.getElementById('patient-entry-date').value;
            if (!tableStartDateStr) return; // Pas de date d'entrée, on ne peut rien calculer

            const tableStartDate = new Date(tableStartDateStr);
            const totalTimelineMillis = 11 * 24 * 60 * 60 * 1000; // 11 jours

            const startPercent = parseFloat(bar.style.left);
            const widthPercent = parseFloat(bar.style.width);
            const endPercent = startPercent + widthPercent;

            const startOffsetMillis = (startPercent / 100) * totalTimelineMillis;
            const durationMillis = (widthPercent / 100) * totalTimelineMillis;

            const startDateTime = new Date(tableStartDate.getTime() + startOffsetMillis);
            const endDateTime = new Date(startDateTime.getTime() + durationMillis);

            const formatTime = (date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');

            bar.title = `Début: ${startDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}\nFin: ${endDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}`;

            // Gérer les labels
            let startLabel = cell.querySelector(`.iv-time-label.start[data-bar-id="${bar.uniqueId}"]`);
            if (!bar.uniqueId) bar.uniqueId = `iv_${Math.random().toString(36).substr(2, 9)}`;
            
            if (!startLabel) {
                startLabel = document.createElement('span');
                startLabel.className = 'iv-time-label start';
                startLabel.dataset.barId = bar.uniqueId;
                cell.appendChild(startLabel);
            }
            let endLabel = cell.querySelector(`.iv-time-label.end[data-bar-id="${bar.uniqueId}"]`);
            if (!endLabel) {
                endLabel = document.createElement('span');
                endLabel.className = 'iv-time-label end';
                endLabel.dataset.barId = bar.uniqueId;
                cell.appendChild(endLabel);
            }

            startLabel.textContent = formatTime(startDateTime);
            startLabel.style.left = `${startPercent}%`;
            endLabel.textContent = formatTime(endDateTime);
            endLabel.style.left = `${endPercent}%`;
        },
        
        /**
         * Met à jour le graphique de la pancarte.
         */
        updatePancarteChart: function() {
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

            const datasets = Array.from(table.querySelectorAll('tbody tr')).map(row => {
                const paramName = row.cells[0].textContent.trim();
                let data = Array.from(row.querySelectorAll('input')).map(input => {
                    if (paramName === 'Tension (mmHg)' && input.value.includes('/')) {
                        const parts = input.value.split('/');
                        return [parseFloat(parts[1]), parseFloat(parts[0])]; // [min, max] pour bar
                    }
                    const value = parseFloat(input.value.replace(',', '.'));
                    return isNaN(value) ? null : value;
                });
                
                const config = PANCARTE_CHART_CONFIG[paramName] || {};
                return {
                    label: paramName,
                    data,
                    type: config.type || 'line',
                    tension: 0.2,
                    borderWidth: 2,
                    spanGaps: true,
                    pointBackgroundColor: config.borderColor || '#000',
                    ...config 
                };
            });

            const ctx = document.getElementById('pancarteChart').getContext('2d');
            if (this.pancarteChartInstance) {
                this.pancarteChartInstance.destroy();
            }
            
            this.pancarteChartInstance = new Chart(ctx, {
                type: 'bar', // Type de base, mais les datasets spécifient le leur
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { position: 'left', title: { display: true, text: 'Tension (mmHg)' }, min: 0, max: 200 },
                        y1: { position: 'right', title: { display: true, text: 'Pouls' }, grid: { drawOnChartArea: false }, min: 0, max: 200 },
                        y2: { position: 'right', title: { display: true, text: 'Douleur' }, grid: { drawOnChartArea: false }, max: 10, min: 0 },
                        y3: { position: 'right', title: { display: true, text: 'Température' }, grid: { drawOnChartArea: false }, min: 36, max: 41, ticks: { stepSize: 0.5 } },
                        y4: { position: 'right', title: { display: true, text: 'SpO2' }, grid: { drawOnChartArea: false }, min: 50, max: 100 }
                    },
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: ctx => ctx.dataset.label === 'Tension (mmHg)' && ctx.raw?.length === 2 ?
                                    `${ctx.dataset.label}: ${ctx.raw[1]}/${ctx.raw[0]}` :
                                    `${ctx.dataset.label}: ${ctx.formattedValue}`
                            }
                        }
                    }
                }
            });
        },
        
        /**
         * Met à jour les dates dans les en-têtes des tableaux.
         */
        updateDynamicDates: function(startDate) {
            const updateHeaders = (selector, colSpan) => {
                document.querySelectorAll(selector).forEach((th, index) => {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + index);
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    th.innerHTML = `Jour ${index}<br><span class="text-xs font-normal">${day}/${month}</span>`;
                });
            };
            
            updateHeaders('#prescription-table thead tr:first-child th[colspan="4"]');
            updateHeaders('#pancarte-table thead tr:first-child th[colspan="3"]');
            updateHeaders('#care-diagram-table thead tr:first-child th[colspan="3"]');

            if (this.pancarteChartInstance) {
                this.updatePancarteChart();
            }
        },

        // --- Fonctions Utilitaires ---
        
        /**
         * Synchronise les champs (ex: header et admin).
         */
        setupSync: function() {
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
                            if (el2.tagName.toLowerCase() === 'textarea') this.autoResize(el2);
                            if(id1.includes('dob')) this.updateAgeDisplay();
                        }
                    });
                    el2.addEventListener('input', () => {
                        if (!el1.disabled) {
                            el1.value = el2.value; // Correction ici: el1.value = el2.value
                            if (el1.tagName.toLowerCase() === 'textarea') this.autoResize(el1);
                            if(id2.includes('dob')) this.updateAgeDisplay();
                        }
                    });
                }
            });
        },
        
        /**
         * Calcule l'âge à partir de la date de naissance.
         */
        calculateAge: function(dobString) {
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
        },

        /**
         * Met à jour l'affichage de l'âge.
         */
        updateAgeDisplay: function() {
            const dobHeader = document.getElementById('patient-dob').value;
            document.getElementById('patient-age').textContent = this.calculateAge(dobHeader);
            const dobAdmin = document.getElementById('admin-dob').value;
            document.getElementById('admin-age').textContent = this.calculateAge(dobAdmin);
        },
        
        /**
         * Met à jour le "Jour J" d'hospitalisation.
         */
        updateJourHosp: function() {
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
        },

        /**
         * Redimensionne automatiquement un textarea à son contenu.
         */
        autoResize: function(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        },
        
        
        // --- Logique du Tutoriel ---
        
        startTutorial: function() {
            this.tutorialState.currentStepIndex = 0;
            document.getElementById('tutorial-overlay').classList.remove('hidden');
            this.showTutorialStep(this.tutorialState.currentStepIndex);
        },

        endTutorial: function(setFlag = false) {
            document.getElementById('tutorial-overlay').classList.add('hidden');
            if (this.tutorialState.highlightedElement) {
                this.tutorialState.highlightedElement.classList.remove('tutorial-highlight');
                this.tutorialState.highlightedElement = null;
            }
            if (setFlag) {
                localStorage.setItem('tutorialCompleted', 'true');
            }
        },

        showTutorialStep: function(index) {
            // Enlever le surlignage précédent
            if (this.tutorialState.highlightedElement) {
                this.tutorialState.highlightedElement.classList.remove('tutorial-highlight');
            }

            // Vérifier si le tutoriel est terminé
            if (index >= TUTORIAL_STEPS.length) {
                this.endTutorial(true);
                return;
            }

            let step = TUTORIAL_STEPS[index];
            let element = document.querySelector(step.element);
            
            // Gérer le cas où l'élément n'existe pas (ex: fallback pour le 1er patient)
            if (!element && step.fallback) {
                step = { ...step, ...step.fallback }; // Utiliser le fallback
                element = document.querySelector(step.element);
            }
            
            // Si l'élément n'est toujours pas trouvé, passer à l'étape suivante
            if (!element) {
                console.warn(`Élément du tutoriel non trouvé: ${step.element}. Passage à l'étape suivante.`);
                this.tutorialState.currentStepIndex++;
                this.showTutorialStep(this.tutorialState.currentStepIndex);
                return;
            }

            const stepBox = document.getElementById('tutorial-step-box');
            const stepText = document.getElementById('tutorial-text');
            const nextButton = document.getElementById('tutorial-next-btn');

            // Mettre à jour le texte
            stepText.textContent = step.text;

            // Mettre à jour le bouton "Suivant"
            nextButton.textContent = (index === TUTORIAL_STEPS.length - 1) ? "Terminer" : "Suivant";
            
            // Surligner le nouvel élément
            element.classList.add('tutorial-highlight');
            this.tutorialState.highlightedElement = element;

            // Positionner la boîte de dialogue
            const rect = element.getBoundingClientRect();
            const boxRect = stepBox.getBoundingClientRect();
            const margin = 15;
            let top, left;

            // Positionnement basé sur la demande
            switch (step.position) {
                case 'right':
                    top = rect.top + (rect.height / 2) - (boxRect.height / 2);
                    left = rect.right + margin;
                    break;
                case 'left':
                    top = rect.top + (rect.height / 2) - (boxRect.height / 2);
                    left = rect.left - boxRect.width - margin;
                    break;
                case 'top':
                    top = rect.top - boxRect.height - margin;
                    left = rect.left + (rect.width / 2) - (boxRect.width / 2);
                    break;
                case 'bottom-left':
                     top = rect.bottom + margin;
                     left = rect.right - boxRect.width;
                     break;
                case 'bottom':
                default:
                    top = rect.bottom + margin;
                    left = rect.left + (rect.width / 2) - (boxRect.width / 2);
            }

            // S'assurer que la boîte ne sort pas de l'écran
            if (top < margin) top = margin;
            if (left < margin) left = margin;
            if (top + boxRect.height > window.innerHeight - margin) {
                top = window.innerHeight - boxRect.height - margin;
                if (step.position === 'top') top = rect.bottom + margin; // Fallback
            }
            if (left + boxRect.width > window.innerWidth - margin) {
                left = window.innerWidth - boxRect.width - margin;
            }

            stepBox.style.top = `${top}px`;
            stepBox.style.left = `${left}px`;
        }

    }; // Fin de window.EIdosApp

    // --- DÉMARRAGE DE L'APPLICATION ---
    window.EIdosApp.init();

});

