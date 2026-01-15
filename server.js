const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const path = require('path');
const pokemonTools = require('pokemon');
const mongoose = require('mongoose'); // Module MongoDB

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const API_SECRET = "MON_SUPER_CODE_SECRET_2026"; 

// ✅ TON LIEN DE CONNEXION COMPLET (AVEC LE MOT DE PASSE)
const MONGO_URI = "mongodb+srv://donovandolny_db_user:Bandi@cluster0.chdsbzu.mongodb.net/?appName=Cluster0";

// --- CONNEXION BASE DE DONNÉES ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connecté à MongoDB Atlas avec succès !"))
    .catch(err => console.error("❌ Erreur de connexion MongoDB :", err));

// --- MODÈLE DE DONNÉES (SCHEMA) ---
const PokemonSchema = new mongoose.Schema({
    id: Number,         
    name: String,       
    captor: String,     
    isShiny: Boolean,   
    timestamp: { type: Date, default: Date.now } 
});
const PokemonModel = mongoose.model('Pokemon', PokemonSchema);

app.use(bodyParser.json());
// On sert le dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- FONCTION: RÉCUPÉRER TOUTES LES DONNÉES ---
async function getAllData() {
    // On demande à MongoDB de tout nous donner
    const allPokes = await PokemonModel.find();
    
    // 1. Format pour la grille
    const captures = {};
    allPokes.forEach(p => {
        captures[p.id] = {
            id: p.id,
            name: p.name,
            captor: p.captor,
            isShiny: p.isShiny
        };
    });

    // 2. Calcul du Top Chasseurs
    const scores = {};
    allPokes.forEach(p => {
        if (!scores[p.captor]) scores[p.captor] = 0;
        scores[p.captor]++;
    });
    
    const leaderboard = Object.entries(scores)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    return { captures, leaderboard, total: allPokes.length };
}

// --- SOCKET.IO ---
io.on('connection', async (socket) => {
    // Chargement initial depuis MongoDB
    const data = await getAllData();
    socket.emit('init-pokedex', data);
});

// --- WEBHOOK (Réception des captures) ---
app.post('/webhook/capture', async (req, res) => {
    const data = req.body;

    if (data.secret !== API_SECRET) return res.status(403).send("Forbidden");

    const pokeId = parseInt(data.pokemonId);
    let finalName = data.pokemonName; 
    
    try { finalName = pokemonTools.getName(pokeId, 'fr'); } catch (e) {}

    const isShiny = data.isShiny === true || data.isShiny === "true";

    console.log(`[CAPTURE] ${data.playerName} -> ${finalName} (Shiny: ${isShiny})`);

    // Vérification en base de données
    const existing = await PokemonModel.findOne({ id: pokeId });
    let shouldUpdate = false;

    if (!existing) {
        // C'est nouveau -> On crée
        const newPoke = new PokemonModel({
            id: pokeId, name: finalName, captor: data.playerName, isShiny: isShiny
        });
        await newPoke.save();
        shouldUpdate = true;
    } 
    else if (isShiny && !existing.isShiny) {
        // C'est une amélioration Shiny -> On met à jour
        existing.name = finalName;
        existing.captor = data.playerName;
        existing.isShiny = true;
        existing.timestamp = Date.now();
        await existing.save();
        shouldUpdate = true;
    }

    // Si on a changé quelque chose, on prévient le site web
    if (shouldUpdate) {
        const refreshData = await getAllData();
        io.emit('new-capture', {
            pokemon: { id: pokeId, name: finalName, captor: data.playerName, isShiny: isShiny },
            leaderboard: refreshData.leaderboard,
            total: refreshData.total
        });
    }

    res.status(200).send("Saved to MongoDB");
});

server.listen(PORT, () => {
    console.log(`🚀 Serveur MongoDB lancé sur le port ${PORT}`);
});