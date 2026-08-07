// ======================================================
// SAFE
// Módulo: Teste de Léger (ADULTOS)
//
// Léger não faz parte da bateria PROESP-Br (que é só pra
// alunos, 6-17 anos) — é aplicado separadamente aos
// funcionários adultos da escola (professores, motoristas,
// zeladores etc.), cadastrados em js/modules/funcionarios.js.
//
// ATENÇÃO — funções exportadas daqui (calcularResultadoLeger,
// converterVoltasParaEstagio, ESTAGIOS_LEGER) também são
// usadas por outros módulos. `calcularIdade` está em
// js/core/utils.js (usada por praticamente todo módulo).
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
// TABELA OFICIAL DE ESTÁGIOS (Léger 20m Shuttle Run)
// velocidade em km/h, voltas = quantidade de tiros de 20m
// naquele estágio, acumulado = total de tiros até o fim
// do estágio (inclusive).
// Índice 0 não é usado (estágio começa em 1).
//
// Velocidades conferidas contra o "Manual prático para a
// aplicação do teste de Vai-e-Vem (20m) de Léger" (GPAQ —
// Añez & Hino, v2): "O teste inicia-se com uma velocidade de
// 8,5 km/h e a cada estágio aumenta 0,5 km/h." O nível 1
// estava registrado como 8,0 — corrigido pra 8,5.
// ======================================================

