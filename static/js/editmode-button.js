function openEditMode() {
    const body = document.body;
    const isEditing = body.classList.contains('is-editing');
    
    // Selecteer de containers waar de "Plus-knoppen" in moeten komen
    const directorCarousel = document.getElementById('directorProjectsCarousel');
    const applicationsContainer = document.getElementById('applicationsContainer');

    if (!isEditing) {
        // --- STAP 1: BEWERK-MODUS AANZETTEN ---
        body.classList.add('is-editing');

        // 1. Maak alle tekstvelden bewerkbaar
        document.querySelectorAll('[contenteditable]').forEach(el => {
            el.contentEditable = "true";
        });

        // 2. Verander de knoptekst naar "Opslaan"
        const profileBtn = document.querySelector('.button--profile');
        if (profileBtn) profileBtn.innerHTML = 'Opslaan <span>&#10003;</span>';

        // 3. Voeg de "Plus-kaart" toe aan de Projecten Carousel
        if (directorCarousel && !document.getElementById('add-card-placeholder')) {
            const addCardHTML = `
                <li class="carousel__list-Item" id="add-card-placeholder">
                    <div class="matching__card add-project-trigger" onclick="openAddProjectModal()" 
                         style="border: 2px dashed #ccc; cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 200px;">
                        <div style="text-align: center;">
                            <span style="font-size: 2rem;">+</span>
                            <p>Project Toevoegen</p>
                        </div>
                    </div>
                </li>`;
            directorCarousel.insertAdjacentHTML('afterbegin', addCardHTML);
        }

        // 4. Voeg de "Plus-kaart" toe aan de Sollicitaties Grid
        if (applicationsContainer && !document.getElementById('add-app-placeholder')) {
            const addAppHTML = `
                <div class="application-card add-application-card" id="add-app-placeholder" 
                     onclick="openApplicationModal()" 
                     style="border: 2px dashed #ccc; cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 160px;">
                    <div style="text-align: center;">
                        <span style="font-size: 2rem;">+</span>
                        <p>Functie Toevoegen</p>
                    </div>
                </div>`;
            applicationsContainer.insertAdjacentHTML('beforeend', addAppHTML);
        }

    } else {
        // --- STAP 2: OPSLAAN & VERZENDEN ---

        // 1. SYNC: Kopieer tekst van de pagina naar de verborgen inputs
        // Dit is nodig omdat contenteditable velden anders leeg aankomen bij de server
        const titleEl = document.getElementById('projectTitle');
        const subtitleEl = document.getElementById('projectSubtitle');
        const descEl = document.getElementById('projectDescription');
        const prodEl = document.getElementById('productionSummary');

        if (titleEl) document.getElementById('inputTitle').value = titleEl.innerText.trim();
        if (subtitleEl) document.getElementById('inputSubtitle').value = subtitleEl.innerText.trim();
        if (descEl) document.getElementById('inputDescription').value = descEl.innerText.trim();
        if (prodEl) document.getElementById('inputProductionDescription').value = prodEl.innerText.trim();

        // 2. FOTO SYNC: Verzamel alle overgebleven foto's in de slideshow
        const remainingImages = [];
        document.querySelectorAll('.slideshow__image').forEach(img => {
            const src = img.getAttribute('src');
            // Tijdelijke base64 (data:) negeren, we willen alleen echte paden bewaren!
            if (src && !src.startsWith('data:')) {
                remainingImages.push(src);
            }
        });
        
        // Maak het verborgen veld automatisch aan als deze nog niet bestaat in de EJS
        let imgInput = document.getElementById('inputRemainingImages');
        if (!imgInput) {
            imgInput = document.createElement('input');
            imgInput.type = 'hidden';
            imgInput.id = 'inputRemainingImages';
            imgInput.name = 'inputRemainingImages';
            const form = document.getElementById('projectForm');
            if (form) form.appendChild(imgInput);
        }
        
        imgInput.value = remainingImages.join(',');

        // 3. OPRUIMEN: Verwijder de tijdelijke "Plus-kaarten"
        const addCard = document.getElementById('add-card-placeholder');
        const addApp = document.getElementById('add-app-placeholder');
        if (addCard) addCard.remove();
        if (addApp) addApp.remove();

        // 4. UI herstellen
        body.classList.remove('is-editing');
        document.querySelectorAll('[contenteditable]').forEach(el => {
            el.contentEditable = "false";
        });
        const profileBtn = document.querySelector('.button--profile');
        if (profileBtn) profileBtn.innerHTML = 'Wijzig profiel ✎';

        // 5. VERZENDEN: Stuur het grote projectForm naar de server
        const form = document.getElementById('projectForm');
        if (form) {
            console.log("Alles gesynchroniseerd. Formulier wordt nu verzonden...");
            form.submit();
        } else {
            console.error("FOUT: Kan 'projectForm' niet vinden in de HTML!");
        }
    }
}