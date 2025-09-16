// workflow.jsconst { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const FormData = require('form-data');
const validator = require('validator');

// ✅ CONNEXION AVEC LE CLIENT PRINCIPAL
let clientInstance = null;

function setClient(client) {
    clientInstance = client;
    console.log('🔗 Client connecté au workflow');
}

function getUserSessions() {
    return clientInstance ? clientInstance.userSessions : new Map();
}

function sanitizeUserInput(input) {
    if (typeof input !== 'string') return input;
    
    // ✅ Échapper HTML/JS
    return validator.escape(input);
}

// 🎯 Configuration détaillée des étapes avec descriptions
const WORKFLOW_STEPS = {
    1: { 
        field: 'author', 
        type: 'text', 
        title: '👋 Identification de l\'auteur',
        prompt: 'Quel est votre nom ou pseudonyme ?', 
        description: 'Indiquez le nom qui apparaîtra comme auteur de cette observation. Ce peut être votre vrai nom, un pseudonyme ou le nom de votre organisation.',
        placeholder: 'Ex: Jean Martin, StormChaser42, Météo Provence...',
        required: true,
        validation: '2 à 100 caractères'
    },
    2: { 
        field: 'photo', 
        type: 'file', 
        title: '📸 Photo principale de l\'impact',
        prompt: 'Envoyez votre photo de l\'impact de foudre', 
        description: '**Exemples de photos acceptées :**\n✅ Photo nette et bien cadrée\n✅ Impact visible et clair\n\n**Photos refusées :**\n❌ Photo floue ou mal cadrée\n❌ Pas d\'impact visible\n\nCette photo montre les dégâts ou traces laissées par l\'impact de foudre. Formats acceptés: JPEG, PNG.',
        placeholder: 'Glissez votre fichier ou utilisez le bouton "Joindre"',
        required: true,
        validation: 'JPEG/PNG, maximum 3MB'
    },
    3: { 
        field: 'category', 
        type: 'select', 
        title: '🏷️ Type d\'impact observé',
        prompt: 'Choisissez la catégorie qui correspond le mieux à votre observation', 
        description: 'Sélectionnez le type de surface ou d\'objet qui a été touché par la foudre. Cette classification aide à analyser les patterns d\'impacts.',
        required: true,
        validation: 'Une catégorie doit être sélectionnée'
    },
    4: { 
        field: 'date', 
        type: 'date', 
        title: '📅 Date d\'observation',
        prompt: 'À quelle date avez-vous observé cet impact ?', 
        description: 'Tapez la date au format AAAA-MM-JJ uniquement.',
        placeholder: 'Ex: 2024-09-16',
        required: true,
        validation: 'Format AAAA-MM-JJ uniquement'
    },
    5: { 
        field: 'time', 
        type: 'time', 
        title: '⏰ Heure d\'observation',
        prompt: 'À quelle heure avez-vous fait cette observation ?', 
        description: 'Tapez l\'heure au format HH:MM uniquement.',
        placeholder: 'Ex: 14:30',
        required: true,
        validation: 'Format HH:MM uniquement'
    },
    6: { 
        field: 'gps', 
        type: 'coordinates', 
        title: '🌍 Localisation GPS',
        prompt: 'Indiquez les coordonnées GPS précises de l\'impact', 
        description: 'Utilisez les coordonnées les plus précises possible. Vous pouvez les obtenir via Google Maps, votre smartphone ou un GPS. La précision est cruciale pour la cartographie.',
        placeholder: 'Format: latitude,longitude (ex: 48.8566,2.3522)',
        required: true,
        validation: 'Latitude,longitude en degrés décimaux'
    },
    7: { 
        field: 'description', 
        type: 'text', 
        title: '📝 Description détaillée',
        prompt: 'Décrivez l\'impact observé en détail', 
        description: 'Expliquez ce que vous avez vu : l\'étendue des dégâts, les matériaux affectés, les conditions météo du moment, tout détail qui pourrait être utile pour l\'analyse scientifique.',
        placeholder: 'Ex: "Arbre de 15m fendu en deux, écorce arrachée sur 3m, odeur de brûlé..."',
        required: true,
        validation: '10 à 500 caractères'
    },
    8: { 
        field: 'photo_terrain', 
        type: 'file', 
        title: '🌄 Photo du terrain (optionnel)',
        prompt: 'Souhaitez-vous ajouter une photo du terrain environnant ?', 
        description: 'Une vue d\'ensemble du terrain peut aider à comprendre le contexte de l\'impact : topographie, présence d\'autres arbres, bâtiments à proximité, etc.',
        placeholder: 'Photo panoramique ou vue d\'ensemble recommandée',
        required: false,
        validation: 'JPEG/PNG, maximum 3MB'
    },
    9: { 
        field: 'donnees_foudre',
        type: 'text', 
        title: '⚡ Données de foudre (optionnel)',
        prompt: 'Avez-vous des données spécifiques sur cette foudre ?', 
        description: 'Indiquez toutes les informations techniques que vous avez : intensité estimée, polarité, du coup de foudre.',
        placeholder:  'Ex: "Négatif, intensité ~30kA"',
        required: false,
        validation: '10 à 50 caractères'
    },
    10: { 
        field: 'echo_radar', 
        type: 'file', 
        title: '📡 Écho radar de foudroiement (optionnel)',
        prompt: 'Disposez-vous d\'un écho radar spécialisé ?', 
        description: 'Les données radar de détection de foudre (Blitzortung, etc.) ou captures d\'écrans spécialisées dans l\'analyse des impacts. Format GIF accepté pour les animations.',
        placeholder: 'Données Blitzortung, animations radar...',
        required: false,
        validation: 'JPEG/PNG/GIF, maximum 10MB'
    },
    11: { 
        field: 'video_link', 
        type: 'url', 
        title: '🎥 Vidéo de l\'impact (optionnel)',
        prompt: 'Avez-vous filmé l\'impact ou les dégâts ?', 
        description: 'Lien vers une vidéo hébergée sur YouTube, Vimeo, Instagram, TikTok ou Facebook. Les vidéos apportent une dimension supplémentaire à l\'analyse.',
        placeholder: 'https://youtube.com/watch?v=...',
        required: false,
        validation: 'Plateformes autorisées: YouTube, Vimeo, Instagram, TikTok, Facebook'
    },
    12: { 
        field: 'author_site', 
        type: 'url', 
        title: '🌐 Site web de l\'auteur (optionnel)',
        prompt: 'Souhaitez-vous indiquer votre site web ou profil ?', 
        description: 'Lien vers votre site personnel, blog, profil Instagram, page Facebook, etc. Cela permet aux visiteurs de découvrir votre travail.',
        placeholder: 'https://monsite.com ou https://instagram.com/monprofil',
        required: false,
        validation: 'URL valide requise'
    },
    13: { 
        field: 'special_phenomena', 
        type: 'checkboxes', 
        title: '⚡ Phénomènes particuliers (optionnel)',
        prompt: 'Avez-vous observé des phénomènes lumineux spéciaux ?', 
        description: 'Certains impacts s\'accompagnent de phénomènes lumineux remarquables. Sélectionnez tous ceux que vous avez observés.',
        required: false,
        validation: 'Sélection multiple via interface'
    },
    14: { 
        field: 'copyright', 
        type: 'confirmation', 
        title: '✅ Droits et propriété intellectuelle',
        prompt: 'Confirmez-vous être l\'auteur de ces photos ?', 
        description: 'En confirmant, vous certifiez que vous êtes le propriétaire des droits sur les images soumises et que vous autorisez leur utilisation dans le cadre de cette base de données scientifique.',
        required: true,
        validation: 'Confirmation obligatoire'
    },
    15: {
        field: 'summary',
        type: 'summary',
        title: '📋 Récapitulatif final',
        prompt: 'Vérifiez toutes vos informations avant soumission',
        description: 'Voici un résumé complet de votre observation. Vérifiez que tout est correct avant de soumettre à la base de données.',
        required: true,
        validation: 'Validation finale'
    }
};

