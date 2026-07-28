// ======================================================
// SAFE
// Módulo: Teste de Léger
//
// ATENÇÃO — funções exportadas daqui (calcularIdade,
// calcularResultadoLeger, converterVoltasParaEstagio,
// classificarFitnessgram, ESTAGIOS_LEGER) são usadas por
// praticamente todos os outros módulos do sistema. Mantidas
// EXATAMENTE como estavam — só a tela (tudo abaixo de
// "VARIÁVEIS / ELEMENTOS") foi reformulada pro novo padrão
// de coleta em campo.
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    obterContextoUsuario,
    mostrarToast
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
// TABELA OFICIAL DE ESTÁGIOS (Léger 20m Shuttle Run)
// velocidade em km/h, voltas = quantidade de tiros de 20m
// naquele estágio, acumulado = total de tiros até o fim
// do estágio (inclusive).
// Índice 0 não é usado (estágio começa em 1).
// ======================================================

export const ESTAGIOS_LEGER = [

    null,
    { nivel:1,  velocidade:8.0,  voltas:7,  acumulado:7   },
    { nivel:2,  velocidade:9.0,  voltas:8,  acumulado:15  },
    { nivel:3,  velocidade:9.5,  voltas:8,  acumulado:23  },
    { nivel:4,  velocidade:10.0, voltas:9,  acumulado:32  },
    { nivel:5,  velocidade:10.5, voltas:9,  acumulado:41  },
    { nivel:6,  velocidade:11.0, voltas:10, acumulado:51  },
    { nivel:7,  velocidade:11.5, voltas:10, acumulado:61  },
    { nivel:8,  velocidade:12.0, voltas:11, acumulado:72  },
    { nivel:9,  velocidade:12.5, voltas:11, acumulado:83  },
    { nivel:10, velocidade:13.0, voltas:11, acumulado:94  },
    { nivel:11, velocidade:13.5, voltas:12, acumulado:106 },
    { nivel:12, velocidade:14.0, voltas:12, acumulado:118 },
    { nivel:13, velocidade:14.5, voltas:13, acumulado:131 },
    { nivel:14, velocidade:15.0, voltas:13, acumulado:144 },
    { nivel:15, velocidade:15.5, voltas:13, acumulado:157 },
    { nivel:16, velocidade:16.0, voltas:14, acumulado:171 },
    { nivel:17, velocidade:16.5, voltas:14, acumulado:185 }

];

// TODO: tabela confirmada até o estágio 17. Se algum aluno muito
// condicionado ultrapassar isso, precisamos validar e completar os
// estágios seguintes antes de confiar no cálculo.

// ======================================================
// CLASSIFICAÇÃO — FITNESSGRAM Healthy Fitness Zone (HFZ)
// Fonte: The Cooper Institute / California Dept. of Education,
// FITNESSGRAM Healthy Fitness Zone Performance Standards (2018).
// Validado especificamente pro teste de 20m PACER, que é o mesmo
// protocolo do Léger — por isso pode ser aplicado aqui.
// Só cobre idades 10 a 17+ (o próprio FITNESSGRAM não define
// padrão de VO2máx pra idades 5 a 9).
//
// OBS: o PROESP-BR NÃO tem tabela pro Léger (ele usa outro teste,
// de corrida/caminhada por tempo fixo — 6 ou 9 minutos, classificado
// por distância). Fica registrado como módulo futuro separado.
// ======================================================

const FITNESSGRAM_HFZ = {

    masculino: {

        10:{risco:37.3, ni:40.1}, 11:{risco:37.3, ni:40.1}, 12:{risco:37.6, ni:40.2},
        13:{risco:38.6, ni:41.0}, 14:{risco:39.6, ni:42.4}, 15:{risco:40.6, ni:43.5},
        16:{risco:41.0, ni:44.0}, 17:{risco:41.2, ni:44.1}, 18:{risco:41.2, ni:44.2}

    },

    feminino: {

        10:{risco:37.3, ni:40.1}, 11:{risco:37.3, ni:40.1}, 12:{risco:37.0, ni:40.0},
        13:{risco:36.6, ni:39.6}, 14:{risco:36.3, ni:39.3}, 15:{risco:36.0, ni:39.0},
        16:{risco:35.8, ni:38.8}, 17:{risco:35.7, ni:38.7}, 18:{risco:35.3, ni:38.5}

    }

};

