let currentApplyBtn = null;

function openModalSolliciteren(button) {
    const receiverId = button.getAttribute('data-receiver');
    if (!receiverId) {
        showCustomAlert("Fout: Geen eigenaar gevonden voor dit project.");
        return;
    }
    
    currentApplyBtn = button; // Bewaar de knop zodat we de tekst '✓ Verstuurd' erop kunnen zetten
    document.getElementById('sollicitatieReceiverId').value = receiverId;
    
    // Maak het tekstveld weer netjes leeg bij het openen
    document.getElementById('sollicitatieMessage').value = '';
    document.getElementById('wordCount').innerText = '0/200 woorden';
    document.getElementById('wordCount').style.color = '#666';
    
    // Toon de modal
    document.getElementById('modalSolliciteren').style.display = 'block';
}

function closeModalSolliciteren() {
    document.getElementById('modalSolliciteren').style.display = 'none';
}

// Event listener voor de live woordenteller
document.getElementById('sollicitatieMessage')?.addEventListener('input', function() {
    const text = this.value.trim();
    // Split op spaties om woorden te tellen
    const words = text === '' ? 0 : text.split(/\s+/).length;
    const wordCountSpan = document.getElementById('wordCount');
    
    wordCountSpan.innerText = `${words}/200 woorden`;
    wordCountSpan.style.color = words > 200 ? 'red' : '#666';
});

async function submitSollicitatie() {
    const message = document.getElementById('sollicitatieMessage').value.trim();
    const receiverId = document.getElementById('sollicitatieReceiverId').value;
    
    const words = message === '' ? 0 : message.split(/\s+/).length;
    if (words === 0) return showCustomAlert("Typ alsjeblieft een bericht in.");
    if (words > 200) return showCustomAlert("Je motivatie mag maximaal 200 woorden lang zijn.");

    try {
        const response = await fetch('/api/submit-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiverId: receiverId,
                message: message
            })
        });

        if (response.ok) {
            closeModalSolliciteren(); // Sluit scherm af
            currentApplyBtn.innerText = "Verzoek verstuurd! ✓"; // Verander knop
            currentApplyBtn.disabled = true; // Zorg dat ze niet nog een keer klikken
        } else {
            showCustomAlert("Er ging iets mis bij het opslaan in de database.");
        }
    } catch (err) {
        console.error("Fetch fout:", err);
        showCustomAlert("Kan niet verbinden met de server.");
    }
}