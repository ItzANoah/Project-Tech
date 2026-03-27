const express = require('express');
const fs = require('fs');
const app = express();
const port = 4000;
const session = require('express-session');

app.use(session({
  secret: 'redbullgeeftjevleugels', // willekeurige lange zin
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Zet op true als je https gebruikt, maar op localhost is false prima
    maxAge: 3600000 // Hoe lang de cookie geldig is (1 uur)
  }
}));
app.use(express.urlencoded({ extended: true }))
app.use(express.static("static"));
app.set('view engine', 'ejs');
app.set('views', './views');

require('dotenv').config(); // MOET bovenaan staan voor de database link!
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const path = require('path'); // Ingebouwd in Node, hoef je niet te installeren


// Database connectie variabelen
const uri = process.env.URI;
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log("Succesvol verbonden met MongoDB via MongoClient");
    } catch (error) {
        console.error("Database verbinding mislukt:", error);
    }
}
connectDB();

// Middleware instellen
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-geheim',
  resave: false,
  saveUninitialized: false
}));

app.listen(port, () => {
    console.log(`Server draait op http://localhost:${port}`);
});
app.get('/register', (req, res) => {
  res.render('register');
});
app.get('/register2', (req, res) => {
  res.render('register2');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/profielPaginaIndividueel', (req, res) => {
  res.render('profielPaginaIndividueel');
});

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

app.get('/current-matches', (req, res) => {
  res.render('current-matches');
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