// ======================================================
// SAFE
// Módulo: Dashboard da Escola
//
// Reformulado pra seguir o princípio de "baixa carga
// cognitiva": cards e rankings primeiro, tabela detalhada
// só quando o usuário pedir. Usa o sistema central do SAFE
// Score (js/core/safeScore.js) pras 4 faixas de cor.
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

const CATEGORIAS_IMC = ["Zona de risco à saúde","Zona saudável"];

const TESTES_CONFIG = [
    { colecao:"avaliacoes_circunferenciacintura", titulo:"Perímetro da Cintura (RCE)", campo:"classificacaoSaude", categorias:CATEGORIAS_IMC },
    { colecao:"avaliacoes_imc", titulo:"IMC", campo:"classificacaoSaude", categorias:CATEGORIAS_IMC },
    { colecao:"avaliacoes_flexibilidade", titulo:"Flexibilidade", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO },
    { colecao:"avaliacoes_abdominal", titulo:"Resistência Muscular", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO },
    { colecao:"avaliacoes_medicineball", titulo:"Potência Superior", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO },
    { colecao:"avaliacoes_saltohorizontal", titulo:"Potência Inferior", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO },
    { colecao:"avaliacoes_agilidade", titulo:"Agilidade", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO },
    { colecao:"avaliacoes_corrida20m", titulo:"Velocidade", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO },
    { colecao:"avaliacoes_corrida6min", titulo:"Aptidão Cardiorrespiratória", campo:"classificacaoDesempenho", categorias:CATEGORIAS_DESEMPENHO }
];

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let escolas = [];
let turmas = [];
let alunos = [];

let dadosPorTurmaParaGrafico = [];
let dadosClassificacaoParaPopup = [];

let dadosTestesParaPopup = [];
let dadosCoberturaParaPopup = [];

let escolaRelEscola, areaRelatorioEscola, tituloEscolaRel, btnExportarPdfEscola;
let cardsResumoEscola, rankingTurmasEscola, rankingTestesEscola, distribuicaoGeralEscola;
let btnToggleDetalhesEscola, areaDetalhesEscola, cabecalhoEscolaRel, corpoEscolaRel;

function obterElementos(){

    escolaRelEscola = document.getElementById("escolaRelEscola");
    areaRelatorioEscola = document.getElementById("areaRelatorioEscola");
    tituloEscolaRel = document.getElementById("tituloEscolaRel");
    btnExportarPdfEscola = document.getElementById("btnExportarPdfEscola");
    cardsResumoEscola = document.getElementById("cardsResumoEscola");
    rankingTurmasEscola = document.getElementById("rankingTurmasEscola");
    rankingTestesEscola = document.getElementById("rankingTestesEscola");
    distribuicaoGeralEscola = document.getElementById("distribuicaoGeralEscola");
    btnToggleDetalhesEscola = document.getElementById("btnToggleDetalhesEscola");
    areaDetalhesEscola = document.getElementById("areaDetalhesEscola");
    cabecalhoEscolaRel = document.getElementById("cabecalhoEscolaRel");
    corpoEscolaRel = document.getElementById("corpoEscolaRel");

}

function configurarEventos(){

    escolaRelEscola.addEventListener("change", montarRelatorio);

    btnExportarPdfEscola.addEventListener("click", () => window.print());

    btnToggleDetalhesEscola.addEventListener("click", () => {

        const aberto = areaDetalhesEscola.style.display !== "none";

        areaDetalhesEscola.style.display = aberto ? "none" : "block";

        btnToggleDetalhesEscola.textContent = aberto

            ? "Ver tabela detalhada por turma e teste ▾"

            : "Esconder tabela detalhada ▴";

    });

    // Fechamento dos 3 pop-ups
    [

        ["fechar-modal-turma-escola", "modalTurmaEscola"],
        ["fechar-modal-ranking-turma", "modalRankingTurma"],
        ["fechar-modal-classificacao-escola", "modalClassificacaoEscola"],
        ["fechar-modal-teste-escola", "modalTesteEscola"]

    ].forEach(([classeBotao, idModal])=>{

        document.querySelectorAll(`.${classeBotao}`).forEach(botao=>{

            botao.addEventListener("click", () => {

                document.getElementById(idModal)?.classList.remove("show");

            });

        });

        const modal = document.getElementById(idModal);

        modal?.addEventListener("click", (evento)=>{

            if(evento.target === modal){

                modal.classList.remove("show");

            }

        });

    });

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

}

