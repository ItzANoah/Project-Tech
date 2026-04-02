document.addEventListener('DOMContentLoaded', () => {
  const openBtns = document.querySelectorAll('.matching__btn-open');
  const closeBtns = document.querySelectorAll('.matching__modal-close');
  const modals = document.querySelectorAll('.matching__modal');

  // Openen: zoek de modal met het juiste ID en zet display op flex
  openBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target');
          const targetModal = document.getElementById(targetId);
          if (targetModal) {
              targetModal.style.display = 'flex';
              document.body.style.overflow = 'hidden'; // Stop scrollen op achtergrond
          }
      });
  });

  // Sluiten: via de X
  closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          btn.closest('.matching__modal').style.display = 'none';
          document.body.style.overflow = 'auto'; // Weer kunnen scrollen
      });
  });

  // Sluiten: klik buiten het witte vlak
  window.addEventListener('click', (event) => {
      modals.forEach(modal => {
          if (event.target === modal) {
              modal.style.display = 'none';
              document.body.style.overflow = 'auto';
          }
      });
  });
});