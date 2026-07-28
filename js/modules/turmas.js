//=====================================================
//
// SAFE
// Sistema de Avaliação Física Escolar
//
// Módulo:
// Gestão de Turmas
//
// Arquivo:
// js/modules/turmas.js
//
//=====================================================

import { db } from "../core/firebase.js";

import { souSuperAdmin, obterEscolaId, obterContextoUsuario, mostrarToast } from "../core/utils.js";

import {

    collection,

    addDoc,

    getDocs,

    updateDoc,

    deleteDoc,

    doc,

    getDoc,

    query,

    where,

    orderBy,

    serverTimestamp

}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

//=====================================================
// DADOS
//=====================================================

let turmas = [];

let modoEdicao = false;

let paginaAtual = 1;

let escolasMapa = {};

const registrosPorPagina = 10;

let totalPaginas = 1;

//=====================================================
// ORDENAÇÃO
//=====================================================

let colunaOrdenacao = "nome";

let ordemCrescente = true;

//=====================================================
// ELEMENTOS
//=====================================================

let modal;

let lista;

let pesquisa;

let turmaId;

let nome;

let serie;

let turno;

let ano;

let exigirSenhaTurma;

let grupoEscolaTurma;

let escolaTurma;

let btnSalvar;

let btnCancelar;

let btnNova;

let btnPaginaAnterior;

let btnPaginaProxima;

let infoPagina;


let loader;

let modalConfirmacao;

let textoConfirmacao;

let btnCancelarConfirmacao;

let btnConfirmarExclusao;

//=====================================================
// INICIALIZAÇÃO
//=====================================================

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarAnoLetivoPadrao();

    if(souSuperAdmin()){

        await carregarEscolasMapa();

    }

    await carregarTurmas();

    atualizarDashboard();

}

//=====================================================
// MAPA DE ESCOLAS (id -> nome), só pra exibição quando
// super_admin está vendo turmas de várias escolas juntas
//=====================================================

async function carregarEscolasMapa(){

    try{

        const snapshot = await getDocs(collection(db,"escolas"));

        escolasMapa = {};

        escolaTurma.innerHTML = `<option value="">Selecione...</option>`;

        const listaEscolas = [];

        snapshot.forEach(doc=>{

            escolasMapa[doc.id] = doc.data().nome;

            listaEscolas.push({ id: doc.id, nome: doc.data().nome });

        });

        listaEscolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        listaEscolas.forEach(escola=>{

            escolaTurma.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

        });

        grupoEscolaTurma.style.display = "block";

    }catch(erro){

        console.error("Erro ao carregar mapa de escolas:", erro);

    }

}

//=====================================================
// ELEMENTOS
//=====================================================

function obterElementos(){

    modal =
    document.getElementById("modalTurma");

    lista =
    document.getElementById("listaTurmas");

    pesquisa =
    document.getElementById("pesquisaTurma");

    turmaId =
    document.getElementById("turmaId");

    nome =
    document.getElementById("nomeTurma");

    serie =
    document.getElementById("serieTurma");

    turno =
    document.getElementById("turnoTurma");

    ano =
    document.getElementById("anoTurma");

    exigirSenhaTurma =
    document.getElementById("exigirSenhaTurma");

    grupoEscolaTurma =
    document.getElementById("grupoEscolaTurma");

    escolaTurma =
    document.getElementById("escolaTurma");

    btnSalvar =
    document.getElementById("salvarTurma");

    btnCancelar =
    document.getElementById("cancelarTurma");

    btnNova =
    document.getElementById("btnNovaTurma");

    btnPaginaAnterior =
    document.getElementById("paginaAnterior");

    btnPaginaProxima =
    document.getElementById("paginaProxima");

    infoPagina =
    document.getElementById("infoPagina");

    loader =
    document.getElementById("loader");

    modalConfirmacao =
    document.getElementById("modalConfirmacao");

    textoConfirmacao =
    document.getElementById("textoConfirmacao");

    btnCancelarConfirmacao =
    document.getElementById("btnCancelarConfirmacao");

    btnConfirmarExclusao =
    document.getElementById("btnConfirmarExclusao");

}

//=====================================================
// EVENTOS
//=====================================================

