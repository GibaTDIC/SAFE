// ======================================================
// SAFE - Sistema de Avaliação Física Escolar
// Módulo: Cadastro de Alunos
// Arquivo: js/modules/aluno.js
// Versão 2.0
// ======================================================

import { db } from "../core/firebase.js";

import { souSuperAdmin, obterEscolaId, mostrarToast } from "../core/utils.js";

import{
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    runTransaction
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ======================================================
// VARIÁVEIS
// ======================================================

let alunos = [];

let turmas = [];

let escolas = [];

let alunoEditando = null;

let paginaAtual = 1;

let listaFiltradaAtual = [];

const registrosPorPagina = 10;

// ======================================================
// ELEMENTOS DA TELA
// ======================================================

let tabela;

let pesquisa;

let filtroEscolaAluno;

let filtroTurmaAluno;

let modal;

let form;

let btnNovoAluno;

let btnCancelarAluno;

let btnSalvarAluno;

let btnImportarExcel;

let arquivoExcel;

let escolaDestinoImportacao;

// Modal de conferência da importação
let modalConferenciaImportacao, resumoConferenciaImportacao;
let escolaConferenciaImportacao, turmaConferenciaImportacao;
let corpoConferenciaImportacao, marcarTodosConferencia;
let cancelarConferenciaImportacao, confirmarConferenciaImportacao;

let linhasParaImportar = [];

let paginaAnterior;

let paginaProxima;

let infoPagina;

let toast;

let loader;

// CAMPOS DO FORMULÁRIO

let nomeAluno;

let matriculaAluno;

let sexoAluno;

let dataNascimento;

let escolaAluno;

let turmaAluno;


// ======================================================
// OBTER ELEMENTOS DA TELA
// ======================================================

function obterElementos(){

    tabela = document.getElementById("listaAlunos");

    pesquisa = document.getElementById("pesquisaAluno");

    filtroEscolaAluno = document.getElementById("filtroEscolaAluno");

    filtroTurmaAluno = document.getElementById("filtroTurmaAluno");

    modal = document.getElementById("modalAluno");

    form = document.getElementById("formAluno");

    btnNovoAluno = document.getElementById("btnNovoAluno");

    btnCancelarAluno = document.getElementById("btnCancelarAluno");

    btnSalvarAluno = document.getElementById("btnSalvarAluno");

    btnImportarExcel = document.getElementById("btnImportarExcel");

    arquivoExcel = document.getElementById("arquivoExcel");

    escolaDestinoImportacao = document.getElementById("escolaDestinoImportacao");

    modalConferenciaImportacao = document.getElementById("modalConferenciaImportacao");
    resumoConferenciaImportacao = document.getElementById("resumoConferenciaImportacao");
    escolaConferenciaImportacao = document.getElementById("escolaConferenciaImportacao");
    turmaConferenciaImportacao = document.getElementById("turmaConferenciaImportacao");
    corpoConferenciaImportacao = document.getElementById("corpoConferenciaImportacao");
    marcarTodosConferencia = document.getElementById("marcarTodosConferencia");
    cancelarConferenciaImportacao = document.getElementById("cancelarConferenciaImportacao");
    confirmarConferenciaImportacao = document.getElementById("confirmarConferenciaImportacao");

    paginaAnterior = document.getElementById("paginaAnterior");

    paginaProxima = document.getElementById("paginaProxima");

    infoPagina = document.getElementById("infoPagina");

    toast = document.getElementById("toast");

    loader = document.getElementById("loader");

    nomeAluno = document.getElementById("nomeAluno");

    matriculaAluno = document.getElementById("matriculaAluno");

    sexoAluno = document.getElementById("sexoAluno");

    dataNascimento = document.getElementById("dataNascimento");

    escolaAluno = document.getElementById("escolaAluno");

    turmaAluno = document.getElementById("turmaAluno");

}

// ======================================================
// CONFIGURAÇÃO DOS EVENTOS
// ======================================================

function configurarEventos(){

    btnNovoAluno.addEventListener(

        "click",

        abrirModal

    );

    btnCancelarAluno.addEventListener(

        "click",

        fecharModal

    );

    escolaAluno.addEventListener(

        "change",

        atualizarTurmasDoFormulario

    );

    form.addEventListener(

        "submit",

        salvarAluno

    );

    pesquisa.addEventListener(

        "keyup",

        pesquisarAluno

    );

    filtroEscolaAluno.addEventListener(

        "change",

        aoTrocarFiltroEscola

    );

    filtroTurmaAluno.addEventListener(

        "change",

        pesquisarAluno

    );

    paginaAnterior.addEventListener(

        "click",

        voltarPagina

    );

    paginaProxima.addEventListener(

        "click",

        avancarPagina

    );

    btnImportarExcel.addEventListener(

        "click",

        ()=>{

            arquivoExcel.click();

        }

    );

    arquivoExcel.addEventListener(

        "change",

        analisarArquivoExcel

    );

    cancelarConferenciaImportacao.addEventListener("click", fecharModalConferencia);

    confirmarConferenciaImportacao.addEventListener("click", confirmarImportacaoRevisada);

    marcarTodosConferencia.addEventListener("change", () => {

        linhasParaImportar.forEach(l => l.incluir = marcarTodosConferencia.checked);

        renderizarTabelaConferencia();

    });

}
// ======================================================
// MODAL
// ======================================================

function abrirModal(){

    alunoEditando = null;

    limparFormulario();

    document.getElementById(

        "tituloModalAluno"

    ).innerHTML = "Cadastro de Aluno";

    modal.classList.add("show");

}

function fecharModal(){

    modal.classList.remove("show");

}

// ======================================================
// LIMPAR FORMULÁRIO
// ======================================================

function limparFormulario(){

    nomeAluno.value = "";

    matriculaAluno.value = "";

    sexoAluno.value = "";

    dataNascimento.value = "";

    // Quem não é super_admin só tem uma escola pra escolher — já trava
    // nela, pra não ter que selecionar toda vez.
    escolaAluno.value = souSuperAdmin() ? "" : obterEscolaId();

    turmaAluno.value = "";

    atualizarTurmasDoFormulario();

}

// ======================================================
// SALVAR ALUNO
// ======================================================

// Gera o próximo código SAFE (SAFE000001, SAFE000002...) usando um
// contador atômico, em vez de ler todos os alunos do sistema pra achar
// o maior número já usado. Isso evita dois problemas:
// 1) admin_escola/professor não pode ler alunos de outras escolas, então
//    a busca global sempre seria negada pra eles (só funcionava pro
//    super_admin, que não tem essa restrição).
// 2) Duas pessoas cadastrando aluno ao mesmo tempo não arriscam mais
//    gerar o mesmo código (a transação garante o incremento único).
async function gerarCodigoSAFE(){

    const contadorRef = doc(db, "contadores", "alunos");

    const proximoNumero = await runTransaction(db, async (transacao) => {

        const snap = await transacao.get(contadorRef);

        const atual = snap.exists() ? (snap.data().ultimoNumero || 0) : 0;

        const proximo = atual + 1;

        transacao.set(contadorRef, { ultimoNumero: proximo }, { merge: true });

        return proximo;

    });

    return "SAFE" + String(proximoNumero).padStart(6,"0");

}

async function salvarAluno(e){

    e.preventDefault();

    abrirLoader();

    try{

        const escolaSelecionada = escolas.find(e => e.id === escolaAluno.value);

        const dados = {

            nome: nomeAluno.value.trim(),

            matricula: matriculaAluno.value.trim(),

            sexo: sexoAluno.value,

            dataNascimento: dataNascimento.value,

            escola: escolaSelecionada ? escolaSelecionada.nome : "",

            escolaId: escolaAluno.value,

            turmaId: turmaAluno.value,

            atualizadoEm: new Date()

        };

        if(dados.nome===""){

            mostrarToast(

                "Informe o nome do aluno.",

                "erro"

            );

            fecharLoader();

            return;

        }

        if(dados.escolaId===""){

            mostrarToast(

                "Selecione a escola.",

                "erro"

            );

            fecharLoader();

            return;

        }

        if(dados.turmaId===""){

            mostrarToast(

                "Selecione uma turma.",

                "erro"

            );

            fecharLoader();

            return;

        }

        const turmaAntigaDoAluno = alunoEditando
            ? (alunos.find(a => a.id === alunoEditando)?.turmaId || null)
            : null;

        if(alunoEditando){

            await updateDoc(

                doc(

                    db,

                    "alunos",

                    alunoEditando

                ),

                dados

            );

            mostrarToast(

                "Aluno atualizado."

            );

        }

        else{

           dados.codigoSAFE = await gerarCodigoSAFE();

dados.criadoEm = new Date();

await addDoc(
    collection(db,"alunos"),
    dados
);

            mostrarToast(

                "Aluno cadastrado."

            );

        }

        fecharModal();

        await carregarAlunos();

await atualizarContagemTurma(dados.turmaId);

if(turmaAntigaDoAluno && turmaAntigaDoAluno !== dados.turmaId){

    await atualizarContagemTurma(turmaAntigaDoAluno);

}

    }

    catch(erro){

        console.error(erro);

        mostrarToast(

            "Erro ao salvar.",

            "erro"

        );

    }

    finally{

        fecharLoader();

    }

}
// ======================================================
// CARREGAR ESCOLAS (select do formulário)
// ======================================================

async function carregarEscolas(){

    escolas = [];

    escolaAluno.innerHTML = `

        <option value="">

            Selecione a escola

        </option>

    `;

    try{

        const snapshot = await getDocs(collection(db,"escolas"));

        snapshot.forEach(doc=>{

            escolas.push({ id: doc.id, ...doc.data() });

        });

        escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        escolas.forEach(escola=>{

            escolaAluno.innerHTML += `

                <option value="${escola.id}">

                    ${escola.nome}

                </option>

            `;

        });

        // Quem não é super_admin só atende a própria escola — não faz
        // sentido deixar trocar pra outra na hora de cadastrar aluno.
        if(!souSuperAdmin()){

            escolaAluno.disabled = true;

        }

        // Filtro de escola na listagem — só faz sentido pro super_admin,
        // que vê alunos de todas as escolas juntos. Quem não é
        // super_admin já só enxerga a própria escola (a consulta em
        // carregarAlunos()/carregarTurmas() já vem filtrada), então o
        // filtro fica escondido pra não confundir à toa.
        if(souSuperAdmin()){

            filtroEscolaAluno.innerHTML = `<option value="">Todas as escolas</option>`;

            escolas.forEach(escola=>{

                filtroEscolaAluno.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

            });

            filtroEscolaAluno.style.display = "inline-block";

        }

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao carregar escolas.", "erro");

    }

}

// ======================================================
// FILTRO DE ESCOLA NA LISTAGEM (cascata Escola → Turma)
// Reaproveita o array `turmas` já carregado, igual a
// atualizarTurmasDoFormulario() faz pro modal — sem outra
// consulta ao banco.
// ======================================================

function aoTrocarFiltroEscola(){

    const escolaFiltro = filtroEscolaAluno.value;

    filtroTurmaAluno.innerHTML = `<option value="">Todas as turmas</option>`;

    const turmasParaMostrar = escolaFiltro
        ? turmas.filter(t => t.escolaId === escolaFiltro)
        : turmas;

    turmasParaMostrar.forEach(turma=>{

        filtroTurmaAluno.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

    });

    pesquisarAluno();

}

// ======================================================
// ATUALIZAR TURMAS DO FORMULÁRIO (cascata Escola → Turma)
// Filtra o array `turmas` que já foi carregado por carregarTurmas(),
// sem precisar de outra consulta ao banco.
// ======================================================

function atualizarTurmasDoFormulario(){

    const escolaFiltro = escolaAluno.value;

    turmaAluno.innerHTML = `

        <option value="">

            Selecione a turma

        </option>

    `;

    if(!escolaFiltro){

        return;

    }

    turmas

        .filter(t => t.escolaId === escolaFiltro)

        .forEach(turma=>{

            turmaAluno.innerHTML += `

                <option value="${turma.id}">

                    ${turma.nome}

                </option>

            `;

        });

}

// ======================================================
// CARREGAR TURMAS
// ======================================================

async function carregarTurmas(){

    turmas = [];

    turmaAluno.innerHTML = `

        <option value="">

            Selecione a turma

        </option>

    `;

    try{

        const condicoes = souSuperAdmin()
            ? []
            : [ where("escolaId","==",obterEscolaId()) ];

        const q = query(

            collection(db,"turmas"),

            ...condicoes,

            orderBy("nome")

        );

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            const turma = {

                id: doc.id,

                ...doc.data()

            };

            turmas.push(turma);

        });

        turmas.forEach(turma=>{

            turmaAluno.innerHTML += `

                <option value="${turma.id}">

                    ${turma.nome}

                </option>

            `;

        });

        filtroTurmaAluno.innerHTML = `<option value="">Todas as turmas</option>`;

        turmas.forEach(turma=>{

            filtroTurmaAluno.innerHTML += `<option value="${turma.id}">${turma.nome}</option>`;

        });

    }

    catch(erro){

        console.error(erro);

        mostrarToast(

            "Erro ao carregar turmas.",

            "erro"

        );

    }

}

