//=====================================================
//
// SAFE
// Sistema de Avaliação Física Escolar
//
// Módulo: Cadastro de Escolas
//
// Arquivo:
// js/modules/escolas.js
//
//=====================================================

import { db } from "../core/firebase.js";

import {
    souSuperAdmin,
    obterContextoUsuario,
    mostrarToast
} from "../core/utils.js";

import {

    collection,

    addDoc,

    getDocs,

    updateDoc,

    deleteDoc,

    doc,

    query,

    orderBy,

    serverTimestamp

}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

//=====================================================
// DADOS
//=====================================================

let escolas = [];

let escolaEditando = null;

//=====================================================
// ELEMENTOS
//=====================================================

let listaEscolas;
let pesquisaEscola;
let btnNovaEscola;
let modalEscola;
let tituloModalEscola;
let escolaIdInput;
let nomeEscola;
let enderecoEscola;
let telefoneEscola;
let ativoEscola;

let modoAcessoAlunoEscola, idadeMinimaSenhaEscola, tentativasMaximasEscola, tempoBloqueioMinutosEscola;
let cancelarEscola;
let salvarEscolaBtn;
let loader;

function obterElementos(){

    listaEscolas = document.getElementById("listaEscolas");
    pesquisaEscola = document.getElementById("pesquisaEscola");
    btnNovaEscola = document.getElementById("btnNovaEscola");
    modalEscola = document.getElementById("modalEscola");
    tituloModalEscola = document.getElementById("tituloModalEscola");
    escolaIdInput = document.getElementById("escolaId");
    nomeEscola = document.getElementById("nomeEscola");
    enderecoEscola = document.getElementById("enderecoEscola");
    telefoneEscola = document.getElementById("telefoneEscola");
    ativoEscola = document.getElementById("ativoEscola");

    modoAcessoAlunoEscola = document.getElementById("modoAcessoAlunoEscola");
    idadeMinimaSenhaEscola = document.getElementById("idadeMinimaSenhaEscola");
    tentativasMaximasEscola = document.getElementById("tentativasMaximasEscola");
    tempoBloqueioMinutosEscola = document.getElementById("tempoBloqueioMinutosEscola");
    cancelarEscola = document.getElementById("cancelarEscola");
    salvarEscolaBtn = document.getElementById("salvarEscola");
    loader = document.getElementById("loader");

}

//=====================================================
// EVENTOS
//=====================================================

function configurarEventos(){

    // Só super_admin pode criar escola nova (regra do Firestore já
    // bloqueia, mas nem mostramos o botão pra quem não pode usar)
    if(souSuperAdmin()){

        btnNovaEscola.addEventListener("click", abrirModalNova);

    }else{

        btnNovaEscola.style.display = "none";

    }

    cancelarEscola.addEventListener("click", fecharModal);

    salvarEscolaBtn.addEventListener("click", salvarEscola);

    pesquisaEscola.addEventListener("input", () => renderizarTabela(filtrarEscolas()));

}

export async function init(){

    obterElementos();

    configurarEventos();

    await carregarEscolas();

}

//=====================================================
// CARREGAR ESCOLAS
// (leitura liberada pra qualquer usuário logado, sem
// filtro por escola — é dado de referência do sistema todo)
//=====================================================

async function carregarEscolas(){

    abrirLoader();

    try{

        const consulta = query(

            collection(db,"escolas"),

            orderBy("nome")

        );

        const snapshot = await getDocs(consulta);

        escolas = [];

        snapshot.forEach(documento=>{

            escolas.push({ id: documento.id, ...documento.data() });

        });

        renderizarTabela(escolas);

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao carregar escolas.", "erro");

    }finally{

        fecharLoader();

    }

}

//=====================================================
// FILTRAR (pesquisa)
//=====================================================

function filtrarEscolas(){

    const termo = pesquisaEscola.value.trim().toLowerCase();

    if(!termo){

        return escolas;

    }

    return escolas.filter(e => (e.nome || "").toLowerCase().includes(termo));

}

//=====================================================
// RENDERIZAR TABELA
//=====================================================

