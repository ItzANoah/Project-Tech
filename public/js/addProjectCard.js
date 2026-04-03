document.addEventListener('DOMContentLoaded', () => {
    const addProjectModal = document.getElementById('add-project-modal');
    const addBtn = document.querySelector('.add-btn');
    const closeAddModal = document.getElementById('close-add-modal');
    const formContainer = document.getElementById('add-project-form-container');

    // Open de modal
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            formContainer.innerHTML = '<p>Kies hierboven een optie.</p>'; 
            addProjectModal.style.display = 'block';
        });
    }

    // Sluit de modal
    if (closeAddModal) {
        closeAddModal.onclick = () => addProjectModal.style.display = 'none';
    }

    // --- OPTIE 1: Filmcrew Database Zoeken ---
    document.getElementById('btnFlmCrw')?.addEventListener('click', () => {
        formContainer.innerHTML = `
            <div class="manual-form">
                <h3>Zoek in Filmcrew Database</h3>
                <div style="position: relative;">
                    <input type="text" id="db-search-input" placeholder="Typ de titel van de film..." autocomplete="off" class="edit-input">
                    <ul id="db-search-results" class="search-dropdown"></ul>
                </div>
                <div id="selected-project-confirm" style="display:none; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                    <h4 id="confirm-title" style="margin-bottom:10px; color: #f1c40f;"></h4>
                    <label>Wat was jouw rol in dit project? *</label>
                    <input type="text" id="user-role-input" placeholder="Bijv. Cameraman of Editor" class="edit-input">
                    <input type="hidden" id="selected-project-id">
                    <button type="button" id="final-add-db-btn" class="admin-toggle-btn" style="position: static; width: 100%; margin-top: 10px;">
                        Project toevoegen aan profiel
                    </button>
                </div>
            </div>
        `;
        setupDbSearchLogic();
    });

    // --- OPTIE 2: Handmatig Toevoegen ---
    document.getElementById('btn-manual')?.addEventListener('click', () => {
        formContainer.innerHTML = `
            <form class="manual-form" id="actual-manual-form" enctype="multipart/form-data">
                <h3>Handmatig project toevoegen</h3>
                <label>Project Titel *</label>
                <input type="text" id="new-title" class="edit-input" required>
                <label>Type Project *</label>
                <input type="text" id="new-type" class="edit-input" placeholder="Bijv. Korte film" required>
                <label>Jouw Rol *</label>
                <input type="text" id="new-role" class="edit-input" placeholder="Bijv. Editor" required>
                <label>Project Foto</label>
                <input type="file" id="new-img" accept="image/*" class="edit-input">
                <label>Beschrijving *</label>
                <textarea id="new-desc" class="edit-input" rows="4" required></textarea>
                <button type="submit" class="admin-toggle-btn" style="position: static; margin-top: 1em; width: 100%;">
                    Project Toevoegen
                </button>
            </form>
        `;

        document.getElementById('actual-manual-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveManualProject();
        });
    });

    // --- OPTIE 3: API Zoeken (The Movie Database) ---
    // Let op: 'btnApi' moet exact zo in je HTML staan!
    document.getElementById('btnApi')?.addEventListener('click', () => {
        formContainer.innerHTML = `
            <div class="manual-form">
                <h3>Zoek in Wereldwijde Database (API)</h3>
                <div style="position: relative;">
                    <input type="text" id="api-search-input" placeholder="Typ een filmtitel..." autocomplete="off" class="edit-input">
                    <ul id="api-search-results" class="search-dropdown"></ul>
                </div>
                <div id="selected-api-confirm" style="display:none; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <img id="api-confirm-poster" src="" style="width: 80px; border-radius: 4px;">
                        <div>
                            <h4 id="api-confirm-title" style="color: #f1c40f;"></h4>
                            <p id="api-confirm-year" style="font-size: 0.8em; color: gray;"></p>
                        </div>
                    </div>
                    <label>Jouw Rol in dit project? *</label>
                    <input type="text" id="api-user-role" placeholder="Bijv. Production Design" class="edit-input">
                    
                    <input type="hidden" id="api-data-title">
                    <input type="hidden" id="api-data-desc">
                    <input type="hidden" id="api-data-img">

                    <button type="button" id="final-add-api-btn" class="admin-toggle-btn" style="position: static; width: 100%; margin-top: 10px;">
                        Film importeren & toevoegen
                    </button>
                </div>
            </div>
        `;
        setupApiSearchLogic();
    });
});

