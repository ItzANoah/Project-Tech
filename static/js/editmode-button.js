function openEditMode() {
    const body = document.body;
    // checkt of we aan het editen zijn 
    const isEditing = body.classList.contains('is-editing');
    
    const btn = document.querySelector('.button--profile'); // de opslaan knop 
    const form = document.getElementById('projectForm'); // het formulier wat we gaan verzenden
    const editableElements = document.querySelectorAll('[contenteditable]'); //alle editable secties

    if (!isEditing) {
        // edit mode aan 

        body.classList.add('is-editing'); // classlist toevoegen 
        editableElements.forEach(el => el.contentEditable = "true"); // alle editable content word true 
        btn.innerHTML = 'Opslaan <span>&#10003;</span>'; // wijzigen knop veranderd in opslaan
        
    } else {

        // Haal de teksten op uit de input velden
        const titleText = document.getElementById('projectTitle').innerText.trim();
        const subtitleText = document.getElementById('projectSubtitle').innerText.trim();
        const descText = document.getElementById('projectDescription').innerText.trim();

        // kijken of ze voldoen aan de lengte 
        if (titleText.length > 20 || subtitleText.length > 30 || descText.length > 500) {
            alert("Oeps! Een van je teksten is te lang. Maak het korter om op te slaan.");
    
            return; // De rest van de code wordt niet uitgevoerd.
        }

        // als alles voldoet aan de lengtes 

        // teksten kopiëren naar hidden inputs
        document.getElementById('inputTitle').value = titleText;
        document.getElementById('inputSubtitle').value = subtitleText;
        document.getElementById('inputDescription').value = descText;

        // edit mode uitzetten
        body.classList.remove('is-editing');
        editableElements.forEach(el => el.contentEditable = "false");
        btn.innerHTML = 'Wijzig profiel ✎';

        // Zoek alle afbeeldingen die momenteel in de DOM staan
        const currentImages = [];
        document.querySelectorAll('.slideshow__item img').forEach(img => {
        const path = img.getAttribute('src');
        // We slaan alleen paden op die al van de server komen (beginnen met /uploads/)
        // Nieuwe previews (beginnen met data:image) worden via de file-input verstuurd
        if (path.startsWith('/uploads/')) {
        currentImages.push(path);
        }
});

// Zet de overgebleven paden in de hidden input van de partial
document.getElementById('inputRemainingImages').value = currentImages.join(',');

        form.submit();
    }
}