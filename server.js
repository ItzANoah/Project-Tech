const express = require('express');
const fs = require('fs');
const app = express();
const port = 4000;
const session = require('express-session');
const multer = require('multer');
const axios = require('axios'); // Voor api

app.use(express.urlencoded({ extended: true }))
app.use(express.json()); // Nodig voor fetch calls (anna)
app.use(express.static("static"));
app.set('view engine', 'ejs');
app.set('views', './views');

require('dotenv').config(); // MOET bovenaan staan voor de database link!
const { MongoClient, ObjectId } = require('mongodb'); // ObjectId toegevoegd (anna)
const bcrypt = require('bcrypt');
const path = require('path'); // Ingebouwd in Node, hoef je niet te installeren
//casper was hier//

// Database connectie variabelen
const uri = process.env.URI;
const client = new MongoClient(uri);

/////////////// register functie ////////////////
let profileCollection; 
let projectsCollection; // Variabele voor de projecten database (anna)

async function run() {
  try {
    await client.connect();
    const db = client.db("filmcrew");

    profileCollection = db.collection("profiles"); 
    projectsCollection = db.collection("projects"); // Connectie met projecten (anna)
    
    console.log("Database verbinding succesvol!");
  } catch (error) {
    console.error("Verbindingsfout:", error);
  }
}

run().catch(console.dir);

// Middleware instellen
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-geheim',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // moet op true als we https gaan gebruikern
    maxAge: 3600000 // 1 uur lang cookie
  }
}));

//////// is voor de header, zodat de username op alle pagina's gebruikt kan worden. ////////
app.use((req, res, next) => {
  res.locals.username = req.session.username || null;
  next();
});

//////// checkt of je bent ingelogd /////////
function checkInlog(req, res, next) {
  if (req.session.username) {
    next(); // ga maar door naar de volgende stap
  } else {
    res.redirect('/login'); // Terug naar de login pagina
  }
}

// Multer Configuratie voor uploads (anna)
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
  filename: (req, file, cb) => {
    cb(null, req.session.userID + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Een test route
app.get('/', (req, res) => {
    res.render('index');
});

app.listen(port, () => {
    console.log(`Server draait op http://localhost:${port}`);
});
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  try {
    // alles van stap 1 & 2 opslaan
    const { 
      username, 
      email, 
      age, 
      password, 
      function: userFunction,
      bio,
      experience 
    } = req.body;

    // Check of de gebruiker al bestaat 
    const userExists = await profileCollection.findOne({ name: username });
    if (userExists) {
      return res.send('Deze naam is al bezet.');
    }

    // Wachtwoord versleutelen
    const hashedPassword = await bcrypt.hash(password, 10);

    // volledige profiel opbouwen
    const newUser = {
      name: username,
      email: email,
      age: Number(age),
      password: hashedPassword,
      role: userFunction,
      bio: bio,
      experience: Number(experience), 
      createdAt: new Date()
    };

    // Opslaan in de juiste collectie
    await profileCollection.insertOne(newUser);
    
    console.log('Volledig profiel opgeslagen voor:', username);
    res.redirect('/login');

  } catch (err) {
    console.error("Fout bij registreren:", err);
    res.status(500).send("Er ging iets mis bij het aanmaken van je profiel.");
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/matching', (req, res) => {
  res.render('matching');
});

// crew profile

app.get('/crew-profile', (req, res) => {
  //  Maak de lijst met afbeeldingen aan
  const projectImages = [
    "/images/placeholder-hero.jpg",
    "/images/cameraman.png",
    "/images/home-page-image.png"
  ];

  // maak de tags aan 
  const projectTags = ["Sci-Fi", "Action", "Adventure", "Thriller", "Animation"];

  // Stuur alles naar de render functie
  res.render('crew-profile', {
    projectImages: projectImages,
    projectTags: projectTags
  });
});

app.get('/current-matches', checkInlog, async (req, res) => {
  
  res.render('current-matches');
});

///////////////// inlog functies ////////////////////

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await profileCollection.findOne({ name: username });

    if (user) {
      // het is een hashed/beveiligd wachtwoord, maar heet in de db nogsteeds gewoon password
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        // Sessie vullen
        req.session.userID = user._id;
        req.session.username = user.name;
        
        console.log(`Gebruiker ${user.name} is ingelogd.`);
        return res.redirect('/current-matches');
      }
    }
    
    // Als de gebruiker niet bestaat of het wachtwoord klopt niet
    return res.render('login', { error: 'Onjuiste gebruikersnaam of wachtwoord' });
    
  } catch (err) {
    console.error("Login fout:", err);
    res.status(500).send("Serverfout.");
  }
});

// //////// logout funtie ////////////
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Fout bij uitloggen:", err);
    }
    res.redirect('/login');
  });
});

