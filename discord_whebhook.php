<?php
// === ENDPOINT SPÉCIALEMENT POUR DISCORD BOT ===

// Headers de sécurité + JSON
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Désactiver l'affichage des erreurs dans la sortie
error_reporting(0);
ini_set('display_errors', 0);

// ✅ SÉCURITÉ: Vérifier que c'est bien une requête de bot
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isValidBot = (
    strpos($userAgent, 'axios') !== false ||
    strpos($userAgent, 'discord') !== false ||
    strpos($userAgent, 'node') !== false ||
    strpos($userAgent, 'FulgurZone-Discord-Bot') !== false
);

if (!$isValidBot) {
    error_log("Tentative d'accès non autorisée au webhook Discord - UA: " . $userAgent . " - IP: " . $_SERVER['REMOTE_ADDR']);
    http_response_code(403);
    die(json_encode(['success' => false, 'message' => 'Accès réservé aux bots autorisés']));
}

// Log des requêtes Discord Bot
error_log("Discord Bot - Nouvelle requête - UA: " . $userAgent . " - IP: " . $_SERVER['REMOTE_ADDR']);

// Vérifier la méthode HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Méthode non autorisée']);
    exit;
}

// Rate limiting augmenté : 10 uploads par 10 minutes
session_start();
$currentTime = time();
if (!isset($_SESSION['upload_attempts'])) {
    $_SESSION['upload_attempts'] = [];
}

// Nettoyer les anciennes tentatives (plus de 10 minutes)
$_SESSION['upload_attempts'] = array_filter($_SESSION['upload_attempts'], function($timestamp) use ($currentTime) {
    return ($currentTime - $timestamp) < 600; // 10 minutes
});

// Vérifier la limite (max 10 uploads par 10 minutes)
if (count($_SESSION['upload_attempts']) >= 10) {
    http_response_code(429);
    die(json_encode(['success' => false, 'message' => 'Limite d\'ajouts atteinte (10 par 10 minutes). Veuillez attendre avant de soumettre un nouvel impact.']));
}

// Vérification de taille globale de la requête (augmentée à 15MB pour Discord)
$maxPostSize = 15 * 1024 * 1024; // 15MB max
if (isset($_SERVER['CONTENT_LENGTH']) && $_SERVER['CONTENT_LENGTH'] > $maxPostSize) {
    http_response_code(413);
    die(json_encode(['success' => false, 'message' => 'Données trop volumineuses']));
}

// Vérifier si le dossier data existe et est accessible en écriture
if (!is_dir('data')) {
    echo json_encode(['success' => false, 'message' => 'Dossier data introuvable']);
    exit;
}
if (!is_writable('data')) {
    echo json_encode(['success' => false, 'message' => 'Dossier data non accessible en écriture']);
    exit;
}

// Fonction de validation d'image sécurisée
function validateSecureImage($file, $fieldName = '') {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
        return ['valid' => false, 'error' => "Erreur upload {$fieldName}"];
    }
    
    // Vérification taille (augmentée à 3MB)
    if ($file['size'] > 3 * 1024 * 1024) { // 3MB max
        return ['valid' => false, 'error' => "Image {$fieldName} trop volumineuse (max 3MB)"];
    }
    
    // Vérification taille minimale
    if ($file['size'] < 100) {
        return ['valid' => false, 'error' => "Image {$fieldName} trop petite"];
    }
    
    // Types MIME autorisés
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    // Vérification du type MIME déclaré
    if (!in_array($file['type'], $allowedTypes)) {
        return ['valid' => false, 'error' => "Format de photo {$fieldName} non supporté (JPEG/PNG uniquement)"];
    }
    
    // Vérification RÉELLE du contenu avec finfo
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $realMimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            
            if (!in_array($realMimeType, ['image/jpeg', 'image/png'])) {
                return ['valid' => false, 'error' => "Fichier {$fieldName} corrompu ou invalide"];
            }
        }
    }
    
    // Vérification que c'est vraiment une image avec getimagesize
    $imageInfo = getimagesize($file['tmp_name']);
    if (!$imageInfo) {
        return ['valid' => false, 'error' => "Fichier {$fieldName} n'est pas une image valide"];
    }
    
    // Vérifier les dimensions (pas trop petites, pas trop grandes)
    if ($imageInfo[0] < 50 || $imageInfo[1] < 50 || 
        $imageInfo[0] > 8000 || $imageInfo[1] > 8000) {
        return ['valid' => false, 'error' => "Dimensions image {$fieldName} incorrectes"];
    }
    
    return ['valid' => true];
}

