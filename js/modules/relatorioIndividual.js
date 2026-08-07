// ======================================================
// SAFE
// Módulo: Relatório Individual
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    mostrarToast,
    calcularIdade
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
// Cada entrada descreve como buscar e exibir o histórico
// de uma coleção de avaliação. Não usamos orderBy nas
// consultas de propósito — ordenar por dataTeste junto com
// o filtro por alunoId exigiria um índice composto por
// coleção (já vimos esse problema no Léger); em vez disso,
// ordenamos no navegador depois de buscar.
// campo/categorias/cor: usados pro SAFE Score e o gráfico
// de evolução (não mexem nas colunas da tabela detalhada).
// ======================================================

const CATEGORIAS_DESEMPENHO = ["Fraco","Razoável","Bom","Muito Bom","Excelência"];

const CATEGORIAS_IMC = ["Zona de risco à saúde","Zona saudável"];

// Léger não entra aqui — não faz parte da bateria do aluno (ver
// js/modules/leger.js, agora reaplicado só aos funcionários adultos).
const TESTES_CONFIG = [

    { colecao:"avaliacoes_circunferenciacintura", titulo:"Perímetro da Cintura (RCE)", campo:"classificacaoSaude", categorias:CATEGORIAS_IMC, cor:"#0891B2", colunas:[
        {label:"Cintura (cm)", campo:"cintura"},
        {label:"Estatura (cm)", campo:"estatura"},
        {label:"RCE", campo:"rce"},
        {label:"Classificação", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_imc", titulo:"IMC", campo:"classificacaoSaude", categorias:CATEGORIAS_IMC, cor:"#DC2626", colunas:[
        {label:"Peso (kg)", campo:"peso"},
        {label:"Estatura (cm)", campo:"estatura"},
        {label:"IMC", campo:"imc"},
        {label:"Classificação (Saúde)", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_flexibilidade", titulo:"Flexibilidade (Sentar e Alcançar)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#16A34A", colunas:[
        {label:"Distância (cm)", campo:"distanciaCm"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_abdominal", titulo:"Resistência Muscular Localizada (Abdominal)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#F59E0B", colunas:[
        {label:"Repetições", campo:"repeticoes"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_medicineball", titulo:"Potência de Membros Superiores (Medicine Ball)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#7C3AED", colunas:[
        {label:"Distância (cm)", campo:"distanciaCm"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_saltohorizontal", titulo:"Potência de Membros Inferiores (Salto Horizontal)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#DB2777", colunas:[
        {label:"Distância (cm)", campo:"distanciaCm"},
        {label:"Desempenho", campo:"classificacaoDesempenho"}
    ]},

    { colecao:"avaliacoes_agilidade", titulo:"Agilidade (Quadrado 4x4m)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#0D9488", colunas:[
        {label:"Tempo (s)", campo:"tempoSegundos"},
        {label:"Desempenho", campo:"classificacaoDesempenho"}
    ]},

    { colecao:"avaliacoes_corrida20m", titulo:"Velocidade (Corrida 20m)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#EA580C", colunas:[
        {label:"Tempo (s)", campo:"tempoSegundos"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_corrida6min", titulo:"Aptidão Cardiorrespiratória (6min)", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO, cor:"#4338CA", colunas:[
        {label:"Distância (m)", campo:"distanciaM"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]}

];

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let escolas = [];

let turmas = [];

let alunos = [];

let alunoSelecionado = null;

let turmaSelecionada = null;

let escolaRel, turmaRel, alunoRel;
let areaRelatorio, resumoIndividual, secoesTestes;
let btnToggleHistoricoIndividual, areaHistoricoIndividual;
let codigoAlunoRel, nomeAlunoRel, sexoAlunoRel, idadeAlunoRel, escolaAlunoRel, turmaAlunoRel;
let btnExportarPdf;

function obterElementos(){

    escolaRel = document.getElementById("escolaRel");
    turmaRel = document.getElementById("turmaRel");
    alunoRel = document.getElementById("alunoRel");
    areaRelatorio = document.getElementById("areaRelatorio");
    resumoIndividual = document.getElementById("resumoIndividual");
    secoesTestes = document.getElementById("secoesTestes");
    btnToggleHistoricoIndividual = document.getElementById("btnToggleHistoricoIndividual");
    areaHistoricoIndividual = document.getElementById("areaHistoricoIndividual");
    codigoAlunoRel = document.getElementById("codigoAlunoRel");
    nomeAlunoRel = document.getElementById("nomeAlunoRel");
    sexoAlunoRel = document.getElementById("sexoAlunoRel");
    idadeAlunoRel = document.getElementById("idadeAlunoRel");
    escolaAlunoRel = document.getElementById("escolaAlunoRel");
    turmaAlunoRel = document.getElementById("turmaAlunoRel");
    btnExportarPdf = document.getElementById("btnExportarPdf");

}

function configurarEventos(){

    escolaRel.addEventListener("change", carregarTurmas);

    turmaRel.addEventListener("change", carregarAlunos);

    alunoRel.addEventListener("change", selecionarAluno);

    btnExportarPdf.addEventListener("click", () => window.print());

    btnToggleHistoricoIndividual.addEventListener("click", () => {

        const aberto = areaHistoricoIndividual.style.display !== "none";

        areaHistoricoIndividual.style.display = aberto ? "none" : "block";

        btnToggleHistoricoIndividual.textContent = aberto

            ? "Ver histórico completo das avaliações ▾"

            : "Esconder histórico completo ▴";

    });

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

}

// ======================================================
// CARREGAR ESCOLAS
// super_admin vê todas; os demais só a própria (já vem
// selecionada e travada, sem precisar escolher).
// ======================================================

async function carregarEscolas(){

    escolas = [];

    escolaRel.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaRel.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            escolaRel.innerHTML = `<option value="${obterEscolaId()}">Minha escola</option>`;

            escolaRel.value = obterEscolaId();

            escolaRel.disabled = true;

            await carregarTurmas();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

// ======================================================
// CARREGAR TURMAS
// ======================================================

async function carregarTurmas(){

    turmas = [];

    turmaRel.innerHTML = `<option value="">Selecione...</option>`;

    alunoRel.innerHTML = `<option value="">Selecione...</option>`;

    areaRelatorio.style.display = "none";

    if(!escolaRel.value){

        return;

    }

    try{

        const q = query(collection(db,"turmas"), where("escolaId","==",escolaRel.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        turmas.forEach(turma=>{

            turmaRel.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

// ======================================================
// CARREGAR ALUNOS
// ======================================================

async function carregarAlunos(){

    alunos = [];

    alunoRel.innerHTML = `<option value="">Selecione...</option>`;

    areaRelatorio.style.display = "none";

    turmaSelecionada = turmas.find(t => t.id === turmaRel.value) || null;

    if(!turmaRel.value){

        return;

    }

    try{

        const q = query(collection(db,"alunos"), where("escolaId","==",escolaRel.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            const dadosAluno = { id: doc.id, ...doc.data() };

            if(dadosAluno.turmaId === turmaRel.value){

                alunos.push(dadosAluno);

            }

        });

        alunos.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        alunos.forEach(aluno=>{

            alunoRel.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os alunos.", "erro");

    }

}

// ======================================================
// SELECIONAR ALUNO — monta o relatório inteiro
// ======================================================

async function selecionarAluno(){

    alunoSelecionado = alunos.find(a => a.id === alunoRel.value) || null;

    if(!alunoSelecionado){

        areaRelatorio.style.display = "none";

        return;

    }

    codigoAlunoRel.value = alunoSelecionado.codigoSAFE || "-";
    nomeAlunoRel.value = alunoSelecionado.nome || "-";
    sexoAlunoRel.value = alunoSelecionado.sexo || "-";
    idadeAlunoRel.value = calcularIdade(alunoSelecionado.dataNascimento);
    escolaAlunoRel.value = alunoSelecionado.escola || "-";
    turmaAlunoRel.value = turmaSelecionada ? turmaSelecionada.nome : "-";

    areaRelatorio.style.display = "block";

    await montarSecoesTestes();

}

// ======================================================
// MONTAR SEÇÕES DOS TESTES
// ======================================================

async function montarSecoesTestes(){

    resumoIndividual.innerHTML = `<p style="color:#94a3b8">Carregando...</p>`;

    secoesTestes.innerHTML = "";

    const resultadosPorTeste = await Promise.all(

        TESTES_CONFIG.map(config => buscarHistoricoTeste(config))

    );

    renderizarResumoIndividual(resultadosPorTeste);

    secoesTestes.innerHTML = resultadosPorTeste

        .map(({ config, registros }) => renderizarSecaoTeste(config, registros))

        .join("");

}

// ======================================================
// RESUMO: SAFE SCORE, CLASSIFICAÇÃO, EVOLUÇÃO, RECOMENDAÇÃO
// (aparece primeiro — o histórico detalhado fica depois,
// atrás de um botão, seguindo o princípio de "informação
// rápida primeiro, detalhe só se pedir")
// ======================================================

function renderizarResumoIndividual(resultadosPorTeste){

    const posicoesMaisRecentes = []; // uma por teste (a mais recente)

    const historicoParaGrafico = []; // pro gráfico de evolução (todas as datas)

    resultadosPorTeste.forEach(({ config, registros })=>{

        const pontos = [];

        registros.forEach(registro=>{

            const categoria = registro[config.campo];

            const indice = config.categorias.indexOf(categoria);

            if(indice === -1 || !registro.dataTeste){

                return;

            }

            const posicao = config.categorias.length > 1

                ? (indice / (config.categorias.length - 1)) * 100

                : 50;

            pontos.push({ dataMillis: registro.dataTeste.toMillis(), posicao });

        });

        pontos.sort((a,b) => a.dataMillis - b.dataMillis);

        if(pontos.length > 0){

            posicoesMaisRecentes.push({ titulo: config.titulo, posicao: pontos[pontos.length - 1].posicao });

        }

        historicoParaGrafico.push({ cor: config.cor, titulo: config.titulo, pontos });

    });

    const nota = posicoesMaisRecentes.length > 0

        ? posicoesMaisRecentes.reduce((soma, p) => soma + p.posicao, 0) / posicoesMaisRecentes.length

        : null;

    const faixa = classificarSafeScore(nota);

    // legenda de cores dos testes com dado
    const legenda = historicoParaGrafico

        .filter(t => t.pontos.length > 0)

        .map(t => `<span class="legenda-item"><span class="legenda-cor" style="background:${t.cor}"></span>${t.titulo}</span>`)

        .join("") || "<span style='color:#94a3b8; font-size:13px;'>Nenhum teste registrado ainda.</span>";

    // recomendação: pior teste (menor posição) entre os já registrados
    let recomendacaoHtml = `<p style="color:#94a3b8">Sem dados suficientes ainda pra gerar recomendação.</p>`;

    if(posicoesMaisRecentes.length > 0){

        const pior = posicoesMaisRecentes.reduce((a,b) => (a.posicao < b.posicao ? a : b));

        const faixaPior = classificarSafeScore(pior.posicao);

        if(faixaPior.label === "Risco" || faixaPior.label === "Atenção"){

            recomendacaoHtml = `

                <p><strong>Ponto de maior atenção: ${pior.titulo}</strong> (${faixaPior.emoji} ${faixaPior.label}).</p>
                <p style="color:#475569; margin-top:6px;">Sugere-se priorizar esse componente físico nas próximas aulas.</p>

            `;

        }else{

            recomendacaoHtml = `<p>Nenhum ponto crítico identificado — o aluno está bem distribuído entre os testes.</p>`;

        }

    }

    resumoIndividual.innerHTML = `

        <div class="cards">
            <div class="card"><h3>SAFE Score</h3><h1 style="color:${faixa?.cor || "inherit"}">${nota !== null ? Math.round(nota) : "-"}</h1></div>
            <div class="card"><h3>Classificação Geral</h3><h1 style="color:${faixa?.cor || "inherit"}; font-size:22px;">${faixa ? `${faixa.emoji} ${faixa.label}` : "Sem avaliação"}</h1></div>
        </div>

        <div class="card">
            <h3>Evolução</h3>
            <div id="legendaEvolucaoIndividual" class="legenda-testes">${legenda}</div>
            <div style="text-align:center; margin-top:10px;">${gerarSparklineEvolucao(historicoParaGrafico, 520, 200)}</div>
        </div>

        <div class="card">
            <h3>Recomendação</h3>
            ${recomendacaoHtml}
        </div>

    `;

}

// ======================================================
// GRÁFICO DE EVOLUÇÃO (mini SVG, uma linha por teste)
// ======================================================

function gerarSparklineEvolucao(historicoPorTeste, largura = 200, altura = 50){

    const margem = largura > 300 ? 24 : 6;

    const todasAsDatas = historicoPorTeste.flatMap(t => t.pontos.map(p => p.dataMillis));

    if(todasAsDatas.length === 0){

        return `<span style="color:#94a3b8; font-size:13px;">Sem dados suficientes ainda.</span>`;

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

    return `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">${elementos}</svg>`;

}

async function buscarHistoricoTeste(config){

    try{

        const q = query(

            collection(db, config.colecao),

            where("escolaId","==",escolaRel.value)

        );

        const snapshot = await getDocs(q);

        const registros = [];

        snapshot.forEach(doc=>{

            const dados = doc.data();

            if(dados.alunoId === alunoSelecionado.id){

                registros.push(dados);

            }

        });

        // ordena por data no navegador (evita precisar de índice composto)
        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

        return { config, registros };

    }catch(e){

        console.error(`Erro ao buscar histórico de ${config.colecao}:`, e);

        return { config, registros: [] };

    }

}

function renderizarSecaoTeste(config, registros){

    if(registros.length === 0){

        return `

            <div class="card">
                <h3>${config.titulo}</h3>
                <p style="color:#94a3b8">Nenhum registro.</p>
            </div>

        `;

    }

    const cabecalho = `<th>Data</th>` + config.colunas.map(c => `<th>${c.label}</th>`).join("");

    const linhas = registros.map(registro => {

        const data = registro.dataTeste ? registro.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

        const celulas = config.colunas

            .map(c => `<td>${registro[c.campo] ?? "-"}</td>`)

            .join("");

        return `<tr><td>${data}</td>${celulas}</tr>`;

    }).join("");

    return `

        <div class="card">
            <h3>${config.titulo}</h3>
            <table class="table">
                <thead><tr>${cabecalho}</tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>

    `;

}