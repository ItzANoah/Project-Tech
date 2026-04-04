function openAddProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (modal) {
        modal.style.display = 'block';
        
        fetchDatabaseProjects(); 
    }
}

// Functie om de modal te sluiten
function closeAddProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

let allDbProjects = []; // Tijdelijke opslag voor database resultaten

async function fetchDatabaseProjects() {
    const list = document.getElementById('projectResultsList');
    try {
        const response = await fetch('/api/all-projects');
        allDbProjects = await response.json();
        displayResults(allDbProjects);
    } catch (err) {
        console.error("Fout bij ophalen projecten:", err);
        list.innerHTML = "<li>Kon projecten niet laden uit de database.</li>";
    }
}

function displayResults(projects) {
    const list = document.getElementById('projectResultsList');
    const inputIds = document.getElementById('inputSelectedProjectIds');
    const currentIds = inputIds.value ? inputIds.value.split(',') : [];

    // Filter projecten die al in de carrousel staan
    const filtered = projects.filter(p => !currentIds.includes(String(p._id)));

    if (filtered.length === 0) {
        list.innerHTML = "<li>Geen nieuwe projecten gevonden.</li>";
        return;
    }

    list.innerHTML = filtered.map(project => {
        const id = project._id;
        // Kijk of het project een 'name' of 'title' heeft
        const title = (project.name || project.title || 'Naamloos').replace(/'/g, "\\'");
        const director = (project.director || 'Onbekend').replace(/'/g, "\\'");
        const img = (project.images && project.images[0]) ? project.images[0] : '/img/placeholder.jpg';

        return `
            <li class="modal__item" onclick="selectProjectForCarousel('${id}', '${title}', '${director}', '${img}')">
                <img src="${img}" alt="${title}">
                <div>
                    <strong>${title}</strong>
                    <p>Regie: ${director}</p>
                </div>
            </li>
        `;
    }).join('');
}

async function searchProjects(query) {
    const list = document.getElementById('projectResultsList');
    
    if (query.length < 2) {
        list.innerHTML = "<li>Typ minstens 2 letters om te zoeken...</li>";
        return;
    }

    try {
        let response;
        if (currentTab === 'db') {
            // Zoeken in eigen database
            response = await fetch(`/api/all-projects`);
            const allProjects = await response.json();
            // Filter lokaal op titel
            const filtered = allProjects.filter(p => 
                (p.title || "").toLowerCase().includes(query.toLowerCase())
            );
            displayResults(filtered);
        } else {
            // Zoeken in TMDB via de server
            list.innerHTML = "<li>Zoeken in TMDB...</li>";
            response = await fetch(`/api/search-tmdb?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            displayResults(results);
        }
    } catch (err) {
        console.error("Zoekfout:", err);
        list.innerHTML = "<li>Er ging iets mis bij het zoeken.</li>";
    }
}

function selectProjectForCarousel(id, title, director, imageUrl, bio) {
    const inputIds = document.getElementById('inputSelectedProjectIds');
    const carouselList = document.getElementById('directorProjectsCarousel');

    // 1. Voeg ID toe aan hidden input
    let currentIds = inputIds.value ? inputIds.value.split(',').filter(i => i !== "") : [];
    if (!currentIds.includes(id)) {
        currentIds.push(id);
        inputIds.value = currentIds.join(',');
    }

    // 2. Maak het kaartje (EXACT dezelfde structuur als EJS)
    const newListItem = document.createElement('li');
    newListItem.className = 'carousel__list-Item';
    
    // We korten de bio in voor het kaartje (max 60 tekens)
    const shortBio = bio ? bio.substring(0, 60) + '...' : 'Geen beschrijving beschikbaar.';

    // de innnerhtml is voor in de wijzig profiel modus om het kaartje te zien
    // daarna neemt projectenCarouselCard.ejs het over als je op de lees versie van de site zit.
    newListItem.innerHTML = `
        <div class="matching__card" data-id="${id}">
            <button type="button" class="delete-project-btn" style="display: block;" onclick="removeProjectFromCarousel('${id}')">&times;</button>
            
            <div class="matching__card-image-container">
                ${imageUrl && imageUrl !== '/img/placeholder.jpg' 
                    ? `<img src="${imageUrl}" alt="${title}" class="matching__image">` 
                    : `<div class="matching__image-placeholder"></div>`
                }
            </div>

            <div class="matching__card-content">
                <h3 class="matching__card-title">${title}</h3>
                <p class="matching__card-subtitle">${director}</p>
                <p class="matching__card-description">${shortBio}</p>
            </div>
        </div>
    `;

    carouselList.appendChild(newListItem);
    closeAddProjectModal();
    
    showCustomAlert(`Project "${title}" is succesvol toegevoegd! Vergeet niet de pagina op te slaan.`);
}

// Functie om een project uit de selectie te halen (werkt alleen lokaal tot je op 'Opslaan' drukt)
function removeProjectFromCarousel(id) {
    // Zoek de hidden input met alle ID's
    const inputIds = document.getElementById('inputSelectedProjectIds');
    if (!inputIds) return;

    // Haal de huidige lijst op en filter het ID eruit
    let currentIds = inputIds.value.split(',').filter(itemId => itemId !== "" && itemId !== id);
    
    // Update de hidden input met de nieuwe lijst 
    inputIds.value = currentIds.join(',');

    // Verwijder het kaartje visueel van het scherm
    const cardElement = document.querySelector(`.matching__card[data-id="${id}"]`);
    if (cardElement) {
        // We verwijderen het ouder-element, de <li>
        cardElement.parentElement.remove();
    }
    
    console.log("Project verwijderd. Nieuwe lijst:", inputIds.value);
}


document.addEventListener('DOMContentLoaded', () => {
    // Sluiten bij klik buiten het venster
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('addProjectModal');
        if (event.target === modal) {
            closeAddProjectModal();
        }
    });

});


let currentTab = 'db'; // We houden bij op welke tab we zitten
// automatisch onze database

async function switchTab(tab) {
    currentTab = tab;
    
    // Visuele feedback voor de tabs
    // alle knoppen selecteren vervolgens de class weghalen en alleen de aangeklikte knop highlighten
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const list = document.getElementById('projectResultsList');
    const searchInput = document.getElementById('modalSearchInput');
    
    list.innerHTML = ""; // Maak de lijst leeg bij het switchen
    searchInput.value = ""; // Reset het zoekveld
    
    // Als we naar 'db' gaan, laden we direct alle eigen projecten
    if (tab === 'db') {
        fetchDatabaseProjects(); 
    }
}