// ======================================================
// CARREGAR ESCOLAS
// ======================================================

async function carregarEscolas(){

    escolas = [];

    escolaRelEscola.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaRelEscola.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            const escolaId = obterEscolaId();

            escolaRelEscola.innerHTML = `<option value="${escolaId}">Minha escola</option>`;

            escolaRelEscola.value = escolaId;

            escolaRelEscola.disabled = true;

            await montarRelatorio();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

// ======================================================
// MONTAR RELATÓRIO (ponto de entrada principal)
// ======================================================

async function montarRelatorio(){

    areaRelatorioEscola.style.display = "none";

    if(!escolaRelEscola.value){

        return;

    }

    const escolaId = escolaRelEscola.value;

    const nomeEscolaSelecionada = souSuperAdmin()
        ? (escolas.find(e => e.id === escolaId)?.nome || "")
        : escolaRelEscola.options[escolaRelEscola.selectedIndex].textContent;

    tituloEscolaRel.textContent = nomeEscolaSelecionada;

    cardsResumoEscola.innerHTML = `<div class="card"><p style="color:#94a3b8">Carregando...</p></div>`;

    rankingTurmasEscola.innerHTML = "";

    rankingTestesEscola.innerHTML = "";

    distribuicaoGeralEscola.innerHTML = "";

    areaRelatorioEscola.style.display = "block";

    // 1) Turmas da escola
    turmas = [];

    try{

        const qTurmas = query(collection(db,"turmas"), where("escolaId","==",escolaId));

        const snapTurmas = await getDocs(qTurmas);

        snapTurmas.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

        return;

    }

    if(turmas.length === 0){

        cardsResumoEscola.innerHTML = `<div class="card"><p>Nenhuma turma cadastrada nessa escola.</p></div>`;

        return;

    }

    // 2) Alunos da escola
    alunos = await buscarTodosAlunosDaEscola(escolaId);

    // 3) Contagem de aplicação de testes (cobertura), pra cada turma e teste
    const contagensPorTeste = await Promise.all(

        TESTES_CONFIG.map(config => contarAvaliacoesPorTurma(config, escolaId))

    );

    // 4) Desempenho (SAFE Score) — por aluno, por turma, por teste
    const { porTurma, porAlunoFlat, porTeste } = await calcularDesempenhoCompleto(escolaId, turmas, alunos);

    dadosPorTurmaParaGrafico = porTurma;

    // 5) Monta tudo
    renderizarCardsResumo(porAlunoFlat, contagensPorTeste);

    renderizarRankingTurmas(porTurma);

    renderizarRankingTestes(porTeste);

    dadosClassificacaoParaPopup = agruparPorFaixaSafeScore(porAlunoFlat);

    renderizarDistribuicaoGeral(dadosClassificacaoParaPopup, porAlunoFlat.length);

    renderizarTabelaDetalhada(contagensPorTeste);

}

// ======================================================
// BUSCAR ALUNOS DA ESCOLA
// ======================================================

async function buscarTodosAlunosDaEscola(escolaId){

    const lista = [];

    try{

        const q = query(collection(db,"alunos"), where("escolaId","==",escolaId));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            lista.push({ id: doc.id, ...doc.data() });

        });

    }catch(e){

        console.error("Erro ao buscar alunos da escola:", e);

    }

    return lista;

}

// ======================================================
// CONTAR AVALIAÇÕES POR TURMA (cobertura)
// ======================================================

async function contarAvaliacoesPorTurma(config, escolaId){

    const mapa = new Map();

    try{

        const q = query(collection(db, config.colecao), where("escolaId","==",escolaId));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            const avaliacao = doc.data();

            mapa.set(avaliacao.turmaId, (mapa.get(avaliacao.turmaId) || 0) + 1);

        });

    }catch(e){

        console.error(`Erro ao contar ${config.colecao}:`, e);

    }

    return mapa;

}

// ======================================================
// CALCULAR DESEMPENHO COMPLETO (SAFE Score)
// Pra cada teste, pega o resultado mais recente de cada
// aluno e converte pra uma posição de 0 (pior) a 100
// (melhor). Devolve:
//  - porTurma: nota média de cada turma + ranking de alunos
//  - porAlunoFlat: nota de cada aluno (com nome da turma)
//  - porTeste: % de alunos em risco em cada teste
// ======================================================

