document.addEventListener('DOMContentLoaded', () => {
    const addProjectModal = document.getElementById('add-project-modal');
    const addBtn = document.querySelector('.add-btn');
    const closeAddModal = document.getElementById('close-add-modal');
    const formContainer = document.getElementById('add-project-form-container');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            formContainer.innerHTML = '<p>Kies hierboven een optie.</p>'; 
            addProjectModal.style.display = 'block';
        });
    }

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
        // BELANGRIJK: Start de zoeklogica nadat de HTML er staat!
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
});

// Zoeklogica functie
function setupDbSearchLogic() {
    const input = document.getElementById('db-search-input');
    const resultsUl = document.getElementById('db-search-results');
    const confirmDiv = document.getElementById('selected-project-confirm');

    input.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            resultsUl.innerHTML = '';
            return;
        }

        // Gebruik de route die we in server.js gaan maken
        const response = await fetch(`/search-db-projects?q=${query}`);
        const data = await response.json();

        resultsUl.innerHTML = '';
        data.forEach(project => {
            const li = document.createElement('li');
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

    // Event listener voor de definitieve knop
    document.getElementById('final-add-db-btn')?.addEventListener('click', confirmAddDbProject);
}

async function confirmAddDbProject() {
    const projectId = document.getElementById('selected-project-id').value;
    const userRole = document.getElementById('user-role-input').value;

    if (!userRole) return alert("Vul a.u.b. je rol in.");

    const response = await fetch('/add-existing-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userRole })
    });

    if (response.ok) {
        location.reload();
    } else {
        alert("Fout bij toevoegen project.");
    }
}

async function saveManualProject() {
    const formData = new FormData();
    formData.append('title', document.getElementById('new-title').value);
    formData.append('type', document.getElementById('new-type').value);
    formData.append('role', document.getElementById('new-role').value);
    formData.append('contribution', document.getElementById('new-desc').value);
    
    const fileInput = document.getElementById('new-img');
    if (fileInput.files[0]) {
        formData.append('projectImage', fileInput.files[0]);
    }

    const response = await fetch('/add-project-manual', {
        method: 'POST',
        body: formData
    });

    if (response.ok) location.reload();
}