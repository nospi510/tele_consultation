let userData = null;

// URL de la playlist M3U
// const m3uUrl = 'https://iptv-org.github.io/iptv/countries/fr.m3u';
const m3uUrl = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';


function initApp() {
    try {
        const appManager = document.getElementById("applicationManager");
        const app = appManager.getOwnerApplication(document);
        app.show();
        app.activate();
    } catch (e) {
        console.log("Erreur HbbTV : " + e);
    }

    const token = localStorage.getItem("token");
    if (token) {
        loadUserInfo(token);
        showAuthenticatedUI();
        loadDoctors();
    }

    initNavigation();
}

function showAuthenticatedUI() {
    document.getElementById("login-btn").style.display = "none";
    document.getElementById("nav-buttons").style.display = "block";
    document.getElementById("user-info").style.display = "block";
    document.getElementById("welcome-message").style.display = "block";
}

function loadUserInfo(token) {
    fetch("http://localhost:5001/api/users/me", { 
        method: "GET",
        headers: { "Authorization": "Bearer " + token }
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur récupération utilisateur");
        return response.json();
    })
    .then(data => {
        userData = data;
        document.getElementById("user-fullname").textContent = data.fullname;
        document.getElementById("user-email").textContent = data.email;
        document.getElementById("user-role").textContent = data.role;
    })
    .catch(error => {
        console.log("Erreur chargement utilisateur : " + error);
        if (error.message.includes("401")) {
            logout();
        }
    });
}

function showLogin() {
    hideAllRightPanels();
    document.getElementById("login-form").style.display = "block";
    document.getElementById("email-input").focus();
}

function hideLogin() {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

function submitLogin() {
    const email = document.getElementById("email-input").value;
    const password = document.getElementById("password-input").value;

    if (!email || !password) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    fetch("http://localhost:5001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur de connexion");
        return response.json();
    })
    .then(data => {
        localStorage.setItem("token", data.access_token);
        loadUserInfo(data.access_token);
        loadDoctors();
        alert("Connexion réussie !");
        hideLogin();
        showAuthenticatedUI();
    })
    .catch(error => {
        alert(error.message || "Erreur lors de la connexion.");
    });
}

function logout() {
    localStorage.removeItem("token");
    userData = null;
    alert("Déconnexion réussie.");
    window.location.reload();
}

function showConsultation() {
    hideAllRightPanels();
    document.getElementById("consultation-form").style.display = "block";
    document.getElementById("symptoms-input").focus();
}

function hideConsultation() {
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

function submitConsultation() {
    const symptoms = document.getElementById("symptoms-input").value;
    if (!symptoms) {
        alert("Veuillez décrire vos symptômes.");
        return;
    }

    fetch("http://localhost:5001/api/consultation/start", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ symptoms })
    })
    .then(response => response.json())
    .then(data => {
        alert("Consultation démarrée ! ID: " + data.consultation_id);
        updateVideoSource("assets/video.mp4");
        hideConsultation();
    })
    .catch(error => {
        alert("Erreur lors de la soumission.");
    });
}

function showHistory() {
    hideAllRightPanels();
    document.getElementById("history-view").style.display = "block";

    fetch("http://localhost:5001/api/consultation/all", {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById("history-content");
        container.innerHTML = "";
        data.forEach(c => {
            const card = document.createElement("div");
            card.className = "consultation-card";
            card.innerHTML = `
                <p><strong>ID :</strong> ${c.id}</p>
                <p><strong>Symptômes :</strong> ${c.symptoms}</p>
                <p><strong>Diagnostic :</strong> ${c.diagnosis || "En attente"}</p>
            `;
            container.appendChild(card);
        });
    })
    .catch(error => {
        alert("Erreur lors de la récupération de l'historique.");
    });
}