async function calcularDesempenhoCompleto(escolaId, listaTurmas, listaAlunos){

    const posicoesPorAluno = new Map(); // alunoId -> [posições]

    const posicoesPorTeste = TESTES_CONFIG.map(() => []); // um array por teste

    const posicaoPorAlunoPorTeste = TESTES_CONFIG.map(() => new Map()); // alunoId -> posição, por teste

    await Promise.all(TESTES_CONFIG.map(async (config, indiceConfig)=>{

        try{

            const q = query(collection(db, config.colecao), where("escolaId","==",escolaId));

            const snapshot = await getDocs(q);

            const registrosPorAluno = new Map();

            snapshot.forEach(doc=>{

                const dados = doc.data();

                if(!registrosPorAluno.has(dados.alunoId)){

                    registrosPorAluno.set(dados.alunoId, []);

                }

                registrosPorAluno.get(dados.alunoId).push(dados);

            });

            registrosPorAluno.forEach((registros, alunoId)=>{

                registros.sort((a,b)=>{

                    const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

                    const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

                    return dataB - dataA;

                });

                const maisRecente = registros[0];

                const categoria = maisRecente[config.campo];

                const indiceCategoria = config.categorias.indexOf(categoria);

                if(indiceCategoria === -1){

                    return;

                }

                const posicao = config.categorias.length > 1

                    ? (indiceCategoria / (config.categorias.length - 1)) * 100

                    : 50;

                if(!posicoesPorAluno.has(alunoId)){

                    posicoesPorAluno.set(alunoId, []);

                }

                posicoesPorAluno.get(alunoId).push(posicao);

                posicoesPorTeste[indiceConfig].push(posicao);

                posicaoPorAlunoPorTeste[indiceConfig].set(alunoId, posicao);

            });

        }catch(e){

            console.error(`Erro ao calcular desempenho de ${config.colecao}:`, e);

        }

    }));

    // nota de cada aluno = média das posições dele
    const notaPorAluno = new Map();

    posicoesPorAluno.forEach((posicoes, alunoId)=>{

        const media = posicoes.reduce((soma, p) => soma + p, 0) / posicoes.length;

        notaPorAluno.set(alunoId, media);

    });

    // agrupa alunos (com nota) por turma
    const porTurma = listaTurmas.map(turma=>{

        const alunosDaTurma = listaAlunos.filter(a => a.turmaId === turma.id);

        const rankingAlunos = alunosDaTurma

            .filter(a => notaPorAluno.has(a.id))

            .map(a => ({ nome: a.nome, nota: notaPorAluno.get(a.id) }))

            .sort((a,b) => b.nota - a.nota);

        const notaTurma = rankingAlunos.length > 0

            ? rankingAlunos.reduce((soma, a) => soma + a.nota, 0) / rankingAlunos.length

            : null;

        return {

            nome: turma.nome,
            notaTurma,
            alunosAvaliados: rankingAlunos.length,
            totalAlunos: alunosDaTurma.length,
            ranking: rankingAlunos

        };

    });

    // lista plana de alunos (pra distribuição geral da escola)
    const porAlunoFlat = listaAlunos

        .filter(a => notaPorAluno.has(a.id))

        .map(a => ({

            nome: a.nome,
            turmaNome: (listaTurmas.find(t => t.id === a.turmaId) || {}).nome || "-",
            nota: notaPorAluno.get(a.id)

        }));

    // % de alunos em risco (SAFE Score <= 25) em cada teste, e a
    // quebra por turma (pro pop-up de detalhe do teste)
    const porTeste = TESTES_CONFIG.map((config, indice) => {

        const posicoes = posicoesPorTeste[indice];

        if(posicoes.length === 0){

            return { titulo: config.titulo, percentualRisco: null, avaliados: 0, turmas: [] };

        }

        const emRisco = posicoes.filter(p => classificarSafeScore(p)?.label === "Risco").length;

        const mapaPosicoes = posicaoPorAlunoPorTeste[indice];

        const turmasComDados = listaTurmas.map(turma=>{

            const alunosDaTurma = listaAlunos.filter(a => a.turmaId === turma.id && mapaPosicoes.has(a.id));

            if(alunosDaTurma.length === 0){

                return null;

            }

            const emRiscoNaTurma = alunosDaTurma.filter(a => classificarSafeScore(mapaPosicoes.get(a.id))?.label === "Risco");

            return {

                nomeTurma: turma.nome,
                percentualRisco: Math.round((emRiscoNaTurma.length / alunosDaTurma.length) * 100),
                avaliados: alunosDaTurma.length,
                emRisco: emRiscoNaTurma.length

            };

        }).filter(Boolean).sort((a,b) => b.percentualRisco - a.percentualRisco);

        return {

            titulo: config.titulo,
            percentualRisco: Math.round((emRisco / posicoes.length) * 100),
            avaliados: posicoes.length,
            turmas: turmasComDados

        };

    });

    return { porTurma, porAlunoFlat, porTeste };

}

