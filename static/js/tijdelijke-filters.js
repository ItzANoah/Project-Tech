// --- TAGS EDITING  ---

// tag verwijderen dit verwijderd de LI
function removeTag(element) {
    element.parentElement.remove();
}

function addTagFromSelect() {
    const select = document.getElementById('tag-select');
    const tagList = document.querySelector('.tag-list');
    const selectedValue = select.value;

    // als het gelijk is aan niets is er geen filter gekozen
    if (selectedValue === "") {
        alert("Kies eerst een filter uit de lijst!");
        return;
    }
    // als het gelijk is uit een filter van de lijst die als ik gekozen
    const existingTags = Array.from(tagList.querySelectorAll('.tag')).map(t => t.innerText.replace('×', '').trim());
    if (existingTags.includes(selectedValue)) {
        alert("Deze tag is al toegevoegd!");
        return;
    }

    // als dat beide niet het geval is maak dan een li aan
    const li = document.createElement('li');
    li.className = 'tag';
    li.innerHTML = `${selectedValue} <button type="button" class="remove-tag edit-only" onclick="removeTag(this)">×</button>`;
    
    tagList.appendChild(li);
    select.value = "";
}