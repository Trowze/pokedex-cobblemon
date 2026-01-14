const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const pokemonTools = require('pokemon'); // N'oublie pas: npm install pokemon

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const API_SECRET = "MON_SUPER_CODE_SECRET_2026"; 
const DB_FILE = 'data.json';

// --- CHARGEMENT DES DONNÉES ---
let capturedPokemon = {};
if (fs.existsSync(DB_FILE)) {
    try {
        capturedPokemon = JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        capturedPokemon = {};
    }
}

app.use(bodyParser.json());

// --- 1. AFFICHER LE SITE (CORRIGÉ) ---
// On essaie d'abord de servir le dossier 'public' (si tu l'utilises)
app.use(express.static('public'));

// Si index.html n'est pas dans 'public' mais à la racine, on le sert ici
app.get('/', (req, res) => {
    const publicIndex = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(publicIndex)) {
        res.sendFile(publicIndex);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// --- 2. CONNEXION SOCKET ---
io.on('connection', (socket) => {
    socket.emit('init-pokedex', capturedPokemon);
});

// --- 3. RECEPTION WEBHOOK (AVEC TRADUCTION) ---
app.post('/webhook/capture', (req, res) => {
    const data = req.body;

    if (data.secret !== API_SECRET) {
        return res.status(403).send("Forbidden");
    }

    const pokeId = parseInt(data.pokemonId);
    let finalName = data.pokemonName; 

    // TRADUCTION EN FRANÇAIS
    try {
        finalName = pokemonTools.getName(pokeId, 'fr');
    } catch (err) {
        // Si erreur, on garde le nom anglais envoyé par le mod
        console.log(`Pas de trad pour #${pokeId}`);
    }

    console.log(`[CAPTURE] ${data.playerName} a trouvé ${finalName} (#${pokeId})`);

    if (!capturedPokemon[pokeId]) {
        capturedPokemon[pokeId] = {
            id: pokeId,
            name: finalName, // On stocke le nom en Français
            captor: data.playerName,
            timestamp: Date.now()
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(capturedPokemon, null, 2));
        io.emit('new-capture', capturedPokemon[pokeId]);
    }

    res.status(200).send("OK");
});

server.listen(PORT, () => {
    console.log(`🚀 Serveur (avec traducteur) en ligne sur le port ${PORT}`);
});