// ======================================================
// RENDERIZAR: CARDS RESUMO
// ======================================================

function renderizarCardsResumo(porAlunoFlat, contagensPorTeste){

    const totalAlunos = alunos.length;

    const totalTurmas = turmas.length;

    // Cobertura: de todos os pares possíveis (aluno x teste), quantos
    // já têm pelo menos 1 avaliação registrada
    let paresComAvaliacao = 0;

    const totalParesPossiveis = totalAlunos * TESTES_CONFIG.length;

    // (Aproximação por turma, que é o dado que já temos: soma das
    // avaliações aplicadas / total possível. Não distingue "aluno
    // repetiu o teste 2x" de "2 alunos diferentes fizeram 1x cada",
    // mas dá uma cobertura operacional razoável e rápida de calcular.)
    contagensPorTeste.forEach(mapaContagem=>{

        mapaContagem.forEach(qtd => { paresComAvaliacao += qtd; });

    });

    const cobertura = totalParesPossiveis > 0

        ? Math.min(100, Math.round((paresComAvaliacao / totalParesPossiveis) * 100))

        : 0;

    const mediaGeral = porAlunoFlat.length > 0

        ? porAlunoFlat.reduce((soma, a) => soma + a.nota, 0) / porAlunoFlat.length

        : null;

    const percentualRisco = porAlunoFlat.length > 0

        ? Math.round((porAlunoFlat.filter(a => classificarSafeScore(a.nota)?.label === "Risco").length / porAlunoFlat.length) * 100)

        : 0;

    const percentualSaudavel = porAlunoFlat.length > 0

        ? Math.round((porAlunoFlat.filter(a => ["Saudável","Excelência"].includes(classificarSafeScore(a.nota)?.label)).length / porAlunoFlat.length) * 100)

        : 0;

    const faixaMedia = classificarSafeScore(mediaGeral);

    cardsResumoEscola.innerHTML = `

        <div class="card"><h3>Turmas</h3><h1>${totalTurmas}</h1></div>
        <div class="card"><h3>Alunos</h3><h1>${totalAlunos}</h1></div>
        <div class="card"><h3>Cobertura</h3><h1>${cobertura}%</h1></div>
        <div class="card"><h3>SAFE Score Médio</h3><h1 style="color:${faixaMedia?.cor || "inherit"}">${mediaGeral !== null ? Math.round(mediaGeral) : "-"}</h1></div>
        <div class="card"><h3>% em Risco</h3><h1 style="color:#DC2626">${percentualRisco}%</h1></div>
        <div class="card"><h3>% Saudável+</h3><h1 style="color:#16A34A">${percentualSaudavel}%</h1></div>

    `;

}

// ======================================================
// RENDERIZAR: RANKING DE TURMAS
// ======================================================

function renderizarRankingTurmas(porTurma){

    const comNota = porTurma.filter(t => t.notaTurma !== null).sort((a,b) => a.notaTurma - b.notaTurma);

    const semNota = porTurma.filter(t => t.notaTurma === null);

    if(comNota.length === 0 && semNota.length === 0){

        rankingTurmasEscola.innerHTML = `<p style="color:#94a3b8">Nenhuma turma com avaliação ainda.</p>`;

        return;

    }

    const linhasComNota = comNota.map(turma=>{

        const indiceOriginal = porTurma.indexOf(turma);

        const faixa = classificarSafeScore(turma.notaTurma);

        return `

            <div class="linha-ranking" onclick="window.abrirRankingTurma(${indiceOriginal})">
                <span class="linha-ranking-nome">${turma.nome}</span>
                <span class="linha-ranking-score" style="color:${faixa.cor}">${Math.round(turma.notaTurma)} ${faixa.emoji} ${faixa.label}</span>
            </div>

        `;

    }).join("");

    const linhasSemNota = semNota.map(turma => `

        <div class="linha-ranking" style="opacity:.5;">
            <span class="linha-ranking-nome">${turma.nome}</span>
            <span class="linha-ranking-score">Sem avaliação</span>
        </div>

    `).join("");

    rankingTurmasEscola.innerHTML = linhasComNota + linhasSemNota;

}

