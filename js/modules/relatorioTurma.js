// ======================================================
// SAFE
// Módulo: Dashboard da Turma
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    mostrarToast
} from "../core/utils.js";

import { FAIXAS_SAFE_SCORE, classificarSafeScore } from "../core/safeScore.js";

import{
    collection,
    getDocs,
    query,
    where
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ======================================================
// CONFIGURAÇÃO DOS TESTES
// ======================================================

const CATEGORIAS_DESEMPENHO = ["Fraco","Razoável","Bom","Muito Bom","Excelência"];

const CATEGORIAS_LEGER = ["Zona de risco à saúde","Precisa melhorar","Zona saudável"];

const CATEGORIAS_IMC = ["Zona de risco à saúde","Zona saudável"];

const TESTES_CONFIG = [
    { colecao:"avaliacoes_leger", titulo:"Léger", campo:"classificacao", categorias:CATEGORIAS_LEGER, cor:"#2563EB" },
    { colecao:"avaliacoes_circunferenciacintura", titulo:"Perímetro da Cintura (RCE)", campo:"classificacaoSaude", categorias:CATEGORIAS_IMC, cor:"#0891B2" },
    { colecao:"avaliacoes_imc", titulo:"IMC", campo:"classificacaoSaude", categorias:CATEGORIAS_IMC, cor:"#DC2626" },
    { colecao:"avaliacoes_flexibilidade", titulo:"Flexibilidade", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#16A34A" },
    { colecao:"avaliacoes_abdominal", titulo:"Resist. Muscular", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#F59E0B" },
    { colecao:"avaliacoes_medicineball", titulo:"Potência Superior", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#7C3AED" },
    { colecao:"avaliacoes_saltohorizontal", titulo:"Potência Inferior", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#DB2777" },
    { colecao:"avaliacoes_agilidade", titulo:"Agilidade", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#0D9488" },
    { colecao:"avaliacoes_corrida20m", titulo:"Velocidade", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#EA580C" },
    { colecao:"avaliacoes_corrida6min", titulo:"Apt. Cardiorresp.", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#4338CA" }
];

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let escolas = [];
let turmas = [];
let alunos = [];

let historicoParaPopup = [];

let dadosAlunosHeatmap = []; // [{aluno, nota, celulas:[{titulo,texto,cor}], temHistorico}]

let dadosProblemasParaPopup = [];

let agrupamentoAtivo = false;

let escolaRelTurma, turmaRelTurma, areaRelatorioTurma;
let tituloTurmaRel, btnExportarPdfTurma;
let cardsSituacaoTurma, distribuicaoTurma, rankingProblemasTurma, cardRecomendacoesTurma;
let buscaAlunoTurma, btnAgruparAlunos, legendaTurmaRel, areaHeatmapTurma;

function obterElementos(){

    escolaRelTurma = document.getElementById("escolaRelTurma");
    turmaRelTurma = document.getElementById("turmaRelTurma");
    areaRelatorioTurma = document.getElementById("areaRelatorioTurma");
    tituloTurmaRel = document.getElementById("tituloTurmaRel");
    btnExportarPdfTurma = document.getElementById("btnExportarPdfTurma");
    cardsSituacaoTurma = document.getElementById("cardsSituacaoTurma");
    distribuicaoTurma = document.getElementById("distribuicaoTurma");
    rankingProblemasTurma = document.getElementById("rankingProblemasTurma");
    cardRecomendacoesTurma = document.getElementById("cardRecomendacoesTurma");
    buscaAlunoTurma = document.getElementById("buscaAlunoTurma");
    btnAgruparAlunos = document.getElementById("btnAgruparAlunos");
    legendaTurmaRel = document.getElementById("legendaTurmaRel");
    areaHeatmapTurma = document.getElementById("areaHeatmapTurma");

}

function configurarEventos(){

    escolaRelTurma.addEventListener("change", carregarTurmas);

    turmaRelTurma.addEventListener("change", montarRelatorio);

    btnExportarPdfTurma.addEventListener("click", () => window.print());

    buscaAlunoTurma.addEventListener("keyup", () => renderizarHeatmap());

    btnAgruparAlunos.addEventListener("click", () => {

        agrupamentoAtivo = !agrupamentoAtivo;

        btnAgruparAlunos.textContent = agrupamentoAtivo

            ? "Ver lista normal"

            : "Agrupar por classificação";

        renderizarHeatmap();

    });

    document.querySelectorAll(".fechar-modal-evolucao").forEach(botao=>{

        botao.addEventListener("click", () => {

            document.getElementById("modalEvolucaoTurma")?.classList.remove("show");

        });

    });

    const modalEvolucao = document.getElementById("modalEvolucaoTurma");

    modalEvolucao?.addEventListener("click", (evento)=>{

        if(evento.target === modalEvolucao){

            modalEvolucao.classList.remove("show");

        }

    });

    document.querySelectorAll(".fechar-modal-teste-turma").forEach(botao=>{

        botao.addEventListener("click", () => {

            document.getElementById("modalTesteTurma")?.classList.remove("show");

        });

    });

    const modalTesteTurma = document.getElementById("modalTesteTurma");

    modalTesteTurma?.addEventListener("click", (evento)=>{

        if(evento.target === modalTesteTurma){

            modalTesteTurma.classList.remove("show");

        }

    });

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

}

// ======================================================
// CARREGAR ESCOLAS / TURMAS
// ======================================================

async function carregarEscolas(){

    escolas = [];

    escolaRelTurma.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaRelTurma.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            const escolaId = obterEscolaId();

            escolaRelTurma.innerHTML = `<option value="${escolaId}">Minha escola</option>`;

            escolaRelTurma.value = escolaId;

            escolaRelTurma.disabled = true;

            await carregarTurmas();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

async function carregarTurmas(){

    turmas = [];

    turmaRelTurma.innerHTML = `<option value="">Selecione...</option>`;

    areaRelatorioTurma.style.display = "none";

    if(!escolaRelTurma.value){

        return;

    }

    try{

        const q = query(collection(db,"turmas"), where("escolaId","==",escolaRelTurma.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        turmas.forEach(turma=>{

            turmaRelTurma.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

// ======================================================
// MONTAR RELATÓRIO
// ======================================================

async function montarRelatorio(){

    areaRelatorioTurma.style.display = "none";

    if(!turmaRelTurma.value){

        return;

    }

    const turmaSelecionada = turmas.find(t => t.id === turmaRelTurma.value);

    tituloTurmaRel.textContent = `Turma: ${turmaSelecionada ? turmaSelecionada.nome : ""}`;

    areaRelatorioTurma.style.display = "block";

    cardsSituacaoTurma.innerHTML = `<div class="card"><p style="color:#94a3b8">Carregando...</p></div>`;

    // 1) Alunos da turma
    alunos = [];

    try{

        const qAlunos = query(collection(db,"alunos"), where("escolaId","==",escolaRelTurma.value));

        const snapAlunos = await getDocs(qAlunos);

        snapAlunos.forEach(doc=>{

            const dados = { id: doc.id, ...doc.data() };

            if(dados.turmaId === turmaRelTurma.value){

                alunos.push(dados);

            }

        });

        alunos.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os alunos.", "erro");

        return;

    }

    // 2) Busca os dados (mais recente + histórico completo) de cada teste
    const resultadosPorTeste = await Promise.all(

        TESTES_CONFIG.map(config => buscarDadosPorAluno(config))

    );

    // 3) Legenda de cores dos testes
    legendaTurmaRel.innerHTML = TESTES_CONFIG.map(c => `

        <span class="legenda-item">
            <span class="legenda-cor" style="background:${c.cor}"></span>
            ${c.titulo}
        </span>

    `).join("");

    // 4) Monta os dados por aluno (nota geral, células do heatmap, histórico)
    montarDadosPorAluno(resultadosPorTeste);

    // 5) Renderiza tudo
    renderizarSituacaoGeral();

    renderizarDistribuicao();

    renderizarRankingProblemas(resultadosPorTeste);

    renderizarRecomendacoes(resultadosPorTeste);

    renderizarHeatmap();

}

// ======================================================
// BUSCAR DADOS DE UM TESTE PRA TURMA INTEIRA
// ======================================================

async function buscarDadosPorAluno(config){

    const ultimos = new Map(); // alunoId -> { texto, posicao }

    const historico = new Map(); // alunoId -> [{dataMillis, posicao}]

    try{

        const q = query(collection(db, config.colecao), where("escolaId","==",escolaRelTurma.value));

        const snapshot = await getDocs(q);

        const registros = [];

        snapshot.forEach(doc => {

            const dados = doc.data();

            if(dados.turmaId === turmaRelTurma.value){

                registros.push(dados);

            }

        });

        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

        registros.forEach(registro=>{

            const categoria = registro[config.campo];

            const indiceCategoria = config.categorias.indexOf(categoria);

            const posicao = indiceCategoria === -1

                ? null

                : (config.categorias.length > 1 ? (indiceCategoria / (config.categorias.length - 1)) * 100 : 50);

            if(!ultimos.has(registro.alunoId) && categoria){

                ultimos.set(registro.alunoId, { texto: categoria, posicao });

            }

            if(posicao !== null && registro.dataTeste){

                if(!historico.has(registro.alunoId)){

                    historico.set(registro.alunoId, []);

                }

                historico.get(registro.alunoId).push({ dataMillis: registro.dataTeste.toMillis(), posicao });

            }

        });

        historico.forEach(pontos => pontos.sort((a,b) => a.dataMillis - b.dataMillis));

    }catch(e){

        console.error(`Erro ao buscar ${config.colecao}:`, e);

    }

    return { ultimos, historico };

}

// ======================================================
// MONTAR DADOS POR ALUNO (nota geral + células + histórico)
// ======================================================

function montarDadosPorAluno(resultadosPorTeste){

    dadosAlunosHeatmap = [];

    historicoParaPopup = [];

    alunos.forEach((aluno, indiceAluno)=>{

        const posicoes = [];

        const celulas = TESTES_CONFIG.map((config, indice) => {

            const dado = resultadosPorTeste[indice].ultimos.get(aluno.id);

            if(dado && dado.posicao !== null){

                posicoes.push(dado.posicao);

            }

            const faixa = dado && dado.posicao !== null ? classificarSafeScore(dado.posicao) : null;

            return {

                titulo: config.titulo,
                texto: dado ? dado.texto : "-",
                cor: faixa ? faixa.cor : "#F1F5F9",
                corTexto: faixa ? "#FFF" : "#94a3b8"

            };

        });

        const nota = posicoes.length > 0

            ? posicoes.reduce((soma, p) => soma + p, 0) / posicoes.length

            : null;

        const historicoDoAluno = TESTES_CONFIG.map((config, indice) => ({

            cor: config.cor,
            titulo: config.titulo,
            pontos: resultadosPorTeste[indice].historico.get(aluno.id) || []

        }));

        historicoParaPopup.push({ nome: aluno.nome, historico: historicoDoAluno });

        dadosAlunosHeatmap.push({

            aluno,
            nota,
            celulas,
            avaliado: posicoes.length > 0,
            indicePopup: indiceAluno

        });

    });

}

// ======================================================
// SITUAÇÃO GERAL
// ======================================================

function renderizarSituacaoGeral(){

    const avaliados = dadosAlunosHeatmap.filter(d => d.avaliado);

    const pendentes = dadosAlunosHeatmap.length - avaliados.length;

    const mediaGeral = avaliados.length > 0

        ? avaliados.reduce((soma, d) => soma + d.nota, 0) / avaliados.length

        : null;

    const faixaMedia = classificarSafeScore(mediaGeral);

    cardsSituacaoTurma.innerHTML = `

        <div class="card"><h3>SAFE Score Médio</h3><h1 style="color:${faixaMedia?.cor || "inherit"}">${mediaGeral !== null ? Math.round(mediaGeral) : "-"}</h1></div>
        <div class="card"><h3>Alunos</h3><h1>${dadosAlunosHeatmap.length}</h1></div>
        <div class="card"><h3>Avaliados</h3><h1 style="color:#16A34A">${avaliados.length}</h1></div>
        <div class="card"><h3>Pendentes</h3><h1 style="color:${pendentes > 0 ? "#F59E0B" : "inherit"}">${pendentes}</h1></div>

    `;

}

// ======================================================
// DISTRIBUIÇÃO (4 faixas)
// ======================================================

function renderizarDistribuicao(){

    const avaliados = dadosAlunosHeatmap.filter(d => d.avaliado);

    if(avaliados.length === 0){

        distribuicaoTurma.innerHTML = `<p style="color:#94a3b8">Nenhum aluno avaliado ainda.</p>`;

        return;

    }

    distribuicaoTurma.innerHTML = FAIXAS_SAFE_SCORE.map(faixa=>{

        const nessaFaixa = avaliados.filter(d => classificarSafeScore(d.nota)?.label === faixa.label);

        const percentual = Math.round((nessaFaixa.length / avaliados.length) * 100);

        return `

            <div class="card card-distribuicao" style="border-top:4px solid ${faixa.cor}; background:${faixa.corFundo}22;">
                <div style="font-size:26px;">${faixa.emoji}</div>
                <h3 style="color:${faixa.cor}">${faixa.label}</h3>
                <h1 style="color:${faixa.cor}">${nessaFaixa.length}</h1>
                <p style="color:#64748b; margin:4px 0;">${percentual}% da turma</p>
            </div>

        `;

    }).join("");

}

// ======================================================
// RANKING DE PROBLEMAS (testes com mais risco NESSA turma)
// ======================================================

function renderizarRankingProblemas(resultadosPorTeste){

    const porTeste = TESTES_CONFIG.map((config, indice) => {

        const mapaValores = resultadosPorTeste[indice].ultimos;

        const valores = Array.from(mapaValores.values()).filter(v => v.posicao !== null);

        if(valores.length === 0){

            return { titulo: config.titulo, percentualRisco: null, alunos: [] };

        }

        const emRisco = valores.filter(v => classificarSafeScore(v.posicao)?.label === "Risco").length;

        const alunosDoTeste = alunos

            .filter(a => mapaValores.has(a.id) && mapaValores.get(a.id).posicao !== null)

            .map(a => ({ nome: a.nome, texto: mapaValores.get(a.id).texto, posicao: mapaValores.get(a.id).posicao }))

            .sort((a,b) => a.posicao - b.posicao);

        return {

            titulo: config.titulo,
            percentualRisco: Math.round((emRisco / valores.length) * 100),
            alunos: alunosDoTeste

        };

    });

    const comDados = porTeste.filter(t => t.percentualRisco !== null).sort((a,b) => b.percentualRisco - a.percentualRisco);

    dadosProblemasParaPopup = comDados;

    if(comDados.length === 0){

        rankingProblemasTurma.innerHTML = `<p style="color:#94a3b8">Nenhum dado suficiente ainda.</p>`;

        return;

    }

    rankingProblemasTurma.innerHTML = comDados.map((teste, posicao) => `

        <div class="linha-ranking" onclick="window.abrirDetalheTesteTurma(${posicao})">
            <span class="linha-ranking-nome">${posicao + 1}º — ${teste.titulo}</span>
            <span class="linha-ranking-score" style="color:${teste.percentualRisco >= 25 ? "#DC2626" : "#64748b"}">${teste.percentualRisco}% em risco</span>
        </div>

    `).join("");

}

window.abrirDetalheTesteTurma = function(indice){

    const teste = dadosProblemasParaPopup[indice];

    if(!teste){
        return;
    }

    document.getElementById("tituloModalTesteTurma").textContent = teste.titulo;

    document.getElementById("subtituloModalTesteTurma").textContent =

        `${teste.percentualRisco}% em risco — alunos do pior pro melhor resultado`;

    document.getElementById("corpoModalTesteTurma").innerHTML = teste.alunos

        .map(a=>{

            const faixa = classificarSafeScore(a.posicao);

            return `

                <div class="linha-resultado">
                    <span>${a.nome} <span style="color:#94a3b8; font-size:12px;">— ${a.texto}</span></span>
                    <span style="font-weight:700; color:${faixa.cor}">${faixa.emoji}</span>
                </div>

            `;

        }).join("") || "<p style='color:#94a3b8'>Nenhum aluno avaliado nesse teste.</p>";

    document.getElementById("modalTesteTurma").classList.add("show");

};

// ======================================================
// RECOMENDAÇÕES AUTOMÁTICAS (baseadas em regra simples)
// ======================================================

function renderizarRecomendacoes(resultadosPorTeste){

    const porTeste = TESTES_CONFIG.map((config, indice) => {

        const valores = Array.from(resultadosPorTeste[indice].ultimos.values()).filter(v => v.posicao !== null);

        if(valores.length === 0){

            return null;

        }

        const emRisco = valores.filter(v => classificarSafeScore(v.posicao)?.label === "Risco").length;

        return { titulo: config.titulo, percentualRisco: (emRisco / valores.length) * 100 };

    }).filter(Boolean);

    if(porTeste.length === 0){

        cardRecomendacoesTurma.innerHTML = `<h3>Recomendações</h3><p style="color:#94a3b8">Sem dados suficientes ainda pra gerar recomendações.</p>`;

        return;

    }

    const pior = porTeste.reduce((a,b) => (a.percentualRisco > b.percentualRisco ? a : b));

    const sugestoesPorTeste = {

        "Léger": "priorizar corridas intervaladas e jogos com deslocamento contínuo",
        "IMC": "conversar com a família sobre alimentação e rotina de atividade física",
        "Flexibilidade": "incluir alongamentos no início/fim de toda aula",
        "Resist. Muscular": "priorizar exercícios de força com o peso do próprio corpo (abdominais, pranchas)",
        "Potência Superior": "trabalhar arremessos e lançamentos com bolas de diferentes pesos",
        "Potência Inferior": "priorizar saltos e exercícios pliométricos",
        "Agilidade": "incluir circuitos com mudança rápida de direção",
        "Velocidade": "priorizar tiros curtos e jogos de pega-pega",
        "Apt. Cardiorrespiratória": "priorizar atividades aeróbias de intensidade moderada, tipo corrida contínua ou jogos de longa duração"

    };

    const sugestao = sugestoesPorTeste[pior.titulo] || "reforçar esse componente físico nas próximas aulas";

    cardRecomendacoesTurma.innerHTML = `

        <h3>Recomendações</h3>

        <p style="margin-top:8px;">
            <strong>${Math.round(pior.percentualRisco)}% da turma está em risco em ${pior.titulo}</strong> —
            essa é a maior fragilidade identificada no momento.
        </p>

        <p style="margin-top:8px; color:#475569;">
            Sugere-se ${sugestao}.
        </p>

    `;

}

// ======================================================
// HEATMAP (com busca e agrupamento)
// ======================================================

function renderizarHeatmap(){

    const termoBusca = buscaAlunoTurma.value.trim().toLowerCase();

    const filtrados = dadosAlunosHeatmap.filter(d=>{

        if(!termoBusca){
            return true;
        }

        const alvos = [

            d.aluno.nome || "",
            d.aluno.codigoSAFE || "",
            ...d.celulas.map(c => c.texto)

        ].join(" ").toLowerCase();

        return alvos.includes(termoBusca);

    });

    const cabecalho = `

        <tr>
            <th>Aluno</th>
            <th>SAFE-ID</th>
            <th>SAFE Score</th>
            ${TESTES_CONFIG.map(c => `<th>${c.titulo}</th>`).join("")}
            <th>Evolução</th>
        </tr>

    `;

    function linhaAluno(dadosAluno){

        const faixa = classificarSafeScore(dadosAluno.nota);

        const celulasHtml = dadosAluno.celulas.map(c => `

            <td style="background:${c.cor}; color:${c.corTexto}; text-align:center; font-weight:700; font-size:12.5px;" title="${c.titulo}: ${c.texto}">
                ${c.texto === "-" ? "-" : (c.texto.length > 12 ? c.texto.slice(0,10) + "…" : c.texto)}
            </td>

        `).join("");

        const temHistorico = dadosAluno.avaliado;

        return `

            <tr>
                <td>${dadosAluno.aluno.nome}</td>
                <td>${dadosAluno.aluno.codigoSAFE || "-"}</td>
                <td style="font-weight:800; color:${faixa?.cor || "#94a3b8"}">${dadosAluno.nota !== null ? `${Math.round(dadosAluno.nota)} ${faixa.emoji}` : "-"}</td>
                ${celulasHtml}
                <td>${temHistorico ? `<button class="btn-secondary" style="padding:6px 12px; font-size:12.5px;" onclick="window.abrirGraficoEvolucao(${dadosAluno.indicePopup})">Ver</button>` : "-"}</td>
            </tr>

        `;

    }

    let corpoHtml = "";

    if(agrupamentoAtivo){

        corpoHtml = FAIXAS_SAFE_SCORE.map(faixa=>{

            const doGrupo = filtrados.filter(d => classificarSafeScore(d.nota)?.label === faixa.label);

            if(doGrupo.length === 0){

                return "";

            }

            return `

                <tr><td colspan="${4 + TESTES_CONFIG.length}" style="background:${faixa.corFundo}; font-weight:800; color:${faixa.cor};">${faixa.emoji} Grupo ${faixa.label} (${doGrupo.length})</td></tr>
                ${doGrupo.map(linhaAluno).join("")}

            `;

        }).join("");

        const semAvaliacao = filtrados.filter(d => !d.avaliado);

        if(semAvaliacao.length > 0){

            corpoHtml += `

                <tr><td colspan="${4 + TESTES_CONFIG.length}" style="background:#F1F5F9; font-weight:800; color:#64748b;">Sem avaliação (${semAvaliacao.length})</td></tr>
                ${semAvaliacao.map(linhaAluno).join("")}

            `;

        }

    }else{

        corpoHtml = filtrados.map(linhaAluno).join("");

    }

    areaHeatmapTurma.innerHTML = `

        <table class="table">
            <thead>${cabecalho}</thead>
            <tbody>${corpoHtml || `<tr><td colspan="${4 + TESTES_CONFIG.length}" style="text-align:center; color:#94a3b8;">Nenhum aluno encontrado.</td></tr>`}</tbody>
        </table>

    `;

}

// ======================================================
// POP-UP: GRÁFICO DE EVOLUÇÃO DO ALUNO
// ======================================================

window.abrirGraficoEvolucao = function(indiceAluno){

    const dados = historicoParaPopup[indiceAluno];

    if(!dados){
        return;
    }

    document.getElementById("tituloModalEvolucao").textContent = `Evolução — ${dados.nome}`;

    document.getElementById("legendaModalEvolucao").innerHTML = dados.historico

        .filter(t => t.pontos.length > 0)

        .map(t => `

            <span class="legenda-item">
                <span class="legenda-cor" style="background:${t.cor}"></span>
                ${t.titulo}
            </span>

        `).join("") || "<span style='color:#94a3b8; font-size:13px;'>Nenhum teste registrado ainda.</span>";

    document.getElementById("corpoModalEvolucao").innerHTML = gerarSparklineEvolucao(dados.historico, 520, 220);

    document.getElementById("modalEvolucaoTurma").classList.add("show");

};

// ======================================================
// GRÁFICO DE EVOLUÇÃO (mini SVG, uma linha por teste)
// ======================================================

function gerarSparklineEvolucao(historicoPorTeste, largura = 200, altura = 50){

    const margem = largura > 300 ? 24 : 6;

    const todasAsDatas = historicoPorTeste.flatMap(t => t.pontos.map(p => p.dataMillis));

    if(todasAsDatas.length === 0){

        return `<span style="color:#94a3b8; font-size:12px;">Sem dados</span>`;

    }

    const dataMin = Math.min(...todasAsDatas);

    const dataMax = Math.max(...todasAsDatas);

    function converterX(dataMillis){

        if(dataMax === dataMin){

            return largura / 2;

        }

        return margem + ((dataMillis - dataMin) / (dataMax - dataMin)) * (largura - margem * 2);

    }

    function converterY(posicao){

        return altura - margem - (posicao / 100) * (altura - margem * 2);

    }

    const raio = largura > 300 ? 5 : 3;

    const espessura = largura > 300 ? 3 : 2;

    const elementos = historicoPorTeste.map(({ cor, pontos })=>{

        if(pontos.length === 0){

            return "";

        }

        if(pontos.length === 1){

            const x = converterX(pontos[0].dataMillis);

            const y = converterY(pontos[0].posicao);

            return `<circle cx="${x}" cy="${y}" r="${raio}" fill="${cor}"></circle>`;

        }

        const coordenadas = pontos

            .map(p => `${converterX(p.dataMillis)},${converterY(p.posicao)}`)

            .join(" ");

        const ultimo = pontos[pontos.length - 1];

        return `

            <polyline points="${coordenadas}" fill="none" stroke="${cor}" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round"></polyline>
            <circle cx="${converterX(ultimo.dataMillis)}" cy="${converterY(ultimo.posicao)}" r="${raio}" fill="${cor}"></circle>

        `;

    }).join("");

    return `

        <svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
            ${elementos}
        </svg>

    `;

}
