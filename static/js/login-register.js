document.addEventListener('DOMContentLoaded', () => {
    // --- knopjes ---
    const form = document.getElementById('registrationForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    // --- sliders ---
    // zodat het getal boven de sliders update tijdens het "sliden"
    const setupSlider = (inputId, displayId) => {
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);
        if (input && display) {
            input.addEventListener('input', () => {
                display.innerText = input.value;
            });
        }
    };

    setupSlider('age', 'age-val');        // leeftijd slider
    setupSlider('experience', 'val');    // ervaring slider

    // --- volgende stap registreer formulier ---
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            // Validatie 
            const isStep1Valid = validateStep1();
            if (isStep1Valid) {
                step1.style.display = 'none';
                step2.style.display = 'block';
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            step2.style.display = 'none';
            step1.style.display = 'block';
        });
    }

    // --- validatie die custom foutmelding geeft ---
    const validateField = (inputElement, errorElement) => {
        if (!inputElement.value.trim()) {
            errorElement.classList.add('active'); 
            inputElement.classList.add('invalid');
            return false;
        } else {
            errorElement.classList.remove('active');
            inputElement.classList.remove('invalid');
            return true;
        }
    };

    const validateStep1 = () => {
        const userValid = validateField(
            document.getElementById('username'), 
            document.getElementById('username-error')
        );
        const emailValid = validateField(
            document.getElementById('email'), 
            document.getElementById('email-error')
        );
        const passValid = validateField(
            document.getElementById('password'), 
            document.getElementById('password-error')
        );

        return userValid && emailValid && passValid;
    };

    // Luister naar de uiteindelijke submit van het hele formulier
    if (form) {
        form.addEventListener('submit', (event) => {
            const functionInput = document.getElementById('function');
            const functionError = document.getElementById('function-error');
            
            // Check ook de velden van stap 2
            if (!validateField(functionInput, functionError)) {
                event.preventDefault(); // Stop versturen als stap 2 niet klopt
            }
        });
    }
});