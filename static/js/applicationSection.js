/**
 * APPLICATION CAROUSEL MANAGER
 * Handelt het openen van de modal en het toevoegen van nieuwe applicaties af.
 */

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

function saveNewApplication() {
    const title = document.getElementById('appTitle').value.trim();
    const desc = document.getElementById('appDesc').value.trim();

    if (!title || !desc) {
        alert("Vul a.u.b. zowel een titel als een beschrijving in.");
        return;
    }

    const list = document.getElementById('applicationsCarousel');
    const plusCard = list.querySelector('.edit-only');

    // Nieuw lijst-item aanmaken
    const li = document.createElement('li');
    li.className = 'carousel__list-Item';
    
    // De HTML voor de preview (visueel gelijk aan applicationCard.ejs)
    li.innerHTML = `
        <div class="application-card new-entry" style="border: 2px dashed var(--accentColor, #333);">
            <div class="application-card__body">
                <h3>${title}</h3>
                <p>${desc}</p>
                <small style="color: orange;">(Nog niet gepubliceerd)</small>
            </div>
            <input type="hidden" name="newAppTitles[]" value="${title}">
            <input type="hidden" name="newAppDescs[]" value="${desc}">
        </div>
    `;

    // Invoegen voor het plus-kaartje
    if (plusCard) {
        list.insertBefore(li, plusCard);
    } else {
        list.appendChild(li);
    }
    
    closeApplicationModal();
    document.getElementById('applicationForm').reset();
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
    const title = document.getElementById('appTitle').value.trim();
    const desc = document.getElementById('appDesc').value.trim();

    if (!title || !desc) return alert("Vul alles in!");

    const container = document.getElementById('applicationsContainer');
    const plusCard = container.querySelector('.add-application-card');

    const newCard = document.createElement('div');
    newCard.className = 'application-card new-entry';
    
    newCard.innerHTML = `
        <button type="button" class="delete-app-btn" style="display:block" onclick="this.parentElement.remove()">×</button>
        <div class="application-card__content">
            <h3>${title}</h3>
            <p>${desc}</p>
        </div>
        <input type="hidden" name="newAppTitles[]" value="${title}">
        <input type="hidden" name="newAppDescs[]" value="${desc}">
    `;

    container.insertBefore(newCard, plusCard);
    closeApplicationModal();
    document.getElementById('applicationForm').reset();
}

function removeApplication(id) {
    // Voor bestaande applicaties uit de DB
    if (confirm("Weet je zeker dat je deze vacature wilt verwijderen?")) {
        // We voegen een hidden input toe die de server vertelt welk ID verwijderd moet worden
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'removeAppIds[]';
        input.value = id;
        document.getElementById('projectForm').appendChild(input);

        // Verwijder visueel
        document.querySelector(`[data-id="${id}"]`).remove();
    }
}

function submitApplicationRequest(id) {
    alert("Sollicitatie verzonden voor vacature ID: " + id);
    // Hier komt later je fetch naar de 'user_connections' collectie
}