//=====================================================
//
// SAFE
// Sistema de Avaliação Física Escolar
//
// Módulo:
// Gestão de Funcionários (colaboradores adultos da escola —
// professores, motoristas, zeladores etc. — avaliados fora
// da bateria PROESP-Br, que é só pra alunos)
//
// Arquivo:
// js/modules/funcionarios.js
//
//=====================================================

import { db } from "../core/firebase.js";

import { souSuperAdmin, obterEscolaId, calcularIdade, mostrarToast } from "../core/utils.js";

import {

    collection,

    addDoc,

    getDocs,

    updateDoc,

    deleteDoc,

    doc,

    query,

    where,

    serverTimestamp

}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

//=====================================================
// DADOS
//=====================================================

let funcionarios = [];

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

let funcionarioId;

let tituloModal;

let nome;

let cargo;

let nascimento;

let sexo;

let grupoEscolaFuncionario;

let escolaFuncionario;

let btnSalvar;

let btnCancelar;

let btnNovo;

let btnPaginaAnterior;

let btnPaginaProxima;

let infoPagina;

let loader;

//=====================================================
// INICIALIZAÇÃO
//=====================================================

export async function init(){

    obterElementos();

    configurarEventos();

    if(souSuperAdmin()){

        await carregarEscolasMapa();

    }

    await carregarFuncionarios();

}

//=====================================================
// MAPA DE ESCOLAS (id -> nome), só pra exibição quando
// super_admin está vendo funcionários de várias escolas juntas
//=====================================================

async function carregarEscolasMapa(){

    try{

        const snapshot = await getDocs(collection(db,"escolas"));

        escolasMapa = {};

        escolaFuncionario.innerHTML = `<option value="">Selecione...</option>`;

        const listaEscolas = [];

        snapshot.forEach(doc=>{

            escolasMapa[doc.id] = doc.data().nome;

            listaEscolas.push({ id: doc.id, nome: doc.data().nome });

        });

        listaEscolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        listaEscolas.forEach(escola=>{

            escolaFuncionario.innerHTML += `<option value="${escola.id}">${escola.nome}</option>`;

        });

        grupoEscolaFuncionario.style.display = "block";

    }catch(erro){

        console.error("Erro ao carregar mapa de escolas:", erro);

    }

}

//=====================================================
// ELEMENTOS
//=====================================================

function obterElementos(){

    modal = document.getElementById("modalFuncionario");

    lista = document.getElementById("listaFuncionarios");

    pesquisa = document.getElementById("pesquisaFuncionario");

    funcionarioId = document.getElementById("funcionarioId");

    tituloModal = document.getElementById("tituloModalFuncionario");

    nome = document.getElementById("nomeFuncionario");

    cargo = document.getElementById("cargoFuncionario");

    nascimento = document.getElementById("nascimentoFuncionario");

    sexo = document.getElementById("sexoFuncionario");

    grupoEscolaFuncionario = document.getElementById("grupoEscolaFuncionario");

    escolaFuncionario = document.getElementById("escolaFuncionario");

    btnSalvar = document.getElementById("salvarFuncionario");

    btnCancelar = document.getElementById("cancelarFuncionario");

    btnNovo = document.getElementById("btnNovoFuncionario");

    btnPaginaAnterior = document.getElementById("paginaAnteriorFuncionario");

    btnPaginaProxima = document.getElementById("paginaProximaFuncionario");

    infoPagina = document.getElementById("infoPaginaFuncionario");

    loader = document.getElementById("loader");

}

//=====================================================
// EVENTOS
//=====================================================

function configurarEventos(){

    btnNovo.addEventListener("click", abrirModal);

    btnCancelar.addEventListener("click", fecharModal);

    btnSalvar.addEventListener("click", salvarFuncionario);

    pesquisa.addEventListener("keyup", pesquisarFuncionarios);

    btnPaginaAnterior.addEventListener("click", paginaAnterior);

    btnPaginaProxima.addEventListener("click", proximaPagina);

    modal.addEventListener("click", (e)=>{

        if(e.target===modal){

            fecharModal();

        }

    });

}

//=====================================================
// MODAL
//=====================================================

function abrirModal(){

    modoEdicao = false;

    tituloModal.textContent = "Novo Funcionário";

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

        loader.style.display = "flex";

    }

}

function fecharLoader(){

    if(loader){

        loader.style.display = "none";

    }

}

//=====================================================
// CARREGAR FUNCIONÁRIOS
//=====================================================

