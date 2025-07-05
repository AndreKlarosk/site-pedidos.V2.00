document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES GLOBAIS ---
    const categorias = {
        'ferramentas': { nome: 'Ferramentas', icone: 'fa-solid fa-screwdriver-wrench' },
        'cimento-argamassa': { nome: 'Cimento e Argamassa', icone: 'fa-solid fa-trowel-bricks' },
        'tijolos-blocos': { nome: 'Tijolos e Blocos', icone: 'fa-solid fa-layer-group' },
        'pisos-revestimentos': { nome: 'Pisos e Revestimentos', icone: 'fa-solid fa-grip' },
        'eletrica': { nome: 'Elétrica', icone: 'fa-solid fa-bolt' },
        'hidraulica': { nome: 'Hidráulica', icone: 'fa-solid fa-faucet-drip' },
        'pintura': { nome: 'Pintura', icone: 'fa-solid fa-paint-roller' },
        'madeiras': { nome: 'Madeiras', icone: 'fa-solid fa-tree' },
        'fixadores': { nome: 'Fixadores', icone: 'fa-solid fa-screwdriver' },
        'outros': { nome: 'Outros', icone: 'fa-solid fa-box' }
    };
     const statusPedido = {
        'Recebido': { texto: 'Recebido', cor: 'text-blue-600' },
        'Em Preparacao': { texto: 'Em Preparação', cor: 'text-yellow-600' },
        'Pronto': { texto: 'Pronto para Retirada/Entrega', cor: 'text-green-600' },
        'Finalizado': { texto: 'Finalizado', cor: 'text-gray-600' },
        'Cancelado': { texto: 'Cancelado', cor: 'text-red-600' }
    };

    // --- INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAZSV573SyiddgzV8uzn7w6Ur0kdilI5tI",
        authDomain: "loja-pedidos-v1.firebaseapp.com",
        projectId: "loja-pedidos-v1",
        storageBucket: "loja-pedidos-v1.appspot.com",
        messagingSenderId: "624610926773",
        appId: "1:624610926773:web:6540a1ec6c1fca18819efc"
    };
    const { initializeApp, getFirestore, collection, onSnapshot, query, doc, getDoc } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) { console.error("Erro Firebase:", e); return; }

    // --- ESTADO DA APLICAÇÃO ---
    let todosProdutos = [];
    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

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
        containerEl.innerHTML = produtos.length === 0 ? '<p class="text-gray-500 col-span-full">Nenhum produto encontrado.</p>' : '';
        produtos.forEach(({ id, data: produto }) => {
            const produtoCard = document.createElement('div');
            produtoCard.dataset.id = id;
            produtoCard.className = `produto-card cursor-pointer bg-white rounded-lg shadow-md overflow-hidden flex flex-col items-center text-center p-4 transform hover:scale-105 transition-transform duration-300 ${produto.destaque ? 'border-2 border-yellow-400' : ''}`;
            const icone = categorias[produto.categoria]?.icone || 'fa-solid fa-box';
            produtoCard.innerHTML = `
                ${produto.destaque ? '<div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">DESTAQUE</div>' : ''}
                <div class="text-5xl text-indigo-500 my-4 pointer-events-none"><i class="${icone}"></i></div>
                <h3 class="text-lg font-semibold h-12 pointer-events-none">${produto.nome}</h3>
                <p class="text-gray-500 text-sm mb-2 pointer-events-none">${categorias[produto.categoria]?.nome || 'Sem Categoria'}</p>
                <p class="text-gray-800 font-bold text-2xl my-2 pointer-events-none">R$ ${produto.preco.toFixed(2).replace('.', ',')} / ${produto.unidadeMedida}</p>
            `;
            containerEl.appendChild(produtoCard);
        });
    };

    const filtrarErenderizar = () => {
        const termo = pesquisaProdutoInput.value.toLowerCase();
        const categoria = filtroCategoriaEl.value;
        let produtosFiltrados = todosProdutos;
        if (categoria !== 'todos') {
            produtosFiltrados = produtosFiltrados.filter(p => p.data.categoria === categoria);
        }
        if (termo) {
            produtosFiltrados = produtosFiltrados.filter(p => p.data.nome.toLowerCase().includes(termo));
        }
        produtosFiltrados.sort((a, b) => (b.data.destaque ? 1 : 0) - (a.data.destaque ? 1 : 0));
        renderizarProdutos(produtosFiltrados, produtosListaEl);
    };

    function carregarProdutos() {
        onSnapshot(query(collection(db, "produtos")), (snapshot) => {
            todosProdutos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
            filtrarErenderizar();
        });
    }

    function adicionarAoCarrinho(produtoId) {
        const produtoData = todosProdutos.find(p => p.id === produtoId);
        if (!produtoData) return;
        const { data: produto } = produtoData;
        const itemExistente = carrinho.find(item => item.id === produtoId);
        if (itemExistente) {
            itemExistente.quantidade++;
        } else {
            carrinho.push({ id: produtoId, ...produto, quantidade: 1 });
        }
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        updateCartCounter();
        animateCart();
    }

    function abrirModalProduto(produtoId) {
        const produtoData = todosProdutos.find(p => p.id === produtoId);
        if (!produtoData) return;
        const { id, data: produto } = produtoData;
        
        document.getElementById('modal-produto-nome').textContent = produto.nome;
        document.getElementById('modal-produto-icone').className = `text-9xl text-indigo-500 ${categorias[produto.categoria]?.icone || 'fa-solid fa-box'}`;
        document.getElementById('modal-produto-preco').textContent = `R$ ${produto.preco.toFixed(2).replace('.', ',')} / ${produto.unidadeMedida}`;
        document.getElementById('modal-produto-categoria').textContent = categorias[produto.categoria]?.nome || 'Sem Categoria';
        document.getElementById('modal-produto-descricao').textContent = produto.descricao || 'Este produto não possui uma descrição detalhada.';
        modalAddCarrinhoBtn.dataset.id = id;

        const relacionadosContainer = document.getElementById('produtos-relacionados-lista');
        const produtosRelacionados = todosProdutos.filter(p => p.data.categoria === produto.categoria && p.id !== id).slice(0, 4);
        renderizarProdutos(produtosRelacionados, relacionadosContainer);
        
        modalProduto.classList.remove('hidden');
    }

    async function consultarPedido() {
        const id = consultaIdInput.value.trim();
        if (!id) { alert("Por favor, digite o ID do pedido."); return; }
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

    // --- EVENT LISTENERS ---
    produtosListaEl.addEventListener('click', (e) => {
        const card = e.target.closest('.produto-card');
        if (card) {
            abrirModalProduto(card.dataset.id);
        }
    });

    fecharModalProdutoBtn.addEventListener('click', () => modalProduto.classList.add('hidden'));
    modalAddCarrinhoBtn.addEventListener('click', (e) => {
        adicionarAoCarrinho(e.target.dataset.id);
        modalProduto.classList.add('hidden');
    });

    pesquisaProdutoInput.addEventListener('input', filtrarErenderizar);
    filtroCategoriaEl.addEventListener('change', filtrarErenderizar);
    consultarPedidoBtn.addEventListener('click', consultarPedido);

    // --- INICIALIZAÇÃO ---
    popularFiltros();
    carregarProdutos();
    updateCartCounter();
});
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES GLOBAIS ---
    const categorias = {
        'ferramentas': { nome: 'Ferramentas', icone: 'fa-solid fa-screwdriver-wrench' },
        'cimento-argamassa': { nome: 'Cimento e Argamassa', icone: 'fa-solid fa-trowel-bricks' },
        'tijolos-blocos': { nome: 'Tijolos e Blocos', icone: 'fa-solid fa-layer-group' },
        'pisos-revestimentos': { nome: 'Pisos e Revestimentos', icone: 'fa-solid fa-grip' },
        'eletrica': { nome: 'Elétrica', icone: 'fa-solid fa-bolt' },
        'hidraulica': { nome: 'Hidráulica', icone: 'fa-solid fa-faucet-drip' },
        'pintura': { nome: 'Pintura', icone: 'fa-solid fa-paint-roller' },
        'madeiras': { nome: 'Madeiras', icone: 'fa-solid fa-tree' },
        'fixadores': { nome: 'Fixadores', icone: 'fa-solid fa-screwdriver' },
        'outros': { nome: 'Outros', icone: 'fa-solid fa-box' }
    };
     const statusPedido = {
        'Recebido': { texto: 'Recebido', cor: 'text-blue-600' },
        'Em Preparacao': { texto: 'Em Preparação', cor: 'text-yellow-600' },
        'Pronto': { texto: 'Pronto para Retirada/Entrega', cor: 'text-green-600' },
        'Finalizado': { texto: 'Finalizado', cor: 'text-gray-600' },
        'Cancelado': { texto: 'Cancelado', cor: 'text-red-600' }
    };

    // --- INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAZSV573SyiddgzV8uzn7w6Ur0kdilI5tI",
        authDomain: "loja-pedidos-v1.firebaseapp.com",
        projectId: "loja-pedidos-v1",
        storageBucket: "loja-pedidos-v1.appspot.com",
        messagingSenderId: "624610926773",
        appId: "1:624610926773:web:6540a1ec6c1fca18819efc"
    };
    const { initializeApp, getFirestore, collection, onSnapshot, query, doc, getDoc } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) { console.error("Erro Firebase:", e); return; }

    // --- ESTADO DA APLICAÇÃO ---
    let todosProdutos = [];
    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

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
        containerEl.innerHTML = produtos.length === 0 ? '<p class="text-gray-500 col-span-full">Nenhum produto encontrado.</p>' : '';
        produtos.forEach(({ id, data: produto }) => {
            const produtoCard = document.createElement('div');
            produtoCard.dataset.id = id;
            produtoCard.className = `produto-card cursor-pointer bg-white rounded-lg shadow-md overflow-hidden flex flex-col items-center text-center p-4 transform hover:scale-105 transition-transform duration-300 ${produto.destaque ? 'border-2 border-yellow-400' : ''}`;
            const icone = categorias[produto.categoria]?.icone || 'fa-solid fa-box';
            produtoCard.innerHTML = `
                ${produto.destaque ? '<div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">DESTAQUE</div>' : ''}
                <div class="text-5xl text-indigo-500 my-4 pointer-events-none"><i class="${icone}"></i></div>
                <h3 class="text-lg font-semibold h-12 pointer-events-none">${produto.nome}</h3>
                <p class="text-gray-500 text-sm mb-2 pointer-events-none">${categorias[produto.categoria]?.nome || 'Sem Categoria'}</p>
                <p class="text-gray-800 font-bold text-2xl my-2 pointer-events-none">R$ ${produto.preco.toFixed(2).replace('.', ',')} / ${produto.unidadeMedida}</p>
            `;
            containerEl.appendChild(produtoCard);
        });
    };

    const filtrarErenderizar = () => {
        const termo = pesquisaProdutoInput.value.toLowerCase();
        const categoria = filtroCategoriaEl.value;
        let produtosFiltrados = todosProdutos;
        if (categoria !== 'todos') {
            produtosFiltrados = produtosFiltrados.filter(p => p.data.categoria === categoria);
        }
        if (termo) {
            produtosFiltrados = produtosFiltrados.filter(p => p.data.nome.toLowerCase().includes(termo));
        }
        produtosFiltrados.sort((a, b) => (b.data.destaque ? 1 : 0) - (a.data.destaque ? 1 : 0));
        renderizarProdutos(produtosFiltrados, produtosListaEl);
    };

    function carregarProdutos() {
        onSnapshot(query(collection(db, "produtos")), (snapshot) => {
            todosProdutos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
            filtrarErenderizar();
        });
    }

    function adicionarAoCarrinho(produtoId) {
        const produtoData = todosProdutos.find(p => p.id === produtoId);
        if (!produtoData) return;
        const { data: produto } = produtoData;
        const itemExistente = carrinho.find(item => item.id === produtoId);
        if (itemExistente) {
            itemExistente.quantidade++;
        } else {
            carrinho.push({ id: produtoId, ...produto, quantidade: 1 });
        }
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        updateCartCounter();
        animateCart();
    }

    function abrirModalProduto(produtoId) {
        const produtoData = todosProdutos.find(p => p.id === produtoId);
        if (!produtoData) return;
        const { id, data: produto } = produtoData;
        
        document.getElementById('modal-produto-nome').textContent = produto.nome;
        document.getElementById('modal-produto-icone').className = `text-9xl text-indigo-500 ${categorias[produto.categoria]?.icone || 'fa-solid fa-box'}`;
        document.getElementById('modal-produto-preco').textContent = `R$ ${produto.preco.toFixed(2).replace('.', ',')} / ${produto.unidadeMedida}`;
        document.getElementById('modal-produto-categoria').textContent = categorias[produto.categoria]?.nome || 'Sem Categoria';
        document.getElementById('modal-produto-descricao').textContent = produto.descricao || 'Este produto não possui uma descrição detalhada.';
        modalAddCarrinhoBtn.dataset.id = id;

        const relacionadosContainer = document.getElementById('produtos-relacionados-lista');
        const produtosRelacionados = todosProdutos.filter(p => p.data.categoria === produto.categoria && p.id !== id).slice(0, 4);
        renderizarProdutos(produtosRelacionados, relacionadosContainer);
        
        modalProduto.classList.remove('hidden');
    }

    async function consultarPedido() {
        const id = consultaIdInput.value.trim();
        if (!id) { alert("Por favor, digite o ID do pedido."); return; }
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

    // --- EVENT LISTENERS ---
    produtosListaEl.addEventListener('click', (e) => {
        const card = e.target.closest('.produto-card');
        if (card) {
            abrirModalProduto(card.dataset.id);
        }
    });

    fecharModalProdutoBtn.addEventListener('click', () => modalProduto.classList.add('hidden'));
    modalAddCarrinhoBtn.addEventListener('click', (e) => {
        adicionarAoCarrinho(e.target.dataset.id);
        modalProduto.classList.add('hidden');
    });

    pesquisaProdutoInput.addEventListener('input', filtrarErenderizar);
    filtroCategoriaEl.addEventListener('change', filtrarErenderizar);
    consultarPedidoBtn.addEventListener('click', consultarPedido);

    // --- INICIALIZAÇÃO ---
    popularFiltros();
    carregarProdutos();
    updateCartCounter();
    filtroCategoriaEl.addEventListener('change', filtrarErenderizar);
consultarPedidoBtn.addEventListener('click', consultarPedido);
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'b') {
        window.location.href = 'admin.html';
    }
});
});
filtroCategoriaEl.addEventListener('change', filtrarErenderizar);
consultarPedidoBtn.addEventListener('click', consultarPedido);
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'b') {
        window.location.href = 'admin.html';
    }
});


