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

    // Handmatig formulier
    document.getElementById('btn-manual')?.addEventListener('click', () => {
        formContainer.innerHTML = `
            <form class="manual-form" id="actual-manual-form" enctype="multipart/form-data">
                <h3>Handmatig project toevoegen</h3>
                <label>Project Titel *</label>
                <input type="text" id="new-title" required>
                <label>Type Project *</label>
                <input type="text" id="new-type" placeholder="Bijv. Korte film" required>
                <label>Jouw Rol *</label>
                <input type="text" id="new-role" placeholder="Bijv. Editor" required>
                <label>Project Foto</label>
                <input type="file" id="new-img" accept="image/*">
                <label>Beschrijving *</label>
                <textarea id="new-desc" rows="4" required></textarea>
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
        body: formData // Belangrijk: Geen headers en geen JSON!
    });

    const result = await response.json();
    if (result.success) {
        location.reload();
    } else {
        alert("Fout bij toevoegen project");
    }
}

document.getElementById('btnFlmCrw')?.addEventListener('click', () => {
    formContainer.innerHTML = `
        <div class="manual-form">
            <h3>Zoek in Filmcrew Database</h3>
            <div style="position: relative;">
                <input type="text" id="db-search-input" placeholder="Typ de titel van de film..." autocomplete="off">
                <ul id="db-search-results" class="search-dropdown"></ul>
            </div>
            <div id="selected-project-confirm" style="display:none; margin-top: 20px; border-top: 1px solid #ccc; pt: 10px;">
                <h4 id="confirm-title"></h4>
                <label>Wat was jouw rol in dit project? *</label>
                <input type="text" id="user-role-input" placeholder="Bijv. Cameraman of Director">
                <input type="hidden" id="selected-project-id">
                <button type="button" onclick="confirmAddDbProject()" class="admin-toggle-btn" style="position: static; width: 100%; margin-top: 10px;">
                    Project toevoegen aan profiel
                </button>
            </div>
        </div>
    `;
    setupDbSearchLogic();
});

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

        const response = await fetch(`/search-db-projects?q=${query}`);
        const data = await response.json();

        resultsUl.innerHTML = '';
        data.forEach(project => {
            const li = document.createElement('li');
            li.textContent = `${project.name} (${project.director})`;
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
    }
}