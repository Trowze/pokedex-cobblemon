const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
// ON IMPORTE LE TRADUCTEUR
const pokemonTools = require('pokemon'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const API_SECRET = "MON_SUPER_CODE_SECRET_2026"; 
const DB_FILE = 'data.json';

// --- CHARGEMENT DES DONNÉES ---
let capturedPokemon = {};
if (fs.existsSync(DB_FILE)) {
    try {
        capturedPokemon = JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        console.error("Erreur de lecture data.json, réinitialisation.");
        capturedPokemon = {};
    }
}

app.use(bodyParser.json());

// --- ROUTE POUR AFFICHER LE SITE ---
// On sert index.html directement à la racine
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 1. CONNEXION SOCKET.IO ---
io.on('connection', (socket) => {
    // On envoie la liste actuelle au nouveau visiteur
    socket.emit('init-pokedex', capturedPokemon);
});

// --- 2. RECEPTION DU MOD (Webhook) ---
app.post('/webhook/capture', (req, res) => {
    const data = req.body;

    // 1. Sécurité
    if (data.secret !== API_SECRET) {
        console.log("⛔ Tentative d'intrusion (Mauvais secret)");
        return res.status(403).send("Forbidden");
    }

    const pokeId = parseInt(data.pokemonId);
    let finalName = data.pokemonName; // Par défaut, on prend ce que le mod envoie

    // 2. TRADUCTION MAGIQUE EN FRANÇAIS 🇫🇷
    try {
        // On demande à la librairie : "Donne moi le nom du #6 en français"
        finalName = pokemonTools.getName(pokeId, 'fr');
    } catch (err) {
        console.log("Pas de traduction trouvée pour ID " + pokeId + ", on garde le nom anglais.");
    }

    console.log(`[CAPTURE] ${data.playerName} a trouvé ${finalName} (#${pokeId})`);

    // 3. Enregistrement (Si nouveau)
    // Note: Si tu veux que le dernier qui capture écrase le précédent, enlève le "if"
    if (!capturedPokemon[pokeId]) {
        
        capturedPokemon[pokeId] = {
            id: pokeId,
            name: finalName, // On sauvegarde le nom en Français !
            captor: data.playerName,
            timestamp: Date.now()
        };

        // Sauvegarde disque
        fs.writeFileSync(DB_FILE, JSON.stringify(capturedPokemon, null, 2));

        // Notification aux navigateurs
        io.emit('new-capture', capturedPokemon[pokeId]);
    }

    res.status(200).send("Capture traitée");
});

// --- LANCEMENT ---
server.listen(PORT, () => {
    console.log(`🚀 Pokédex Server en ligne sur le port ${PORT}`);
});