// --- Profiel Routes (anna) ---

// Eigen profiel bekijken
app.get('/profielPaginaIndividueel', checkInlog, async (req, res) => {
  try {
    // We gebruiken het userID uit de sessie
    const user = await profileCollection.findOne({ _id: new ObjectId(req.session.userID) });
    
    if (user) {
      const userProjects = await projectsCollection.find({ 
        _id: { $in: user.myProjects || [] } 
      }).toArray();
      res.render('profielPaginaIndividueel', { theUser: user, projects: userProjects });
    } else {
      res.status(404).send("Gebruiker niet gevonden.");
    }
  } catch (err) { res.status(500).send("Server fout"); }
});

// Publiek profiel bekijken (voor anderen)
app.get('/profiel/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check of de meegestuurde ID wel een geldig MongoDB formaat is
    if (!ObjectId.isValid(userId)) {
      return res.status(400).send("Ongeldig Gebruiker ID");
    }

    const user = await profileCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) return res.status(404).send("Gebruiker niet gevonden");
    
    const projects = await projectsCollection.find({ 
      _id: { $in: user.myProjects || [] } 
    }).toArray();
    
    res.render('publicProfielPaginaIndividueel', { theUser: user, projects: projects });
  } catch (err) { res.status(500).send("Server fout"); }
});

// --- Project Acties & Uploads (anna) ---

// Route voor het bijwerken van algemene profielgegevens (Naam, Rol, Bio, Skills)
app.post('/update-profile', checkInlog, async (req, res) => {
    try {
        const { name, role, bio, skills } = req.body;
        
        // We zoeken op de ObjectId van de ingelogde gebruiker
        await profileCollection.updateOne(
            { _id: new ObjectId(req.session.userID) },
            { 
                $set: { 
                    name: name,
                    role: role,
                    bio: bio,
                    skills: skills 
                } 
            }
        );

        // OOK de sessie-naam bijwerken voor de header/overal
        req.session.username = name;

        console.log("Profiel bijgewerkt voor ID:", req.session.userID);
        res.json({ success: true });
    } catch (err) {
        console.error("Fout bij updaten profiel:", err);
        res.status(500).json({ success: false, message: "Serverfout bij opslaan" });
    }
});

