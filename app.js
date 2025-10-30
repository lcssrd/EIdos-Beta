// Enveloppe de l'IIFE pour encapsuler le code et éviter la pollution globale
(function() {
    "use strict"; // Active le mode strict pour de meilleures vérifications d'erreurs

    let pancarteChartInstance;
    const patients = Array.from({ length: 10 }, (_, i) => ({
        id: `chambre_${101 + i}`,
        room: `${101 + i}`
    }));
    let activePatientId = localStorage.getItem('activePatientId') || patients[0].id;

    let ivInteraction = {
        active: false,
        mode: null, 
        targetBar: null,
        targetCell: null,
        startX: 0,
        startLeft: 0,
        startWidth: 0,
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

    function getSaveKey(patientId) {
        return `dossierPatientData_${patientId}`;
    }

    function saveData(patientId) {
        if (!patientId) return;
        const SAVE_KEY = getSaveKey(patientId);
        const state = {};

        // 1. Sauvegarder tous les champs <input> et <textarea> simples avec un ID
        document.querySelectorAll('input[id], textarea[id]').forEach(el => {
            const id = el.id;
            if (el.type === 'checkbox' || el.type === 'radio') {
                state[id] = el.checked;
            } else {
                state[id] = el.value;
            }
        });

        // 2. Sauvegarder le contenu HTML des listes dynamiques (Observations, Transmissions)
        const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
        dynamicContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) state[id + '_html'] = el.innerHTML;
        });

        // 3. Sauvegarder les données de Biologie dans un objet structuré
        const bioData = {
            dates: [],
            analyses: {}
        };
        document.querySelectorAll('#bio-table thead input[type="text"]').forEach(input => {
            bioData.dates.push(input.value);
        });
        document.querySelectorAll('#bio-table tbody tr').forEach(row => {
            if (row.cells.length > 1 && row.cells[0].classList.contains('font-semibold')) { 
                const analyseName = row.cells[0].textContent.trim();
                if (analyseName) {
                    bioData.analyses[analyseName] = [];
                    row.querySelectorAll('input[type="text"]').forEach(input => {
                        bioData.analyses[analyseName].push(input.value);
                    });
                }
            }
        });
        state.biologie = bioData;

        // 4. Sauvegarder les données de Pancarte dans un objet structuré
        const pancarteData = {};
        document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
            const paramName = row.cells[0].textContent.trim();
            if (paramName) {
                pancarteData[paramName] = [];
                row.querySelectorAll('input').forEach(input => {
                    pancarteData[paramName].push(input.value);
                });
            }
        });
        state.pancarte = pancarteData;

        // 5. Sauvegarder les Prescriptions (structurées)
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
                const barsNodeList = row.querySelectorAll('.iv-bar');
                prescriptionData.bars = [];
                barsNodeList.forEach(bar => {
                    prescriptionData.bars.push({
                        left: bar.style.left,
                        width: bar.style.width,
                        title: bar.title
                    });
                });
            } else {
                prescriptionData.checkboxes = Array.from(row.querySelectorAll('input[type="checkbox"]')).map(cb => cb.checked);
            }
            state.prescriptions.push(prescriptionData);
        });

        // 6. Sauvegarder les cases à cocher du diagramme de soins (via _html)
        state.careDiagramCheckboxes = Array.from(document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]')).map(cb => cb.checked);
        
        // 7. Sauvegarder l'état des boutons de verrouillage
        state.lockButtonStates = {};
        document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
            state.lockButtonStates[btn.id] = btn.classList.contains('is-locked');
        });

        // 8. Sauvegarder le nom du patient pour la barre latérale
        const nomUsage = document.getElementById('patient-nom-usage').value.trim();
        const prenom = document.getElementById('patient-prenom').value.trim();
        const patientName = `${nomUsage} ${prenom}`.trim();
        state['sidebar_patient_name'] = patientName;
        
        // 9. Sauvegarder dans le localStorage
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        
        // 10. Mettre à jour la barre latérale
        const sidebarEntry = document.querySelector(`#patient-list button[data-patient-id="${patientId}"] .patient-name`);
        if (sidebarEntry) {
            sidebarEntry.textContent = patientName || `Chambre ${patientId.split('_')[1]}`;
        }
    }

    function loadData(patientId) {
        if (!patientId) return;
        const SAVE_KEY = getSaveKey(patientId);
        const savedState = localStorage.getItem(SAVE_KEY);

        if (!savedState || savedState === '{}') {
            resetForm();
        } else {
            const state = JSON.parse(savedState);
            
            // 1. Charger tous les champs <input> et <textarea> simples
            Object.keys(state).forEach(id => {
                if (id === 'biologie' || id === 'pancarte' || id === 'prescriptions' || id ==='lockButtonStates' || id === 'careDiagramCheckboxes' || id.endsWith('_html')) return;
                
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox' || el.type === 'radio') {
                        el.checked = state[id];
                    } else {
                        el.value = state[id];
                    }
                }
            });

            // 2. Charger le contenu HTML dynamique (Observations, Transmissions, Diagramme Soins)
            const dynamicContentIds = ['observations-list', 'transmissions-list-ide', 'care-diagram-tbody'];
            dynamicContentIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && state[id + '_html']) {
                    el.innerHTML = state[id + '_html'];
                } else if (id === 'care-diagram-tbody' && (!state[id + '_html'])) {
                    el.innerHTML = getDefaultForCareDiagramTbody();
                }
            });

            // 3. Charger les Prescriptions
            if (state.prescriptions) {
                const tbody = document.getElementById('prescription-tbody');
                tbody.innerHTML = '';
                state.prescriptions.forEach(pData => {
                    addPrescription(pData, true);
                });
            }
            
            // 4. (Obsolète si _html fonctionne, mais gardé pour compatibilité)
            if (state.careDiagramCheckboxes && !state['care-diagram-tbody_html']) {
                document.querySelectorAll('#care-diagram-tbody input[type="checkbox"]').forEach((cb, index) => {
                    cb.checked = state.careDiagramCheckboxes[index] || false;
                });
            }

            // 5. Charger les données de Biologie depuis l'objet structuré
            if (state.biologie) {
                document.querySelectorAll('#bio-table thead input[type="text"]').forEach((input, index) => {
                    if (state.biologie.dates && state.biologie.dates[index]) {
                        input.value = state.biologie.dates[index];
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

            // 6. Charger les données de Pancarte depuis l'objet structuré
            if (state.pancarte) {
                document.querySelectorAll('#pancarte-table tbody tr').forEach(row => {
                    const paramName = row.cells[0].textContent.trim();
                    if (paramName && state.pancarte && state.pancarte[paramName]) {
                        row.querySelectorAll('input').forEach((input, index) => {
                            input.value = state.pancarte[paramName][index] || '';
                        });
                    }
                });
            }
            
            // 7. Mettre à jour les dates dynamiques (J0, J1...)
            const entryDateValue = document.getElementById('patient-entry-date').value;
            if (entryDateValue) {
                const entryDate = new Date(entryDateValue);
                if (!isNaN(entryDate.getTime())) {
                    updateDynamicDates(entryDate);
                }
            }
            
            // 8. Charger l'état des boutons de verrouillage
            if (state.lockButtonStates) {
                Object.keys(state.lockButtonStates).forEach(buttonId => {
                    if (state.lockButtonStates[buttonId]) { // Si le bouton était verrouillé
                        const button = document.getElementById(buttonId);
                        if (button && !button.classList.contains('is-locked')) { 
                            let containerId;
                            if (buttonId === 'lock-header-btn') containerId = 'patient-header-form';
                            if (buttonId === 'lock-admin-btn') containerId = 'administratif';
                            if (buttonId === 'lock-vie-btn') containerId = 'mode-de-vie';
                            if (containerId) {
                                toggleLock(containerId, buttonId, true); 
                            }
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
    }

    function clearCurrentPatientData() {
        const message = `Êtes-vous sûr de vouloir effacer le dossier du patient dans la chambre ${activePatientId.split('_')[1]} ? Cette action est irréversible.`;
        showDeleteConfirmation(message, () => {
            localStorage.removeItem(getSaveKey(activePatientId));
            switchPatient(activePatientId, true); 
        });
    }

    function clearAllData() {
        const message = "ATTENTION : Vous êtes sur le point de supprimer TOUS les dossiers de tous les patients. Cette action est irréversible. Continuer ?";
        showDeleteConfirmation(message, () => {
            localStorage.clear();
            location.reload();
        });
    }

    function exportCurrentPatientData() {
        saveData(activePatientId);
        const SAVE_KEY = getSaveKey(activePatientId);
        const dataStr = localStorage.getItem(SAVE_KEY);
        if (!dataStr || dataStr === '{}') return;
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const patientName = (document.getElementById('patient-nom-usage').value.trim() || activePatientId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `dossier_${patientName}.json`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }

    function importCurrentPatientData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();

        reader.onload = e => {
            const content = e.target.result;
            try {
                if (!content || typeof content !== 'string' || content.trim().length === 0) {
                    throw new Error("Le contenu du fichier est vide ou invalide.");
                }
                const jsonData = JSON.parse(content); 
                if (typeof jsonData !== 'object' || jsonData === null) {
                    throw new Error("Le fichier JSON ne contient pas un objet valide.");
                }
                const SAVE_KEY = getSaveKey(activePatientId);
                localStorage.setItem(SAVE_KEY, content);
                switchPatient(activePatientId, true);
            } catch (error) {
                showCustomAlert("Erreur d'importation", `Le fichier n'est pas un JSON valide ou est corrompu. Erreur: ${error.message}`);
            }
        };
        reader.onerror = (e) => {
            showCustomAlert("Erreur de lecture", "Impossible de lire le fichier sélectionné.");
        };

        reader.readAsText(file);
        event.target.value = '';
    }

    function initSidebar() {
        const list = document.getElementById('patient-list');
        let listHTML = '';
        patients.forEach(patient => {
            const savedState = JSON.parse(localStorage.getItem(getSaveKey(patient.id)) || '{}');
            const patientName = savedState.sidebar_patient_name || `Chambre ${patient.room}`;
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

        document.querySelectorAll('button[id^="lock-"]').forEach(btn => {
            if (btn.classList.contains('is-locked')) { 
                btn.click(); 
            }
        });
        if (pancarteChartInstance) pancarteChartInstance.destroy();
    }

    function switchPatient(newPatientId, skipSave = false) {
        if (activePatientId !== newPatientId && !skipSave) {
            saveData(activePatientId);
        }
        activePatientId = newPatientId;
        localStorage.setItem('activePatientId', newPatientId);
        resetForm();
        loadData(newPatientId);
        updateSidebarActiveState(newPatientId);
        setTimeout(() => {
            document.querySelectorAll('textarea.info-value').forEach(autoResize);
        }, 0);
        updatePancarteChart();
        const mainContent = document.getElementById('main-content-wrapper');
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
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
            html = '<tr><th class="p-2 text-left align-bottom min-w-[220px]" rowspan="2">Médicament / Soin</th><th class="p-2 text-left align-bottom min-w-[180px]" rowspan="2">Posologie</th><th class="p-2 text-left align-bottom min-w-[120px]" rowspan="2">Voie</th><th class="p-2 text-left align-bottom" rowspan="2" style="min-width: 100px;">Date de début</th>';
            for(let i=0; i<11; i++) { html += `<th class="p-2 text-center" colspan="4">Jour ${i}</th>`;}
            html += '</tr><tr>';
            for(let i=0; i<11; i++) { html += `<th class="p-1 text-center small-col">M</th><th class="p-1 text-center small-col">Mi</th><th class="p-1 text-center small-col">S</th><th class="p-1 text-center small-col">N</th>`;}
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
                
                // NOUVELLE CORRECTION : onchange="..." retiré
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
            for(let i=0; i<11; i++) { html += `<th colspan="3" class="border-l">Jour ${i}</th>`;}
            html += '</tr><tr><th class="min-w-[220px]"></th>';
            
            for(let i=0; i<11; i++) { 
                html += `<th class="border-l p-1 text-center small-col">M</th>
                        <th class="p-1 text-center small-col">S</th>
                        <th class="p-1 text-center small-col">N</th>`;
            }
            html += '</tr>';
            careDiagramThead.innerHTML = html;
        }
    }

    function setupEventListeners() {
        // Barre latérale
        document.getElementById('start-tutorial-btn').addEventListener('click', startTutorial);
        document.getElementById('clear-all-data-btn').addEventListener('click', clearAllData);
        
        // Entête principale
        document.getElementById('export-patient-btn').addEventListener('click', exportCurrentPatientData);
        document.getElementById('import-patient-btn').addEventListener('click', () => document.getElementById('import-file').click());
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

        // Listes dynamiques pour suppression (Délégation)
        document.getElementById('observations-list').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                deleteEntry(deleteBtn);
            }
        });

        document.getElementById('transmissions-list-ide').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                deleteEntry(deleteBtn);
            }
        });

        document.getElementById('prescription-tbody').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                deletePrescription(deleteBtn);
            }
        });

        document.getElementById('care-diagram-tbody').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('button[title*="Supprimer"]');
            if (deleteBtn) {
                deleteCareDiagramRow(deleteBtn);
            }
        });

        // NOUVELLE CORRECTION : Délégation pour la pancarte
        document.getElementById('pancarte-tbody').addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT') {
                updatePancarteChart();
            }
        });

        // NOUVELLE CORRECTION : Délégation pour autoResize
        document.querySelector('main').addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('info-value')) {
                autoResize(e.target);
            }
        });

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
    }

    function initApp() {
        initializeDynamicTables();
        initSidebar();
        
        setupEventListeners();
        setupModalListeners();
        setupSync(); 

        let saveTimeout;
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => saveData(activePatientId), 500);
        };
        document.querySelector('main').addEventListener('input', debouncedSave);
        document.querySelector('main').addEventListener('change', debouncedSave);

        switchPatient(activePatientId, true);

        const activeTabId = localStorage.getItem('activeTab') || 'administratif';
        const activeTabButton = document.querySelector(`nav button[data-tab-id="${activeTabId}"]`);
        if (activeTabButton) {
            changeTab({ currentTarget: activeTabButton }, activeTabId);
        } else {
            document.querySelector('#tabs-nav button').click();
        }

        if (!localStorage.getItem('tutorialCompleted')) {
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
                        el1.value = el1.value;
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
        updateHeaders('#prescription-table thead tr:first-child th[colspan="4"]');
        updateHeaders('#pancarte-table thead tr:first-child th[colspan="3"]');
        updateHeaders('#care-diagram-table thead tr:first-child th[colspan="3"]');
        if (pancarteChartInstance) updatePancarteChart();
    }
    
    function toggleLock(containerId, buttonId, forceState = false) {
        const container = document.getElementById(containerId);
        const button = document.getElementById(buttonId);
        
        const isCurrentlyLocked = button.classList.contains('is-locked');
        const isUnlocking = forceState ? !forceState : isCurrentlyLocked;

        const inputs = container.querySelectorAll('.info-value, input[type=text], input[type=date]');
        
        if (!isUnlocking && containerId === 'patient-header-form') {
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
            input.disabled = !isUnlocking;
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
        const clickedTab = event.currentTarget;
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

    function addPrescription(data = null, fromLoad = false) {
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
            <td class="p-2 text-left align-top">
                <div class="flex items-start justify-between">
                    <span>${name}</span>
                    <button type="button" class="ml-2 text-red-500 hover:text-red-700 transition-colors" title="Supprimer la prescription">
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
            timelineCell.addEventListener('mousedown', handleIVMouseDown);
            const barsToCreate = [];
            if (fromLoad && bars && Array.isArray(bars)) {
                barsToCreate.push(...bars);
            } else if (fromLoad && data.left && data.width) { 
                barsToCreate.push({ left: data.left, width: data.width, title: data.title });
            }
            barsToCreate.forEach(barData => {
                if (barData && barData.left && barData.width) {
                    const bar = document.createElement('div');
                    bar.className = 'iv-bar';
                    bar.style.left = barData.left;
                    bar.style.width = barData.width;
                    bar.title = barData.title || '';
                    bar.addEventListener('dblclick', handleIVDblClick);
                    const handle = document.createElement('div');
                    handle.className = 'resize-handle';
                    bar.appendChild(handle);
                    timelineCell.appendChild(bar);
                    setTimeout(() => updateIVBarDetails(bar, timelineCell), 0);
                }
            });
        } else {
            let checkboxCellsHTML = '';
            for (let i = 0; i < 11; i++) {
                for (let j = 0; j < 4; j++) {
                    const cbIndex = i * 4 + j;
                    const isChecked = fromLoad && checkboxes && checkboxes[cbIndex];
                    checkboxCellsHTML += `<td class="p-0 small-col"><input type="checkbox" ${isChecked ? 'checked' : ''}></td>`;
                }
            }
            newRow.innerHTML = baseCellsHTML + checkboxCellsHTML;
        }
        if (!fromLoad) {
            document.getElementById('new-prescription-form').reset();
        }
    }
    
    function addCareDiagramRow() {
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
            cellsHTML += `<td class="border-l p-0 small-col"><input type="checkbox"></td>
                        <td class="p-0 small-col"><input type="checkbox"></td>
                        <td class="p-0 small-col"><input type="checkbox"></td>`;
        }
        newRow.innerHTML = cellsHTML;
        document.getElementById('new-care-form').reset();
    }
    function handleIVDblClick(e) {
        const bar = e.currentTarget;
        showDeleteConfirmation("Effacer cette barre de perfusion IV ?", () => {
            const cell = bar.parentElement;
            if(cell) {
                cell.querySelectorAll('.iv-time-label').forEach(label => label.remove());
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
            const startX = e.clientX - rect.left;
            const newBar = document.createElement('div');
            newBar.className = 'iv-bar';
            newBar.style.left = `${(startX / rect.width) * 100}%`;
            newBar.style.width = '0px';
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
            };
            document.body.classList.add('is-drawing-iv');
        } else if (e.target.classList.contains('resize-handle')) {
            ivInteraction.mode = 'resize';
            const bar = e.target.parentElement;
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
        const { mode, targetBar, targetCell, startX, startWidth, startLeft } = ivInteraction;
        const cellRect = targetCell.getBoundingClientRect();
        const dx = e.clientX - startX;
        if (mode === 'draw' || mode === 'resize') {
            let newWidth = startWidth + dx;
            newWidth = Math.max(5, newWidth); 
            newWidth = Math.min(newWidth, cellRect.width - targetBar.offsetLeft);
            targetBar.style.width = `${(newWidth / cellRect.width) * 100}%`;
        } else if (mode === 'move') {
            let newLeft = startLeft + dx;
            newLeft = Math.max(0, newLeft);
            newLeft = Math.min(newLeft, cellRect.width - targetBar.offsetWidth);
            targetBar.style.left = `${(newLeft / cellRect.width) * 100}%`;
        }
        updateIVBarDetails(targetBar, targetCell);
    }
    function handleIVMouseUp(e) {
        if (!ivInteraction.active) return;
        document.body.className = document.body.className.replace(/is-(drawing|resizing|moving)-iv/g, '').trim().trim();
        ivInteraction = { active: false, mode: null, targetBar: null, targetCell: null, startX: 0, startLeft: 0, startWidth: 0 };
        saveData(activePatientId);
    }
    function updateIVBarDetails(bar, cell) {
        if (!bar || !cell) return;
        const tableStartDateStr = document.getElementById('patient-entry-date').value;
        if (!tableStartDateStr) return;
        const tableStartDate = new Date(tableStartDateStr);
        const totalTimelineMillis = 11 * 24 * 60 * 60 * 1000;
        const startPercent = parseFloat(bar.style.left);
        const widthPercent = parseFloat(bar.style.width);
        const endPercent = startPercent + widthPercent;
        const startOffsetMillis = (startPercent / 100) * totalTimelineMillis;
        const durationMillis = (widthPercent / 100) * totalTimelineMillis;
        const startDateTime = new Date(tableStartDate.getTime() + startOffsetMillis);
        const endDateTime = new Date(startDateTime.getTime() + durationMillis);
        const formatTime = (date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
        bar.title = `Début: ${startDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}\nFin: ${endDateTime.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'})}`;
        let startLabel = cell.querySelector('.iv-time-label.start');
        if (!startLabel) {
            startLabel = document.createElement('span');
            startLabel.className = 'iv-time-label start';
            cell.appendChild(startLabel);
        }
        let endLabel = cell.querySelector('.iv-time-label.end');
        if (!endLabel) {
            endLabel = document.createElement('span');
            endLabel.className = 'iv-time-label end';
            cell.appendChild(endLabel);
        }
        startLabel.textContent = formatTime(startDateTime);
        startLabel.style.left = `${startPercent}%`;
        endLabel.textContent = formatTime(endDateTime);
        endLabel.style.left = `${endPercent}%`;
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

    // --- Section Tutoriel ---
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
            element: 'button[id="clear-all-data-btn"]', 
            text: "ATTENTION : Ce bouton supprime DÉFINITIVEMENT tous les dossiers de tous les patients. À n'utiliser que pour réinitialiser la simulation.",
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
    initApp(); // On appelle directement

})(); // Fin de l'IIFE