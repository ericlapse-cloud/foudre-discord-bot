function validateDate(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
        return { valid: false, error: 'Format de date invalide. Utilisez YYYY-MM-DD (ex: 2024-03-15)' };
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Date invalide.' };
    }
    
    return { valid: true };
}

function validateTime(timeString) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeString)) {
        return { valid: false, error: 'Format d\'heure invalide. Utilisez HH:MM (ex: 14:30)' };
    }
    
    return { valid: true };
}

function validateGPS(gpsString) {
    const gpsRegex = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;
    if (!gpsRegex.test(gpsString)) {
        return { valid: false, error: 'Format GPS invalide. Utilisez latitude,longitude (ex: 48.8566,2.3522)' };
    }
    
    const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
    const [lat, lng] = coords;
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: 'Coordonnées GPS hors limites mondiales.' };
    }
    
    return { valid: true };
}

function validateURL(urlString, required) {
    if (!required && urlString.toLowerCase() === 'non') {
        return { valid: true, url: null };
    }
    
    try {
        new URL(urlString);
        return { valid: true, url: urlString };
    } catch {
        return { valid: false, error: 'URL invalide.' };
    }
}

function validateFile(attachment, fieldType) {
    const maxSizes = {
        photo: 3 * 1024 * 1024, // 3MB
        photo_terrain: 3 * 1024 * 1024,
        meteologix_photo: 1 * 1024 * 1024, // 1MB
        echo_radar: 10 * 1024 * 1024 // 10MB
    };
    
    const allowedTypes = {
        photo: ['image/jpeg', 'image/png'],
        photo_terrain: ['image/jpeg', 'image/png'],
        meteologix_photo: ['image/jpeg', 'image/png'],
        echo_radar: ['image/jpeg', 'image/png', 'image/gif']
    };
    
    if (attachment.size > maxSizes[fieldType]) {
        return { valid: false, error: `Fichier trop volumineux (max ${maxSizes[fieldType] / 1024 / 1024}MB)` };
    }
    
    const fileType = attachment.contentType || 'unknown';
    if (!allowedTypes[fieldType].includes(fileType)) {
        return { valid: false, error: `Type de fichier non supporté pour ${fieldType}` };
    }
    
    return { valid: true };
}

function validateConfirmation(input) {
    const lowerInput = input.toLowerCase().trim();
    if (!['oui', 'yes', 'o', 'y'].includes(lowerInput)) {
        return { valid: false, error: 'Vous devez confirmer que la photo est votre création en tapant "oui".' };
    }
    return { valid: true };
}

module.exports = {
    validateDate,
    validateTime,
    validateGPS,
    validateURL,
    validateFile,
    validateConfirmation
};