// Project aanpassen (inclusief galerij)
app.post('/update-project-details', checkInlog, upload.fields([
    { name: 'projectImage', maxCount: 1 },
    { name: 'galerijImages', maxCount: 10 }
]), async (req, res) => {
    try {
        const { projectId, title, type, contribution, genres, existingImages } = req.body;
        const currentProject = await projectsCollection.findOne({ _id: new ObjectId(projectId) });
        let finalMainImage = currentProject.mainImage || currentProject.image; 
        if (req.files['projectImage']) { finalMainImage = '/uploads/' + req.files['projectImage'][0].filename; }

        let updatedGalerij = JSON.parse(existingImages || "[]");
        if (req.files['galerijImages']) {
            req.files['galerijImages'].forEach(file => { updatedGalerij.push('/uploads/' + file.filename); });
        }
        updatedGalerij = updatedGalerij.filter(img => img !== finalMainImage);

        await projectsCollection.updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { 
                name: title, title: title, type: type, bio: contribution, 
                description: contribution, genres: JSON.parse(genres), 
                mainImage: finalMainImage, image: finalMainImage, images: updatedGalerij 
            }}
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Profielfoto uploaden 
app.post('/upload-pfp', checkInlog, upload.single('profilePic'), async (req, res) => {
  try {
    const imagePath = '/uploads/' + req.file.filename;
    
    // BELANGRIJK: We zoeken op _id met de ObjectId uit de sessie
    await profileCollection.updateOne(
      { _id: new ObjectId(req.session.userID) }, 
      { $set: { image: imagePath } }
    );
    
    res.json({ success: true, newImagePath: imagePath });
  } catch (err) { 
    console.error("PFP Upload fout:", err);
    res.status(500).json({ success: false, message: 'Fout bij uploaden' }); 
  }
});

// Handmatig nieuw project toevoegen
app.post('/add-project-manual', checkInlog, upload.single('projectImage'), async (req, res) => {
  try {
    const { title, type, contribution, role } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : '/images/projectPlaceholder.png';
    
    const newProject = { 
      title, 
      name: title, 
      type, 
      description: contribution, 
      bio: contribution, 
      role, 
      mainImage: imagePath, 
      images: [], 
      genres: [role || type], 
      createdAt: new Date() 
    };

    const result = await projectsCollection.insertOne(newProject);
    
    // Gebruik _id en ObjectId om de koppeling te maken
    await profileCollection.updateOne(
      { _id: new ObjectId(req.session.userID) }, 
      { $push: { myProjects: result.insertedId } }
    );
    
    res.json({ success: true });
  } catch (err) { 
    console.error("Handmatig toevoegen fout:", err);
    res.status(500).json({ success: false }); 
  }
});

// Project verwijderen
app.post('/delete-project', checkInlog, async (req, res) => {
    try {
        const { projectId } = req.body;
        await projectsCollection.deleteOne({ _id: new ObjectId(projectId) });
        await profileCollection.updateOne({ name: req.session.userID }, { $pull: { myProjects: new ObjectId(projectId) } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Zoeken in database naar bestaande projecten
app.get('/search-db-projects', checkInlog, async (req, res) => {
    try {
        const results = await projectsCollection.find({ name: { $regex: req.query.q, $options: 'i' } }).limit(5).toArray();
        res.json(results);
    } catch (err) { res.status(500).json([]); }
});

// Bestaand project toevoegen aan je eigen lijst
app.post('/add-existing-project', checkInlog, async (req, res) => {
    try {
        const { projectId, userRole } = req.body;
        
        // 1. Voeg het project ID toe aan de lijst van de gebruiker
        await profileCollection.updateOne(
            { _id: new ObjectId(req.session.userID) }, 
            { $addToSet: { myProjects: new ObjectId(projectId) } }
        );

        // 2. Voeg de rol van de gebruiker toe aan de genres van het project
        await projectsCollection.updateOne(
            { _id: new ObjectId(projectId) },
            { $addToSet: { genres: userRole } }
        );
        
        res.json({ success: true });
    } catch (err) { 
        console.error("Bestaand project toevoegen fout:", err);
        res.status(500).json({ success: false }); 
    }
});

// Films van api halen

app.get('/search-api-projects', checkInlog, async (req, res) => {
    try {
        const query = req.query.q;
        const apiKey = process.env.TMDB_API_KEY;
        
        // Zoeken naar films op TMDB
        const response = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=nl-NL`);
        
        // Relevante info naar de voorkant
        const results = response.data.results.map(movie => ({
            apiId: movie.id,
            title: movie.title,
            year: movie.release_date ? movie.release_date.split('-')[0] : 'Onbekend',
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/images/projectPlaceholder.png',
            overview: movie.overview
        }));

        res.json(results);
    } catch (err) {
        console.error("API Error:", err);
        res.json([]);
    }
});

// --- TMDB API ROUTES (Anna) ---

// 1. Zoeken in de TMDB API
app.get('/search-api-projects', checkInlog, async (req, res) => {
    try {
        const query = req.query.q;
        const apiKey = process.env.TMDB_API_KEY; 
        
        if (!query) return res.json([]);

        const response = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=nl-NL`);
        
        const results = response.data.results.map(movie => ({
            title: movie.title,
            year: movie.release_date ? movie.release_date.split('-')[0] : 'Onbekend',
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/images/projectPlaceholder.png',
            overview: movie.overview,
            id: movie.id
        }));

        res.json(results);
    } catch (err) {
        console.error("TMDB API Fout:", err.message);
        res.status(500).json([]);
    }
});

// API film verwijderen uit het profiel
app.post('/delete-api-project', checkInlog, async (req, res) => {
    try {
        const { projectTitle } = req.body;
        
        await profileCollection.updateOne(
            { _id: new ObjectId(req.session.userID) },
            { $pull: { relatedProjects: { title: projectTitle } } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Fout bij verwijderen API project:", err);
        res.status(500).json({ success: false });
    }
});

app.post('/add-api-project', checkInlog, async (req, res) => {
    try {
        const { title, description, image, role } = req.body;

        const apiProjectData = {
            title: title,
            description: description,
            image: image,
            role: role,
            source: "TMDB-API",
            addedAt: new Date()
        };

        // Sla API films direct op in 'relatedProjects' in de user collectie
        await profileCollection.updateOne(
            { _id: new ObjectId(req.session.userID) },
            { $push: { relatedProjects: apiProjectData } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Fout bij opslaan API project:", err);
        res.status(500).json({ success: false });
    }
});

// Zoeken in eigen database naar bestaande projecten
app.get('/search-db-projects', checkInlog, async (req, res) => {
    try {
        const query = req.query.q;
        const results = await projectsCollection.find({ 
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { title: { $regex: query, $options: 'i' } }
            ]
        }).limit(5).toArray();
        res.json(results);
    } catch (err) { 
        res.status(500).json([]); 
    }
});

// Bestaand project uit eigen DB toevoegen aan profiel
app.post('/add-existing-project', checkInlog, async (req, res) => {
    try {
        const { projectId, userRole } = req.body;
        
        await profileCollection.updateOne(
            { _id: new ObjectId(req.session.userID) }, 
            { $addToSet: { myProjects: new ObjectId(projectId) } }
        );
        
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ success: false }); 
    }
});