// ======================================================
// RENDERIZAR: RANKING DE TESTES (maior incidência de risco)
// ======================================================

function renderizarRankingTestes(porTeste){

    const comDados = porTeste.filter(t => t.percentualRisco !== null).sort((a,b) => b.percentualRisco - a.percentualRisco);

    dadosTestesParaPopup = comDados;

    if(comDados.length === 0){

        rankingTestesEscola.innerHTML = `<p style="color:#94a3b8">Nenhum dado suficiente ainda.</p>`;

        return;

    }

    rankingTestesEscola.innerHTML = comDados.map((teste, posicao) => `

        <div class="linha-ranking" onclick="window.abrirDetalheTesteEscola(${posicao})">
            <span class="linha-ranking-nome">${posicao + 1}º — ${teste.titulo}</span>
            <span class="linha-ranking-score" style="color:${teste.percentualRisco >= 25 ? "#DC2626" : "#64748b"}">${teste.percentualRisco}% em risco</span>
        </div>

    `).join("");

}

window.abrirDetalheTesteEscola = function(indice){

    const teste = dadosTestesParaPopup[indice];

    if(!teste){
        return;
    }

    document.getElementById("tituloModalTesteEscola").textContent = teste.titulo;

    document.getElementById("subtituloModalTesteEscola").textContent =

        `${teste.percentualRisco}% em risco no total (${teste.avaliados} aluno(s) avaliado(s)) — turmas do pior pro melhor`;

    document.getElementById("corpoModalTesteEscola").innerHTML = teste.turmas

        .map(t => `

            <div class="linha-resultado">
                <span>${t.nomeTurma} <span style="color:#94a3b8; font-size:12px;">— ${t.emRisco} de ${t.avaliados} em risco</span></span>
                <span style="font-weight:700; color:${t.percentualRisco >= 25 ? "#DC2626" : "#64748b"}">${t.percentualRisco}%</span>
            </div>

        `).join("") || "<p style='color:#94a3b8'>Nenhuma turma com dado suficiente.</p>";

    document.getElementById("modalTesteEscola").classList.add("show");

};

// ======================================================
// RENDERIZAR: DISTRIBUIÇÃO GERAL (4 faixas)
// ======================================================

function agruparPorFaixaSafeScore(porAlunoFlat){

    return FAIXAS_SAFE_SCORE.map((faixa, indice) => ({

        ...faixa,

        alunos: porAlunoFlat

            .filter(a => classificarSafeScore(a.nota)?.label === faixa.label)

            .sort((a,b) => b.nota - a.nota)

    }));

}

function renderizarDistribuicaoGeral(dadosClassificacao, totalAlunos){

    if(totalAlunos === 0){

        distribuicaoGeralEscola.innerHTML = `<p style="color:#94a3b8">Nenhum aluno com avaliação suficiente ainda.</p>`;

        return;

    }

    distribuicaoGeralEscola.innerHTML = dadosClassificacao.map((faixa, indice)=>{

        const qtd = faixa.alunos.length;

        const percentual = Math.round((qtd / totalAlunos) * 100);

        return `

            <div class="card card-distribuicao" style="border-top:4px solid ${faixa.cor}; background:${faixa.corFundo}22;">

                <div style="font-size:26px;">${faixa.emoji}</div>
                <h3 style="color:${faixa.cor}">${faixa.label}</h3>
                <h1 style="color:${faixa.cor}">${qtd}</h1>
                <p style="color:#64748b; margin:4px 0 12px;">${percentual}% dos alunos</p>

                ${qtd > 0 ? `<button class="btn-secondary" style="width:100%;" onclick="window.abrirClassificacaoEscola(${indice})">Ver alunos</button>` : ""}

            </div>

        `;

    }).join("");

}

window.abrirClassificacaoEscola = function(indice){

    const faixa = dadosClassificacaoParaPopup[indice];

    if(!faixa){
        return;
    }

    document.getElementById("tituloModalClassificacaoEscola").textContent = `${faixa.emoji} ${faixa.label}`;

    document.getElementById("subtituloModalClassificacaoEscola").textContent =

        `${faixa.alunos.length} aluno(s) nessa faixa`;

    document.getElementById("corpoModalClassificacaoEscola").innerHTML = faixa.alunos

        .map(a => `

            <div class="linha-resultado">
                <span>${a.nome} <span style="color:#94a3b8; font-size:12px;">— ${a.turmaNome}</span></span>
                <span style="font-weight:700;">${Math.round(a.nota)}/100</span>
            </div>

        `).join("") || "<p style='color:#94a3b8'>Nenhum aluno nessa faixa.</p>";

    document.getElementById("modalClassificacaoEscola").classList.add("show");

};

