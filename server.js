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

// --- MULTER CONFIGURATIE (Moet BOVEN de routes staan) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, req.session.username + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- PROJECT ROUTES ---

// De gecombineerde update route (Slechts 1x nodig!)
app.post('/update-project-details', checkInlog, upload.fields([
    { name: 'projectImage', maxCount: 1 },
    { name: 'galerijImages', maxCount: 10 }
]), async (req, res) => {
    try {
        const { projectId, title, type, contribution, genres, existingImages } = req.body;
        const { ObjectId } = require('mongodb');

        // Haal het huidige project op om te kijken wat de huidige hoofdfoto is
        const currentProject = await projectsCollection.findOne({ _id: new ObjectId(projectId) });
        
        // 1. Bepaal de (nieuwe) hoofdfoto
        let finalMainImage = currentProject.mainImage || currentProject.image; 
        if (req.files['projectImage']) {
            finalMainImage = '/uploads/' + req.files['projectImage'][0].filename;
        }

        // 2. Bepaal de galerij (zorg dat de hoofdfoto hier NOOIT in terecht komt)
        let updatedGalerij = JSON.parse(existingImages || "[]");
        
        // Voeg nieuwe galerij uploads toe
        if (req.files['galerijImages']) {
            req.files['galerijImages'].forEach(file => {
                const path = '/uploads/' + file.filename;
                updatedGalerij.push(path);
            });
        }

        // FILTER: Verwijder de hoofdfoto uit de galerij-array als hij daar per ongeluk in staat
        updatedGalerij = updatedGalerij.filter(img => img !== finalMainImage);

        const updateData = {
            name: title, title: title,
            type: type,
            bio: contribution, description: contribution,
            genres: JSON.parse(genres),
            mainImage: finalMainImage,
            image: finalMainImage, // Voor de zekerheid voor beide naamgevingen
            images: updatedGalerij  // De schone galerij zonder de hoofdfoto
        };

        await projectsCollection.updateOne(
            { _id: new ObjectId(projectId) },
            { $set: updateData }
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error("Fout bij opslaan:", err);
        res.status(500).json({ success: false });
    }
});

app.post('/upload-pfp', checkInlog, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('Geen bestand geüpload.');
    const imagePath = '/uploads/' + req.file.filename;
    await profileCollection.updateOne(
        { name: req.session.username },
        { $set: { image: imagePath } }
    );
    res.json({ success: true, newImagePath: imagePath });
  } catch (err) {
    res.status(500).send('Fout bij uploaden');
  }
});

app.post('/add-project-manual', checkInlog, upload.single('projectImage'), async (req, res) => {
  try {
    const { title, type, contribution, role } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : '/images/projectPlaceholder.png';

    const newProject = { 
      title, 
      name: title, // Voor DB-compatibiliteit
      type, 
      description: contribution, 
      bio: contribution, // Voor DB-compatibiliteit
      role: role,
      mainImage: imagePath, // Dit is de ENIGE plek voor de hoofdfoto
      images: [],           // De galerij begint LEEG
      genres: [role || type], 
      createdAt: new Date() 
    };
    
    const projectResult = await projectsCollection.insertOne(newProject);
    await profileCollection.updateOne(
      { name: req.session.username },
      { $push: { myProjects: projectResult.insertedId } }
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/delete-project', checkInlog, async (req, res) => {
    try {
        const { projectId } = req.body;
        const { ObjectId } = require('mongodb');
        await projectsCollection.deleteOne({ _id: new ObjectId(projectId) });
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
        const results = await projectsCollection.find({
            name: { $regex: query, $options: 'i' }
        }).limit(5).toArray();
        res.json(results);
    } catch (err) {
        res.status(500).json([]);
    }
});

app.post('/add-existing-project', checkInlog, async (req, res) => {
    try {
        const { projectId, userRole } = req.body;
        const { ObjectId } = require('mongodb');
        await profileCollection.updateOne(
            { name: req.session.username },
            { $addToSet: { myProjects: new ObjectId(projectId) } }
        );
        await projectsCollection.updateOne(
            { _id: new ObjectId(projectId) },
            { $addToSet: { genres: userRole } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Route voor het bekijken van iemands publieke profiel
app.get('/profiel/:username', async (req, res) => {
    try {
        const targetUsername = req.params.username;
        
        // Zoek de gebruiker op basis van de naam in de URL
        const user = await profileCollection.findOne({ name: targetUsername });

        if (!user) {
            return res.status(404).send("Gebruiker niet gevonden");
        }

        // Haal de projecten van deze gebruiker op
        const projects = await projectsCollection.find({ 
            _id: { $in: user.myProjects || [] } 
        }).toArray();

        // Render een NIEUWE ejs file: public-profile.ejs
        res.render('publicProfielPaginaIndividueel', { 
            theUser: user, 
            projects: projects 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server fout");
    }
});

// --- OVERIGE PAGINA'S ---

app.get('/crew-profile', (req, res) => {
  res.render('crew-profile', {
    projectImages: ["/images/placeholder-hero.jpg", "/images/cameraman.png"],
    projectTags: ["Sci-Fi", "Action", "Thriller"]
  });
});

app.get('/current-matches', checkInlog, async (req, res) => {
  res.render('current-matches');
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await profileCollection.findOne({ name: username });
    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.session.userID = user._id;
        req.session.username = user.name;
        return res.redirect('/current-matches');
      }
    }
    return res.render('login', { error: 'Onjuiste gebruikersnaam of wachtwoord' });
  } catch (err) {
    res.status(500).send("Serverfout.");
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});