async function carregarFuncionarios(){

    abrirLoader();

    funcionarios = [];

    try{

        const condicoes = souSuperAdmin()
            ? []
            : [ where("escolaId","==",obterEscolaId()) ];

        // Sem orderBy aqui de propósito — combinado com o where(escolaId)
        // exigiria um índice composto que essa coleção nova ainda não tem
        // no Firestore. A ordenação por nome já é feita no cliente logo
        // abaixo (ordenarLista()).
        const consulta = query(

            collection(db,"funcionarios"),

            ...condicoes

        );

        const snapshot = await getDocs(consulta);

        snapshot.forEach(documento=>{

            funcionarios.push({

                id: documento.id,

                ...documento.data()

            });

        });

        ordenarLista();

        paginaAtual = 1;

        renderizarTabela(funcionarios);

    }

    catch(erro){

        console.error(erro);

        mostrarToast("Erro ao carregar funcionários.", "erro");

    }

    finally{

        fecharLoader();

    }

}

//=====================================================
// SALVAR FUNCIONÁRIO
//=====================================================

async function salvarFuncionario(){

    const dados = {

        nome: nome.value.trim(),

        cargo: cargo.value,

        dataNascimento: nascimento.value,

        sexo: sexo.value

    };

    if(dados.nome === ""){

        mostrarToast("Informe o nome do funcionário.", "erro");

        nome.focus();

        return;

    }

    if(dados.dataNascimento === ""){

        mostrarToast("Informe a data de nascimento.", "erro");

        nascimento.focus();

        return;

    }

    // Só super_admin edita a escola vinculada (mesmo padrão de turmas.js —
    // útil pra corrigir cadastros que ficaram sem escolaId)
    if(modoEdicao && souSuperAdmin()){

        if(!escolaFuncionario.value){

            mostrarToast("Selecione a escola.", "erro");

            return;

        }

        dados.escolaId = escolaFuncionario.value;

    }

    abrirLoader();

    btnSalvar.disabled = true;

    try{

        if(modoEdicao){

            await updateDoc(doc(db,"funcionarios",funcionarioId.value), dados);

            mostrarToast("Funcionário atualizado com sucesso.");

        }

        else{

            if(souSuperAdmin()){

                mostrarToast(
                    "Como super_admin, ainda não é possível cadastrar funcionários por aqui — falta escolher a escola. Peça pra um admin da escola cadastrar.",
                    "erro"
                );

                btnSalvar.disabled = false;

                fecharLoader();

                return;

            }

            dados.escolaId = obterEscolaId();

            dados.ativo = true;

            dados.criadoEm = serverTimestamp();

            await addDoc(collection(db,"funcionarios"), dados);

            mostrarToast("Funcionário cadastrado com sucesso.");

        }

        fecharModal();

        limparFormulario();

        await carregarFuncionarios();

    }

    catch(erro){

        console.error(erro);

        mostrarToast("Erro ao salvar.", "erro");

    }

    finally{

        btnSalvar.disabled = false;

        fecharLoader();

    }

}

//=====================================================
// EDITAR
//=====================================================

window.editarFuncionario = function(id){

    const funcionario = funcionarios.find(f => f.id === id);

    if(!funcionario){

        return;

    }

    modoEdicao = true;

    tituloModal.textContent = "Editar Funcionário";

    funcionarioId.value = funcionario.id;

    nome.value = funcionario.nome;

    cargo.value = funcionario.cargo || "Outro";

    nascimento.value = funcionario.dataNascimento || "";

    sexo.value = funcionario.sexo || "Masculino";

    if(souSuperAdmin()){

        escolaFuncionario.value = funcionario.escolaId || "";

    }

    modal.classList.add("show");

};

//=====================================================
// ATIVAR / DESATIVAR (soft delete — preserva o histórico
// de avaliações já lançadas pro funcionário)
//=====================================================

window.alternarAtivoFuncionario = async function(id, ativarDeNovo){

    const acao = ativarDeNovo ? "reativar" : "desativar";

    if(!confirm(`Confirma ${acao} este funcionário?`)){

        return;

    }

    abrirLoader();

    try{

        await updateDoc(doc(db,"funcionarios",id), { ativo: ativarDeNovo });

        mostrarToast(ativarDeNovo ? "Funcionário reativado." : "Funcionário desativado.");

        await carregarFuncionarios();

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao atualizar status.", "erro");

    }finally{

        fecharLoader();

    }

};

//=====================================================
// EXCLUIR (definitivo)
//=====================================================

window.excluirFuncionario = function(id){

    if(!confirm("Excluir DEFINITIVAMENTE este funcionário? As avaliações já lançadas pra ele não são apagadas, mas ficam órfãs. Pra só tirar o acesso, use Desativar.")){

        return;

    }

    excluirFuncionarioFirestore(id);

};

async function excluirFuncionarioFirestore(id){

    abrirLoader();

    try{

        await deleteDoc(doc(db,"funcionarios",id));

        mostrarToast("Funcionário excluído.");

        await carregarFuncionarios();

    }

    catch(erro){

        console.error(erro);

        mostrarToast("Erro ao excluir.", "erro");

    }

    finally{

        fecharLoader();

    }

}

