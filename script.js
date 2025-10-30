// script.js - shared functions for password & protection

// call on protected pages: protectPage();
function protectPage() {
  const mode = localStorage.getItem('diaryMode');
  if (!mode) {
    // not logged in — redirect to root page
    // use relative root: if current path already root, do nothing
    const root = location.origin + location.pathname.split('/').slice(0, -1).join('/');
    // simple redirect to ../index.html if not present
    window.location.href = (location.pathname.endsWith('index.html') ? 'index.html' : '../../index.html');
  }
}

// check password and store mode; used on index.html
function checkAndSaveMode(value) {
  const err = document.getElementById('errorMsg');
  if (!value || value.length !== 4) {
    if (err) { err.textContent = 'Enter a 4-digit code'; err.classList.remove('hidden'); setTimeout(()=>err.classList.add('hidden'),2000); }
    return;
  }

  if (value === '1234') {
    localStorage.setItem('diaryMode', 'view');
    window.location.href = 'years.html';
    return;
  }
  if (value === '4321') {
    localStorage.setItem('diaryMode', 'edit');
    window.location.href = 'years.html';
    return;
  }

  if (err) {
    err.textContent = 'Wrong password. Try again.';
    err.classList.remove('hidden');
    setTimeout(()=>err.classList.add('hidden'),2000);
  }
}
