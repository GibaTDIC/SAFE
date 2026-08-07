// ======================================================
// SAFE
// Módulo: Backup (exportação completa em PDF)
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

const TESTES_CONFIG = [

    { colecao:"avaliacoes_circunferenciacintura", titulo:"Perímetro da Cintura (RCE)", colunas:[
        {label:"Cintura (cm)", campo:"cintura"},
        {label:"Estatura (cm)", campo:"estatura"},
        {label:"RCE", campo:"rce"},
        {label:"Classificação", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_imc", titulo:"IMC", colunas:[
        {label:"Peso (kg)", campo:"peso"},
        {label:"Estatura (cm)", campo:"estatura"},
        {label:"IMC", campo:"imc"},
        {label:"Classificação", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_flexibilidade", titulo:"Flexibilidade", colunas:[
        {label:"Distância (cm)", campo:"distanciaCm"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_abdominal", titulo:"Resistência Muscular Localizada", colunas:[
        {label:"Repetições", campo:"repeticoes"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_medicineball", titulo:"Potência de Membros Superiores", colunas:[
        {label:"Distância (cm)", campo:"distanciaCm"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_saltohorizontal", titulo:"Potência de Membros Inferiores", colunas:[
        {label:"Distância (cm)", campo:"distanciaCm"},
        {label:"Desempenho", campo:"classificacaoDesempenho"}
    ]},

    { colecao:"avaliacoes_agilidade", titulo:"Agilidade", colunas:[
        {label:"Tempo (s)", campo:"tempoSegundos"},
        {label:"Desempenho", campo:"classificacaoDesempenho"}
    ]},

    { colecao:"avaliacoes_corrida20m", titulo:"Velocidade", colunas:[
        {label:"Tempo (s)", campo:"tempoSegundos"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]},

    { colecao:"avaliacoes_corrida6min", titulo:"Aptidão Cardiorrespiratória", colunas:[
        {label:"Distância (m)", campo:"distanciaM"},
        {label:"Desempenho", campo:"classificacaoDesempenho"},
        {label:"Saúde", campo:"classificacaoSaude"}
    ]}

];

let escolas = [];

let escolaBackup, areaBackup, tituloBackup, dataGeracaoBackup;

let corpoTurmasBackup, corpoAlunosBackup, secoesTestesBackup, btnExportarPdfBackup;

function obterElementos(){

    escolaBackup = document.getElementById("escolaBackup");
    areaBackup = document.getElementById("areaBackup");
    tituloBackup = document.getElementById("tituloBackup");
    dataGeracaoBackup = document.getElementById("dataGeracaoBackup");
    corpoTurmasBackup = document.getElementById("corpoTurmasBackup");
    corpoAlunosBackup = document.getElementById("corpoAlunosBackup");
    secoesTestesBackup = document.getElementById("secoesTestesBackup");
    btnExportarPdfBackup = document.getElementById("btnExportarPdfBackup");

}

function configurarEventos(){

    escolaBackup.addEventListener("change", gerarBackup);

    btnExportarPdfBackup.addEventListener("click", () => window.print());

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

}

async function carregarEscolas(){

    escolas = [];

    escolaBackup.innerHTML = `<option value="">Selecione...</option>`;

    try{

        if(souSuperAdmin()){

            const snapshot = await getDocs(collection(db,"escolas"));

            snapshot.forEach(doc=>{

                escolas.push({ id: doc.id, ...doc.data() });

            });

            escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

            escolas.forEach(escola=>{

                escolaBackup.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

        }else{

            const escolaId = obterEscolaId();

            escolaBackup.innerHTML = `<option value="${escolaId}">Minha escola</option>`;

            escolaBackup.value = escolaId;

            escolaBackup.disabled = true;

            await gerarBackup();

        }

    }catch(e){

        console.error(e);

        mostrarToast("Não foi possível carregar as escolas.", "erro");

    }

}

// ======================================================
// GERAR BACKUP
// ======================================================

async function gerarBackup(){

    areaBackup.style.display = "none";

    if(!escolaBackup.value){

        return;

    }

    const escolaId = escolaBackup.value;

    const nomeEscola = souSuperAdmin()
        ? (escolas.find(e => e.id === escolaId)?.nome || "")
        : escolaBackup.options[escolaBackup.selectedIndex].textContent;

    abrirLoader();

    try{

        // 1) Turmas
        const qTurmas = query(collection(db,"turmas"), where("escolaId","==",escolaId));

        const snapTurmas = await getDocs(qTurmas);

        const turmas = [];

        snapTurmas.forEach(doc=>{

            turmas.push({ id: doc.id, ...doc.data() });

        });

        turmas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        const mapaTurmas = {};

        turmas.forEach(t => mapaTurmas[t.id] = t.nome);

        // 2) Alunos
        const qAlunos = query(collection(db,"alunos"), where("escolaId","==",escolaId));

        const snapAlunos = await getDocs(qAlunos);

        const alunos = [];

        snapAlunos.forEach(doc=>{

            alunos.push({ id: doc.id, ...doc.data() });

        });

        alunos.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        // 3) Contagem de alunos por turma (pra tabela de turmas)
        const contagemAlunosPorTurma = {};

        alunos.forEach(a=>{

            contagemAlunosPorTurma[a.turmaId] = (contagemAlunosPorTurma[a.turmaId] || 0) + 1;

        });

        // 4) Histórico completo de cada teste, pra escola inteira
        const historicosPorTeste = await Promise.all(

            TESTES_CONFIG.map(config => buscarHistoricoCompleto(config, escolaId))

        );

        renderizarTudo(nomeEscola, turmas, alunos, mapaTurmas, contagemAlunosPorTurma, historicosPorTeste);

        areaBackup.style.display = "block";

    }catch(e){

        console.error(e);

        mostrarToast("Erro ao gerar o backup.", "erro");

    }finally{

        fecharLoader();

    }

}

async function buscarHistoricoCompleto(config, escolaId){

    const registros = [];

    try{

        const q = query(collection(db, config.colecao), where("escolaId","==",escolaId));

        const snapshot = await getDocs(q);

        snapshot.forEach(doc => registros.push(doc.data()));

        registros.sort((a,b)=>{

            const dataA = a.dataTeste ? a.dataTeste.toMillis() : 0;

            const dataB = b.dataTeste ? b.dataTeste.toMillis() : 0;

            return dataB - dataA;

        });

    }catch(e){

        console.error(`Erro ao buscar ${config.colecao}:`, e);

    }

    return { config, registros };

}

// ======================================================
// RENDERIZAR
// ======================================================

function renderizarTudo(nomeEscola, turmas, alunos, mapaTurmas, contagemAlunosPorTurma, historicosPorTeste){

    tituloBackup.textContent = `Backup completo — ${nomeEscola}`;

    dataGeracaoBackup.textContent = new Date().toLocaleString("pt-BR");

    // Turmas
    corpoTurmasBackup.innerHTML = turmas.length === 0
        ? `<tr><td colspan="5">Nenhuma turma cadastrada.</td></tr>`
        : turmas.map(t => `

            <tr>
                <td>${t.nome || "-"}</td>
                <td>${t.serie || "-"}</td>
                <td>${t.turno || "-"}</td>
                <td>${t.anoLetivo || "-"}</td>
                <td>${contagemAlunosPorTurma[t.id] || 0}</td>
            </tr>

        `).join("");

    // Alunos
    corpoAlunosBackup.innerHTML = alunos.length === 0
        ? `<tr><td colspan="6">Nenhum aluno cadastrado.</td></tr>`
        : alunos.map(a => `

            <tr>
                <td>${a.codigoSAFE || "-"}</td>
                <td>${a.nome || "-"}</td>
                <td>${a.matricula || "-"}</td>
                <td>${a.sexo || "-"}</td>
                <td>${a.dataNascimento || "-"}</td>
                <td>${mapaTurmas[a.turmaId] || "-"}</td>
            </tr>

        `).join("");

    // Uma seção por teste, com todo o histórico da escola
    secoesTestesBackup.innerHTML = historicosPorTeste.map(({ config, registros }) => {

        if(registros.length === 0){

            return `

                <div class="card">
                    <h3>${config.titulo}</h3>
                    <p style="color:#94a3b8">Nenhum registro.</p>
                </div>

            `;

        }

        const cabecalho = `<th>Data</th><th>Aluno</th>` +
            config.colunas.map(c => `<th>${c.label}</th>`).join("");

        const linhas = registros.map(registro=>{

            const data = registro.dataTeste ? registro.dataTeste.toDate().toLocaleDateString("pt-BR") : "-";

            const celulas = config.colunas.map(c => `<td>${registro[c.campo] ?? "-"}</td>`).join("");

            return `<tr><td>${data}</td><td>${registro.nome || "-"}</td>${celulas}</tr>`;

        }).join("");

        return `

            <div class="card">
                <h3>${config.titulo} <span style="font-weight:400; color:#94a3b8; font-size:14px">— ${registros.length} registro(s)</span></h3>
                <table class="table">
                    <thead><tr>${cabecalho}</tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>

        `;

    }).join("");

}

function abrirLoader(){

    const loader = document.getElementById("loader");

    if(loader) loader.style.display = "flex";

}

function fecharLoader(){

    const loader = document.getElementById("loader");

    if(loader) loader.style.display = "none";

}