// ✅ Interface de saisie de date (JJ/MM/AAAA uniquement)
function createDateSelector() {
    const embed = new EmbedBuilder()
        .setTitle('📅 Saisie de la date d\'observation')
        .setDescription('**Tapez la date au format :** `AAAA-MM-JJ`\n\n**Exemple valide :**\n• `2024-09-16`')
        .setColor(0x3498db)
        .addFields(
            { name: '✅ Validation', value: 'Format AAAA-MM-JJ uniquement\nDate entre 2000 et 2030', inline: false }
        );

    const navigationRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev_3')
                .setLabel('◀️ Précédent')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('next_5')
                .setLabel('Suivant ▶️')
                .setStyle(ButtonStyle.Success)
        );

    return {
        embeds: [embed],
        components: [navigationRow]
    };
}

// ✅ Interface de saisie d'heure (HH:MM uniquement)
function createTimeSelector() {
    const embed = new EmbedBuilder()
        .setTitle('⏰ Saisie de l\'heure d\'observation')
        .setDescription('**Tapez l\'heure au format :** `HH:MM`\n\n**Exemples valides :**\n• `14:30`\n• `08:15`\n• `23:45`')
        .setColor(0x9b59b6)
        .addFields(
            { name: '✅ Validation', value: 'Format HH:MM uniquement\nFormat 24h (00:00 à 23:59)', inline: false }
        );

    const navigationRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev_4')
                .setLabel('◀️ Précédent')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('next_6')
                .setLabel('Suivant ▶️')
                .setStyle(ButtonStyle.Success)
        );

    return {
        embeds: [embed],
        components: [navigationRow]
    };
}