function renderizarTabela(lista){

    const contexto = obterContextoUsuario();

    listaEscolas.innerHTML = "";

    if(lista.length === 0){

        listaEscolas.innerHTML = `

            <tr>
                <td colspan="5" style="text-align:center">Nenhuma escola cadastrada.</td>
            </tr>

        `;

        return;

    }

    lista.forEach(escola=>{

        // Edição liberada pro super_admin ou pro admin_escola da própria escola.
        // Exclusão só pro super_admin (criar escola nova também).
        const podeEditar = souSuperAdmin() ||
            (contexto.papel === "admin_escola" && contexto.escolaId === escola.id);

        const podeExcluir = souSuperAdmin();

        listaEscolas.innerHTML += `

            <tr>
                <td>${escola.nome || "-"}</td>
                <td>${escola.endereco || "-"}</td>
                <td>${escola.telefone || "-"}</td>
                <td>${escola.ativo === false ? "Inativa" : "Ativa"}</td>
                <td>
                    <div class="table-actions">
                        ${podeEditar ? `<button class="btn-icon btn-edit" onclick="window.editarEscola('${escola.id}')"><i class="bi bi-pencil"></i></button>` : ""}
                        ${podeExcluir ? `<button class="btn-icon btn-delete" onclick="window.excluirEscola('${escola.id}')"><i class="bi bi-trash"></i></button>` : ""}
                    </div>
                </td>
            </tr>

        `;

    });

}

//=====================================================
// MODAL — NOVA / EDITAR
//=====================================================

function abrirModalNova(){

    escolaEditando = null;

    tituloModalEscola.textContent = "Nova Escola";

    escolaIdInput.value = "";

    nomeEscola.value = "";

    enderecoEscola.value = "";

    telefoneEscola.value = "";

    ativoEscola.value = "true";

    modoAcessoAlunoEscola.value = "livre";

    idadeMinimaSenhaEscola.value = 12;

    tentativasMaximasEscola.value = 5;

    tempoBloqueioMinutosEscola.value = 5;

    modalEscola.classList.add("show");

}

window.editarEscola = function(id){

    const escola = escolas.find(e => e.id === id);

    if(!escola){

        return;

    }

    escolaEditando = id;

    tituloModalEscola.textContent = "Editar Escola";

    escolaIdInput.value = escola.id;

    nomeEscola.value = escola.nome || "";

    enderecoEscola.value = escola.endereco || "";

    telefoneEscola.value = escola.telefone || "";

    ativoEscola.value = escola.ativo === false ? "false" : "true";

    // Compatibilidade: escolas antigas só tinham "exigirSenhaAluno" (booleano
    // simples). Se "modoAcessoAluno" ainda não existir, deriva dele.
    modoAcessoAlunoEscola.value = escola.modoAcessoAluno

        || (escola.exigirSenhaAluno === true ? "senhaNascimento" : "livre");

    idadeMinimaSenhaEscola.value = escola.idadeMinimaSenha ?? 12;

    tentativasMaximasEscola.value = escola.tentativasMaximas ?? 5;

    tempoBloqueioMinutosEscola.value = escola.tempoBloqueioMinutos ?? 5;

    modalEscola.classList.add("show");

};

function fecharModal(){

    modalEscola.classList.remove("show");

}

//=====================================================
// SALVAR
//=====================================================

async function salvarEscola(){

    const dados = {

        nome: nomeEscola.value.trim(),

        endereco: enderecoEscola.value.trim(),

        telefone: telefoneEscola.value.trim(),

        ativo: ativoEscola.value === "true",

        modoAcessoAluno: modoAcessoAlunoEscola.value,

        idadeMinimaSenha: Number(idadeMinimaSenhaEscola.value),

        tentativasMaximas: Number(tentativasMaximasEscola.value),

        tempoBloqueioMinutos: Number(tempoBloqueioMinutosEscola.value)

    };

    if(dados.nome === ""){

        mostrarToast("Informe o nome da escola.", "erro");

        nomeEscola.focus();

        return;

    }

    abrirLoader();

    salvarEscolaBtn.disabled = true;

    try{

        if(escolaEditando){

            await updateDoc(

                doc(db,"escolas",escolaEditando),

                dados

            );

            mostrarToast("Escola atualizada com sucesso.");

        }else{

            dados.criadoEm = serverTimestamp();

            await addDoc(

                collection(db,"escolas"),

                dados

            );

            mostrarToast("Escola cadastrada com sucesso.");

        }

        fecharModal();

        await carregarEscolas();

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao salvar escola.", "erro");

    }finally{

        salvarEscolaBtn.disabled = false;

        fecharLoader();

    }

}

//=====================================================
// EXCLUIR
//=====================================================

window.excluirEscola = async function(id){

    if(!confirm("Excluir esta escola? Isso não exclui turmas/alunos já vinculados a ela.")){

        return;

    }

    abrirLoader();

    try{

        await deleteDoc(doc(db,"escolas",id));

        mostrarToast("Escola excluída.");

        await carregarEscolas();

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao excluir escola.", "erro");

    }finally{

        fecharLoader();

    }

};

//=====================================================
// LOADER
//=====================================================

function abrirLoader(){

    if(loader){

        loader.style.display = "flex";

    }

}

function fecharLoader(){

    if(loader){

        loader.style.display = "none";

    }

}