// ======================================================
// CARREGAR ALUNOS
// ======================================================

async function carregarAlunos(){

    alunos = [];

    try{

        const condicoes = souSuperAdmin()
            ? []
            : [ where("escolaId","==",obterEscolaId()) ];

        const q = query(

            collection(db,"alunos"),

            ...condicoes,

            orderBy("nome")

        );

        const snapshot = await getDocs(q);

        snapshot.forEach(doc=>{

            alunos.push({

                id: doc.id,

                ...doc.data()

            });

        });

        renderizarTabela();

    }

    catch(erro){

        console.error(erro);

        mostrarToast(

            "Erro ao carregar alunos.",

            "erro"

        );

    }

}
// ======================================================
// RENDERIZAR TABELA
// ======================================================

function renderizarTabela(lista = listaFiltradaAtual){

    listaFiltradaAtual = lista;

    tabela.innerHTML = "";

    if(lista.length===0){

        tabela.innerHTML = `

        <tr>

            <td colspan="6" style="text-align:center">

                Nenhum aluno encontrado.

            </td>

        </tr>

        `;

        infoPagina.innerHTML = "Página 1 de 1";

        return;

    }

    const totalPaginas = Math.ceil(

        lista.length / registrosPorPagina

    );

    if(paginaAtual > totalPaginas){

        paginaAtual = totalPaginas;

    }

    if(paginaAtual < 1){

        paginaAtual = 1;

    }

    const inicio =

        (paginaAtual-1) * registrosPorPagina;

    const fim =

        inicio + registrosPorPagina;

    const pagina =

        lista.slice(inicio,fim);

    pagina.forEach(aluno=>{

        const turma =

            turmas.find(

                t=>t.id===aluno.turmaId

            );

        tabela.innerHTML += `

        <tr>

            <td>${aluno.nome}</td>

            <td>${aluno.matricula || "-"}</td>

            <td>${calcularIdade(aluno.dataNascimento)}</td>

            <td>${aluno.sexo || "-"}</td>

            <td>${turma ? turma.nome : "-"}</td>

            <td>

                <button

                    class="btn btn-primary"

                    onclick="editarAluno('${aluno.id}')">

                    Editar

                </button>

                <button

                    class="btn btn-danger"

                    onclick="excluirAluno('${aluno.id}')">

                    Excluir

                </button>

            </td>

        </tr>

        `;

    });

    infoPagina.innerHTML =

        `Página ${paginaAtual} de ${totalPaginas}`;

}
// ======================================================
// PESQUISAR
// ======================================================

