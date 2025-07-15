document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAZSV573SyiddgzV8uzn7w6Ur0kdilI5tI",
        authDomain: "loja-pedidos-v1.firebaseapp.com",
        projectId: "loja-pedidos-v1",
        storageBucket: "loja-pedidos-v1.appspot.com",
        messagingSenderId: "624610926773",
        appId: "1:624610926773:web:6540a1ec6c1fca18819efc"
    };
    const { initializeApp, getFirestore, doc, getDoc } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) {
        console.error("Erro Firebase:", e);
        loginErrorEl.textContent = "Erro de conexão.";
        return;
    }

    // --- SELETORES ---
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginErrorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    // Se o usuário já estiver logado, redireciona para o admin
    if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
        window.location.href = 'admin.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username || !password) {
            loginErrorEl.textContent = 'Preencha todos os campos.';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Entrando...';
        loginErrorEl.textContent = '';

        try {
            // Referência ao documento do admin (o ID do documento é o username)
            const adminRef = doc(db, "admins", username);
            const docSnap = await getDoc(adminRef);

            // Verifica se o documento existe e se a senha corresponde
            if (docSnap.exists() && docSnap.data().password === password) {
                // Sucesso! Cria a flag na sessão e redireciona.
                sessionStorage.setItem('isAdminAuthenticated', 'true');
                window.location.href = 'admin.html';
            } else {
                loginErrorEl.textContent = 'Usuário ou senha incorretos.';
            }
        } catch (error) {
            console.error("Erro de autenticação: ", error);
            loginErrorEl.textContent = 'Erro ao tentar fazer login.';
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
        }
    });
});
