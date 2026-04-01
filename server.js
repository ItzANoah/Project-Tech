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

        // 1. Haal het hoofdproject op
        const project = await db.collection('projects').findOne({}) || {};

        // 2. Haal de filters op voor de tags
        const projectFilters = await db.collection('filters').find({}).toArray();

        // 3. Haal de gerelateerde projecten op (Carousel 1)
        let directorProjects = [];
        
        if (project.relatedProjects && project.relatedProjects.length > 0) {
            const dbIds = [];
            const tmdbIds = [];

            // Splits de opgeslagen ID's: begint het met 'tmdb_' of is het een MongoDB ID?
            project.relatedProjects.forEach(id => {
                if (id && id.startsWith('tmdb_')) {
                    tmdbIds.push(id.replace('tmdb_', '')); // Haal 'tmdb_' eraf voor de API call
                } else if (id && id.length === 24) {
                    dbIds.push(new ObjectId(id));
                }
            });

            // A. Haal eigen projecten op uit MongoDB
            const localResults = await db.collection('projects')
                .find({ _id: { $in: dbIds } })
                .toArray();

            // B. Haal TMDB projecten op via de API
            const tmdbResults = await Promise.all(tmdbIds.map(async (id) => {
                try {
                    const resp = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=nl-NL`);
                    if (!resp.ok) return null;
                    
                    const movie = await resp.json();
                    
                    // We vormen de data om zodat EJS dezelfde velden ziet als bij lokale projecten
                    return {
                        _id: `tmdb_${movie.id}`,
                        name: movie.title,
                        subtitle: movie.release_date ? movie.release_date.split('-')[0] : 'Film',
                        images: [movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ''],
                        bio: movie.overview
                    };
                } catch (e) {
                    console.error("Fout bij ophalen TMDB film:", id);
                    return null;
                }
            }));

            // Voeg beide lijsten samen en filter eventuele fouten (null) eruit
            directorProjects = [...localResults, ...tmdbResults.filter(p => p !== null)];
        }

        // 4. Haal de crew op (Carousel 2)
        const crewMembers = await db.collection('crew')
            .find({ project_id: project._id })
            .toArray();

        // 5. Haal open sollicitaties op (Carousel 3)
        const openJobs = await db.collection('vacancies')
            .find({ status: 'open' })
            .toArray();

        // 6. Render de pagina met alle verzamelde data
        res.render('crew-profile', {
            projectData: project,
            projectImages: project.images || [],
            projectFilters: projectFilters || [],
            directorProjects: directorProjects, // De gecombineerde lijst
            crewProjects: crewMembers || [],
            applications: openJobs || []
        });

    } catch (error) {
        console.error("Fout bij ophalen profiel/project:", error);
        res.status(500).send("Fout bij laden profiel");
    }
});

app.post('/save-project', upload.array('projectImages'), async (req, res) => {
    try {
        const db = client.db('filmcrew');

        // --- DEEL 1: PROJECT UPDATEN ---
        let remainingImages = [];
        if (req.body.remainingImages) {
            remainingImages = req.body.remainingImages.split(',').filter(path => path !== "");
        }
        const newUploads = req.files.map(file => `/uploads/${file.filename}`);
        const finalImagesList = [...remainingImages, ...newUploads];

        const updatedProject = {
            name: req.body.title, // Je input in EJS heet 'title', dus gebruik req.body.title
            subtitle: req.body.subtitle,
            bio: req.body.description, // Je input heet 'description'
            images: finalImagesList,
            productionDescription: req.body.productionDescription,
            relatedProjects: req.body.relatedProjects ? req.body.relatedProjects.split(',') : [], 
            updatedAt: new Date()
        };

        await db.collection('projects').updateOne({}, { $set: updatedProject }, { upsert: true });

        // --- DEEL 2: NIEUWE APPLICATIES OPSLAAN (HET MISSENDE STUK) ---
        if (req.body.newAppTitles) {
            // Zorg dat het altijd een array is
            const titles = Array.isArray(req.body.newAppTitles) ? req.body.newAppTitles : [req.body.newAppTitles];
            const descs = Array.isArray(req.body.newAppDescs) ? req.body.newAppDescs : [req.body.newAppDescs];

            const applicationObjects = titles.map((title, index) => ({
                title: title,
                description: descs[index],
                status: 'open',
                createdAt: new Date()
            }));

            // Voeg ze toe aan de collectie 'vacancies'
            await db.collection('vacancies').insertMany(applicationObjects);
        }

        // --- DEEL 3: VERWIJDEREN VAN APPLICATIES ---
        if (req.body.removeAppIds) {
            const idsToRemove = Array.isArray(req.body.removeAppIds) ? req.body.removeAppIds : [req.body.removeAppIds];
            const objectIds = idsToRemove.map(id => new ObjectId(id));
            await db.collection('vacancies').deleteMany({ _id: { $in: objectIds } });
        }

        res.redirect('/crew-profile');
    } catch (error) {
        console.error("Opslaan mislukt:", error);
        res.status(500).send("Fout bij opslaan");
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
        timestamp: new Date() // Maakt automatisch de $date aan
    };

    await db.collection('user_connections').insertOne(newApplication);
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