// ✅ FONCTION: Validation spéciale pour Echo Radar (supporte GIF)
function validateEchoRadarImage($file, $fieldName = 'Echo Radar') {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
        return ['valid' => false, 'error' => "Erreur upload {$fieldName}"];
    }
    
    // Vérification taille (10MB max pour echo radar)
    if ($file['size'] > 10 * 1024 * 1024) { // 10MB max
        return ['valid' => false, 'error' => "Image {$fieldName} trop volumineuse (max 10MB)"];
    }
    
    // Vérification taille minimale
    if ($file['size'] < 100) {
        return ['valid' => false, 'error' => "Image {$fieldName} trop petite"];
    }
    
    // Types MIME autorisés (avec GIF en plus)
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    // Vérification du type MIME déclaré
    if (!in_array($file['type'], $allowedTypes)) {
        return ['valid' => false, 'error' => "Format {$fieldName} non supporté (JPEG/PNG/GIF uniquement)"];
    }
    
    // Vérification RÉELLE du contenu avec finfo
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $realMimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
            if (!in_array($realMimeType, ['image/jpeg', 'image/png', 'image/gif'])) {
                return ['valid' => false, 'error' => "Fichier {$fieldName} corrompu ou invalide"];
            }
        }
    }
    
    // Vérification que c'est vraiment une image avec getimagesize
    $imageInfo = getimagesize($file['tmp_name']);
    if (!$imageInfo) {
        return ['valid' => false, 'error' => "Fichier {$fieldName} n'est pas une image valide"];
    }
    
    // Pour les GIF, vérifier que ce n'est pas trop complexe
    if ($imageInfo['mime'] === 'image/gif') {
        // Limitation basique : pas plus de 2000x2000 pour les GIF
        if ($imageInfo[0] > 2000 || $imageInfo[1] > 2000) {
            return ['valid' => false, 'error' => "GIF {$fieldName} trop grand (max 2000x2000)"];
        }
    }
    
    // Vérifier les dimensions générales
    if ($imageInfo[0] < 50 || $imageInfo[1] < 50 ||
        $imageInfo[0] > 8000 || $imageInfo[1] > 8000) {
        return ['valid' => false, 'error' => "Dimensions image {$fieldName} incorrectes"];
    }
    
    return ['valid' => true];
}

// Fonction de nettoyage des données
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    
    $data = trim($data);
    $data = stripslashes($data);
    
    return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
}

// ✅ LOG DE DEBUG: Afficher les données reçues
error_log("Discord Bot - Données POST reçues: " . print_r($_POST, true));
error_log("Discord Bot - Fichiers reçus: " . print_r(array_keys($_FILES), true));

// Sauvegarder en backup la catégorie avant nettoyage
$categoryBackup = $_POST['category'] ?? '';

// Nettoyer toutes les données POST
$_POST = sanitizeInput($_POST);

// Restaurer la catégorie brute (sans échappement)
$_POST['category'] = $categoryBackup;

// Validation des champs obligatoires
$required = ['author', 'category', 'date', 'gps', 'description'];

// Vérifier que hour ET minute sont présents OU que time est présent
if (empty($_POST['time']) && (empty($_POST['hour']) || empty($_POST['minute']))) {
    echo json_encode(['success' => false, 'message' => 'Heure obligatoire (time ou hour+minute)']);
    exit;
}

