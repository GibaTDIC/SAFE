// ======================================================
// SAFE
// Módulo: Abdominal em 1 minuto — PROESP-BR
//
// TELA REFORMULADA PRA COLETA EM CAMPO: cards compactos por
// aluno, salvamento imediato, progresso da turma, filtros
// instantâneos, painel de histórico lateral e aviso quando
// o valor foge muito do esperado.
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
// TABELAS OFICIAIS — PROESP-BR, Manual 2021 (5ª edição,
// A.R. Gaya, A. Gaya, A. Pedretti, J. Mello), Abdominais
// em 1 minuto. Cobre idades 6 a 17.
// ======================================================

const TABELA_DESEMPENHO = {

    masculino: {
        6:{fraco:18, razoavel:22, bom:27, muitoBom:38},
        7:{fraco:20, razoavel:25, bom:30, muitoBom:42},
        8:{fraco:23, razoavel:27, bom:33, muitoBom:45},
        9:{fraco:25, razoavel:29, bom:35, muitoBom:47},
        10:{fraco:26, razoavel:31, bom:36, muitoBom:48},
        11:{fraco:27, razoavel:32, bom:38, muitoBom:49},
        12:{fraco:29, razoavel:34, bom:39, muitoBom:51},
        13:{fraco:30, razoavel:35, bom:41, muitoBom:53},
        14:{fraco:32, razoavel:37, bom:43, muitoBom:56},
        15:{fraco:34, razoavel:39, bom:46, muitoBom:59},
        16:{fraco:35, razoavel:41, bom:47, muitoBom:61},
        17:{fraco:36, razoavel:42, bom:48, muitoBom:62}
    },

    feminino: {
        6:{fraco:17, razoavel:21, bom:26, muitoBom:37},
        7:{fraco:19, razoavel:23, bom:29, muitoBom:40},
        8:{fraco:20, razoavel:25, bom:31, muitoBom:43},
        9:{fraco:21, razoavel:26, bom:32, muitoBom:45},
        10:{fraco:22, razoavel:27, bom:33, muitoBom:45},
        11:{fraco:23, razoavel:28, bom:33, muitoBom:46},
        12:{fraco:23, razoavel:28, bom:34, muitoBom:46},
        13:{fraco:24, razoavel:29, bom:35, muitoBom:48},
        14:{fraco:24, razoavel:29, bom:35, muitoBom:49},
        15:{fraco:24, razoavel:29, bom:35, muitoBom:49},
        16:{fraco:23, razoavel:29, bom:35, muitoBom:49},
        17:{fraco:23, razoavel:29, bom:35, muitoBom:48}
    }

};

const TABELA_SAUDE = {

    masculino: {6:18, 7:18, 8:24, 9:26, 10:31, 11:37, 12:41, 13:42, 14:43, 15:45, 16:46, 17:47},

    feminino: {6:18, 7:18, 8:18, 9:20, 10:26, 11:30, 12:30, 13:33, 14:34, 15:34, 16:34, 17:34}

};

function idadeNaTabela(idade){

    return Math.min(Math.max(idade, 6), 17);

}

