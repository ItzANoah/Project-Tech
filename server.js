const express = require('express');
const fs = require('fs');
const app = express();
const port = 4000;
const session = require('express-session');
const multer = require('multer');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

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
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const path = require('path'); // Ingebouwd in Node, hoef je niet te installeren
//casper was hier//

// Database connectie variabelen
const uri = process.env.URI;
const client = new MongoClient(uri);


/////////////// register functie ////////////////
let profileCollection;
let matchRequestcollection; 

async function run() {
  try {
    await client.connect();
    const db = client.db("filmcrew");

    profileCollection = db.collection("profiles"); 
    matchRequestcollection = db.collection("verzoeken"); 
    
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

    // Wachtwoord versleutelen, voor deze keer geen variabele van de saltrounds gemaakt omdat het maar 1 keer gebruikt wordt.
    const hashedPassword = await bcrypt.hash(password, 10);

    // volledige profiel
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
    // controleren met de username of de verzoeken voor de gebruiker zijn die is ingelogd
    const matchdata = await matchRequestcollection.find({ 
      receiverId: req.session.userID,
      status: "pending" 
    }).sort({ timestamp: -1 }).toArray(); //sorteren op nieuwste
     // voor elke match zoeken we van de senderID de username op in de DB.
   

    let showNotification = false;
    if (matchdata.length > 0) {
      const nu = new Date();
      const tweeDagenGeleden = new Date(nu.setDate(nu.getDate() - 2));
      const nieuwsteMatchDatum = new Date(matchdata[0].timestamp);

      if (nieuwsteMatchDatum > tweeDagenGeleden) {
        showNotification = true;
      }
    }
    const matchesMetNamen = await Promise.all(matchdata.map(async (match) => {
      const afzender = await profileCollection.findOne({ 
        _id: new ObjectId(match.senderId)
    });
      console.log("Afzender gevonden in DB:", afzender); // om te checken of ik die naam wel kan vinden
    
      return {
        ...match,
        senderName: afzender ? (afzender.name) : "Onbekend"
      };
    }));
    res.render('current-matches', { 
      matches: matchesMetNamen,
      hasNewRequests: showNotification
    });
    
  } catch (error) {
    console.error("Fout bij het ophalen van matches:", error);
    res.status(500).send("Kon de matches niet laden.");
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