function hideHistory() {
    document.getElementById("history-view").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

function showTips() {
    hideAllRightPanels();
    document.getElementById("tips-view").style.display = "block";

    fetch("http://localhost:5001/api/consultation/health-tips", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ patient_id: userData?.id || 1 })
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur lors de la requête");
        return response.json();
    })
    .then(data => {
        document.getElementById("tips-content").textContent = data.health_tips || "Restez hydraté !";
    })
    .catch(error => {
        alert("Erreur lors de la récupération des conseils : " + error.message);
    });
}

function hideTips() {
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

function loadDoctors() {
    console.log("Chargement des médecins...");
    fetch("http://localhost:5001/api/users/", {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => response.json())
    .then(data => {
        const doctorSelect = document.getElementById("doctor-select");
        doctorSelect.innerHTML = '<option value="">Choisir un médecin</option>';
        data
            .filter(user => user.role === "doctor" && user.is_available)
            .forEach(doctor => {
                const option = document.createElement("option");
                option.value = doctor.id;
                option.textContent = doctor.fullname;
                doctorSelect.appendChild(option);
            });
    })
    .catch(error => {
        console.log("Erreur chargement médecins : " + error);
    });
}

function showAppointment() {
    hideAllRightPanels();
    document.getElementById("appointment-form").style.display = "block";
    document.getElementById("doctor-select").focus();
}

function hideAppointment() {
    document.getElementById("appointment-form").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

function submitAppointment() {
    const doctorId = document.getElementById("doctor-select").value;
    const appointmentDate = document.getElementById("appointment-date").value;

    if (!doctorId || !appointmentDate) {
        alert("Veuillez sélectionner un médecin et une date.");
        return;
    }

    console.log("Envoi du RDV...", { doctorId, appointmentDate });
    fetch("http://localhost:5001/api/consultation/schedule-appointment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({
            doctor_id: parseInt(doctorId),
            appointment_date: appointmentDate.replace("T", " ")
        })
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur lors de la planification");
        return response.json();
    })
    .then(data => {
        alert("Rendez-vous planifié ! ID: " + data.appointment_id);
        hideAppointment();
    })
    .catch(error => {
        alert("Erreur : " + error.message);
    });
}

function showUpcomingAppointments() {
    hideAllRightPanels();
    document.getElementById("upcoming-appointments").style.display = "block";

    fetch("http://localhost:5001/api/consultation/upcoming-appointments", {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur lors de la récupération des RDV");
        return response.json();
    })
    .then(data => {
        const container = document.getElementById("appointments-content");
        container.innerHTML = "";
        if (data.length === 0) {
            container.innerHTML = "<p>Aucun rendez-vous à venir.</p>";
        } else {
            data.forEach(appointment => {
                const card = document.createElement("div");
                card.className = "appointment-card";
                card.innerHTML = `
                    <p><strong>ID :</strong> ${appointment.id}</p>
                    <p><strong>Patient :</strong> ${appointment.patient_name}</p>
                    <p><strong>Médecin :</strong> ${appointment.doctor_name}</p>
                    <p><strong>Date :</strong> ${new Date(appointment.appointment_date).toLocaleString()}</p>
                    <p><strong>Statut :</strong> ${appointment.status}</p>
                `;
                container.appendChild(card);
            });
        }
    })
    .catch(error => {
        alert("Erreur : " + error.message);
    });
}

