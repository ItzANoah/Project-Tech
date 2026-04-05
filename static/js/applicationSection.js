
/* Opent de toevoeg-modal en plaatst direct de cursor (focus) in het titel-veld.
 */
function openApplicationModal() {
    const modal = document.getElementById('applicationModal');
    if (modal) {
        modal.style.display = 'block';
        // Focus direct op het eerste veld voor gebruiksgemak
        document.getElementById('appTitle').focus();
    }
}

/* Verbergt de modal door de display none aan te passen. */
function closeApplicationModal() {
    const modal = document.getElementById('applicationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/* Sluit-event voor klikken buiten de modal */
window.addEventListener('click', (event) => {
    const modal = document.getElementById('applicationModal');
    if (event.target === modal) {
        closeApplicationModal();
    }
});

/* Verstuurt de sollicitatie naar `app.post('/api/submit-application')` in server.js. */
async function sendApplication(button) {
    const receiverId = button.getAttribute('data-receiver');
    
    // Check of we een receiverId hebben
    if (!receiverId || receiverId === "undefined") {
        showCustomAlert("Fout: Geen ontvanger gevonden voor dit project.");
        return;
    }

    try {
        const response = await fetch('/api/submit-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiverId: receiverId,
                message: "Ik wil graag solliciteren op deze rol!" // Standaardbericht voor de snelle knop
            })
        });

        if (response.ok) {
            button.innerText = "Verzoek verstuurd! ✓";
            button.classList.add('btn-sent'); 
            button.disabled = true;
        } else {
            const errData = await response.json();
            showCustomAlert("Fout bij versturen: " + (errData.error || "Onbekende fout"));
        }
    } catch (err) {
        console.error("Netwerkfout:", err);
        showCustomAlert("Kan geen verbinding maken met de server.");
    }
}

/* Leest de input uit de modal en maakt een nieuw HTML-element aan. */
function saveNewApplication() {
    const titleInput = document.getElementById('appTitle');
    const descInput = document.getElementById('appDesc');
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();

    // Check of we het formulier kunnen vinden
    const form = document.getElementById('projectForm');
    if (!form) {
        console.error("FOUT: Formulier 'projectForm' niet gevonden! Staat je JS wel goed?");
        return;
    }

    // als er niet is ingevuld 
    if (!title || !desc) return showCustomAlert("Vul alles in!");

    const container = document.getElementById('applicationsContainer');
    const plusCard = document.getElementById('add-app-placeholder');

    // Maakt element in geheugen aan voordat het in de DOM geplaatst wordt
    const newCard = document.createElement('div');
    newCard.className = 'application-card new-entry';
    
    newCard.innerHTML = `
        <button type="button" class="delete-app-btn" onclick="this.parentElement.remove()">&times;</button>
        <div class="application-card__content">
            <h3 class="application-card__title"></h3>
            <p class="application-card__description"></p>
        </div>
        <input type="hidden" name="jobTitel" class="hidden-title">
        <input type="hidden" name="jobDescription" class="hidden-desc">
    `;

    newCard.querySelector('.application-card__title').textContent = title;
    newCard.querySelector('.application-card__description').textContent = desc;
    newCard.querySelector('.hidden-title').value = title;
    newCard.querySelector('.hidden-desc').value = desc;

    // Plaatst het nieuwe kaartje exact vóór het 'plus' kaartje
    container.insertBefore(newCard, plusCard);
    closeApplicationModal();
    
    // Velden leegmaken
    titleInput.value = "";
    descInput.value = "";
    
    showCustomAlert("Succesvol de sollicitatie toegevoegd, vergeet niet om op te slaan!");
}

// het aanroepen van de pop-up 
function submitApplicationRequest(id) {
    showCustomAlert("Sollicitatie verzonden voor vacature ID: " + id);
}