// --- ONDERSTEUNENDE FUNCTIES (BUITEN DE DOMContentLoaded) ---

function setupDbSearchLogic() {
    const input = document.getElementById('db-search-input');
    const resultsUl = document.getElementById('db-search-results');
    const confirmDiv = document.getElementById('selected-project-confirm');

    if (!input) return;

    input.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            resultsUl.innerHTML = '';
            return;
        }

        const response = await fetch(`/search-db-projects?q=${query}`);
        const data = await response.json();

        resultsUl.innerHTML = '';
        data.forEach(project => {
            const li = document.createElement('li');
            li.className = "search-result-item"; // Handig voor styling
            li.style.padding = "10px";
            li.style.borderBottom = "1px solid #eee";
            li.style.cursor = "pointer";
            li.textContent = `${project.name} (Regie: ${project.director || 'Onbekend'})`;
            
            li.onclick = () => {
                input.value = project.name;
                resultsUl.innerHTML = '';
                document.getElementById('confirm-title').innerText = "Geselecteerd: " + project.name;
                document.getElementById('selected-project-id').value = project._id;
                confirmDiv.style.display = 'block';
            };
            resultsUl.appendChild(li);
        });
    });

    document.getElementById('final-add-db-btn')?.addEventListener('click', confirmAddDbProject);
}

function setupApiSearchLogic() {
    const input = document.getElementById('api-search-input');
    const resultsUl = document.getElementById('api-search-results');
    const confirmDiv = document.getElementById('selected-api-confirm');

    if (!input) return;

    input.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 3) {
            resultsUl.innerHTML = '';
            return;
        }

        const response = await fetch(`/search-api-projects?q=${query}`);
        const data = await response.json();

        resultsUl.innerHTML = '';
        data.forEach(movie => {
            const li = document.createElement('li');
            li.style.padding = "10px";
            li.style.borderBottom = "1px solid #eee";
            li.style.cursor = "pointer";
            li.innerHTML = `<strong>${movie.title}</strong> (${movie.year})`;
            
            li.onclick = () => {
                input.value = movie.title;
                resultsUl.innerHTML = '';
                
                document.getElementById('api-confirm-title').innerText = movie.title;
                document.getElementById('api-confirm-year').innerText = movie.year;
                document.getElementById('api-confirm-poster').src = movie.poster;
                
                document.getElementById('api-data-title').value = movie.title;
                document.getElementById('api-data-desc').value = movie.overview;
                document.getElementById('api-data-img').value = movie.poster;
                
                confirmDiv.style.display = 'block';
            };
            resultsUl.appendChild(li);
        });
    });

    document.getElementById('final-add-api-btn')?.addEventListener('click', async () => {
        const role = document.getElementById('api-user-role').value;
        if (!role) return alert("Vul je rol in!");

        const movieData = {
            title: document.getElementById('api-data-title').value,
            description: document.getElementById('api-data-desc').value,
            image: document.getElementById('api-data-img').value,
            role: role,
            type: 'Film'
        };

        const response = await fetch('/add-api-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movieData)
        });

        if (response.ok) location.reload();
        else alert("Fout bij importeren.");
    });
}

// Hulpsuncties voor opslaan
async function confirmAddDbProject() {
    const projectId = document.getElementById('selected-project-id').value;
    const userRole = document.getElementById('user-role-input').value;
    if (!userRole) return alert("Vul a.u.b. je rol in.");

    const response = await fetch('/add-existing-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userRole })
    });
    if (response.ok) location.reload();
}

async function saveManualProject() {
    const formData = new FormData();
    formData.append('title', document.getElementById('new-title').value);
    formData.append('type', document.getElementById('new-type').value);
    formData.append('role', document.getElementById('new-role').value);
    formData.append('contribution', document.getElementById('new-desc').value);
    
    const fileInput = document.getElementById('new-img');
    if (fileInput.files[0]) formData.append('projectImage', fileInput.files[0]);

    const response = await fetch('/add-project-manual', {
        method: 'POST',
        body: formData
    });
    if (response.ok) location.reload();
}