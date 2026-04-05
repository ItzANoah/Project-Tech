
function showCustomAlert(message) {
    document.getElementById('customAlertMessage').textContent = message;
    document.getElementById('customAlertModal').style.display = 'block';
}
function closeCustomAlert() {
    document.getElementById('customAlertModal').style.display = 'none';
}