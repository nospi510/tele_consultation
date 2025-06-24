document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const email = document.querySelector('#email').value;
            const password = document.querySelector('#password').value;

            try {
                const response = await fetch('http://localhost:5001/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Échec de la connexion');
                }

                // Stocker le jeton dans localStorage
                localStorage.setItem('access_token', data.access_token);
                console.log('Jeton stocké:', data.access_token);

                // Rediriger vers le tableau de bord
                window.location.href = '/api/auth/home_page';
            } catch (error) {
                console.error('Erreur de connexion:', error);
                const errorDiv = document.querySelector('#error-message');
                if (errorDiv) {
                    errorDiv.textContent = error.message;
                }
            }
        });
    }
});