foreach ($required as $field) {
    if (empty($_POST[$field])) {
        error_log("Discord Bot - Champ obligatoire manquant: $field");
        echo json_encode(['success' => false, 'message' => "Champ obligatoire manquant: $field"]);
        exit;
    }
}

// ✅ NOUVEAUX CHAMPS: Ajouter les phénomènes particuliers
$eclat_terminal = isset($_POST['eclat_terminal']) && ($_POST['eclat_terminal'] === 'true' || $_POST['eclat_terminal'] === true);
$phenomene_colore = isset($_POST['phenomene_colore']) && ($_POST['phenomene_colore'] === 'true' || $_POST['phenomene_colore'] === true);

// Log de debug pour les nouveaux champs
error_log("Discord Bot - Phénomènes reçus - Power Flash: " . (isset($_POST['power_flash']) ? $_POST['power_flash'] : 'non défini') . 
          " - Traceurs: " . (isset($_POST['traceurs_ascendants']) ? $_POST['traceurs_ascendants'] : 'non défini') .
          " - Eclat: " . ($eclat_terminal ? 'true' : 'false') .
          " - Coloré: " . ($phenomene_colore ? 'true' : 'false'));

// Validation renforcée de l'auteur
if (strlen(trim($_POST['author'])) < 2 || strlen(trim($_POST['author'])) > 100) {
    echo json_encode(['success' => false, 'message' => 'Nom d\'auteur invalide (2-100 caractères)']);
    exit;
}

// Validation de la photo principale (obligatoire) avec fonction sécurisée
if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Photo obligatoire']);
    exit;
}
$photoValidation = validateSecureImage($_FILES['photo'], 'principale');
if (!$photoValidation['valid']) {
    echo json_encode(['success' => false, 'message' => $photoValidation['error']]);
    exit;
}

// VALIDATION SÉCURISÉE POUR PHOTO TERRAIN (OPTIONNELLE)
$photoTerrain = null;
$photoTerrainPath = '';
if (isset($_FILES['photo_terrain']) && $_FILES['photo_terrain']['error'] === UPLOAD_ERR_OK) {
    $terrainValidation = validateSecureImage($_FILES['photo_terrain'], 'terrain');
    if (!$terrainValidation['valid']) {
        echo json_encode(['success' => false, 'message' => $terrainValidation['error']]);
        exit;
    }
    $photoTerrain = $_FILES['photo_terrain'];
}

// ✅ VALIDATION SÉCURISÉE POUR ECHO RADAR (OPTIONNELLE)
$echoRadar = null;
$echoRadarPath = '';
if (isset($_FILES['echo_radar']) && $_FILES['echo_radar']['error'] === UPLOAD_ERR_OK) {
    $echoRadarValidation = validateEchoRadarImage($_FILES['echo_radar'], 'Echo radar');
    if (!$echoRadarValidation['valid']) {
        echo json_encode(['success' => false, 'message' => $echoRadarValidation['error']]);
        exit;
    }
    $echoRadar = $_FILES['echo_radar'];
}

// ✅ VALIDATION DE LA CATÉGORIE
$validCategories = [
    'Impact au Sol',
    'Impact sur Arbre / Végétation',
    'Impact sur Bâtiment / Infrastructure',
    'Impact sur surface Rocheuse',
    'Impact sur l\'Eau',
    'Impact sur Structure Métallique',
    'Impact sur Infrastructure Électrique'
];

if (!in_array($_POST['category'], $validCategories)) {
    error_log("Discord Bot - Catégorie invalide: " . $_POST['category']);
    echo json_encode(['success' => false, 'message' => 'Catégorie invalide: ' . $_POST['category']]);
    exit;
}

// ✅ VALIDATION GPS AMÉLIORÉE
$gps = trim($_POST['gps']);

// Debug de la valeur GPS reçue
error_log("Discord Bot - GPS reçu: '$gps' - Auteur: " . $_POST['author']);

// Vérifier que le champ GPS n'est pas vide
if (empty($gps)) {
    echo json_encode(['success' => false, 'message' => 'Coordonnées GPS obligatoires']);
    exit;
}

