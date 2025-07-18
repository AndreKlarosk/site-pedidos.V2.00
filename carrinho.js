document.addEventListener('DOMContentLoaded', () => {
    // --- DEFINIÇÕES GLOBAIS ---
    const formasPagamento = {
        'dinheiro': 'Dinheiro',
        'cartao': 'Cartão de Crédito/Débito',
        'pix': 'Pix'
    };
    const formasEntrega = {
        'buscar': 'Vou buscar na loja',
        'tele': 'Tele-entrega'
    };
    let categorias = {}; // Será preenchido pelo Firebase

    // --- INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAZSV573SyiddgzV8uzn7w6Ur0kdilI5tI",
        authDomain: "loja-pedidos-v1.firebaseapp.com",
        projectId: "loja-pedidos-v1",
        storageBucket: "loja-pedidos-v1.appspot.com",
        messagingSenderId: "624610926773",
        appId: "1:624610926773:web:6540a1ec6c1fca18819efc"
    };
    const { initializeApp, getFirestore, collection, addDoc, serverTimestamp, getDoc, doc, query, onSnapshot, updateDoc, setDoc, increment } = window.firebase;
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) { console.error("Erro Firebase:", e); return; }

    // --- ESTADO ---
    let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
    let cupomAplicado = null;

    // --- SELETORES ---
    const carrinhoItensListaEl = document.getElementById('carrinho-itens-lista');
    const carrinhoSubtotalEl = document.getElementById('carrinho-subtotal');
    const carrinhoDescontoEl = document.getElementById('carrinho-desconto');
    const carrinhoDescontoContainer = document.getElementById('carrinho-desconto-container');
    const carrinhoTotalEl = document.getElementById('carrinho-total');
    const cartCounterEl = document.getElementById('cart-counter');
    const formPedido = document.getElementById('form-pedido');
    const finalizarPedidoBtn = document.getElementById('finalizar-pedido-btn');
    const formaPagamentoSelect = document.getElementById('forma-pagamento');
    const formaEntregaSelect = document.getElementById('forma-entrega');
    const modalConfirmacao = document.getElementById('modal-confirmacao');
    const fecharModalBtn = document.getElementById('fechar-modal-btn');
    const pedidoIdDisplay = document.getElementById('pedido-id-display');
    const copiarIdBtn = document.getElementById('copiar-id-btn');
    const cupomInput = document.getElementById('cupom-input');
    const aplicarCupomBtn = document.getElementById('aplicar-cupom-btn');
    const cupomFeedback = document.getElementById('cupom-feedback');
    const cpfNotaCheckbox = document.getElementById('cpf-nota-checkbox');
    const cpfNotaInput = document.getElementById('cpf-nota-input');

    // --- FUNÇÕES ---

    const resetarCupomState = (mensagem = '', cor = 'text-gray-500') => {
        cupomAplicado = null;
        cupomInput.value = '';
        cupomInput.disabled = false;
        aplicarCupomBtn.disabled = false;
        cupomFeedback.textContent = mensagem;
        cupomFeedback.className = `text-sm mt-1 h-4 ${cor}`;
    };

    function updateCartCounter() {
        const totalItems = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
        if (totalItems > 0) {
            cartCounterEl.textContent = totalItems;
            cartCounterEl.classList.remove('hidden');
        } else {
            cartCounterEl.classList.add('hidden');
        }
    }

    function popularSeletores() {
        formaPagamentoSelect.innerHTML = '<option value="">-- Forma de Pagamento --</option>';
        for (const key in formasPagamento) {
            formaPagamentoSelect.innerHTML += `<option value="${formasPagamento[key]}">${formasPagamento[key]}</option>`;
        }

        formaEntregaSelect.innerHTML = '<option value="">-- Forma de Entrega --</option>';
        for (const key in formasEntrega) {
            formaEntregaSelect.innerHTML += `<option value="${formasEntrega[key]}">${formasEntrega[key]}</option>`;
        }
    }

    function calcularErenderizarTotal() {
        const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        let desconto = 0;
        
        if (cupomAplicado) {
            const categoriasAplicaveis = cupomAplicado.categoriasAplicaveis || ['todos'];
            let subtotalElegivel = 0;

            if (categoriasAplicaveis.includes('todos')) {
                subtotalElegivel = subtotal;
            } else {
                subtotalElegivel = carrinho
                    .filter(item => categoriasAplicaveis.includes(item.categoria))
                    .reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
            }
            
            if (subtotalElegivel > 0) {
                if (cupomAplicado.tipo === 'fixo') {
                    desconto = Math.min(cupomAplicado.valor, subtotalElegivel);
                } else if (cupomAplicado.tipo === 'porcentagem') {
                    desconto = (subtotalElegivel * cupomAplicado.valor) / 100;
                }
            }
        }
        
        if (desconto > subtotal) desconto = subtotal;
        if (desconto < 0) desconto = 0;

        const total = subtotal - desconto;
        
        carrinhoSubtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;

        if (desconto > 0) {
            carrinhoDescontoEl.textContent = `- R$ ${desconto.toFixed(2).replace('.', ',')}`;
            carrinhoDescontoContainer.classList.remove('hidden');
        } else {
            carrinhoDescontoContainer.classList.add('hidden');
        }

        carrinhoTotalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }

    function renderizarCarrinho() {
        updateCartCounter();
        if (carrinho.length === 0) {
            carrinhoItensListaEl.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-cart-shopping text-5xl text-gray-300 mb-4"></i><h3 class="text-xl font-semibold text-gray-700 mb-2">Seu carrinho está vazio</h3><p class="text-gray-500 mb-6">Adicione produtos para vê-los aqui.</p><a href="index.html" class="bg-primary text-white font-bold py-3 px-6 rounded-md hover:bg-primary-hover transition-colors inline-flex items-center gap-2"><i class="fa-solid fa-store"></i>Voltar para a Loja</a></div>`;
            finalizarPedidoBtn.disabled = true;
            resetarCupomState();
        } else {
            finalizarPedidoBtn.disabled = false;
            carrinhoItensListaEl.innerHTML = '';
            carrinho.forEach((item, index) => {
                const icone = categorias[item.categoria]?.icone || 'fa-solid fa-box';
                const placeholderImg = 'logo.png';
                const imagemOuIconeHtml = item.imageUrl
                    ? `<img src="${item.imageUrl}" alt="${item.nome}" class="w-16 h-16 object-cover rounded-md" onerror="this.onerror=null;this.src='${placeholderImg}';">`
                    : `<div class="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-md"><i class="${icone} text-3xl text-gray-400"></i></div>`;

                const itemEl = document.createElement('div');
                itemEl.className = 'flex items-center justify-between py-4 border-b';
                itemEl.innerHTML = `
                    <div class="flex items-center gap-4">
                        ${imagemOuIconeHtml}
                        <div>
                            <p class="font-semibold">${item.nome}</p>
                            <p class="text-sm text-gray-600">R$ ${item.preco.toFixed(2).replace('.',',')} / ${item.unidadeMedida}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="number" value="${item.quantidade}" min="1" data-index="${index}" class="qtd-input w-16 text-center border rounded-md">
                        <button data-index="${index}" class="remove-btn text-red-500 hover:text-red-700"><i class="fa-solid fa-trash-can"></i></button>
                    </div>`;
                carrinhoItensListaEl.appendChild(itemEl);
            });
        }
        calcularErenderizarTotal();
    }

    function atualizarQuantidade(index, quantidade) {
        if (quantidade > 0) {
            carrinho[index].quantidade = quantidade;
        } else {
            carrinho.splice(index, 1);
        }
        localStorage.setItem('carrinho', JSON.stringify(carrinho));
        
        if (cupomAplicado) {
            resetarCupomState('Carrinho atualizado. Aplique o cupom novamente.', 'text-yellow-600');
        }
        
        renderizarCarrinho();
    }
    
    async function aplicarCupom() {
        const codigo = cupomInput.value.trim().toUpperCase();
        if (!codigo) return;
        
        cupomFeedback.textContent = 'Validando...';
        cupomFeedback.className = 'text-sm mt-1 h-4 text-gray-500';
        aplicarCupomBtn.disabled = true;

        try {
            const cupomRef = doc(db, "cupons", codigo);
            const docSnap = await getDoc(cupomRef);

            if (!docSnap.exists()) {
                resetarCupomState('Cupom inválido.', 'text-red-600');
                return;
            }

            const cupom = docSnap.data();
            const hoje = new Date();
            const validade = cupom.validade.toDate();
            
            if (validade < hoje) {
                resetarCupomState('Este cupom expirou.', 'text-red-600');
                return;
            }
            
            const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

            if (cupom.valorMinimo > 0 && subtotal < cupom.valorMinimo) {
                resetarCupomState(`Pedido mínimo de R$ ${cupom.valorMinimo.toFixed(2).replace('.',',')} para este cupom.`, 'text-red-600');
                return;
            }

            const categoriasAplicaveis = cupom.categoriasAplicaveis || ['todos'];
            const temItemElegivel = categoriasAplicaveis.includes('todos') || 
                                   carrinho.some(item => categoriasAplicaveis.includes(item.categoria));
            
            if (!temItemElegivel) {
                resetarCupomState('Cupom não aplicável a estes itens.', 'text-red-600');
                return;
            }
            
            cupomAplicado = { id: docSnap.id, ...cupom };
            cupomFeedback.textContent = 'Cupom aplicado!';
            cupomFeedback.className = 'text-sm mt-1 h-4 text-green-600';
            cupomInput.disabled = true;
            aplicarCupomBtn.disabled = true;

        } catch (error) {
            console.error("Erro ao aplicar cupom:", error);
            resetarCupomState('Erro ao validar o cupom.', 'text-red-600');
        } finally {
            calcularErenderizarTotal();
        }
    }

    async function finalizarPedido(e) {
        e.preventDefault();
        const nome = document.getElementById('nome').value.trim();
        const endereco = document.getElementById('endereco').value.trim();
        const whatsapp = document.getElementById('whatsapp').value.trim();
        const pagamento = formaPagamentoSelect.value;
        const entrega = formaEntregaSelect.value;
        const solicitaCpf = cpfNotaCheckbox.checked;
        const cpf = cpfNotaInput.value.trim();

        if (!nome || !endereco || !whatsapp || !pagamento || !entrega) {
            alert("Por favor, preencha todos os campos do formulário.");
            return;
        }

        if(solicitaCpf && !cpf) {
            alert("Por favor, preencha o campo CPF.");
            return;
        }
        
        finalizarPedidoBtn.disabled = true;
        finalizarPedidoBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Enviando...';
        
        const subtotal = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        let desconto = 0;

        if (cupomAplicado) {
            if (cupomAplicado.valorMinimo > 0 && subtotal < cupomAplicado.valorMinimo) {
                alert(`O valor mínimo para usar o cupom ${cupomAplicado.id} é de R$ ${cupomAplicado.valorMinimo.toFixed(2).replace('.',',')}. Seu pedido não atinge esse valor.`);
                finalizarPedidoBtn.disabled = false;
                finalizarPedidoBtn.innerHTML = '<i class="fa-solid fa-shopping-cart"></i> Finalizar Pedido';
                return;
            }

            const categoriasAplicaveis = cupomAplicado.categoriasAplicaveis || ['todos'];
            let subtotalElegivel = 0;
            if (categoriasAplicaveis.includes('todos')) {
                subtotalElegivel = subtotal;
            } else {
                subtotalElegivel = carrinho.filter(item => categoriasAplicaveis.includes(item.categoria)).reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
            }
            
            if (subtotalElegivel > 0) {
                if (cupomAplicado.tipo === 'fixo') {
                    desconto = Math.min(cupomAplicado.valor, subtotalElegivel);
                } else if (cupomAplicado.tipo === 'porcentagem') {
                    desconto = (subtotalElegivel * cupomAplicado.valor) / 100;
                }
            }
        }

        if (desconto > subtotal) desconto = subtotal;
        desconto = parseFloat(desconto.toFixed(2));
        const total = subtotal - desconto;
        
        try {
            const pedido = {
                cliente: nome, endereco, whatsapp, pagamento, entrega,
                itens: carrinho.map(item => ({ id: item.id, nome: item.nome, preco: item.preco, quantidade: item.quantidade, categoria: item.categoria })),
                subtotal: subtotal,
                desconto: desconto,
                total: total,
                valorFrete: 0,
                solicitaCpf: solicitaCpf,
                cpf: solicitaCpf ? cpf : '',
                status: 'Recebido', data: serverTimestamp()
            };

            if (cupomAplicado && desconto > 0) {
                pedido.cupom = {
                    codigo: cupomAplicado.id,
                    tipo: cupomAplicado.tipo,
                    valor: cupomAplicado.valor
                };
            }

            const docRef = await addDoc(collection(db, "pedidos"), pedido);
            
            pedidoIdDisplay.textContent = docRef.id;
            modalConfirmacao.classList.remove('hidden');
            
            carrinho = [];
            localStorage.removeItem('carrinho');
            formPedido.reset();
            renderizarCarrinho();
        } catch (error) {
            console.error("Erro ao enviar pedido:", error);
            alert("Ocorreu um erro ao enviar seu pedido.");
        } finally {
            finalizarPedidoBtn.disabled = false;
            finalizarPedidoBtn.innerHTML = '<i class="fa-solid fa-shopping-cart"></i> Finalizar Pedido';
        }
    }
    
    function copiarIdPedido() {
        const id = pedidoIdDisplay.textContent;
        if (!id) return;
        navigator.clipboard.writeText(id).then(() => {
            copiarIdBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { copiarIdBtn.innerHTML = '<i class="fa-solid fa-copy"></i>'; }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar ID: ', err);
            const textArea = document.createElement("textarea");
            textArea.value = id;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                copiarIdBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { copiarIdBtn.innerHTML = '<i class="fa-solid fa-copy"></i>'; }, 2000);
            } catch (err) { alert('Não foi possível copiar o ID.'); }
            document.body.removeChild(textArea);
        });
    }

    async function trackCartVisit() {
        if (!sessionStorage.getItem('cartVisited')) {
            sessionStorage.setItem('cartVisited', 'true');
            const analyticsRef = doc(db, "analytics", "siteMetrics");
            try {
                await updateDoc(analyticsRef, {
                    visitasCarrinho: increment(1)
                });
            } catch (error) {
                 if (error.code === 'not-found') {
                    await setDoc(analyticsRef, { visitasSite: 0, visitasCarrinho: 1 }, { merge: true });
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
            renderizarCarrinho();
        });
        popularSeletores();
        trackCartVisit();
    }

    // --- EVENT LISTENERS ---
    cpfNotaCheckbox.addEventListener('change', () => {
        cpfNotaInput.classList.toggle('hidden', !cpfNotaCheckbox.checked);
        if(cpfNotaCheckbox.checked) {
            cpfNotaInput.required = true;
        } else {
            cpfNotaInput.required = false;
        }
    });

    carrinhoItensListaEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('qtd-input')) {
            atualizarQuantidade(e.target.dataset.index, parseInt(e.target.value));
        }
    });
    carrinhoItensListaEl.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) {
            atualizarQuantidade(e.target.closest('.remove-btn').dataset.index, 0);
        }
    });
    formPedido.addEventListener('submit', finalizarPedido);
    fecharModalBtn.addEventListener('click', () => modalConfirmacao.classList.add('hidden'));
    copiarIdBtn.addEventListener('click', copiarIdPedido);
    aplicarCupomBtn.addEventListener('click', aplicarCupom);

    // --- INICIALIZAÇÃO ---
    iniciarApp();
});
