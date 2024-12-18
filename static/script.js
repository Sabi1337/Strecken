        const map = L.map('map').setView([51.1657, 10.4515], 6);
        //leaflet als kartenquelle
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
        }).addTo(map);

        let trackOverlays = {};  // Für das Speichern der Stecken(lines) auf der Karte
        let availableDrivers = [];  // Array zur Speicherung der Fahrer

        function loadTracks(fahrer = "") {
            let url = '/loadtracks';
            if (fahrer) {
                url += `?fahrer=${fahrer}`;
            }

            fetch(url)
                .then(response => response.json())
                .then(tracks => {
                    const trackList = document.getElementById('trackList');
                    trackList.innerHTML = '';

                    tracks.forEach(track => {
                        //+erstelle hier HTML
                        const trackItem = document.createElement('div');
                        trackItem.className = 'track-item';

                        const trackDiv = document.createElement('div');
                        trackDiv.className = 'track';
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `track-${track.id}`;
                        checkbox.onclick = () => toggleTrack(track.id, checkbox.checked);

                        const label = document.createElement('label');
                        label.setAttribute('for', `track-${track.id}`);
                        label.innerText = track.name;

                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-btn';
                        // Mülleimer-Symbol
                        deleteBtn.innerHTML = '&#x1F5D1;';
                        deleteBtn.onclick = () => deleteTrack(track.id, track.name);

                        trackDiv.appendChild(checkbox);
                        trackDiv.appendChild(label);
                        trackDiv.appendChild(deleteBtn);
                        trackItem.appendChild(trackDiv);
                        trackList.appendChild(trackItem);
                    });
                })
                .catch(error => {
                    const trackList = document.getElementById('trackList');
                    trackList.innerHTML = 'Fehler beim Laden der Tracks.';
                    console.error('Fehler:', error);
                });
        }

        function loadDrivers() {
            //fetch = http-get-anfrage um alle fahrer zu bekommen
            fetch('/drivers')
                .then(response => response.json())
                .then(drivers => {
                    const driverSelect = document.getElementById('fahrerSelect');
                    drivers.forEach(driver => {
                        const option = document.createElement('option');
                        option.value = driver;
                        option.innerText = driver;
                        driverSelect.appendChild(option);
                    });
                })
                .catch(error => {
                    console.error('Fehler beim Laden der Fahrer:', error);
                });
        }
        //erinnert stark an lambda funktionen wenn man Evenhandler hinzufügt heiß hier aber Inline
        document.getElementById('fahrerSelect').addEventListener('change', function () {
            const selectedDriver = this.value;
            loadTracks(selectedDriver);
        });

        document.getElementById('uploadForm').onsubmit = function (e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            fetch('/upload', {
                method: 'POST',
                body: formData,
            })
                .then(response => {
                    if (response.status === 201) {
                        alert('GPX-Datei erfolgreich hochgeladen!');
                        loadTracks();
                    } else {
                        alert('Fehler beim Hochladen der Datei.');
                    }
                })
                .catch(error => {
                    alert('Fehler beim Hochladen der Datei.');
                    console.error('Fehler:', error);
                });
        };

        function toggleTrack(trackId, isChecked) {
            if (isChecked) {
                fetch(`/track/${trackId}`)
                    .then(response => response.json())
                    .then(coordinates => {
                        const latlngs = coordinates.map(coord => [coord.latitude, coord.longitude]);
                         // Es wird überprüft, ob diese Strecke (Polyline) schon auf der Karte existiert
                         //Wenn nicht, wird sie einmalig gezeichnet und auf die Karte hinzugefügt
                        if (!trackOverlays[trackId]) {
                            trackOverlays[trackId] = L.polyline(latlngs, { color: 'blue' }).addTo(map);
                        }
                        // Zoom
                        map.fitBounds(latlngs);
                    })
                    .catch(error => {
                        alert('Fehler beim Laden des Tracks.');
                        console.error('Fehler:', error);
                    });
            } else {
                // Track von der Karte entfernen, wenn es überlappt
                if (trackOverlays[trackId]) {
                    map.removeLayer(trackOverlays[trackId]);
                    delete trackOverlays[trackId];
                }
            }
        }

        function deleteTrack(trackId, trackName) {
            const confirmation = confirm(`Möchten Sie den Track "${trackName}" wirklich löschen?`);
            if (confirmation) {
                fetch(`/track/${trackId}`, {
                    method: 'DELETE',
                })
                .then(response => {
                    if (response.ok) {
                        alert(`Track "${trackName}" erfolgreich gelöscht.`);
                        loadTracks();
                    } else {
                        alert('Fehler beim Löschen des Tracks.');
                    }
                })
                .catch(error => {
                    alert('Fehler beim Löschen des Tracks.');
                    console.error('Fehler:', error);
                });
            }
        }

        loadDrivers();
        loadTracks();