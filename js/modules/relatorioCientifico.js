// ======================================================
// SAFE
// Módulo: Relatório de Estatísticas
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    mostrarToast
} from "../core/utils.js";

import{
    collection,
    getDocs,
    query,
    where
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ======================================================
// CONFIGURAÇÃO DOS TESTES
// categorias: ordem fixa de exibição (mesmo que não tenha
// nenhum aluno numa categoria, ela aparece com 0%, pra
// manter os gráficos comparáveis entre escolas/turmas).
// ======================================================

const CATEGORIAS_SAUDE = ["Zona de risco à saúde","Zona saudável"];

const TESTES_CONFIG = [

    { colecao:"avaliacoes_leger", titulo:"Léger", campo:"classificacao",
      categorias:["Zona de risco à saúde","Precisa melhorar","Zona saudável"] },

    { colecao:"avaliacoes_circunferenciacintura", titulo:"Perímetro da Cintura (RCE)", campo:"classificacaoSaude",
      categorias:["Zona de risco à saúde","Zona saudável"] },

    { colecao:"avaliacoes_imc", titulo:"IMC", campo:"classificacaoSaude",
      categorias:["Zona de risco à saúde","Zona saudável"] },

    { colecao:"avaliacoes_flexibilidade", titulo:"Flexibilidade", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"],
      campoSaude:"classificacaoSaude", categoriasSaude:CATEGORIAS_SAUDE },

    { colecao:"avaliacoes_abdominal", titulo:"Resistência Muscular Localizada", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"],
      campoSaude:"classificacaoSaude", categoriasSaude:CATEGORIAS_SAUDE },

    { colecao:"avaliacoes_medicineball", titulo:"Potência de Membros Superiores", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"],
      campoSaude:"classificacaoSaude", categoriasSaude:CATEGORIAS_SAUDE },

    { colecao:"avaliacoes_saltohorizontal", titulo:"Potência de Membros Inferiores", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { colecao:"avaliacoes_agilidade", titulo:"Agilidade", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { colecao:"avaliacoes_corrida20m", titulo:"Velocidade", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"],
      campoSaude:"classificacaoSaude", categoriasSaude:CATEGORIAS_SAUDE },

    { colecao:"avaliacoes_corrida6min", titulo:"Aptidão Cardiorrespiratória", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"],
      campoSaude:"classificacaoSaude", categoriasSaude:CATEGORIAS_SAUDE }

];

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let escolas = [];

let turmas = [];

let ultimaDistribuicao = [];

let escolaRelEstat, turmaRelEstat, sexoRelEstat, alunoRelEstat, areaRelatorioEstat, tituloEstatRel, secoesEstatisticas, btnExportarPdfEstat;

function obterElementos(){

    escolaRelEstat = document.getElementById("escolaRelEstat");
    turmaRelEstat = document.getElementById("turmaRelEstat");
    sexoRelEstat = document.getElementById("sexoRelEstat");
    alunoRelEstat = document.getElementById("alunoRelEstat");
    areaRelatorioEstat = document.getElementById("areaRelatorioEstat");
    tituloEstatRel = document.getElementById("tituloEstatRel");
    secoesEstatisticas = document.getElementById("secoesEstatisticas");
    btnExportarPdfEstat = document.getElementById("btnExportarPdfEstat");

}

function configurarEventos(){

    escolaRelEstat.addEventListener("change", async () => {

        await carregarTurmasDoFiltro();

        await montarRelatorio();

    });

    turmaRelEstat.addEventListener("change", async () => {

        await carregarAlunosDoFiltro();

        await montarRelatorio();

    });

    sexoRelEstat.addEventListener("change", montarRelatorio);

    alunoRelEstat.addEventListener("change", montarRelatorio);

    btnExportarPdfEstat.addEventListener("click", () => window.print());

    document.querySelectorAll(".fechar-modal-estatisticas").forEach(botao=>{

        botao.addEventListener("click", fecharModaisEstatisticas);

    });

    document.querySelectorAll(".modal-estatisticas").forEach(modal=>{

        modal.addEventListener("click", (evento)=>{

            if(evento.target === modal){

                fecharModaisEstatisticas();

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

    escolaRelEstat.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaRelEstat.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            const escolaId = obterEscolaId();

            escolaRelEstat.innerHTML = `<option value="${escolaId}">Minha escola</option>`;

            escolaRelEstat.value = escolaId;

            escolaRelEstat.disabled = true;

            await carregarTurmasDoFiltro();

            await montarRelatorio();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

// ======================================================
// CARREGAR TURMAS DO FILTRO
// ======================================================

async function carregarTurmasDoFiltro(){

    turmas = [];

    turmaRelEstat.innerHTML = `<option value="">Todas as turmas</option>`;

    alunoRelEstat.innerHTML = `<option value="">Ver a turma toda (distribuição)</option>`;

    if(!escolaRelEstat.value){

        return;

    }

    try{

        const q = query(collection(db,"turmas"), where("escolaId","==",escolaRelEstat.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        turmas.forEach(turma=>{

            turmaRelEstat.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as turmas.", "erro");

    }

}

// ======================================================
// CARREGAR ALUNOS DO FILTRO
// ======================================================

async function carregarAlunosDoFiltro(){

    alunoRelEstat.innerHTML = `<option value="">Ver a turma toda (distribuição)</option>`;

    if(!turmaRelEstat.value){

        return;

    }

    try{

        const q = query(collection(db,"alunos"), where("turmaId","==",turmaRelEstat.value));

        const snapshot = await getDocs(q);

        const alunosDaTurma = [];

        snapshot.forEach(doc=>{

            alunosDaTurma.push({ id: doc.id, ...doc.data() });

        });

        alunosDaTurma.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        alunosDaTurma.forEach(aluno=>{

            alunoRelEstat.innerHTML += `<option value="${aluno.id}">${aluno.nome}</option>`;

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os alunos.", "erro");

    }

}

// ======================================================
// MONTAR RELATÓRIO
// ======================================================

async function montarRelatorio(){

    areaRelatorioEstat.style.display = "none";

    if(!escolaRelEstat.value){

        return;

    }

    const escolaId = escolaRelEstat.value;

    const turmaId = turmaRelEstat.value;

    const sexoFiltro = sexoRelEstat.value;

    const nomeEscola = souSuperAdmin()
        ? (escolas.find(e => e.id === escolaId)?.nome || "")
        : escolaRelEstat.options[escolaRelEstat.selectedIndex].textContent;

    const nomeTurma = turmaId ? (turmas.find(t => t.id === turmaId)?.nome || "") : "Todas as turmas";

    const rotuloSexo = sexoFiltro || "Ambos";

    // Se um aluno específico foi escolhido, troca pro modo "posição
    // individual" em vez da distribuição da turma inteira.
    if(alunoRelEstat.value){

        await montarRelatorioAluno(escolaId, nomeEscola, nomeTurma);

        return;

    }

    tituloEstatRel.textContent = `Escola: ${nomeEscola} — Turma: ${nomeTurma} — Sexo: ${rotuloSexo}`;

    secoesEstatisticas.innerHTML = "<p>Carregando...</p>";

    // Mapa alunoId -> sexo, pra filtrar as avaliações por sexo (elas não
    // gravam o sexo diretamente, só o cadastro do aluno tem isso)
    const mapaSexoPorAluno = await carregarMapaSexo(escolaId, turmaId);

    const distribuicoesPorTeste = await Promise.all(

        TESTES_CONFIG.map(config => calcularDistribuicao(config, escolaId, turmaId, sexoFiltro, mapaSexoPorAluno))

    );

    ultimaDistribuicao = distribuicoesPorTeste;

    secoesEstatisticas.innerHTML = "";

    TESTES_CONFIG.forEach((config, indice)=>{

        secoesEstatisticas.innerHTML += renderizarSecaoTeste(config, distribuicoesPorTeste[indice], indice);

    });

    areaRelatorioEstat.style.display = "block";

}

// ======================================================
// MODO ALUNO ÚNICO — barra de posição em vez de distribuição
// ======================================================

async function montarRelatorioAluno(escolaId, nomeEscola, nomeTurma){

    const nomeAluno = alunoRelEstat.options[alunoRelEstat.selectedIndex].textContent;

    tituloEstatRel.textContent = `Escola: ${nomeEscola} — Turma: ${nomeTurma} — Aluno: ${nomeAluno}`;

    secoesEstatisticas.innerHTML = "<p>Carregando...</p>";

    const resultados = await Promise.all(

        TESTES_CONFIG.map(config => buscarUltimoResultadoAlunoEstat(config, escolaId, alunoRelEstat.value))

    );

    secoesEstatisticas.innerHTML = TESTES_CONFIG

        .map((config, indice) => renderizarBarraPosicaoAluno(config, resultados[indice]))

        .join("");

    areaRelatorioEstat.style.display = "block";

}

async function buscarUltimoResultadoAlunoEstat(config, escolaId, alunoId){

    try{

        const q = query(collection(db, config.colecao), where("escolaId","==",escolaId));

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

        return registros[0] || null;

    }catch(e){

        console.error(`Erro ao buscar resultado de ${config.colecao}:`, e);

        return null;

    }

}

// Monta UMA barra com transição de cor (vermelho -> azul) e um
// marcador na posição da categoria em que o aluno se encontra.
function barraComMarcador(categorias, categoriaAtual, valorBruto){

    const cores = categorias.map((_, i) => corPorPosicao(i, categorias.length));

    const gradiente = `linear-gradient(to right, ${cores.join(",")})`;

    const indice = categorias.indexOf(categoriaAtual);

    const temMarcador = indice !== -1;

    // centraliza o marcador dentro do segmento da categoria
    const posicaoPercentual = temMarcador

        ? ((indice + 0.5) / categorias.length) * 100

        : 50;

    const rotuloMarcador = valorBruto !== undefined && valorBruto !== null ? valorBruto : categoriaAtual;

    return `

        <div class="barra-posicao-container">

            <div class="barra-posicao-trilha" style="background:${gradiente}">

                ${temMarcador ? `

                    <div class="marcador-posicao" style="left:${posicaoPercentual}%" title="${categoriaAtual}${valorBruto !== undefined && valorBruto !== null ? ` — ${valorBruto}` : ""}">
                        <span class="marcador-posicao-valor">${rotuloMarcador}</span>
                    </div>

                ` : ""}

            </div>

            <div class="barra-posicao-legendas">

                ${categorias.map(c => `<span>${c}</span>`).join("")}

            </div>

            <div class="barra-posicao-resultado">

                ${temMarcador ? `Resultado: <strong>${valorBruto !== undefined && valorBruto !== null ? valorBruto + " — " : ""}${categoriaAtual}</strong>` : "Sem avaliação registrada"}

            </div>

        </div>

    `;

}

// Pega o valor numérico principal do registro (o que faz mais sentido
// mostrar como "resultado bruto" varia de teste pra teste)
function valorBrutoDoRegistro(registro, colecao){

    if(!registro){
        return null;
    }

    const camposPorColecao = {

        avaliacoes_leger: { campo:"vo2max", sufixo:" VO₂máx" },
        avaliacoes_imc: { campo:"imc", sufixo:" IMC" },
        avaliacoes_flexibilidade: { campo:"distanciaCm", sufixo:" cm" },
        avaliacoes_abdominal: { campo:"repeticoes", sufixo:" rep." },
        avaliacoes_medicineball: { campo:"distanciaCm", sufixo:" cm" },
        avaliacoes_saltohorizontal: { campo:"distanciaCm", sufixo:" cm" },
        avaliacoes_agilidade: { campo:"tempoSegundos", sufixo:" s" },
        avaliacoes_corrida20m: { campo:"tempoSegundos", sufixo:" s" },
        avaliacoes_corrida6min: { campo:"distanciaM", sufixo:" m" }

    };

    const config = camposPorColecao[colecao];

    if(!config || registro[config.campo] === undefined || registro[config.campo] === null){
        return null;
    }

    return `${registro[config.campo]}${config.sufixo}`;

}

function renderizarBarraPosicaoAluno(config, registro){

    const categoriaDesempenho = registro ? registro[config.campo] : null;

    const valorBruto = valorBrutoDoRegistro(registro, config.colecao);

    let html = `

        <div class="card">
            <h3>${config.titulo}</h3>
            ${barraComMarcador(config.categorias, categoriaDesempenho, valorBruto)}

    `;

    if(config.campoSaude && registro){

        const categoriaSaude = registro[config.campoSaude];

        html += `

            <div style="margin-top:16px;">
                <span style="font-size:12px; color:#94a3b8; font-weight:600;">SAÚDE</span>
                ${barraComMarcador(config.categoriasSaude, categoriaSaude, valorBruto)}
            </div>

        `;

    }

    html += `</div>`;

    return html;

}

// ======================================================
// MAPA alunoId -> sexo (escopado pela escola ou pela turma,
// se uma turma específica estiver selecionada)
// ======================================================

async function carregarMapaSexo(escolaId, turmaId){

    const mapa = new Map();

    try{

        const q = query(collection(db,"alunos"), where("escolaId","==",escolaId));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            const dados = doc.data();

            if(turmaId && dados.turmaId !== turmaId){

                return;

            }

            mapa.set(doc.id, dados.sexo || "");

        });

    }catch(e){

        console.error("Erro ao carregar sexo dos alunos:", e);

    }

    return mapa;

}

// ======================================================
// CALCULAR DISTRIBUIÇÃO (resultado mais recente por aluno)
// ======================================================

async function calcularDistribuicao(config, escolaId, turmaId, sexoFiltro, mapaSexoPorAluno){

    const contagens = {};

    const alunosPorCategoria = {};

    config.categorias.forEach(cat => {

        contagens[cat] = 0;

        alunosPorCategoria[cat] = [];

    });

    let totalAlunos = 0;

    try{

        const q = query(collection(db, config.colecao), where("escolaId","==",escolaId));

        const snapshot = await getDocs(q);

        const registros = [];

        snapshot.forEach(doc => {

            const dados = doc.data();

            if(!turmaId || dados.turmaId === turmaId){

                registros.push(dados);

            }

        });

        // mais recente primeiro
        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

        // só o primeiro registro (mais recente) de cada aluno conta
        const jaContados = new Set();

        registros.forEach(registro=>{

            if(jaContados.has(registro.alunoId)){

                return;

            }

            // filtro de sexo: só aplica se um sexo específico foi escolhido
            if(sexoFiltro && mapaSexoPorAluno.get(registro.alunoId) !== sexoFiltro){

                return;

            }

            jaContados.add(registro.alunoId);

            const categoria = registro[config.campo];

            if(categoria && Object.prototype.hasOwnProperty.call(contagens, categoria)){

                contagens[categoria]++;

                alunosPorCategoria[categoria].push({

                    alunoId: registro.alunoId,
                    nome: registro.nome || "-",
                    registro

                });

                totalAlunos++;

            }

        });

    }catch(e){

        console.error(`Erro ao calcular distribuição de ${config.colecao}:`, e);

    }

    return { contagens, alunosPorCategoria, totalAlunos };

}

// ======================================================
// COR DA BARRA — vermelho (pior) até azul (melhor),
// passando por laranja/amarelo/verde no meio do caminho.
// ======================================================

function corPorPosicao(indice, totalCategorias){

    if(totalCategorias <= 1){

        return "hsl(210, 75%, 50%)";

    }

    const posicao = indice / (totalCategorias - 1);

    const matiz = Math.round(0 + (210 - 0) * posicao);

    return `hsl(${matiz}, 75%, 48%)`;

}

// ======================================================
// RENDERIZAR SEÇÃO DE UM TESTE
// ======================================================

function renderizarSecaoTeste(config, { contagens, totalAlunos }, indiceTeste){

    if(totalAlunos === 0){

        return `

            <div class="card">
                <h3>${config.titulo}</h3>
                <p style="color:#94a3b8">Nenhum aluno avaliado nesse teste ainda.</p>
            </div>

        `;

    }

    const barras = config.categorias.map((categoria, indiceCategoria)=>{

        const qtd = contagens[categoria];

        const percentual = totalAlunos > 0 ? Math.round((qtd / totalAlunos) * 100) : 0;

        const cor = corPorPosicao(indiceCategoria, config.categorias.length);

        return `

            <div class="linha-barra ${qtd > 0 ? "linha-barra-clicavel" : ""}"
                 ${qtd > 0 ? `onclick="window.abrirAlunosNivel(${indiceTeste}, '${categoria.replace(/'/g,"\\'")}')"` : ""}>
                <span class="rotulo-barra">${categoria}</span>
                <div class="trilha-barra">
                    <div class="preenchimento-barra" style="width:${percentual}%; background:${cor};"></div>
                </div>
                <span class="valor-barra">${qtd} aluno(s) (${percentual}%)</span>
            </div>

        `;

    }).join("");

    return `

        <div class="card">
            <h3>${config.titulo} <span style="font-weight:400; color:#94a3b8; font-size:14px">— ${totalAlunos} aluno(s) avaliado(s)</span></h3>
            ${barras}
        </div>

    `;

}

// ======================================================
// POP-UP 1: ALUNOS DE UM NÍVEL
// ======================================================

window.abrirAlunosNivel = function(indiceTeste, categoria){

    const config = TESTES_CONFIG[indiceTeste];

    const distribuicao = ultimaDistribuicao[indiceTeste];

    if(!config || !distribuicao){

        return;

    }

    const alunosDoNivel = distribuicao.alunosPorCategoria[categoria] || [];

    const modal = document.getElementById("modalAlunosNivel");

    document.getElementById("tituloModalAlunosNivel").textContent = `${config.titulo} — ${categoria}`;

    document.getElementById("subtituloModalAlunosNivel").textContent =

        `${alunosDoNivel.length} aluno(s). Clique num nome pra ver a avaliação completa.`;

    document.getElementById("listaModalAlunosNivel").innerHTML = alunosDoNivel

        .map((a, indiceAluno) => `

            <li onclick="window.abrirDetalheAvaliacao(${indiceTeste}, '${categoria.replace(/'/g,"\\'")}', ${indiceAluno})">
                ${a.nome}
            </li>

        `).join("") || "<li style='cursor:default'>Nenhum aluno.</li>";

    modal.classList.add("show");

};

// ======================================================
// POP-UP 2: DETALHE DA AVALIAÇÃO DE UM ALUNO
// ======================================================

window.abrirDetalheAvaliacao = function(indiceTeste, categoria, indiceAluno){

    const config = TESTES_CONFIG[indiceTeste];

    const distribuicao = ultimaDistribuicao[indiceTeste];

    const aluno = distribuicao?.alunosPorCategoria[categoria]?.[indiceAluno];

    if(!aluno){

        return;

    }

    const registro = aluno.registro;

    const data = registro.dataTeste ? registro.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

    // Mostra todo campo do registro que pareça relevante (ignora os
    // campos de controle/vínculo, que não interessam nessa tela)
    const camposIgnorados = ["alunoId","nome","codigoSAFE","turmaId","escolaId","professorId","origem","dataTeste","criadoEm","atualizadoEm"];

    const linhasDetalhe = Object.entries(registro)

        .filter(([chave]) => !camposIgnorados.includes(chave))

        .map(([chave, valor]) => `

            <div class="linha-resultado">
                <span>${chave}</span>
                <span>${valor ?? "-"}</span>
            </div>

        `).join("");

    document.getElementById("tituloModalDetalheAvaliacao").textContent = `${aluno.nome} — ${config.titulo}`;

    document.getElementById("subtituloModalDetalheAvaliacao").textContent = `Avaliação de ${data}`;

    document.getElementById("corpoModalDetalheAvaliacao").innerHTML = linhasDetalhe;

    document.getElementById("modalDetalheAvaliacao").classList.add("show");

};

function fecharModaisEstatisticas(){

    document.getElementById("modalAlunosNivel")?.classList.remove("show");

    document.getElementById("modalDetalheAvaliacao")?.classList.remove("show");

}
