const express = require('express');
const fs = require('fs');
const path = require('path'); 
const app = express();
const port = 4000;
const session = require('express-session');
const multer = require('multer');
const axios = require('axios');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');
const validator = require('validator');

const bcrypt = require('bcrypt');
require('dotenv').config();

app.use(express.urlencoded({ extended: true }))
app.use(express.json());
app.use(express.static("static"));
app.use(express.static('public')); // Zorg dat deze er ook staat voor je uploads
app.set('view engine', 'ejs');
app.set('views', './views');

//casper was hier//

// Database connectie variabelen
const uri = process.env.URI;
const client = new MongoClient(uri);

/////////////// register functie ////////////////
let profileCollection;
let matchRequestcollection; 
let projectsCollection;

async function run() {
  try {
    await client.connect();
    const db = client.db("filmcrew");

    profileCollection = db.collection("profiles"); 
    matchRequestcollection = db.collection("verzoeken");
    projectsCollection = db.collection("projects");

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
app.use(express.json());

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
    next(); // ga door naar de volgende stap
  } else {
    res.redirect('/login'); // Terug naar de login pagina
  }
}
// voor de noti in de header
app.use(async (req, res, next) => {
  // alleen wanneer ingelogd
  if (req.session.userID) {
    try {
      const matchdata = await matchRequestcollection.find({ 
        receiverId: req.session.userID,
        status: "pending" 
      }).sort({ timestamp: -1 }).toArray();

      let hasNewHeaderRequest = false;
      if (matchdata.length > 0) {
        const nu = new Date();
        const tweeDagenGeleden = new Date();
        tweeDagenGeleden.setDate(nu.getDate() - 2);
        const nieuwsteMatchDatum = new Date(matchdata[0].timestamp);

        if (nieuwsteMatchDatum > tweeDagenGeleden) {
          hasNewHeaderRequest = true;
        }
      }

      res.locals.globalNotification = hasNewHeaderRequest;
      
    } catch (err) {
      console.error("Notificatie check fout:", err);
      res.locals.globalNotification = false;
    }
  } else {
    res.locals.globalNotification = false;
  }
  next();
});