// ✅ Validation de date (JJ/MM/AAAA uniquement)
function parseDateInput(input) {
    // Format JJ/MM/AAAA uniquement
    const match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
        const [, year, month, day] = match.map(Number);
        return validateDateParts(year, month, day);
    }
    
    return { valid: false, error: 'Format de date incorrect. Utilisez AAAA-MM-JJ (ex: 2024-09-16)' };
}

function validateDateParts(year, month, day) {
    if (year < 2000 || year > 2030) {
        return { valid: false, error: 'Année doit être entre 2000 et 2030' };
    }
    
    if (month < 1 || month > 12) {
        return { valid: false, error: 'Mois doit être entre 1 et 12' };
    }
    
    if (day < 1 || day > 31) {
        return { valid: false, error: 'Jour doit être entre 1 et 31' };
    }
    
    // Validation de la date réelle
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        return { valid: false, error: 'Date invalide (ex: 31 février n\'existe pas)' };
    }
    
    return { valid: true, year, month, day };
}

// ✅ Validation d'heure (HH:MM uniquement)
function parseTimeInput(input) {
    // Format HH:MM uniquement
    const match = input.match(/^(\d{1,2}):(\d{1,2})$/);
    if (match) {
        const [, hour, minute] = match.map(Number);
        return validateTimeParts(hour, minute);
    }
    
    return { valid: false, error: 'Format d\'heure incorrect. Utilisez HH:MM (ex: 14:30)' };
}

function validateTimeParts(hour, minute) {
    if (hour < 0 || hour > 23) {
        return { valid: false, error: 'Heure doit être entre 0 et 23' };
    }
    
    if (minute < 0 || minute > 59) {
        return { valid: false, error: 'Minutes doivent être entre 0 et 59' };
    }
    
    return { valid: true, hour, minute };
}

// ⚡ SÉLECTEUR DE PHÉNOMÈNES PARTICULIERS (VERSION BOUTONS)
function createPhenomenaSelector(currentSelection = []) {
    const embed = new EmbedBuilder()
        .setTitle('⚡ Phénomènes particuliers observés')
        .setDescription('Cliquez sur les phénomènes que vous avez observés lors de l\'impact')
        .setColor(0xe74c3c)
        .addFields(
            { name: '🌟 Power Flash', value: 'Éclair très intense et prolongé, souvent visible à grande distance', inline: false },
            { name: '⬆️ Traceurs ascendants', value: 'Décharges électriques qui remontent du sol vers le nuage', inline: false }
        );

    if (currentSelection.length > 0) {
        const selectedLabels = currentSelection.map(val => {
            switch(val) {
                case 'power_flash': return '🌟 Power Flash';
                case 'traceurs_ascendants': return '⬆️ Traceurs ascendants'; 
                default: return val;
            }
        });
        embed.addFields({ 
            name: '✅ Sélection actuelle', 
            value: selectedLabels.join(', '), 
            inline: false 
        });
    }

    const phenomenaRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('phenomena_power_flash')
                .setLabel('🌟 Power Flash')
                .setStyle(currentSelection.includes('power_flash') ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('phenomena_traceurs')
                .setLabel('⬆️ Traceurs')
                .setStyle(currentSelection.includes('traceurs_ascendants') ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('phenomena_none')
                .setLabel('🚫 Aucun')
                .setStyle(ButtonStyle.Secondary)
        );

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('phenomena_confirm')
                .setLabel('✅ Confirmer')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('phenomena_skip')
                .setLabel('⏭️ Passer')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('prev_12')
                .setLabel('◀️ Précédent')
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        embeds: [embed],
        components: [phenomenaRow, confirmRow]
    };
}

// ✅ SÉLECTEUR DE CONFIRMATION DE DROITS D'AUTEUR
function createCopyrightConfirmation() {
    const embed = new EmbedBuilder()
        .setTitle('✅ Droits et propriété intellectuelle')
        .setDescription('**Confirmez-vous être l\'auteur de ces photos ?**\n\nEn confirmant, vous certifiez que :\n• Vous êtes le propriétaire des droits sur les images soumises\n• Vous autorisez leur utilisation dans le cadre de cette base de données scientifique\n• Les photos sont libres de droits pour publication')
        .setColor(0x27ae60)
        .addFields(
            { name: '📋 Conditions', value: 'Cette confirmation est obligatoire pour soumettre votre observation', inline: false }
        );

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('copyright_confirm_yes')
                .setLabel('✅ Oui, j\'autorise')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('copyright_confirm_no')
                .setLabel('❌ Non, annuler')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('prev_13')
                .setLabel('◀️ Précédent')
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        embeds: [embed],
        components: [confirmRow]
    };
}

