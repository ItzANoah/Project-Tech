document.addEventListener('DOMContentLoaded', () => {  
const toggleButtons = document.querySelectorAll('.btn--details-toggle');

  toggleButtons.forEach(button => {
      button.addEventListener('click', function() {
          const card = this.closest('.matching__card');
          
          // Toggle de class 'is-open' op die specifieke kaart
          card.classList.toggle('is-open');

          // Pas de tekst van de knop aan afhankelijk van de staat
          if (card.classList.contains('is-open')) {
              this.textContent = 'Sluit details';
          } else {
              this.textContent = 'Bekijk details';
          }
      });
  });
});