/********************************************
 * Elden Ring GeoGuessr Game Logic
 ********************************************/

let locationData = [];    // Will hold array of location objects from CSV
let currentLocation = null;
let score = 0;
let rounds = 0;
const MAX_ROUNDS = 5;
let mode = 'normal';      // Default mode
let timeLeft = 60;        // For timed mode
let timerInterval = null;
let map = null;
let guessMarker = null;
let actualMarker = null;
let polyline = null;

// Assuming the map image dimensions (replace with actual dimensions)
const mapWidth = 2000;    // Replace with actual width
const mapHeight = 1500;   // Replace with actual height

/**
 * 1. FETCH CSV DATA on page load
 *    Then start the game once data is ready.
 */
fetch("locations.csv")
  .then(response => response.text())
  .then(csvText => {
    // Split by lines, then by commas
    const rows = csvText.split("\n").map(row => row.split(","));
    // Assuming first row is header: id,name,image,region,description,xCoord,yCoord
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 7) {
        const x = parseFloat(row[5]);
        const y = parseFloat(row[6]);
        if (!isNaN(x) && !isNaN(y)) {
          locationData.push({
            id: row[0].trim(),
            name: row[1].trim(),
            image: row[2].trim(),
            region: row[3].trim(),
            description: row[4].trim(),
            xCoord: x,
            yCoord: y
          });
        }
      }
    }
    console.log("Location data loaded:", locationData);
    // Initialize map
    initMap();
    // Start game
    startGame();
  })
  .catch(error => console.error("Error reading CSV:", error));

/**
 * Initialize Leaflet map
 */
function initMap() {
  // Set up the map with simple CRS
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
  });

  // Define the image bounds (assuming y increases downwards)
  const bounds = [[0, 0], [mapHeight, mapWidth]];

  // Add the image overlay
  L.imageOverlay('img/lands_between_map.jpg', bounds).addTo(map);

  // Fit the map to the image bounds
  map.fitBounds(bounds);

  // Allow placing a marker on click
  map.on('click', function(e) {
    if (guessMarker) {
      guessMarker.setLatLng(e.latlng);
    } else {
      guessMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
    }
  });
}

/**
 * Start the game or proceed to next round
 */
function startGame() {
  if (rounds >= MAX_ROUNDS) {
    // Game over
    document.getElementById('result-text').innerHTML = `
      <p><strong>Game Over!</strong></p>
      <p><strong>Final Score:</strong> ${score}</p>
    `;
    document.getElementById('result').style.display = 'block';
    document.getElementById('next-round-btn').style.display = 'none';
    // Disable map interactions
    map.off('click');
    if (guessMarker) guessMarker.dragging.disable();
    return;
  }

  // Get mode from URL
  const params = new URLSearchParams(window.location.search);
  mode = params.get("mode") || "normal";
  document.getElementById("mode-info").textContent = mode.toUpperCase();

  // Select random location
  if (locationData.length === 0) {
    console.error("No more locations available.");
    return;
  }
  const randomIndex = Math.floor(Math.random() * locationData.length);
  currentLocation = locationData[randomIndex];

  // Display location image
  const locationImage = document.getElementById("location-image");
  locationImage.src = currentLocation.image || "img/placeholder.jpg";

  // Reset markers and polyline
  if (guessMarker) map.removeLayer(guessMarker);
  if (actualMarker) map.removeLayer(actualMarker);
  if (polyline) map.removeLayer(polyline);
  guessMarker = null;
  actualMarker = null;
  polyline = null;

  // Hide result
  document.getElementById('result').style.display = 'none';

  // Enable map interactions
  map.on('click', function(e) {
    if (guessMarker) {
      guessMarker.setLatLng(e.latlng);
    } else {
      guessMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
    }
  });

  // Update UI
  rounds++;
  updateUI();

  // Start timer if in timed mode
  if (mode === 'timed') {
    timeLeft = 60; // seconds
    document.getElementById('timer').style.display = 'block';
    timerInterval = setInterval(() => {
      timeLeft--;
      document.getElementById('time-left').textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        confirmGuess(true); // Auto-submit
      }
    }, 1000);
  } else {
    document.getElementById('timer').style.display = 'none';
  }
}

/**
 * Confirm the guess
 * @param {boolean} autoSubmit - Whether the guess is auto-submitted due to time out
 */
function confirmGuess(autoSubmit = false) {
  if (!guessMarker && !autoSubmit) {
    alert('Please place a marker on the map first.');
    return;
  }

  // Clear timer if in timed mode
  if (mode === 'timed') {
    clearInterval(timerInterval);
  }

  let distance;
  let points;
  if (guessMarker) {
    const guessLatLng = guessMarker.getLatLng();
    const actualLatLng = L.latLng(currentLocation.yCoord, currentLocation.xCoord);
    distance = map.distance(guessLatLng, actualLatLng);
    points = Math.round(1000 - distance);
    if (points < 0) points = 0;
  } else {
    // No guess made, give zero points
    distance = 'N/A';
    points = 0;
  }

  score += points;

  // Show actual location marker
  const actualLatLng = L.latLng(currentLocation.yCoord, currentLocation.xCoord);
  actualMarker = L.marker(actualLatLng).addTo(map);

  if (guessMarker) {
    // Draw a line between guess and actual
    polyline = L.polyline([guessMarker.getLatLng(), actualLatLng], { color: 'red' }).addTo(map);
    // Zoom to fit both markers
    const group = new L.featureGroup([guessMarker, actualMarker]);
    map.fitBounds(group.getBounds().pad(0.1));
  } else {
    // Zoom to actual location
    map.setView(actualLatLng, 1);
  }

  // Show result
  const resultText = `
    <p><strong>Correct Location:</strong> ${currentLocation.name} (${currentLocation.region})</p>
    <p><strong>Distance:</strong> ${distance === 'N/A' ? 'N/A' : distance.toFixed(2) + ' pixels'}</p>
    <p><strong>Points Earned:</strong> ${points}</p>
    <p><strong>Total Score:</strong> ${score}</p>
    <p><strong>Round:</strong> ${rounds} / ${MAX_ROUNDS}</p>
  `;
  document.getElementById('result-text').innerHTML = resultText;
  document.getElementById('result').style.display = 'block';

  // Disable further map interactions
  map.off('click');
  if (guessMarker) guessMarker.dragging.disable();

  // Show next round button if not last round
  if (rounds < MAX_ROUNDS) {
    document.getElementById('next-round-btn').style.display = 'inline-block';
  } else {
    document.getElementById('next-round-btn').style.display = 'none';
  }
}

// Add event listener to guess button
document.getElementById('guess-btn').addEventListener('click', () => confirmGuess(false));

// Add event listener to next round button
document.getElementById('next-round-btn').addEventListener('click', startGame);

/**
 * Update UI elements
 */
function updateUI() {
  document.getElementById('round-info').textContent = `${rounds}/${MAX_ROUNDS}`;
  document.getElementById('score-info').textContent = score;
  if (mode === 'timed') {
    document.getElementById('time-left').textContent = timeLeft;
  }
}