// ======================================================
// SAFE
// Módulo: Arremesso de Medicine Ball de 2kg — PROESP-BR
// (Potência de membros superiores — usado no lugar de
// "Flexão de Braços", que não existe na bateria oficial
// do PROESP-BR, por decisão do usuário)
//
// TELA REFORMULADA PRA COLETA EM CAMPO: cards compactos por
// aluno, salvamento imediato (sem "Salvar Tudo"), progresso
// da turma, filtros instantâneos, painel de histórico
// lateral e aviso quando o valor foge muito do esperado.
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    obterContextoUsuario,
    mostrarToast,
    calcularIdade
} from "../core/utils.js";

import { iconeTeste, iniciarPopupTestes, iniciarModalComoExecutar } from "../core/testeInfoUI.js";

import{
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ======================================================
// TABELAS OFICIAIS — PROESP-BR, Manual 2021 (5a edicao,
// A.R. Gaya, A. Gaya, A. Pedretti, J. Mello), Arremesso de
// Medicine Ball de 2kg. Fonte primaria conferida diretamente.
// Cobre idades 6 a 17.
// ======================================================

const TABELA_DESEMPENHO = {

    masculino: {
        6:{fraco:136.2, razoavel:154.9, bom:180.3, muitoBom:248.9},
        7:{fraco:154.9, razoavel:175.5, bom:201.3, muitoBom:261.3},
        8:{fraco:173.4, razoavel:195.8, bom:223.2, muitoBom:284.2},
        9:{fraco:192.2, razoavel:216.7, bom:246.9, muitoBom:315.2},
        10:{fraco:209.2, razoavel:235.6, bom:268.7, muitoBom:345.3},
        11:{fraco:230.1, razoavel:259.1, bom:295.0, muitoBom:376.7},
        12:{fraco:255.2, razoavel:287.6, bom:327.3, muitoBom:416.1},
        13:{fraco:295.6, razoavel:333.9, bom:379.9, muitoBom:479.6},
        14:{fraco:348.5, razoavel:393.9, bom:446.4, muitoBom:554.4},
        15:{fraco:405.1, razoavel:456.1, bom:512.9, muitoBom:623.4},
        16:{fraco:448.3, razoavel:501.6, bom:560.0, muitoBom:670.8},
        17:{fraco:486.8, razoavel:541.2, bom:600.1, muitoBom:710.3}
    },

    feminino: {
        6:{fraco:129.7, razoavel:146.6, bom:167.4, muitoBom:214.8},
        7:{fraco:141.7, razoavel:159.9, bom:182.0, muitoBom:230.4},
        8:{fraco:156.6, razoavel:176.4, bom:200.3, muitoBom:252.1},
        9:{fraco:174.1, razoavel:195.8, bom:222.1, muitoBom:279.5},
        10:{fraco:191.9, razoavel:215.5, bom:244.3, muitoBom:308.0},
        11:{fraco:214.3, razoavel:240.2, bom:271.8, muitoBom:341.8},
        12:{fraco:236.8, razoavel:265.0, bom:298.9, muitoBom:372.1},
        13:{fraco:261.3, razoavel:292.1, bom:328.2, muitoBom:403.4},
        14:{fraco:283.5, razoavel:316.5, bom:354.4, muitoBom:431.7},
        15:{fraco:299.9, razoavel:334.1, bom:373.4, muitoBom:452.8},
        16:{fraco:309.7, razoavel:344.6, bom:385.0, muitoBom:468.0},
        17:{fraco:318.4, razoavel:353.7, bom:395.5, muitoBom:484.0}
    }

};

const TABELA_SAUDE = {

    masculino: {6:147.0, 7:168.7, 8:190.0, 9:210.0, 10:232.0, 11:260.0, 12:290.0, 13:335.0, 14:400.0, 15:440.0, 16:480.0, 17:500.0},

    feminino: {6:125.0, 7:140.0, 8:158.1, 9:175.0, 10:202.0, 11:228.0, 12:260.0, 13:280.0, 14:290.0, 15:306.0, 16:310.0, 17:315.0}

};

function idadeNaTabela(idade){

    return Math.min(Math.max(idade, 6), 17);

}

function chaveSexo(sexo){

    return (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

}

// Classificacao de desempenho (5 categorias, manual 2021)
export function classificarDesempenho(distanciaCm, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    if(distanciaCm < faixa.fraco) return "Fraco";
    if(distanciaCm <= faixa.razoavel) return "Razoável";
    if(distanciaCm <= faixa.bom) return "Bom";
    if(distanciaCm <= faixa.muitoBom) return "Muito Bom";
    return "Excelência";

}

// Classificacao de zona de saúde (2 zonas)
export function classificarSaude(distanciaCm, idade, sexo){

    const corte = TABELA_SAUDE[chaveSexo(sexo)][idadeNaTabela(idade)];

    return distanciaCm < corte ? "Zona de risco à saúde" : "Zona saudável";

}

// Faixa "razoável de se esperar" pra checagem de digitação (bem mais
// larga que a tabela de classificação, só pra pegar erro grosseiro
// de digitação — ex: 2100 em vez de 210)
function foraDaFaixaEsperada(distanciaCm, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    return distanciaCm < faixa.fraco * 0.35 || distanciaCm > faixa.muitoBom * 1.8;

}

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let turmas = [];

let dadosAlunos = []; // [{aluno, ultimoValor, ultimaDesempenho, ultimaSaude, avaliadoHoje, ausente}]

let filtroAtual = "todos";

let ordenacaoAtual = "alfabetica";

let termoBusca = "";

let turmaMB, gridAlunosMB, buscaAlunoMB, ordenacaoMB, filtrosSituacaoMB;
let areaProgresso, areaFiltros, cardSelecionarTurma;
let progressoTurmaNome, progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaTurma, metaQtdAlunos, metaData;
let btnAlunoAnterior, btnProximoAluno;

function obterElementos(){

    turmaMB = document.getElementById("turmaMB");
    gridAlunosMB = document.getElementById("gridAlunosMB");
    buscaAlunoMB = document.getElementById("buscaAlunoMB");
    ordenacaoMB = document.getElementById("ordenacaoMB");
    filtrosSituacaoMB = document.getElementById("filtrosSituacaoMB");
    areaProgresso = document.getElementById("areaProgresso");
    areaFiltros = document.getElementById("areaFiltros");
    cardSelecionarTurma = document.getElementById("cardSelecionarTurma");
    progressoTurmaNome = document.getElementById("progressoTurmaNome");
    progressoContagem = document.getElementById("progressoContagem");
    progressoPreenchimento = document.getElementById("progressoPreenchimento");
    qtdConcluidos = document.getElementById("qtdConcluidos");
    qtdPendentes = document.getElementById("qtdPendentes");
    qtdAusentes = document.getElementById("qtdAusentes");
    metaProfessor = document.getElementById("metaProfessor");
    metaTurma = document.getElementById("metaTurma");
    metaQtdAlunos = document.getElementById("metaQtdAlunos");
    metaData = document.getElementById("metaData");
    btnAlunoAnterior = document.getElementById("btnAlunoAnterior");
    btnProximoAluno = document.getElementById("btnProximoAluno");

}

function configurarEventos(){

    turmaMB.addEventListener("change", carregarDadosDaTurma);

    buscaAlunoMB.addEventListener("keyup", () => {

        termoBusca = buscaAlunoMB.value.trim().toLowerCase();

        renderizarGrid();

    });

    ordenacaoMB.addEventListener("change", () => {

        ordenacaoAtual = ordenacaoMB.value;

        renderizarGrid();

    });

    filtrosSituacaoMB.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacaoMB.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoAluno.addEventListener("click", () => moverFoco(1));

    btnAlunoAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("medicineball");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("btnCancelarValidacaoMB").addEventListener("click", () => {

        document.getElementById("modalValidacaoMB").classList.remove("show");

    });

    document.getElementById("btnConfirmarValidacaoMB").addEventListener("click", () => {

        document.getElementById("modalValidacaoMB").classList.remove("show");

        if(alunoPendenteDeConfirmacao){

            salvarResultado(alunoPendenteDeConfirmacao, true);

            alunoPendenteDeConfirmacao = null;

        }

    });

}

export async function init(){

    obterElementos();

    iniciarPopupTestes();

    iniciarModalComoExecutar();

    const containerIconeTeste = document.getElementById("iconeTesteContainer");

    if(containerIconeTeste){

        containerIconeTeste.innerHTML = iconeTeste("medicineball", 56);

    }

    const contexto = obterContextoUsuario();

    metaProfessor.textContent = contexto.nome || "-";

    metaData.textContent = new Date().toLocaleDateString("pt-BR");

    configurarEventos();

    await carregarTurmas();

}

// ======================================================
// CONSULTA FILTRADA PELA ESCOLA DO USUÁRIO LOGADO
// ======================================================

function filtroEscola(condicoesExtra = []){

    if(souSuperAdmin()){

        return condicoesExtra;

    }

    return [...condicoesExtra, where("escolaId","==",obterEscolaId())];

}

// ======================================================
// CARREGAR TURMAS
// ======================================================

async function carregarTurmas(){

    turmas = [];

    turmaMB.innerHTML = `<option value="">Selecione a turma...</option>`;

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"turmas"), ...condicoes, orderBy("nome"));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.forEach(turma=>{

            turmaMB.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

// ======================================================
// CARREGAR DADOS DA TURMA (alunos + resultados mais
// recentes de cada um, pra já mostrar nos cards)
// ======================================================

async function carregarDadosDaTurma(){

    dadosAlunos = [];

    gridAlunosMB.innerHTML = "";

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    if(!turmaMB.value){

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turmaMB.value);

    metaTurma.textContent = turmaAtual ? turmaAtual.nome : "-";

    gridAlunosMB.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando alunos...</p>`;

    try{

        // 1) Alunos da turma
        const condicoesAlunos = filtroEscola();

        const qAlunos = query(collection(db,"alunos"), ...condicoesAlunos, orderBy("nome"));

        const snapAlunos = await getDocs(qAlunos);

        const alunosDaTurma = [];

        snapAlunos.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turmaMB.value){

                alunosDaTurma.push(dadosAluno);

            }

        });

        // 2) Resultados já registrados (todos, pra achar o mais recente
        // de cada aluno e saber se já foi avaliado HOJE)
        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_medicineball"), ...condicoesAvaliacoes);

        const snapAvaliacoes = await getDocs(qAvaliacoes);

        const registrosPorAluno = new Map();

        snapAvaliacoes.forEach(doc=>{

            const dados = doc.data();

            if(!registrosPorAluno.has(dados.alunoId)){

                registrosPorAluno.set(dados.alunoId, []);

            }

            registrosPorAluno.get(dados.alunoId).push(dados);

        });

        const hojeISO = new Date().toISOString().slice(0,10);

        metaQtdAlunos.textContent = alunosDaTurma.length;

        dadosAlunos = alunosDaTurma.map(aluno=>{

            const registros = (registrosPorAluno.get(aluno.id) || []).slice()

                .sort((a,b)=>{

                    const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

                    const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

                    return dataB - dataA;

                });

            const maisRecente = registros[0] || null;

            const dataMaisRecenteISO = maisRecente?.dataTeste ? maisRecente.dataTeste.toDate().toISOString().slice(0,10) : null;

            return {

                aluno,
                ultimoValor: maisRecente?.distanciaCm ?? null,
                ultimaDesempenho: maisRecente?.classificacaoDesempenho ?? null,
                ultimaSaude: maisRecente?.classificacaoSaude ?? null,
                avaliadoHoje: dataMaisRecenteISO === hojeISO,
                ausente: false

            };

        });

        renderizarProgresso();

        renderizarGrid();

        areaProgresso.style.display = "block";

        areaFiltros.style.display = "flex";

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os alunos da turma.", "erro");

    }

}

// ======================================================
// PROGRESSO DA TURMA
// ======================================================

function renderizarProgresso(){

    const turmaAtual = turmas.find(t => t.id === turmaMB.value);

    const total = dadosAlunos.length;

    const concluidos = dadosAlunos.filter(d => d.avaliadoHoje).length;

    const ausentes = dadosAlunos.filter(d => d.ausente).length;

    const pendentes = total - concluidos - ausentes;

    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    progressoTurmaNome.textContent = turmaAtual ? turmaAtual.nome : "";

    progressoContagem.textContent = `${concluidos} de ${total} alunos avaliados hoje`;

    progressoPreenchimento.style.width = `${percentual}%`;

    qtdConcluidos.textContent = concluidos;

    qtdPendentes.textContent = pendentes;

    qtdAusentes.textContent = ausentes;

}

// ======================================================
// GRID DE CARDS (aplica busca + filtro + ordenação)
// ======================================================

function obterListaFiltrada(){

    let lista = dadosAlunos;

    if(termoBusca){

        lista = lista.filter(d => (d.aluno.nome || "").toLowerCase().includes(termoBusca));

    }

    if(filtroAtual === "pendente"){

        lista = lista.filter(d => !d.avaliadoHoje && !d.ausente);

    }else if(filtroAtual === "concluido"){

        lista = lista.filter(d => d.avaliadoHoje);

    }else if(filtroAtual === "ausente"){

        lista = lista.filter(d => d.ausente);

    }else if(filtroAtual === "risco"){

        lista = lista.filter(d => d.ultimaSaude === "Zona de risco à saúde");

    }

    lista = [...lista].sort((a,b)=>{

        if(ordenacaoAtual === "chamada"){

            return (a.aluno.numeroChamada ?? 9999) - (b.aluno.numeroChamada ?? 9999);

        }

        return (a.aluno.nome || "").localeCompare(b.aluno.nome || "", "pt-BR");

    });

    return lista;

}

function renderizarGrid(){

    const lista = obterListaFiltrada();

    if(lista.length === 0){

        gridAlunosMB.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum aluno encontrado com esse filtro.</p>`;

        return;

    }

    gridAlunosMB.innerHTML = lista.map(dadosAluno => renderizarCard(dadosAluno)).join("");

    // Reconecta os eventos de cada card (innerHTML novo perde os listeners antigos)
    lista.forEach(dadosAluno=>{

        const idAluno = dadosAluno.aluno.id;

        const card = document.getElementById(`card-${idAluno}`);

        if(!card){
            return;
        }

        card.querySelector(".btn-salvar-card")?.addEventListener("click", () => salvarResultado(idAluno));

        card.querySelector(".input-resultado")?.addEventListener("keyup", (evento)=>{

            if(evento.key === "Enter"){

                salvarResultado(idAluno);

            }

        });

        card.querySelector(".btn-ausente-card")?.addEventListener("click", () => alternarAusente(idAluno));

        card.querySelector(".card-aluno-nome")?.addEventListener("click", () => abrirHistoricoLateral(idAluno));

    });

}

function renderizarCard(dadosAluno){

    const { aluno, ultimoValor, ultimaDesempenho, ultimaSaude, avaliadoHoje, ausente } = dadosAluno;

    const idade = calcularIdade(aluno.dataNascimento);

    let statusBadge = `<span class="badge-status pendente">⏳ Pendente</span>`;

    if(ausente){

        statusBadge = `<span class="badge-status ausente">❌ Ausente</span>`;

    }else if(avaliadoHoje){

        statusBadge = `<span class="badge-status concluido">✔ Avaliado</span>`;

    }

    const ultimoResultadoTexto = ultimoValor !== null

        ? `${ultimoValor} cm — ${ultimaDesempenho || "-"}`

        : "Sem registro anterior";

    return `

        <div class="card-aluno-campo ${ausente ? "esmaecido" : ""}" id="card-${aluno.id}">

            <div class="card-aluno-topo">
                <span class="card-aluno-nome" title="Ver histórico">${aluno.nome}</span>
                ${statusBadge}
            </div>

            <div class="card-aluno-meta">
                ${idade ? `${idade} anos` : "-"} • ${aluno.sexo || "-"} • SAFE-ID ${aluno.codigoSAFE || "-"}
            </div>

            <div class="card-aluno-ultimo">Último: ${ultimoResultadoTexto}</div>

            ${!ausente ? `

                <div class="card-aluno-entrada">

                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        class="form-control input-resultado"
                        placeholder="cm"
                        aria-label="Resultado de ${aluno.nome}">

                    <button class="btn btn-primary btn-salvar-card">Salvar</button>

                    <button class="btn-ausente-card" title="Marcar ausente hoje">❌</button>

                </div>

            ` : `

                <button class="btn-secondary btn-ausente-card" style="width:100%;">Desmarcar ausência</button>

            `}

        </div>

    `;

}

// ======================================================
// MARCAR AUSENTE (só nessa sessão — não é um cadastro
// permanente de frequência, é uma conveniência do dia)
// ======================================================

function alternarAusente(alunoId){

    const dadosAluno = dadosAlunos.find(d => d.aluno.id === alunoId);

    if(!dadosAluno){
        return;
    }

    dadosAluno.ausente = !dadosAluno.ausente;

    renderizarProgresso();

    renderizarGrid();

}

// ======================================================
// SALVAR RESULTADO DE UM CARD
// ======================================================

async function salvarResultado(alunoId, forcarSemValidar = false){

    const dadosAluno = dadosAlunos.find(d => d.aluno.id === alunoId);

    if(!dadosAluno){
        return;
    }

    const card = document.getElementById(`card-${alunoId}`);

    const input = card?.querySelector(".input-resultado");

    if(!input || input.value === ""){

        mostrarToast("Informe o resultado antes de salvar.", "erro");

        return;

    }

    const distanciaCm = Number(input.value);

    if(isNaN(distanciaCm) || distanciaCm < 0){

        mostrarToast("Valor inválido.", "erro");

        return;

    }

    const idade = calcularIdade(dadosAluno.aluno.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Aluno sem data de nascimento cadastrada — não é possível classificar.", "erro");

        return;

    }

    // Validação inteligente: valor muito fora do esperado pra idade/sexo
    if(!forcarSemValidar && foraDaFaixaEsperada(distanciaCm, idade, dadosAluno.aluno.sexo)){

        abrirModalValidacao(distanciaCm, alunoId);

        return;

    }

    const classificacaoDesempenho = classificarDesempenho(distanciaCm, idade, dadosAluno.aluno.sexo);

    const classificacaoSaude = classificarSaude(distanciaCm, idade, dadosAluno.aluno.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        alunoId: dadosAluno.aluno.id,
        nome: dadosAluno.aluno.nome,
        codigoSAFE: dadosAluno.aluno.codigoSAFE || "",
        turmaId: turmaMB.value,
        escolaId: souSuperAdmin()
            ? ((turmas.find(t => t.id === turmaMB.value) || {}).escolaId || dadosAluno.aluno.escolaId || "")
            : obterEscolaId(),
        professorId: contexto.uid,
        distanciaCm,
        classificacaoDesempenho,
        classificacaoSaude,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_medicineball"), avaliacao);

        dadosAluno.ultimoValor = distanciaCm;

        dadosAluno.ultimaDesempenho = classificacaoDesempenho;

        dadosAluno.ultimaSaude = classificacaoSaude;

        dadosAluno.avaliadoHoje = true;

        mostrarToast(`${dadosAluno.aluno.nome}: ${classificacaoDesempenho} salvo!`);

        renderizarProgresso();

        renderizarGrid();

        focarProximoPendente(alunoId);

    }catch(e){

        console.error(e);

        mostrarToast("Erro ao salvar a avaliação.", "erro");

    }

}

// ======================================================
// VALIDAÇÃO INTELIGENTE (valor fora da faixa esperada)
// ======================================================

let alunoPendenteDeConfirmacao = null;

function abrirModalValidacao(valor, alunoId){

    alunoPendenteDeConfirmacao = alunoId;

    document.getElementById("mensagemValidacaoMB").textContent =

        `${valor} cm foge bastante do esperado pra esse aluno. Confira se digitou certo antes de confirmar.`;

    document.getElementById("modalValidacaoMB").classList.add("show");

}

// ======================================================
// NAVEGAÇÃO ANTERIOR / PRÓXIMO
// ======================================================

function focarProximoPendente(alunoIdAtual){

    const lista = obterListaFiltrada();

    const indiceAtual = lista.findIndex(d => d.aluno.id === alunoIdAtual);

    const proximoPendente = lista.slice(indiceAtual + 1).find(d => !d.avaliadoHoje && !d.ausente);

    if(proximoPendente){

        const proximoInput = document.getElementById(`card-${proximoPendente.aluno.id}`)?.querySelector(".input-resultado");

        proximoInput?.scrollIntoView({ behavior:"smooth", block:"center" });

        proximoInput?.focus();

    }

}

function moverFoco(direcao){

    const lista = obterListaFiltrada();

    if(lista.length === 0){
        return;
    }

    const elementoAtivo = document.activeElement;

    const cardAtivo = elementoAtivo?.closest(".card-aluno-campo");

    let indiceAtual = cardAtivo ? lista.findIndex(d => `card-${d.aluno.id}` === cardAtivo.id) : -1;

    let proximoIndice = indiceAtual + direcao;

    if(proximoIndice < 0){
        proximoIndice = 0;
    }

    if(proximoIndice >= lista.length){
        proximoIndice = lista.length - 1;
    }

    const alvo = document.getElementById(`card-${lista[proximoIndice].aluno.id}`)?.querySelector(".input-resultado");

    alvo?.scrollIntoView({ behavior:"smooth", block:"center" });

    alvo?.focus();

}

// ======================================================
// PAINEL LATERAL DE HISTÓRICO RÁPIDO
// ======================================================

async function abrirHistoricoLateral(alunoId){

    const dadosAluno = dadosAlunos.find(d => d.aluno.id === alunoId);

    if(!dadosAluno){
        return;
    }

    document.getElementById("tituloHistoricoLateral").textContent = dadosAluno.aluno.nome;

    const corpo = document.getElementById("corpoHistoricoLateral");

    corpo.innerHTML = `<p style="color:#94a3b8">Carregando...</p>`;

    document.getElementById("painelHistoricoLateral").classList.add("aberto");

    document.getElementById("fundoPainelLateral").classList.add("aberto");

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"avaliacoes_medicineball"), ...condicoes);

        const snapshot = await getDocs(q);

        const registros = [];

        snapshot.forEach(doc=>{

            const dados = doc.data();

            if(dados.alunoId === alunoId){

                registros.push(dados);

            }

        });

        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

        if(registros.length === 0){

            corpo.innerHTML = `<p style="color:#94a3b8">Nenhuma avaliação registrada ainda.</p>`;

            return;

        }

        corpo.innerHTML = registros.map(av=>{

            const data = av.dataTeste ? av.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

            return `

                <div class="linha-historico-lateral">
                    <div class="linha-historico-lateral-data">${data}</div>
                    <div class="linha-historico-lateral-valor">${av.distanciaCm ?? "-"} cm</div>
                    <div class="linha-historico-lateral-classificacao">${av.classificacaoDesempenho ?? "-"} • ${av.classificacaoSaude ?? "-"}</div>
                </div>

            `;

        }).join("");

    }catch(e){

        console.error("Erro ao carregar histórico:", e);

        corpo.innerHTML = `<p style="color:#DC2626">Erro ao carregar histórico.</p>`;

    }

}

function fecharHistoricoLateral(){

    document.getElementById("painelHistoricoLateral").classList.remove("aberto");

    document.getElementById("fundoPainelLateral").classList.remove("aberto");

}