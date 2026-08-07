// ======================================================
// SAFE
// Módulo: IMC (Índice de Massa Corporal) — PROESP-BR
//
// Único teste com DOIS campos de entrada (peso + estatura)
// em vez de um só — o card reflete isso com dois inputs
// lado a lado.
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
// TABELA OFICIAL — PROESP-BR, Manual 2021 (5ª edição,
// A.R. Gaya, A. Gaya, A. Pedretti, J. Mello), Valores
// críticos de IMC. Cobre idades 6 a 17. Valores ACIMA do
// corte = risco à saúde; abaixo = zona saudável.
// ======================================================

const TABELA_SAUDE = {

    masculino: {6:17.7, 7:17.8, 8:19.2, 9:19.3, 10:20.7, 11:22.1, 12:22.2, 13:22.0, 14:22.2, 15:23.0, 16:24.0, 17:25.4},

    feminino: {6:17.0, 7:17.1, 8:18.2, 9:19.1, 10:20.9, 11:22.3, 12:22.6, 13:22.0, 14:22.0, 15:22.4, 16:24.0, 17:24.0}

};

function idadeNaTabela(idade){

    return Math.min(Math.max(idade, 6), 17);

}

function chaveSexo(sexo){

    return (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

}

export function calcularIMC(pesoKg, estaturaCm){

    const estaturaM = estaturaCm / 100;

    return pesoKg / (estaturaM * estaturaM);

}

export function classificarSaude(imc, idade, sexo){

    const corte = TABELA_SAUDE[chaveSexo(sexo)][idadeNaTabela(idade)];

    return imc > corte ? "Zona de risco à saúde" : "Zona saudável";

}

// Faixas gerais de sanidade (não são da tabela de classificação —
// só pra pegar erro grosseiro de digitação, tipo trocar kg por g)
function pesoForaDaFaixa(pesoKg){

    return pesoKg < 8 || pesoKg > 150;

}

function estaturaForaDaFaixa(estaturaCm){

    return estaturaCm < 60 || estaturaCm > 210;

}

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let turmas = [];

let dadosAlunos = [];

let filtroAtual = "todos";

let ordenacaoAtual = "alfabetica";

let termoBusca = "";

let turmaIMC, gridAlunosIMC, buscaAlunoIMC, ordenacaoIMC, filtrosSituacaoIMC;
let areaProgresso, areaFiltros;
let progressoTurmaNome, progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaTurma, metaQtdAlunos, metaData;
let btnAlunoAnterior, btnProximoAluno;

function obterElementos(){

    turmaIMC = document.getElementById("turmaIMC");
    gridAlunosIMC = document.getElementById("gridAlunosIMC");
    buscaAlunoIMC = document.getElementById("buscaAlunoIMC");
    ordenacaoIMC = document.getElementById("ordenacaoIMC");
    filtrosSituacaoIMC = document.getElementById("filtrosSituacaoIMC");
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

    turmaIMC.addEventListener("change", carregarDadosDaTurma);

    buscaAlunoIMC.addEventListener("keyup", () => {

        termoBusca = buscaAlunoIMC.value.trim().toLowerCase();

        renderizarGrid();

    });

    ordenacaoIMC.addEventListener("change", () => {

        ordenacaoAtual = ordenacaoIMC.value;

        renderizarGrid();

    });

    filtrosSituacaoIMC.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacaoIMC.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoAluno.addEventListener("click", () => moverFoco(1));

    btnAlunoAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("imc");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("btnCancelarValidacaoIMC").addEventListener("click", () => {

        document.getElementById("modalValidacaoIMC").classList.remove("show");

    });

    document.getElementById("btnConfirmarValidacaoIMC").addEventListener("click", () => {

        document.getElementById("modalValidacaoIMC").classList.remove("show");

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

        containerIconeTeste.innerHTML = iconeTeste("imc", 56);

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

    turmaIMC.innerHTML = `<option value="">Selecione a turma...</option>`;

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"turmas"), ...condicoes, orderBy("nome"));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.forEach(turma=>{

            turmaIMC.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

async function carregarDadosDaTurma(){

    dadosAlunos = [];

    gridAlunosIMC.innerHTML = "";

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    if(!turmaIMC.value){

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turmaIMC.value);

    metaTurma.textContent = turmaAtual ? turmaAtual.nome : "-";

    gridAlunosIMC.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando alunos...</p>`;

    try{

        const condicoesAlunos = filtroEscola();

        const qAlunos = query(collection(db,"alunos"), ...condicoesAlunos, orderBy("nome"));

        const snapAlunos = await getDocs(qAlunos);

        const alunosDaTurma = [];

        snapAlunos.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turmaIMC.value){

                alunosDaTurma.push(dadosAluno);

            }

        });

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_imc"), ...condicoesAvaliacoes);

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
                ultimoImc: maisRecente?.imc ?? null,
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

    const turmaAtual = turmas.find(t => t.id === turmaIMC.value);

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

        gridAlunosIMC.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum aluno encontrado com esse filtro.</p>`;

        return;

    }

    gridAlunosIMC.innerHTML = lista.map(dadosAluno => renderizarCard(dadosAluno)).join("");

    lista.forEach(dadosAluno=>{

        const idAluno = dadosAluno.aluno.id;

        const card = document.getElementById(`card-${idAluno}`);

        if(!card){
            return;
        }

        card.querySelector(".btn-salvar-card")?.addEventListener("click", () => salvarResultado(idAluno));

        card.querySelectorAll(".input-resultado").forEach(input=>{

            input.addEventListener("keyup", (evento)=>{

                if(evento.key === "Enter"){

                    salvarResultado(idAluno);

                }

            });

        });

        card.querySelector(".btn-ausente-card")?.addEventListener("click", () => alternarAusente(idAluno));

        card.querySelector(".card-aluno-nome")?.addEventListener("click", () => abrirHistoricoLateral(idAluno));

    });

}

function renderizarCard(dadosAluno){

    const { aluno, ultimoImc, ultimaSaude, avaliadoHoje, ausente } = dadosAluno;

    const idade = calcularIdade(aluno.dataNascimento);

    let statusBadge = `<span class="badge-status pendente">⏳ Pendente</span>`;

    if(ausente){

        statusBadge = `<span class="badge-status ausente">❌ Ausente</span>`;

    }else if(avaliadoHoje){

        statusBadge = `<span class="badge-status concluido">✔ Avaliado</span>`;

    }

    const ultimoResultadoTexto = ultimoImc !== null

        ? `IMC ${ultimoImc} — ${ultimaSaude || "-"}`

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
                        class="form-control input-resultado input-peso"
                        placeholder="peso (kg)"
                        aria-label="Peso de ${aluno.nome}">

                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        class="form-control input-resultado input-estatura"
                        placeholder="estatura (cm)"
                        aria-label="Estatura de ${aluno.nome}">

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

let dadosPendentesDeConfirmacao = null;

async function salvarResultado(alunoId, forcarSemValidar = false){

    const dadosAluno = dadosAlunos.find(d => d.aluno.id === alunoId);

    if(!dadosAluno){
        return;
    }

    const card = document.getElementById(`card-${alunoId}`);

    const inputPeso = card?.querySelector(".input-peso");

    const inputEstatura = card?.querySelector(".input-estatura");

    let peso, estatura;

    if(forcarSemValidar && dadosPendentesDeConfirmacao){

        ({ peso, estatura } = dadosPendentesDeConfirmacao);

    }else{

        if(!inputPeso || !inputEstatura || inputPeso.value === "" || inputEstatura.value === ""){

            mostrarToast("Informe peso e estatura antes de salvar.", "erro");

            return;

        }

        peso = Number(inputPeso.value);

        estatura = Number(inputEstatura.value);

        if(isNaN(peso) || peso <= 0 || isNaN(estatura) || estatura <= 0){

            mostrarToast("Valores inválidos.", "erro");

            return;

        }

    }

    const idade = calcularIdade(dadosAluno.aluno.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Aluno sem data de nascimento cadastrada — não é possível classificar.", "erro");

        return;

    }

    if(!forcarSemValidar && (pesoForaDaFaixa(peso) || estaturaForaDaFaixa(estatura))){

        abrirModalValidacao(peso, estatura, alunoId);

        return;

    }

    const imc = Number(calcularIMC(peso, estatura).toFixed(1));

    const classificacaoSaude = classificarSaude(imc, idade, dadosAluno.aluno.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        alunoId: dadosAluno.aluno.id,
        nome: dadosAluno.aluno.nome,
        codigoSAFE: dadosAluno.aluno.codigoSAFE || "",
        turmaId: turmaIMC.value,
        escolaId: souSuperAdmin()
            ? ((turmas.find(t => t.id === turmaIMC.value) || {}).escolaId || dadosAluno.aluno.escolaId || "")
            : obterEscolaId(),
        professorId: contexto.uid,
        peso,
        estatura,
        imc,
        classificacaoSaude,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_imc"), avaliacao);

        dadosAluno.ultimoImc = imc;

        dadosAluno.ultimaSaude = classificacaoSaude;

        dadosAluno.avaliadoHoje = true;

        dadosPendentesDeConfirmacao = null;

        mostrarToast(`${dadosAluno.aluno.nome}: IMC ${imc} salvo!`);

        renderizarProgresso();

        renderizarGrid();

        focarProximoPendente(alunoId);

    }catch(e){

        console.error(e);

        mostrarToast("Erro ao salvar a avaliação.", "erro");

    }

}

function abrirModalValidacao(peso, estatura, alunoId){

    alunoPendenteDeConfirmacao = alunoId;

    dadosPendentesDeConfirmacao = { peso, estatura };

    document.getElementById("mensagemValidacaoIMC").textContent =

        `Peso ${peso} kg / estatura ${estatura} cm foge bastante do esperado. Confira se digitou certo antes de confirmar.`;

    document.getElementById("modalValidacaoIMC").classList.add("show");

}

function focarProximoPendente(alunoIdAtual){

    const lista = obterListaFiltrada();

    const indiceAtual = lista.findIndex(d => d.aluno.id === alunoIdAtual);

    const proximoPendente = lista.slice(indiceAtual + 1).find(d => !d.avaliadoHoje && !d.ausente);

    if(proximoPendente){

        const proximoInput = document.getElementById(`card-${proximoPendente.aluno.id}`)?.querySelector(".input-peso");

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

    const alvo = document.getElementById(`card-${lista[proximoIndice].aluno.id}`)?.querySelector(".input-peso");

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

        const q = query(collection(db,"avaliacoes_imc"), ...condicoes);

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
                    <div class="linha-historico-lateral-valor">IMC ${av.imc ?? "-"} (${av.peso ?? "-"}kg / ${av.estatura ?? "-"}cm)</div>
                    <div class="linha-historico-lateral-classificacao">${av.classificacaoSaude ?? "-"}</div>
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