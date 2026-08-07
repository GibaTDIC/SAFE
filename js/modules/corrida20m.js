// ======================================================
// SAFE
// Módulo: Corrida de 20 metros — PROESP-BR (velocidade)
//
// ATENÇÃO: aqui o número MENOR é o melhor resultado (é
// tempo, não distância) — a lógica de classificação e a
// zona de saúde ficam invertidas em relação aos outros
// testes.
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
// A.R. Gaya, A. Gaya, A. Pedretti, J. Mello), Corrida de
// 20 metros. Cobre idades 6 a 17. Tempos em segundos.
// ======================================================

const TABELA_DESEMPENHO = {

    masculino: {
        6:{excelencia:3.61, muitoBom:4.21, bom:4.57, razoavel:4.94},
        7:{excelencia:3.52, muitoBom:4.08, bom:4.42, razoavel:4.75},
        8:{excelencia:3.44, muitoBom:3.97, bom:4.28, razoavel:4.59},
        9:{excelencia:3.37, muitoBom:3.86, bom:4.15, razoavel:4.44},
        10:{excelencia:3.30, muitoBom:3.76, bom:4.03, razoavel:4.30},
        11:{excelencia:3.22, muitoBom:3.65, bom:3.91, razoavel:4.16},
        12:{excelencia:3.14, muitoBom:3.56, bom:3.80, razoavel:4.04},
        13:{excelencia:3.04, muitoBom:3.44, bom:3.68, razoavel:3.91},
        14:{excelencia:2.92, muitoBom:3.30, bom:3.54, razoavel:3.78},
        15:{excelencia:2.78, muitoBom:3.16, bom:3.39, razoavel:3.63},
        16:{excelencia:2.68, muitoBom:3.05, bom:3.28, razoavel:3.53},
        17:{excelencia:2.58, muitoBom:2.95, bom:3.19, razoavel:3.43}
    },

    feminino: {
        6:{excelencia:3.98, muitoBom:4.56, bom:4.91, razoavel:5.27},
        7:{excelencia:3.84, muitoBom:4.39, bom:4.72, razoavel:5.05},
        8:{excelencia:3.72, muitoBom:4.23, bom:4.55, razoavel:4.86},
        9:{excelencia:3.60, muitoBom:4.09, bom:4.39, razoavel:4.68},
        10:{excelencia:3.50, muitoBom:3.97, bom:4.25, razoavel:4.53},
        11:{excelencia:3.41, muitoBom:3.86, bom:4.14, razoavel:4.41},
        12:{excelencia:3.34, muitoBom:3.79, bom:4.06, razoavel:4.33},
        13:{excelencia:3.27, muitoBom:3.73, bom:4.00, razoavel:4.28},
        14:{excelencia:3.20, muitoBom:3.67, bom:3.96, razoavel:4.25},
        15:{excelencia:3.11, muitoBom:3.61, bom:3.91, razoavel:4.22},
        16:{excelencia:3.03, muitoBom:3.55, bom:3.87, razoavel:4.21},
        17:{excelencia:2.95, muitoBom:3.49, bom:3.83, razoavel:4.19}
    }

};

const TABELA_SAUDE = {

    masculino: {6:4.81, 7:4.52, 8:4.31, 9:4.25, 10:4.09, 11:4.00, 12:3.88, 13:3.72, 14:3.54, 15:3.40, 16:3.28, 17:3.22},

    feminino: {6:5.22, 7:4.88, 8:4.66, 9:4.58, 10:4.44, 11:4.36, 12:4.28, 13:4.17, 14:4.16, 15:4.07, 16:4.01, 17:3.91}

};

function idadeNaTabela(idade){

    return Math.min(Math.max(idade, 6), 17);

}