function configurarEventos(){

    btnNova.addEventListener(

        "click",

        abrirModal

    );

    btnCancelar.addEventListener(

        "click",

        fecharModal

    );

    btnSalvar.addEventListener(

        "click",

        salvarTurma

    );

    pesquisa.addEventListener(

        "keyup",

        pesquisarTurmas

    );

    btnPaginaAnterior.addEventListener(

        "click",

        paginaAnterior

    );

    btnPaginaProxima.addEventListener(

        "click",

        proximaPagina

    );

    modal.addEventListener(

        "click",

        (e)=>{

            if(e.target===modal){

                fecharModal();

            }

        }

    );

}

//=====================================================
// MODAL
//=====================================================

function abrirModal(){

    modoEdicao = false;

    limparFormulario();

    modal.classList.add("show");

}

function fecharModal(){

    modal.classList.remove("show");

}

//=====================================================
// LOADER
//=====================================================

function abrirLoader(){

    if(loader){

        loader.style.display="flex";

    }

}

function fecharLoader(){

    if(loader){

        loader.style.display="none";

    }

}

//=====================================================
// CARREGAR TURMAS
//=====================================================

async function carregarTurmas(){

    abrirLoader();

    turmas = [];

    try{

        const condicoes = souSuperAdmin()
            ? []
            : [ where("escolaId","==",obterEscolaId()) ];

        const consulta = query(

            collection(db,"turmas"),

            ...condicoes,

            orderBy("nome")

        );

        const snapshot = await getDocs(consulta);

        snapshot.forEach(documento=>{

            turmas.push({

                id: documento.id,

                ...documento.data()

            });

        });

        ordenarLista();

        paginaAtual = 1;

        renderizarTabela(turmas);

    }

    catch(erro){

        console.error(erro);

        mostrarToast(

            "Erro ao carregar turmas.",

            "erro"

        );

    }

    finally{

        fecharLoader();

    }

}

//=====================================================
// SALVAR TURMA
//=====================================================

async function salvarTurma(){

    const dados={

        nome:nome.value.trim(),

        serie:serie.value.trim(),

        turno:turno.value,

        anoLetivo:Number(ano.value),

        exigirSenha: exigirSenhaTurma.value === "true"

    };

    // quantidadeAlunos só é zerado na CRIAÇÃO — editar uma turma não pode
    // apagar a contagem de alunos que ela já tem
    if(!modoEdicao){

        dados.quantidadeAlunos = 0;

    }

    // Só super_admin edita a escola vinculada (útil pra corrigir turmas
    // antigas que ficaram sem escolaId)
    if(modoEdicao && souSuperAdmin()){

        if(!escolaTurma.value){

            mostrarToast("Selecione a escola.", "erro");

            return;

        }

        dados.escolaId = escolaTurma.value;

    }

    if(dados.nome===""){

        mostrarToast(

            "Informe o nome da turma.",

            "erro"

        );

        nome.focus();

        return;

    }

    if(dados.serie===""){

        mostrarToast(

            "Informe a série.",

            "erro"

        );

        serie.focus();

        return;

    }

    abrirLoader();

    btnSalvar.disabled=true;

    try{

        if(modoEdicao){

            await updateDoc(

                doc(

                    db,

                    "turmas",

                    turmaId.value

                ),

                dados

            );

            mostrarToast(

                "Turma atualizada com sucesso."

            );

        }

        else{

            if(souSuperAdmin()){

                // TODO: super_admin ainda não tem como escolher a escola
                // da turma nova (não existe seletor no formulário). Até
                // criarmos o módulo de Escolas com esse seletor, quem
                // deve cadastrar turmas é um admin_escola ou professor.
                mostrarToast(
                    "Como super_admin, ainda não é possível criar turmas por aqui — falta escolher a escola. Peça pra um admin da escola cadastrar.",
                    "erro"
                );

                btnSalvar.disabled=false;

                fecharLoader();

                return;

            }

            dados.escolaId = obterEscolaId();

            dados.criadoEm =

            serverTimestamp();

            await addDoc(

                collection(db,"turmas"),

                dados

            );

            mostrarToast(

                "Turma cadastrada com sucesso."

            );

        }

        fecharModal();

        limparFormulario();

        await carregarTurmas();

        atualizarDashboard();

    }

    catch(erro){

        console.error(erro);

        mostrarToast(

            "Erro ao salvar.",

            "erro"

        );

    }

    finally{

        btnSalvar.disabled=false;

        fecharLoader();

    }

}

