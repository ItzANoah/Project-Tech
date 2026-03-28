const express = require('express');
const fs = require('fs');
const app = express();
const port = 4000;
const session = require('express-session');
const multer = require('multer');

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

app.get('/profielPaginaIndividueel', (req, res) => {
  res.render('profielPaginaIndividueel');
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



const getProfiles = async () => {
  const database = client.db("filmcrew");
  return await database.collection("profiles").find().toArray();
}

// destinct() https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/
const getProfileTypes = async () => {
  const database = client.db("filmcrew");
  return await database.collection("profiles").distinct('type');
}

const getProfileGenres = async () => {
  const database = client.db("filmcrew");
  return await database.collection("profiles").distinct('genres');
}

// Find() alleen op een specifieke key https://www.geeksforgeeks.org/mongodb/mongodb-check-the-existence-of-the-fields-in-the-specified-collection/
const getMinOrMaxValue = async (key, sort) => {
  const database = client.db("filmcrew");
  const minOrMaxDocument = await database.collection('profiles')
    .find({[key]: {$exists: true}})
    .sort({[key]: sort})
    .toArray();

  return minOrMaxDocument[0][key];
}

// Matching
app.get('/matching', async (req, res) => {
  try {
    const profiles = await getProfiles();
    const profileTypes = await getProfileTypes();
    const profileGenres = await getProfileGenres();
    const highestProfileAge = await getMinOrMaxValue('age', -1);
    const lowestProfileAge = await getMinOrMaxValue('age', 1);
    const highestExperience = await getMinOrMaxValue('experience', -1);
    const lowestExperience = await getMinOrMaxValue('experience', 1);
    res.render('matching', {
      profiles,
      profileTypes,
      profileGenres,
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
    const profiles = await getProfiles();
    res.render('index', { profiles });
  } catch (error) {
    console.error(error);
    res.status(500).send("Database has an error");
  }
});