function chaveSexo(sexo){

    return (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

}

// Classificação de desempenho (5 categorias). Tempo MENOR = melhor.
export function classificarDesempenho(tempoSegundos, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    if(tempoSegundos <= faixa.excelencia) return "Excelência";
    if(tempoSegundos <= faixa.muitoBom) return "Muito Bom";
    if(tempoSegundos <= faixa.bom) return "Bom";
    if(tempoSegundos <= faixa.razoavel) return "Razoável";
    return "Fraco";

}

// Zona de saúde: aqui é o INVERSO dos outros testes — tempo
// ACIMA do ponto de corte é que é risco (mais lento = pior).
export function classificarSaude(tempoSegundos, idade, sexo){

    const corte = TABELA_SAUDE[chaveSexo(sexo)][idadeNaTabela(idade)];

    return tempoSegundos > corte ? "Zona de risco à saúde" : "Zona saudável";

}

function foraDaFaixaEsperada(tempoSegundos, idade, sexo){

    const faixa = TABELA_DESEMPENHO[chaveSexo(sexo)][idadeNaTabela(idade)];

    return tempoSegundos < faixa.excelencia * 0.5 || tempoSegundos > faixa.razoavel * 2.5;

}

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let turmas = [];

let dadosAlunos = [];

let filtroAtual = "todos";

let ordenacaoAtual = "alfabetica";

let termoBusca = "";

let turma20, gridAlunos20, buscaAluno20, ordenacao20, filtrosSituacao20;
let areaProgresso, areaFiltros;
let progressoTurmaNome, progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaTurma, metaQtdAlunos, metaData;
let btnAlunoAnterior, btnProximoAluno;

function obterElementos(){

    turma20 = document.getElementById("turma20");
    gridAlunos20 = document.getElementById("gridAlunos20");
    buscaAluno20 = document.getElementById("buscaAluno20");
    ordenacao20 = document.getElementById("ordenacao20");
    filtrosSituacao20 = document.getElementById("filtrosSituacao20");
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

    turma20.addEventListener("change", carregarDadosDaTurma);

    buscaAluno20.addEventListener("keyup", () => {

        termoBusca = buscaAluno20.value.trim().toLowerCase();

        renderizarGrid();

    });

    ordenacao20.addEventListener("change", () => {

        ordenacaoAtual = ordenacao20.value;

        renderizarGrid();

    });

    filtrosSituacao20.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacao20.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoAluno.addEventListener("click", () => moverFoco(1));

    btnAlunoAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("corrida20m");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("btnCancelarValidacao20").addEventListener("click", () => {

        document.getElementById("modalValidacao20").classList.remove("show");

    });

    document.getElementById("btnConfirmarValidacao20").addEventListener("click", () => {

        document.getElementById("modalValidacao20").classList.remove("show");

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

        containerIconeTeste.innerHTML = iconeTeste("corrida20m", 56);

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

    turma20.innerHTML = `<option value="">Selecione a turma...</option>`;

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"turmas"), ...condicoes, orderBy("nome"));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.forEach(turma=>{

            turma20.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

async function carregarDadosDaTurma(){

    dadosAlunos = [];

    gridAlunos20.innerHTML = "";

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    if(!turma20.value){

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turma20.value);

    metaTurma.textContent = turmaAtual ? turmaAtual.nome : "-";

    gridAlunos20.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando alunos...</p>`;

    try{

        const condicoesAlunos = filtroEscola();

        const qAlunos = query(collection(db,"alunos"), ...condicoesAlunos, orderBy("nome"));

        const snapAlunos = await getDocs(qAlunos);

        const alunosDaTurma = [];

        snapAlunos.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turma20.value){

                alunosDaTurma.push(dadosAluno);

            }

        });

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_corrida20m"), ...condicoesAvaliacoes);

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
                ultimoValor: maisRecente?.tempoSegundos ?? null,
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

    const turmaAtual = turmas.find(t => t.id === turma20.value);

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

        gridAlunos20.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum aluno encontrado com esse filtro.</p>`;

        return;

    }

    gridAlunos20.innerHTML = lista.map(dadosAluno => renderizarCard(dadosAluno)).join("");

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

    const { aluno, ultimoValor, ultimaDesempenho, avaliadoHoje, ausente } = dadosAluno;

    const idade = calcularIdade(aluno.dataNascimento);

    let statusBadge = `<span class="badge-status pendente">⏳ Pendente</span>`;

    if(ausente){

        statusBadge = `<span class="badge-status ausente">❌ Ausente</span>`;

    }else if(avaliadoHoje){

        statusBadge = `<span class="badge-status concluido">✔ Avaliado</span>`;

    }

    const ultimoResultadoTexto = ultimoValor !== null

        ? `${ultimoValor} s — ${ultimaDesempenho || "-"}`

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
                        step="0.01"
                        min="0"
                        class="form-control input-resultado"
                        placeholder="segundos"
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

    const tempoSegundos = Number(input.value);

    if(isNaN(tempoSegundos) || tempoSegundos <= 0){

        mostrarToast("Valor inválido.", "erro");

        return;

    }

    const idade = calcularIdade(dadosAluno.aluno.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Aluno sem data de nascimento cadastrada — não é possível classificar.", "erro");

        return;

    }

    if(!forcarSemValidar && foraDaFaixaEsperada(tempoSegundos, idade, dadosAluno.aluno.sexo)){

        abrirModalValidacao(tempoSegundos, alunoId);

        return;

    }

    const classificacaoDesempenho = classificarDesempenho(tempoSegundos, idade, dadosAluno.aluno.sexo);

    const classificacaoSaude = classificarSaude(tempoSegundos, idade, dadosAluno.aluno.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        alunoId: dadosAluno.aluno.id,
        nome: dadosAluno.aluno.nome,
        codigoSAFE: dadosAluno.aluno.codigoSAFE || "",
        turmaId: turma20.value,
        escolaId: souSuperAdmin()
            ? ((turmas.find(t => t.id === turma20.value) || {}).escolaId || dadosAluno.aluno.escolaId || "")
            : obterEscolaId(),
        professorId: contexto.uid,
        tempoSegundos,
        classificacaoDesempenho,
        classificacaoSaude,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_corrida20m"), avaliacao);

        dadosAluno.ultimoValor = tempoSegundos;

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

    document.getElementById("mensagemValidacao20").textContent =

        `${valor} s foge bastante do esperado pra esse aluno. Confira se digitou certo antes de confirmar.`;

    document.getElementById("modalValidacao20").classList.add("show");

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

        const q = query(collection(db,"avaliacoes_corrida20m"), ...condicoes);

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
                    <div class="linha-historico-lateral-valor">${av.tempoSegundos ?? "-"} s</div>
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