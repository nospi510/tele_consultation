let userData = null;
const m3uUrl = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
let socket = null;
let currentSessionId = null;

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
        initSocketIO(token);
    }

    initNavigation();
}

function initSocketIO(token) {
    socket = io('http://localhost:5001/live', {
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('Connecté à SocketIO');
        if (currentSessionId && userData?.id) {
            socket.emit('join_session', { session_id: currentSessionId, user_id: userData.id });
            console.log('Rejoint session:', currentSessionId);
        }
    });

    socket.on('questions_enabled', (data) => {
        console.log('Événement questions_enabled reçu:', data);
        if (data.session_id == currentSessionId) {
            console.log('Activation des questions pour session:', data.session_id);
            document.getElementById('question-form').style.display = 'block';
            document.getElementById('questions-status').innerHTML = '<p class="text-success">Les questions sont activées.</p>';
        } else {
            console.log('Événement ignoré, session_id ne correspond pas:', data.session_id, currentSessionId);
        }
    });

    socket.on('questions_disabled', (data) => {
        console.log('Événement questions_disabled reçu:', data);
        if (data.session_id == currentSessionId) {
            console.log('Désactivation des questions pour session:', data.session_id);
            document.getElementById('question-form').style.display = 'none';
            document.getElementById('questions-status').innerHTML = '<p class="text-muted">Les questions sont désactivées.</p>';
        } else {
            console.log('Événement ignoré, session_id ne correspond pas:', data.session_id, currentSessionId);
        }
    });

    socket.on('new_question', (data) => {
        console.log('Nouvelle question reçue:', data);
        if (data.session_id == currentSessionId) {
            addQuestionToList(data);
        }
    });

    socket.on('new_answer', (data) => {
        console.log('Nouvelle réponse reçue:', data);
        if (data.session_id == currentSessionId) {
            updateQuestionWithAnswer(data);
        }
    });

        socket.on('quiz_enabled', (data) => {
        console.log('Événement quiz_enabled reçu:', data);
        if (data.session_id == currentSessionId) {
            console.log('Activation quiz pour session:', data.session_id);
            displayQuiz(data);
        } else {
            console.log('Événement quiz ignoré, session_id ne correspond pas:', data.session_id, currentSessionId);
        }
    });

    socket.on('quiz_disabled', (data) => {
        console.log('Événement quiz_disabled reçu:', data);
        if (data.session_id == currentSessionId) {
            console.log('Désactivation quiz pour session:', data.session_id);
            document.getElementById('quiz-content').style.display = 'none';
            document.getElementById('quiz-results').style.display = 'none';
            document.getElementById('quiz-status').innerHTML = '<p class="text-muted">Le quiz est désactivé.</p>';
        } else {
            console.log('Événement quiz ignoré, session_id ne correspond pas:', data.session_id, currentSessionId);
        }
    });

    

    socket.on('disconnect', () => {
        console.log('Déconnecté de SocketIO');
    });

    socket.on('connect_error', (error) => {
        console.error('Erreur de connexion SocketIO:', error);
    });
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
        initSocketIO(data.access_token);
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
    if (socket) socket.disconnect();
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
            card.className = "consultation-card card shadow-sm glass-effect mb-2";
            card.innerHTML = `
                <div class="card-body">
                    <p><strong>ID :</strong> ${c.id}</p>
                    <p><strong>Symptômes :</strong> ${c.symptoms}</p>
                    <p><strong>Diagnostic :</strong> ${c.diagnosis || "En attente"}</p>
                </div>
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
            container.innerHTML = "<p class='text-muted'>Aucun rendez-vous à venir.</p>";
        } else {
            data.forEach(appointment => {
                const card = document.createElement("div");
                card.className = "appointment-card card shadow-sm glass-effect mb-2";
                card.innerHTML = `
                    <div class="card-body">
                        <p><strong>ID :</strong> ${appointment.id}</p>
                        <p><strong>Patient :</strong> ${appointment.patient_name}</p>
                        <p><strong>Médecin :</strong> ${appointment.doctor_name}</p>
                        <p><strong>Date :</strong> ${new Date(appointment.appointment_date).toLocaleString()}</p>
                        <p><strong>Statut :</strong> ${appointment.status}</p>
                    </div>
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

async function showChannels() {
    hideAllRightPanels();
    document.getElementById("channel-selection").style.display = "block";
    const channelList = document.getElementById("channel-list");
    channelList.innerHTML = "";

    const channels = await fetchM3U();
    channels.forEach(channel => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action glass-effect";
        li.innerHTML = `<i class="bi bi-tv me-2"></i>${channel.name}`;
        li.onclick = () => changeChannel(channel.url);
        li.tabIndex = 0;
        channelList.appendChild(li);
    });
}