function pesquisarAluno(){

    const texto =

        pesquisa.value

        .toLowerCase()

        .trim();

    const turmaFiltrada = filtroTurmaAluno.value;

    const escolaFiltrada = filtroEscolaAluno.value;

    let resultado = alunos;

    if(escolaFiltrada){

        resultado = resultado.filter(aluno=>aluno.escolaId===escolaFiltrada);

    }

    if(turmaFiltrada){

        resultado = resultado.filter(aluno=>aluno.turmaId===turmaFiltrada);

    }

    if(texto!==""){

    resultado = resultado.filter(aluno=>{

        const turma =

            turmas.find(

                t=>t.id===aluno.turmaId

            );

        return(

            (aluno.nome || "")

            .toLowerCase()

            .includes(texto)

            ||

            (aluno.matricula || "")

            .toLowerCase()

            .includes(texto)

            ||

            (turma?.nome || "")

            .toLowerCase()

            .includes(texto)

        );

    });

    }

    paginaAtual = 1;

    renderizarTabela(resultado);

}
// ======================================================
// PAGINAÇÃO
// ======================================================

function voltarPagina(){

    if(paginaAtual>1){

        paginaAtual--;

        renderizarTabela(listaFiltradaAtual);

    }

}

function avancarPagina(){

    const total = Math.ceil(

        listaFiltradaAtual.length /

        registrosPorPagina

    );

    if(paginaAtual<total){

        paginaAtual++;

        renderizarTabela(listaFiltradaAtual);

    }

}
// ======================================================
// EDITAR ALUNO
// ======================================================

