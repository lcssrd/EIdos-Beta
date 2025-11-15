(function() {
    "use strict";

    // --- Variables d'état de l'UI ---
    let pancarteChartInstance;
    
    // Références pour les modales
    let loadPatientModal, loadPatientBox, loadPatientListContainer;
    let confirmModal, confirmModalBox, confirmTitle, confirmMessage, confirmCancelBtn, confirmOkBtn;
    let crModal, crModalBox, crModalTitle, crModalTextarea, crModalSaveBtn, crModalCloseBtn, crModalActiveIdInput;

    // Références pour le bouton de statut
    let saveStatusButton, saveStatusIcon, saveStatusText;

    // NOUVEAU : Références pour le Toast
    let toastElement, toastIcon, toastText;
    let toastTimeout = null;

    let confirmCallback = null; // Pour la modale de confirmation
    
    // Références pour le tutoriel
    let tutorialOverlay, tutorialStepBox, tutorialText, tutorialSkipBtn, tutorialNextBtn;
    let currentStepIndex = 0;
    let highlightedElement = null;

    // État pour l'interaction avec les barres IV
    let ivInteraction = {
        active: false, mode: null, targetBar: null, targetCell: null,
        startX: 0, startLeft: 0, startWidth: 0,
        startLeftPx: 0,
    };

    // --- Données Statiques pour les Tableaux (UI) ---
    const nfsData = { "Hématies (T/L)": "4.5-5.5", "Hémoglobine (g/dL)": "13-17", "Hématocrite (%)": "40-52", "VGM (fL)": "80-100", "Leucocytes (G/L)": "4-10", "Plaquettes (G/L)": "150-400" };
    const ionoData = { "Sodium (mmol/L)": "136-145", "Potassium (mmol/L)": "3.5-5.1", "Chlore (mmol/L)": "98-107", "Bicarbonates (mmol/L)": "22-29", "Urée (mmol/L)": "2.8-7.2", "Créatinine (µmol/L)": "62-106" };
    const hepatiqueData = { "ASAT (UI/L)": "< 40", "ALAT (UI/L)": "< 41", "Gamma-GT (UI/L)": "11-50", "PAL (UI/L)": "40-129", "Bilirubine totale (µmol/L)": "5-21" };
    const lipidiqueData = { "Cholestérol total (g/L)": "< 2.0", "Triglycérides (g/L)": "< 1.5", "HDL Cholestérol (g/L)": "> 0.4", "LDL Cholestérol (g/L)": "< 1.6" };
    const gdsData = { "pH": "7.35-7.45", "PaCO2 (mmHg)": "35-45", "PaO2 (mmHg)": "80-100", "HCO3- (mmol/L)": "22-26", "SaO2 (%)": "> 95" };
    const inflammationData = { "CRP (mg/L)": "< 5" };
    const pancarteData = {
        'Pouls (/min)': [], 
        'Tension (mmHg)': [], 
        'Température (°C)': [], 
        'SpO2 (%)': [], 
        'Douleur (EVA /10)': [],
        'Poids (kg)': [],
        'Diurèse (L)': []
    };
    const glycemieData = {
        'Glycémie (g/L)': []
    };
    
    // --- Fonctions d'initialisation de l'UI ---

    /**
     * Initialise les références des éléments du DOM (Modales, etc.)
     */
    function initUIComponents() {
        // Modale de confirmation
        confirmModal = document.getElementById('custom-confirm-modal');
        confirmModalBox = document.getElementById('custom-confirm-box');
        confirmTitle = document.getElementById('custom-confirm-title');
        confirmMessage = document.getElementById('custom-confirm-message');
        confirmCancelBtn = document.getElementById('custom-confirm-cancel');
        confirmOkBtn = document.getElementById('custom-confirm-ok');
        
        // Modale de chargement de patient
        loadPatientModal = document.getElementById('load-patient-modal');
        loadPatientBox = document.getElementById('load-patient-box');
        loadPatientListContainer = document.getElementById('load-patient-list-container');
        
        // Modale des comptes rendus (CR)
        crModal = document.getElementById('cr-modal');
        crModalBox = document.getElementById('cr-modal-box');
        crModalTitle = document.getElementById('cr-modal-title');
        crModalTextarea = document.getElementById('cr-modal-textarea');
        crModalSaveBtn = document.getElementById('cr-modal-save-btn');
        crModalCloseBtn = document.getElementById('cr-modal-close-btn');
        crModalActiveIdInput = document.getElementById('cr-modal-active-id');

        // Tutoriel
        tutorialOverlay = document.getElementById('tutorial-overlay');
        tutorialStepBox = document.getElementById('tutorial-step-box');
        tutorialText = document.getElementById('tutorial-text');
        tutorialSkipBtn = document.getElementById('tutorial-skip-btn');
        tutorialNextBtn = document.getElementById('tutorial-next-btn');

        // Bouton de statut de sauvegarde
        saveStatusButton = document.getElementById('save-status-button');
        saveStatusIcon = document.getElementById('save-status-icon');
        saveStatusText = document.getElementById('save-status-text');

        // NOUVEAU : Toast
        toastElement = document.getElementById('toast-notification');
        toastIcon = document.getElementById('toast-icon');
        toastText = document.getElementById('toast-text');
    }

    /**
     * Construit les lignes de la table de biologie.
     */
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

    /**
     * Construit la structure vide (tbody) du diagramme de soins.
     */
    function getDefaultForCareDiagramTbody() {
        return ``; // Par défaut, il est vide
    }

    /**
     * Construit les en-têtes et les lignes vides pour toutes les tables dynamiques.
     */
    function initializeDynamicTables() {
        let html = '';

        // --- PRESCRIPTIONS ---
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

        // --- BIOLOGIE ---
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

        // --- PANCARTE ---
        const pancarteThead = document.getElementById('pancarte-thead');
        if (pancarteThead) {
            html = '<tr><th class="p-2 text-left sticky-col" rowspan="2">Paramètres</th>';
            for(let i=0; i<11; i++) { html += `<th class="p-2 text-center" colspan="3">Jour ${i}</th>`;}
            html += '</tr><tr>';
            for(let i=0; i<11; i++) { 
                html += `<th class="p-1" style="min-width: 70px;">Matin</th>`;
                html += `<th class="p-1" style="min-width: 70px;">Soir</th>`;
                html += `<th class="p-1" style="min-width: 70px;">Nuit</th>`;
            }
            html += '</tr>';
            pancarteThead.innerHTML = html;
        }
        const pancarteTbody = document.getElementById('pancarte-tbody');
        if (pancarteTbody) {
            html = '';
            for (const param in pancarteData) {
                html += `<tr><td class="p-2 text-left font-semibold sticky-col">${param}</td>`;
                let inputHtml = '<input type="text" value="">';
                if (param === 'Température (°C)' || param === 'Poids (kg)' || param === 'Diurèse (L)') {
                    inputHtml = '<input type="number" step="0.1" value="">';
                }

                if (param === 'Poids (kg)' || param === 'Diurèse (L)') {
                    for(let i=0; i<11; i++) {
                        html += `<td class="p-0" style="min-width: 70px;">${inputHtml}</td>`;
                        html += `<td class="p-0 bg-gray-100" colspan="2"></td>`;
                    }
                } else {
                    for(let i=0; i<33; i++) {
                        html += `<td class="p-0" style="min-width: 70px;">${inputHtml}</td>`;
                    }
                }
                html += `</tr>`;
            }
            pancarteTbody.innerHTML = html;
        }
        
        // --- GLYCEMIE ---
        const glycemieThead = document.getElementById('glycemie-thead');
        if (glycemieThead) {
            html = '<tr><th class="p-2 text-left sticky-col" rowspan="2">Paramètres</th>';
            for(let i=0; i<11; i++) { html += `<th class="p-2 text-center" colspan="3">Jour ${i}</th>`;}
            html += '</tr><tr>';
            for(let i=0; i<11; i++) { 
                html += `<th class="p-1" style="min-width: 70px;">Matin</th>`;
                html += `<th class="p-1" style="min-width: 70px;">Midi</th>`;
                html += `<th class="p-1" style="min-width: 70px;">Soir</th>`;
            }
            html += '</tr>';
            glycemieThead.innerHTML = html;
        }
        const glycemieTbody = document.getElementById('glycemie-tbody');
        if (glycemieTbody) {
            html = '';
            for (const param in glycemieData) {
                html += `<tr><td class="p-2 text-left font-semibold sticky-col">${param}</td>`;
                let inputHtml = '<input type="number" step="0.1" value="">';
                for(let i=0; i<33; i++) {
                    html += `<td class="p-0" style="min-width: 70px;">${inputHtml}</td>`;
                }
                html += `</tr>`;
            }
            glycemieTbody.innerHTML = html;
        }

        // --- DIAGRAMME DE SOINS ---
        const careDiagramThead = document.getElementById('care-diagram-thead');
        if (careDiagramThead) {
            html = '<tr><th class="p-2 text-left min-w-[220px]">Soin / Surveillance</th>';
            for(let i=0; i<11; i++) { html += `<th colspan="3" class="border-l">Jour ${i}</th>`;}
            html += '</tr><tr><th class="min-w-[220px]"></th>';
            const msn = ['Matin', 'Soir', 'Nuit'];
            for(let i=0; i<11; i++) { 
                for (let j = 0; j < msn.length; j++) { 
                    const borderClass = (j === 0) ? 'border-l' : '';
                    html += `<th class="${borderClass} p-1 text-center" style="min-width: 70px;">${msn[j]}</th>`;
                }
            }
            html += '</tr>';
            careDiagramThead.innerHTML = html;
        }
    }

    /**
     * Initialise les écouteurs pour les modales.
     */
    function setupModalListeners() {
        // Modale de confirmation
        confirmOkBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            hideConfirmation();
        });
        confirmCancelBtn.addEventListener('click', hideConfirmation);

        // Modale de chargement de patient
        document.getElementById('load-patient-close-btn').addEventListener('click', hideLoadPatientModal);
        document.getElementById('load-patient-cancel-btn').addEventListener('click', hideLoadPatientModal);
        
        // Modale des comptes rendus
        crModalCloseBtn.addEventListener('click', closeCrModal);
    }


    // --- Fonctions de Gestion de l'UI (Permissions) ---

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

    function applyPermissions(userPermissions) {
        
        if (userPermissions.subscription === 'free' && !userPermissions.isStudent) {
            const saveBtn = document.getElementById('save-patient-btn');
            if (saveBtn) saveBtn.style.display = 'none';
            if (saveStatusButton) saveStatusButton.style.display = 'none';
        }

        if (!userPermissions.isStudent) {
            crModalSaveBtn.style.display = 'inline-flex';
            return;
        }

        // --- Ce qui suit ne s'applique QU'AUX ÉTUDIANTS ---
        
        // ***** MODIFICATION : LIGNE SUPPRIMÉE *****
        // if (saveStatusButton) saveStatusButton.style.display = 'none';

        const studentForbiddenButtons = [
            '#save-patient-btn', '#load-patient-btn', '#import-json-btn',
            '#export-json-btn', '#clear-current-patient-btn', '#clear-all-data-btn',
            '#account-management-btn'
        ];
        studentForbiddenButtons.forEach(selector => {
            const btn = document.querySelector(selector);
            if (btn) btn.style.display = 'none';
        });

        if (!userPermissions.header) disableSectionInputs('patient-header-form');
        if (!userPermissions.admin) disableSectionInputs('administratif');
        if (!userPermissions.vie) disableSectionInputs('mode-de-vie');
        
        if (!userPermissions.observations) {
            const form = document.getElementById('new-observation-form');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.transmissions) {
            const form = document.getElementById('new-transmission-form-2');
            if (form) form.style.display = 'none';
        }
        if (!userPermissions.comptesRendus) {
            crModalSaveBtn.style.display = 'none';
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
            document.querySelectorAll('#pancarte-table input, #glycemie-table input').forEach(el => el.disabled = true);
        }
        if (!userPermissions.biologie) {
            document.querySelectorAll('#bio-table input').forEach(el => el.disabled = true);
        }
    }

    // --- Fonctions de Gestion de l'UI (Sidebar) ---

    function initSidebar(patients, patientMap) {
        const list = document.getElementById('patient-list');
        let listHTML = '';
        
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

    function updateSidebarEntryName(patientId, patientName) {
        const sidebarEntry = document.querySelector(`#patient-list button[data-patient-id="${patientId}"] .patient-name`);
        if (sidebarEntry) {
            sidebarEntry.textContent = patientName || `Chambre ${patientId.split('_')[1]}`;
        }
    }

    // --- Fonctions de Gestion de l'UI (Formulaires & Données) ---

    function resetForm() {
        document.querySelectorAll('#patient-header-form input, #patient-header-form textarea, main input, main textarea, main select').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
            else if (el.tagName.toLowerCase() === 'select') el.selectedIndex = 0; 
            else if (el.type !== 'file') el.value = '';
        });
        ['observations-list', 'transmissions-list-ide', 'prescription-tbody'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        
        document.querySelectorAll('#cr-card-grid .cr-check-icon').forEach(icon => {
            icon.classList.add('hidden');
        });

        const careDiagramTbody = document.getElementById('care-diagram-tbody');
        if (careDiagramTbody) {
            careDiagramTbody.innerHTML = getDefaultForCareDiagramTbody();
        }
        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            input.value = '';
            delete input.dataset.dateOffset;
        });
        
        document.getElementById('glycemie-tbody').innerHTML = '';
        document.getElementById('pancarte-tbody').innerHTML = '';
        
        initializeDynamicTables();

        calculateAndDisplayIMC();
        if (pancarteChartInstance) pancarteChartInstance.destroy();
        updateSaveStatus('saved');
    }

    function fillFormFromState(state) {
        Object.keys(state).forEach(id => {
            if (['observations', 'transmissions', 'comptesRendus', 'biologie', 'pancarte', 'glycemie', 'prescriptions', 'lockButtonStates', 'careDiagramCheckboxes'].includes(id) || id.endsWith('_html')) {
                return;
            }
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox' || el.type === 'radio') { el.checked = state[id]; } 
                else { el.value = state[id]; }
            }
        });
        setTimeout(() => {
            document.querySelectorAll('textarea.info-value').forEach(autoResize);
        }, 0);
    }

    function fillListsFromState(state, entryDateStr) {
        const obsList = document.getElementById('observations-list');
        obsList.innerHTML = ''; 
        if (state.observations) {
            state.observations.forEach(obsData => {
                let dateOffset = obsData.dateOffset;
                let formattedDate;

                if (dateOffset === undefined && obsData.date) {
                    dateOffset = utils.calculateDaysOffset(entryDateStr, obsData.date);
                    formattedDate = utils.formatDate(new Date(obsData.date + 'T00:00:00'));
                } else {
                    const targetDate = utils.calculateDateFromOffset(entryDateStr, dateOffset);
                    formattedDate = utils.formatDate(targetDate);
                }
                
                addObservation({ ...obsData, dateOffset: dateOffset, formattedDate: formattedDate }, true);
            });
            applySort('observations');
        }

        const transList = document.getElementById('transmissions-list-ide');
        transList.innerHTML = ''; 
        if (state.transmissions) {
            state.transmissions.forEach(transData => {
                let dateOffset = transData.dateOffset;
                let formattedDate;

                if (dateOffset === undefined && transData.date) {
                    dateOffset = utils.calculateDaysOffset(entryDateStr, transData.date);
                    formattedDate = utils.formatDate(new Date(transData.date + 'T00:00:00'));
                } else {
                    const targetDate = utils.calculateDateFromOffset(entryDateStr, dateOffset);
                    formattedDate = utils.formatDate(targetDate);
                }
                
                addTransmission({ ...transData, dateOffset: dateOffset, formattedDate: formattedDate }, true);
            });
            applySort('transmissions');
        }
    }

    function fillCareDiagramFromState(state) {
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
    }

    function fillPrescriptionsFromState(state, entryDateStr) {
        const prescrTbody = document.getElementById('prescription-tbody');
        prescrTbody.innerHTML = ''; 
        if (state.prescriptions) {
            state.prescriptions.forEach(pData => {
                let dateOffset = pData.dateOffset;

                if (dateOffset === undefined && pData.startDate) { 
                     let oldStartDate = pData.startDate;
                     if (oldStartDate.includes('/')) {
                         const parts = oldStartDate.split('/');
                         if (parts.length === 3) {
                             oldStartDate = `20${parts[2]}-${parts[1]}-${parts[0]}`;
                         }
                     }
                    dateOffset = utils.calculateDaysOffset(entryDateStr, oldStartDate);
                }
                
                if (pData.type === 'iv') pData.voie = 'IV';
                if (pData.type === 'checkbox') pData.voie = 'Per Os';
                
                addPrescription({ ...pData, dateOffset: dateOffset, type: pData.voie }, true); 
            });
        }
    }

    function fillBioFromState(state, entryDateStr) {
        if (state.biologie) {
            document.querySelectorAll('#bio-table thead input[type="date"]').forEach((input, index) => {
                let offset = undefined;
                
                if (state.biologie.dateOffsets && state.biologie.dateOffsets[index] !== undefined) {
                    offset = state.biologie.dateOffsets[index];
                } 
                else if (state.biologie.dates && state.biologie.dates[index]) {
                     const oldDateStr = state.biologie.dates[index];
                     if (oldDateStr) {
                        offset = utils.calculateDaysOffset(entryDateStr, oldDateStr);
                     }
                }

                if (offset !== undefined) {
                    const targetDate = utils.calculateDateFromOffset(entryDateStr, offset);
                    input.value = utils.formatDateForInput(targetDate);
                    input.dataset.dateOffset = offset;
                }
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
    }
    
    function fillPancarteFromState(state) {
        if (state.pancarte) {
            document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
                const paramName = row.cells[0].textContent.trim();
                if (paramName && state.pancarte && state.pancarte[paramName]) {
                    row.querySelectorAll('input').forEach((input, index) => { input.value = state.pancarte[paramName][index] || ''; });
                }
            });
        }
        if (state.glycemie) {
            document.querySelectorAll('#glycemie-table tbody tr').forEach(row => {
                const paramName = row.cells[0].textContent.trim();
                if (paramName && state.glycemie && state.glycemie[paramName]) {
                    row.querySelectorAll('input').forEach((input, index) => { input.value = state.glycemie[paramName][index] || ''; });
                }
            });
        }
    }
    
    function fillCrCardsFromState(crData) {
        document.querySelectorAll('#cr-card-grid .cr-check-icon').forEach(icon => {
            icon.classList.add('hidden');
        });
        
        if (!crData) return;

        for (const crId in crData) {
            const card = document.querySelector(`.cr-card[data-cr-id="${crId}"]`);
            if (card && crData[crId] && crData[crId].trim() !== '') {
                const icon = card.querySelector('.cr-check-icon');
                if (icon) {
                    icon.classList.remove('hidden');
                }
            }
        }
    }

    function updateSaveStatus(status) {
        if (!saveStatusButton || !saveStatusIcon || !saveStatusText) return;

        // Stocker l'ancien texte et l'ancienne icône pour l'animation
        const oldText = saveStatusText.textContent;
        const oldIconClasses = Array.from(saveStatusIcon.classList);
        
        let newText, newIconClasses, newButtonClasses;

        switch (status) {
            case 'dirty': 
                newText = 'Modifications';
                newIconClasses = ['fas', 'fa-exclamation-triangle'];
                newButtonClasses = 'status-dirty';
                break;
                
            case 'saving': 
                newText = 'Enregistrement...';
                newIconClasses = ['fas', 'fa-spinner'];
                newButtonClasses = 'status-saving';
                break;
                
            case 'saved': 
            default:
                newText = 'Enregistré';
                newIconClasses = ['fas', 'fa-check-circle'];
                newButtonClasses = 'status-saved';
                break;
        }

        // Ne rien faire si l'état est déjà le bon (évite les animations inutiles)
        if (saveStatusButton.classList.contains(newButtonClasses)) {
             // Sauf si on force un "Enregistré" (pour le feedback visuel après sauvegarde)
             if (status !== 'saved') {
                return;
             }
        }

        // Gérer l'animation de fondu pour le texte et l'icône
        if (oldText !== newText) {
            saveStatusIcon.style.opacity = '0';
            saveStatusText.style.opacity = '0';
            
            setTimeout(() => {
                saveStatusButton.classList.remove('status-saved', 'status-dirty', 'status-saving');
                saveStatusIcon.classList.remove(...oldIconClasses);
                
                saveStatusButton.classList.add(newButtonClasses);
                saveStatusIcon.classList.add(...newIconClasses);
                saveStatusText.textContent = newText;
                
                saveStatusIcon.style.opacity = '1';
                saveStatusText.style.opacity = '1';

                // Gérer l'animation de spin pour l'état 'saving'
                if (status === 'saving') {
                    saveStatusIcon.classList.add('fa-spin');
                } else {
                    saveStatusIcon.classList.remove('fa-spin');
                }

                // ***** MODIFICATION : Le bouton n'est JAMAIS désactivé *****
                saveStatusButton.disabled = false;

            }, 200); // Correspond à la moitié de la transition/animation
        } else {
             // Si le texte est le même, juste mettre à jour la classe
             saveStatusButton.classList.remove('status-saved', 'status-dirty', 'status-saving');
             saveStatusButton.classList.add(newButtonClasses);
             // ***** MODIFICATION : Le bouton n'est JAMAIS désactivé *****
             saveStatusButton.disabled = false;
             if (status === 'saving') {
                saveStatusIcon.classList.add('fa-spin');
             } else {
                saveStatusIcon.classList.remove('fa-spin');
             }
        }
    }

    function updateAgeDisplay() {
        const dobHeader = document.getElementById('patient-dob').value;
        document.getElementById('patient-age').textContent = utils.calculateAge(dobHeader);
        const dobAdmin = document.getElementById('admin-dob').value;
        document.getElementById('admin-age').textContent = utils.calculateAge(dobAdmin);
    }
    
    function updateJourHosp() {
        const entryDateEl = document.getElementById('patient-entry-date');
        const jourHospEl = document.getElementById('patient-jour-hosp');
        jourHospEl.textContent = utils.calculateJourHosp(entryDateEl.value);
    }
    
    function calculateAndDisplayIMC() {
        const poidsEl = document.getElementById('vie-poids');
        const tailleEl = document.getElementById('vie-taille');
        const imcEl = document.getElementById('vie-imc');
        if (!poidsEl || !tailleEl || !imcEl) return;

        imcEl.value = utils.calculateIMC(poidsEl.value, tailleEl.value);
        autoResize(imcEl);
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
        updateHeaders('#glycemie-table thead tr:first-child th[colspan="3"]');
        updateHeaders('#care-diagram-table thead tr:first-child th[colspan="3"]');
        
        if (pancarteChartInstance) updatePancarteChart();
    }
    
    function refreshAllRelativeDates() {
        const entryDateStr = document.getElementById('patient-entry-date').value;
        if (!entryDateStr) return; 
        
        document.querySelectorAll('#observations-list .timeline-item').forEach(item => {
            const offset = parseInt(item.dataset.dateOffset, 10);
            if (!isNaN(offset)) {
                const targetDate = utils.calculateDateFromOffset(entryDateStr, offset);
                const formattedDate = utils.formatDate(targetDate);
                item.querySelector('h3').textContent = `${formattedDate} - ${item.dataset.author.toUpperCase()}`;
            }
        });
        
        document.querySelectorAll('#transmissions-list-ide .timeline-item').forEach(item => {
            const offset = parseInt(item.dataset.dateOffset, 10);
            if (!isNaN(offset)) {
                const targetDate = utils.calculateDateFromOffset(entryDateStr, offset);
                const formattedDate = utils.formatDate(targetDate);
                item.querySelector('h3').textContent = `${formattedDate} - ${item.dataset.author.toUpperCase()}`;
            }
        });
        
        document.querySelectorAll('#prescription-tbody tr').forEach(row => {
            const offset = parseInt(row.dataset.dateOffset, 10);
            if (!isNaN(offset)) {
                const targetDate = utils.calculateDateFromOffset(entryDateStr, offset);
                const formattedDate = utils.formatDate(targetDate).slice(0, 8); // JJ/MM/AA
                row.cells[3].textContent = formattedDate;
            }
        });

        document.querySelectorAll('#bio-table thead input[type="date"]').forEach(input => {
            const offset = parseInt(input.dataset.dateOffset, 10);
             if (!isNaN(offset)) {
                const targetDate = utils.calculateDateFromOffset(entryDateStr, offset);
                input.value = utils.formatDateForInput(targetDate);
            }
        });
        
        document.querySelectorAll('#prescription-tbody .iv-bar').forEach(bar => {
            updateIVBarDetails(bar, bar.closest('.iv-bar-container'));
        });

        const entryDate = new Date(entryDateStr);
        if (!isNaN(entryDate.getTime())) {
            updateDynamicDates(entryDate);
        }
    }


    // --- Fonctions de Gestion de l'UI (Navigation & Modales) ---
    
    function changeTab(tabId) {
        const clickedTab = document.querySelector(`nav button[data-tab-id="${tabId}"]`);
        if (!clickedTab) return;

        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');

        const baseClasses = "min-h-[4rem] py-2 px-2 text-sm font-medium rounded-lg border focus:outline-none transition-all ease-in-out duration-300 flex-1 flex items-center justify-center text-center";
        const inactiveClasses = "text-gray-600 bg-white border-gray-200 hover:bg-gray-100";
        const activeClasses = { 
            blue: "text-blue-900 border-blue-300 bg-gradient-to-br from-blue-200 to-cyan-200 shadow-inner", 
            teal: "text-teal-900 border-teal-300 bg-gradient-to-br from-teal-200 to-green-200 shadow-inner", 
            rose: "text-rose-900 border-rose-300 bg-gradient-to-br from-rose-200 to-pink-200 shadow-inner", 
            indigo: "text-indigo-900 border-indigo-300 bg-gradient-to-br from-indigo-200 to-violet-200 shadow-inner", 
            green: "text-green-900 border-green-300 bg-gradient-to-br from-green-200 to-lime-200 shadow-inner", 
            purple: "text-purple-900 border-purple-300 bg-gradient-to-br from-purple-200 to-pink-200 shadow-inner", 
            orange: "text-orange-900 border-orange-300 bg-gradient-to-br from-amber-200 to-orange-200 shadow-inner"
        };
        
        document.querySelectorAll('nav[aria-label="Tabs"] button').forEach(tab => tab.className = `${baseClasses} ${inactiveClasses}`);
        
        const color = clickedTab.dataset.color;
        clickedTab.className = `${baseClasses} ${activeClasses[color]}`;
        
        document.querySelectorAll('.card-header').forEach(h => Object.keys(activeClasses).forEach(c => h.classList.remove(`header-${c}`)));
        document.getElementById(tabId)?.querySelectorAll('.card-header').forEach(h => h.classList.add(`header-${color}`));
        
        localStorage.setItem('activeTab', tabId);
        
        setTimeout(() => {
            document.getElementById(tabId)?.querySelectorAll('textarea.info-value').forEach(autoResize);
        }, 0);
        
        if (tabId === 'pancarte') setTimeout(() => updatePancarteChart(), 50);
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

    // --- MODIFICATION : showToast ---
    /**
     * Affiche une notification toast non bloquante.
     * @param {string} message - Le message à afficher.
     * @param {string} [type='success'] - Le type ('success' ou 'error').
     */
    function showToast(message, type = 'success') {
        if (!toastElement) return;

        // Annuler le timer de disparition précédent s'il existe
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        // Configurer le style du toast
        toastIcon.classList.remove('fa-check-circle', 'fa-exclamation-triangle', 'text-green-500', 'text-red-500');
        if (type === 'error') {
            toastIcon.classList.add('fa-exclamation-triangle', 'text-red-500');
        } else {
            toastIcon.classList.add('fa-check-circle', 'text-green-500');
        }
        toastText.textContent = message;

        // Afficher le toast
        toastElement.classList.add('show');

        // Programmer la disparition
        toastTimeout = setTimeout(() => {
            toastElement.classList.remove('show');
            toastTimeout = null;
        }, 3000); // Le toast disparaît après 3 secondes
    }
    // --- FIN MODIFICATION ---


    function showDeleteConfirmation(message, callback) {
        confirmTitle.textContent = 'Confirmation requise';
        confirmMessage.textContent = message;

        confirmCancelBtn.classList.remove('hidden');
        confirmOkBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
        confirmOkBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
        confirmOkBtn.textContent = 'Confirmer';

        confirmCallback = callback;

        confirmModal.classList.remove('hidden');
        setTimeout(() => {
            confirmModalBox.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }
    
    function hideConfirmation() {
        confirmModalBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            confirmModal.classList.add('hidden');
            confirmCallback = null;
        }, 200);
    }
    
    function showCustomAlert(title, message) {
        // Cette fonction reste pour les alertes bloquantes (erreurs critiques, etc.)
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;

        confirmCancelBtn.classList.add('hidden');
        confirmOkBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'focus:ring-red-500');
        confirmOkBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'focus:ring-blue-500');
        confirmOkBtn.textContent = 'Fermer';

        confirmCallback = null;
        
        confirmModal.classList.remove('hidden');
        setTimeout(() => {
            confirmModalBox.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }
    
    function hideLoadPatientModal() {
        loadPatientBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            loadPatientModal.classList.add('hidden');
        }, 200);
    }

    function openLoadPatientModal(savedPatients) {
        if (savedPatients.length === 0) {
            loadPatientListContainer.innerHTML = '<p class="text-gray-500">Aucun dossier patient n\'a encore été sauvegardé.</p>';
        } else {
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
        }

        loadPatientModal.classList.remove('hidden');
        setTimeout(() => {
            loadPatientBox.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }

    // --- Fonctions de tri ---
    
    function applySort(type) {
        const btnId = `sort-${type}-btn`;
        const listIdMap = {
            'observations': 'observations-list',
            'transmissions': 'transmissions-list-ide'
        };
        const listId = listIdMap[type];
        if (!listId) return;

        const button = document.getElementById(btnId);
        const list = document.getElementById(listId);
        
        if (!button || !list) return;

        const sortOrder = button.dataset.sortOrder;
        const items = Array.from(list.querySelectorAll('.timeline-item'));
        
        items.sort((a, b) => {
            const offsetA = parseInt(a.dataset.dateOffset, 10);
            const offsetB = parseInt(b.dataset.dateOffset, 10);
            return (sortOrder === 'desc') ? (offsetB - offsetA) : (offsetA - offsetB);
        });

        items.forEach(item => list.appendChild(item));
    }
    
    function toggleSort(type) {
        const btnId = `sort-${type}-btn`;
        const button = document.getElementById(btnId);
        const icon = button.querySelector('i');
        if (!button || !icon) return;

        const currentOrder = button.dataset.sortOrder;
        const newOrder = (currentOrder === 'desc') ? 'asc' : 'desc';
        
        button.dataset.sortOrder = newOrder;
        if (newOrder === 'desc') {
            button.title = "Trier (Plus récent en haut)";
            icon.classList.remove('fa-sort-amount-up');
            icon.classList.add('fa-sort-amount-down');
        } else {
            button.title = "Trier (Plus ancien en haut)";
            icon.classList.remove('fa-sort-amount-down');
            icon.classList.add('fa-sort-amount-up');
        }
        applySort(type);
    }

    // --- Fonctions d'ajout / lecture de formulaire ---

    function readObservationForm() {
        const author = document.getElementById('new-observation-author').value.trim();
        const text = document.getElementById('new-observation-text').value.trim();
        const dateValue = document.getElementById('new-observation-date').value;
        const entryDateStr = document.getElementById('patient-entry-date').value;
        
        if (!text || !author || !dateValue || !entryDateStr) {
             if(!entryDateStr) showCustomAlert("Action impossible", "Veuillez d'abord définir une date d'entrée pour le patient.");
            return null;
        }

        const eventDate = new Date(dateValue + 'T00:00:00');
        const formattedDate = utils.formatDate(eventDate);
        const dateOffset = utils.calculateDaysOffset(entryDateStr, dateValue);
        
        document.getElementById('new-observation-form').reset();
        
        return { author, text, formattedDate, dateOffset };
    }

    function addObservation(data, fromLoad = false) {
        const { author, text, formattedDate, dateOffset } = data;

        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.dataset.author = author;
        item.dataset.text = text;
        item.dataset.dateOffset = dateOffset;
        
        item.innerHTML = `
            <div class="timeline-dot dot-rose"></div>
            <div class="flex justify-between items-start">
                <h3 class="font-semibold text-gray-800">${formattedDate} - ${author.toUpperCase()}</h3>
                <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer l'observation">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
            <p class="text-gray-600 preserve-whitespace"></p>
        `;
        item.querySelector('p').textContent = text;
        
        const list = document.getElementById('observations-list');
        if (fromLoad) {
            list.appendChild(item); 
        } else {
            const sortOrder = document.getElementById('sort-observations-btn')?.dataset.sortOrder || 'desc';
            if (sortOrder === 'desc') list.prepend(item);
            else list.appendChild(item);
        }
    }
    
    function readTransmissionForm() {
        const author = document.getElementById('new-transmission-author-2').value.trim();
        const text = document.getElementById('new-transmission-text-2').value.trim();
        const dateValue = document.getElementById('new-transmission-date').value;
        const entryDateStr = document.getElementById('patient-entry-date').value;
        
        if (!text || !author || !dateValue || !entryDateStr) {
             if(!entryDateStr) showCustomAlert("Action impossible", "Veuillez d'abord définir une date d'entrée pour le patient.");
            return null;
        }

        const eventDate = new Date(dateValue + 'T00:00:00');
        const formattedDate = utils.formatDate(eventDate);
        const dateOffset = utils.calculateDaysOffset(entryDateStr, dateValue);
        
        document.getElementById('new-transmission-form-2').reset();
        
        return { author, text, formattedDate, dateOffset };
    }
    
    function addTransmission(data, fromLoad = false) {
        const { author, text, formattedDate, dateOffset } = data;

        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.dataset.author = author;
        item.dataset.text = text;
        item.dataset.dateOffset = dateOffset;
        
        item.innerHTML = `
            <div class="timeline-dot dot-green"></div>
            <div class="flex justify-between items-start">
                <h3 class="font-semibold text-gray-800">${formattedDate} - ${author.toUpperCase()}</h3>
                <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer la transmission">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
            <p class="text-gray-600 preserve-whitespace"></p>
        `;

        const safeTextNode = document.createTextNode(text);
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(safeTextNode);
        const formattedText = tempDiv.innerHTML
            .replace(/Cible :/g, '<strong class="text-gray-900">Cible :</strong>')
            .replace(/Données :/g, '<br><strong class="text-gray-900">Données :</strong>')
            .replace(/Actions :/g, '<br><strong class="text-gray-900">Actions :</strong>')
            .replace(/Résultat :/g, '<br><strong class="text-gray-900">Résultat :</strong>');
        item.querySelector('p').innerHTML = formattedText;
        
        const list = document.getElementById('transmissions-list-ide');
        if (fromLoad) {
            list.appendChild(item);
        } else {
            const sortOrder = document.getElementById('sort-transmissions-btn')?.dataset.sortOrder || 'desc';
            if (sortOrder === 'desc') list.prepend(item);
            else list.appendChild(item);
        }
    }

    function readPrescriptionForm() {
        const name = document.getElementById('med-name').value.trim();
        const posologie = document.getElementById('med-posologie').value.trim();
        const voie = document.getElementById('med-voie').value; 
        const startDateValue = document.getElementById('med-start-date').value;
        const entryDateStr = document.getElementById('patient-entry-date').value;
        
        if (!name || !startDateValue || !entryDateStr) {
            if(!entryDateStr) showCustomAlert("Action impossible", "Veuillez d'abord définir une date d'entrée pour le patient.");
            return null;
        }

        const dateOffset = utils.calculateDaysOffset(entryDateStr, startDateValue);
        const type = voie; 
        
        document.getElementById('new-prescription-form').reset();
        
        return { name, posologie, voie, type, bars: [], dateOffset };
    }

    function addPrescription(data, fromLoad = false) {
        let { name, posologie, voie, type, bars, dateOffset } = data;
        const entryDateStr = document.getElementById('patient-entry-date').value;
        
        if (isNaN(parseInt(dateOffset, 10))) dateOffset = 0;

        const targetDate = utils.calculateDateFromOffset(entryDateStr, dateOffset);
        const formattedStartDate = utils.formatDate(targetDate).slice(0, 8); 
        
        const tbody = document.getElementById("prescription-tbody");
        const newRow = tbody.insertRow();
        newRow.dataset.type = type; 
        newRow.dataset.dateOffset = dateOffset;

        newRow.innerHTML = `
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

        const timelineCell = newRow.insertCell();
        timelineCell.colSpan = 88; 
        timelineCell.className = 'iv-bar-container';

        if (type === 'Per Os') {
            timelineCell.classList.add('marker-container');
        }
        
        const barsToCreate = (fromLoad && bars && Array.isArray(bars)) ? bars : [];
        
        barsToCreate.forEach(barData => {
            if (barData && barData.left && (barData.width || barData.width === 0)) {
                const bar = document.createElement('div');
                bar.className = 'iv-bar';
                
                if (type === 'Per Os') {
                    bar.classList.add('marker-bar');
                } else if (type === 'Respiratoire') {
                    bar.classList.add('iv-bar-respi'); 
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
    }
    
    function readCareDiagramForm() {
        const name = document.getElementById('care-name').value.trim();
        if (!name) return null;
        
        document.getElementById('new-care-form').reset();
        return { name };
    }
    
    function addCareDiagramRow(data) {
        const { name } = data;
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
            for (let j = 0; j < 3; j++) {
                const borderClass = (j === 0) ? 'border-l' : '';
                cellsHTML += `<td class="${borderClass} p-0" style="min-width: 70px;">
                                <input type="checkbox" class="block mx-auto">
                            </td>`;
            }
        }
        newRow.innerHTML = cellsHTML;
    }

    function deleteEntry(button) {
        const entry = button.closest('.timeline-item');
        if (entry) {
            entry.remove();
            return true; 
        }
        return false;
    }
    function deletePrescription(button) {
        const row = button.closest('tr');
        if (row) {
            row.remove();
            return true; 
        }
        return false;
    }
    function deleteCareDiagramRow(button) {
        const row = button.closest('tr');
        if (row) {
            row.remove();
            return true; 
        }
        return false;
    }

    // --- Fonctions UI : Logique des Comptes Rendus (NOUVEAU) ---

    function openCrModal(crId, crTitle, crText) {
        crModalTitle.textContent = crTitle;
        crModalActiveIdInput.value = crId;
        crModalTextarea.value = crText || '';
        
        crModal.classList.remove('hidden');
        setTimeout(() => {
            crModalBox.classList.remove('scale-95', 'opacity-0');
            crModalTextarea.focus();
        }, 10);
    }
    
    function closeCrModal() {
        crModalBox.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            crModal.classList.add('hidden');
            crModalActiveIdInput.value = '';
            crModalTextarea.value = '';
        }, 200);
    }
    
    function updateCrCardCheckmark(crId, hasData) {
        const card = document.querySelector(`.cr-card[data-cr-id="${crId}"]`);
        if (!card) return;
        
        const icon = card.querySelector('.cr-check-icon');
        if (icon) {
            if (hasData) {
                icon.classList.remove('hidden');
            } else {
                icon.classList.add('hidden');
            }
        }
    }


    // --- Fonctions UI : Logique IV (Barres de prescription) ---

    function handleIVDblClick(e) {
        const bar = e.currentTarget;
        showDeleteConfirmation("Effacer cette administration ?", () => {
            const cell = bar.parentElement;
            if(cell) {
                const barId = bar.dataset.barId;
                if (barId) {
                    cell.querySelectorAll(`.iv-time-label[data-bar-id="${barId}"]`).forEach(label => label.remove());
                }
            }
            bar.remove();
            document.dispatchEvent(new CustomEvent('uiNeedsSave'));
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
            
            const rowType = cell.closest('tr').dataset.type;
            if (rowType === 'Per Os') {
                newBar.classList.add('marker-bar');
            } else if (rowType === 'Respiratoire') {
                newBar.classList.add('iv-bar-respi');
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
        document.dispatchEvent(new CustomEvent('uiNeedsSave'));
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
        
        const startDateTime = utils.roundDateTo15Min(rawStartDateTime);
        const endDateTime = utils.roundDateTo15Min(rawEndDateTime);
        
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
        endLabel.style.left = `${startPercent + widthPercent}%`;
    }

    // --- Fonctions UI : Graphique Pancarte ---
    
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

        const dataSetsConfig = { 
            'Pouls (/min)': { yAxisID: 'y1', borderColor: '#ef4444' }, 
            'Tension (mmHg)': { type: 'bar', yAxisID: 'y', backgroundColor: '#f9731640' }, 
            'Température (°C)': { yAxisID: 'y3', borderColor: '#3b82f6' }, 
            'SpO2 (%)': { yAxisID: 'y4', borderColor: '#10b981' }, 
            'Douleur (EVA /10)': { yAxisID: 'y2', borderColor: '#8b5cf6' },
        };

        const datasets = Array.from(table.querySelectorAll('tbody tr')).map(row => {
            const paramName = row.cells[0].textContent.trim();
            if (!dataSetsConfig[paramName]) return null;
            
            const inputs = Array.from(row.querySelectorAll('input'));
            let data;

            if (paramName === 'Diurèse (L)') {
                data = [];
                inputs.forEach(input => {
                    const value = parseFloat(input.value.replace(',', '.'));
                    data.push(isNaN(value) ? null : value);
                    data.push(null); data.push(null);
                });
            } else {
                data = inputs.map(input => {
                    if (paramName === 'Tension (mmHg)' && input.value.includes('/')) {
                        const parts = input.value.split('/');
                        return [parseFloat(parts[1]), parseFloat(parts[0])]; // [min, max]
                    }
                    const value = parseFloat(input.value.replace(',', '.'));
                    return isNaN(value) ? null : value;
                });
            }
             
            return { 
                label: paramName, 
                data, 
                type: 'line', 
                tension: 0.2, 
                borderWidth: 2, 
                spanGaps: true, 
                pointBackgroundColor: dataSetsConfig[paramName].borderColor || '#000', 
                ...dataSetsConfig[paramName]
            };
        }).filter(ds => ds !== null);

        const ctx = document.getElementById('pancarteChart').getContext('2d');
        if (pancarteChartInstance) pancarteChartInstance.destroy();
        
        pancarteChartInstance = new Chart(ctx, {
            type: 'bar', 
            data: { labels, datasets },
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

    // --- Fonctions UI : Tutoriel ---
    
    // MODIFICATION : Mise à jour du texte du tutoriel
    const tutorialSteps = [
        { element: '#patient-list li:first-child button', text: "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier.", position: 'right' },
        { element: '#patient-header-form', text: "Cet en-tête contient les informations principales. La 'Date d'entrée' est cruciale : toutes les autres dates du dossier seront recalculées à partir de celle-ci.", position: 'bottom' },
        { element: '#tabs-nav-container', text: "Utilisez ces onglets pour naviguer entre les différentes sections du dossier.", position: 'bottom' },
        { element: '#save-status-button', text: "Cet indicateur vous montre l'état de vos données. Vert = 'Enregistré', Orange = 'Modifications non sauvegardées'. Cliquez dessus à tout moment pour forcer une sauvegarde et synchroniser vos données.", position: 'bottom' },
        { element: '#save-patient-btn', text: "Ce bouton crée une 'Sauvegarde' du dossier actuel que vous pouvez recharger plus tard.", position: 'bottom-left' },
        { element: '#load-patient-btn', text: "Utilisez ce bouton pour charger une sauvegarde dans la chambre actuelle.", position: 'bottom-left' },
        { element: '#import-json-btn', text: "Ce bouton vous permet d'importer un fichier JSON.", position: 'bottom-left' },
        { element: '#export-json-btn', text: "Et celui-ci vous permet d'exporter le dossier actuel en fichier .json.", position: 'bottom-left' },
        { element: '#clear-current-patient-btn', text: "Ce bouton efface les données de la chambre actuelle.", position: 'bottom-left' },
        { element: '#account-management-btn', text: "C'est ici que le formateur gère son compte, peut créer des comptes étudiants et définir leurs permissions.", position: 'top' },
        { element: 'button[id="clear-all-data-btn"]', text: "ATTENTION : Ce bouton réinitialise les 10 chambres du service.", position: 'top' },
        { element: 'button[id="start-tutorial-btn"]', text: "Vous avez terminé ! Vous pouvez relancer ce tutoriel à tout moment.", position: 'top' }
    ];
    // FIN MODIFICATION

    function startTutorial() {
        currentStepIndex = 0;
        
        const firstPatientButton = document.querySelector('#patient-list li:first-child button');
        if (!firstPatientButton) {
            tutorialSteps[0].element = '#sidebar';
            tutorialSteps[0].text = "Bienvenue ! Voici la barre latérale où les patients apparaîtront.";
        } else {
            tutorialSteps[0].element = '#patient-list li:first-child button';
            tutorialSteps[0].text = "Bienvenue ! Voici la liste des patients. Cliquez sur un patient pour ouvrir son dossier.";
        }
        
        tutorialOverlay.classList.remove('hidden');
        showTutorialStep(currentStepIndex);
    }

    function endTutorial(setFlag = false) {
        tutorialOverlay.classList.add('hidden');
        if (highlightedElement) {
            highlightedElement.classList.remove('tutorial-highlight');
            if (highlightedElement.closest('#header-buttons') || highlightedElement.id === 'save-status-button') { 
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
            if (highlightedElement.closest('#header-buttons') || highlightedElement.id === 'save-status-button') { 
                highlightedElement.style = '';
            }
        }

        if (index >= tutorialSteps.length) {
            endTutorial(true);
            return;
        }

        const step = tutorialSteps[index];
        const element = document.querySelector(step.element);

        if (!element) {
            currentStepIndex++;
            showTutorialStep(currentStepIndex);
            return;
        }

        tutorialText.textContent = step.text;
        tutorialNextBtn.textContent = (index === tutorialSteps.length - 1) ? "Terminer" : "Suivant";
        
        element.classList.add('tutorial-highlight');
        highlightedElement = element;

        if (element.closest('#header-buttons') || element.id === 'save-status-button') { 
            element.style.setProperty('z-index', '9997', 'important');
            element.style.setProperty('position', 'relative', 'important');
        }

        const rect = element.getBoundingClientRect();
        const boxRect = tutorialStepBox.getBoundingClientRect();
        const margin = 15;
        let top, left;

        switch(step.position) {
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
            default: // bottom
                top = rect.bottom + margin;
                left = rect.left + (rect.width / 2) - (boxRect.width / 2);
        }

        if (top < margin) top = margin;
        if (left < margin) left = margin;
        if (top + boxRect.height > window.innerHeight - margin) top = window.innerHeight - boxRect.height - margin;
        if (left + boxRect.width > window.innerWidth - margin) left = window.innerWidth - boxRect.width - margin;

        tutorialStepBox.style.top = `${top}px`;
        tutorialStepBox.style.left = `${left}px`;
    }


    // --- Exposition du service ---
    
    window.uiService = {
        // Initialisation
        initUIComponents,
        initializeDynamicTables,
        setupModalListeners,
        
        // Permissions
        applyPermissions,
        
        // Sidebar
        initSidebar,
        updateSidebarActiveState,
        updateSidebarEntryName,
        
        // Remplissage de formulaire
        resetForm,
        fillFormFromState,
        fillListsFromState,
        fillCareDiagramFromState,
        fillPrescriptionsFromState,
        fillBioFromState,
        fillPancarteFromState,
        fillCrCardsFromState,
        
        // Mises à jour UI
        updateAgeDisplay,
        updateJourHosp,
        calculateAndDisplayIMC,
        setupSync,
        updateDynamicDates,
        refreshAllRelativeDates,
        updateSaveStatus, 
        
        // Navigation & Modales
        changeTab,
        autoResize,
        toggleFullscreen,
        showToast, // NOUVEAU : Exposer le toast
        showDeleteConfirmation,
        showCustomAlert, // Gardé pour les alertes bloquantes
        hideConfirmation,
        openLoadPatientModal,
        hideLoadPatientModal,
        
        // Tri
        toggleSort,
        
        // Fonctions d'ajout/lecture de formulaire
        readObservationForm,
        addObservation,
        readTransmissionForm,
        addTransmission,
        readPrescriptionForm,
        addPrescription,
        readCareDiagramForm,
        addCareDiagramRow,
        
        // Suppression d'entrées
        deleteEntry,
        deletePrescription,
        deleteCareDiagramRow,
        
        // Logique Comptes Rendus (CR)
        openCrModal,
        closeCrModal,
        updateCrCardCheckmark,
        
        // Logique IV
        handleIVMouseDown,
        handleIVMouseMove,
        handleIVMouseUp,
        
        // Graphique
        updatePancarteChart,
        
        // Tutoriel
        startTutorial,
        endTutorial,
        showTutorialStep,
        incrementTutorialStep: () => { currentStepIndex++; showTutorialStep(currentStepIndex); }
    };

})();