// ✅ REGEX AMÉLIORÉE - Plus robuste pour les formats
if (!preg_match('/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/', $gps)) {
    error_log("Discord Bot - Format GPS invalide: '$gps' - Auteur: " . $_POST['author']);
    echo json_encode(['success' => false, 'message' => 'Format GPS invalide. Format attendu: latitude, longitude']);
    exit;
}

// Extraire les coordonnées
$coords = array_map('trim', explode(',', $gps));
if (count($coords) !== 2) {
    echo json_encode(['success' => false, 'message' => 'Format GPS invalide: deux coordonnées requises']);
    exit;
}

$lat = floatval($coords[0]);
$lng = floatval($coords[1]);

// ✅ VALIDATION AMÉLIORÉE: Vérifier que les conversions ont fonctionné
if ($lat === 0.0 && $coords[0] !== '0' && $coords[0] !== '0.0') {
    error_log("Discord Bot - Latitude invalide: '{$coords[0]}' -> $lat");
    echo json_encode(['success' => false, 'message' => 'Latitude invalide']);
    exit;
}

if ($lng === 0.0 && $coords[1] !== '0' && $coords[1] !== '0.0') {
    error_log("Discord Bot - Longitude invalide: '{$coords[1]}' -> $lng");
    echo json_encode(['success' => false, 'message' => 'Longitude invalide']);
    exit;
}

// Validation coordonnées mondiales
if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    error_log("Discord Bot - Coordonnées hors limites: lat=$lat, lng=$lng - Auteur: " . $_POST['author']);
    echo json_encode(['success' => false, 'message' => 'Coordonnées GPS hors limites mondiales']);
    exit;
}

// ✅ LOG DE SUCCÈS
error_log("Discord Bot - GPS validé avec succès: lat=$lat, lng=$lng - Auteur: " . $_POST['author']);

// Validation de la date
if (!DateTime::createFromFormat('Y-m-d', $_POST['date'])) {
    echo json_encode(['success' => false, 'message' => 'Format de date invalide']);
    exit;
}

// ✅ GESTION DES DEUX FORMATS
if (!empty($_POST['time'])) {
    // Format unifié depuis Discord Bot V2
    $time = trim($_POST['time']);
    if (!preg_match('/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/', $time)) {
        echo json_encode(['success' => false, 'message' => 'Format heure invalide (HH:MM)']);
        exit;
    }
    list($hour, $minute) = explode(':', $time);
    $hour = intval($hour);
    $minute = intval($minute);
} else {
    // Format séparé depuis formulaire HTML
    $hour = intval($_POST['hour']);
    $minute = intval($_POST['minute']);
    if ($hour < 0 || $hour > 23 || $minute < 0 || $minute > 59) {
        echo json_encode(['success' => false, 'message' => 'Heure ou minute invalide']);
        exit;
    }
    $time = sprintf('%02d:%02d', $hour, $minute);
}

// ✅ VALIDATION DONNÉES DE FOUDRE (NOUVEAU CHAMP TEXTUEL)
$donneesFoudre = trim($_POST['donnees_foudre'] ?? '');
if (!empty($donneesFoudre)) {
    if (strlen($donneesFoudre) < 10 || strlen($donneesFoudre) > 100) {
        echo json_encode(['success' => false, 'message' => 'Données de foudre invalides (10-100 caractères)']);
        exit;
    }
}

// Validation URL vidéo (optionnel)
$videoLink = trim($_POST['video_link'] ?? '');
if (!empty($videoLink)) {
    if (!filter_var($videoLink, FILTER_VALIDATE_URL)) {
        echo json_encode(['success' => false, 'message' => 'URL vidéo invalide']);
        exit;
    }
    
    // Validation des plateformes autorisées
    $videoPatterns = [
        '/^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)/i',
        '/^https?:\/\/(www\.)?vimeo\.com\//i',
        '/^https?:\/\/(www\.)?instagram\.com\/(p\/|reel\/|tv\/)/i',
        '/^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\//i',
        '/^https?:\/\/(www\.)?(facebook\.com|fb\.watch)\//i'
    ];
    
    $isValidPlatform = false;
    foreach ($videoPatterns as $pattern) {
        if (preg_match($pattern, $videoLink)) {
            $isValidPlatform = true;
            break;
        }
    }
    
    if (!$isValidPlatform) {
        echo json_encode(['success' => false, 'message' => 'Plateforme vidéo non supportée (YouTube, Vimeo, Instagram, TikTok, Facebook uniquement)']);
        exit;
    }
}

