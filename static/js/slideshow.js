let slides; // lijstje voor de foto's 
const nextBtn = document.querySelector('.slideshow__nav--next');
const prevBtn = document.querySelector('.slideshow__nav--prev');
let currentIndex = 0; // foto teller welke nu zichtbaar is 
let slideInterval; // timer

function updateSlidesArray() {
    // zoek alle foto html elementen
    slides = document.querySelectorAll('.slideshow__item');
    checkIfEmpty(); // functie aanroepen
}

function showSlide(index) {
    if (!slides || slides.length === 0) return; // doe niets als er geen foto's zijn 

    // Verwijder active class van huidige slide
    slides[currentIndex].classList.remove('slideshow__item--active');
    
    // Bereken nieuwe index 
    currentIndex = (index + slides.length) % slides.length;
    
    // Voeg active class toe aan nieuwe slide
    slides[currentIndex].classList.add('slideshow__item--active');
}

function nextSlide() { showSlide(currentIndex + 1); }
function prevSlide() { showSlide(currentIndex - 1); }

// Event Listeners voor de knoppen
if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetTimer(); });
if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetTimer(); });

// Timer functie
function startTimer() {
    if (slides && slides.length > 1) {
        slideInterval = setInterval(nextSlide, 10000);
    }
}

function resetTimer() {
    clearInterval(slideInterval);
    startTimer();
}

// foto's tonen voordat ze worden verstuurd

function previewImages(input) {
    const maxPhotos = 6;
    // Tel hoeveel foto's er al in de slideshow staan
    const currentPhotos = document.querySelectorAll('.slideshow__item').length;
    // Tel hoeveel nieuwe foto's de gebruiker zojuist heeft geselecteerd
    const selectedPhotos = input.files.length;

    // Check of het totaal over de 6 heen gaat
    if (currentPhotos + selectedPhotos > maxPhotos) {
        alert(`Je kunt maximaal ${maxPhotos} foto's in de slideshow hebben. Je hebt er nu al ${currentPhotos}.`);
        input.value = ""; // Maak de selectie leeg zodat er niets verzonden wordt
        return; // Stop de functie
    }

    if (input.files) {
        const container = document.querySelector('.slideshow__container');
        
        Array.from(input.files).forEach(file => {
            const reader = new FileReader(); // lees het bestand
            reader.onload = function(e) {
                const newSlide = document.createElement('div'); // maak een nieuwe slide div
                newSlide.className = 'slideshow__item';
                
                newSlide.innerHTML = `
                    <img src="${e.target.result}" class="slideshow__image" alt="Preview">
                    <button type="button" class="remove-photo edit-only" onclick="removePhotoFromSlideshow(this)">
                        Verwijderen
                    </button>
                    <span class="preview-badge">Nieuw</span>
                `;
                
                container.appendChild(newSlide);
                updateSlidesArray(); // nieuwe slide toewijzen aan de container

                // meteen zichtbaar als het de eerste foto is.
                if (slides.length === 1) {
                    slides[0].classList.add('slideshow__item--active');
                    startTimer();
                }
            };
            reader.readAsDataURL(file);
        });
    }
}


function removePhotoFromSlideshow(buttonElement) {
    // wis de foto die te zien is zodra je klikt 
    const slideToRemove = buttonElement.closest('.slideshow__item');
    const isActiveSlide = slideToRemove.classList.contains('slideshow__item--active');
    // als de foto zichtbaar is wissel dan gelijk naar de volgende foto
    if (isActiveSlide && slides.length > 1) {
        nextSlide();
    }

    slideToRemove.remove();
    updateSlidesArray();
    resetTimer();
}

// foto check 
function checkIfEmpty() {
    const emptyMessage = document.getElementById('empty-message');
    // als er geen foto's zijn laat hij de melding empty message zien.
    if (!slides || slides.length === 0) {
        if (emptyMessage) emptyMessage.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        clearInterval(slideInterval);
    } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'flex';
        if (prevBtn) prevBtn.style.display = 'flex';
    }
}

// uitvoeren bij laden van de pagina 
updateSlidesArray();
startTimer();