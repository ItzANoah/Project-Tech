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

require('dotenv').config(); // MOET bovenaan staan voor de database link!
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
const upload = multer({ storage: storage });

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

// crew profile

app.get('/crew-profile', async (req, res) => {
  try {

    const db = client.db('filmcrew');

    // 1. Haal het project op, het eerste project wat je ziet.
    const project = await db.collection('projects').findOne({}) || {};

    // We zoeken in de collectie 'filters' binnen de database 'filmcrew'
    const projectFilters = await db.collection('filters').find({}).toArray();

    // pak alle foto's van de database en stop dit in een array. Als project.images niet bestaat, maken we er een lege array [] van.
    const projectImages = project.images || [];

    // Stuur alles naar de EJS
    res.render('crew-profile', {
      projectData: project,   // Bevat: title, subtitle, description, images
      projectImages: projectImages || [], // De array met fotopaden voor je slideshow
      projectFilters: projectFilters || []
    });
  } catch (error) {
    console.error("Fout bij ophalen profiel/project:", error);
    res.status(500).send("Fout bij laden profiel");
  }
});

//  upload.array omdat je meerdere foto's tegelijk kunt uploaden.
app.post('/save-project', upload.array('projectImages'), async (req, res) => {
  try {
    const db = client.db('filmcrew');

    // De lijst van foto's die overblijven na het klikken op verwijderen
    let remainingImages = [];
    // maak er een array van en sla geen lege velden op.
    if (req.body.remainingImages) {
      remainingImages = req.body.remainingImages.split(',').filter(path => path !== "");
    }

    // nieuwe foto's, neem hun pad
    const newUploads = req.files.map(file => `/uploads/${file.filename}`);

    // combineren van nieuwe met oude foto's
    const finalImagesList = [...remainingImages, ...newUploads];

    // pak alle veranderingen bij elkaar en stop dit in een object
    const updatedProject = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      description: req.body.description,
      images: finalImagesList, // We overschrijven de oude lijst volledig
      type: req.body.type,
      genre: req.body.genre,
      updatedAt: new Date()
    };

    await db.collection('projects').updateOne(
      {}, // upload naar het eerste project wat je ziet
      { $set: updatedProject }, // vervang oude data met nieuwe data
      { upsert: true } // maak aan als er nog geen project bestaat
    );

    res.redirect('/crew-profile'); // stuur gebruiker terug naar crew-profile
  } catch (error) {
    console.error("Opslaan mislukt:", error);
    res.status(500).send("Fout bij opslaan");
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


// Aanroepen collections profiles en projects
const getCollection = async (collection) => {
  const database = client.db("filmcrew");
  return await database.collection(collection).find().toArray();
}

const getDistinctValues = async (collection, key) => {
  const database = client.db("filmcrew");
  return await database.collection(collection).distinct(key);
}

const getMinOrMaxValue = async (key, sort) => {
  const database = client.db("filmcrew");
  const minOrMaxDocument = await database.collection('profiles')
    .find({[key]: {$exists: true}})
    // Find() alleen op een specifieke key https://www.geeksforgeeks.org/mongodb/mongodb-check-the-existence-of-the-fields-in-the-specified-collection/
    .sort({[key]: sort})
    .toArray();

  return minOrMaxDocument[0][key];
}

// Matching
app.get('/matching', async (req, res) => {
  try {
    let matchingItems = [];
    let profileRoles = [];
    let projectTypes = [];
    let projectGenres = [];
    let highestProfileAge = null;
    let lowestProfileAge = null;
    let highestExperience = null;
    let lowestExperience = null;

    const filtersQuery = req.query;
    const viewMode = filtersQuery.view || 'all';

    if (viewMode === "all") {
      let profiles = await getCollection('profiles');
      let projects = await getCollection('projects');

      // Concat() voor mergen meerdere arrays https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat
      matchingItems = profiles.concat(projects);
    }

    // Alle profiles filters
    if (viewMode === "profiles") {
      matchingItems = await getCollection('profiles');

      profileRoles = await getDistinctValues('profiles', 'role');
      highestProfileAge = await getMinOrMaxValue('age', -1);
      lowestProfileAge = await getMinOrMaxValue('age', 1);
      highestExperience = await getMinOrMaxValue('experience', -1);
      lowestExperience = await getMinOrMaxValue('experience', 1);

      const hasFilteredRoles = profileRoles.some(role => filtersQuery[role] === 'on')
      if (hasFilteredRoles) {
        matchingItems = matchingItems.filter(item => filtersQuery[item.role] === 'on');
      }

      const hasFilteredAge = (filtersQuery['ageMin'] && filtersQuery['ageMax']);
      if (hasFilteredAge) {
        matchingItems = matchingItems.filter(item => item.age >= filtersQuery['ageMin'] && item.age <= filtersQuery['ageMax']);
      }

      const hasFilteredExperience = (filtersQuery['experienceMin'] && filtersQuery['experienceMax']);
      if (hasFilteredExperience) {
        matchingItems = matchingItems.filter(item => item.experience >= filtersQuery['experienceMin'] && item.experience <= filtersQuery['experienceMax']);
      }
    }

    // alle project filters
    if (viewMode === "projects") {
      matchingItems = await getCollection('projects');
      projectTypes = await getDistinctValues('projects', 'type');
      projectGenres = await getDistinctValues('projects', 'genre');

      const hasFilteredTypes = projectTypes.some(type => filtersQuery[type] === 'on')
      if (hasFilteredTypes) {
        matchingItems = matchingItems.filter(item => filtersQuery[item.type] === 'on');
      }

      const hasFilteredGenres = projectGenres.some(genre => filtersQuery[genre] === 'on')
      if (hasFilteredGenres) {
        matchingItems = matchingItems.filter(item => filtersQuery[item.genre] === 'on');
      }

      const hasFilteredDirector = filtersQuery['director'];
      if (hasFilteredDirector) {
        // Includes is case sensitive https://www.reddit.com/r/learnjavascript/comments/qa5ur6/how_do_i_use_includes_and_tolowerccase_in_same_if/
        matchingItems = matchingItems.filter(item => item.director.toLowerCase().includes(filtersQuery['director'].toLowerCase()));
      }
    }


    // Alle sorteer opties
    if (filtersQuery['sort'] === 'a-z' || filtersQuery['sort'] === 'z-a') {
      const directionSort = filtersQuery['sort'] === 'a-z' ? 1 : -1;
      // sorteren op een volgorde, sort() https://www.freecodecamp.org/news/how-to-sort-alphabetically-in-javascript/
      // Uitleg video van sort met comparison function https://www.youtube.com/watch?v=CTHhlx25X-U
      matchingItems = matchingItems.sort((item1, item2) => {
        const aName = item1.name.toLowerCase();
        const bName = item2.name.toLowerCase();
        if (aName < bName) return -1 * directionSort;
        if (aName > bName) return 1 * directionSort;
        return 0;
      })
    }

    if (filtersQuery['sort'] === 'newest-first' || filtersQuery['sort'] === 'oldest-first') {
      const directionSort = filtersQuery['sort'] ? 1 : -1;

      matchingItems = matchingItems.sort((item1, item2) => {
        const aDate = item1.createdAt || item1.updatedAt;
        const bDate = item2.createdAt || item2.updatedAt;
        if (aDate < bDate) return 1 * directionSort;
        if (aDate > bDate) return -1 * directionSort;
        return 0;
      })
    }

    res.render('matching', {
      viewMode,
      filtersQuery,
      matchingItems,
      profileRoles,
      projectTypes,
      projectGenres,
      highestProfileAge,
      lowestProfileAge,
      highestExperience,
      lowestExperience
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Database has an error");
  }
});

// Home
app.get('/', async (req, res) => {
  try {
    const profiles = await getCollection('profiles');
    const projects = await getCollection('projects');
    const matchingItems = profiles.concat(projects);

    res.render('index', { matchingItems });
  } catch (error) {
    console.error(error);
    res.status(500).send("Database has an error");
  }
});