// 📋 RÉCAPITULATIF FINAL
async function createFinalSummary(session) {
    const data = session.data;
    
    const embed = new EmbedBuilder()
        .setTitle('📋 Récapitulatif final de votre observation')
        .setDescription('**Vérifiez toutes les informations avant soumission définitive**\n\nVotre contribution sera précieuse pour la recherche scientifique sur la foudre ! 🌩️')
        .setColor(0x27ae60)
        .setTimestamp();

    // Informations principales
    if (data.author) embed.addFields({ name: '👤 Auteur', value: data.author, inline: true });
    if (data.category) embed.addFields({ name: '🏷️ Catégorie', value: data.category, inline: true });
    
    // Date et heure
    let dateTimeStr = '';
    if (data.date) {
        dateTimeStr = data.date;
    }
    if (data.time) {
        dateTimeStr += ` à ${data.time}`;
    }
    if (dateTimeStr) embed.addFields({ name: '📅 Date et heure', value: dateTimeStr, inline: true });

    if (data.gps) embed.addFields({ name: '📍 Coordonnées GPS', value: data.gps, inline: false });
    
    if (data.description) {
        embed.addFields({ 
            name: '📝 Description', 
            value: data.description.length > 200 ? data.description.substring(0, 200) + '...' : data.description, 
            inline: false 
        });
    }

    // Photos et médias
    let mediaCount = 0;
    let mediaList = [];
    
    if (data.photo) {
        mediaCount++;
        mediaList.push('📸 Photo principale');
        embed.setThumbnail(data.photo.url);
    }
    if (data.photo_terrain) {
        mediaCount++;
        mediaList.push('🌄 Photo terrain');
        embed.setThumbnail(data.photo_terrain.url);
    }
    if (data.donnees_foudre) {
        embed.addFields({ 
        name: '⚡ Données de foudre',
        value: data.donnees_foudre,
        inline: false
        });
    }
    if (data.echo_radar) {
        mediaCount++;
        mediaList.push('📡 Écho radar');
        if (!data.photo_terrain) {
            embed.setThumbnail(data.echo_radar.url);
    }
    if (data.video_link) {
        mediaCount++;
        mediaList.push('🎥 Vidéo');
    }
    
    if (mediaCount > 0) {
        embed.addFields({ 
            name: `📎 Médias joints (${mediaCount})`, 
            value: mediaList.join(' • '), 
            inline: false 
        });
    }

    // Phénomènes particuliers
    let phenomena = [];
    if (data.power_flash) phenomena.push('🌟 Power Flash');
    if (data.traceurs_ascendants) phenomena.push('⬆️ Traceurs ascendants');
    if (data.eclat_terminal) phenomena.push('💥 Éclat terminal');
    if (data.phenomene_colore) phenomena.push('🌈 Phénomène coloré');
    
    if (phenomena.length > 0) {
        embed.addFields({ name: '⚡ Phénomènes observés', value: phenomena.join(' • '), inline: false });
    }

    if (data.author_site) {
        embed.addFields({ name: '🌐 Site de l\'auteur', value: data.author_site, inline: true });
    }

    embed.setFooter({ 
        text: `ID Session: ${session.userId.slice(-8)} • Total étapes: 15 • Médias: ${mediaCount}` 
    });

    const finalActionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('submit_final_confirm')
                .setLabel('🚀 Soumettre définitivement')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('summary_edit')
                .setLabel('✏️ Modifier des informations')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('summary_cancel')
                .setLabel('❌ Annuler la soumission')
                .setStyle(ButtonStyle.Danger)
        );

    const navigationRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_step_1')
                .setLabel('👤 Modifier auteur')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('edit_step_3')
                .setLabel('🏷️ Modifier catégorie')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('edit_step_4')
                .setLabel('📅 Modifier date')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('edit_step_6')
                .setLabel('📍 Modifier GPS')
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        embeds: [embed],
        components: [finalActionRow, navigationRow]
    };
}

// 🚀 FONCTIONS PRINCIPALES
async function startWorkflow(interaction) {
    const userId = interaction.user.id;
    const userSessions = getUserSessions();
    
    userSessions.set(userId, {
        step: 1,
        data: {},
        tempTime: { hour: null, minute: null },
        tempDate: { year: null, month: null, day: null }, 
        tempPhenomena: [],
        channelId: interaction.channelId,
        userId: userId,
        messageId: null
    });
    
    const embed = createStepEmbed(1);
    const components = createNavigationButtons(1);
    
    await interaction.reply({
        embeds: [embed],
        components: components,
        ephemeral: false
    });
}

async function handleInteraction(interaction) {
    const userId = interaction.user.id;
    const userSessions = getUserSessions();
    const session = userSessions.get(userId);
    
    if (!session) {
        return await interaction.reply({ 
            content: '❌ Session expirée. Tapez `!formulaire` pour recommencer.', 
            flags: MessageFlags.Ephemeral 
        });
    }
    
    // Gestion des phénomènes particuliers
    if (interaction.customId && (
        interaction.customId.startsWith('phenomena_') ||
        interaction.customId === 'phenomena_confirm' ||
        interaction.customId === 'phenomena_skip'
    )) {
        await handlePhenomenaInteraction(interaction, session);
        return;
    }
    
    // Gestion copyright
    if (interaction.customId && interaction.customId.startsWith('copyright_')) {
        await handleCopyrightInteraction(interaction, session);
        return;
    }
    
    // Gestion du récapitulatif final
    if (interaction.customId && (
        interaction.customId.startsWith('submit_final') ||
        interaction.customId.startsWith('summary_') ||
        interaction.customId.startsWith('edit_step_')
    )) {
        await handleSummaryInteraction(interaction, session);
        return;
    }
    
    // ✅ GESTION UNIQUEMENT DES BOUTONS (plus de SelectMenu)
    if (interaction.isButton()) {
        await handleButtonClick(interaction, session);
    }
}

