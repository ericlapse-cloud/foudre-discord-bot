require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

// Créer le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Collections pour stocker les sessions utilisateur et commandes
client.userSessions = new Collection();
client.commands = new Collection();

// ✅ IMPORT ET CONNEXION DU WORKFLOW
const workflowHandler = require('./workflow');
workflowHandler.setClient(client);

// 🎯 SYSTÈME DE LIMITATION DU TRIGGER !formulaire
const userTriggers = new Map();

// Event: Bot prêt
client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} est en ligne!`);
    
    // Enregistrer la commande slash
    await registerCommands();
});

// Event: Messages (pour trigger !formulaire et étapes workflow)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // 🎯 DÉCLENCHEUR !formulaire
    if (message.content.trim().toLowerCase() === '!formulaire') {
        const userId = message.author.id;
        const now = Date.now();

        // Nettoyer timestamps hors délai (1h)
        if (!userTriggers.has(userId)) userTriggers.set(userId, []);
        const timestamps = userTriggers.get(userId).filter(ts => now - ts < 3600000);
        userTriggers.set(userId, timestamps);

        // Vérifier limite (10 max par heure)
        if (timestamps.length >= 10) {
            return message.reply({ content: '⏳ Limite de 10 formulaires par heure atteinte.' });
        }

        timestamps.push(now);
        userTriggers.set(userId, timestamps);

        try {
            // Réaction + bouton pour démarrer
            await message.react('📝');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_form')
                    .setLabel('📝 Démarrer le formulaire')
                    .setStyle(ButtonStyle.Primary)
            );

            await message.reply({
                content: `${message.author}, cliquez ci-dessous pour commencer le formulaire d'observation de foudre.`,
                components: [row]
            });
        } catch (err) {
            console.error('❌ Erreur trigger formulaire:', err);
        }
        return;
    }

    // 📝 GESTION DES ÉTAPES TEXTE DU WORKFLOW
    console.log(`📝 Message reçu dans salon: ${message.channel.name || 'DM'} de ${message.author.username}: "${message.content}"`);
    
    try {
        // Vérifier si l'utilisateur a une session active
        if (client.userSessions.has(message.author.id)) {
            await workflowHandler.handleStep(message);
        }
    } catch (error) {
        console.error('❌ Erreur message workflow:', error);
        
        try {
            await message.reply('❌ Une erreur est survenue lors du traitement de votre réponse.');
        } catch (e) {
            console.error('❌ Erreur réponse message:', e);
        }
    }
});

// Event: Toutes les interactions (commandes slash, boutons, menus)
client.on('interactionCreate', async interaction => {
    try {
        // 🎯 Commande slash /ajouter-impact
        if (interaction.isChatInputCommand() && interaction.commandName === 'ajouter-impact') {
            await workflowHandler.startWorkflow(interaction);
        }
        
        // 🚀 BOUTON DÉMARRAGE FORMULAIRE
        else if (interaction.isButton() && interaction.customId === 'start_form') {
            await workflowHandler.startWorkflow(interaction);
        }
        
        // 🎛️ Autres interactions (boutons workflow, menus déroulants)
        else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            await workflowHandler.handleInteraction(interaction);
        }
        
    } catch (error) {
        console.error('❌ Erreur interaction:', error);
        
        // Réponse d'erreur sécurisée
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ Une erreur est survenue. Veuillez réessayer.', 
                    ephemeral: true 
                });
            }
        } catch (e) {
            console.error('❌ Erreur réponse interaction:', e);
        }
    }
});

// Event: Gestion des erreurs non capturées
client.on('error', error => {
    console.error('❌ Erreur Discord client:', error);
});

// Event: Avertissements Discord
client.on('warn', warning => {
    console.warn('⚠️ Avertissement Discord:', warning);
});

// Fonction pour enregistrer les commandes slash
async function registerCommands() {
    const commands = [
        {
            name: 'ajouter-impact',
            description: 'Ajouter un nouvel impact de foudre à la carte'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Enregistrement des commandes slash...');
        
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );
        
        console.log('✅ Commandes slash enregistrées!');
    } catch (error) {
        console.error('❌ Erreur enregistrement commandes:', error);
        
        // Si erreur 50001 (Missing Access), afficher message explicatif
        if (error.code === 50001) {
            console.log('💡 Vérifiez que le bot a bien été ajouté au serveur avec les bonnes permissions');
        }
    }
}

// Gestion des erreurs non capturées Node.js
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejet de promesse non géré:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
    process.exit(1);
});

// Connexion du bot
client.login(process.env.DISCORD_TOKEN);