// Validation URL site auteur (optionnel - mais doit être valide si renseigné)
$authorSite = trim($_POST['author_site'] ?? '');
if (!empty($authorSite)) {
    if (!filter_var($authorSite, FILTER_VALIDATE_URL)) {
        echo json_encode(['success' => false, 'message' => 'URL site auteur invalide']);
        exit;
    }
}

// Validation copyright
if (!isset($_POST['copyright'])) {
    echo json_encode(['success' => false, 'message' => 'Vous devez certifier que la photo est votre création']);
    exit;
}

// Validation description renforcée
$description = trim($_POST['description']);
if (strlen($description) < 10 || strlen($description) > 500) {
    echo json_encode(['success' => false, 'message' => 'Description invalide (10-500 caractères)']);
    exit;
}

// Gestion d'upload
$uploadDir = 'photos/';
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        echo json_encode(['success' => false, 'message' => 'Impossible de créer le dossier photos']);
        exit;
    }
}

// Gérer l'upload de la photo principale
$photoExtension = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
$photoName = uniqid('discord_impact_') . '.' . $photoExtension;
$photoPath = $uploadDir . $photoName;
if (!move_uploaded_file($_FILES['photo']['tmp_name'], $photoPath)) {
    echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'upload de la photo']);
    exit;
}

// GÉRER L'UPLOAD DE LA PHOTO TERRAIN (SI FOURNIE)
if ($photoTerrain) {
    $photoTerrainExtension = strtolower(pathinfo($photoTerrain['name'], PATHINFO_EXTENSION));
    $photoTerrainName = uniqid('discord_terrain_') . '.' . $photoTerrainExtension;
    $photoTerrainPath = $uploadDir . $photoTerrainName;
    
    if (!move_uploaded_file($photoTerrain['tmp_name'], $photoTerrainPath)) {
        // Si l'upload de la photo terrain échoue, supprimer la photo principale déjà uploadée
        if (file_exists($photoPath)) {
            unlink($photoPath);
        }
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'upload de la photo terrain']);
        exit;
    }
}

// ✅ GÉRER L'UPLOAD DE L'ECHO RADAR (SI FOURNI)
if ($echoRadar) {
    $echoRadarExtension = strtolower(pathinfo($echoRadar['name'], PATHINFO_EXTENSION));
    $echoRadarName = uniqid('discord_radar_') . '.' . $echoRadarExtension;
    $echoRadarPath = $uploadDir . $echoRadarName;
    
    if (!move_uploaded_file($echoRadar['tmp_name'], $echoRadarPath)) {
        // Si l'upload échoue, supprimer les photos déjà uploadées
        if (file_exists($photoPath)) {
            unlink($photoPath);
        }
        if ($photoTerrainPath && file_exists($photoTerrainPath)) {
            unlink($photoTerrainPath);
        }
        
        echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'upload de l\'echo radar']);
        exit;
    }
}