// Gestion des phénomènes particuliers
async function handlePhenomenaInteraction(interaction, session) {
    const customId = interaction.customId;
    
    // ✅ NOUVEAU: Gestion boutons individuels
    if (customId === 'phenomena_power_flash') {
        if (!session.tempPhenomena) session.tempPhenomena = [];
        const index = session.tempPhenomena.indexOf('power_flash');
        if (index > -1) {
            session.tempPhenomena.splice(index, 1); // Retirer si déjà sélectionné
        } else {
            session.tempPhenomena.push('power_flash'); // Ajouter
        }
        
        const phenomenaSelector = createPhenomenaSelector(session.tempPhenomena);
        await interaction.update(phenomenaSelector);
    }
    else if (customId === 'phenomena_traceurs') {
        if (!session.tempPhenomena) session.tempPhenomena = [];
        const index = session.tempPhenomena.indexOf('traceurs_ascendants');
        if (index > -1) {
            session.tempPhenomena.splice(index, 1);
        } else {
            session.tempPhenomena.push('traceurs_ascendants');
        }
        
        const phenomenaSelector = createPhenomenaSelector(session.tempPhenomena);
        await interaction.update(phenomenaSelector);
    }
    else if (customId === 'phenomena_none') {
        session.tempPhenomena = []; // Vider la sélection
        
        const phenomenaSelector = createPhenomenaSelector(session.tempPhenomena);
        await interaction.update(phenomenaSelector);
    }
    else if (customId === 'phenomena_confirm') {
        if (session.tempPhenomena) {
            session.data.power_flash = session.tempPhenomena.includes('power_flash');
            session.data.traceurs_ascendants = session.tempPhenomena.includes('traceurs_ascendants');
        } else {
            session.data.power_flash = false;
            session.data.traceurs_ascendants = false;
        }
        
        session.step = 14;
        await updateStepMessage(interaction, session);
    }
    else if (customId === 'phenomena_skip') {
        session.data.power_flash = false;
        session.data.traceurs_ascendants = false;
        
        session.step = 14;
        await updateStepMessage(interaction, session);
    }
}

// Gestion copyright
async function handleCopyrightInteraction(interaction, session) {
    const customId = interaction.customId;
    
    if (customId === 'copyright_confirm_yes') {
        session.data.copyright = true;
        session.step = 15;
        await updateStepMessage(interaction, session);
    }
    else if (customId === 'copyright_confirm_no') {
        const userSessions = getUserSessions();
        userSessions.delete(session.userId);
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Formulaire annulé')
                .setDescription('Sans confirmation des droits d\'auteur, nous ne pouvons pas enregistrer votre observation.\n\nUtilisez `!formulaire` pour recommencer.')
                .setColor(0xe74c3c)],
            components: []
        });
    }
}

// Gestion du récapitulatif final
async function handleSummaryInteraction(interaction, session) {
    const customId = interaction.customId;
    
    if (customId === 'submit_final_confirm') {
        await submitData(interaction, session);
    }
    else if (customId === 'summary_edit') {
        session.step = 1;
        await updateStepMessage(interaction, session);
    }
    else if (customId === 'summary_cancel') {
        const userSessions = getUserSessions();
        userSessions.delete(session.userId);
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Soumission annulée')
                .setDescription('Votre observation n\'a pas été enregistrée. Utilisez `!formulaire` pour recommencer.')
                .setColor(0xe74c3c)],
            components: []
        });
    }
    else if (customId.startsWith('edit_step_')) {
        const stepNum = parseInt(customId.replace('edit_step_', ''));
        session.step = stepNum;
        await updateStepMessage(interaction, session);
    }
}