window.editarAluno = async function(id){

    const aluno = alunos.find(a=>a.id===id);

    if(!aluno){

        return;

    }

    alunoEditando = id;

    document.getElementById(

        "tituloModalAluno"

    ).innerHTML = "Editar Aluno";

    nomeAluno.value = aluno.nome || "";

    matriculaAluno.value = aluno.matricula || "";

    sexoAluno.value = aluno.sexo || "";

    dataNascimento.value = aluno.dataNascimento || "";

    escolaAluno.value = aluno.escolaId || "";

    atualizarTurmasDoFormulario();

    turmaAluno.value = aluno.turmaId || "";

    modal.classList.add("show");

}
// ======================================================
// EXCLUIR ALUNO
// ======================================================

window.excluirAluno = async function(id){

    const confirmar = confirm(

        "Deseja realmente excluir este aluno?"

    );

    if(!confirmar){

        return;

    }

    abrirLoader();

    try{

        const turmaDoAlunoExcluido = alunos.find(a => a.id === id)?.turmaId || null;

        await deleteDoc(

            doc(

                db,

                "alunos",

                id

            )

        );

        mostrarToast( "Aluno excluído com sucesso."

        );

        await atualizarContagemTurma(turmaDoAlunoExcluido);

        await carregarAlunos();

    }

    catch(erro){

        console.error(erro);

        mostrarToast(

            "Erro ao excluir.",

            "erro"

        );

    }

    finally{

        fecharLoader();

    }

}
// ======================================================
// ATUALIZAR QUANTIDADE DE ALUNOS
// ======================================================

