function setupCounter(elementId, counterId, maxLength) {
    const element = document.getElementById(elementId);
    const counter = document.getElementById(counterId);

    element.addEventListener('input', () => {
        const length = element.innerText.trim().length;
        counter.innerText = `${length}/${maxLength}`;

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