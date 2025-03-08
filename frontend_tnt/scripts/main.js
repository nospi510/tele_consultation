function initApp() {
  // Acquire the Application object
  var appManager = document.getElementById('applicationManager');
  var appObject = appManager.getOwnerApplication(document);
  if (appObject !== null) {
      appObject.show();
  }

  // Vérifier si l'utilisateur est déjà connecté
  const token = localStorage.getItem('token');
  if (token) {
      showAuthenticatedUI();
  } else {
      showLoginForm();
  }

  // Initialiser la navigation
  initNavigation();
}

function showAuthenticatedUI() {
  document.getElementById('login_form').style.display = 'none';
  document.getElementById('authenticated_ui').style.display = 'grid';

  // Charger les informations de l'utilisateur
  fetch('http://localhost:5001/api/user/info', {
      method: 'GET',
      headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
  })
  .then(response => response.json())
  .then(data => {
      document.getElementById('user_name_value').innerText = data.name;
      document.getElementById('user_email_value').innerText = data.email;
  })
  .catch(error => {
      console.error("Erreur lors de la récupération des informations de l'utilisateur:", error);
  });
}

function showLoginForm() {
  document.getElementById('login_form').style.display = 'block';
  document.getElementById('authenticated_ui').style.display = 'none';
}

function submitLogin() {
  const email = document.getElementById('login_email').value;
  const password = document.getElementById('login_password').value;

  if (!email || !password) {
      alert("Veuillez remplir tous les champs.");
      return;
  }

  fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email, password: password })
  })
  .then(response => {
      if (!response.ok) {
          throw new Error("Identifiants invalides");
      }
      return response.json();
  })
  .then(data => {
      // Stocker le token JWT et l'ID utilisateur dans le localStorage
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user_id', data.user_id); // Si l'API renvoie l'ID de l'utilisateur
      alert("Connexion réussie !");
      showAuthenticatedUI();
  })
  .catch(error => {
      alert(error.message || "Erreur lors de la connexion.");
  });
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user_id');
  alert("Déconnexion réussie.");
  showLoginForm();
}

// Afficher le formulaire de consultation
function showConsultationForm() {
  document.getElementById('main_menu').style.display = 'none';
  document.getElementById('consultation_form').style.display = 'block';
}

// Masquer le formulaire de consultation
function hideConsultationForm() {
  document.getElementById('consultation_form').style.display = 'none';
  document.getElementById('main_menu').style.display = 'block';
}

// Soumettre une consultation
function submitConsultation() {
  const symptoms = document.getElementById('symptoms_input').value;

  if (!symptoms) {
      alert("Veuillez décrire vos symptômes.");
      return;
  }

  fetch('http://localhost:5001/api/consultation/start', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token') // Ajout du token
      },
      body: JSON.stringify({ symptoms: symptoms })
  })
  .then(response => response.json())
  .then(data => {
      alert("Consultation démarrée avec succès !");
      hideConsultationForm();
  })
  .catch(error => {
      alert("Erreur lors de la soumission de la consultation.");
  });
}

// Afficher les consultations passées
function showPastConsultations() {
  document.getElementById('main_menu').style.display = 'none';
  document.getElementById('consultations_list').style.display = 'block';

  fetch('http://localhost:5001/api/consultation/all', {
      method: 'GET',
      headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
  })
  .then(response => {
      if (!response.ok) {
          return response.json().then(err => { throw err; });
      }
      return response.json();
  })
  .then(data => {
      const container = document.getElementById('consultations_container');
      container.innerHTML = '';

      data.forEach(consultation => {
          const item = document.createElement('div');
          item.className = 'consultation_item';
          item.innerHTML = `
              <h3>Consultation du ${new Date(consultation.created_at).toLocaleDateString()}</h3>
              <p><strong>Symptômes :</strong> ${consultation.symptoms}</p>
              <p><strong>Diagnostic :</strong> ${consultation.diagnosis || "En attente"}</p>
          `;
          container.appendChild(item);
      });
  })
  .catch(error => {
      console.error("Erreur:", error);
      if (error.message === "Unauthorized") {
          alert("Session expirée. Veuillez vous reconnecter.");
          logout(); // Déconnecter l'utilisateur
      } else {
          alert("Erreur lors de la récupération des consultations.");
      }
  });
}

// Masquer les consultations passées
function hidePastConsultations() {
  document.getElementById('consultations_list').style.display = 'none';
  document.getElementById('main_menu').style.display = 'block';
}

// Afficher les conseils de santé
function showHealthTips() {
  document.getElementById('main_menu').style.display = 'none';
  document.getElementById('advice_display').style.display = 'block';

  fetch('http://localhost:5001/api/consultation/health-tips', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ patient_id: localStorage.getItem('user_id') })
  })
  .then(response => response.json())
  .then(data => {
      document.getElementById('advice_text').innerText = data.health_tips;
  })
  .catch(error => {
      alert("Erreur lors de la récupération des conseils de santé.");
  });
}

// Masquer les conseils de santé
function hideHealthTips() {
  document.getElementById('advice_display').style.display = 'none';
  document.getElementById('main_menu').style.display = 'block';
}

// Récupérer les conseils pour un symptôme spécifique
function getAdvice(symptomId) {
  fetch(`http://localhost:5001/api/tnt/advice?symptom_id=${symptomId}`)
      .then(response => response.json())
      .then(data => {
          document.getElementById('advice_text').innerText = data.advice;
          document.getElementById('main_menu').style.display = 'none';
          document.getElementById('advice_display').style.display = 'block';
      })
      .catch(error => {
          alert("Erreur lors de la récupération des conseils.");
      });
}

// Masquer les conseils
function hideAdvice() {
  document.getElementById('advice_display').style.display = 'none';
  document.getElementById('main_menu').style.display = 'block';
}


