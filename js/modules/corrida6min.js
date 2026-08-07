// ======================================================
// SAFE
// Módulo: Corrida/Caminhada de 6 minutos — PROESP-BR
// (Aptidão Cardiorrespiratória)
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
// A.R. Gaya, A. Gaya, A. Pedretti, J. Mello), Corrida/
// Caminhada de 6 minutos. Cobre idades 6 a 17. Distância
// em metros.
// ======================================================

const TABELA_DESEMPENHO = {

    masculino: {
        6:{fraco:730, razoavel:826, bom:956, muitoBom:1316},
        7:{fraco:752, razoavel:848, bom:975, muitoBom:1302},
        8:{fraco:774, razoavel:870, bom:995, muitoBom:1300},
        9:{fraco:797, razoavel:894, bom:1018, muitoBom:1309},
        10:{fraco:817, razoavel:916, bom:1040, muitoBom:1322},
        11:{fraco:837, razoavel:938, bom:1062, muitoBom:1338},
        12:{fraco:860, razoavel:964, bom:1090, muitoBom:1366},
        13:{fraco:895, razoavel:1004, bom:1136, muitoBom:1421},
        14:{fraco:939, razoavel:1057, bom:1197, muitoBom:1498},
        15:{fraco:986, razoavel:1112, bom:1262, muitoBom:1584},
        16:{fraco:1015, razoavel:1148, bom:1306, muitoBom:1643},
        17:{fraco:1038, razoavel:1176, bom:1341, muitoBom:1691}
    },

    feminino: {
        6:{fraco:672, razoavel:767, bom:900, muitoBom:1276},
        7:{fraco:691, razoavel:779, bom:891, muitoBom:1158},
        8:{fraco:707, razoavel:791, bom:895, muitoBom:1131},
        9:{fraco:720, razoavel:805, bom:910, muitoBom:1148},
        10:{fraco:729, razoavel:818, bom:931, muitoBom:1199},
        11:{fraco:736, razoavel:831, bom:953, muitoBom:1250},
        12:{fraco:743, razoavel:835, bom:947, muitoBom:1191},
        13:{fraco:749, razoavel:839, bom:947, muitoBom:1178},
        14:{fraco:751, razoavel:847, bom:969, muitoBom:1256},
        15:{fraco:748, razoavel:858, bom:1005, muitoBom:1390},
        16:{fraco:746, razoavel:865, bom:1021, muitoBom:1401},
        17:{fraco:744, razoavel:870, bom:1027, muitoBom:1389}
    }

};

const TABELA_SAUDE = {

    masculino: {6:675, 7:730, 8:768, 9:820, 10:856, 11:930, 12:966, 13:995, 14:1060, 15:1130, 16:1190, 17:1190},

    feminino: {6:630, 7:683, 8:715, 9:745, 10:790, 11:840, 12:900, 13:940, 14:985, 15:1005, 16:1070, 17:1110}

};

function idadeNaTabela(idade){

    return Math.min(Math.max(idade, 6), 17);

}

