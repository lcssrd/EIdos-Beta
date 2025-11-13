(function() {
    "use strict";

    const API_URL = 'https://eidos-api.onrender.com';
    
    // --- AJOUT : Instance de Socket.io ---
    let socket = null; 
    // --- FIN AJOUT ---

    // --- Fonctions d'authentification "privées" ---
    
    // MODIFIÉ : Cette fonction est maintenant centrale
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

    // --- Fonctions API "publiques" (HTTP) ---
    // (Toutes vos fonctions fetch... restent INCHANGÉES)

    /**
     * Récupère les permissions et les données de l'utilisateur connecté.
     * @returns {Promise<Object>} Les données de l'utilisateur.
     */
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

    /**
     * Récupère la liste de tous les patients (chambres et sauvegardes) de l'utilisateur.
     * @returns {Promise<Array>} La liste des patients.
     */
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

    /**
     * Récupère les données complètes d'un dossier patient (chambre ou sauvegarde).
     * @param {string} patientId - L'ID du patient (ex: 'chambre_101' ou 'save_...')
     * @returns {Promise<Object>} Les données du dossier (dossierData).
     */
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

    /**
     * Enregistre les données d'une chambre (PAS une sauvegarde de cas).
     * @param {string} patientId - L'ID de la chambre (ex: 'chambre_101')
     * @param {Object} dossierData - L'objet complet contenant l'état du dossier.
     * @param {string} patientName - Le nom du patient pour la sidebar.
     * @returns {Promise<Object>} La réponse du serveur.
     */
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

    /**
     * Crée ou met à jour une sauvegarde de cas (dossier archivé).
     * @param {Object} dossierData - L'objet complet contenant l'état du dossier.
     * @param {string} patientName - Le nom du patient (obligatoire pour la sauvegarde).
     * @returns {Promise<Object>} La réponse du serveur.
     */
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
    
    /**
     * Supprime une sauvegarde de cas (dossier archivé).
     * @param {string} patientId - L'ID de la sauvegarde (ex: 'save_...')
     * @returns {Promise<Object>} La réponse du serveur.
     */
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

    /**
     * Envoie une requête pour effacer toutes les chambres (pas les sauvegardes).
     * @param {Array<string>} allChamberIds - Liste des ID de chambres.
     * @returns {Promise<Array>} Réponse de Promise.all
     */
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

    // --- NOUVELLES FONCTIONS : GESTION WEBSOCKET ---

    /**
     * Initialise la connexion WebSocket vers le serveur.
     * @returns {Promise<void>}
     */
    function connectWebSocket() {
        // Vérifie si io() est disponible (doit être chargé dans simul.html)
        if (typeof io === 'undefined') {
            console.error("La bibliothèque client Socket.io n'est pas chargée.");
            return;
        }
        
        const token = getAuthToken();
        if (!token) return; // Sécurité

        console.log("Tentative de connexion au WebSocket...");

        // Se connecte à l'URL racine du serveur
        socket = io(API_URL, {
            auth: {
                token: token // Envoie le token JWT pour l'authentification
            }
        });

        socket.on('connect', () => {
            console.log('✅ Connecté au serveur WebSocket avec ID:', socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error('Erreur de connexion WebSocket:', err.message);
            // Gérer les erreurs d'authentification ici
            if (err.message.includes("Authentification échouée")) {
                handleAuthError({ status: 401 }); // Redirige vers le login
            }
        });

        socket.on('disconnect', (reason) => {
            console.warn('Déconnecté du WebSocket:', reason);
        });
    }

    /**
     * Ferme la connexion WebSocket.
     */
    function disconnectWebSocket() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }

    /**
     * Demande au serveur de rejoindre la "room" d'un dossier.
     * @param {string} patientId - L'ID du dossier à rejoindre.
     */
    function joinDossier(patientId) {
        if (socket && patientId) {
            socket.emit('join_dossier', patientId);
        }
    }

    /**
     * Demande au serveur de quitter la "room" d'un dossier.
     * @param {string} patientId - L'ID du dossier à quitter.
     */
    function leaveDossier(patientId) {
        if (socket && patientId) {
            socket.emit('leave_dossier', patientId);
        }
    }

    /**
     * Met en place l'écouteur pour les mises à jour de dossier.
     * @param {function} callback - La fonction à appeler lorsque 'dossier_updated' est reçu.
     */
    function onDossierUpdated(callback) {
        if (socket) {
            // S'assure de supprimer les anciens écouteurs pour éviter les doublons
            socket.off('dossier_updated'); 
            
            socket.on('dossier_updated', (dossierData) => {
                console.log("Mise à jour reçue du serveur via WebSocket !");
                callback(dossierData);
            });
        }
    }

    // --- Exposition du service ---
    
    window.apiService = {
        // Fonctions HTTP (inchangées)
        fetchUserPermissions,
        fetchPatientList,
        fetchPatientData,
        saveChamberData,
        saveCaseData,
        deleteSavedCase,
        clearAllChamberData,

        // NOUVELLES fonctions WebSocket
        connectWebSocket,
        disconnectWebSocket,
        joinDossier,
        leaveDossier,
        onDossierUpdated
    };

})();