window.abrirRankingTurma = function(indice){

    const turma = dadosPorTurmaParaGrafico[indice];

    if(!turma || turma.notaTurma === null){
        return;
    }

    const faixa = classificarSafeScore(turma.notaTurma);

    document.getElementById("tituloModalRankingTurma").textContent = `${turma.nome} — Ranking de Desempenho`;

    document.getElementById("subtituloModalRankingTurma").textContent =

        `SAFE Score médio: ${Math.round(turma.notaTurma)} ${faixa.emoji} ${faixa.label} — ${turma.alunosAvaliados} de ${turma.totalAlunos} aluno(s) com avaliação`;

    document.getElementById("corpoModalRankingTurma").innerHTML = turma.ranking

        .map((aluno, posicao) => {

            const faixaAluno = classificarSafeScore(aluno.nota);

            return `

                <div class="linha-resultado">
                    <span>${posicao + 1}º — ${aluno.nome}</span>
                    <span style="color:${faixaAluno.cor}; font-weight:700;">${Math.round(aluno.nota)} ${faixaAluno.emoji}</span>
                </div>

            `;

        }).join("") || "<p style='color:#94a3b8'>Nenhum aluno avaliado ainda.</p>";

    document.getElementById("modalRankingTurma").classList.add("show");

};

// ======================================================
// RENDERIZAR: TABELA DETALHADA (sob demanda)
// ======================================================

function renderizarTabelaDetalhada(contagensPorTeste){

    cabecalhoEscolaRel.innerHTML = `<th>Turma</th><th>Nº Alunos</th>` +
        TESTES_CONFIG.map(c => `<th>${c.titulo}</th>`).join("");

    corpoEscolaRel.innerHTML = "";

    const totaisGerais = TESTES_CONFIG.map(() => 0);

    let totalAlunosGeral = 0;

    dadosCoberturaParaPopup = [];

    turmas.forEach(turma=>{

        const numAlunos = alunos.filter(a => a.turmaId === turma.id).length;

        totalAlunosGeral += numAlunos;

        let totalDaTurma = 0;

        const detalheTurma = [];

        const celulas = contagensPorTeste.map((mapaContagem, indice) => {

            const qtd = mapaContagem.get(turma.id) || 0;

            totaisGerais[indice] += qtd;

            totalDaTurma += qtd;

            detalheTurma.push({ titulo: TESTES_CONFIG[indice].titulo, qtd });

            return `<td>${qtd}</td>`;

        }).join("");

        dadosCoberturaParaPopup.push({ nome: turma.nome, numAlunos, total: totalDaTurma, detalhe: detalheTurma });

        const indiceCobertura = dadosCoberturaParaPopup.length - 1;

        corpoEscolaRel.innerHTML += `<tr style="cursor:pointer" onclick="window.abrirDetalheTurmaEscola(${indiceCobertura})"><td>${turma.nome}</td><td>${numAlunos}</td>${celulas}</tr>`;

    });

    const celulasTotais = totaisGerais.map(qtd => `<td><strong>${qtd}</strong></td>`).join("");

    corpoEscolaRel.innerHTML += `

        <tr style="background:#f8fafc">
            <td><strong>Total da escola</strong></td>
            <td><strong>${totalAlunosGeral}</strong></td>
            ${celulasTotais}
        </tr>

    `;

}

window.abrirDetalheTurmaEscola = function(indice){

    const turma = dadosCoberturaParaPopup[indice];

    if(!turma){
        return;
    }

    document.getElementById("tituloModalTurmaEscola").textContent = turma.nome;

    document.getElementById("subtituloModalTurmaEscola").textContent =

        `${turma.numAlunos} aluno(s) — ${turma.total} avaliação(ões) aplicada(s) ao todo`;

    document.getElementById("corpoModalTurmaEscola").innerHTML = turma.detalhe

        .map(d => `

            <div class="linha-resultado">
                <span>${d.titulo}</span>
                <span>${d.qtd}</span>
            </div>

        `).join("");

    document.getElementById("modalTurmaEscola").classList.add("show");

};
