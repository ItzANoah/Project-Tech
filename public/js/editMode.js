const editModeBtn = document.getElementById('edit-mode-toggle');

editModeBtn.addEventListener('click', async () => {
    const isEditing = document.body.classList.toggle('is-editing');

    if (!isEditing) {
        // --- STAP: DATA VERZAMELEN ---
        // We halen alle tekst uit de bolletjes en maken er een lijst (Array) van
        const skillElements = document.querySelectorAll('#idQualities li');
        const skillsArray = Array.from(skillElements)
            .map(li => {
                // We halen het kruisje (x) weg uit de tekst voordat we het opslaan
                let text = li.innerText.replace('×', '').trim();
                return text;
            })
            .filter(text => text !== "+ Kwaliteit toevoegen" && text !== "");

        const updatedData = {
            name: document.getElementById('userName').innerText,
            role: document.getElementById('rol').innerText,
            bio: document.getElementById('bio').innerText,
            skills: skillsArray
        };

        // --- STAP: VERSTUREN NAAR SERVER ---
        try {
            const response = await fetch('/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                console.log("Database succesvol bijgewerkt!");
            }
        } catch (err) {
            console.error("Kon niet opslaan:", err);
        }
    }

    // --- STAP: VISUELE FEEDBACK ---
    editModeBtn.textContent = isEditing ? "Opslaan" : "Aanpassen";
    editModeBtn.style.backgroundColor = isEditing ? "#28a745" : "var(--accentColorRed)";

    // Velden bewerkbaar maken of juist niet
    const editableIds = ['userName', 'rol', 'bio'];
    editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.contentEditable = isEditing;
    });

    const profileLists = document.querySelectorAll('.qualities li, .important-qualities li, .nameRole li');
    profileLists.forEach(li => {
        li.contentEditable = isEditing;
    });

    // Kruisjes toevoegen aan de skills als we aan het aanpassen zijn
    if (isEditing) {
        document.querySelectorAll('.qualities li').forEach(li => {
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
});

const pfpInput = document.getElementById('change-pfp-input');

pfpInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // FormData is nodig om bestanden te versturen
    const formData = new FormData();
    formData.append('profilePic', file);

    try {
        const response = await fetch('/upload-pfp', {
            method: 'POST',
            body: formData // Let op: GEEN headers instellen, dat doet de browser zelf bij FormData
        });

        const result = await response.json();
        if (result.success) {
            // Update de afbeelding op je scherm direct
            document.getElementById('userPfp').src = result.newImagePath;
            alert("Profielfoto bijgewerkt!");
        }
    } catch (err) {
        console.error("Upload fout:", err);
    }
});