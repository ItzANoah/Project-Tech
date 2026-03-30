document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('type-select');
    const genreSelect = document.getElementById('genre-select');

    if (typeSelect) {
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

function updateLiveBadge(category, value) {
    const badge = document.querySelector(`.pill--${category}`);
    const emptyMsg = document.querySelector('.pill--empty');
    
    if (badge) {
        if (value === "" || value === null) {
            badge.classList.add('hidden');
        } else {
            badge.classList.remove('hidden');
            badge.innerText = value;
            if (emptyMsg) emptyMsg.classList.add('hidden');
        }
    }

    // Controleer of beide nu leeg zijn om de 'leeg' melding terug te tonen
    const typeVal = document.getElementById('type-select').value;
    const genreVal = document.getElementById('genre-select').value;
    
    if (!typeVal && !genreVal && emptyMsg) {
        emptyMsg.classList.remove('hidden');
    }
}