function hideChannels() {
    document.getElementById("channel-selection").style.display = "none";
    document.getElementById("welcome-message").style.display = "block";
}

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

function showLiveSession() {
    hideAllRightPanels();
    document.getElementById("live-session").style.display = "block";
    const sessionSelect = document.getElementById("session-select");
    sessionSelect.innerHTML = '<option value="">Choisir une session</option>';

    fetch("http://localhost:5001/api/tnt/live-session/list", {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur lors du chargement des sessions");
        return response.json();
    })
    .then(data => {
        data.forEach(session => {
            if (session.hls_urls && session.hls_urls.length > 0) {
                const option = document.createElement("option");
                option.value = session.id;
                option.textContent = `${session.title} (${session.broadcasters.join(', ') || 'En direct'})`;
                sessionSelect.appendChild(option);
            }
        });
    })
    .catch(error => {
        console.error("Erreur chargement sessions:", error);
        alert("Erreur chargement sessions : " + error.message);
    });
}

function hideLiveSession() {
    document.getElementById("live-session").style.display = "none";
    document.getElementById("question-form").style.display = "none";
    document.getElementById("questions-status").innerHTML = '<p class="text-muted">Les questions sont désactivées.</p>';
    document.getElementById("questions-list").innerHTML = "";
    if (socket && currentSessionId) {
        socket.emit('leave_session', { session_id: currentSessionId, user_id: userData?.id });
        currentSessionId = null;
    }
    document.getElementById("welcome-message").style.display = "block";
}

function playLiveSession() {
    const sessionId = document.getElementById("session-select").value;
    if (!sessionId) {
        console.log('Aucune session sélectionnée');
        alert("Veuillez sélectionner une session.");
        return;
    }

    currentSessionId = sessionId;
    console.log('currentSessionId défini:', currentSessionId);
    fetch(`http://localhost:5001/api/tnt/live-session/${sessionId}/url`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => {
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}: Aucune diffusion disponible`);
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Aucun flux disponible pour cette session");
        }
        const hlsUrl = data[0].hls_url;
        console.log("HLS URL sélectionnée:", hlsUrl);
        updateVideoSource(hlsUrl);
        if (socket && socket.connected && userData?.id) {
            socket.emit('join_session', {
                session_id: sessionId,
                user_id: userData.id
            });
            console.log('Émis join_session pour session:', sessionId);
        } else {
            console.warn('SocketIO non connecté ou userData manquant:', { socketConnected: socket?.connected, userId: userData?.id });
        }
        loadQuestions(sessionId);
    })
    .catch(error => {
        console.error("Erreur récupération URL:", error);
        alert("Erreur : " + error.message);
    });
}


function loadQuestions(sessionId) {
    fetch(`http://localhost:5001/api/tnt/live-session/${sessionId}/questions`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => {
        if (!response.ok) throw new Error("Erreur chargement questions");
        return response.json();
    })
    .then(data => {
        const questionsList = document.getElementById("questions-list");
        questionsList.innerHTML = "";
        data.forEach(q => addQuestionToList(q));
        checkQuestionsStatus(sessionId);
    })
    .catch(error => {
        console.error("Erreur chargement questions:", error);
    });
}

