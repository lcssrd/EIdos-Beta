(function() {
    "use strict";

    // La seule constante de ce fichier
    const API_URL = 'https://eidos-api.onrender.com';
    
    // AJOUTÉ : Variable pour l'instance Socket.io
    let socket;

    // --- Fonctions d'authentification "privées" ---
    // (Elles ne sont pas exposées sur window.apiService, 
    // mais sont utilisées par les autres fonctions de ce fichier)

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

    // --- NOUVEAU : Fonctions de l'API Socket.io ---

    /**
     * Initialise la connexion Socket.io avec le serveur.
     */
    async function socketInit() {
        const token = getAuthToken();
        if (!token) return;

        // Se connecte au serveur en passant le token pour l'authentification
        socket = io(API_URL, {
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log(`✅ [Socket] Connecté au serveur avec l'ID: ${socket.id}`);
        });

        socket.on('connect_error', (err) => {
            console.error(`❌ [Socket] Erreur de connexion: ${err.message}`);
            // Gérer les erreurs d'authentification socket
            if (err.message.includes("Non autorisé")) {
                handleAuthError({ status: 401 });
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 [Socket] Déconnecté: ${reason}`);
        });
    }

    /**
     * Rejoint une room spécifique pour un patient.
     * @param {string} patientId - L'ID du patient (ex: 'chambre_101')
     */
    function socketJoinPatientRoom(patientId) {
        if (!socket) return console.error("[Socket] Socket non initialisé.");
        socket.emit('client:joinRoom', patientId);
    }

    /**
     * S'abonne à l'événement de mise à jour du patient (déclenché par un autre utilisateur).
     * @param {function} callback - La fonction à appeler avec les nouvelles données du dossier.
     */
    function socketOnPatientUpdated(callback) {
        if (!socket) return console.error("[Socket] Socket non initialisé.");
        socket.on('server:patientUpdated', callback);
    }

    /**
     * Envoie les données du patient au serveur via WebSocket pour sauvegarde.
     * Renvoie une promesse qui résout ou rejette en fonction du callback du serveur.
     * @param {string} patientId - L'ID de la chambre (ex: 'chambre_101')
     * @param {Object} dossierData - L'objet complet contenant l'état du dossier.
     * @param {string} patientName - Le nom du patient pour la sidebar.
     * @returns {Promise<Object>} Une promesse qui résout avec { success: true } ou rejette avec une erreur.
     */
    function socketEmitPatientUpdate(patientId, dossierData, patientName) {
        return new Promise((resolve, reject) => {
            if (!socket) {
                return reject(new Error("Socket non initialisé."));
            }

            const payload = {
                patientId: patientId,
                dossierData: dossierData,
                sidebar_patient_name: patientName || `Chambre ${patientId.split('_')[1]}`
            };
            
            // Émet l'événement avec un callback pour la confirmation
            socket.emit('client:updatePatient', payload, (response) => {
                if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || "Erreur de sauvegarde Socket.io inconnue."));
                }
            });
        });
    }


    // --- Fonctions API "publiques" (REST - Inchangées) ---

    async function fetchUserPermissions() {
        try {
            const token = getAuthToken();
            if (!token) return;
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleAuthError(response)) return;
            if (!response.ok) {
                throw new Error("Impossible de récupérer les informations utilisateur.");
            }
            return await response.json();
        } catch (err) {
            console.error(err);
            if (err.message.includes("Token non trouvé")) {
                window.location.href = 'auth.html';
            }
            throw err;
        }
    }

    async function fetchPatientList() {
        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type']; 
            const response = await fetch(`${API_URL}/api/patients`, { headers });
            if (handleAuthError(response)) return;
            return await response.json();
        } catch (err) {
            console.error("Erreur de chargement de la liste des patients:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
            throw err;
        }
    }

    async function fetchPatientData(patientId) {
        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type']; 
            const response = await fetch(`${API_URL}/api/patients/${patientId}`, {
                headers: headers
            });
            if (handleAuthError(response)) return;
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Dossier ${patientId} non trouvé sur le serveur, initialisation.`);
                    return {}; 
                } else {
                    throw new Error('Erreur réseau lors du chargement des données.');
                }
            }
            return await response.json();
        } catch (err) {
            console.error("Erreur de chargement des données:", err);
            if (err.message.includes("Token non trouvé")) {
                window.location.href = 'auth.html';
            }
            return {};
        }
    }

    // OBSOLÈTE : Cette fonction est maintenant remplacée par socketEmitPatientUpdate
    // Nous la gardons pour la compatibilité (ex: import, clear all) mais elle ne sera plus utilisée pour la sauvegarde en temps réel.
    async function saveChamberData(patientId, dossierData, patientName) {
        if (!patientId || !patientId.startsWith('chambre_')) {
            console.warn('saveChamberData ne doit être utilisé que pour les chambres.');
            return;
        }
        try {
            const headers = getAuthHeaders(); 
            if (!headers) return;
            const response = await fetch(`${API_URL}/api/patients/${patientId}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    dossierData: dossierData,
                    sidebar_patient_name: patientName || `Chambre ${patientId.split('_')[1]}`
                })
            });
            if (handleAuthError(response)) return;
            return await response.json();
        } catch (err) {
            console.error("Erreur lors de la sauvegarde sur le serveur:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
            throw err;
        }
    }

    async function saveCaseData(dossierData, patientName) {
        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            const response = await fetch(`${API_URL}/api/patients/save`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    dossierData: dossierData,
                    sidebar_patient_name: patientName
                })
            });
            if (handleAuthError(response)) return;
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la sauvegarde');
            }
            return data;
        } catch (err) {
            console.error("Erreur lors de la sauvegarde du cas:", err);
            if (err.message.includes("Token non trouvé")) {
                 window.location.href = 'auth.html';
            }
            throw err;
        }
    }
    
    async function deleteSavedCase(patientId) {
        if (!patientId || !patientId.startsWith('save_')) {
             throw new Error("Cette fonction ne peut supprimer que des sauvegardes.");
        }
        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type'];
            if (!headers) return;
            const response = await fetch(`${API_URL}/api/patients/${patientId}`, { 
                method: 'DELETE',
                headers: headers
            });
            if (handleAuthError(response)) return;
            return await response.json();
        } catch (err) {
            console.error("Erreur lors de la suppression:", err);
            if (err.message.includes("Token non trouvé")) {
                window.location.href = 'auth.html';
            }
            throw err;
        }
    }

    async function clearAllChamberData(allChamberIds) {
        const headers = getAuthHeaders();
        if (!headers) return;
        const clearPromises = [];
        for (const patientId of allChamberIds) {
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
            return await Promise.all(clearPromises);
        } catch (err) {
             console.error("Erreur lors de la réinitialisation de toutes les chambres:", err);
             throw err;
        }
    }


    // --- Exposition du service ---
    
    window.apiService = {
        // API REST (existante)
        fetchUserPermissions,
        fetchPatientList,
        fetchPatientData,
        saveChamberData, // Gardé pour import, clear all
        saveCaseData,
        deleteSavedCase,
        clearAllChamberData,

        // NOUVELLE API SOCKET.IO
        socketInit,
        socketJoinPatientRoom,
        socketOnPatientUpdated,
        socketEmitPatientUpdate
    };

})();