(function() {
    "use strict";

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

    /**
     * Arrondit un objet Date au quart d'heure le plus proche.
     * @param {Date} date - L'objet Date à arrondir.
     * @returns {Date} La nouvelle date arrondie.
     */
    function roundDateTo15Min(date) {
        const newDate = new Date(date.getTime()); 
        const minutes = newDate.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        newDate.setMinutes(roundedMinutes); 
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
        return newDate;
    }

    /**
     * Calcule l'IMC à partir d'un poids (kg) et d'une taille (cm).
     * @param {string} poidsStr - Le poids en kg (ex: "70.5").
     * @param {string} tailleStr - La taille en cm (ex: "175").
     * @returns {string} L'IMC formaté (ex: "23.0") ou une chaîne vide.
     */
    function calculateIMC(poidsStr, tailleStr) {
        const poids = parseFloat(poidsStr.replace(',', '.'));
        const taille = parseFloat(tailleStr.replace(',', '.'));

        if (poids > 0 && taille > 0) {
            const tailleEnMetres = taille / 100;
            const imc = poids / (tailleEnMetres * tailleEnMetres);
            return imc.toFixed(1);
        }
        return '';
    }

    /**
     * Calcule l'âge à partir d'une date de naissance.
     * @param {string} dobString - La date de naissance (ex: "1990-01-15").
     * @returns {string} L'âge formaté (ex: "35 ans") ou une chaîne vide.
     */
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

    /**
     * Calcule le jour d'hospitalisation (J0, J1...) par rapport à aujourd'hui.
     * @param {string} entryDateStr - La date d'entrée (ex: "2025-11-08").
     * @returns {string} Le jour formaté (ex: "J3") ou "J-".
     */
    function calculateJourHosp(entryDateStr) {
        if (!entryDateStr) {
            return 'J-';
        }
        const entryDate = new Date(entryDateStr);
        if (isNaN(entryDate.getTime())) {
            return 'J-';
        }
        const today = new Date();
        entryDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today - entryDate;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        return `J${diffDays}`;
    }

    // --- Exposition du service ---
    
    window.utils = {
        calculateDaysOffset: _calculateDaysOffset,
        calculateDateFromOffset: _calculateDateFromOffset,
        formatDate: _formatDate,
        formatDateForInput: _formatDateForInput,
        roundDateTo15Min: roundDateTo15Min,
        calculateIMC: calculateIMC,
        calculateAge: calculateAge,
        calculateJourHosp: calculateJourHosp
    };

})();