document.addEventListener('DOMContentLoaded', () => {
  const openBtns = document.querySelectorAll('.matching__open');
  const closeBtns = document.querySelectorAll('.matching__modal-close');
  const overlays = document.querySelectorAll('.modal-overlay');

  // Open functie
  openBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetModal = document.getElementById(targetId);
      if (targetModal) {
        targetModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    });
  });
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });
  });
  window.addEventListener('click', (event) => {
    overlays.forEach(overlay => {
      if (event.target === overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });
  });
});