// Atualiza a contagem de alunos de UMA turma só (nunca mexe em outras —
// evita erro de permissão em turmas de fora do escopo de quem está
// salvando, e evita trabalho desnecessário)
async function atualizarContagemTurma(turmaId){

    if(!turmaId){

        return;

    }

    try{

        // Precisa da escola da turma pra filtrar os alunos por escolaId —
        // só turmaId sozinho não passa na regra de segurança pra quem não
        // é super_admin (mesmo problema já visto em vários outros lugares).
        let escolaIdDaTurma = turmas.find(t => t.id === turmaId)?.escolaId;

        if(!escolaIdDaTurma){

            const turmaSnap = await getDoc(doc(db,"turmas",turmaId));

            escolaIdDaTurma = turmaSnap.exists() ? turmaSnap.data().escolaId : null;

        }

        if(!escolaIdDaTurma){

            console.warn("Não foi possível determinar a escola da turma", turmaId, "— contagem não atualizada.");

            return;

        }

        const q = query(

            collection(db,"alunos"),

            where("escolaId","==",escolaIdDaTurma)

        );

        const snapshot = await getDocs(q);

        let quantidade = 0;

        snapshot.forEach(docSnap=>{

            if(docSnap.data().turmaId === turmaId){

                quantidade++;

            }

        });

        await updateDoc(

            doc(db,"turmas",turmaId),

            { quantidadeAlunos: quantidade }

        );

    }catch(erro){

        console.error("Erro ao atualizar quantidade de alunos da turma:", turmaId, erro);

    }

}

// ======================================================
// IMPORTAÇÃO EXCEL
// ======================================================

// ======================================================
// IMPORTAÇÃO EXCEL — FASE 1: ANALISAR (sem gravar nada)
// Lê a planilha, monta uma pré-visualização de cada linha,
// e abre o modal de conferência. Nenhuma escrita acontece
// aqui — só na fase 2 (confirmarImportacaoRevisada), e só
// pras linhas que continuarem marcadas.
// ======================================================

async function analisarArquivoExcel(evento){

    const arquivo = evento.target.files[0];

    if(!arquivo){

        return;

    }

    abrirLoader();

    try{

        const reader = new FileReader();

        reader.onload = async function(e){

            try{

                const data = new Uint8Array(e.target.result);

                const workbook = XLSX.read(data, { type:"array" });

                // Segunda leitura, só para obter as datas como objetos Date reais
                const workbookDatas = XLSX.read(data, { type:"array", cellDates: true });

                const sheetName = workbook.SheetNames[0];

                const sheet = workbook.Sheets[sheetName];

                const sheetDatas = workbookDatas.Sheets[sheetName];

                const linhas = XLSX.utils.sheet_to_json(sheet, { defval:"", raw:false });

                const linhasDatas = XLSX.utils.sheet_to_json(sheetDatas, { defval:"", raw:true });

                // Recarrega do servidor antes de checar duplicidade — evita
                // comparar contra um cache desatualizado.
                await carregarAlunos();

                linhasParaImportar = [];

                for(let i = 0; i < linhas.length; i++){

                    const linha = linhas[i];

                    const nome = obterValorPlanilha(linha, ["Nome","Nome do Aluno","Aluno"]);

                    if(!nome){

                        continue;

                    }

                    const nomeLimpo = nome.trim();

                    const matricula = obterValorPlanilha(linha, ["Matricula","Matrícula"]).toString().trim();

                    const sexo = obterValorPlanilha(linha, ["Sexo"]);

                    const escola = obterValorPlanilha(linha, ["Escola"]);

                    const turmaNome = obterValorPlanilha(linha, ["Turma"]);

                    let dataNascExcel = obterValorPlanilha(

                        linhasDatas[i],

                        ["Data de nascimento","Data Nascimento","Nascimento","Data Nasc","DataNasc","Dt Nasc","Dt. Nasc","Dt Nascimento","Dtnasc"]

                    );

                    if(!dataNascExcel){

                        dataNascExcel = obterValorPlanilhaPorTermo(linhasDatas[i], ["nasc"]);

                    }

                    const dataNascimento = converterDataParaISO(dataNascExcel);

                    // Situação prévia (Novo/Atualização) — só uma estimativa
                    // pra mostrar na conferência; a checagem de verdade
                    // acontece de novo na hora de confirmar.
                    const alunoExistente = alunos.find(a => {

                        if(matricula !== ""){

                            return (a.matricula || "").toString().trim() === matricula;

                        }

                        const nomeExistente = normalizarNomeParaComparacao(a.nome);

                        if(nomeExistente !== normalizarNomeParaComparacao(nomeLimpo)){

                            return false;

                        }

                        if(dataNascimento){

                            return a.dataNascimento === dataNascimento;

                        }

                        return (a.turmaNomeOriginal || "") === turmaNome;

                    });

                    linhasParaImportar.push({

                        linhaExcel: i + 2,
                        nome: nomeLimpo,
                        matricula,
                        sexo,
                        escola,
                        turmaNome,
                        dataNascimento,
                        situacao: alunoExistente ? "Atualização" : "Novo",
                        incluir: true

                    });

                }

                abrirModalConferencia();

            }catch(err){

                console.error(err);

                mostrarToast("Erro na leitura do Excel","erro");

            }finally{

                fecharLoader();

            }

        };

        reader.readAsArrayBuffer(arquivo);

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao ler o Excel","erro");

        fecharLoader();

    }

}

