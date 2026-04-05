/*  onthoud op welke solliciteer knop is gedrukt */
let currentApplyBtn = null;

/* de modal openen */

function openModalSolliciteren(button) {
    // wie is de eigenaar van het project 
    const receiverId = button.getAttribute('data-receiver');
    // foutmelding als er geen eigenaar is
    if (!receiverId) {
        showCustomAlert("Fout: Geen eigenaar gevonden voor dit project.");
        return;
    }
    
    currentApplyBtn = button; // Bewaar de knop zodat we de tekst '✓ Verstuurd' erop kunnen zetten
    // id van de eigenaar stoppen we in het formulier 
    document.getElementById('sollicitatieReceiverId').value = receiverId;
    
    // Maak het tekstveld weer netjes leeg bij het openen
    document.getElementById('sollicitatieMessage').value = '';
    document.getElementById('wordCount').innerText = '0/200 woorden';
    document.getElementById('wordCount').style.color = '#666';
    
    // Toon de modal
    document.getElementById('modalSolliciteren').style.display = 'block';
}

// de modal sluiten 
function closeModalSolliciteren() {
    // style op none.
    document.getElementById('modalSolliciteren').style.display = 'none';
}


/**
 * De live woordenteller
 * Dit gebeurt elke keer als je een letter typt
 */
document.getElementById('sollicitatieMessage')?.addEventListener('input', function() {
    const text = this.value.trim();

    // We tellen hoeveel woorden er staan door naar de spaties te kijken
    const words = text === '' ? 0 : text.split(/\s+/).length;
    const wordCountSpan = document.getElementById('wordCount');
    
    // We laten de teller zien. Wordt het meer dan 100? Dan maken we de tekst rood.
    wordCountSpan.innerText = `${words}/100 woorden`;
    wordCountSpan.style.color = words > 100 ? 'red' : '#666';
});

/* Het bericht echt versturen naar de database */
async function submitSollicitatie() {
    const message = document.getElementById('sollicitatieMessage').value.trim();
    const receiverId = document.getElementById('sollicitatieReceiverId').value;
    
    /* Eerst checken is het bericht niet leeg of te lang? */
    const words = message === '' ? 0 : message.split(/\s+/).length;
    if (words === 0) return showCustomAlert("Typ alsjeblieft een bericht in.");
    if (words > 100) return showCustomAlert("Je motivatie mag maximaal 100 woorden lang zijn.");

    try {
        // We sturen het bericht en het ID naar de server
        // 'await fetch' zorgt dat we netjes wachten op antwoord van de database
        const response = await fetch('/api/submit-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiverId: receiverId,
                message: message
            })
        });

        // Als de database zegt: "Ik heb het ontvangen!"
        if (response.ok) {
            closeModalSolliciteren(); // Sluit het venster

            // Verander de tekst op de knop waar we op klikten
            currentApplyBtn.innerText = "Verzoek verstuurd! ✓"; 
            // Zet de knop 'uit' zodat je niet per ongeluk dubbel solliciteert
            currentApplyBtn.disabled = true; 
            currentApplyBtn.style.opacity = "0.5";
            
        } else {
            showCustomAlert("Er ging iets mis bij het opslaan in de database.");
        }
    } catch (err) {
        console.error("Fetch fout:", err);
        showCustomAlert("Kan niet verbinden met de server.");
    }
}