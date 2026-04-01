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
app.use(express.json()); 

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
let projectsCollection;

async function run() {
  try {
    await client.connect();
    const db = client.db("filmcrew");

    profileCollection = db.collection("profiles"); 
    projectsCollection = db.collection("projects");
    console.log("Database verbinding succesvol voor profielen en projecten!");
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

// profielpagina individueel
// ROUTE 1: De pagina bekijken
app.get('/profielPaginaIndividueel', checkInlog, async (req, res) => {
  try {
    const user = await profileCollection.findOne({ name: req.session.username });

    if (user) {
      // HAAL HIER DE PROJECTEN OP
      // We zoeken alle projecten waarvan het ID in de 'myProjects' lijst van de user staat
      const userProjects = await projectsCollection.find({ 
        _id: { $in: user.myProjects || [] } 
      }).toArray();

      res.render('profielPaginaIndividueel', { 
        theUser: user, 
        projects: userProjects // Geef de echte projecten mee aan EJS!
      });
    } else {
      res.status(404).send("Gebruiker niet gevonden.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server fout");
  }
});

// ROUTE 2: De data opslaan (vangen van de fetch)
app.post('/update-profile', checkInlog, async (req, res) => {
  try {
    const { name, role, bio, skills } = req.body;
    const oldName = req.session.username; // De naam waarmee je bent ingelogd

    // VEILIGHEID: Als de naam leeg is, stop dan direct!
    if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Naam mag niet leeg zijn" });
    }

    await profileCollection.updateOne(
      { name: oldName }, 
      { $set: { name, role, bio, skills } }
    );

    // We updaten de sessie alleen als de naam echt veranderd is
    req.session.username = name;

    res.json({ success: true });
  } catch (err) {
    console.error("Fout bij opslaan:", err);
    res.status(500).json({ success: false });
  }
});

// Instellen waar foto's worden opgeslagen
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Mapje waar de foto's komen
  },
  filename: (req, file, cb) => {
    // Geef het bestand een unieke naam: gebruikersnaam-datum.jpg
    cb(null, req.session.username + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// De ROUTE voor het uploaden van de foto
app.post('/upload-pfp', checkInlog, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('Geen bestand geüpload.');

    const imagePath = '/uploads/' + req.file.filename;

    // Opslaan in de database bij de huidige gebruiker
    await profileCollection.updateOne(
        { name: req.session.username },
        { $set: { image: imagePath } }
    );

    res.json({ success: true, newImagePath: imagePath });
  } catch (err) {
    res.status(500).send('Fout bij uploaden');
  }
});

// Projecten toevoegen
app.post('/add-existing-project', checkInlog, async (req, res) => {
    try {
        const { projectId } = req.body;
        const { ObjectId } = require('mongodb');

        await profileCollection.updateOne(
            { name: req.session.username },
            { $addToSet: { myProjects: new ObjectId(projectId) } } // $addToSet voorkomt dubbel toevoegen
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Route voor handmatig toevoegen INCLUSIEF foto en tags
app.post('/add-project-manual', checkInlog, upload.single('projectImage'), async (req, res) => {
  try {
    const { title, type, contribution, role } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : '/images/projectPlaceholder.png';

    const newProject = { 
      title, 
      type, 
      description: contribution, 
      role: role,
      mainImage: imagePath,
      genres: [role || type], // Voegt de rol standaard toe als tag
      createdAt: new Date() 
    };
    
    const projectResult = await projectsCollection.insertOne(newProject);
    await profileCollection.updateOne(
      { name: req.session.username },
      { $push: { myProjects: projectResult.insertedId } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Route voor het bijwerken van een project (titel, tekst, tags)
app.post('/update-project-details', checkInlog, upload.single('projectImage'), async (req, res) => {
    try {
        const { projectId, title, type, contribution, genres } = req.body;
        const { ObjectId } = require('mongodb');

        const updateData = {
            title: title,
            type: type,
            description: contribution,
            genres: JSON.parse(genres) // We sturen het als string, dus hier even terug naar array
        };

        // Als er een nieuwe foto is geüpload, voeg die toe aan de update
        if (req.file) {
            updateData.mainImage = '/uploads/' + req.file.filename;
        }

        await projectsCollection.updateOne(
            { _id: new ObjectId(projectId) },
            { $set: updateData }
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.post('/delete-project', checkInlog, async (req, res) => {
    try {
        const { projectId } = req.body;
        const { ObjectId } = require('mongodb');

        // 1. Verwijder het project uit de projects collectie
        await projectsCollection.deleteOne({ _id: new ObjectId(projectId) });

        // 2. Verwijder het ID uit de lijst van de gebruiker
        await profileCollection.updateOne(
            { name: req.session.username },
            { $pull: { myProjects: new ObjectId(projectId) } }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/search-db-projects', checkInlog, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        // Zoek films waarbij de naam de letters bevat (case-insensitive)
        const results = await projectsCollection.find({
            name: { $regex: query, $options: 'i' }
        }).limit(5).toArray();

        res.json(results);
    } catch (err) {
        res.status(500).json([]);
    }
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

