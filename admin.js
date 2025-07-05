document.addEventListener('DOMContentLoaded', () => {

    // --- DEFINIÇÕES DA LOJA ---
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
        'Recebido': { texto: 'Recebido', cor: 'bg-blue-100 text-blue-800' },
        'Em Preparacao': { texto: 'Em Preparação', cor: 'bg-yellow-100 text-yellow-800' },
        'Pronto': { texto: 'Pronto', cor: 'bg-green-100 text-green-800' },
        'Finalizado': { texto: 'Finalizado', cor: 'bg-gray-200 text-gray-800' },
        'Cancelado': { texto: 'Cancelado', cor: 'bg-red-100 text-red-800' }
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
    const { initializeApp, getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) { console.error("Erro Firebase:", e); return; }

    // --- ESTADO ---
    let todosProdutos = [];
    let todosPedidos = [];
    let isFirstLoad = true;
    const synth = new Tone.Synth().toDestination();

    // --- SELETORES ---
    const pedidosListaEl = document.getElementById('pedidos-lista');
    const produtosAdminListaEl = document.getElementById('produtos-admin-lista');
    const formAddProduto = document.getElementById('form-add-produto');
    const pesquisaProdutoAdminInput = document.getElementById('pesquisa-produto-admin');
    const pesquisaPedidoAdminInput = document.getElementById('pesquisa-pedido-admin');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const categoriaSelect = document.getElementById('categoria-produto');
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

    // --- FUNÇÕES ---

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
            const totalGeral = pedido.total + (pedido.valorFrete || 0);

            pedidoCard.innerHTML = `
                <div class="flex justify-between items-start">
                    <div><h4 class="font-bold text-lg">${pedido.cliente}</h4><p class="text-xs text-gray-400 font-mono">${id}</p></div>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full ${statusAtual.cor}">${statusAtual.texto}</span>
                </div>
                <div class="my-3 text-sm space-y-1 border-t border-b py-2">
                    <p><strong>Entrega:</strong> ${pedido.entrega}</p>
                    <p><strong>Pagamento:</strong> ${pedido.pagamento}</p>
                </div>
                <div class="my-2"><p class="font-semibold text-sm">Itens:</p><ul class="list-disc list-inside text-sm pl-2">${pedido.itens.map(item => `<li>${item.quantidade}x ${item.nome}</li>`).join('')}</ul></div>
                <div class="text-right text-sm">
                    <p>Subtotal: R$ ${pedido.total.toFixed(2).replace('.',',')}</p>
                    <p>Frete: R$ ${(pedido.valorFrete || 0).toFixed(2).replace('.',',')}</p>
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
        produtosAdminListaEl.innerHTML = produtos.length === 0 ? '<p>Nenhum produto.</p>' : '';
        const produtosOrdenados = [...produtos.filter(p => p.data.destaque), ...produtos.filter(p => !p.data.destaque)];
        produtosOrdenados.forEach(({ id, data: p }) => {
            const item = document.createElement('div');
            item.className = 'bg-white p-3 rounded-md shadow-sm flex justify-between items-center';
            item.innerHTML = `<div class="flex items-center gap-3"><i class="${categorias[p.categoria]?.icone || 'fa-solid fa-box'} w-5 h-5 text-center"></i><div><p class="font-semibold flex items-center gap-2">${p.nome} ${p.destaque ? '<i class="fa-solid fa-star text-yellow-400"></i>' : ''}</p><p class="text-sm text-gray-500">R$ ${p.preco.toFixed(2).replace('.',',')} / ${p.unidadeMedida}</p></div></div><div class="flex gap-2"><button data-id="${id}" class="edit-btn p-2 hover:bg-gray-200 rounded-full"><i class="fa-solid fa-pencil pointer-events-none"></i></button><button data-id="${id}" class="delete-btn p-2 hover:bg-gray-200 rounded-full"><i class="fa-solid fa-trash-can pointer-events-none"></i></button></div>`;
            produtosAdminListaEl.appendChild(item);
        });
    };

    const filtrarErenderizar = () => {
        const termoProduto = pesquisaProdutoAdminInput.value.toLowerCase();
        const produtosFiltrados = todosProdutos.filter(p => p.data.nome.toLowerCase().includes(termoProduto));
        renderizarProdutosAdmin(produtosFiltrados);
        const termoPedido = pesquisaPedidoAdminInput.value.toLowerCase();
        const pedidosFiltrados = todosPedidos.filter(p => p.data.cliente.toLowerCase().includes(termoPedido) || p.id.toLowerCase().includes(termoPedido));
        renderizarPedidos(pedidosFiltrados);
    };

    function carregarDados() {
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
        onSnapshot(query(collection(db, "produtos")), (snapshot) => {
            todosProdutos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
            filtrarErenderizar();
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
    }

    function resetarFormulario() {
        formAddProduto.reset();
        document.getElementById('produto-id').value = '';
        destaqueCheckbox.checked = false;
        cancelEditBtn.classList.add('hidden');
    }

    function popularCategorias() {
        categoriaSelect.innerHTML = '<option value="">-- Categoria --</option>';
        for (const key in categorias) {
            categoriaSelect.innerHTML += `<option value="${key}">${categorias[key].nome}</option>`;
        }
    }

    async function deletarProduto(id) { if (confirm("Excluir este produto?")) { await deleteDoc(doc(db, "produtos", id)); } }
    async function deletarPedido(id) { if (confirm("EXCLUIR este pedido? Esta ação não pode ser desfeita.")) { await deleteDoc(doc(db, "pedidos", id)); } }
    async function mudarStatusPedido(pedidoId, novoStatus) { await updateDoc(doc(db, "pedidos", pedidoId), { status: novoStatus }); }
    
    function abrirModalFrete(pedidoId) {
        fretePedidoIdInput.value = pedidoId;
        modalFrete.classList.remove('hidden');
    }

    async function salvarFrete(e) {
        e.preventDefault();
        const pedidoId = fretePedidoIdInput.value;
        const valorFrete = parseFloat(valorFreteInput.value);
        if (isNaN(valorFrete)) {
            alert("Valor inválido. Por favor, insira apenas números.");
            return;
        }
        await updateDoc(doc(db, "pedidos", pedidoId), { valorFrete: valorFrete });
        modalFrete.classList.add('hidden');
        formFrete.reset();
    }

    function imprimirPedido(pedidoId) {
        const { data: pedido } = todosPedidos.find(p => p.id === pedidoId);
        const dataPedido = pedido.data ? pedido.data.toDate().toLocaleString('pt-BR') : 'Data indisponível';
        const totalGeral = pedido.total + (pedido.valorFrete || 0);
        const itensHtml = pedido.itens.map(item => `<li class="item-line"><span>${item.quantidade}x ${item.nome}</span><span>R$ ${(item.preco * item.quantidade).toFixed(2)}</span></li>`).join('');
        const conteudo = `<div class="receipt-print"><img src="logo.png" alt="Logo" class="logo"><h1>Comprovante de Pedido</h1><p>ID: ${pedidoId}</p><p>Data: ${dataPedido}</p><h2>Cliente</h2><p>${pedido.cliente}</p><p>${pedido.endereco}</p><p>WhatsApp: ${pedido.whatsapp}</p><h2>Itens</h2><ul>${itensHtml}</ul><div class="total-section"><p class="item-line"><span>Subtotal</span><span>R$ ${pedido.total.toFixed(2)}</span></p><p class="item-line"><span>Frete</span><span>R$ ${(pedido.valorFrete || 0).toFixed(2)}</span></p><p class="total-line"><span>TOTAL</span><span>R$ ${totalGeral.toFixed(2)}</span></p></div><p style="text-align: center; margin-top: 10px;">Entrega: ${pedido.entrega}</p><p style="text-align: center;">Pagamento: ${pedido.pagamento}</p></div>`;
        const pwin = window.open('', '_blank');
        pwin.document.write(`<html><head><title>Imprimir</title><style>${document.querySelector('style').innerHTML}</style></head><body>${conteudo}</body></html>`);
        pwin.document.close();
        setTimeout(() => { pwin.print(); pwin.close(); }, 250);
    }
    
    function exportarParaCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["ID Pedido", "Data", "Cliente", "WhatsApp", "Endereço", "Itens", "Subtotal", "Frete", "Total", "Forma de Pagamento", "Forma de Entrega", "Status"];
        csvContent += headers.join(";") + "\r\n";
        todosPedidos.forEach(({id, data: p}) => {
            const itensString = p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", ");
            const totalGeral = p.total + (p.valorFrete || 0);
            const row = [id, p.data.toDate().toLocaleString('pt-BR'), p.cliente, p.whatsapp, `"${p.endereco}"`, `"${itensString}"`, p.total.toFixed(2), (p.valorFrete || 0).toFixed(2), totalGeral.toFixed(2), p.pagamento, p.entrega, p.status];
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
        // 1. Exportar Produtos
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
        } else {
            alert("Nenhum produto para exportar.");
        }

        // 2. Exportar Pedidos (reutilizando a lógica existente)
        if (todosPedidos.length > 0) {
            let csvContentPedidos = "data:text/csv;charset=utf-8,";
            const headersPedidos = ["ID Pedido", "Data", "Cliente", "WhatsApp", "Endereco", "Itens", "Subtotal", "Frete", "Total", "Forma de Pagamento", "Forma de Entrega", "Status"];
            csvContentPedidos += headersPedidos.join(";") + "\r\n";

            todosPedidos.forEach(({ id, data: p }) => {
                const itensString = p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", ");
                const totalGeral = p.total + (p.valorFrete || 0);
                const row = [id, p.data.toDate().toLocaleString('pt-BR'), `"${p.cliente}"`, p.whatsapp, `"${p.endereco}"`, `"${itensString}"`, p.total.toFixed(2), (p.valorFrete || 0).toFixed(2), totalGeral.toFixed(2), p.pagamento, p.entrega, p.status];
                csvContentPedidos += row.join(";") + "\r\n";
            });

            const encodedUriPedidos = encodeURI(csvContentPedidos);
            const linkPedidos = document.createElement("a");
            linkPedidos.setAttribute("href", encodedUriPedidos);
            linkPedidos.setAttribute("download", "pedidos.csv");
            document.body.appendChild(linkPedidos);
            linkPedidos.click(); // O navegador fará o download deste segundo arquivo
            document.body.removeChild(linkPedidos);
        } else {
            alert("Nenhum pedido para exportar.");
        }
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
    pesquisaPedidoAdminInput.addEventListener('input', filtrarErenderizar);
    cancelEditBtn.addEventListener('click', resetarFormulario);
    produtosAdminListaEl.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; if (btn.classList.contains('edit-btn')) editarProduto(btn.dataset.id); if (btn.classList.contains('delete-btn')) deletarProduto(btn.dataset.id); });
    fecharNovoPedidoModalBtn.addEventListener('click', () => modalNovoPedido.classList.add('hidden'));
    visualizarPedidoBtn.addEventListener('click', (e) => { const id = e.target.dataset.id; const el = document.getElementById(`pedido-${id}`); if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight'); setTimeout(() => el.classList.remove('highlight'), 2000); } modalNovoPedido.classList.add('hidden'); });
    formFrete.addEventListener('submit', salvarFrete);
    cancelarFreteBtn.addEventListener('click', () => modalFrete.classList.add('hidden'));
    
    const exportAllDataBtn = document.getElementById('export-all-data-btn');
    if (exportAllDataBtn) {
        exportAllDataBtn.addEventListener('click', exportarTodosOsDados);
    }
    
    // --- INICIALIZAÇÃO ---
    popularCategorias();
    carregarDados();
    document.body.addEventListener('click', async () => {
        await Tone.start();
        console.log('Contexto de áudio iniciado pelo usuário.');
    }, { once: true }); // A opção { once: true } garante que isso só aconteça uma vez.
});