function checkQuestionsStatus(sessionId) {
    console.log('Vérification statut questions pour session:', sessionId);
    fetch(`http://localhost:5001/api/tnt/live-session/${sessionId}`, {
        method: "GET",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Statut session reçu:', data);
        if (data.questions_enabled) {
            console.log('Questions activées pour session:', sessionId);
            document.getElementById('question-form').style.display = 'block';
            document.getElementById('questions-status').innerHTML = '<p class="text-success">Les questions sont activées.</p>';
        } else {
            console.log('Questions désactivées pour session:', sessionId);
            document.getElementById('question-form').style.display = 'none';
            document.getElementById('questions-status').innerHTML = '<p class="text-muted">Les questions sont désactivées.</p>';
        }
    })
    .catch(error => {
        console.error('Erreur lors de la vérification du statut des questions:', error);
        document.getElementById('question-form').style.display = 'none';
        document.getElementById('questions-status').innerHTML = '<p class="text-muted">Les questions sont désactivées (erreur).</p>';
    });
}

function submitQuestion() {
    const questionText = document.getElementById("question-input").value;
    if (!questionText.trim()) {
        console.log('Champ de question vide');
        alert("Veuillez entrer une question.");
        return;
    }

    if (!currentSessionId) {
        console.error('currentSessionId non défini');
        alert("Erreur : Aucune session sélectionnée. Veuillez choisir une session.");
        return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        console.error('Token non trouvé dans localStorage');
        alert("Erreur : Vous devez être connecté pour poser une question.");
        return;
    }

    console.log('Envoi de la question:', { sessionId: currentSessionId, questionText });
    fetch(`http://localhost:5001/api/tnt/live-session/${currentSessionId}/questions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ question_text: questionText })
    })
    .then(response => {
        console.log('Réponse de la requête POST:', response);
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}: Échec de l'envoi de la question`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Question envoyée avec succès:', data);
        document.getElementById("question-input").value = "";
    })
    .catch(error => {
        console.error('Erreur lors de l’envoi de la question:', error);
        alert(`Erreur lors de l'envoi de la question : ${error.message}`);
    });
}
function addQuestionToList(data) {
    const questionsList = document.getElementById("questions-list");
    const card = document.createElement("div");
    card.className = "question-card card shadow-sm glass-effect mb-2";
    card.dataset.questionId = data.id;
    card.innerHTML = `
        <div class="card-body">
            <p><strong>${data.user} :</strong> ${data.question_text}</p>
            ${data.answer_text ? `<p><strong>Réponse :</strong> ${data.answer_text}</p>` : ''}
        </div>
    `;
    questionsList.appendChild(card);
}

function updateQuestionWithAnswer(data) {
    const questionCard = document.querySelector(`.question-card[data-question-id="${data.question_id}"]`);
    if (questionCard) {
        const cardBody = questionCard.querySelector('.card-body');
        const answerP = document.createElement("p");
        answerP.innerHTML = `<strong>Réponse :</strong> ${data.answer_text}`;
        cardBody.appendChild(answerP);
    }
}

function displayQuiz(data) {
    console.log('Affichage quiz HbbTV:', data);
    const quizContent = document.getElementById('quiz-content');
    quizContent.style.display = 'block';
    document.getElementById('quiz-results').style.display = 'none';
    quizContent.innerHTML = `
        <div class="quiz-card card shadow-sm glass-effect mb-3" style="background-color: #333; color: #fff; border: 1px solid #555;">
            <div class="card-body">
                <h5 style="color: #fff;">${data.question}</h5>
                <div id="quiz-timer" class="mb-3" style="color: #0f0;">Temps restant : ${data.duration}s</div>
                <div id="quiz-options">
                    ${data.options.map((option, index) => `
                        <button class="quiz-option btn w-100 mb-2" style="background-color: #007bff; color: #fff; border: 1px solid #0056b3;" data-option="${index}" tabindex="0">${option}</button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.getElementById('quiz-status').innerHTML = '<p class="text-success">Le quiz est activé.</p>';
    startTimer(data.expires_at, data.duration, data);
    initQuizNavigation(data);
}