//=====================================================
// LIMPAR FORMULÁRIO
//=====================================================

function limparFormulario(){

    funcionarioId.value = "";

    nome.value = "";

    cargo.value = "Professor";

    nascimento.value = "";

    sexo.value = "Masculino";

}

//=====================================================
// PESQUISAR FUNCIONÁRIOS
//=====================================================

function pesquisarFuncionarios(){

    const texto = pesquisa.value.toLowerCase().trim();

    if(texto === ""){

        renderizarTabela(funcionarios);

        return;

    }

    const resultado = funcionarios.filter(funcionario=>{

        return (

            (funcionario.nome || "").toLowerCase().includes(texto)

            ||

            (funcionario.cargo || "").toLowerCase().includes(texto)

        );

    });

    renderizarTabela(resultado);

}

//=====================================================
// ORDENAÇÃO
//=====================================================

function ordenarLista(){

    funcionarios.sort((a,b)=>{

        let valorA = a[colunaOrdenacao] ?? "";

        let valorB = b[colunaOrdenacao] ?? "";

        if(typeof valorA === "string"){

            valorA = valorA.toLowerCase();

            valorB = valorB.toLowerCase();

        }

        if(valorA < valorB){

            return ordemCrescente ? -1 : 1;

        }

        if(valorA > valorB){

            return ordemCrescente ? 1 : -1;

        }

        return 0;

    });

}

window.ordenarTabelaFuncionarios = function(coluna){

    if(coluna === colunaOrdenacao){

        ordemCrescente = !ordemCrescente;

    }

    else{

        colunaOrdenacao = coluna;

        ordemCrescente = true;

    }

    ordenarLista();

    renderizarTabela(funcionarios);

};

//=====================================================
// RENDERIZAR TABELA
//=====================================================

function renderizarTabela(listaFuncionarios){

    lista.innerHTML = "";

    totalPaginas = Math.ceil(listaFuncionarios.length / registrosPorPagina);

    if(totalPaginas === 0){

        totalPaginas = 1;

    }

    const inicio = (paginaAtual-1) * registrosPorPagina;

    const fim = inicio + registrosPorPagina;

    const pagina = listaFuncionarios.slice(inicio, fim);

    if(pagina.length === 0){

        lista.innerHTML = `<tr><td colspan="5" style="text-align:center">Nenhum funcionário cadastrado.</td></tr>`;

        atualizarPaginacao();

        return;

    }

    pagina.forEach(funcionario=>{

        let nomeExibicao = funcionario.nome;

        if(souSuperAdmin()){

            const nomeEscola = escolasMapa[funcionario.escolaId];

            nomeExibicao = nomeEscola
                ? `${funcionario.nome} <small style="color:#94a3b8">(${nomeEscola})</small>`
                : `${funcionario.nome} <small style="color:#c62828">(sem escola vinculada)</small>`;

        }

        const idade = calcularIdade(funcionario.dataNascimento);

        const ativo = funcionario.ativo !== false;

        lista.innerHTML += `

        <tr>

            <td>${nomeExibicao}</td>

            <td>${funcionario.cargo || "-"}</td>

            <td>${idade}</td>

            <td>${ativo ? `<span style="color:#16A34A">Ativo</span>` : `<span style="color:#c62828">Desativado</span>`}</td>

            <td>

                <button class="btn-editar" onclick="editarFuncionario('${funcionario.id}')">Editar</button>

                ${ativo
                    ? `<button class="btn-secondary" onclick="alternarAtivoFuncionario('${funcionario.id}', false)">Desativar</button>`
                    : `<button class="btn-secondary" onclick="alternarAtivoFuncionario('${funcionario.id}', true)">Reativar</button>`
                }

                <button class="btn-excluir" onclick="excluirFuncionario('${funcionario.id}')">Excluir</button>

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

    infoPagina.textContent = `Página ${paginaAtual} de ${totalPaginas}`;

    btnPaginaAnterior.disabled = paginaAtual === 1;

    btnPaginaProxima.disabled = paginaAtual === totalPaginas;

}

function paginaAnterior(){

    if(paginaAtual > 1){

        paginaAtual--;

        renderizarTabela(funcionarios);

    }

}

function proximaPagina(){

    if(paginaAtual < totalPaginas){

        paginaAtual++;

        renderizarTabela(funcionarios);

    }

}

//=====================================================
// ATUALIZAÇÃO EXTERNA (usado pelos módulos de avaliação
// adulta pra popular o seletor de funcionário)
//=====================================================

export async function atualizar(){

    await carregarFuncionarios();

}

export function obterFuncionarios(){

    return funcionarios;

}

//=====================================================
// FECHAR MODAL COM ESC
//=====================================================

document.addEventListener("keydown", (evento)=>{

    if(evento.key === "Escape"){

        if(modal && modal.classList.contains("show")){

            fecharModal();

        }

    }

});
