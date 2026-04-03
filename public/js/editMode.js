/**
 * EDIT MODE CONFIGURATIE
 * Beheert het bewerken van profielgegevens en de interactie met de server.
 */

const editModeBtn = document.getElementById('edit-mode-toggle');
const pfpInput = document.getElementById('change-pfp-input');

// --- 1. PROFIEL BEWERKEN EN OPSLAAN ---
if (editModeBtn) {
    editModeBtn.addEventListener('click', async () => {
        // Toggle de 'is-editing' class op de body voor visuele veranderingen (CSS)
        const isEditing = document.body.classList.toggle('is-editing');

        if (!isEditing) {
            // --- DATA VERZAMELEN ---
            const skillsArray = Array.from(document.querySelectorAll('#idQualities li'))
                .map(li => {
                    // Verwijder alleen het kruisje en de witruimte eromheen
                    return li.innerText.replace('×', '').trim();
                })
                // Zorg dat we de knop "+ Kwaliteit toevoegen" NIET opslaan als skill
                .filter(text => text !== "" && !text.includes("+ Kwaliteit"));

            const updatedProfileData = {
                name: document.getElementById('userName').innerText.trim(),
                role: document.getElementById('rol').innerText.trim(),
                bio: document.getElementById('bio').innerText.trim(),
                skills: skillsArray
            };

            // LOG DE DATA: Druk op F12 in je browser om te zien of dit er goed uitziet
            console.log("Versturen naar server:", updatedProfileData);

            // --- VERSTUREN NAAR SERVER ---
            try {
                const response = await fetch('/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedProfileData)
                });

                if (response.ok) {
                    console.log("Database succesvol bijgewerkt!");
                } else {
                    // Als de server een fout geeft (bijv. 400 of 500)
                    const errorData = await response.json();
                    console.error("Server fout:", errorData);
                    throw new Error("Server weigert de data.");
                }
            } catch (err) {
                console.error("Opslaan mislukt:", err);
                alert("Er ging iets mis bij het opslaan. Check de console (F12) voor details.");
            }
        }

        // --- VISUELE INTERFACE BIJWERKEN ---
        updateEditUI(isEditing);
    });
}

/**
 * Hulpfunctie om de UI-elementen aan te passen aan de edit-status
 */
function updateEditUI(isEditing) {
    // 1. Tekst en kleur van de knop aanpassen
    editModeBtn.textContent = isEditing ? "Opslaan" : "Aanpassen";
    editModeBtn.style.backgroundColor = isEditing ? "#28a745" : "var(--accentColorRed)";

    // 2. Velden bewerkbaar maken (ContentEditable)
    const editableIds = ['userName', 'rol', 'bio'];
    editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.contentEditable = isEditing;
    });

    // 3. Lijstitems (Skills & Ervaring) bewerkbaar maken
    const profileLists = document.querySelectorAll('.qualities li, .important-qualities li');
    profileLists.forEach(li => {
        li.contentEditable = isEditing;
    });

    // 4. Kruisjes (delete-tags) toevoegen aan skills in edit-mode
    if (isEditing) {
        document.querySelectorAll('.qualities li').forEach(li => {
            // Alleen toevoegen als er nog geen kruisje staat en het niet de 'toevoeg' knop is
            if (!li.querySelector('.delete-tag') && li.innerText !== "+ Kwaliteit toevoegen") {
                const span = document.createElement('span');
                span.className = 'delete-tag';
                span.innerHTML = '×';
                span.contentEditable = false;
                span.onclick = function() { this.parentElement.remove(); };
                li.appendChild(span);
            }
        });
    }
}

// --- 2. PROFIELFOTO UPLOADEN ---
if (pfpInput) {
    pfpInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // FormData gebruiken voor bestandsuploads
        const formData = new FormData();
        formData.append('profilePic', file);

        try {
            const response = await fetch('/upload-pfp', {
                method: 'POST',
                body: formData // Browser stelt zelf de juiste headers in voor FormData
            });

            const result = await response.json();
            if (result.success) {
                // Update de afbeelding in de UI direct
                const userPfp = document.getElementById('userPfp');
                if (userPfp) userPfp.src = result.newImagePath;
                alert("Profielfoto succesvol bijgewerkt!");
            } else {
                alert("Uploaden mislukt: " + (result.message || "Onbekende fout"));
            }
        } catch (err) {
            console.error("Upload fout:", err);
            alert("Er is een technische fout opgetreden bij het uploaden.");
        }
    });
}