// ✅ NAVIGATION SIMPLIFIÉE
async function handleButtonClick(interaction, session) {
    const customId = interaction.customId;
    
    // ✅ GESTION DES CATÉGORIES
    if (customId.startsWith('category_')) {
        const categoryMap = {
            'category_sol': 'Impact au Sol',
            'category_arbre': 'Impact sur Arbre / Végétation', 
            'category_batiment': 'Impact sur Bâtiment / Infrastructure',
            'category_roche': 'Impact sur surface Rocheuse',
            'category_eau': 'Impact sur l\'Eau',
            'category_metal': 'Impact sur Structure Métallique',
            'category_electrique': 'Impact sur Infrastructure Électrique'
        };
        
        session.data.category = categoryMap[customId];
        session.step = 4;
        
        const dateSelector = createDateSelector();
        await interaction.update(dateSelector);
        return;
    }
    
    // Navigation standard
    const [action, stepStr] = interaction.customId.split('_');
    const targetStep = parseInt(stepStr);
    
    switch (action) {
        case 'next':
            // Vérifier si étape obligatoire
            const currentStep = WORKFLOW_STEPS[session.step];
            
            if (currentStep.required && !session.data[currentStep.field]) {
                return await interaction.reply({ 
                    content: '❌ Veuillez compléter cette étape obligatoire avant de continuer.', 
                    flags: MessageFlags.Ephemeral 
                });
            }
            
            session.step = targetStep;
            await updateStepMessage(interaction, session);
            break;
            
        case 'prev':
            session.step = targetStep;
            await updateStepMessage(interaction, session);
            break;
    }
}

async function handleStep(message) {
    const userId = message.author.id;
    const userSessions = getUserSessions();
    const session = userSessions.get(userId);
    
    if (!session) {
        return;
    }
    
    const stepConfig = WORKFLOW_STEPS[session.step];
    if (!stepConfig) {
        return;
    }
    
    try {
        const result = await processStepInput(message, stepConfig);
        
        if (result.valid) {
            if (result.data) {
                Object.assign(session.data, result.data);
            }
            
            session.step++;
            
            if (session.step > 15) {
                const userSessions = getUserSessions();
                userSessions.delete(userId);
                await message.reply('✅ **Workflow terminé !** Merci pour votre contribution ! 🌩️');
            } else if (session.step === 15) {
                const summary = await createFinalSummary(session);
                await message.reply(summary);
            } else {
                await sendUpdatedStep(message, session);
            }
        } else {
            await message.reply(`❌ ${result.error}\n\n💡 ${stepConfig.description}`);
        }
        
    } catch (error) {
        console.error('Erreur workflow:', error);
        await message.reply('❌ Une erreur est survenue. Veuillez réessayer.');
    }
}

async function processStepInput(message, stepConfig) {
    const content = sanitizeUserInput(message.content.trim());
    
    switch (stepConfig.type) {
        case 'text':
            if (stepConfig.field === 'author') {
                if (content.length < 2 || content.length > 100) {
                    return { valid: false, error: 'Le nom doit contenir entre 2 et 100 caractères.' };
                }
                return { valid: true, data: { [stepConfig.field]: content } };
            } 
            else if (stepConfig.field === 'description') {
                if (content.length < 10 || content.length > 500) {
                    return { valid: false, error: 'La description doit contenir entre 10 et 500 caractères.' };
                }
                return { valid: true, data: { [stepConfig.field]: content } };
            }
            else if (stepConfig.field === 'donnees_foudre') {
                if (content.toLowerCase() === 'non' && !stepConfig.required) {
                    return { valid: true }; // Passer l'étape
                }
                if (content.length < 10 || content.length > 50) {
                    return { valid: false, error: 'Les données de foudre doivent contenir entre 10 et 50 caractères.' };
                }
                return { valid: true, data: { [stepConfig.field]: content } };
            }
            break;
            
        case 'coordinates':
            const gpsRegex = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;
            if (!gpsRegex.test(content)) {
                return { valid: false, error: 'Format GPS invalide. Utilisez latitude,longitude (ex: 48.8566,2.3522)' };
            }
            const coords = content.split(',').map(coord => parseFloat(coord.trim()));
            const [lat, lng] = coords;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return { valid: false, error: 'Coordonnées GPS hors limites mondiales.' };
            }
            return { valid: true, data: { gps: content, lat: lat, lng: lng } };

        // ✅ Validation de date (JJ/MM/AAAA uniquement)
        case 'date':
            const dateResult = parseDateInput(content);
            if (!dateResult.valid) {
                return { valid: false, error: dateResult.error };
            }
            // Convertir en format AAAA-MM-JJ pour la base de données
            const formattedDate = `${dateResult.year}-${dateResult.month.toString().padStart(2, '0')}-${dateResult.day.toString().padStart(2, '0')}`;
            return { 
                valid: true, 
                data: { 
                    date: formattedDate
                } 
            };

        // ✅ Validation d'heure (HH:MM uniquement)
        case 'time':
            const timeResult = parseTimeInput(content);
            if (!timeResult.valid) {
                return { valid: false, error: timeResult.error };
            }
            return { 
                valid: true, 
                data: { 
                    time: `${timeResult.hour.toString().padStart(2, '0')}:${timeResult.minute.toString().padStart(2, '0')}`
                } 
            };
            
        case 'file':
            return await handleFileInput(message, stepConfig);
            
        case 'url':
            if (content.toLowerCase() === 'non' && !stepConfig.required) {
                return { valid: true };
            }
            try {
                new URL(content);
                return { valid: true, data: { [stepConfig.field]: content } };
            } catch {
                return { valid: false, error: 'URL invalide.' };
            }
    }
    
    return { valid: false, error: 'Type d\'entrée non reconnu.' };
}