//=====================================================
// EDITAR
//=====================================================

window.editarTurma=function(id){

    const turma=

    turmas.find(

        t=>t.id===id

    );

    if(!turma){

        return;

    }

    modoEdicao=true;

    turmaId.value=

    turma.id;

    nome.value=

    turma.nome;

    serie.value=

    turma.serie;

    turno.value=

    turma.turno;

    ano.value=

    turma.anoLetivo;

    exigirSenhaTurma.value = turma.exigirSenha === true ? "true" : "false";

    if(souSuperAdmin()){

        escolaTurma.value = turma.escolaId || "";

    }

    modal.classList.add("show");

};

//=====================================================
// EXCLUIR
//=====================================================

window.excluirTurma=function(id){

    if(

        !confirm(

            "Deseja excluir esta turma?"

        )

    ){

        return;

    }

    excluirTurmaFirestore(id);

};

async function excluirTurmaFirestore(id){

    abrirLoader();

    try{

        await deleteDoc(

            doc(

                db,

                "turmas",

                id

            )

        );

        mostrarToast(

            "Turma excluída."

        );

        await carregarTurmas();

        atualizarDashboard();

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

//=====================================================
// LIMPAR FORMULÁRIO
//=====================================================

let anoLetivoPadrao = new Date().getFullYear();

async function carregarAnoLetivoPadrao(){

    try{

        const snap = await getDoc(doc(db,"configuracoes","geral"));

        if(snap.exists() && snap.data().anoLetivoAtual){

            anoLetivoPadrao = snap.data().anoLetivoAtual;

        }

    }catch(e){

        // sem permissão ou documento inexistente — mantém o ano atual como padrão
        console.warn("Não foi possível carregar o ano letivo padrão, usando o ano atual.", e);

    }

}

function limparFormulario(){

    turmaId.value="";

    nome.value="";

    serie.value="";

    turno.value="Manhã";

    ano.value=

    anoLetivoPadrao;

    exigirSenhaTurma.value = "false";

}
//=====================================================
// PESQUISAR TURMAS
//=====================================================

function pesquisarTurmas(){

    const texto =

    pesquisa.value

    .toLowerCase()

    .trim();

    if(texto===""){

        renderizarTabela(turmas);

        return;

    }

    const resultado = turmas.filter(turma=>{

        return (

            (turma.nome || "")
            .toLowerCase()
            .includes(texto)

            ||

            (turma.serie || "")
            .toLowerCase()
            .includes(texto)

            ||

            (turma.turno || "")
            .toLowerCase()
            .includes(texto)

            ||

            String(
                turma.anoLetivo || ""
            ).includes(texto)

        );

    });

    renderizarTabela(resultado);

}

//=====================================================
// ORDENAÇÃO
//=====================================================

function ordenarLista(){

    turmas.sort((a,b)=>{

        let valorA =

        a[colunaOrdenacao] ?? "";

        let valorB =

        b[colunaOrdenacao] ?? "";

        if(typeof valorA==="string"){

            valorA =

            valorA.toLowerCase();

            valorB =

            valorB.toLowerCase();

        }

        if(valorA<valorB){

            return ordemCrescente ? -1 : 1;

        }

        if(valorA>valorB){

            return ordemCrescente ? 1 : -1;

        }

        return 0;

    });

}

//=====================================================
// ALTERAR ORDENAÇÃO
//=====================================================

window.ordenarTabela = function(coluna){

    if(coluna===colunaOrdenacao){

        ordemCrescente =

        !ordemCrescente;

    }

    else{

        colunaOrdenacao = coluna;

        ordemCrescente = true;

    }

    ordenarLista();

    renderizarTabela(turmas);

};

//=====================================================
// RENDERIZAR TABELA
//=====================================================

function renderizarTabela(listaTurmas){

    lista.innerHTML="";

    totalPaginas = Math.ceil(

        listaTurmas.length /

        registrosPorPagina

    );

    if(totalPaginas===0){

        totalPaginas=1;

    }

    const inicio =

    (paginaAtual-1)

    *

    registrosPorPagina;

    const fim =

    inicio +

    registrosPorPagina;

    const pagina =

    listaTurmas.slice(

        inicio,

        fim

    );

    if(pagina.length===0){

        lista.innerHTML =

        `

        <tr>

            <td colspan="6">

                Nenhuma turma cadastrada.

            </td>

        </tr>

        `;

        atualizarPaginacao();

        return;

    }

    pagina.forEach(turma=>{

        let nomeExibicao = turma.nome;

        if(souSuperAdmin()){

            const nomeEscola = escolasMapa[turma.escolaId];

            nomeExibicao = nomeEscola
                ? `${turma.nome} <small style="color:#94a3b8">(${nomeEscola})</small>`
                : `${turma.nome} <small style="color:#c62828">(sem escola vinculada)</small>`;

        }

        // Professor só visualiza a turma — não edita nem exclui (só
        // admin_escola/super_admin fazem isso). A regra de segurança do
        // Firestore já bloqueia por trás, isso aqui é só não mostrar o
        // botão de uma ação que ele não pode usar.
        const papelAtual = obterContextoUsuario().papel;

        const podeGerenciarTurma = papelAtual !== "professor";

        lista.innerHTML +=

        `

        <tr>

            <td>${nomeExibicao}</td>

            <td>${turma.serie}</td>

            <td>${turma.turno}</td>

            <td>${turma.anoLetivo}</td>

            <td>${turma.quantidadeAlunos || 0}</td>

            <td>

                ${podeGerenciarTurma ? `

                <button

                    class="btn-editar"

                    onclick="editarTurma('${turma.id}')">

                    Editar

                </button>

                <button

                    class="btn-excluir"

                    onclick="excluirTurma('${turma.id}')">

                    Excluir

                </button>

                ` : `<span style="color:#94a3b8">Sem permissão</span>`}

            </td>

        </tr>

        `;

    });

    atualizarPaginacao();

}

//=====================================================
// PAGINAÇÃO
//=====================================================

function atualizarPaginacao(){

    infoPagina.textContent =

    `Página ${paginaAtual} de ${totalPaginas}`;

    btnPaginaAnterior.disabled =

    paginaAtual===1;

    btnPaginaProxima.disabled =

    paginaAtual===totalPaginas;

}

function paginaAnterior(){

    if(paginaAtual>1){

        paginaAtual--;

        renderizarTabela(turmas);

    }

}

function proximaPagina(){

    if(paginaAtual<totalPaginas){

        paginaAtual++;

        renderizarTabela(turmas);

    }

}
//=====================================================
// DASHBOARD
//=====================================================

function atualizarDashboard(){

    const totalTurmas =

    document.getElementById("totalTurmas");

    if(totalTurmas){

        totalTurmas.textContent =

        turmas.length;

    }

}

//=====================================================
// ATUALIZAÇÃO EXTERNA
//=====================================================

export async function atualizar(){

    await carregarTurmas();

}

//=====================================================
// UTILITÁRIOS
//=====================================================

function obterTurmaPorId(id){

    return turmas.find(

        turma => turma.id === id

    ) || null;

}

function obterIndiceTurma(id){

    return turmas.findIndex(

        turma => turma.id === id

    );

}

//=====================================================
// FECHAR MODAL COM ESC
//=====================================================

document.addEventListener(

    "keydown",

    (evento)=>{

        if(evento.key==="Escape"){

            if(

                modal &&

                modal.classList.contains("show")

            ){

                fecharModal();

            }

        }

    }

);

//=====================================================
// FECHAR MODAL DE CONFIRMAÇÃO
//=====================================================

if(btnCancelarConfirmacao){

    btnCancelarConfirmacao.addEventListener(

        "click",

        ()=>{

            modalConfirmacao.classList.remove("show");

        }

    );

}

//=====================================================
// DEBUG
//=====================================================

console.log(

    "SAFE - Módulo Turmas carregado."

);

//=====================================================
// FIM DO MÓDULO
//=====================================================