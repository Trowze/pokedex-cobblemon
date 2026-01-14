const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// SECRET KEY : Pour que seul ton serveur Minecraft puisse envoyer des infos
// Tu devras mettre la même clé dans le mod Minecraft plus tard.
const API_SECRET = "MON_SUPER_CODE_SECRET_2026"; 

// Base de données simple (Fichier JSON)
const DB_FILE = 'data.json';
let capturedPokemon = {};

// Chargement de la sauvegarde au démarrage
if (fs.existsSync(DB_FILE)) {
    capturedPokemon = JSON.parse(fs.readFileSync(DB_FILE));
} else {
    // Si pas de fichier, on démarre vide
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

app.use(express.static('public')); // Ton index.html doit être dans un dossier 'public'
app.use(bodyParser.json());

// 1. QUAND UN JOUEUR SE CONNECTE AU SITE
io.on('connection', (socket) => {
    console.log('Un visiteur regarde le Pokédex');
    // On lui envoie immédiatement tout ce qui a déjà été capturé
    socket.emit('init-pokedex', capturedPokemon);
});

// 2. RECEPTION DE LA CAPTURE (Venant de Minecraft)
app.post('/webhook/capture', (req, res) => {
    const { secret, pokemonId, pokemonName, playerName } = req.body;

    // Sécurité : on vérifie que c'est bien ton serveur qui parle
    if (secret !== API_SECRET) {
        return res.status(403).send("Accès interdit : Mauvais code secret !");
    }

    console.log(`[CAPTURE] ${playerName} a attrapé ${pokemonName} (#${pokemonId})`);

    // On vérifie si ce Pokémon a déjà été capturé (Premier du serveur ?)
    if (!capturedPokemon[pokemonId]) {
        // C'est une NOUVELLE découverte !
        capturedPokemon[pokemonId] = {
            id: pokemonId,
            name: pokemonName,
            captor: playerName,
            date: new Date()
        };

        // Sauvegarde dans le fichier (pour ne pas perdre les données si le serveur restart)
        fs.writeFileSync(DB_FILE, JSON.stringify(capturedPokemon, null, 2));

        // On crie la nouvelle à tout le monde sur le site web
        io.emit('new-capture', {
            id: pokemonId,
            name: pokemonName,
            captor: playerName
        });
    } else {
        console.log(" -> Déjà connu, on ignore (ou on peut faire une notif différente)");
    }

    res.status(200).send("Reçu 5/5");
});

// Lancement
server.listen(PORT, () => {
    console.log(`>>> LE POKEDEX EST EN LIGNE SUR LE PORT ${PORT}`);
    console.log(`>>> Ouvre http://localhost:${PORT} pour voir`);
});