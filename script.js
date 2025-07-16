document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES GLOBAIS ---
    let categorias = {}; 
     const statusPedido = {
        'Recebido': { texto: 'Recebido', cor: 'text-blue-600' },
        'Em Preparacao': { texto: 'Em Preparação', cor: 'text-yellow-600' },
        'Pronto': { texto: 'Pronto para Retirada/Entrega', cor: 'text-green-600' },
        'Finalizado': { texto: 'Finalizado', cor: 'text-gray-600' },
        'Cancelado': { texto: 'Cancelado', cor: 'text-red-600' }
    };
    const ITENS_POR_PAGINA = 16;

    // --- INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAZSV573SyiddgzV8uzn7w6Ur0kdilI5tI",
        authDomain: "loja-pedidos-v1.firebaseapp.com",
        projectId: "loja-pedidos-v1",
        storageBucket: "loja-pedidos-v1.appspot.com",
        messagingSenderId: "624610926773",
        appId: "1:624610926773:web:6540a1ec6c1fca18819efc"
    };
    const { initializeApp, getFirestore, collection, onSnapshot, query, doc, getDoc, where, updateDoc, setDoc, increment } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) { console.error("Erro Firebase:", e); return; }

    // --- ESTADO DA APLICAÇÃO ---
    let todosProdutos = [];
    let produtosFiltrados = [];
    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
    let paginaAtual = 1;

    // --- SELETORES DO DOM ---
    const produtosListaEl = document.getElementById('produtos-lista');
    const pesquisaProdutoInput = document.getElementById('pesquisa-produto');
    const filtroCategoriaEl = document.getElementById('filtro-categoria');
    const cartCounterEl = document.getElementById('cart-counter');
    const consultaIdInput = document.getElementById('consulta-id-input');
    const consultarPedidoBtn = document.getElementById('consultar-pedido-btn');
    const resultadoConsultaEl = document.getElementById('resultado-consulta');
    const modalProduto = document.getElementById('modal-produto');
    const fecharModalProdutoBtn = document.getElementById('fechar-modal-produto');
    const modalAddCarrinhoBtn = document.getElementById('modal-add-carrinho-btn');
    const modalProdutoQtdInput = document.getElementById('modal-produto-qtd');
    const paginationContainer = document.getElementById('pagination-container');

    // --- FUNÇÕES ---
    function updateCartCounter() {
        const totalItems = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
        if (totalItems > 0) {
            cartCounterEl.textContent = totalItems;
            cartCounterEl.classList.remove('hidden');
        } else {
            cartCounterEl.classList.add('hidden');
        }
    }
    
    function animateCart() {
        cartCounterEl.classList.add('animate-bounce');
        setTimeout(() => {
            cartCounterEl.classList.remove('animate-bounce');
        }, 1000);
    }

    function popularFiltros() {
        filtroCategoriaEl.innerHTML = '<option value="todos">Todas as Categorias</option>';
        for (const key in categorias) {
            filtroCategoriaEl.innerHTML += `<option value="${key}">${categorias[key].nome}</option>`;
        }
    }

    const renderizarProdutos = (produtos, containerEl) => {
        containerEl.innerHTML = produtos.length === 0 ? '<p class="text-gray-500 col-span-full">Nenhum produto encontrado para esta página.</p>' : '';
        produtos.forEach(({ id, data: produto }) => {
            const produtoCard = document.createElement('div');
            produtoCard.dataset.id = id;
            produtoCard.className = `produto-card cursor-pointer bg-white rounded-lg shadow-md overflow-hidden flex flex-col justify-between transform hover:scale-105 transition-transform duration-300 ${produto.destaque ? 'border-2 border-yellow-400' : ''}`;
            
            const icone = categorias[produto.categoria]?.icone || 'fa-solid fa-box';
            const nomeCategoria = categorias[produto.categoria]?.nome || 'Sem Categoria';
            const placeholderImg = 'logo.png';
            
            const imagemOuIconeHtml = produto.imageUrl 
                ? `<img src="${produto.imageUrl}" alt="${produto.nome}" class="w-full h-48 object-cover" onerror="this.onerror=null;this.src='${placeholderImg}';">`
                : `<div class="w-full h-48 flex items-center justify-center bg-gray-100"><i class="${icone} text-6xl text-gray-400"></i></div>`;

            produtoCard.innerHTML = `
                <div>
                    ${produto.destaque ? '<div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">DESTAQUE</div>' : ''}
                    ${imagemOuIconeHtml}
                    <div class="p-4">
                        <h3 class="text-lg font-semibold h-12">${produto.nome}</h3>
                        <p class="text-gray-500 text-sm mb-2">${nomeCategoria}</p>
                    </div>
                </div>
                <div class="p-4 pt-0">
                     <p class="text-primary-hover font-bold text-2xl my-2">R$ ${produto.preco.toFixed(2).replace('.', ',')} / ${produto.unidadeMedida}</p>
                </div>
            `;
            containerEl.appendChild(produtoCard);
        });
    };

    const renderizarPaginaAtual = () => {
        const startIndex = (paginaAtual - 1) * ITENS_POR_PAGINA;
        const endIndex = startIndex + ITENS_POR_PAGINA;
        const produtosDaPagina = produtosFiltrados.slice(startIndex, endIndex);
        renderizarProdutos(produtosDaPagina, produtosListaEl);
        document.getElementById('produtos-lista').scrollIntoView({ behavior: 'smooth' });
    };

    const renderizarPaginacao = () => {
        const totalPaginas = Math.ceil(produtosFiltrados.length / ITENS_POR_PAGINA);
        paginationContainer.innerHTML = '';

        if (totalPaginas <= 1) return;

        const criarBotao = (texto, pagina, desabilitado = false) => {
            const button = document.createElement('button');
            button.innerHTML = texto;
            button.disabled = desabilitado;
            button.className = `px-4 py-2 rounded-md font-semibold transition-colors ${desabilitado ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white text-primary-hover hover:bg-primary hover:text-white'}`;
            
            if (pagina === paginaAtual && typeof texto === 'number') {
                button.className = 'px-4 py-2 rounded-md font-semibold bg-primary text-white cursor-default';
            }

            button.addEventListener('click', () => {
                paginaAtual = pagina;
                renderizarPaginaAtual();
                renderizarPaginacao();
            });
            return button;
        };

        paginationContainer.appendChild(criarBotao('<i class="fa-solid fa-chevron-left"></i>', paginaAtual - 1, paginaAtual === 1));

        const numerosPagina = new Set();
        numerosPagina.add(1);
        numerosPagina.add(totalPaginas);
        numerosPagina.add(paginaAtual);
        if (paginaAtual > 1) numerosPagina.add(paginaAtual - 1);
        if (paginaAtual < totalPaginas) numerosPagina.add(paginaAtual + 1);
        if (paginaAtual > 2) numerosPagina.add(paginaAtual - 2);
        if (paginaAtual < totalPaginas - 1) numerosPagina.add(paginaAtual + 2);

        const paginasOrdenadas = Array.from(numerosPagina).sort((a,b) => a - b);
        let ultimoNumero = 0;

        paginasOrdenadas.forEach(num => {
            if (num > ultimoNumero + 1) {
                const reticencias = document.createElement('span');
                reticencias.textContent = '...';
                reticencias.className = 'px-4 py-2 text-gray-500';
                paginationContainer.appendChild(reticencias);
            }
            if(num >= 1 && num <= totalPaginas) {
                paginationContainer.appendChild(criarBotao(num, num));
                ultimoNumero = num;
            }
        });

        paginationContainer.appendChild(criarBotao('<i class="fa-solid fa-chevron-right"></i>', paginaAtual + 1, paginaAtual === totalPaginas));
    };

    const filtrarErenderizar = () => {
        const termo = pesquisaProdutoInput.value.toLowerCase();
        const categoria = filtroCategoriaEl.value;
        
        let tempProdutos = todosProdutos;
        if (categoria !== 'todos') {
            tempProdutos = tempProdutos.filter(p => p.data.categoria === categoria);
        }
        if (termo) {
            tempProdutos = tempProdutos.filter(p => p.data.nome.toLowerCase().includes(termo));
        }
        
        tempProdutos.sort((a, b) => (b.data.destaque ? 1 : 0) - (a.data.destaque ? 1 : 0));
        
        produtosFiltrados = tempProdutos;
        paginaAtual = 1;
        
        renderizarPaginaAtual();
        renderizarPaginacao();
    };

    function carregarProdutos() {
        const q = query(collection(db, "produtos"), where("ativo", "==", true));
        onSnapshot(q, (snapshot) => {
            todosProdutos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
            filtrarErenderizar();
        });
    }

    function adicionarAoCarrinho(produtoId, quantidade) {
        const produtoData = todosProdutos.find(p => p.id === produtoId);
        if (!produtoData) return;
        
        const itemExistente = carrinho.find(item => item.id === produtoId);
        
        if (itemExistente) {
            itemExistente.quantidade += quantidade;
        } else {
            const produto = produtoData.data;
            carrinho.push({
                id: produtoId,
                nome: produto.nome,
                preco: produto.preco,
                unidadeMedida: produto.unidadeMedida,
                categoria: produto.categoria,
                imageUrl: produto.imageUrl || '',
                quantidade: quantidade
            });
        }
        
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        updateCartCounter();
        animateCart();
    }

    function abrirModalProduto(produtoId) {
        const produtoData = todosProdutos.find(p => p.id === produtoId);
        if (!produtoData) return;
        const { id, data: produto } = produtoData;
        
        const nomeCategoria = categorias[produto.categoria]?.nome || 'Sem Categoria';
        const placeholderImg = 'logo.png';

        document.getElementById('modal-produto-nome').textContent = produto.nome;
        document.getElementById('modal-produto-imagem').src = produto.imageUrl || placeholderImg;
        document.getElementById('modal-produto-imagem').onerror = function() { this.src = placeholderImg; };
        document.getElementById('modal-produto-preco').textContent = `R$ ${produto.preco.toFixed(2).replace('.', ',')} / ${produto.unidadeMedida}`;
        document.getElementById('modal-produto-categoria').textContent = nomeCategoria;
        document.getElementById('modal-produto-descricao').textContent = produto.descricao || 'Este produto não possui uma descrição detalhada.';
        modalAddCarrinhoBtn.dataset.id = id;
        modalProdutoQtdInput.value = 1;

        const relacionadosContainer = document.getElementById('produtos-relacionados-lista');
        const produtosRelacionados = todosProdutos.filter(p => p.data.categoria === produto.categoria && p.id !== id).slice(0, 4);
        renderizarProdutos(produtosRelacionados, relacionadosContainer);
        
        modalProduto.classList.remove('hidden');
    }

    async function consultarPedido() {
        const id = consultaIdInput.value.trim();
        if (!id) { alert("Por favor, digite o ID do seu pedido."); return; }
        resultadoConsultaEl.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Consultando...';
        try {
            const pedidoRef = doc(db, "pedidos", id);
            const docSnap = await getDoc(pedidoRef);
            if (docSnap.exists()) {
                const pedido = docSnap.data();
                const statusInfo = statusPedido[pedido.status] || { texto: 'Desconhecido', cor: 'text-gray-600' };
                resultadoConsultaEl.innerHTML = `<p>Status do seu pedido: <strong class="text-lg ${statusInfo.cor}">${statusInfo.texto}</strong></p>`;
            } else {
                resultadoConsultaEl.innerHTML = '<p class="text-red-600">Pedido não encontrado.</p>';
            }
        } catch (error) {
            console.error("Erro ao consultar pedido:", error);
            resultadoConsultaEl.innerHTML = '<p class="text-red-600">Ocorreu um erro ao consultar.</p>';
        }
    }

    async function trackSiteVisit() {
        if (!sessionStorage.getItem('siteVisited')) {
            sessionStorage.setItem('siteVisited', 'true');
            const analyticsRef = doc(db, "analytics", "siteMetrics");
            try {
                await updateDoc(analyticsRef, {
                    visitasSite: increment(1)
                });
            } catch (error) {
                if (error.code === 'not-found') {
                    await setDoc(analyticsRef, { visitasSite: 1, visitasCarrinho: 0 }, { merge: true });
                }
            }
        }
    }

    function iniciarApp() {
        onSnapshot(query(collection(db, "categorias")), (snapshot) => {
            categorias = {};
            snapshot.docs.forEach(doc => {
                categorias[doc.id] = doc.data();
            });
            popularFiltros();
            carregarProdutos();
        });
        updateCartCounter();
        trackSiteVisit();
    }


    // --- EVENT LISTENERS ---
    produtosListaEl.addEventListener('click', (e) => {
        const card = e.target.closest('.produto-card');
        if (card) {
            abrirModalProduto(card.dataset.id);
        }
    });
    document.getElementById('produtos-relacionados-lista').addEventListener('click', (e) => {
        const card = e.target.closest('.produto-card');
        if (card) {
            abrirModalProduto(card.dataset.id);
        }
    });

    fecharModalProdutoBtn.addEventListener('click', () => modalProduto.classList.add('hidden'));
    
    modalAddCarrinhoBtn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const quantidade = parseInt(modalProdutoQtdInput.value) || 1;
        adicionarAoCarrinho(id, quantidade);
        modalProduto.classList.add('hidden');
    });

    pesquisaProdutoInput.addEventListener('input', filtrarErenderizar);
    filtroCategoriaEl.addEventListener('change', filtrarErenderizar);
    consultarPedidoBtn.addEventListener('click', consultarPedido);
    consultaIdInput.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') consultarPedido();
    });

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            window.location.href = 'admin.html';
        }
    });

    // --- INICIALIZAÇÃO ---
    iniciarApp();
});
