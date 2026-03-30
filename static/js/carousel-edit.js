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
    if (!list) return;

    if (projects.length === 0) {
        list.innerHTML = "<li>Geen projecten gevonden.</li>";
        return;
    }

    list.innerHTML = projects.map(project => {
        // GEBRUIK DIT: we checken eerst of de waarde bestaat voordat we .replace doen
        const id = project._id;
        const title = (project.title || 'Naamloze film').replace(/'/g, "\\'");
        const director = (project.director || 'Onbekend').replace(/'/g, "\\'");
        const img = (project.images && project.images[0]) ? project.images[0] : '/img/placeholder.jpg';

        return `
            <li class="modal__item" onclick="selectProjectForCarousel('${id}', '${title}', '${director}', '${img}')">
                <img src="${img}" alt="${title}">
                <div>
                    <strong>${title}</strong>
                    <p style="font-size: 0.8rem; color: #666;">Regie: ${director}</p>
                </div>
            </li>
        `;
    }).join('');
}

function searchProjects(query) {
    const filtered = allDbProjects.filter(p => {
        // Zorg dat p.title bestaat voordat je toLowerCase doet
        const title = p.title || ""; 
        return title.toLowerCase().includes(query.toLowerCase());
    });
    displayResults(filtered);
}

function selectProjectForCarousel(id, title, director, imageUrl) {
    console.log("Project geselecteerd:", title);
    
    // 1. Zoek de juiste carrousel en de hidden input
    const carouselList = document.getElementById('directorProjectsCarousel');
    const inputIds = document.getElementById('inputSelectedProjectIds');

    if (!carouselList) {
        console.error("Fout: Kon carrousel #directorProjectsCarousel niet vinden.");
        return;
    }

    // 2. Visueel toevoegen aan de carrousel (HTML structuur)
    const newListItem = document.createElement('li');
    newListItem.className = 'carousel__list-Item';
    newListItem.innerHTML = `
        <div class="matching__card">
            <img src="${imageUrl}" alt="${title}" class="matching__image">
            <div class="matching__card-content">
                <h3 class="matching__card-title">${title}</h3>
                <p class="matching__card-director">Regie: ${director}</p>
                <p class="matching__card-text">Nieuw toegevoegd project.</p>
            </div>
            <div class="matching__card-link">
                <a href="/project/${id}">Ga naar project</a>
            </div>
        </div> 
    `;
    
    // Voeg toe aan het einde van de lijst
    carouselList.appendChild(newListItem);

    // 3. ID opslaan in de hidden input (Optie B)
    if (inputIds) {
        let currentIds = inputIds.value ? inputIds.value.split(',') : [];
        if (!currentIds.includes(id)) {
            currentIds.push(id);
            inputIds.value = currentIds.join(',');
            console.log("ID toegevoegd aan hidden input:", inputIds.value);
        }
    }

    // 4. Sluit de modal
    closeAddProjectModal();
}

/**
 * EVENT LISTENERS
 */

document.addEventListener('DOMContentLoaded', () => {
    // Sluiten bij klik buiten het venster
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('addProjectModal');
        if (event.target === modal) {
            closeAddProjectModal();
        }
    });

    // Eventuele andere carrousel initialisaties kunnen hier
});

/**
 * TAB LOGICA
 */
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    
    // Maak de huidige tab visueel actief
    event.currentTarget.classList.add('active');

    const list = document.getElementById('projectResultsList');
    if (tab === 'db') {
        fetchDatabaseProjects();
    } else {
        list.innerHTML = "<li class='modal__placeholder'>TMDB koppeling is de volgende stap!</li>";
    }
}