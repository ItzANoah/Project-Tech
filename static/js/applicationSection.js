function openApplicationModal() {
    const modal = document.getElementById('applicationModal');
    if (modal) {
        modal.style.display = 'block';
        // Focus direct op het eerste veld voor gebruiksgemak
        document.getElementById('appTitle').focus();
    }
}

function closeApplicationModal() {
    const modal = document.getElementById('applicationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Sluit-event voor klikken buiten de modal
window.addEventListener('click', (event) => {
    const modal = document.getElementById('applicationModal');
    if (event.target === modal) {
        closeApplicationModal();
    }
});

async function sendApplication(button) {
    const receiverId = button.getAttribute('data-receiver');
    
    // Check of we een receiverId hebben
    if (!receiverId || receiverId === "undefined") {
        alert("Fout: Geen ontvanger gevonden voor dit project.");
        return;
    }

    try {
        const response = await fetch('/api/submit-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiverId: receiverId
            })
        });

        if (response.ok) {
            button.innerText = "Verzoek verstuurd! ✓";
            button.classList.add('btn-sent'); // Optioneel voor styling
            button.disabled = true;
        } else {
            const errData = await response.json();
            alert("Fout bij versturen: " + (errData.error || "Onbekende fout"));
        }
    } catch (err) {
        console.error("Netwerkfout:", err);
        alert("Kan geen verbinding maken met de server.");
    }
}

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

    if (!title || !desc) return alert("Vul alles in!");

    const container = document.getElementById('applicationsContainer');
    const plusCard = document.getElementById('add-app-placeholder');

    const newCard = document.createElement('div');
    newCard.className = 'application-card new-entry';
    
    // Veilige HTML structuur:
    newCard.innerHTML = `
        <button type="button" class="delete-app-btn" onclick="this.parentElement.remove()">×</button>
        <div class="application-card__content">
            <h3 class="application-card__title"></h3>
            <p class="application-card__description"></p>
        </div>
        <input type="hidden" name="jobTitel" class="hidden-title">
        <input type="hidden" name="jobDescription" class="hidden-desc">
    `;

    // Vul de velden in via javascript, zo maken aanhalingstekens je formulier niet kapot:
    newCard.querySelector('.application-card__title').textContent = title;
    newCard.querySelector('.application-card__description').textContent = desc;
    newCard.querySelector('.hidden-title').value = title;
    newCard.querySelector('.hidden-desc').value = desc;

    container.insertBefore(newCard, plusCard);
    closeApplicationModal();
    
    // Velden leegmaken
    titleInput.value = "";
    descInput.value = "";
    
    console.log("Kaartje toegevoegd aan formulier. Klaar om op te slaan.");
}

function submitApplicationRequest(id) {
    alert("Sollicitatie verzonden voor vacature ID: " + id);
    // Hier komt later je fetch naar de 'user_connections' collectie
}