/// ✅ Créer le nouveau point (structure mise à jour Discord Bot)
$newPoint = [
    'id' => uniqid('discord_'),
    'author' => htmlspecialchars(trim($_POST['author']), ENT_QUOTES, 'UTF-8'),
    'author_site' => $authorSite,
    'video_link' => $videoLink,
    'category' => $_POST['category'],
    'date' => $_POST['date'],
    'time' => $time,
    'hour' => str_pad($hour, 2, '0', STR_PAD_LEFT),
    'minute' => str_pad($minute, 2, '0', STR_PAD_LEFT),
    'lat' => $lat,
    'lng' => $lng,
    'description' => htmlspecialchars($description, ENT_QUOTES, 'UTF-8'),
    'photo' => $photoPath,
    'photo_terrain' => $photoTerrainPath,
    'donnees_foudre' => htmlspecialchars($donneesFoudre, ENT_QUOTES, 'UTF-8'), // ✅ NOUVEAU: Remplace meteologix_photo
    'echo_radar' => $echoRadarPath,
    
    // ✅ PHÉNOMÈNES PARTICULIERS (mise à jour pour Discord)
    'power_flash' => isset($_POST['power_flash']) && ($_POST['power_flash'] == '1' || $_POST['power_flash'] === 'true' || $_POST['power_flash'] === true),
    'traceurs_ascendants' => isset($_POST['traceurs_ascendants']) && ($_POST['traceurs_ascendants'] == '1' || $_POST['traceurs_ascendants'] === 'true' || $_POST['traceurs_ascendants'] === true),
    'eclat_terminal' => $eclat_terminal,  // ✅ NOUVEAU
    'phenomene_colore' => $phenomene_colore,  // ✅ NOUVEAU
    
    'copyright' => true,
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s'),
    'submission_date' => date('Y-m-d H:i:s'),
    
    // Données de sécurité/audit
    'ip' => $_SERVER['REMOTE_ADDR'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
    'source' => 'discord_bot'  // ✅ NOUVEAU: Identifier la source
];

// Créer le titre
$newPoint['title'] = $newPoint['date'] . ' - ' . $newPoint['hour'] . ':' . $newPoint['minute'] . ' | ' . $newPoint['category'];

// Charger les points existants depuis data/points.json
$pointsFile = 'data/points.json';
$points = [];
if (file_exists($pointsFile)) {
    $jsonContent = file_get_contents($pointsFile);
    if ($jsonContent !== false) {
        $points = json_decode($jsonContent, true) ?: [];
    }
} else {
    // Créer le fichier s'il n'existe pas
    $points = [];
}

// Ajouter le nouveau point
$points[] = $newPoint;

// ✅ Sauvegarder avec gestion d'erreurs
$jsonData = json_encode($points, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if ($jsonData === false) {
    // Supprimer les photos en cas d'erreur
    if (file_exists($photoPath)) {
        unlink($photoPath);
    }
    if ($photoTerrainPath && file_exists($photoTerrainPath)) {
        unlink($photoTerrainPath);
    }
    if ($echoRadarPath && file_exists($echoRadarPath)) {
        unlink($echoRadarPath);
    }
    
    echo json_encode(['success' => false, 'message' => 'Erreur lors de la création du JSON']);
    exit;
}

if (file_put_contents($pointsFile, $jsonData, LOCK_EX) === false) {
    // Supprimer les photos en cas d'erreur
    if (file_exists($photoPath)) {
        unlink($photoPath);
    }
    if ($photoTerrainPath && file_exists($photoTerrainPath)) {
        unlink($photoTerrainPath);
    }
    if ($echoRadarPath && file_exists($echoRadarPath)) {
        unlink($echoRadarPath);
    }
    
    echo json_encode(['success' => false, 'message' => 'Erreur lors de la sauvegarde']);
    exit;
}

// Enregistrer cette tentative d'upload réussie
$_SESSION['upload_attempts'][] = $currentTime;

// Log de succès
error_log("Discord Bot - Nouvel impact ajouté avec succès - Auteur: {$_POST['author']} - IP: {$_SERVER['REMOTE_ADDR']} - ID: {$newPoint['id']}");

// Succès
echo json_encode([
    'success' => true, 
    'message' => 'Impact ajouté avec succès via Discord Bot!',
    'data' => [
        'id' => $newPoint['id'],
        'lat' => $newPoint['lat'],
        'lng' => $newPoint['lng'],
        'source' => 'discord_bot'
    ]
], JSON_UNESCAPED_UNICODE);
?>