export const ESTAGIOS_LEGER = [

    null,
    { nivel:1,  velocidade:8.5,  voltas:7,  acumulado:7   },
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

// TODO: tabela confirmada até o estágio 17. Se algum funcionário muito
// condicionado ultrapassar isso, precisamos validar e completar os
// estágios seguintes antes de confiar no cálculo.

// ======================================================
// CLASSIFICAÇÃO — APTIDÃO CARDIORRESPIRATÓRIA EM ADULTOS
//
// IMPORTANTE: isso é só o rótulo (Fraco/Bom/Excelência etc.) —
// o VALOR do VO2máx em si (calcularResultadoLeger, abaixo) já
// está confirmado contra o "Manual prático para a aplicação do
// teste de Vai-e-Vem (20m) de Léger" (GPAQ — Añez & Hino, v2).
//
// As FAIXAS de classificação abaixo, porém, continuam de uma
// tabela normativa de VO2máx por sexo e faixa etária amplamente
// publicada (Cooper Institute / ACSM's Guidelines for Exercise
// Testing and Prescription) digitada de memória — mantém os
// mesmos 5 rótulos usados no restante do SAFE pros testes de
// desempenho (Fraco/Razoável/Bom/Muito Bom/Excelência) só por
// consistência visual.
//
// ATENÇÃO — PROVISÓRIO: confira estas FAIXAS contra uma fonte
// oficial (ex: edição específica do ACSM's Guidelines, ou a
// tabela por nível/sexo do "20m Beep Test Protocol and Scoring"
// que você já mandou) antes de liberar pra avaliações reais.
// ======================================================

const ACSM_VO2MAX = {

    masculino: {

        29: { fraco:33, razoavel:37, bom:42, muitoBom:46 },
        39: { fraco:31, razoavel:36, bom:41, muitoBom:45 },
        49: { fraco:28, razoavel:32, bom:36, muitoBom:41 },
        59: { fraco:25, razoavel:29, bom:33, muitoBom:37 },
        99: { fraco:21, razoavel:25, bom:29, muitoBom:33 }

    },

    feminino: {

        29: { fraco:28, razoavel:31, bom:34, muitoBom:38 },
        39: { fraco:27, razoavel:30, bom:33, muitoBom:37 },
        49: { fraco:25, razoavel:28, bom:31, muitoBom:34 },
        59: { fraco:21, razoavel:24, bom:27, muitoBom:32 },
        99: { fraco:18, razoavel:21, bom:24, muitoBom:28 }

    }

};

export function classificarACSM(vo2max, idade, sexo){

    if(vo2max === null || vo2max === undefined || isNaN(vo2max)){

        return null;

    }

    const chaveSexo = (sexo || "").toLowerCase() === "feminino" ? "feminino" : "masculino";

    const idadeValida = typeof idade === "number" ? Math.max(idade, 20) : 30;

    const faixasEtarias = Object.keys(ACSM_VO2MAX[chaveSexo]).map(Number).sort((a,b) => a-b);

    const faixaEtaria = faixasEtarias.find(limite => idadeValida <= limite) ?? faixasEtarias[faixasEtarias.length - 1];

    const corte = ACSM_VO2MAX[chaveSexo][faixaEtaria];

    if(vo2max <= corte.fraco){

        return "Fraco";

    }

    if(vo2max <= corte.razoavel){

        return "Razoável";

    }

    if(vo2max <= corte.bom){

        return "Bom";

    }

    if(vo2max <= corte.muitoBom){

        return "Muito Bom";

    }

    return "Excelência";

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

    // VO2máx — duas fórmulas oficiais, conforme o "Manual prático para
    // a aplicação do teste de Vai-e-Vem (20m) de Léger" (GPAQ — Añez &
    // Hino, v2):
    //
    // Menores de 18 anos (Léger, Mercier, Gadoury & Lambert, 1988):
    //   VO2max = 31.025 + 3.238×Vel - 3.248×Idade + 0.1536×Vel×Idade
    //
    // 18 anos ou mais: a idade sai da equação, só a velocidade do
    // último estágio completo importa:
    //   VO2max = -27.4 + 6×Vel
    //
    // (As duas coincidem exatamente em Idade=18 — não é um "salto" na
    // fronteira, é matematicamente contínuo.)
    const V = infoEstagio.velocidade;

    const A = idade;

    const vo2max = A < 18
        ? 31.025 + (3.238 * V) - (3.248 * A) + (0.1536 * A * V)
        : -27.4 + (6 * V);

    return {

        velocidade: V,

        distanciaM,

        tempoSegundos: Math.round(tempoSegundos),

        vo2max: Number(vo2max.toFixed(1))

    };

}

// Converte um total de voltas acumuladas (o que o avaliador consegue
// contar sozinho) no par [estagio completo, voltas no estágio
// seguinte] que o resto do cálculo espera.
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
// tabela (estágio 17) — usados na validação inteligente da tela.
const VOLTAS_MINIMAS = ESTAGIOS_LEGER[1].voltas;

const VOLTAS_MAXIMAS_CONFIRMADAS = ESTAGIOS_LEGER[ESTAGIOS_LEGER.length - 1].acumulado;

// ======================================================
// TELA DE COLETA EM CAMPO
// Diferente dos módulos de aluno, aqui não existe "turma" —
// o grid carrega direto todos os funcionários ativos da
// escola. Só se pede o TOTAL DE VOLTAS (o que dá pra contar
// durante a aplicação) — o sistema calcula estágio, tempo,
// distância e VO₂máx sozinho.
// ======================================================

let dadosFuncionarios = [];

let filtroAtual = "todos";

let termoBusca = "";

let gridFuncionariosLG, buscaFuncionarioLG, filtrosSituacaoLG;
let areaProgresso, areaFiltros;
let progressoContagem, progressoPreenchimento;
let qtdConcluidos, qtdPendentes, qtdAusentes;
let metaProfessor, metaQtdFuncionarios, metaData;
let btnFuncionarioAnterior, btnProximoFuncionario;

function obterElementos(){

    gridFuncionariosLG = document.getElementById("gridFuncionariosLG");
    buscaFuncionarioLG = document.getElementById("buscaFuncionarioLG");
    filtrosSituacaoLG = document.getElementById("filtrosSituacaoLG");
    areaProgresso = document.getElementById("areaProgresso");
    areaFiltros = document.getElementById("areaFiltros");
    progressoContagem = document.getElementById("progressoContagem");
    progressoPreenchimento = document.getElementById("progressoPreenchimento");
    qtdConcluidos = document.getElementById("qtdConcluidos");
    qtdPendentes = document.getElementById("qtdPendentes");
    qtdAusentes = document.getElementById("qtdAusentes");
    metaProfessor = document.getElementById("metaProfessor");
    metaQtdFuncionarios = document.getElementById("metaQtdFuncionarios");
    metaData = document.getElementById("metaData");
    btnFuncionarioAnterior = document.getElementById("btnFuncionarioAnterior");
    btnProximoFuncionario = document.getElementById("btnProximoFuncionario");

}

function configurarEventos(){

    buscaFuncionarioLG.addEventListener("keyup", () => {

        termoBusca = buscaFuncionarioLG.value.trim().toLowerCase();

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

    btnProximoFuncionario.addEventListener("click", () => moverFoco(1));

    btnFuncionarioAnterior.addEventListener("click", () => moverFoco(-1));

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

        if(funcionarioPendenteDeConfirmacao){

            salvarResultado(funcionarioPendenteDeConfirmacao, true);

            funcionarioPendenteDeConfirmacao = null;

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

    await carregarFuncionarios();

}

function filtroEscola(condicoesExtra = []){

    if(souSuperAdmin()){

        return condicoesExtra;

    }

    return [...condicoesExtra, where("escolaId","==",obterEscolaId())];

}

async function carregarFuncionarios(){

    dadosFuncionarios = [];

    gridFuncionariosLG.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Carregando funcionários...</p>`;

    areaProgresso.style.display = "none";

    areaFiltros.style.display = "none";

    try{

        const condicoesFuncionarios = filtroEscola();

        const qFuncionarios = query(collection(db,"funcionarios"), ...condicoesFuncionarios, orderBy("nome"));

        const snapFuncionarios = await getDocs(qFuncionarios);

        const funcionariosAtivos = [];

        snapFuncionarios.forEach(doc=>{

            const dados = { id: doc.id, ...doc.data() };

            if(dados.ativo !== false){

                funcionariosAtivos.push(dados);

            }

        });

        const condicoesAvaliacoes = filtroEscola();

        const qAvaliacoes = query(collection(db,"avaliacoes_leger_adulto"), ...condicoesAvaliacoes);

        const snapAvaliacoes = await getDocs(qAvaliacoes);

        const registrosPorFuncionario = new Map();

        snapAvaliacoes.forEach(doc=>{

            const dados = doc.data();

            if(!registrosPorFuncionario.has(dados.funcionarioId)){

                registrosPorFuncionario.set(dados.funcionarioId, []);

            }

            registrosPorFuncionario.get(dados.funcionarioId).push(dados);

        });

        const hojeISO = new Date().toISOString().slice(0,10);

        metaQtdFuncionarios.textContent = funcionariosAtivos.length;

        dadosFuncionarios = funcionariosAtivos.map(funcionario=>{

            const registros = (registrosPorFuncionario.get(funcionario.id) || []).slice()

                .sort((a,b)=>{

                    const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

                    const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

                    return dataB - dataA;

                });

            const maisRecente = registros[0] || null;

            const dataMaisRecenteISO = maisRecente?.dataTeste ? maisRecente.dataTeste.toDate().toISOString().slice(0,10) : null;

            return {

                funcionario,
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

        mostrarToast("Não foi possível carregar os funcionários.", "erro");

    }

}

function renderizarProgresso(){

    const total = dadosFuncionarios.length;

    const concluidos = dadosFuncionarios.filter(d => d.avaliadoHoje).length;

    const ausentes = dadosFuncionarios.filter(d => d.ausente).length;

    const pendentes = total - concluidos - ausentes;

    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    progressoContagem.textContent = `${concluidos} de ${total} funcionários avaliados hoje`;

    progressoPreenchimento.style.width = `${percentual}%`;

    qtdConcluidos.textContent = concluidos;

    qtdPendentes.textContent = pendentes;

    qtdAusentes.textContent = ausentes;

}

function obterListaFiltrada(){

    let lista = dadosFuncionarios;

    if(termoBusca){

        lista = lista.filter(d => (d.funcionario.nome || "").toLowerCase().includes(termoBusca));

    }

    if(filtroAtual === "pendente"){

        lista = lista.filter(d => !d.avaliadoHoje && !d.ausente);

    }else if(filtroAtual === "concluido"){

        lista = lista.filter(d => d.avaliadoHoje);

    }else if(filtroAtual === "ausente"){

        lista = lista.filter(d => d.ausente);

    }else if(filtroAtual === "risco"){

        // Sem "zona de saúde" pra adultos aqui — usa a classificação
        // "Fraco" (tier mais baixo do ACSM) como equivalente de alerta.
        lista = lista.filter(d => d.ultimaClassificacao === "Fraco");

    }

    lista = [...lista].sort((a,b) => (a.funcionario.nome || "").localeCompare(b.funcionario.nome || "", "pt-BR"));

    return lista;

}

function renderizarGrid(){

    const lista = obterListaFiltrada();

    if(lista.length === 0){

        gridFuncionariosLG.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1;">Nenhum funcionário encontrado com esse filtro.</p>`;

        return;

    }

    gridFuncionariosLG.innerHTML = lista.map(dadosFuncionario => renderizarCard(dadosFuncionario)).join("");

    lista.forEach(dadosFuncionario=>{

        const idFuncionario = dadosFuncionario.funcionario.id;

        const card = document.getElementById(`card-${idFuncionario}`);

        if(!card){
            return;
        }

        card.querySelector(".btn-salvar-card")?.addEventListener("click", () => salvarResultado(idFuncionario));

        card.querySelector(".input-resultado")?.addEventListener("keyup", (evento)=>{

            if(evento.key === "Enter"){

                salvarResultado(idFuncionario);

            }

        });

        card.querySelector(".btn-ausente-card")?.addEventListener("click", () => alternarAusente(idFuncionario));

        card.querySelector(".card-aluno-nome")?.addEventListener("click", () => abrirHistoricoLateral(idFuncionario));

    });

}

function renderizarCard(dadosFuncionario){

    const { funcionario, ultimoValor, ultimoVo2max, ultimaClassificacao, avaliadoHoje, ausente } = dadosFuncionario;

    const idade = calcularIdade(funcionario.dataNascimento);

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

        <div class="card-aluno-campo ${ausente ? "esmaecido" : ""}" id="card-${funcionario.id}">

            <div class="card-aluno-topo">
                <span class="card-aluno-nome" title="Ver histórico">${funcionario.nome}</span>
                ${statusBadge}
            </div>

            <div class="card-aluno-meta">
                ${idade ? `${idade} anos` : "-"} • ${funcionario.sexo || "-"} • ${funcionario.cargo || "-"}
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
                        aria-label="Resultado de ${funcionario.nome}">

                    <button class="btn btn-primary btn-salvar-card">Salvar</button>

                    <button class="btn-ausente-card" title="Marcar ausente hoje">❌</button>

                </div>

            ` : `

                <button class="btn-secondary btn-ausente-card" style="width:100%;">Desmarcar ausência</button>

            `}

        </div>

    `;

}

function alternarAusente(funcionarioId){

    const dadosFuncionario = dadosFuncionarios.find(d => d.funcionario.id === funcionarioId);

    if(!dadosFuncionario){
        return;
    }

    dadosFuncionario.ausente = !dadosFuncionario.ausente;

    renderizarProgresso();

    renderizarGrid();

}

let funcionarioPendenteDeConfirmacao = null;

async function salvarResultado(funcionarioId, forcarSemValidar = false){

    const dadosFuncionario = dadosFuncionarios.find(d => d.funcionario.id === funcionarioId);

    if(!dadosFuncionario){
        return;
    }

    const card = document.getElementById(`card-${funcionarioId}`);

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

    const idade = calcularIdade(dadosFuncionario.funcionario.dataNascimento);

    if(typeof idade !== "number"){

        mostrarToast("Funcionário sem data de nascimento cadastrada — não é possível calcular o VO₂máx.", "erro");

        return;

    }

    // Validação inteligente: além da tabela de estágios confirmada
    if(!forcarSemValidar && totalVoltas > VOLTAS_MAXIMAS_CONFIRMADAS){

        abrirModalValidacao(totalVoltas, funcionarioId);

        return;

    }

    const { estagioCompleto, voltaNoProximo } = converterVoltasParaEstagio(totalVoltas);

    const resultado = calcularResultadoLeger(estagioCompleto, voltaNoProximo, idade);

    if(!resultado){

        mostrarToast("Não foi possível calcular o resultado.", "erro");

        return;

    }

    const classificacao = classificarACSM(resultado.vo2max, idade, dadosFuncionario.funcionario.sexo);

    const contexto = obterContextoUsuario();

    const avaliacao = {

        funcionarioId: dadosFuncionario.funcionario.id,
        nome: dadosFuncionario.funcionario.nome,
        cargo: dadosFuncionario.funcionario.cargo || "",
        escolaId: souSuperAdmin()
            ? (dadosFuncionario.funcionario.escolaId || "")
            : obterEscolaId(),
        avaliadorId: contexto.uid,
        estagio: estagioCompleto,
        volta: voltaNoProximo,
        voltasTotais: totalVoltas,
        velocidadeFinal: resultado.velocidade,
        distanciaM: resultado.distanciaM,
        tempoSegundos: resultado.tempoSegundos,
        vo2max: resultado.vo2max,
        classificacao,
        observacoes: "",
        dataTeste: Timestamp.now(),
        criadoEm: Timestamp.now()

    };

    try{

        await addDoc(collection(db,"avaliacoes_leger_adulto"), avaliacao);

        dadosFuncionario.ultimoValor = totalVoltas;

        dadosFuncionario.ultimoVo2max = resultado.vo2max;

        dadosFuncionario.ultimaClassificacao = classificacao;

        dadosFuncionario.avaliadoHoje = true;

        mostrarToast(`${dadosFuncionario.funcionario.nome}: Estágio ${estagioCompleto} salvo!`);

        renderizarProgresso();

        renderizarGrid();

        focarProximoPendente(funcionarioId);

    }catch(e){

        console.error(e);

        mostrarToast("Erro ao salvar a avaliação.", "erro");

    }

}

function abrirModalValidacao(valor, funcionarioId){

    funcionarioPendenteDeConfirmacao = funcionarioId;

    document.getElementById("mensagemValidacaoLG").textContent =

        `${valor} voltas passa do estágio 17, que é o limite confirmado da nossa tabela. Confira se contou certo antes de confirmar.`;

    document.getElementById("modalValidacaoLG").classList.add("show");

}

function focarProximoPendente(funcionarioIdAtual){

    const lista = obterListaFiltrada();

    const indiceAtual = lista.findIndex(d => d.funcionario.id === funcionarioIdAtual);

    const proximoPendente = lista.slice(indiceAtual + 1).find(d => !d.avaliadoHoje && !d.ausente);

    if(proximoPendente){

        const proximoInput = document.getElementById(`card-${proximoPendente.funcionario.id}`)?.querySelector(".input-resultado");

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

    let indiceAtual = cardAtivo ? lista.findIndex(d => `card-${d.funcionario.id}` === cardAtivo.id) : -1;

    let proximoIndice = indiceAtual + direcao;

    if(proximoIndice < 0){
        proximoIndice = 0;
    }

    if(proximoIndice >= lista.length){
        proximoIndice = lista.length - 1;
    }

    const alvo = document.getElementById(`card-${lista[proximoIndice].funcionario.id}`)?.querySelector(".input-resultado");

    alvo?.scrollIntoView({ behavior:"smooth", block:"center" });

    alvo?.focus();

}

async function abrirHistoricoLateral(funcionarioId){

    const dadosFuncionario = dadosFuncionarios.find(d => d.funcionario.id === funcionarioId);

    if(!dadosFuncionario){
        return;
    }

    document.getElementById("tituloHistoricoLateral").textContent = dadosFuncionario.funcionario.nome;

    const corpo = document.getElementById("corpoHistoricoLateral");

    corpo.innerHTML = `<p style="color:#94a3b8">Carregando...</p>`;

    document.getElementById("painelHistoricoLateral").classList.add("aberto");

    document.getElementById("fundoPainelLateral").classList.add("aberto");

    try{

        const condicoes = filtroEscola();

        const q = query(collection(db,"avaliacoes_leger_adulto"), ...condicoes);

        const snapshot = await getDocs(q);

        const registros = [];

        snapshot.forEach(doc=>{

            const dados = doc.data();

            if(dados.funcionarioId === funcionarioId){

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
                    <div class="linha-historico-lateral-classificacao">${av.classificacao ?? "-"}</div>
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