async function handleFileInput(message, stepConfig) {
    const attachments = message.attachments;
    
    if (attachments.size === 0) {
        if (message.content.toLowerCase() === 'non' && !stepConfig.required) {
            return { valid: true };
        }
        return { valid: false, error: 'Veuillez joindre un fichier ou tapez "non" pour passer cette étape.' };
    }
    
    const attachment = attachments.first();
    const validationResult = validateFile(attachment, stepConfig.field);
    
    if (!validationResult.valid) {
        return { valid: false, error: validationResult.error };
    }
    
    return { valid: true, data: { [stepConfig.field]: attachment } };
}

function validateFile(attachment, fieldType) {
    const maxSizes = {
        photo: 3 * 1024 * 1024,
        photo_terrain: 3 * 1024 * 1024,
        meteologix_photo: 1 * 1024 * 1024,
        echo_radar: 10 * 1024 * 1024
    };
    
    const allowedTypes = {
        photo: ['image/jpeg', 'image/png'],
        photo_terrain: ['image/jpeg', 'image/png'],
        meteologix_photo: ['image/jpeg', 'image/png'],
        echo_radar: ['image/jpeg', 'image/png', 'image/gif']
    };
    
    if (attachment.size > maxSizes[fieldType]) {
        return { valid: false, error: `Fichier trop volumineux (max ${Math.round(maxSizes[fieldType] / 1024 / 1024)}MB)` };
    }
    
    const fileType = attachment.contentType || 'unknown';
    if (!allowedTypes[fieldType].includes(fileType)) {
        return { valid: false, error: `Type de fichier non supporté pour ${fieldType}` };
    }
    
    return { valid: true };
}

function createStepEmbed(stepNumber, session = null) {
    const step = WORKFLOW_STEPS[stepNumber];
    if (!step) return null;
    
    const embed = new EmbedBuilder()
        .setTitle(`${step.title}`)
        .setDescription(`**${step.prompt}**\n\n${step.description}`)
        .setColor(0x3498db)
        .setFooter({ text: `Étape ${stepNumber}/15 • ${step.required ? 'Obligatoire' : 'Optionnel'}` })
        .setTimestamp();
    
    if (step.placeholder) {
        embed.addFields({ name: '💡 Format attendu', value: step.placeholder, inline: false });
    }
    
    if (step.validation) {
        embed.addFields({ name: '✅ Validation', value: step.validation, inline: false });
    }
    
    if (session && session.data[step.field]) {
        let currentValue = session.data[step.field];
        if (typeof currentValue === 'object' && currentValue.name) {
            currentValue = `📎 ${currentValue.name}`;
        }
        embed.addFields({ name: '📝 Réponse actuelle', value: String(currentValue).substring(0, 100), inline: false });
    }
    
    return embed;
}