function hideUpcomingAppointments() {
    document.getElementById("upcoming-appointments").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

// Nouvelle fonctionnalité : Afficher la liste des chaînes
async function showChannels() {
    hideAllRightPanels();
    document.getElementById("channel-selection").style.display = "block";
    const channelList = document.getElementById("channel-list");
    channelList.innerHTML = ""; // Réinitialiser la liste

    const channels = await fetchM3U();
    channels.forEach(channel => {
        const li = document.createElement("li");
        li.textContent = channel.name;
        li.onclick = () => changeChannel(channel.url);
        li.tabIndex = 0; // Rendre focusable pour la navigation
        channelList.appendChild(li);
    });
}

function hideChannels() {
    document.getElementById("channel-selection").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

// Récupérer et parser le fichier M3U
async function fetchM3U() {
    try {
        const response = await fetch(m3uUrl);
        const m3uData = await response.text();
        const lines = m3uData.split('\n');
        const channels = [];
        let currentChannel = null;

        lines.forEach(line => {
            if (line.startsWith('#EXTINF:')) {
                const name = line.split(',')[1].trim();
                currentChannel = { name };
            } else if (line.startsWith('http')) {
                currentChannel.url = line.trim();
                channels.push(currentChannel);
                currentChannel = null;
            }
        });

        return channels;
    } catch (error) {
        console.error('Erreur lors de la récupération du fichier M3U:', error);
        return [];
    }
}

// Changer la chaîne dans le lecteur vidéo
function changeChannel(url) {
    const video = document.getElementById("video-player");
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("Flux M3U chargé et prêt.");
            video.play();
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play();
    }
}

// Mettre à jour la source vidéo (pour les consultations)
function updateVideoSource(url) {
    const video = document.getElementById("video-player");
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        video.src = url;
        video.play();
    }
}

// Fonction utilitaire pour masquer tous les panneaux de droite
function hideAllRightPanels() {
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("login-form").style.display = "none";
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("appointment-form").style.display = "none";
    document.getElementById("upcoming-appointments").style.display = "none";
    document.getElementById("channel-selection").style.display = "none";
}



function showLiveSession() {
    hideAllRightPanels();
    document.getElementById("live-session").style.display = "block";
    const sessionSelect = document.getElementById("session-select");
    sessionSelect.innerHTML = '<option value="">Choisir une session</option>';

    fetch("http://localhost:5001/api/tnt/live-session/list", {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => response.json())
    .then(data => {
        data.forEach(session => {
            if (session.hls_url) {  // Ne montrer que les sessions avec HLS
                const option = document.createElement("option");
                option.value = session.id;
                option.textContent = session.title;
                sessionSelect.appendChild(option);
            }
        });
    })
    .catch(error => {
        console.error("Erreur chargement sessions:", error);
        alert("Erreur chargement sessions : " + error);
    });
}

function hideLiveSession() {
    document.getElementById("live-session").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

function playLiveSession() {
    const sessionId = document.getElementById("session-select").value;
    if (!sessionId) {
        alert("Veuillez sélectionner une session.");
        return;
    }

    fetch(`http://localhost:5001/api/tnt/live-session/${sessionId}/url`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => {
        if (!response.ok) throw new Error("Aucune diffusion disponible");
        return response.json();
    })
    .then(data => {
        console.log("HLS URL récupérée:", data.hls_url);
        updateVideoSource(data.hls_url);
        hideLiveSession();
    })
    .catch(error => {
        console.error("Erreur récupération URL:", error);
        alert("Erreur : " + error.message);
    });
}

function initNavigation() {
    const focusable = Array.from(document.querySelectorAll("button, input, textarea, select, #channel-list li"));
    let currentIndex = 0;

    document.addEventListener("keydown", (event) => {
        const activeElement = document.activeElement;

        if (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.tagName === "SELECT") {
            if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter") {
                event.preventDefault();
                if (event.key === "Enter" && activeElement.tagName !== "SELECT") {
                    activeElement.blur();
                    focusable[currentIndex].focus();
                }
            }
            return;
        }

        event.preventDefault();
        switch (event.key) {
            case "ArrowUp":
                currentIndex = (currentIndex - 1 + focusable.length) % focusable.length;
                focusable[currentIndex].focus();
                break;
            case "ArrowDown":
                currentIndex = (currentIndex + 1) % focusable.length;
                focusable[currentIndex].focus();
                break;
            case "Enter":
                focusable[currentIndex].click();
                break;
        }
    });

    if (focusable.length > 0) focusable[0].focus();
}