function chaveSexo(sexo){

    return (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

}

export function classificarDesempenho(repeticoes, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    if(repeticoes < faixa.fraco) return "Fraco";
    if(repeticoes <= faixa.razoavel) return "Razoável";
    if(repeticoes <= faixa.bom) return "Bom";
    if(repeticoes <= faixa.muitoBom) return "Muito Bom";
    return "Excelência";

}

export function classificarSaude(repeticoes, idade, sexo){

    const corte = TABELA_SAUDE[chaveSexo(sexo)][idadeNaTabela(idade)];

    return repeticoes < corte ? "Zona de risco à saúde" : "Zona saudável";

}

// Repetições não podem ser negativas; limite superior generoso
// (ninguém faz mais que o dobro do "muito bom" em 1 minuto de verdade)
function foraDaFaixaEsperada(repeticoes, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    return repeticoes > faixa.muitoBom * 1.7;

}

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let turmas = [];

let dadosAlunos = [];

let filtroAtual = "todos";

let ordenacaoAtual = "alfabetica";

let termoBusca = "";

let turmaAB, gridAlunosAB, buscaAlunoAB, ordenacaoAB, filtrosSituacaoAB;
let areaProgresso, areaFiltros;
let progressoTurmaNome, progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaTurma, metaQtdAlunos, metaData;
let btnAlunoAnterior, btnProximoAluno;

function obterElementos(){

    turmaAB = document.getElementById("turmaAB");
    gridAlunosAB = document.getElementById("gridAlunosAB");
    buscaAlunoAB = document.getElementById("buscaAlunoAB");
    ordenacaoAB = document.getElementById("ordenacaoAB");
    filtrosSituacaoAB = document.getElementById("filtrosSituacaoAB");
    areaProgresso = document.getElementById("areaProgresso");
    areaFiltros = document.getElementById("areaFiltros");
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

    turmaAB.addEventListener("change", carregarDadosDaTurma);

    buscaAlunoAB.addEventListener("keyup", () => {

        termoBusca = buscaAlunoAB.value.trim().toLowerCase();

        renderizarGrid();

    });

    ordenacaoAB.addEventListener("change", () => {

        ordenacaoAtual = ordenacaoAB.value;

        renderizarGrid();

    });

    filtrosSituacaoAB.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacaoAB.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoAluno.addEventListener("click", () => moverFoco(1));

    btnAlunoAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("abdominal");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("btnCancelarValidacaoAB").addEventListener("click", () => {

        document.getElementById("modalValidacaoAB").classList.remove("show");

    });

    document.getElementById("btnConfirmarValidacaoAB").addEventListener("click", () => {

        document.getElementById("modalValidacaoAB").classList.remove("show");

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

        containerIconeTeste.innerHTML = iconeTeste("abdominal", 56);

    }

    const contexto = obterContextoUsuario();

    metaProfessor.textContent = contexto.nome || "-";

    metaData.textContent = new Date().toLocaleDateString("pt-BR");

    configurarEventos();

    await carregarTurmas();

}

function filtroEscola(condicoesExtra = []){

    if(souSuperAdmin()){

        return condicoesExtra;

    }

    return [...condicoesExtra, where("escolaId","==",obterEscolaId())];

}

async function carregarTurmas(){

    turmas = [];

    turmaAB.innerHTML = `<option value="">Selecione a turma...</option>`;

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"turmas"), ...condicoes, orderBy("nome"));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.forEach(turma=>{

            turmaAB.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

async function carregarDadosDaTurma(){

    dadosAlunos = [];

    gridAlunosAB.innerHTML = "";

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    if(!turmaAB.value){

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turmaAB.value);

    metaTurma.textContent = turmaAtual ? turmaAtual.nome : "-";

    gridAlunosAB.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando alunos...</p>`;

    try{

        const condicoesAlunos = filtroEscola();

        const qAlunos = query(collection(db,"alunos"), ...condicoesAlunos, orderBy("nome"));

        const snapAlunos = await getDocs(qAlunos);

        const alunosDaTurma = [];

        snapAlunos.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turmaAB.value){

                alunosDaTurma.push(dadosAluno);

            }

        });

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_abdominal"), ...condicoesAvaliacoes);

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
                ultimoValor: maisRecente?.repeticoes ?? null,
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

function renderizarProgresso(){

    const turmaAtual = turmas.find(t => t.id === turmaAB.value);

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

        gridAlunosAB.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum aluno encontrado com esse filtro.</p>`;

        return;

    }

    gridAlunosAB.innerHTML = lista.map(dadosAluno => renderizarCard(dadosAluno)).join("");

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

        ? `${ultimoValor} rep. — ${ultimaDesempenho || "-"}`

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
                        step="1"
                        min="0"
                        class="form-control input-resultado"
                        placeholder="repetições"
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

function alternarAusente(alunoId){

    const dadosAluno = dadosAlunos.find(d => d.aluno.id === alunoId);

    if(!dadosAluno){
        return;
    }

    dadosAluno.ausente = !dadosAluno.ausente;

    renderizarProgresso();

    renderizarGrid();

}

let alunoPendenteDeConfirmacao = null;

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

    const repeticoes = Number(input.value);

    if(isNaN(repeticoes) || repeticoes < 0){

        mostrarToast("Valor inválido.", "erro");

        return;

    }

    const idade = calcularIdade(dadosAluno.aluno.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Aluno sem data de nascimento cadastrada — não é possível classificar.", "erro");

        return;

    }

    if(!forcarSemValidar && foraDaFaixaEsperada(repeticoes, idade, dadosAluno.aluno.sexo)){

        abrirModalValidacao(repeticoes, alunoId);

        return;

    }

    const classificacaoDesempenho = classificarDesempenho(repeticoes, idade, dadosAluno.aluno.sexo);

    const classificacaoSaude = classificarSaude(repeticoes, idade, dadosAluno.aluno.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        alunoId: dadosAluno.aluno.id,
        nome: dadosAluno.aluno.nome,
        codigoSAFE: dadosAluno.aluno.codigoSAFE || "",
        turmaId: turmaAB.value,
        escolaId: souSuperAdmin()
            ? ((turmas.find(t => t.id === turmaAB.value) || {}).escolaId || dadosAluno.aluno.escolaId || "")
            : obterEscolaId(),
        professorId: contexto.uid,
        repeticoes,
        classificacaoDesempenho,
        classificacaoSaude,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_abdominal"), avaliacao);

        dadosAluno.ultimoValor = repeticoes;

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

function abrirModalValidacao(valor, alunoId){

    alunoPendenteDeConfirmacao = alunoId;

    document.getElementById("mensagemValidacaoAB").textContent =

        `${valor} repetições foge bastante do esperado pra esse aluno. Confira se digitou certo antes de confirmar.`;

    document.getElementById("modalValidacaoAB").classList.add("show");

}

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

        const q = query(collection(db,"avaliacoes_abdominal"), ...condicoes);

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
                    <div class="linha-historico-lateral-valor">${av.repeticoes ?? "-"} rep.</div>
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