// Multer Configuratie voor uploads (anna)
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
  filename: (req, file, cb) => {
    cb(null, req.session.userID + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fieldSize: 10 * 1024 * 1024 } // Verhoogt de limiet voor tekstvelden naar 10 MB
});

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

    let errors = [];

    // checkt of het echt een email is
    if (!validator.isEmail(email)) {
      errors.push("Het opgegeven e-mailadres is niet geldig.");
    }

    // haalt hoofdletters weg
    const sanitizedEmail = validator.normalizeEmail(email);

    // wachtwoord min 8 tekens, iets meer beveiliging, nog geen vereisde als hoofdletters of speciale tekens)
    if (!validator.isLength(password, { min: 8 })) {
      errors.push("Je wachtwoord moet minimaal 8 tekens bevatten.");
    }

    // beveiliging, is niet perse nodig maar maakt de website minder hack gevoelig - credits aan express-validator.github.io 
    const sanitizedBio = validator.escape(bio || "");

    // error melding
    if (errors.length > 0) {
      return res.status(400).render('register', { errors, oldInput: req.body });
    }

    // Check of de gebruiker al bestaat 
    const userExists = await profileCollection.findOne({ 
      $or: [{ name: username }, { email: sanitizedEmail }] 
    });

    if (userExists) {
      return res.send('Gebruikersnaam of e-mailadres is al bezet.');
    }

    // Wachtwoord versleutelen, voor deze keer geen variabele van de saltrounds gemaakt omdat het maar 1 keer gebruikt wordt.
    const hashedPassword = await bcrypt.hash(password, 10);

    // volledige profiel
    const newUser = {
      name: username,
      email: sanitizedEmail,
      age: Number(age),
      password: hashedPassword,
      role: userFunction,
      bio: sanitizedBio,
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

        // 1.5 Haal de naam van de eigenaar op om als regisseur in te vullen
        if (project.ownerId) {
            const ownerProfile = await db.collection('profiles').findOne({ _id: new ObjectId(project.ownerId) });
            if (ownerProfile) {
                project.director = ownerProfile.name;
            }
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
                        
                        // Extra fetch voor de regisseur (credits)
                        const creditsResponse = await fetch(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${apiKey}`);
                        const creditsData = await creditsResponse.json();
                        const directorInfo = creditsData.crew ? creditsData.crew.find(person => person.job === 'Director') : null;
                        const directorName = directorInfo ? directorInfo.name : 'Onbekende regisseur';

                        return {
                            _id: `tmdb_${id}`, // Zet het prefix weer terug
                            name: movie.title, // Consistentie met EJS (eigen database gebruikt 'name')
                            title: movie.title,
                            director: directorName, // Nu de echte naam van de regisseur!
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
            isOwner: isOwner,                    // <-- Boolean meegeven aan de frontend!
            isLoggedIn: !!req.session.userID     // Check of de bezoeker is ingelogd
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

        // Stuur succes mee terug naar de browser
        res.redirect('/crew-profile?success=true');
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
    // Extra beveiliging: weiger verzoeken van niet-ingelogde gebruikers
    if (!req.session.userID) {
        return res.status(401).json({ error: "Je moet ingelogd zijn om te solliciteren." });
    }

    const db = client.db('filmcrew');
    
    const newApplication = {
        senderId: String(req.session.userID), // De ingelogde persoon als string
        receiverId: String(req.body.receiverId), // De eigenaar van het project als string
        status: "pending",
        message: req.body.message || "Ik wil graag solliciteren op deze rol!", // Slaat de getypte tekst op, of deze standaardtekst
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

app.get('/current-matches', checkInlog, async (req, res) => {
  try {
    const userId = req.session.userID;

    const aanvragenData = await matchRequestcollection.find({ receiverId: userId, status: "pending" }).toArray();
    const matchesData = await matchRequestcollection.find({ 
      $or: [{ receiverId: userId }, { senderId: userId }], 
      status: "accepted" 
    }).toArray();

    const verrijkMatch = async (match) => {
      const validSender = match.senderId && match.senderId.length === 24;
      const validProject = match.projectId && match.projectId.length === 24;
    
      const afzender = validSender ? await profileCollection.findOne({ _id: new ObjectId(match.senderId) }) : null;
      const projectDetails = validProject ? await projectsCollection.findOne({ _id: new ObjectId(match.projectId) }) : null;
    
      return {
        ...match,
        senderName: afzender ? afzender.name : "Onbekend",
        senderEmail: afzender ? afzender.email : "Geen email bekend", 
        
        displayImage: (projectDetails && projectDetails.mainImage) ? projectDetails.mainImage : "/images/placeholder.png",
        jobTitel: match.jobTitel || "Geen functie",
        jobDescription: match.jobDescription || "Geen beschrijving"
      };
    };

    const aanvragen = await Promise.all(aanvragenData.map(verrijkMatch));
    const matches = await Promise.all(matchesData.map(verrijkMatch));

    res.render('current-matches', { aanvragen, matches });

  } catch (error) {
    console.error("Fout:", error);
    res.status(500).send("Er ging iets mis.");
  }
});
//accepteren en declinen
app.post('/match/accept/:id', checkInlog, async (req, res) => {
  try {
      const matchId = req.params.id;
      await matchRequestcollection.updateOne(
          { _id: new ObjectId(matchId) },
          { $set: { status: "accepted" } }
      );
      res.redirect('/current-matches');
  } catch (error) {
      console.error("Fout bij accepteren:", error);
      res.status(500).send("Er ging iets mis.");
  }
});
app.post('/match/decline/:id', checkInlog, async (req, res) => {
  try {
      const matchId = req.params.id;
      await matchRequestcollection.updateOne(
          { _id: new ObjectId(matchId) },
          { $set: { status: "rejected" } }
      );
      res.redirect('/current-matches');
  } catch (error) {
      console.error("Fout bij afwijzen:", error);
      res.status(500).send("Er ging iets mis.");
  }
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
        // Bij het succesvol inloggen:
        req.session.username = user.name;
        req.session.userID = user._id.toString(); 

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