// ======================================================
// MODAL DE CONFERÊNCIA
// ======================================================

function abrirModalConferencia(){

    escolaConferenciaImportacao.innerHTML = escolas

        .map(e => `<option value="${e.id}" ${e.id === escolaDestinoImportacao.value ? "selected" : ""}>${e.nome}</option>`)

        .join("") || `<option value="">Nenhuma escola cadastrada</option>`;

    if(!souSuperAdmin()){

        escolaConferenciaImportacao.value = obterEscolaId();

        escolaConferenciaImportacao.disabled = true;

    }

    turmaConferenciaImportacao.innerHTML = `<option value="">Manter a turma de cada linha da planilha</option>` +

        turmas.map(t => `<option value="${t.nome}">Forçar todos pra: ${t.nome}</option>`).join("");

    marcarTodosConferencia.checked = true;

    resumoConferenciaImportacao.textContent = `${linhasParaImportar.length} linha(s) encontrada(s) na planilha.`;

    renderizarTabelaConferencia();

    modalConferenciaImportacao.classList.add("show");

}

function fecharModalConferencia(){

    modalConferenciaImportacao.classList.remove("show");

    arquivoExcel.value = "";

    linhasParaImportar = [];

}

function renderizarTabelaConferencia(){

    corpoConferenciaImportacao.innerHTML = linhasParaImportar.map((l, indice) => `

        <tr>
            <td><input type="checkbox" class="checkbox-linha-conferencia" data-indice="${indice}" ${l.incluir ? "checked" : ""}></td>
            <td>${l.linhaExcel}</td>
            <td>${l.nome}</td>
            <td>${l.turmaNome || "-"}</td>
            <td>${l.dataNascimento || "(não reconhecida)"}</td>
            <td>${l.situacao}</td>
        </tr>

    `).join("");

    corpoConferenciaImportacao.querySelectorAll(".checkbox-linha-conferencia").forEach(cb=>{

        cb.addEventListener("change", (evento)=>{

            const indice = Number(evento.target.dataset.indice);

            linhasParaImportar[indice].incluir = evento.target.checked;

        });

    });

}

// ======================================================
// IMPORTAÇÃO EXCEL — FASE 2: CONFIRMAR (grava de verdade)
// Só processa as linhas que continuarem marcadas.
// ======================================================

