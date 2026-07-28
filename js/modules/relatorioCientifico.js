// ======================================================
// SAFE
// Módulo: Relatório Científico (Módulo 2)
//
// Estatística descritiva de verdade, calculada em cima dos
// dados reais do Firestore. NÃO inclui testes de hipótese
// (ANOVA, qui-quadrado, regressão) nessa versão — isso
// exigiria uma biblioteca estatística validada, que ainda
// não foi integrada ao sistema.
// ======================================================

import { db } from "../core/firebase.js";

import {
    obterEscolaId,
    souSuperAdmin,
    mostrarToast
} from "../core/utils.js";

import { calcularIdade } from "./leger.js";

import{
    collection,
    getDocs,
    query,
    where
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ======================================================
// VARIÁVEIS NUMÉRICAS ANALISADAS
// Cada uma sabe de qual coleção e campo tirar o valor.
// "idade" é calculada direto do cadastro do aluno, não vem
// de avaliação nenhuma.
// ======================================================

const VARIAVEIS_NUMERICAS = [

    { titulo:"Idade (anos)", origem:"aluno" },
    { titulo:"Circunferência da Cintura (cm)", colecao:"avaliacoes_circunferenciacintura", campo:"cintura" },
    { titulo:"Razão Cintura-Estatura (RCE)", colecao:"avaliacoes_circunferenciacintura", campo:"rce" },
    { titulo:"Peso (kg)", colecao:"avaliacoes_imc", campo:"peso" },
    { titulo:"Estatura (cm)", colecao:"avaliacoes_imc", campo:"estatura" },
    { titulo:"IMC", colecao:"avaliacoes_imc", campo:"imc" },
    { titulo:"Léger (VO₂máx)", colecao:"avaliacoes_leger", campo:"vo2max" },
    { titulo:"Flexibilidade (cm)", colecao:"avaliacoes_flexibilidade", campo:"distanciaCm" },
    { titulo:"Abdominal (repetições)", colecao:"avaliacoes_abdominal", campo:"repeticoes" },
    { titulo:"Medicine Ball (cm)", colecao:"avaliacoes_medicineball", campo:"distanciaCm" },
    { titulo:"Salto Horizontal (cm)", colecao:"avaliacoes_saltohorizontal", campo:"distanciaCm" },
    { titulo:"Agilidade (s)", colecao:"avaliacoes_agilidade", campo:"tempoSegundos" },
    { titulo:"Corrida 20m (s)", colecao:"avaliacoes_corrida20m", campo:"tempoSegundos" },
    { titulo:"Corrida 6min (m)", colecao:"avaliacoes_corrida6min", campo:"distanciaM" }

];

// Testes com classificação categórica (pra Tabela 3)
const TESTES_CATEGORICOS = [

    { titulo:"Perímetro da Cintura (RCE)", colecao:"avaliacoes_circunferenciacintura", campo:"classificacaoSaude",
      categorias:["Zona de risco à saúde","Zona saudável"] },

    { titulo:"Léger", colecao:"avaliacoes_leger", campo:"classificacao",
      categorias:["Zona de risco à saúde","Precisa melhorar","Zona saudável"] },

    { titulo:"IMC", colecao:"avaliacoes_imc", campo:"classificacaoSaude",
      categorias:["Zona de risco à saúde","Zona saudável"] },

    { titulo:"Flexibilidade", colecao:"avaliacoes_flexibilidade", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { titulo:"Resist. Muscular", colecao:"avaliacoes_abdominal", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { titulo:"Potência Superior", colecao:"avaliacoes_medicineball", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { titulo:"Potência Inferior", colecao:"avaliacoes_saltohorizontal", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { titulo:"Agilidade", colecao:"avaliacoes_agilidade", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { titulo:"Velocidade", colecao:"avaliacoes_corrida20m", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] },

    { titulo:"Apt. Cardiorresp.", colecao:"avaliacoes_corrida6min", campo:"classificacaoDesempenho",
      categorias:["Fraco","Razoável","Bom","Muito Bom","Excelência"] }

];

// ======================================================
// FUNÇÕES ESTATÍSTICAS
// ======================================================

function media(valores){

    return valores.reduce((soma, v) => soma + v, 0) / valores.length;

}

function desvioPadrao(valores, m){

    if(valores.length < 2){
        return 0;
    }

    const somaQuadrados = valores.reduce((soma, v) => soma + Math.pow(v - m, 2), 0);

    return Math.sqrt(somaQuadrados / (valores.length - 1));

}

function mediana(ordenado){

    const meio = Math.floor(ordenado.length / 2);

    return ordenado.length % 2 !== 0

        ? ordenado[meio]

        : (ordenado[meio - 1] + ordenado[meio]) / 2;

}

function moda(valores){

    const contagem = new Map();

    valores.forEach(v => contagem.set(v, (contagem.get(v) || 0) + 1));

    let maiorContagem = 0;

    contagem.forEach(c => { if(c > maiorContagem) maiorContagem = c; });

    if(maiorContagem <= 1){

        return "Amodal";

    }

    const modas = [];

    contagem.forEach((c, v) => { if(c === maiorContagem) modas.push(v); });

    return modas.sort((a,b)=>a-b).map(v => arredondar(v)).join(", ");

}

function percentil(ordenado, p){

    const indice = (p / 100) * (ordenado.length - 1);

    const baixo = Math.floor(indice);

    const alto = Math.ceil(indice);

    if(baixo === alto){

        return ordenado[baixo];

    }

    return ordenado[baixo] + (ordenado[alto] - ordenado[baixo]) * (indice - baixo);

}

function assimetria(valores, m, dp){

    const n = valores.length;

    if(n < 4 || dp === 0){
        return null;
    }

    const soma = valores.reduce((s, v) => s + Math.pow((v - m) / dp, 3), 0);

    return (n / ((n - 1) * (n - 2))) * soma;

}

function curtose(valores, m, dp){

    const n = valores.length;

    if(n < 4 || dp === 0){
        return null;
    }

    const soma = valores.reduce((s, v) => s + Math.pow((v - m) / dp, 4), 0);

    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * soma

        - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));

}

function arredondar(valor, casas = 2){

    if(valor === null || valor === undefined || isNaN(valor)){
        return "-";
    }

    return Number(valor.toFixed(casas));

}

function calcularEstatisticasDescritivas(valoresBrutos){

    const valores = valoresBrutos.filter(v => typeof v === "number" && !isNaN(v));

    if(valores.length === 0){

        return null;

    }

    const ordenado = [...valores].sort((a,b) => a - b);

    const n = valores.length;

    const m = media(valores);

    const dp = desvioPadrao(valores, m);

    const ep = n > 0 ? dp / Math.sqrt(n) : 0;

    const cv = m !== 0 ? (dp / Math.abs(m)) * 100 : 0;

    const q1 = percentil(ordenado, 25);

    const q3 = percentil(ordenado, 75);

    return {

        n,
        media: m,
        desvioPadrao: dp,
        erroPadrao: ep,
        cv,
        mediana: mediana(ordenado),
        moda: moda(valores),
        min: ordenado[0],
        max: ordenado[n - 1],
        q1,
        q3,
        iiq: q3 - q1,
        ic95min: m - 1.96 * ep,
        ic95max: m + 1.96 * ep,
        assimetria: assimetria(valores, m, dp),
        curtose: curtose(valores, m, dp)

    };

}

// ======================================================
// VARIÁVEIS / ELEMENTOS
// ======================================================

let escolas = [];

let turmas = [];

let escolaRelCientifico, turmaRelCientifico, areaRelatorioCientifico, tituloCientifico, btnExportarPdfCientifico;

let corpoCaracterizacao, corpoDescritiva, areaCategoricas, cabecalhoPorSexo, corpoPorSexo;

function obterElementos(){

    escolaRelCientifico = document.getElementById("escolaRelCientifico");
    turmaRelCientifico = document.getElementById("turmaRelCientifico");
    areaRelatorioCientifico = document.getElementById("areaRelatorioCientifico");
    tituloCientifico = document.getElementById("tituloCientifico");
    btnExportarPdfCientifico = document.getElementById("btnExportarPdfCientifico");
    corpoCaracterizacao = document.getElementById("corpoCaracterizacao");
    corpoDescritiva = document.getElementById("corpoDescritiva");
    areaCategoricas = document.getElementById("areaCategoricas");
    cabecalhoPorSexo = document.getElementById("cabecalhoPorSexo");
    corpoPorSexo = document.getElementById("corpoPorSexo");

}

function configurarEventos(){

    escolaRelCientifico.addEventListener("change", async () => {

        await carregarTurmas();

        await montarRelatorio();

    });

    turmaRelCientifico.addEventListener("change", montarRelatorio);

    btnExportarPdfCientifico.addEventListener("click", () => window.print());

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

    escolaRelCientifico.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaRelCientifico.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            const escolaId = obterEscolaId();

            escolaRelCientifico.innerHTML = `<option value="${escolaId}">Minha escola</option>`;

            escolaRelCientifico.value = escolaId;

            escolaRelCientifico.disabled = true;

            await carregarTurmas();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

async function carregarTurmas(){

    turmas = [];

    turmaRelCientifico.innerHTML = `<option value="">Todas as turmas</option>`;

    if(!escolaRelCientifico.value){

        return;

    }

    try{

        const q = query(collection(db,"turmas"), where("escolaId","==",escolaRelCientifico.value));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        turmas.forEach(turma=>{

            turmaRelCientifico.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

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

    areaRelatorioCientifico.style.display = "none";

    if(!escolaRelCientifico.value){

        return;

    }

    const escolaId = escolaRelCientifico.value;

    const turmaId = turmaRelCientifico.value;

    const nomeEscola = souSuperAdmin()
        ? (escolas.find(e => e.id === escolaId)?.nome || "")
        : escolaRelCientifico.options[escolaRelCientifico.selectedIndex].textContent;

    const nomeTurma = turmaId ? (turmas.find(t => t.id === turmaId)?.nome || "") : "Todas as turmas";

    tituloCientifico.textContent = `${nomeEscola} — ${nomeTurma}`;

    corpoCaracterizacao.innerHTML = `<tr><td>Carregando...</td></tr>`;

    areaRelatorioCientifico.style.display = "block";

    // 1) Alunos da amostra
    let alunos = [];

    try{

        const q = query(collection(db,"alunos"), where("escolaId","==",escolaId));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            const dados = { id: doc.id, ...doc.data() };

            if(!turmaId || dados.turmaId === turmaId){

                alunos.push(dados);

            }

        });

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar os alunos.", "erro");

        return;

    }

    if(alunos.length === 0){

        corpoCaracterizacao.innerHTML = `<tr><td>Nenhum aluno encontrado nessa amostra.</td></tr>`;

        corpoDescritiva.innerHTML = "";

        areaCategoricas.innerHTML = "";

        corpoPorSexo.innerHTML = "";

        return;

    }

    const idsAlunos = new Set(alunos.map(a => a.id));

    // 2) Busca os valores numéricos de cada variável (escopados pela escola,
    // filtrados por turma no navegador quando aplicável)
    const valoresPorVariavel = await buscarValoresDasVariaveis(escolaId, idsAlunos, alunos);

    // 3) Busca as classificações categóricas de cada teste
    const categoriasPorTeste = await buscarCategoriasDosTestes(escolaId, idsAlunos);

    // 4) Renderiza as 4 tabelas
    renderizarCaracterizacaoAmostra(alunos, valoresPorVariavel);

    renderizarEstatisticaDescritiva(valoresPorVariavel);

    renderizarVariaveisCategoricas(categoriasPorTeste);

    renderizarComparacaoPorSexo(alunos, valoresPorVariavel);

}

// ======================================================
// BUSCAR VALORES DAS VARIÁVEIS NUMÉRICAS
// Retorna um Map: título da variável -> [{ alunoId, valor }]
// (mais recente por aluno, quando vem de avaliação)
// ======================================================

async function buscarValoresDasVariaveis(escolaId, idsAlunos, alunos){

    const resultado = new Map();

    // Idade: não vem de avaliação, vem direto do cadastro
    const idades = alunos

        .filter(a => a.dataNascimento)

        .map(a => ({ alunoId: a.id, valor: calcularIdade(a.dataNascimento) }))

        .filter(item => typeof item.valor === "number");

    resultado.set("Idade (anos)", idades);

    // Demais variáveis: vêm de avaliação (mais recente por aluno)
    const variaveisDeAvaliacao = VARIAVEIS_NUMERICAS.filter(v => v.origem !== "aluno");

    await Promise.all(variaveisDeAvaliacao.map(async (variavel)=>{

        try{

            const q = query(collection(db, variavel.colecao), where("escolaId","==",escolaId));

            const snapshot = await getDocs(q);

            const registrosPorAluno = new Map();

            snapshot.forEach(doc=>{

                const dados = doc.data();

                if(!idsAlunos.has(dados.alunoId)){

                    return;

                }

                if(!registrosPorAluno.has(dados.alunoId)){

                    registrosPorAluno.set(dados.alunoId, []);

                }

                registrosPorAluno.get(dados.alunoId).push(dados);

            });

            const valores = [];

            registrosPorAluno.forEach((registros, alunoId)=>{

                registros.sort((a,b)=>{

                    const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

                    const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

                    return dataB - dataA;

                });

                const valor = registros[0][variavel.campo];

                if(typeof valor === "number"){

                    valores.push({ alunoId, valor });

                }

            });

            resultado.set(variavel.titulo, valores);

        }catch(e){

            console.error(`Erro ao buscar ${variavel.colecao}:`, e);

            resultado.set(variavel.titulo, []);

        }

    }));

    return resultado;

}

// ======================================================
// BUSCAR CATEGORIAS DOS TESTES (pra Tabela 3)
// ======================================================

async function buscarCategoriasDosTestes(escolaId, idsAlunos){

    const resultado = [];

    await Promise.all(TESTES_CATEGORICOS.map(async (teste)=>{

        try{

            const q = query(collection(db, teste.colecao), where("escolaId","==",escolaId));

            const snapshot = await getDocs(q);

            const registrosPorAluno = new Map();

            snapshot.forEach(doc=>{

                const dados = doc.data();

                if(!idsAlunos.has(dados.alunoId)){

                    return;

                }

                if(!registrosPorAluno.has(dados.alunoId)){

                    registrosPorAluno.set(dados.alunoId, []);

                }

                registrosPorAluno.get(dados.alunoId).push(dados);

            });

            const contagens = {};

            teste.categorias.forEach(c => contagens[c] = 0);

            let total = 0;

            registrosPorAluno.forEach(registros=>{

                registros.sort((a,b)=>{

                    const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

                    const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

                    return dataB - dataA;

                });

                const categoria = registros[0][teste.campo];

                if(categoria && Object.prototype.hasOwnProperty.call(contagens, categoria)){

                    contagens[categoria]++;

                    total++;

                }

            });

            resultado.push({ titulo: teste.titulo, categorias: teste.categorias, contagens, total });

        }catch(e){

            console.error(`Erro ao buscar categorias de ${teste.colecao}:`, e);

        }

    }));

    // mantém a ordem original de TESTES_CATEGORICOS
    return TESTES_CATEGORICOS.map(t => resultado.find(r => r.titulo === t.titulo)).filter(Boolean);

}

// ======================================================
// TABELA 1: CARACTERIZAÇÃO DA AMOSTRA
// ======================================================

function renderizarCaracterizacaoAmostra(alunos, valoresPorVariavel){

    const n = alunos.length;

    const masculino = alunos.filter(a => (a.sexo || "").toLowerCase().startsWith("m")).length;

    const feminino = alunos.filter(a => (a.sexo || "").toLowerCase().startsWith("f")).length;

    const idades = (valoresPorVariavel.get("Idade (anos)") || []).map(item => item.valor);

    const statsIdade = calcularEstatisticasDescritivas(idades);

    const turmasDaAmostra = [...new Set(alunos.map(a => a.turmaId))].length;

    corpoCaracterizacao.innerHTML = `

        <tr><td><strong>N (tamanho da amostra)</strong></td><td>${n}</td></tr>
        <tr><td><strong>Sexo — Masculino</strong></td><td>${masculino} (${n > 0 ? Math.round((masculino/n)*100) : 0}%)</td></tr>
        <tr><td><strong>Sexo — Feminino</strong></td><td>${feminino} (${n > 0 ? Math.round((feminino/n)*100) : 0}%)</td></tr>
        <tr><td><strong>Idade — Média ± DP</strong></td><td>${statsIdade ? `${arredondar(statsIdade.media)} ± ${arredondar(statsIdade.desvioPadrao)} anos` : "-"}</td></tr>
        <tr><td><strong>Idade — Mín-Máx</strong></td><td>${statsIdade ? `${arredondar(statsIdade.min)} - ${arredondar(statsIdade.max)} anos` : "-"}</td></tr>
        <tr><td><strong>Nº de turmas na amostra</strong></td><td>${turmasDaAmostra}</td></tr>

    `;

}

// ======================================================
// TABELA 2: ESTATÍSTICA DESCRITIVA
// ======================================================

function renderizarEstatisticaDescritiva(valoresPorVariavel){

    corpoDescritiva.innerHTML = VARIAVEIS_NUMERICAS.map(variavel=>{

        const valores = (valoresPorVariavel.get(variavel.titulo) || []).map(item => item.valor);

        const stats = calcularEstatisticasDescritivas(valores);

        if(!stats){

            return `<tr><td>${variavel.titulo}</td><td colspan="15" style="color:#94a3b8">Sem dados suficientes</td></tr>`;

        }

        return `

            <tr>
                <td>${variavel.titulo}</td>
                <td>${stats.n}</td>
                <td>${arredondar(stats.media)}</td>
                <td>${arredondar(stats.desvioPadrao)}</td>
                <td>${arredondar(stats.erroPadrao)}</td>
                <td>${arredondar(stats.cv)}</td>
                <td>${arredondar(stats.mediana)}</td>
                <td>${stats.moda}</td>
                <td>${arredondar(stats.min)}</td>
                <td>${arredondar(stats.max)}</td>
                <td>${arredondar(stats.q1)}</td>
                <td>${arredondar(stats.q3)}</td>
                <td>${arredondar(stats.iiq)}</td>
                <td>${arredondar(stats.ic95min)} - ${arredondar(stats.ic95max)}</td>
                <td>${stats.assimetria !== null ? arredondar(stats.assimetria) : "-"}</td>
                <td>${stats.curtose !== null ? arredondar(stats.curtose) : "-"}</td>
            </tr>

        `;

    }).join("");

}

// ======================================================
// TABELA 3: VARIÁVEIS CATEGÓRICAS
// ======================================================

function renderizarVariaveisCategoricas(categoriasPorTeste){

    areaCategoricas.innerHTML = categoriasPorTeste.map(teste=>{

        if(teste.total === 0){

            return `<h4 style="margin-top:14px;">${teste.titulo}</h4><p style="color:#94a3b8">Sem dados.</p>`;

        }

        let acumulado = 0;

        const linhas = teste.categorias.map(categoria=>{

            const qtd = teste.contagens[categoria];

            const percentual = (qtd / teste.total) * 100;

            acumulado += percentual;

            return `

                <tr>
                    <td>${categoria}</td>
                    <td>${qtd}</td>
                    <td>${arredondar(percentual, 1)}%</td>
                    <td>${arredondar(acumulado, 1)}%</td>
                </tr>

            `;

        }).join("");

        return `

            <h4 style="margin-top:14px;">${teste.titulo} <span style="font-weight:400; color:#94a3b8; font-size:13px;">(N=${teste.total})</span></h4>

            <table class="table">
                <thead>
                    <tr><th>Categoria</th><th>Freq. Absoluta</th><th>Freq. Relativa</th><th>% Acumulado</th></tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>

        `;

    }).join("");

}

// ======================================================
// TABELA 4: COMPARAÇÃO POR SEXO
// ======================================================

function renderizarComparacaoPorSexo(alunos, valoresPorVariavel){

    const idsMasculino = new Set(alunos.filter(a => (a.sexo || "").toLowerCase().startsWith("m")).map(a => a.id));

    const idsFeminino = new Set(alunos.filter(a => (a.sexo || "").toLowerCase().startsWith("f")).map(a => a.id));

    cabecalhoPorSexo.innerHTML = `<th>Variável</th><th>Masculino (média ± DP)</th><th>Feminino (média ± DP)</th>`;

    corpoPorSexo.innerHTML = VARIAVEIS_NUMERICAS.map(variavel=>{

        const todosOsValores = valoresPorVariavel.get(variavel.titulo) || [];

        const valoresM = todosOsValores.filter(item => idsMasculino.has(item.alunoId)).map(item => item.valor);

        const valoresF = todosOsValores.filter(item => idsFeminino.has(item.alunoId)).map(item => item.valor);

        const statsM = calcularEstatisticasDescritivas(valoresM);

        const statsF = calcularEstatisticasDescritivas(valoresF);

        return `

            <tr>
                <td>${variavel.titulo}</td>
                <td>${statsM ? `${arredondar(statsM.media)} ± ${arredondar(statsM.desvioPadrao)} (n=${statsM.n})` : "-"}</td>
                <td>${statsF ? `${arredondar(statsF.media)} ± ${arredondar(statsF.desvioPadrao)} (n=${statsF.n})` : "-"}</td>
            </tr>

        `;

    }).join("");

}
