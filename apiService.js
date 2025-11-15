(function() {
    "use strict";

    // MODIFIÉ : La constante API_URL est maintenant l'URL de base
    const API_URL = 'https://eidos-api.onrender.com';
    
    // NOUVEAU : Variable pour stocker la connexion socket
    let socket = null;

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

    // MODIFIÉ : Ajoute l'ID du socket aux en-têtes
    function getAuthHeaders() {
        const token = getAuthToken();
        if (!token) {
            throw new Error("Token non trouvé, impossible de créer les headers.");
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // NOUVEAU : Ajoute l'ID du socket si la connexion est établie
        if (socket && socket.id) {
            headers['x-socket-id'] = socket.id;
        }

        return headers;
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

    // --- Fonctions API "publiques" ---
    // (Celles-ci seront exposées sur window.apiService)

    // NOUVEAU : Fonction pour initialiser la connexion Socket.io
    /**
     * Initialise la connexion Socket.io avec le serveur.
     * @returns {Socket} L'instance du socket connecté.
     */
    function connectSocket() {
        const token = getAuthToken();
        if (!token) return null;

        // Se connecte à la racine du serveur où Socket.io écoute
        socket = io(API_URL, {
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log('Socket connecté avec succès :', socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error('Erreur de connexion socket :', err.message);
            if (err.message.includes('Authentification')) {
                // Si l'authentification socket échoue (ex: token expiré), on redirige
                handleAuthError({ status: 401 });
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket déconnecté.');
        });
        
        // La fonction retourne l'instance pour que patientService puisse l'écouter
        return socket;
    }


    /**
     * Récupère les permissions et les données de l'utilisateur connecté.
     * @returns {Promise<Object>} Les données de l'utilisateur.
     */
    async function fetchUserPermissions() {
        try {
            const token = getAuthToken(); // On a besoin du token mais pas de 'Content-Type'
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
            // Redirige en cas d'erreur grave
            if (err.message.includes("Token non trouvé")) {
                window.location.href = 'auth.html';
            }
            throw err; // Propage l'erreur pour que le code appelant puisse réagir
        }
    }

    /**
     * Récupère la liste de tous les patients (chambres et sauvegardes) de l'utilisateur.
     * @returns {Promise<Array>} La liste des patients.
     */
    async function fetchPatientList() {
        try {
            const headers = getAuthHeaders();
            delete headers['Content-Type']; // Pas de body

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
            delete headers['Content-Type']; // Pas de body

            const response = await fetch(`${API_URL}/api/patients/${patientId}`, {
                headers: headers
            });

            if (handleAuthError(response)) return;

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`Dossier ${patientId} non trouvé sur le serveur, initialisation.`);
                    return {}; // Retourne un état vide si 404
                } else {
                    throw new Error('Erreur réseau lors du chargement des données.');
                }
            }
            return await response.json(); // Retourne le 'dossierData'
        } catch (err) {
            console.error("Erreur de chargement des données:", err);
            if (err.message.includes("Token non trouvé")) {
                window.location.href = 'auth.html';
            }
            return {}; // Retourne un état vide en cas d'erreur
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
            // MODIFIÉ : getAuthHeaders() inclut maintenant le x-socket-id
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
            delete headers['Content-Type']; // Pas de body
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


    // --- Exposition du service ---
    
    window.apiService = {
        connectSocket, // NOUVEAU
        fetchUserPermissions,
        fetchPatientList,
        fetchPatientData,
        saveChamberData,
        saveCaseData,
        deleteSavedCase,
        clearAllChamberData
    };

})();