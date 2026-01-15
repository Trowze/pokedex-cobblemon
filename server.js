const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const pokemonTools = require('pokemon'); // npm install pokemon

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const API_SECRET = "MON_SUPER_CODE_SECRET_2026"; 
const DB_FILE = 'data.json';

// --- DATA ---
let capturedPokemon = {}; // { "6": {id:6, name:"Dracaufeu", captor:"Culling", isShiny:false} }

// Chargement fichier
if (fs.existsSync(DB_FILE)) {
    try {
        capturedPokemon = JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        capturedPokemon = {};
    }
}

// --- FONCTION: CALCUL DU LEADERBOARD ---
function getLeaderboard() {
    const scores = {};
    // Compter les captures par joueur
    Object.values(capturedPokemon).forEach(p => {
        if (!scores[p.captor]) scores[p.captor] = 0;
        scores[p.captor]++;
    });

    // Transformer en tableau et trier (Le plus grand score en premier)
    return Object.entries(scores)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Garder le TOP 5
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- CONNEXION SOCKET ---
io.on('connection', (socket) => {
    // On envoie un gros paquet avec TOUT ce qu'il faut
    socket.emit('init-pokedex', {
        captures: capturedPokemon,
        leaderboard: getLeaderboard(),
        total: Object.keys(capturedPokemon).length
    });
});

// --- WEBHOOK ---
app.post('/webhook/capture', (req, res) => {
    const data = req.body;

    if (data.secret !== API_SECRET) return res.status(403).send("Forbidden");

    const pokeId = parseInt(data.pokemonId);
    let finalName = data.pokemonName; 
    
    // Traduction
    try { finalName = pokemonTools.getName(pokeId, 'fr'); } catch (e) {}

    // Shiny ? (Le mod doit envoyer "isShiny": true)
    const isShiny = data.isShiny === true || data.isShiny === "true";

    console.log(`[CAPTURE] ${data.playerName} -> ${finalName} (Shiny: ${isShiny})`);

    // Logique: On enregistre si c'est nouveau OU si c'est un Shiny (on remplace le normal par le shiny)
    // Ici, on garde la logique simple: premier arrivé, premier servi.
    if (!capturedPokemon[pokeId] || (isShiny && !capturedPokemon[pokeId].isShiny)) {
        
        capturedPokemon[pokeId] = {
            id: pokeId,
            name: finalName,
            captor: data.playerName,
            isShiny: isShiny,
            timestamp: Date.now()
        };

        fs.writeFileSync(DB_FILE, JSON.stringify(capturedPokemon, null, 2));

        // On prévient tout le monde avec les scores mis à jour
        io.emit('new-capture', {
            pokemon: capturedPokemon[pokeId],
            leaderboard: getLeaderboard(),
            total: Object.keys(capturedPokemon).length
        });
    }

    res.status(200).send("OK");
});

server.listen(PORT, () => {
    console.log(`🚀 Serveur Pro lancé sur le port ${PORT}`);
});