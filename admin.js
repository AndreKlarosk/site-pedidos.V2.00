document.addEventListener('DOMContentLoaded', () => {

    // --- DEFINIÇÕES DA LOJA ---
    let todasCategorias = {};
    const statusPedido = {
        'Recebido': { texto: 'Recebido', cor: 'bg-blue-100 text-blue-800' },
        'Em Preparacao': { texto: 'Em Preparação', cor: 'bg-yellow-100 text-yellow-800' },
        'Pronto': { texto: 'Pronto', cor: 'bg-green-100 text-green-800' },
        'Finalizado': { texto: 'Finalizado', cor: 'bg-gray-200 text-gray-800' },
        'Cancelado': { texto: 'Cancelado', cor: 'bg-red-100 text-red-800' }
    };
    const iconesSugeridos = [
        { nome: 'Ferramentas', classe: 'fa-solid fa-screwdriver-wrench' },
        { nome: 'Construção', classe: 'fa-solid fa-trowel-bricks' },
        { nome: 'Blocos e Tijolos', classe: 'fa-solid fa-layer-group' },
        { nome: 'Pisos e Revestimentos', classe: 'fa-solid fa-grip' },
        { nome: 'Elétrica', classe: 'fa-solid fa-bolt' },
        { nome: 'Hidráulica', classe: 'fa-solid fa-faucet-drip' },
        { nome: 'Pintura', classe: 'fa-solid fa-paint-roller' },
        { nome: 'Madeiras', classe: 'fa-solid fa-tree' },
        { nome: 'Fixadores (Parafusos)', classe: 'fa-solid fa-screwdriver' },
        { nome: 'Jardinagem', classe: 'fa-solid fa-leaf' },
        { nome: 'Segurança (EPI)', classe: 'fa-solid fa-hard-hat' },
        { nome: 'Casa e Decoração', classe: 'fa-solid fa-house' },
        { nome: 'Caixas e Organizadores', classe: 'fa-solid fa-box' }
    ];

    // --- INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAZSV573SyiddgzV8uzn7w6Ur0kdilI5tI",
        authDomain: "loja-pedidos-v1.firebaseapp.com",
        projectId: "loja-pedidos-v1",
        storageBucket: "loja-pedidos-v1.appspot.com",
        messagingSenderId: "624610926773",
        appId: "1:624610926773:web:6540a1ec6c1fca18819efc"
    };
    const { initializeApp, getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, writeBatch, where, getDocs } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) { console.error("Erro Firebase:", e); return; }

    // --- ESTADO ---
    let todosProdutos = [];
    let todosPedidos = [];
    let todosCupons = [];
    let isFirstLoad = true;
    const synth = new Tone.Synth().toDestination();

    // --- SELETORES ---
    const formAddCategoria = document.getElementById('form-add-categoria');
    const categoriasListaEl = document.getElementById('categorias-lista');
    const pedidosListaEl = document.getElementById('pedidos-lista');
    const produtosAdminListaEl = document.getElementById('produtos-admin-lista');
    const formAddProduto = document.getElementById('form-add-produto');
    const pesquisaProdutoAdminInput = document.getElementById('pesquisa-produto-admin');
    const pesquisaPedidoAdminInput = document.getElementById('pesquisa-pedido-admin');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const modalNovoPedido = document.getElementById('modal-novo-pedido');
    const novoPedidoInfoEl = document.getElementById('novo-pedido-info');
    const visualizarPedidoBtn = document.getElementById('visualizar-pedido-btn');
    const fecharNovoPedidoModalBtn = document.getElementById('fechar-novo-pedido-modal-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const destaqueCheckbox = document.getElementById('destaque-produto');
    const pedidosHojeEl = document.getElementById('pedidos-hoje');
    const faturamentoHojeEl = document.getElementById('faturamento-hoje');
    const produtoMaisPedidoEl = document.getElementById('produto-mais-pedido');
    const descricaoProdutoInput = document.getElementById('descricao-produto');
    const modalFrete = document.getElementById('modal-frete');
    const formFrete = document.getElementById('form-frete');
    const cancelarFreteBtn = document.getElementById('cancelar-frete-btn');
    const valorFreteInput = document.getElementById('valor-frete');
    const fretePedidoIdInput = document.getElementById('frete-pedido-id');
    const formAddCupom = document.getElementById('form-add-cupom');
    const cuponsListaEl = document.getElementById('cupons-lista');
    const formAjustePreco = document.getElementById('form-ajuste-preco');
    const filtroDataInicioInput = document.getElementById('filtro-data-inicio');
    const filtroDataFimInput = document.getElementById('filtro-data-fim');
    const cancelCupomEditBtn = document.getElementById('cancel-cupom-edit-btn');
    const formCupomTitulo = document.getElementById('form-cupom-titulo');
    const filtroProdutoCategoriaSelect = document.getElementById('filtro-produto-categoria');


    // --- FUNÇÕES ---

    const slugify = text => text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')      
        .replace(/[^\w\-]+/g, '')  
        .replace(/\-\-+/g, '-');   


    function updateDashboard() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const pedidosDeHoje = todosPedidos.filter(p => p.data.data.toDate() >= hoje);
        pedidosHojeEl.textContent = pedidosDeHoje.length;
        const faturamento = pedidosDeHoje.reduce((sum, p) => sum + (p.data.total + (p.data.valorFrete || 0)), 0);
        faturamentoHojeEl.textContent = `R$ ${faturamento.toFixed(2).replace('.', ',')}`;
        const contagemItens = {};
        todosPedidos.forEach(p => { p.data.itens.forEach(item => { contagemItens[item.nome] = (contagemItens[item.nome] || 0) + item.quantidade; }); });
        let maisPedido = '--';
        let maxQtd = 0;
        for (const nome in contagemItens) { if (contagemItens[nome] > maxQtd) { maxQtd = contagemItens[nome]; maisPedido = nome; } }
        produtoMaisPedidoEl.textContent = maisPedido;
    }

    const renderizarPedidos = (pedidos) => {
        pedidosListaEl.innerHTML = pedidos.length === 0 ? '<p class="text-gray-500">Nenhum pedido encontrado.</p>' : '';
        pedidos.forEach(({ id, data: pedido }) => {
            const pedidoCard = document.createElement('div');
            pedidoCard.id = `pedido-${id}`;
            pedidoCard.className = 'bg-white p-4 rounded-lg shadow-md transition-all duration-300';
            const statusAtual = statusPedido[pedido.status] || statusPedido['Recebido'];
            const subtotal = pedido.subtotal !== undefined ? pedido.subtotal : pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
            const totalGeral = pedido.total + (pedido.valorFrete || 0);
            let detalhesValoresHtml = `<p>Subtotal: R$ ${subtotal.toFixed(2).replace('.',',')}</p>`;
            if (pedido.desconto > 0) {
                detalhesValoresHtml += `<p class="text-red-500">Desconto: -R$ ${pedido.desconto.toFixed(2).replace('.',',')}</p>`;
            }
            detalhesValoresHtml += `<p>Frete: R$ ${(pedido.valorFrete || 0).toFixed(2).replace('.',',')}</p>`;
            pedidoCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div><h4 class="font-bold text-lg">${pedido.cliente}</h4><p class="text-xs text-gray-400 font-mono">${id}</p></div>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full ${statusAtual.cor}">${statusAtual.texto}</span>
                </div>
                <div class="my-3 text-sm space-y-1 border-t border-b py-2">
                    <p><strong>Data:</strong> ${pedido.data.toDate().toLocaleString('pt-BR')}</p>
                    <p><strong>Entrega:</strong> ${pedido.entrega}</p>
                    <p><strong>Pagamento:</strong> ${pedido.pagamento}</p>
                </div>
                <div class="my-2"><p class="font-semibold text-sm">Itens:</p><ul class="list-disc list-inside text-sm pl-2">${pedido.itens.map(item => `<li>${item.quantidade}x ${item.nome}</li>`).join('')}</ul></div>
                <div class="text-right text-sm border-t pt-2">
                    ${detalhesValoresHtml}
                </div>
                <p class="text-right font-bold text-lg mt-1">Total: R$ ${totalGeral.toFixed(2).replace('.',',')}</p>
                <div class="border-t mt-3 pt-3 flex items-center justify-end gap-2 flex-wrap">
                    <button data-id="${id}" class="add-frete-btn text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded">Frete</button>
                    <div class="relative"><button data-id="${id}" class="status-btn text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">Status</button><div id="status-options-${id}" class="status-options absolute bottom-full mb-2 right-0 bg-white border rounded shadow-lg z-10 hidden">${Object.keys(statusPedido).map(key => `<a href="#" data-id="${id}" data-status="${key}" class="status-link block px-4 py-2 text-sm hover:bg-gray-100">${statusPedido[key].texto}</a>`).join('')}</div></div>
                    <a href="https://wa.me/55${(pedido.whatsapp || '').replace(/\D/g, '')}" target="_blank" class="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"><i class="fa-brands fa-whatsapp"></i></a>
                    <button data-id="${id}" class="print-btn text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"><i class="fa-solid fa-print"></i></button>
                    <button data-id="${id}" class="delete-pedido-btn text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            pedidosListaEl.appendChild(pedidoCard);
        });
    };

    const renderizarProdutosAdmin = (produtos) => {
        produtosAdminListaEl.innerHTML = produtos.length === 0 ? '<p>Nenhum produto encontrado.</p>' : '';
        const produtosOrdenados = [...produtos.filter(p => p.data.destaque), ...produtos.filter(p => !p.data.destaque)];
        produtosOrdenados.forEach(({ id, data: p }) => {
            const item = document.createElement('div');
            const categoriaInfo = todasCategorias[p.categoria] || { icone: 'fa-solid fa-box' };
            item.className = 'bg-white p-3 rounded-md shadow-sm flex justify-between items-center';
            item.innerHTML = `<div class="flex items-center gap-3"><i class="${categoriaInfo.icone} w-5 h-5 text-center"></i><div><p class="font-semibold flex items-center gap-2">${p.nome} ${p.destaque ? '<i class="fa-solid fa-star text-yellow-400"></i>' : ''}</p><p class="text-sm text-gray-500">R$ ${p.preco.toFixed(2).replace('.',',')} / ${p.unidadeMedida}</p></div></div><div class="flex gap-2"><button data-id="${id}" class="edit-btn p-2 hover:bg-gray-200 rounded-full"><i class="fa-solid fa-pencil pointer-events-none"></i></button><button data-id="${id}" class="delete-btn p-2 hover:bg-gray-200 rounded-full"><i class="fa-solid fa-trash-can pointer-events-none"></i></button></div>`;
            produtosAdminListaEl.appendChild(item);
        });
    };
    
    function renderizarCupons(cupons) {
        cuponsListaEl.innerHTML = cupons.length === 0 ? '<p class="text-gray-500">Nenhum cupom cadastrado.</p>' : '';
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); 
        cupons.forEach(({ id, data: c }) => {
            const item = document.createElement('div');
            const validade = c.validade.toDate();
            const expirado = validade < hoje;
            const valorFormatado = c.tipo === 'porcentagem' ? `${c.valor}%` : `R$ ${c.valor.toFixed(2).replace('.', ',')}`;
            const categoriasAplicaveis = (c.categoriasAplicaveis || ['todos'])
                .map(catId => catId === 'todos' ? 'Todas' : (todasCategorias[catId]?.nome || catId))
                .join(', ');

            item.className = `bg-white p-3 rounded-md shadow-sm ${expirado ? 'opacity-50' : ''}`;
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-semibold flex items-center gap-2">
                            <i class="fa-solid fa-ticket text-orange-500"></i> ${id}
                            ${expirado ? '<span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">Expirado</span>' : ''}
                        </p>
                        <p class="text-sm text-gray-600">Desconto de ${valorFormatado} &bull; Válido até ${validade.toLocaleDateString('pt-BR')}</p>
                        <p class="text-xs text-gray-500 mt-1">Categorias: ${categoriasAplicaveis}</p>
                    </div>
                    <div class="flex gap-2">
                        <button data-id="${id}" class="edit-cupom-btn p-2 hover:bg-gray-200 rounded-full"><i class="fa-solid fa-pencil pointer-events-none"></i></button>
                        <button data-id="${id}" class="delete-cupom-btn p-2 hover:bg-gray-200 rounded-full"><i class="fa-solid fa-trash-can pointer-events-none"></i></button>
                    </div>
                </div>
            `;
            cuponsListaEl.appendChild(item);
        });
    }
    
    const renderizarCategorias = () => {
        categoriasListaEl.innerHTML = Object.keys(todasCategorias).length === 0 ? '<p class="text-gray-500">Nenhuma categoria cadastrada.</p>' : '';
        for (const id in todasCategorias) {
            const categoria = todasCategorias[id];
            const item = document.createElement('div');
            item.className = 'bg-white p-3 rounded-md shadow-sm flex justify-between items-center';
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <i class="${categoria.icone} text-lg w-6 text-center"></i>
                    <div>
                        <p class="font-semibold">${categoria.nome}</p>
                        <p class="text-xs text-gray-500 font-mono">${id}</p>
                    </div>
                </div>
                <button data-id="${id}" class="delete-categoria-btn p-2 hover:bg-gray-200 rounded-full">
                    <i class="fa-solid fa-trash-can pointer-events-none text-red-500"></i>
                </button>
            `;
            categoriasListaEl.appendChild(item);
        }
    }


    const filtrarErenderizar = () => {
        // Filtro de produtos
        const categoriaFiltro = filtroProdutoCategoriaSelect.value;
        const termoProduto = pesquisaProdutoAdminInput.value.toLowerCase();
        let produtosFiltrados = todosProdutos;

        if (categoriaFiltro) {
            produtosFiltrados = produtosFiltrados.filter(p => p.data.categoria === categoriaFiltro);
        }
        if (termoProduto) {
            produtosFiltrados = produtosFiltrados.filter(p => p.data.nome.toLowerCase().includes(termoProduto));
        }
        renderizarProdutosAdmin(produtosFiltrados);
        
        // Filtro de pedidos
        const termoPedido = pesquisaPedidoAdminInput.value.toLowerCase();
        const dataInicio = filtroDataInicioInput.value ? new Date(filtroDataInicioInput.value) : null;
        const dataFim = filtroDataFimInput.value ? new Date(filtroDataFimInput.value) : null;
        if(dataInicio) dataInicio.setHours(0,0,0,0);
        if(dataFim) dataFim.setHours(23,59,59,999);

        const pedidosFiltrados = todosPedidos.filter(p => {
            const dataPedido = p.data.data.toDate();
            const matchTermo = p.data.cliente.toLowerCase().includes(termoPedido) || p.id.toLowerCase().includes(termoPedido);
            const matchData = (!dataInicio || dataPedido >= dataInicio) && (!dataFim || dataPedido <= dataFim);
            return matchTermo && matchData;
        });
        renderizarPedidos(pedidosFiltrados);
    };

    function carregarDados() {
        // Listener de Categorias (carrega primeiro)
        onSnapshot(query(collection(db, "categorias")), (snapshot) => {
            todasCategorias = {};
            snapshot.docs.forEach(doc => {
                todasCategorias[doc.id] = doc.data();
            });
            renderizarCategorias();
            popularCategoriasSelects(); // Popula todos os <select> de categoria
            filtrarErenderizar(); // Re-renderiza produtos com nomes de categoria corretos
            renderizarCupons(todosCupons); // Re-renderiza cupons com nomes de categoria corretos
        });
        
        // Listener de Pedidos
        onSnapshot(query(collection(db, "pedidos")), (snapshot) => {
            if (!isFirstLoad) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const novoPedido = change.doc.data();
                        const now = Tone.now();
                        synth.triggerAttackRelease("C5", "8n", now);
                        synth.triggerAttackRelease("E5", "8n", now + 0.12);
                        synth.triggerAttackRelease("G5", "8n", now + 0.24);
                        novoPedidoInfoEl.innerHTML = `<p><strong>Cliente:</strong> ${novoPedido.cliente}</p><p><strong>Total:</strong> R$ ${novoPedido.total.toFixed(2).replace('.',',')}</p>`;
                        visualizarPedidoBtn.dataset.id = change.doc.id;
                        modalNovoPedido.classList.remove('hidden');
                    }
                });
            }
            todosPedidos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })).sort((a, b) => b.data.data.toMillis() - a.data.data.toMillis());
            filtrarErenderizar();
            updateDashboard();
            isFirstLoad = false;
        });
        
        // Listener de Produtos
        onSnapshot(query(collection(db, "produtos")), (snapshot) => {
            todosProdutos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
            filtrarErenderizar();
        });
        
        // Listener de Cupons
        onSnapshot(query(collection(db, "cupons")), (snapshot) => {
            todosCupons = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
                .sort((a, b) => b.data.validade.toMillis() - a.data.validade.toMillis());
            renderizarCupons(todosCupons);
        });
    }

    async function salvarProduto(e) {
        e.preventDefault();
        const id = document.getElementById('produto-id').value;
        const produto = {
            nome: document.getElementById('nome-produto').value.trim(),
            preco: parseFloat(document.getElementById('preco-produto').value),
            unidadeMedida: document.getElementById('unidade-medida').value.trim(),
            categoria: document.getElementById('categoria-produto').value,
            descricao: descricaoProdutoInput.value.trim(),
            destaque: destaqueCheckbox.checked
        };
        if (!produto.nome || isNaN(produto.preco) || !produto.unidadeMedida || !produto.categoria) { alert("Preencha os campos Nome, Preço, Unidade e Categoria."); return; }
        try {
            await setDoc(doc(db, "produtos", id || doc(collection(db, "produtos")).id), produto);
            resetarFormulario();
        } catch (error) { console.error("Erro ao salvar produto: ", error); }
    }
    
    async function salvarCupom(e) {
        e.preventDefault();
        const codigoInput = document.getElementById('cupom-codigo');
        const codigo = codigoInput.value.trim().toUpperCase();
        const validadeInput = document.getElementById('cupom-validade').value;
        const categoriasSelect = document.getElementById('cupom-categorias');
        const categoriasSelecionadas = [...categoriasSelect.selectedOptions].map(option => option.value);

        if (!codigo || !validadeInput) { alert("Preencha todos os campos do cupom."); return; }
        if (categoriasSelecionadas.length === 0) { alert("Selecione ao menos uma categoria ou 'Todos'."); return; }
        
        const [year, month, day] = validadeInput.split('-');
        const validade = new Date(year, month - 1, day, 23, 59, 59);

        const cupom = {
            tipo: document.getElementById('cupom-tipo').value,
            valor: parseFloat(document.getElementById('cupom-valor').value),
            validade: validade,
            categoriasAplicaveis: categoriasSelecionadas
        };

        if (isNaN(cupom.valor) || cupom.valor <= 0) { alert("O valor do desconto deve ser um número positivo."); return; }

        try {
            await setDoc(doc(db, "cupons", codigo), cupom);
            resetarFormularioCupom();
            alert(`Cupom "${codigo}" salvo com sucesso!`);
        } catch (error) {
            console.error("Erro ao salvar cupom: ", error);
            alert("Erro ao salvar o cupom.");
        }
    }
    
    async function salvarCategoria(e) {
        e.preventDefault();
        const nome = document.getElementById('categoria-nome').value.trim();
        const icone = document.getElementById('categoria-icone-select').value;
        if (!nome || !icone) {
            alert('Preencha o nome e selecione um ícone para a categoria.');
            return;
        }
        const id = slugify(nome);
        try {
            await setDoc(doc(db, "categorias", id), { nome, icone });
            alert(`Categoria "${nome}" salva com sucesso!`);
            formAddCategoria.reset();
        } catch(error) {
            console.error("Erro ao salvar categoria: ", error);
            alert("Erro ao salvar categoria.");
        }
    }


    function editarProduto(id) {
        const produto = todosProdutos.find(p => p.id === id)?.data;
        if (!produto) return;
        document.getElementById('produto-id').value = id;
        document.getElementById('nome-produto').value = produto.nome;
        document.getElementById('preco-produto').value = produto.preco;
        document.getElementById('unidade-medida').value = produto.unidadeMedida;
        document.getElementById('categoria-produto').value = produto.categoria;
        descricaoProdutoInput.value = produto.descricao || '';
        destaqueCheckbox.checked = produto.destaque || false;
        cancelEditBtn.classList.remove('hidden');
        formAddProduto.scrollIntoView({ behavior: 'smooth' });
    }

    function editarCupom(id) {
        const cupom = todosCupons.find(c => c.id === id)?.data;
        if (!cupom) return;

        formCupomTitulo.textContent = `Editando Cupom: ${id}`;
        document.getElementById('cupom-codigo').value = id;
        document.getElementById('cupom-codigo').readOnly = true;
        document.getElementById('cupom-tipo').value = cupom.tipo;
        document.getElementById('cupom-valor').value = cupom.valor;
        
        const validade = cupom.validade.toDate();
        const yyyy = validade.getFullYear();
        const mm = String(validade.getMonth() + 1).padStart(2, '0');
        const dd = String(validade.getDate()).padStart(2, '0');
        document.getElementById('cupom-validade').value = `${yyyy}-${mm}-${dd}`;
        
        const categoriasSelect = document.getElementById('cupom-categorias');
        [...categoriasSelect.options].forEach(opt => opt.selected = false);
        (cupom.categoriasAplicaveis || ['todos']).forEach(cat => {
            const option = [...categoriasSelect.options].find(opt => opt.value === cat);
            if (option) option.selected = true;
        });

        cancelCupomEditBtn.classList.remove('hidden');
        formAddCupom.scrollIntoView({ behavior: 'smooth' });
    }

    function resetarFormulario() {
        formAddProduto.reset();
        document.getElementById('produto-id').value = '';
        destaqueCheckbox.checked = false;
        cancelEditBtn.classList.add('hidden');
    }
    
    function resetarFormularioCupom() {
        formCupomTitulo.textContent = 'Criar Novo Cupom';
        formAddCupom.reset();
        const codigoInput = document.getElementById('cupom-codigo');
        codigoInput.readOnly = false;
        codigoInput.value = '';
        cancelCupomEditBtn.classList.add('hidden');
    }

    function popularCategoriasSelects() {
        const selects = [
            { el: document.getElementById('categoria-produto'), placeholder: '-- Categoria do Produto --' },
            { el: document.getElementById('ajuste-categoria'), placeholder: '-- Categoria para Ajuste --' },
            { el: document.getElementById('cupom-categorias'), placeholder: null, multiple: true },
            { el: filtroProdutoCategoriaSelect, placeholder: 'Filtrar por Categoria' }
        ];

        selects.forEach(s => {
            s.el.innerHTML = s.placeholder ? `<option value="">${s.placeholder}</option>` : '';
        });
        
        const cupomSelect = document.getElementById('cupom-categorias');
        cupomSelect.innerHTML += `<option value="todos">Todos</option>`;

        for (const id in todasCategorias) {
            const categoria = todasCategorias[id];
            const optionHtml = `<option value="${id}">${categoria.nome}</option>`;
            selects.forEach(s => s.el.innerHTML += optionHtml);
        }
    }
    
    function popularIconesSelect() {
        const selectEl = document.getElementById('categoria-icone-select');
        selectEl.innerHTML = '<option value="">-- Selecione um Ícone --</option>';
        iconesSugeridos.forEach(icone => {
            selectEl.innerHTML += `<option value="${icone.classe}">${icone.nome}</option>`;
        });
    }

    async function ajustarPrecos(e) {
        e.preventDefault();
        const categoria = document.getElementById('ajuste-categoria').value;
        const tipoAjuste = document.getElementById('ajuste-tipo').value;
        const percentual = parseFloat(document.getElementById('ajuste-percentual').value);

        if (!categoria || isNaN(percentual) || percentual <= 0) {
            alert("Selecione uma categoria e insira um percentual positivo válido.");
            return;
        }
        
        const acao = tipoAjuste === 'reduzir' ? 'reduzir' : 'aumentar';
        const confirmacao = confirm(`Tem certeza que deseja ${acao} o preço de TODOS os produtos da categoria "${todasCategorias[categoria].nome}" em ${percentual}%? Esta ação não pode ser desfeita.`);
        if (!confirmacao) return;

        try {
            const q = query(collection(db, "produtos"), where("categoria", "==", categoria));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                alert("Nenhum produto encontrado nesta categoria.");
                return;
            }

            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => {
                const produto = docSnap.data();
                const fator = tipoAjuste === 'reduzir' ? (1 - percentual / 100) : (1 + percentual / 100);
                const novoPreco = produto.preco * fator;
                batch.update(docSnap.ref, { preco: parseFloat(novoPreco.toFixed(2)) });
            });
            await batch.commit();

            alert(`Preços de ${querySnapshot.size} produtos da categoria "${todasCategorias[categoria].nome}" ajustados com sucesso!`);
            formAjustePreco.reset();
        } catch (error) {
            console.error("Erro ao ajustar preços: ", error);
            alert("Ocorreu um erro ao tentar ajustar os preços.");
        }
    }

    async function deletarProduto(id) { if (confirm("Excluir este produto?")) { await deleteDoc(doc(db, "produtos", id)); } }
    async function deletarCupom(id) { if (confirm(`Excluir o cupom "${id}"?`)) { await deleteDoc(doc(db, "cupons", id)); } }
    async function deletarPedido(id) { if (confirm("EXCLUIR este pedido? Esta ação não pode ser desfeita.")) { await deleteDoc(doc(db, "pedidos", id)); } }
    async function deletarCategoria(id) { if (confirm(`Excluir a categoria "${todasCategorias[id].nome}"? A categoria será removida dos produtos existentes no próximo salvamento deles.`)) { await deleteDoc(doc(db, "categorias", id)); } }
    async function mudarStatusPedido(pedidoId, novoStatus) { await updateDoc(doc(db, "pedidos", pedidoId), { status: novoStatus }); }
    
    function abrirModalFrete(pedidoId) {
        fretePedidoIdInput.value = pedidoId;
        modalFrete.classList.remove('hidden');
    }

    async function salvarFrete(e) {
        e.preventDefault();
        const pedidoId = fretePedidoIdInput.value;
        const valorFrete = parseFloat(valorFreteInput.value);
        if (isNaN(valorFrete)) { alert("Valor inválido. Por favor, insira apenas números."); return; }
        await updateDoc(doc(db, "pedidos", pedidoId), { valorFrete: valorFrete });
        modalFrete.classList.add('hidden');
        formFrete.reset();
    }

    function imprimirPedido(pedidoId) {
        const { data: pedido } = todosPedidos.find(p => p.id === pedidoId);
        const dataPedido = pedido.data ? pedido.data.toDate().toLocaleString('pt-BR') : 'Data indisponível';
        const subtotal = pedido.subtotal !== undefined ? pedido.subtotal : pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        const totalGeral = pedido.total + (pedido.valorFrete || 0);
        const itensHtml = pedido.itens.map(item => `<li class="item-line"><span>${item.quantidade}x ${item.nome}</span><span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span></li>`).join('');
        let cupomHtml = '';
        if (pedido.cupom && pedido.cupom.codigo && pedido.desconto > 0) {
            cupomHtml = `<p class="item-line"><span>Desconto (${pedido.cupom.codigo})</span><span>-R$ ${pedido.desconto.toFixed(2)}</span></p>`;
        }
        const conteudo = `<div class="receipt-print"><img src="logo.png" alt="Logo" class="logo"><h1>Comprovante de Pedido</h1><p>ID: ${pedidoId}</p><p>Data: ${dataPedido}</p><h2>Cliente</h2><p>${pedido.cliente}</p><p>${pedido.endereco}</p><p>WhatsApp: ${pedido.whatsapp}</p><h2>Itens</h2><ul>${itensHtml}</ul><div class="total-section"><p class="item-line"><span>Subtotal</span><span>R$ ${subtotal.toFixed(2)}</span></p>${cupomHtml}<p class="item-line"><span>Frete</span><span>R$ ${(pedido.valorFrete || 0).toFixed(2)}</span></p><p class="total-line"><span>TOTAL</span><span>R$ ${totalGeral.toFixed(2)}</span></p></div><p style="text-align: center; margin-top: 10px;">Entrega: ${pedido.entrega}</p><p style="text-align: center;">Pagamento: ${pedido.pagamento}</p></div>`;
        const pwin = window.open('', '_blank');
        pwin.document.write(`<html><head><title>Imprimir</title><style>${document.querySelector('style').innerHTML}</style></head><body>${conteudo}</body></html>`);
        pwin.document.close();
        setTimeout(() => { pwin.print(); pwin.close(); }, 250);
    }
    
    function exportarParaCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["ID Pedido", "Data", "Cliente", "WhatsApp", "Endereço", "Itens", "Subtotal", "Desconto", "Frete", "Total", "Forma de Pagamento", "Forma de Entrega", "Status", "Cupom"];
        csvContent += headers.join(";") + "\r\n";
        todosPedidos.forEach(({id, data: p}) => {
            const itensString = p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", ");
            const totalGeral = p.total + (p.valorFrete || 0);
            const row = [id, p.data.toDate().toLocaleString('pt-BR'), p.cliente, p.whatsapp, `"${p.endereco}"`, `"${itensString}"`, (p.subtotal || p.total).toFixed(2), (p.desconto || 0).toFixed(2), (p.valorFrete || 0).toFixed(2), totalGeral.toFixed(2), p.pagamento, p.entrega, p.status, (p.cupom?.codigo || '')];
            csvContent += row.join(";") + "\r\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "pedidos.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportarTodosOsDados() {
        if (todosProdutos.length > 0) {
            let csvContentProdutos = "data:text/csv;charset=utf-8,";
            const headersProdutos = ["ID", "Nome", "Preco", "UnidadeMedida", "Categoria", "Descricao", "Destaque"];
            csvContentProdutos += headersProdutos.join(";") + "\r\n";
            todosProdutos.forEach(({ id, data: p }) => {
                const row = [id, `"${p.nome}"`, p.preco, p.unidadeMedida, p.categoria, `"${p.descricao || ''}"`, p.destaque || false];
                csvContentProdutos += row.join(";") + "\r\n";
            });
            const encodedUriProdutos = encodeURI(csvContentProdutos);
            const linkProdutos = document.createElement("a");
            linkProdutos.setAttribute("href", encodedUriProdutos);
            linkProdutos.setAttribute("download", "produtos.csv");
            document.body.appendChild(linkProdutos);
            linkProdutos.click();
            document.body.removeChild(linkProdutos);
        } else { alert("Nenhum produto para exportar."); }
        if (todosPedidos.length > 0) { exportarParaCSV(); } 
        else { alert("Nenhum pedido para exportar."); }
    }

    // --- EVENT LISTENERS ---
    exportCsvBtn.addEventListener('click', exportarParaCSV);
    pedidosListaEl.addEventListener('click', (e) => {
        const target = e.target;
        const statusBtn = target.closest('.status-btn');
        if (statusBtn) { document.querySelectorAll('.status-options').forEach(el => el.classList.add('hidden')); document.getElementById(`status-options-${statusBtn.dataset.id}`).classList.toggle('hidden'); return; }
        const statusLink = target.closest('.status-link');
        if (statusLink) { e.preventDefault(); mudarStatusPedido(statusLink.dataset.id, statusLink.dataset.status); return; }
        const printBtn = target.closest('.print-btn');
        if (printBtn) { imprimirPedido(printBtn.dataset.id); return; }
        const deleteBtn = target.closest('.delete-pedido-btn');
        if (deleteBtn) { deletarPedido(deleteBtn.dataset.id); return; }
        const freteBtn = target.closest('.add-frete-btn');
        if (freteBtn) { abrirModalFrete(freteBtn.dataset.id); return; }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.relative')) { document.querySelectorAll('.status-options').forEach(el => el.classList.add('hidden')); } });
    formAddProduto.addEventListener('submit', salvarProduto);
    pesquisaProdutoAdminInput.addEventListener('input', filtrarErenderizar);
    filtroProdutoCategoriaSelect.addEventListener('change', filtrarErenderizar);
    pesquisaPedidoAdminInput.addEventListener('input', filtrarErenderizar);
    filtroDataInicioInput.addEventListener('change', filtrarErenderizar);
    filtroDataFimInput.addEventListener('change', filtrarErenderizar);
    cancelEditBtn.addEventListener('click', resetarFormulario);
    produtosAdminListaEl.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; if (btn.classList.contains('edit-btn')) editarProduto(btn.dataset.id); if (btn.classList.contains('delete-btn')) deletarProduto(btn.dataset.id); });
    fecharNovoPedidoModalBtn.addEventListener('click', () => modalNovoPedido.classList.add('hidden'));
    visualizarPedidoBtn.addEventListener('click', (e) => { const id = e.target.dataset.id; const el = document.getElementById(`pedido-${id}`); if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight'); setTimeout(() => el.classList.remove('highlight'), 2000); } modalNovoPedido.classList.add('hidden'); });
    formFrete.addEventListener('submit', salvarFrete);
    cancelarFreteBtn.addEventListener('click', () => modalFrete.classList.add('hidden'));
    formAddCupom.addEventListener('submit', salvarCupom);
    formAjustePreco.addEventListener('submit', ajustarPrecos);
    cancelCupomEditBtn.addEventListener('click', resetarFormularioCupom);
    cuponsListaEl.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-cupom-btn');
        if (editBtn) { editarCupom(editBtn.dataset.id); return; }
        const deleteBtn = e.target.closest('.delete-cupom-btn');
        if (deleteBtn) { deletarCupom(deleteBtn.dataset.id); return; }
    });
    formAddCategoria.addEventListener('submit', salvarCategoria);
    categoriasListaEl.addEventListener('click', e => {
        const deleteBtn = e.target.closest('.delete-categoria-btn');
        if (deleteBtn) { deletarCategoria(deleteBtn.dataset.id); }
    });
    const exportAllDataBtn = document.getElementById('export-all-data-btn');
    if (exportAllDataBtn) { exportAllDataBtn.addEventListener('click', exportarTodosOsDados); }
    
    // --- INICIALIZAÇÃO ---
    popularIconesSelect();
    carregarDados();
    document.body.addEventListener('click', async () => {
        await Tone.start();
    }, { once: true });
});