async function confirmarImportacaoRevisada(){

    const escolaEscolhida = escolaConferenciaImportacao.value;

    if(!escolaEscolhida){

        mostrarToast("Escolha a escola de destino.", "erro");

        return;

    }

    const turmaForcada = turmaConferenciaImportacao.value;

    const linhasSelecionadas = linhasParaImportar.filter(l => l.incluir);

    if(linhasSelecionadas.length === 0){

        mostrarToast("Nenhuma linha selecionada.", "erro");

        return;

    }

    abrirLoader();

    confirmarConferenciaImportacao.disabled = true;

    try{

        // Recarrega mais uma vez, pra não gravar contra dado desatualizado
        await carregarAlunos();

        let novos = 0;

        let atualizados = 0;

        let erros = 0;

        const linhasComErro = [];

        const turmasAfetadasNaImportacao = new Set();

        for(const l of linhasSelecionadas){

          try{

            const turmaNomeFinal = turmaForcada || l.turmaNome;

            const turmaId = await obterOuCriarTurma(turmaNomeFinal, escolaEscolhida);

            if(turmaId){

                turmasAfetadasNaImportacao.add(turmaId);

            }

            const alunoExistente = alunos.find(a => {

                if(l.matricula !== ""){

                    return (a.matricula || "").toString().trim() === l.matricula;

                }

                const nomeExistente = normalizarNomeParaComparacao(a.nome);

                if(nomeExistente !== normalizarNomeParaComparacao(l.nome)){

                    return false;

                }

                if(l.dataNascimento){

                    return a.dataNascimento === l.dataNascimento;

                }

                return a.turmaId === turmaId;

            });

            const dados = {

                nome: l.nome,
                matricula: l.matricula,
                sexo: l.sexo,
                escola: l.escola,
                turmaId,
                escolaId: escolaEscolhida,
                dataNascimento: l.dataNascimento,
                atualizadoEm: new Date()

            };

            if(alunoExistente){

                await updateDoc(doc(db,"alunos",alunoExistente.id), dados);

                Object.assign(alunoExistente, dados);

                atualizados++;

            }else{

                dados.codigoSAFE = await gerarCodigoSAFE();

                dados.criadoEm = new Date();

                const novoDocRef = await addDoc(collection(db,"alunos"), dados);

                alunos.push({ id: novoDocRef.id, ...dados });

                novos++;

            }

          }catch(erroLinha){

            console.error(`Erro na linha ${l.linhaExcel} da planilha:`, erroLinha);

            erros++;

            linhasComErro.push(l.linhaExcel);

          }

        }

        mostrarToast(

            `Importação concluída:

            Novos: ${novos}

            Atualizados: ${atualizados}

            ${erros > 0 ? `Erros: ${erros} (linha(s) ${linhasComErro.join(", ")} — veja o console)` : ""}`,

            erros > 0 ? "erro" : "sucesso"

        );

        fecharModalConferencia();

        await carregarAlunos();

        for(const turmaId of turmasAfetadasNaImportacao){

            await atualizarContagemTurma(turmaId);

        }

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao importar.","erro");

    }finally{

        confirmarConferenciaImportacao.disabled = false;

        fecharLoader();

    }

}
// ======================================================
// CONVERTER DATA (objeto Date real, vindo do Excel com
// cellDates:true) PARA ISO (aaaa-mm-dd)
// ======================================================

