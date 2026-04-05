// tekst counter werkt met meegegeven params 

function setupCounter(elementId, counterId, maxLength) {
    const element = document.getElementById(elementId);
    const counter = document.getElementById(counterId);
    // Luister naar elke letter die de gebruiker typt (het 'input' event)
    element.addEventListener('input', () => {
        // Tel hoeveel letters er in het vakje staan (zonder spaties aan begin/eind)
        const length = element.innerText.trim().length;
        // Update de tekst van de teller, bijvoorbeeld: "15/20"
        counter.innerText = `${length}/${maxLength}`;

        // als de gebruiker over de tekst limieten heen gaat 
        if (length > maxLength) {
            counter.style.color = "red";
            counter.style.fontWeight = "bold";
        } else {
            counter.style.color = "gray";
            counter.style.fontWeight = "normal";
        }
    });
}

// Activeer de tellers
setupCounter('projectTitle', 'titleCounter', 20);
setupCounter('projectSubtitle', 'subtitleCounter', 30);
setupCounter('projectDescription', 'descCounter', 500);