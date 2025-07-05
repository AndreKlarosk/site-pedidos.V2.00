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
    const { initializeApp, getFirestore, collection, doc, writeBatch } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) {
        console.error("Erro Firebase:", e);
        log("ERRO: Falha ao conectar com o banco de dados.", true);
        return;
    }

    // --- SELETORES ---
    const fileInput = document.getElementById('csv-file');
    const importBtn = document.getElementById('import-btn');
    const logArea = document.getElementById('log-area');

    // --- FUNÇÕES ---
    function log(message, isError = false) {
        logArea.classList.remove('hidden');
        const p = document.createElement('p');
        p.textContent = `> ${message}`;
        if (isError) {
            p.className = 'text-red-400';
        }
        logArea.appendChild(p);
        logArea.scrollTop = logArea.scrollHeight; // Auto-scroll
    }

    async function handleImport() {
        const file = fileInput.files[0];
        if (!file) {
            log("Nenhum arquivo selecionado.", true);
            return;
        }

        importBtn.disabled = true;
        importBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Importando...';
        log(`Arquivo "${file.name}" selecionado. Lendo...`);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                log(`${data.length} produtos encontrados no arquivo.`);
                
                if (data.length === 0 || !data[0].nome || !data[0].preco || !data[0].unidadeMedida || !data[0].categoria) {
                    log("ERRO: O arquivo CSV parece estar vazio ou com cabeçalhos incorretos. Verifique as instruções.", true);
                    importBtn.disabled = false;
                    importBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Iniciar Importação';
                    return;
                }

                const batchSize = 400; // Firestore permite até 500, usamos um valor seguro.
                for (let i = 0; i < data.length; i += batchSize) {
                    const chunk = data.slice(i, i + batchSize);
                    const batch = writeBatch(db);
                    
                    log(`Preparando lote ${i / batchSize + 1}...`);

                    chunk.forEach(item => {
                        // Validação e limpeza dos dados
                        const produto = {
                            nome: item.nome?.trim(),
                            preco: parseFloat(item.preco?.replace(',', '.')),
                            unidadeMedida: item.unidadeMedida?.trim(),
                            categoria: item.categoria?.trim().toLowerCase()
                        };

                        if (produto.nome && !isNaN(produto.preco) && produto.unidadeMedida && produto.categoria) {
                            const newProductRef = doc(collection(db, "produtos"));
                            batch.set(newProductRef, produto);
                        } else {
                            log(`AVISO: Item "${item.nome || 'desconhecido'}" ignorado por conter dados inválidos.`);
                        }
                    });

                    try {
                        log(`Enviando lote de ${chunk.length} produtos...`);
                        await batch.commit();
                        log(`Lote ${i / batchSize + 1} enviado com sucesso!`);
                    } catch (error) {
                        console.error(error);
                        log(`ERRO ao enviar o lote ${i / batchSize + 1}.`, true);
                    }
                    // Pausa para não sobrecarregar o Firestore
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                log("Importação concluída com sucesso!");
                importBtn.disabled = false;
                importBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Iniciar Importação';
            },
            error: (error) => {
                console.error(error);
                log(`ERRO ao ler o arquivo CSV: ${error.message}`, true);
                importBtn.disabled = false;
                importBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Iniciar Importação';
            }
        });
    }

    // --- EVENT LISTENER ---
    importBtn.addEventListener('click', handleImport);
});
