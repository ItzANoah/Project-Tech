const express = require('express');
const fs = require('fs');
const app = express();
const port = 4000;
const session = require('express-session');
const multer = require('multer');
const mongoose = require('mongoose');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }))
app.use(express.json()); // Nodig om JSON-berichten (zoals de sollicitatie) vanuit frontend te lezen
app.use(express.static("static"));
app.set('view engine', 'ejs');
app.set('views', './views');

require('dotenv').config(); // MOET bovenaan staan voor de database link!
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const path = require('path'); // Ingebouwd in Node, hoef je niet te installeren
//casper was hier//

// Database connectie variabelen
const uri = process.env.URI;
const client = new MongoClient(uri);


/////////////// register functie ////////////////
let profileCollection; 

async function run() {
  try {
    await client.connect();
    const db = client.db("filmcrew");

    profileCollection = db.collection("profiles"); 
    
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

app.get('/profielPaginaIndividueel', (req, res) => {
  res.render('profielPaginaIndividueel');
});

// crew profile

app.get('/crew-profile', async (req, res) => {
    try {
        const db = client.db('filmcrew');
        const apiKey = process.env.TMDB_API_KEY;

        // 1. Haal het juiste project op
        let project = null;
        let isOwner = false;

        if (req.query.id) {
            // Bezoeker bekijkt een specifiek project via /crew-profile?id=...
            try {
                project = await db.collection('projects').findOne({ _id: new ObjectId(req.query.id) });
                if (project && req.session.userID) {
                    isOwner = req.session.userID.toString() === (project.ownerId ? project.ownerId.toString() : '');
                }
            } catch (err) {
                console.log("Ongeldig ID in de URL");
            }
        } else if (req.session.userID) {
            // Geen ID in de link? Dan tonen we jouw eigen project!
            project = await db.collection('projects').findOne({ ownerId: new ObjectId(req.session.userID) });
            isOwner = true; // Je bent altijd eigenaar van je eigen project
        }

        // Als er (nog) geen project is gevonden, maken we een leeg object
        if (!project) {
            project = {};
        }

        // 2. Haal de beschikbare filters op voor de dropdowns in de edit-modus
        const projectFilters = await db.collection('filters').find({}).toArray();

        // 3. Haal de vacatures/sollicitaties op die specifiek bij DIT project horen
        // We halen deze nu direct en betrouwbaar uit het project zelf!
        let openJobs = project.openRoles || [];

        // 4. Haal de data op voor de Carousel (Andere projecten van de regisseur)
        // We zetten de opgeslagen ID's om naar echte project-objecten uit de database
        let relatedProjectsData = [];
        if (project.relatedProjects && project.relatedProjects.length > 0) {
            const dbIds = [];
            const tmdbIds = [];

            project.relatedProjects.forEach(id => {
                if (typeof id === 'string' && id.startsWith('tmdb_')) {
                    tmdbIds.push(id.replace('tmdb_', '')); // Haal 'tmdb_' weg voor de fetch
                } else {
                    try { dbIds.push(id.length === 24 ? new ObjectId(id) : id); } 
                    catch(e) { dbIds.push(id); }
                }
            });

            // 1. Zoek de lokale FilmCrew database projecten
            const dbProjects = await db.collection('projects')
                .find({ _id: { $in: dbIds } })
                .toArray();

            // 2. Haal de TMDB projecten live op via de API!
            let tmdbProjects = [];
            if (tmdbIds.length > 0 && apiKey) {
                tmdbProjects = await Promise.all(tmdbIds.map(async (id) => {
                    try {
                        const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=nl-NL`);
                        if (!response.ok) return null;
                        const movie = await response.json();
                        
                        return {
                            _id: `tmdb_${id}`, // Zet het prefix weer terug
                            name: movie.title, // Consistentie met EJS (eigen database gebruikt 'name')
                            title: movie.title,
                            director: 'TMDB Regisseur', // Regisseur kost een extra fetch, we houden het simpel
                            images: [movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/img/placeholder.jpg'],
                            bio: movie.overview || 'Geen beschrijving beschikbaar.'
                        };
                    } catch(e) { return null; }
                }));
            }

            relatedProjectsData = [...dbProjects, ...tmdbProjects.filter(p => p !== null)];
        }

        // 5. Render de pagina en geef alle variabelen mee aan EJS
        res.render('crew-profile', {
            projectData: project,
            projectImages: project.images || [], // De array met foto-paden
            projectFilters: projectFilters,      // De dropdown opties
            directorProjects: relatedProjectsData, // De gevulde carousel
            applications: openJobs,              // De gevulde sollicitatie-grid
            isOwner: isOwner                     // <-- Boolean meegeven aan de frontend!
        });

    } catch (error) {
        console.error("Fout bij laden van crew-profile:", error);
        res.status(500).send("Er is een fout opgetreden bij het laden van het profiel.");
    }
});

app.post('/save-project', checkInlog, upload.array('projectImages'), async (req, res) => {
    try {
        const db = client.db('filmcrew');
        
        // Zoek HET project van de ingelogde gebruiker
        let project = await db.collection('projects').findOne({ ownerId: new ObjectId(req.session.userID) });

        // Als de gebruiker nog geen project had, maken we er eerst eentje aan in de database!
        if (!project) {
            const insertResult = await db.collection('projects').insertOne({
                ownerId: new ObjectId(req.session.userID),
                createdAt: new Date()
            });
            project = await db.collection('projects').findOne({ _id: insertResult.insertedId });
        }

        // 1. AFBEELDINGEN BEWAREN
        let finalImages = project.images || []; // Standaard behouden we de oude foto('s)
        if (req.files && req.files.length > 0) {
            // Heeft de gebruiker zojuist nieuwe bestanden geupload? Dan OVERSCHRIJVEN we de oude.
            finalImages = req.files.map(file => `/uploads/${file.filename}`);
        }

        // --- NIEUW: Openstaande vacatures bundelen ---
        let openRoles = [];
        if (req.body.jobTitel) {
            const titels = [].concat(req.body.jobTitel);
            const descs = [].concat(req.body.jobDescription);
            for (let i = 0; i < titels.length; i++) {
                if (titels[i].trim() !== "") {
                    openRoles.push({
                        title: titels[i].trim(),
                        description: (descs[i] || "").trim()
                    });
                }
            }
        }

        // 2. PROJECT UPDATE (Filters, tekst, Carousel IDs & Vacatures)
        const updatedData = {
            name: req.body.title,
            subtitle: req.body.subtitle,
            bio: req.body.description,
            productionDescription: req.body.productionDescription,
            type: req.body.type,
            genre: req.body.genre,
            images: finalImages,
            relatedProjects: req.body.relatedProjects ? req.body.relatedProjects.split(',').filter(id => id !== "") : [],
            openRoles: openRoles, // <--- Opgeslagen direct in de projects collectie!
            updatedAt: new Date()
        };

        await db.collection('projects').updateOne({ _id: project._id }, { $set: updatedData });

        res.redirect('/crew-profile');
    } catch (error) {
        console.error("Fout bij opslaan:", error);
        res.status(500).send("Fout bij opslaan.");
    }
});

app.get('/api/search-tmdb', async (req, res) => {
    const query = req.query.q;
    const apiKey = process.env.TMDB_API_KEY;

    try {
        // 1. Zoek eerst de films
        const searchResponse = await fetch(
            `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=nl-NL`
        );
        const searchData = await searchResponse.json();
        
        // 2. Voor de top 5 resultaten halen we de regisseur op (om de API niet te overbelasten)
        const detailedResults = await Promise.all(
            searchData.results.slice(0, 8).map(async (movie) => {
                const creditsResponse = await fetch(
                    `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${apiKey}`
                );
                const creditsData = await creditsResponse.json();
                
                // Zoek in de 'crew' lijst naar de persoon met de job 'Director'
                const directorInfo = creditsData.crew.find(person => person.job === 'Director');
                const directorName = directorInfo ? directorInfo.name : 'Onbekende regisseur';

                return {
                    _id: `tmdb_${movie.id}`,
                    name: movie.title, // Consistentie met EJS
                    title: movie.title,
                    director: directorName, // Nu de echte naam van de regisseur!
                    images: [movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/img/placeholder.jpg'],
                    bio: movie.overview
                };
            })
        );

        res.json(detailedResults);
    } catch (err) {
        console.error("TMDB Error:", err);
        res.status(500).json({ error: "Fout bij ophalen TMDB data" });
    }
});

app.post('/api/submit-application', async (req, res) => {
    const db = client.db('filmcrew');
    
    const newApplication = {
        senderId: new ObjectId(req.session.userID), // De ingelogde persoon
        receiverId: new ObjectId(req.body.receiverId), // De eigenaar van het project
        status: "pending",
        message: req.body.message, // De tekst uit het textarea veld
        timestamp: new Date() // Maakt automatisch de $date aan
    };

    await db.collection('verzoeken').insertOne(newApplication);
    res.status(200).send("Gelukt!");
});

app.get('/api/all-projects', async (req, res) => {
    try {
        const db = client.db('filmcrew');
        // Haal alle projecten op uit de collectie 'projects'
        const projects = await db.collection('projects').find({}).toArray();
        res.json(projects); // Stuur ze als JSON naar de browser
    } catch (err) {
        res.status(500).json({ error: "Database fout" });
    }
});

app.get('/current-matches', (req, res) => {
  res.render('current-matches');
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