function startTimer(expiresAt, duration, quizData) {
    console.log('Démarrage timer HbbTV, expiresAt:', expiresAt, 'duration:', duration);
    const timerDiv = document.getElementById('quiz-timer');
    if (!timerDiv) {
        console.error('quiz-timer introuvable');
        showQuizResult(quizData);
        return;
    }
    const endTime = new Date(expiresAt).getTime();
    if (isNaN(endTime) || endTime <= Date.now()) {
        console.error('expiresAt invalide ou déjà expiré:', expiresAt);
        showQuizResult(quizData);
        return;
    }
    let secondsLeft = Math.min(duration, Math.floor((endTime - Date.now()) / 1000));
    timerDiv.textContent = `Temps restant : ${secondsLeft}s`;
    const interval = setInterval(() => {
        secondsLeft = Math.max(0, secondsLeft - 1);
        console.log('Timer tick:', secondsLeft);
        timerDiv.textContent = `Temps restant : ${secondsLeft}s`;
        if (secondsLeft <= 0) {
            clearInterval(interval);
            console.log('Timer expiré');
            document.querySelectorAll('.quiz-option').forEach(button => button.disabled = true);
            showQuizResult(quizData);
        }
    }, 1000);
}

function showQuizResult(data) {
    console.log('Affichage résultat quiz HbbTV:', data);
    const quizContent = document.getElementById('quiz-content');
    quizContent.style.display = 'block';
    document.getElementById('quiz-results').style.display = 'none';
    quizContent.innerHTML = `
        <div class="quiz-card card shadow-sm glass-effect mb-3" style="background-color: #333; color: #fff; border: 1px solid #555;">
            <div class="card-body">
                <h5 style="color: #fff;">${data.question}</h5>
                <div id="quiz-options">
                    ${data.options.map((option, index) => `
                        <button class="quiz-option btn w-100 mb-2" style="background-color: ${index === data.correct_option ? '#28a745' : '#6c757d'}; color: #fff; border: 1px solid ${index === data.correct_option ? '#218838' : '#5a6268'};" disabled>${option}</button>
                    `).join('')}
                </div>
                <p class="text-success mt-3">Bonne réponse : ${data.options[data.correct_option]}</p>
            </div>
        </div>
    `;
}

function submitQuizAnswer(quizId, selectedOption) {
    console.log('Envoi réponse quiz HbbTV:', { quiz_id: quizId, selected_option: selectedOption });
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Token non trouvé');
        alert('Erreur : Vous devez être connecté.');
        return;
    }
    fetch(`http://localhost:5001/api/tnt/live-session/${currentSessionId}/quiz/${quizId}/answer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ selected_option: selectedOption })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}: Échec envoi réponse`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Réponse quiz envoyée:', data);
    })
    .catch(error => {
        console.error('Erreur envoi réponse quiz:', error);
        alert(`Erreur : ${error.message}`);
        document.querySelectorAll('.quiz-option').forEach(button => button.disabled = false);
    });
}

function initQuizNavigation(quizData) {
    console.log('Initialisation navigation quiz HbbTV');
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach((button, index) => {
        button.disabled = false;
        button.addEventListener('click', () => {
            console.log('Clic sur option:', button.dataset.option);
            buttons.forEach(btn => btn.disabled = true);
            const selectedOption = parseInt(button.dataset.option);
            submitQuizAnswer(quizData.quiz_id, selectedOption);
            showQuizResult(quizData);
        }, { once: true });
    });
    if (buttons.length > 0) {
        buttons[0].focus();
    }
}


function hideAllRightPanels() {
    document.getElementById("welcome-message").style.display = "none";
    document.getElementById("login-form").style.display = "none";
    document.getElementById("consultation-form").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("tips-view").style.display = "none";
    document.getElementById("appointment-form").style.display = "none";
    document.getElementById("upcoming-appointments").style.display = "none";
    document.getElementById("channel-selection").style.display = "none";
    document.getElementById("live-session").style.display = "none";
}


function initNavigation() {
    const focusable = Array.from(document.querySelectorAll("button, input, textarea, select, .list-group-item"));
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
                if (focusable[currentIndex].classList.contains('list-group-item')) {
                    focusable[currentIndex].click();
                } else {
                    focusable[currentIndex].click();
                }
                break;
        }
    });

    if (focusable.length > 0) focusable[0].focus();
}