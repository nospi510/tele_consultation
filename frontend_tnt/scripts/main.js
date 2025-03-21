let userData = null;

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
        loadDoctors(); // Charger les médecins au démarrage
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
    document.getElementById("welcome-message").style.display = "none";
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
        loadDoctors(); // Charger les médecins après connexion
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
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("consultation-form").style.display = "block";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("appointment-form").style.display = "none";
    document.getElementById("upcoming-appointments").style.display = "none";
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
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("history-view").style.display = "block";
    document.getElementById("appointment-form").style.display = "none";
    document.getElementById("upcoming-appointments").style.display = "none";

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
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("tips-view").style.display = "block";
    document.getElementById("appointment-form").style.display = "none";
    document.getElementById("upcoming-appointments").style.display = "none";

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

function updateVideoSource(url) {
    const video = document.getElementById("video-player");
    video.src = url;
    video.load();
    video.play();
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
    console.log("Affichage du formulaire de RDV...");
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("appointment-form").style.display = "block";
    document.getElementById("upcoming-appointments").style.display = "none";
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
            appointment_date: appointmentDate.replace("T", " ") // Convertit "2025-03-20T00:00" en "2025-03-20 00:00"
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
    console.log("Affichage des RDV à venir...");
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("appointment-form").style.display = "none";
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

function initNavigation() {
    const focusable = Array.from(document.querySelectorAll("button, input, textarea, select")); // Ajout de select
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