function chaveSexo(sexo){

    return (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

}

export function classificarDesempenho(distanciaM, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    if(distanciaM < faixa.fraco) return "Fraco";
    if(distanciaM <= faixa.razoavel) return "Razoável";
    if(distanciaM <= faixa.bom) return "Bom";
    if(distanciaM <= faixa.muitoBom) return "Muito Bom";
    return "Excelência";

}

export function classificarSaude(distanciaM, idade, sexo){

    const corte = TABELA_SAUDE[chaveSexo(sexo)][idadeNaTabela(idade)];

    return distanciaM < corte ? "Zona de risco à saúde" : "Zona saudável";

}

function foraDaFaixaEsperada(distanciaM, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    return distanciaM < faixa.fraco * 0.35 || distanciaM > faixa.muitoBom * 1.4;

}

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let turmas = [];

let dadosAlunos = [];

let filtroAtual = "todos";

let ordenacaoAtual = "alfabetica";

let termoBusca = "";

let turma6M, gridAlunos6M, buscaAluno6M, ordenacao6M, filtrosSituacao6M;
let areaProgresso, areaFiltros;
let progressoTurmaNome, progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaTurma, metaQtdAlunos, metaData;
let btnAlunoAnterior, btnProximoAluno;

function obterElementos(){

    turma6M = document.getElementById("turma6M");
    gridAlunos6M = document.getElementById("gridAlunos6M");
    buscaAluno6M = document.getElementById("buscaAluno6M");
    ordenacao6M = document.getElementById("ordenacao6M");
    filtrosSituacao6M = document.getElementById("filtrosSituacao6M");
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

    turma6M.addEventListener("change", carregarDadosDaTurma);

    buscaAluno6M.addEventListener("keyup", () => {

        termoBusca = buscaAluno6M.value.trim().toLowerCase();

        renderizarGrid();

    });

    ordenacao6M.addEventListener("change", () => {

        ordenacaoAtual = ordenacao6M.value;

        renderizarGrid();

    });

    filtrosSituacao6M.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacao6M.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoAluno.addEventListener("click", () => moverFoco(1));

    btnAlunoAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("corrida6min");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("btnCancelarValidacao6M").addEventListener("click", () => {

        document.getElementById("modalValidacao6M").classList.remove("show");

    });

    document.getElementById("btnConfirmarValidacao6M").addEventListener("click", () => {

        document.getElementById("modalValidacao6M").classList.remove("show");

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

        containerIconeTeste.innerHTML = iconeTeste("corrida6min", 56);

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

    turma6M.innerHTML = `<option value="">Selecione a turma...</option>`;

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"turmas"), ...condicoes, orderBy("nome"));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.forEach(turma=>{

            turma6M.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

async function carregarDadosDaTurma(){

    dadosAlunos = [];

    gridAlunos6M.innerHTML = "";

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    if(!turma6M.value){

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turma6M.value);

    metaTurma.textContent = turmaAtual ? turmaAtual.nome : "-";

    gridAlunos6M.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando alunos...</p>`;

    try{

        const condicoesAlunos = filtroEscola();

        const qAlunos = query(collection(db,"alunos"), ...condicoesAlunos, orderBy("nome"));

        const snapAlunos = await getDocs(qAlunos);

        const alunosDaTurma = [];

        snapAlunos.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turma6M.value){

                alunosDaTurma.push(dadosAluno);

            }

        });

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_corrida6min"), ...condicoesAvaliacoes);

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
                ultimoValor: maisRecente?.distanciaM ?? null,
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

    const turmaAtual = turmas.find(t => t.id === turma6M.value);

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

        gridAlunos6M.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum aluno encontrado com esse filtro.</p>`;

        return;

    }

    gridAlunos6M.innerHTML = lista.map(dadosAluno => renderizarCard(dadosAluno)).join("");

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

        ? `${ultimoValor} m — ${ultimaDesempenho || "-"}`

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
                        placeholder="metros"
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

    const distanciaM = Number(input.value);

    if(isNaN(distanciaM) || distanciaM < 0){

        mostrarToast("Valor inválido.", "erro");

        return;

    }

    const idade = calcularIdade(dadosAluno.aluno.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Aluno sem data de nascimento cadastrada — não é possível classificar.", "erro");

        return;

    }

    if(!forcarSemValidar && foraDaFaixaEsperada(distanciaM, idade, dadosAluno.aluno.sexo)){

        abrirModalValidacao(distanciaM, alunoId);

        return;

    }

    const classificacaoDesempenho = classificarDesempenho(distanciaM, idade, dadosAluno.aluno.sexo);

    const classificacaoSaude = classificarSaude(distanciaM, idade, dadosAluno.aluno.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        alunoId: dadosAluno.aluno.id,
        nome: dadosAluno.aluno.nome,
        codigoSAFE: dadosAluno.aluno.codigoSAFE || "",
        turmaId: turma6M.value,
        escolaId: souSuperAdmin()
            ? ((turmas.find(t => t.id === turma6M.value) || {}).escolaId || dadosAluno.aluno.escolaId || "")
            : obterEscolaId(),
        professorId: contexto.uid,
        distanciaM,
        classificacaoDesempenho,
        classificacaoSaude,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_corrida6min"), avaliacao);

        dadosAluno.ultimoValor = distanciaM;

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

    document.getElementById("mensagemValidacao6M").textContent =

        `${valor} m foge bastante do esperado pra esse aluno. Confira se digitou certo antes de confirmar.`;

    document.getElementById("modalValidacao6M").classList.add("show");

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

        const q = query(collection(db,"avaliacoes_corrida6min"), ...condicoes);

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
                    <div class="linha-historico-lateral-valor">${av.distanciaM ?? "-"} m</div>
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