function openEditMode() {
    const body = document.body;
    const isEditing = body.classList.contains('is-editing');
    
    const directorCarousel = document.getElementById('directorProjectsCarousel');
    const applicationsContainer = document.getElementById('applicationsContainer'); // Je nieuwe grid

    if (!isEditing) {
        body.classList.add('is-editing');

        // --- 1. PROJECT CAROUSEL PLUS-KAART ---
        if (directorCarousel && !document.getElementById('add-card-placeholder')) {
            const addCardHTML = `
                <li class="carousel__list-Item" id="add-card-placeholder">
                    <div class="matching__card add-project-trigger" onclick="openAddProjectModal()" style="border: 2px dashed var(--accentColorGrey); cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 200px;">
                        <div style="text-align: center;">
                            <span style="font-size: 2rem;">+</span>
                            <p>Project Toevoegen</p>
                        </div>
                    </div>
                </li>`;
            directorCarousel.insertAdjacentHTML('afterbegin', addCardHTML);
        }

        // --- 2. APPLICATION GRID PLUS-KAART ---
        if (applicationsContainer && !document.getElementById('add-app-placeholder')) {
            const addAppHTML = `
                <div class="application-card add-application-card" id="add-app-placeholder" onclick="openApplicationModal()" style="border: 2px dashed #ccc; cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 160px;">
                    <div style="text-align: center;">
                        <span style="font-size: 2rem;">+</span>
                        <p>Functie Toevoegen</p>
                    </div>
                </div>`;
            applicationsContainer.insertAdjacentHTML('beforeend', addAppHTML);
        }

        // Tekstvelden bewerkbaar maken
        document.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = "true");
        document.querySelector('.button--profile').innerHTML = 'Opslaan <span>&#10003;</span>';

    } else {
        // --- MODUS: OPSLAAN & SLUITEN ---
        
        // Verwijder beide Plus-kaarten
        const addCard = document.getElementById('add-card-placeholder');
        const addApp = document.getElementById('add-app-placeholder');
        if (addCard) addCard.remove();
        if (addApp) addApp.remove();

        body.classList.remove('is-editing');
        document.querySelectorAll('[contenteditable]').forEach(el => el.contentEditable = "false");
        document.querySelector('.button--profile').innerHTML = 'Wijzig profiel ✎';

        // Formulier verzenden
        document.getElementById('projectForm').submit();
    }
}