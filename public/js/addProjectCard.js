//Plak deze regel in je ejs: <script src="/js/addProjectCard.js"></script>

// Deze code zorgt dat de 'toevoegen' modal voor iedereen werkt
document.addEventListener('DOMContentLoaded', () => {
    const addProjectModal = document.getElementById('add-project-modal');
    const addBtn = document.querySelector('.add-btn');
    const closeAddModal = document.getElementById('close-add-modal');
    const formContainer = document.getElementById('add-project-form-container');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            formContainer.innerHTML = ''; 
            addProjectModal.style.display = 'block';
        });
    }

    if (closeAddModal) {
        closeAddModal.onclick = () => addProjectModal.style.display = 'none';
    }

    // Handmatig formulier opzetje
    const btnManual = document.getElementById('btn-manual');
    if (btnManual) {
        btnManual.addEventListener('click', () => {
            formContainer.innerHTML = `
                <form class="manual-form" id="actual-manual-form">
                    <h3>Handmatig project toevoegen</h3>
                    <label>Project Titel *</label>
                    <input type="text" id="new-title" placeholder="Bijv. Boterbloem" required>
                    <label>Type Project *</label>
                    <input type="text" id="new-type" placeholder="Bijv. Korte film" required>
                    <label>Jouw Rol *</label>
                    <input type="text" id="new-role" placeholder="Bijv. Producer" required>
                    <label>Afbeelding URL *</label>
                    <input type="url" id="new-img" placeholder="https://..." required>
                    <label>Beschrijving van je bijdrage *</label>
                    <textarea id="new-desc" rows="4" placeholder="Wat heb je precies gedaan?" required></textarea>
                    <button type="submit" class="admin-toggle-btn" style="position: static; margin-top: 1em; width: 100%;">
                        Project Toevoegen
                    </button>
                </form>
            `;

            document.getElementById('actual-manual-form').addEventListener('submit', (e) => {
                e.preventDefault();
                // We roepen de save functie aan die op de hoofdpagina staat
                if (typeof saveManualProject === "function") {
                    saveManualProject();
                }
            });
        });
    }

    // API placeholder
    const btnApi = document.getElementById('btn-api');
    if (btnApi) {
        btnApi.addEventListener('click', () => {
            formContainer.innerHTML = `<div class="manual-form"><h3>Zoek in film database</h3><p>Later beschikbaar...</p></div>`;
        });
    }
});