export function classificarFitnessgram(vo2max, idade, sexo){

    const chaveSexo = (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

    // idades 17+ usam a mesma faixa da chave 18; abaixo de 10 não tem padrão definido
    const idadeTabela = Math.min(Math.max(idade, 10), 18);

    const faixa = FITNESSGRAM_HFZ[chaveSexo][idadeTabela];

    if(idade < 10 || !faixa){

        return null; // sem padrão FITNESSGRAM pra essa idade

    }

    if(vo2max <= faixa.risco){

        return "Zona de risco à saúde";

    }

    if(vo2max <= faixa.ni){

        return "Precisa melhorar";

    }

    return "Zona saudável";

}

// ======================================================
// IDADE (a partir de dataNascimento em ISO aaaa-mm-dd)
// ======================================================

export function calcularIdade(dataNascimentoISO){

    if(!dataNascimentoISO){

        return "-";

    }

    const nascimento = new Date(dataNascimentoISO);

    if(isNaN(nascimento)){

        return "-";

    }

    const hoje = new Date();

    let idade = hoje.getFullYear() - nascimento.getFullYear();

    const aindaNaoFezAniversario =
        hoje.getMonth() < nascimento.getMonth() ||
        (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());

    if(aindaNaoFezAniversario){

        idade--;

    }

    return idade;

}

// ======================================================
// CÁLCULO DO TESTE DE LÉGER
// ======================================================

export function calcularResultadoLeger(estagioCompleto, voltaNoProximo, idade){

    const infoEstagio = ESTAGIOS_LEGER[estagioCompleto];

    if(!infoEstagio){

        return null;

    }

    // Tempo total: soma a duração de cada estágio já completado
    // por inteiro, mais o tempo parcial das voltas no estágio seguinte
    let tempoSegundos = 0;

    for(let n = 1; n <= estagioCompleto; n++){

        const info = ESTAGIOS_LEGER[n];

        const velocidadeMs = info.velocidade / 3.6;

        const duracaoPorVolta = 20 / velocidadeMs;

        tempoSegundos += info.voltas * duracaoPorVolta;

    }

    const proximoEstagio = ESTAGIOS_LEGER[estagioCompleto + 1];

    if(voltaNoProximo > 0 && proximoEstagio){

        const velocidadeMsProx = proximoEstagio.velocidade / 3.6;

        const duracaoPorVoltaProx = 20 / velocidadeMsProx;

        tempoSegundos += voltaNoProximo * duracaoPorVoltaProx;

    }

    const distanciaM = (infoEstagio.acumulado + voltaNoProximo) * 20;

    // VO2máx (Léger, Mercier, Gadoury & Lambert, 1988 — válido para 8 a 19 anos)
    const V = infoEstagio.velocidade;

    const A = idade;

    const vo2max = 31.025 + (3.238 * V) - (3.248 * A) + (0.1536 * A * V);

    return {

        velocidade: V,

        distanciaM,

        tempoSegundos: Math.round(tempoSegundos),

        vo2max: Number(vo2max.toFixed(1))

    };

}

// Converte um total de voltas acumuladas (o que o aluno consegue contar
// sozinho) no par [estagio completo, voltas no estágio seguinte] que o
// resto do cálculo espera. Usado no autopreenchimento do aluno.
export function converterVoltasParaEstagio(totalVoltas){

    let estagioCompleto = 0;

    let voltasRestantes = totalVoltas;

    for(let n = 1; n < ESTAGIOS_LEGER.length; n++){

        const info = ESTAGIOS_LEGER[n];

        if(voltasRestantes >= info.voltas && info.acumulado <= totalVoltas){

            estagioCompleto = n;

            voltasRestantes = totalVoltas - info.acumulado;

        }else{

            break;

        }

    }

    return { estagioCompleto, voltaNoProximo: Math.max(voltasRestantes, 0) };

}

// Valor mínimo pra completar o 1º estágio, e o total confirmado na
// tabela (estágio 17) — usados na validação inteligente da tela nova.
const VOLTAS_MINIMAS = ESTAGIOS_LEGER[1].voltas;

const VOLTAS_MAXIMAS_CONFIRMADAS = ESTAGIOS_LEGER[ESTAGIOS_LEGER.length - 1].acumulado;

// ======================================================
// TELA DE COLETA EM CAMPO (reformulada)
// Diferente dos outros testes: aqui só se pede o TOTAL DE
// VOLTAS (o que dá pra contar durante a aplicação) — o
// sistema calcula estágio, tempo, distância e VO₂máx sozinho.
// ======================================================

let turmas = [];

let dadosAlunos = [];

let filtroAtual = "todos";

let ordenacaoAtual = "alfabetica";

let termoBusca = "";

let turmaLG, gridAlunosLG, buscaAlunoLG, ordenacaoLG, filtrosSituacaoLG;
let areaProgresso, areaFiltros;
let progressoTurmaNome, progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaTurma, metaQtdAlunos, metaData;
let btnAlunoAnterior, btnProximoAluno;

function obterElementos(){

    turmaLG = document.getElementById("turmaLG");
    gridAlunosLG = document.getElementById("gridAlunosLG");
    buscaAlunoLG = document.getElementById("buscaAlunoLG");
    ordenacaoLG = document.getElementById("ordenacaoLG");
    filtrosSituacaoLG = document.getElementById("filtrosSituacaoLG");
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

    turmaLG.addEventListener("change", carregarDadosDaTurma);

    buscaAlunoLG.addEventListener("keyup", () => {

        termoBusca = buscaAlunoLG.value.trim().toLowerCase();

        renderizarGrid();

    });

    ordenacaoLG.addEventListener("change", () => {

        ordenacaoAtual = ordenacaoLG.value;

        renderizarGrid();

    });

    filtrosSituacaoLG.querySelectorAll(".filtro-situacao").forEach(botao=>{

        botao.addEventListener("click", () => {

            filtrosSituacaoLG.querySelectorAll(".filtro-situacao").forEach(b => b.classList.remove("ativo"));

            botao.classList.add("ativo");

            filtroAtual = botao.dataset.filtro;

            renderizarGrid();

        });

    });

    btnProximoAluno.addEventListener("click", () => moverFoco(1));

    btnAlunoAnterior.addEventListener("click", () => moverFoco(-1));

    document.getElementById("btnComoExecutar").addEventListener("click", () => {

        window.abrirComoExecutar("leger");

    });

    document.getElementById("fecharHistoricoLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("fundoPainelLateral").addEventListener("click", fecharHistoricoLateral);

    document.getElementById("btnCancelarValidacaoLG").addEventListener("click", () => {

        document.getElementById("modalValidacaoLG").classList.remove("show");

    });

    document.getElementById("btnConfirmarValidacaoLG").addEventListener("click", () => {

        document.getElementById("modalValidacaoLG").classList.remove("show");

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

        containerIconeTeste.innerHTML = iconeTeste("leger", 56);

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

    turmaLG.innerHTML = `<option value="">Selecione a turma...</option>`;

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"turmas"), ...condicoes, orderBy("nome"));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.forEach(turma=>{

            turmaLG.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

async function carregarDadosDaTurma(){

    dadosAlunos = [];

    gridAlunosLG.innerHTML = "";

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    if(!turmaLG.value){

        return;

    }

    const turmaAtual = turmas.find(t => t.id === turmaLG.value);

    metaTurma.textContent = turmaAtual ? turmaAtual.nome : "-";

    gridAlunosLG.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando alunos...</p>`;

    try{

        const condicoesAlunos = filtroEscola();

        const qAlunos = query(collection(db,"alunos"), ...condicoesAlunos, orderBy("nome"));

        const snapAlunos = await getDocs(qAlunos);

        const alunosDaTurma = [];

        snapAlunos.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turmaLG.value){

                alunosDaTurma.push(dadosAluno);

            }

        });

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_leger"), ...condicoesAvaliacoes);

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
                ultimoValor: maisRecente?.voltasTotais ?? null,
                ultimoVo2max: maisRecente?.vo2max ?? null,
                ultimaClassificacao: maisRecente?.classificacao ?? null,
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

    const turmaAtual = turmas.find(t => t.id === turmaLG.value);

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

        lista = lista.filter(d => d.ultimaClassificacao === "Zona de risco à saúde");

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

        gridAlunosLG.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum aluno encontrado com esse filtro.</p>`;

        return;

    }

    gridAlunosLG.innerHTML = lista.map(dadosAluno => renderizarCard(dadosAluno)).join("");

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

    const { aluno, ultimoValor, ultimoVo2max, ultimaClassificacao, avaliadoHoje, ausente } = dadosAluno;

    const idade = calcularIdade(aluno.dataNascimento);

    let statusBadge = `<span class="badge-status pendente">⏳ Pendente</span>`;

    if(ausente){

        statusBadge = `<span class="badge-status ausente">❌ Ausente</span>`;

    }else if(avaliadoHoje){

        statusBadge = `<span class="badge-status concluido">✔ Avaliado</span>`;

    }

    const ultimoResultadoTexto = ultimoValor !== null

        ? `${ultimoValor} voltas — VO₂ ${ultimoVo2max ?? "-"}${ultimaClassificacao ? " — " + ultimaClassificacao : ""}`

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
                        placeholder="total de voltas"
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

        mostrarToast("Informe o total de voltas antes de salvar.", "erro");

        return;

    }

    const totalVoltas = Number(input.value);

    if(isNaN(totalVoltas) || totalVoltas < VOLTAS_MINIMAS){

        mostrarToast(`Informe pelo menos ${VOLTAS_MINIMAS} voltas (mínimo pra completar o primeiro estágio).`, "erro");

        return;

    }

    const idade = calcularIdade(dadosAluno.aluno.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Aluno sem data de nascimento cadastrada — não é possível calcular o VO₂máx.", "erro");

        return;

    }

    // Validação inteligente: além da tabela de estágios confirmada
    if(!forcarSemValidar && totalVoltas > VOLTAS_MAXIMAS_CONFIRMADAS){

        abrirModalValidacao(totalVoltas, alunoId);

        return;

    }

    const { estagioCompleto, voltaNoProximo } = converterVoltasParaEstagio(totalVoltas);

    const resultado = calcularResultadoLeger(estagioCompleto, voltaNoProximo, idade);

    if(!resultado){

        mostrarToast("Não foi possível calcular o resultado.", "erro");

        return;

    }

    const classificacao = classificarFitnessgram(resultado.vo2max, idade, dadosAluno.aluno.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        alunoId: dadosAluno.aluno.id,
        nome: dadosAluno.aluno.nome,
        codigoSAFE: dadosAluno.aluno.codigoSAFE || "",
        turmaId: turmaLG.value,
        escolaId: souSuperAdmin()
            ? ((turmas.find(t => t.id === turmaLG.value) || {}).escolaId || dadosAluno.aluno.escolaId || "")
            : obterEscolaId(),
        professorId: contexto.uid,
        estagio: estagioCompleto,
        volta: voltaNoProximo,
        voltasTotais: totalVoltas,
        velocidadeFinal: resultado.velocidade,
        distanciaM: resultado.distanciaM,
        tempoSegundos: resultado.tempoSegundos,
        vo2max: resultado.vo2max,
        classificacao,
        esforco: "",
        sensacao: "",
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_leger"), avaliacao);

        dadosAluno.ultimoValor = totalVoltas;

        dadosAluno.ultimoVo2max = resultado.vo2max;

        dadosAluno.ultimaClassificacao = classificacao;

        dadosAluno.avaliadoHoje = true;

        mostrarToast(`${dadosAluno.aluno.nome}: Estágio ${estagioCompleto} salvo!`);

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

    document.getElementById("mensagemValidacaoLG").textContent =

        `${valor} voltas passa do estágio 17, que é o limite confirmado da nossa tabela. Confira se contou certo antes de confirmar.`;

    document.getElementById("modalValidacaoLG").classList.add("show");

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

        const q = query(collection(db,"avaliacoes_leger"), ...condicoes);

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
                    <div class="linha-historico-lateral-valor">Estágio ${av.estagio ?? "-"} — VO₂ ${av.vo2max ?? "-"}</div>
                    <div class="linha-historico-lateral-classificacao">${av.classificacao ?? "Sem classificação (idade < 10)"}</div>
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