function createNavigationButtons(stepNumber) {
    const components = [];
    
    if (stepNumber === 3) {
        // ✅ REMPLACER SelectMenu par ButtonBuilder
        const categoryRow1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('category_sol')
                    .setLabel('🌍 Impact au Sol')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('category_arbre')
                    .setLabel('🌳 Arbre / Végétation')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('category_batiment')
                    .setLabel('🏠 Bâtiment')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('category_roche')
                    .setLabel('🪨 Surface Rocheuse')
                    .setStyle(ButtonStyle.Primary)
            );

        const categoryRow2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('category_eau')
                    .setLabel('💧 Impact sur l\'Eau')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('category_metal')
                    .setLabel('⚡ Structure Métallique')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('category_electrique')
                    .setLabel('🔌 Infra Électrique')
                    .setStyle(ButtonStyle.Primary)
            );
        
        components.push(categoryRow1, categoryRow2);
    }
    
    // Étapes avec interfaces spéciales
    if ([4, 5, 13, 14, 15].includes(stepNumber)) {
        return [];
    }
    
    // Boutons de navigation standards
    const navigationRow = new ActionRowBuilder();
    
    // Bouton Précédent
    if (stepNumber > 1) {
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_${stepNumber - 1}`)
                .setLabel('◀️ Précédent')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    // Bouton Suivant
    if (stepNumber < 15) {
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`next_${stepNumber + 1}`)
                .setLabel('Suivant ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false)
        );
    }
    
    components.push(navigationRow);
    return components;
}

async function updateStepMessage(interaction, session) {
    if (session.step === 4) {
        const dateSelector = createDateSelector();
        await interaction.update(dateSelector);
    } else if (session.step === 5) {
        const timeSelector = createTimeSelector();
        await interaction.update(timeSelector);
    } else if (session.step === 13) {
        const phenomenaSelector = createPhenomenaSelector(session.tempPhenomena);
        await interaction.update(phenomenaSelector);
    } else if (session.step === 14) {
        const copyrightSelector = createCopyrightConfirmation();
        await interaction.update(copyrightSelector);
    } else if (session.step === 15) {
        const summary = await createFinalSummary(session);
        await interaction.update(summary);
    } else {
        const embed = createStepEmbed(session.step, session);
        const components = createNavigationButtons(session.step);
        
        await interaction.update({
            embeds: [embed],
            components: components
        });
    }
}

async function sendUpdatedStep(message, session) {
    if (session.step === 4) {
        const dateSelector = createDateSelector();
        await message.reply(dateSelector);
    } else if (session.step === 5) {
        const timeSelector = createTimeSelector();
        await message.reply(timeSelector);
    } else if (session.step === 13) {
        const phenomenaSelector = createPhenomenaSelector();
        await message.reply(phenomenaSelector);
    } else if (session.step === 14) {
        const copyrightSelector = createCopyrightConfirmation();
        await message.reply(copyrightSelector);
    } else if (session.step === 15) {
        const summary = await createFinalSummary(session);
        await message.reply(summary);
    } else {
        const embed = createStepEmbed(session.step, session);
        const components = createNavigationButtons(session.step);
        
        await message.reply({
            embeds: [embed],
            components: components
        });
    }
}

async function validateCurrentStep(session) {
    const step = WORKFLOW_STEPS[session.step];
    if (!step.required) return true;
    
    return session.data[step.field] !== undefined;
}

// ✅ SOUMISSION FINALE
async function submitData(interaction, session) {
    try {
        const formData = new FormData();
        
        // ✅ NOUVEAU : Convertir time en hour/minute séparés
        if (session.data.time) {
            const [hour, minute] = session.data.time.split(':');
            formData.append('hour', hour);
            formData.append('minute', minute);
        }
        
        // Ajouter les données texte (SAUF time qui est maintenant hour/minute)
        Object.keys(session.data).forEach(key => {
            if (!['photo', 'photo_terrain', 'meteologix_photo', 'echo_radar', 'time'].includes(key)) {
                if (session.data[key] !== null && session.data[key] !== undefined) {
                    let value = session.data[key];
                    if (typeof value === 'boolean') {
                        value = value ? 'true' : 'false';
                    }
                    formData.append(key, value);
                }
            }
        });
        
        // Ajouter les fichiers
        for (const fileField of ['photo', 'photo_terrain', 'echo_radar']) {
            if (session.data[fileField]) {
                const attachment = session.data[fileField];
                try {
                    const response = await axios.get(attachment.url, { 
                        responseType: 'stream',
                        timeout: 30000
                    });
                    formData.append(fileField, response.data, attachment.name);
                    console.log(`✅ Fichier ${fileField} ajouté: ${attachment.name}`);
                } catch (fileError) {
                    console.error(`❌ Erreur téléchargement ${fileField}:`, fileError);
                }
            }
        }
        
        // Envoyer à votre API PHP
        const apiEndpoint = process.env.API_ENDPOINT || 'https://fulgurzone.org/discord_webhook.php';
        console.log('🌐 Envoi vers:', apiEndpoint);
        
        const response = await axios.post(apiEndpoint, formData, {
            headers: {
                ...formData.getHeaders(),
                'User-Agent': 'FulgurZone-Discord-Bot/1.0'
            },
            timeout: 60000,
        });
        
        const userSessions = getUserSessions();
        
        if (response.data.success) {
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 Impact ajouté avec succès !')
                .setDescription('**Votre observation a été enregistrée dans la base de données scientifique**\n\nMerci pour votre précieuse contribution à la recherche sur la foudre ! ⚡')
                .setColor(0x27ae60)
                .addFields(
                    { name: '📍 Localisation', value: session.data.gps || 'Non spécifiée', inline: true },
                    { name: '📅 Date', value: session.data.date || 'Non spécifiée', inline: true },
                    { name: '👤 Auteur', value: session.data.author || 'Anonyme', inline: true },
                    { name: '🆔 ID Impact', value: response.data.data?.id || 'Généré', inline: false }
                )
                .setFooter({ text: 'FulgurZone • Base de données scientifique de foudroiement' })
                .setTimestamp();
            
            await interaction.update({
                embeds: [successEmbed],
                components: []
            });
        } else {
            console.error('❌ Erreur serveur:', response.data);
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Erreur lors de la soumission')
                    .setDescription(`**Erreur serveur :** ${response.data.message}`)
                    .setColor(0xe74c3c)],
                components: []
            });
        }
        
        userSessions.delete(interaction.user.id);
        
    } catch (error) {
        console.error('❌ Erreur soumission complète:', error);
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Erreur technique')
                .setDescription(`**Impossible de soumettre l'observation.**\n\nErreur: ${error.message}`)
                .setColor(0xe74c3c)],
            components: []
        });
    }
}

// ✅ EXPORTS
module.exports = {
    setClient,
    getUserSessions,
    startWorkflow,
    handleInteraction,
    handleStep
};