// Remove acento, deixa minúsculo e tira espaço duplicado — pra comparar
// nomes sem depender de digitação idêntica (evita duplicidade por causa
// de "José" vs "Jose", ou espaço a mais entre palavras)
function normalizarNomeParaComparacao(nome){

    return (nome || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

}

// Remove acento, deixa minúsculo e tira espaço/pontuação — pra comparar
// nomes de coluna da planilha sem depender de digitação exata
function normalizarTexto(valor){

    return (valor || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

}

// Busca o valor de uma coluna na linha da planilha, aceitando variações
// de nome (maiúscula/minúscula, acento, espaço, "_" etc.) — em vez de
// exigir o nome exato da coluna, como antes.
function obterValorPlanilha(linha, aliases){

    if(!linha){
        return "";
    }

    const aliasesNormalizados = aliases.map(normalizarTexto);

    for(const chave of Object.keys(linha)){

        if(aliasesNormalizados.includes(normalizarTexto(chave))){

            return linha[chave];

        }

    }

    return "";

}

// Último recurso: acha qualquer coluna cujo nome CONTENHA um dos termos
// (ex: "nasc" pega "Data Nascimento", "Dt. Nasc.", "Nascimento", etc,
// mesmo variações não previstas na lista de aliases exatos)
function obterValorPlanilhaPorTermo(linha, termos){

    if(!linha){
        return "";
    }

    const termosNormalizados = termos.map(normalizarTexto);

    for(const chave of Object.keys(linha)){

        const chaveNormalizada = normalizarTexto(chave);

        if(termosNormalizados.some(termo => chaveNormalizada.includes(termo))){

            return linha[chave];

        }

    }

    return "";

}

function converterDataParaISO(valor){

    if(!valor){

        return "";

    }

    // Já veio como objeto Date (caminho normal, via cellDates:true)
    if(valor instanceof Date && !isNaN(valor)){

        // usa métodos UTC para não sofrer deslocamento de fuso horário
        const ano = valor.getUTCFullYear();

        const mes = String(valor.getUTCMonth() + 1).padStart(2, "0");

        const dia = String(valor.getUTCDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;

    }

    // Já está em formato ISO (aaaa-mm-dd)?
    if(typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)){

        return valor;

    }

    // Fallback: string no padrão brasileiro dd/mm/aaaa (ou dd-mm-aaaa,
    // dd.mm.aaaa) digitada manualmente, com ano de 2 ou 4 dígitos
    if(typeof valor === "string"){

        const match = valor.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);

        if(match){

            let [, dia, mes, ano] = match;

            if(ano.length === 2){

                // heurística simples: 2 dígitos < 30 assume 20xx, senão 19xx
                ano = (Number(ano) < 30 ? "20" : "19") + ano;

            }

            return `${ano}-${mes.padStart(2,"0")}-${dia.padStart(2,"0")}`;

        }

    }

    // Número serial de data do Excel (às vezes a planilha guarda a data
    // como número puro, mesmo com cellDates:true, se a célula não
    // estiver formatada como data na origem)
    if(typeof valor === "number" && valor > 0){

        // Excel conta dias a partir de 30/12/1899 (compensando o bug
        // histórico do "ano bissexto 1900" que o próprio Excel tem)
        const dataBase = new Date(Date.UTC(1899, 11, 30));

        dataBase.setUTCDate(dataBase.getUTCDate() + Math.floor(valor));

        const ano = dataBase.getUTCFullYear();

        const mes = String(dataBase.getUTCMonth() + 1).padStart(2, "0");

        const dia = String(dataBase.getUTCDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;

    }

    return "";

}

// ======================================================
// GARANTIR TURMA EXISTE (OU CRIAR)
// ======================================================

async function obterOuCriarTurma(nomeTurma, escolaIdAlvo){

    if(!nomeTurma){

        return "";

    }

    const nomeLimpo = nomeTurma.trim();

    if(nomeLimpo === ""){

        return "";

    }

    // procura turma existente (na mesma escola, se soubermos qual é —
    // evita achar uma turma de mesmo nome só que de outra escola)
    const existente = turmas.find(

        t => t.nome.toLowerCase() === nomeLimpo.toLowerCase() &&
             (!escolaIdAlvo || t.escolaId === escolaIdAlvo)

    );

    if(existente){

        return existente.id;

    }

    // cria nova turma automaticamente
    const docRef = await addDoc(

        collection(db,"turmas"),

        {

            nome: nomeLimpo,

            escolaId: escolaIdAlvo || obterEscolaId(),

            serie: "",

            turno: "",

            anoLetivo: new Date().getFullYear(),

            quantidadeAlunos: 0,

            criadoEm: new Date()

        }

    );

    // atualiza lista local
    turmas.push({

        id: docRef.id,

        nome: nomeLimpo,

        escolaId: escolaIdAlvo || obterEscolaId()

    });

    return docRef.id;

}

// ======================================================
// BUSCA DE ALUNO (REFORÇADA)
// ======================================================

function encontrarAlunoPorMatricula(matricula){

    if(!matricula) return null;

    return alunos.find(

        a => a.matricula === matricula

    ) || null;

}

// ======================================================
// VALIDAÇÃO DE DADOS
// ======================================================

function validarAluno(dados){

    if(!dados.nome){

        return "Nome é obrigatório";

    }

    if(!dados.turmaId){

        return "Turma é obrigatória";

    }

    return null;

}
// ======================================================
// CALCULAR IDADE
// ======================================================

function calcularIdade(dataNascimento){

    if(!dataNascimento){

        return "-";

    }

    const nascimento = new Date(dataNascimento);

    const hoje = new Date();

    let idade = hoje.getFullYear() - nascimento.getFullYear();

    const mes = hoje.getMonth() - nascimento.getMonth();

    if(mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())){

        idade--;

    }

    return idade;

}

// ======================================================
// LOADER
// ======================================================

function abrirLoader(){

    const loader = document.getElementById("loader");

    if(loader){

        loader.style.display = "flex";

    }

}

function fecharLoader(){

    const loader = document.getElementById("loader");

    if(loader){

        loader.style.display = "none";

    }

}

// ======================================================
// EXPORTAÇÕES GLOBAIS (BOTÕES HTML)
// ======================================================

window.editarAluno = editarAluno;
window.excluirAluno = excluirAluno;

// ======================================================
// INICIALIZAÇÃO FINAL DO MÓDULO
// ======================================================

// Só o super_admin vê esse seletor — ele não tem escola fixa, então
// precisa escolher explicitamente pra onde vão os alunos importados
// (muito mais confiável do que tentar adivinhar pelo nome escrito na
// coluna "Escola" da planilha, que pode não bater com o cadastro).
function montarSeletorEscolaDestinoImportacao(){

    if(!souSuperAdmin()){

        escolaDestinoImportacao.style.display = "none";

        return;

    }

    escolaDestinoImportacao.style.display = "inline-block";

    escolaDestinoImportacao.innerHTML = `<option value="">Escola de destino...</option>`;

    escolas.forEach(escola=>{

        escolaDestinoImportacao.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

    });

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

    montarSeletorEscolaDestinoImportacao();

    await carregarTurmas();

    await carregarAlunos();

}

// ======================================================
// GARANTIA DE SEGURANÇA (EVITA DUPLA EXECUÇÃO)
// ======================================================

let iniciado = false;

document.addEventListener("DOMContentLoaded", ()=>{

    if(iniciado) return;

    iniciado = true;

    init();

});

// ======================================================
// FIM DO MÓDULO
// ======================================================