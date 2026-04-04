/*
 * Dit script luistert naar de URL om te zien of we zojuist zijn teruggestuurd 
 * vanaf de Express server met een 'success=true' querystring in de redirect.
 */
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Controleer of de server ons vertelt dat een actie is gelukt
    if (urlParams.get('success') === 'true') {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Succesvol profiel opgeslagen!");
        }
        
        // Mutatie van de adresbalk zónder page-reload om 'refresh-bugs' te voorkomen
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});