/********************************************
 * Elden Ring GeoGuessr Game Logic
 ********************************************/

let locationData = [];    // Holds location objects from CSV
let currentLocation = null;
let score = 0;
let rounds = 0;
const MAX_ROUNDS = 5;
let mode = 'normal';      // Default mode
let timeLeft = 60;        // Seconds for timed mode
let timerInterval = null;
let map = null;
let guessMarker = null;
let actualMarker = null;
let polyline = null;

// Map dimensions (adjust if needed)
const mapWidth = 2000;
const mapHeight = 1500;

/**
 * 1. Fetch CSV data on page load,
 *    then initialize the map and start the game.
 */
fetch("random_locations.csv")
  .then(response => response.text())
  .then(csvText => {
    // Split CSV into rows, then process each row
    const rows = csvText.split("\n").map(row => row.split(","));
    // Assume first row is header: id,name,image,region,description,xCoord,yCoord
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
    initMap();
    startGame();
  })
  .catch(error => console.error("Error reading CSV:", error));

/**
 * Initialize the Leaflet map using a simple CRS.
 */
function initMap() {
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
  });

  // Define image bounds (top-left [0,0], bottom-right [mapHeight, mapWidth])
  const bounds = [[0, 0], [mapHeight, mapWidth]];
  L.imageOverlay('img/lands_between_map.jpg', bounds).addTo(map);
  map.fitBounds(bounds);

  // Allow marker placement on click
  map.on('click', onMapClick);
}

/**
 * On map click, place (or move) the guess marker.
 */
function onMapClick(e) {
  if (guessMarker) {
    guessMarker.setLatLng(e.latlng);
  } else {
    guessMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
  }
}

/**
 * Start a new round (or finish game after MAX_ROUNDS).
 */
function startGame() {
  if (rounds >= MAX_ROUNDS) {
    showGameOver();
    return;
  }

  // Get game mode from URL only at the first round
  if (rounds === 0) {
    const params = new URLSearchParams(window.location.search);
    mode = params.get("mode") || "normal";
    document.getElementById("mode-info").textContent = mode.toUpperCase();
  }

  // Pick a random location from the dataset
  const randomIndex = Math.floor(Math.random() * locationData.length);
  currentLocation = locationData[randomIndex];

  // Set location image
  const locationImage = document.getElementById("location-image");
  locationImage.src = currentLocation.image || "img/placeholder.jpg";

  // Remove previous markers and polyline, if any
  if (guessMarker) {
    map.removeLayer(guessMarker);
    guessMarker = null;
  }
  if (actualMarker) {
    map.removeLayer(actualMarker);
    actualMarker = null;
  }
  if (polyline) {
    map.removeLayer(polyline);
    polyline = null;
  }
  document.getElementById('result').style.display = 'none';

  // Re-enable map click
  map.on('click', onMapClick);

  rounds++;
  updateUI();

  // Start timer if in timed mode
  if (mode === 'timed') {
    timeLeft = 60;
    document.getElementById('timer').style.display = 'inline-block';
    document.getElementById('time-left').textContent = timeLeft;
    timerInterval = setInterval(() => {
      timeLeft--;
      document.getElementById('time-left').textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        confirmGuess(true); // Auto-submit when time runs out
      }
    }, 1000);
  } else {
    document.getElementById('timer').style.display = 'none';
  }
}

/**
 * Confirm the guess (either manually or auto-submitted).
 * Uses an exponential decay scoring formula similar to GeoGuessr.
 */
function confirmGuess(autoSubmit = false) {
  if (!guessMarker && !autoSubmit) {
    alert('Please place a marker on the map first.');
    return;
  }

  // Clear timer for timed mode
  if (mode === 'timed') {
    clearInterval(timerInterval);
  }

  let distance = 0;
  let points = 0;
  const actualLatLng = L.latLng(currentLocation.yCoord, currentLocation.xCoord);

  if (!guessMarker && autoSubmit) {
    // No guess placed: 0 points
    distance = NaN;
    points = 0;
  } else if (guessMarker) {
    const guessLatLng = guessMarker.getLatLng();
    distance = map.distance(guessLatLng, actualLatLng);
    // GeoGuessr-like scoring: max 5000 points, decays exponentially with distance.
    points = Math.round(5000 * Math.exp(-0.002 * distance));
  }

  score += points;

  // Show actual location marker
  actualMarker = L.marker(actualLatLng).addTo(map);

  // Draw a line between guess and actual location
  if (guessMarker) {
    polyline = L.polyline([guessMarker.getLatLng(), actualLatLng], { color: 'red' }).addTo(map);
    // Zoom to show both markers
    const group = new L.featureGroup([guessMarker, actualMarker]);
    map.fitBounds(group.getBounds().pad(0.2));
  } else {
    map.setView(actualLatLng, 1);
  }

  // Display result in a popup
  const distText = isNaN(distance) ? 'N/A' : distance.toFixed(2) + ' px';
  const resultHtml = `
    <p><strong>Location:</strong> ${currentLocation.name} (${currentLocation.region})</p>
    <p>${currentLocation.description}</p>
    <p><strong>Distance:</strong> ${distText}</p>
    <p><strong>Points Earned:</strong> ${points}</p>
    <p><strong>Total Score:</strong> ${score}</p>
    <p><strong>Round:</strong> ${rounds} / ${MAX_ROUNDS}</p>
  `;
  document.getElementById('result-text').innerHTML = resultHtml;
  document.getElementById('result').style.display = 'block';

  // Disable further interactions
  map.off('click');
  if (guessMarker) guessMarker.dragging.disable();

  // Show the next round button if game is not finished
  if (rounds < MAX_ROUNDS) {
    document.getElementById('next-round-btn').style.display = 'inline-block';
  } else {
    document.getElementById('next-round-btn').style.display = 'none';
  }
}

// Hook up button events
document.getElementById('guess-btn').addEventListener('click', () => confirmGuess(false));
document.getElementById('next-round-btn').addEventListener('click', startGame);

/**
 * Update UI elements for round and score.
 */
function updateUI() {
  document.getElementById('round-info').textContent = `${rounds}/${MAX_ROUNDS}`;
  document.getElementById('score-info').textContent = score;
  if (mode === 'timed') {
    document.getElementById('time-left').textContent = timeLeft;
  }
}

/**
 * Display final game over message.
 */
function showGameOver() {
  document.getElementById('result').style.display = 'block';
  document.getElementById('result-text').innerHTML = `
    <p><strong>Game Over!</strong></p>
    <p>Your final score: ${score}</p>
  `;
  document.getElementById('next-round-btn').style.display = 'none';
  map.off('click');
  if (guessMarker) guessMarker.dragging.disable();
}
