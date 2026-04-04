/* Wacht tot de DOM volledig is geladen, koppelt vervolgens 'change' events aan de select dropdowns */
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('type-select');
    const genreSelect = document.getElementById('genre-select');

    if (typeSelect) {
        // Het 'change' event werkt pas nadat een gebruiker een nieuwe optie definitief selecteert.
        typeSelect.addEventListener('change', function() {
            updateLiveBadge('type', this.value);
        });
    }

    if (genreSelect) {
        genreSelect.addEventListener('change', function() {
            updateLiveBadge('genre', this.value);
        });
    }
});

/* Past de visuele representatie van de filters op het scherm aan, zonder server request. 
 *  {string} category - Bepaalt of we de 'type' of 'genre' pill aanpassen.
 *  {string} value - De geselecteerde tekstwaarde uit de dropdown.
 */
function updateLiveBadge(category, value) {
    // Zoek de juiste visuele elementen
    const badge = document.querySelector(`.pill--${category}`);
    const emptyMsg = document.querySelector('.pill--empty');
    
    if (badge) {
        if (value === "" || value === null) {
            // Voeg de 'hidden' class toe om het element via CSS display: none te verbergen
            badge.classList.add('hidden');
        } else {
            badge.classList.remove('hidden');
            // Zet de daadwerkelijke tekst in de pill
            badge.innerText = value;
            if (emptyMsg) emptyMsg.classList.add('hidden');
        }
    }
    
    // Lees beide formuliervelden live uit. Als beide geen waarde hebben, toon de default (empty) status.
    const typeVal = document.getElementById('type-select').value;
    const genreVal = document.getElementById('genre-select').value;
    
    if (!typeVal && !genreVal && emptyMsg) {
        emptyMsg.classList.remove('hidden');
    }
}