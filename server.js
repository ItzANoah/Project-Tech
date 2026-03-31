const express = require('express');
const fs = require('fs');
const app = express();
const port = 4000;
const session = require('express-session');
// const multer = require('multer');

app.use(express.urlencoded({ extended: true }))
app.use(express.static("static"));
app.set('view engine', 'ejs');
app.set('views', './views');

require('dotenv').config(); // MOET bovenaan staan voor de database link!
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const path = require('path');
const {query} = require("express"); // Ingebouwd in Node, hoef je niet te installeren
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
      let directionSort;
      if (filtersQuery['sort'] === 'a-z') {
        directionSort = 1;
      } else {
        directionSort = -1;
      }
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
      let directionSort;
      if (filtersQuery['sort'] === 'newest-first') {
        directionSort = 1;
      } else {
        directionSort = -1;
      }

      matchingItems = matchingItems.sort((item1, item2) => {
        const newest = item1.createdAt;
        const oldest = item2.createdAt;
        if (newest < oldest) return 1 * directionSort;
        if (newest > oldest) return -1 * directionSort;
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
    res.render('index', { profiles });
  } catch (error) {
    console.error(error);
    res.status(500).send("Database has an error");
  }
});