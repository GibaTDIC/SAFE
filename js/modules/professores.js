//=====================================================
//
// SAFE
// Sistema de Avaliação Física Escolar
//
// Módulo: Cadastro de Avaliadores / Coordenador de Escola
//
// Arquivo:
// js/modules/professores.js
//
//=====================================================

import { db, firebaseConfig } from "../core/firebase.js";

import {
    souSuperAdmin,
    obterContextoUsuario,
    mostrarToast
} from "../core/utils.js";

import {
    initializeApp,
    getApps
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut as signOutSecundario
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {

    collection,

    addDoc,

    getDocs,

    updateDoc,

    deleteDoc,

    doc,

    setDoc,

    query,

    where,

    orderBy,

    serverTimestamp

}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

//=====================================================
// DADOS
//=====================================================

let professores = [];

let escolas = [];

let escolasMapa = {};

let uidEditando = null;

let contexto = null;

//=====================================================
// ELEMENTOS
//=====================================================

let listaProfessores, pesquisaProfessor, btnNovoProfessor;
let modalProfessor, tituloModalProfessor, professorUidInput;
let nomeProfessor, emailProfessor, senhaProfessor;
let papelProfessor, listaEscolasProfessor, ativoProfessor;
let grupoEmail, grupoSenha, grupoPapel, grupoEscola;
let cancelarProfessor, salvarProfessorBtn, loader;

function obterElementos(){

    listaProfessores = document.getElementById("listaProfessores");
    pesquisaProfessor = document.getElementById("pesquisaProfessor");
    btnNovoProfessor = document.getElementById("btnNovoProfessor");
    modalProfessor = document.getElementById("modalProfessor");
    tituloModalProfessor = document.getElementById("tituloModalProfessor");
    professorUidInput = document.getElementById("professorUid");
    nomeProfessor = document.getElementById("nomeProfessor");
    emailProfessor = document.getElementById("emailProfessor");
    senhaProfessor = document.getElementById("senhaProfessor");
    papelProfessor = document.getElementById("papelProfessor");
    listaEscolasProfessor = document.getElementById("listaEscolasProfessor");
    ativoProfessor = document.getElementById("ativoProfessor");
    grupoEmail = document.getElementById("grupoEmail");
    grupoSenha = document.getElementById("grupoSenha");
    grupoPapel = document.getElementById("grupoPapel");
    grupoEscola = document.getElementById("grupoEscola");
    cancelarProfessor = document.getElementById("cancelarProfessor");
    salvarProfessorBtn = document.getElementById("salvarProfessor");
    loader = document.getElementById("loader");

}

//=====================================================
// INICIALIZAÇÃO
//=====================================================

export async function init(){

    contexto = obterContextoUsuario();

    obterElementos();

    // Só super_admin e admin_escola têm acesso — as regras do Firestore já
    // bloqueiam um professor comum de listar outros usuários, mas evita
    // nem tentar e mostrar um erro confuso.
    if(!souSuperAdmin() && contexto.papel !== "admin_escola"){

        document.getElementById("content").innerHTML =
            "<div class='page'><h2>Você não tem permissão pra acessar essa tela.</h2></div>";

        return;

    }

    configurarEventos();

    await carregarEscolas();

    await carregarProfessores();

}

function configurarEventos(){

    btnNovoProfessor.addEventListener("click", abrirModalNovo);

    cancelarProfessor.addEventListener("click", fecharModal);

    salvarProfessorBtn.addEventListener("click", salvarProfessor);

    pesquisaProfessor.addEventListener("input", () => renderizarTabela(filtrarProfessores()));

    papelProfessor.addEventListener("change", aoTrocarPapel);

}

//=====================================================
// CARREGAR ESCOLAS (pro select e pra mostrar o nome na tabela)
//=====================================================

async function carregarEscolas(){

    const snapshot = await getDocs(collection(db,"escolas"));

    escolas = [];

    escolasMapa = {};

    snapshot.forEach(d=>{

        const escola = { id: d.id, ...d.data() };

        escolas.push(escola);

        escolasMapa[d.id] = escola.nome;

    });

    escolas.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

}

// tipo = "checkbox" (professor, pode marcar várias) ou "radio"
// (admin_escola, só uma — o próprio HTML já impede marcar 2)
function renderizarListaEscolas(tipo, marcados = []){

    listaEscolasProfessor.innerHTML = escolas.map(escola => `

        <label style="display:flex; align-items:center; gap:8px; font-weight:400;">
            <input
                type="${tipo}"
                name="escolaProfessorInput"
                class="checkbox-escola-professor"
                value="${escola.id}"
                ${marcados.includes(escola.id) ? "checked" : ""}>
            ${escola.nome}
        </label>

    `).join("");

}

// Lê quais escolas estão marcadas no momento
function obterEscolasMarcadas(){

    return Array.from(document.querySelectorAll(".checkbox-escola-professor:checked"))
        .map(input => input.value);

}

// Redesenha a lista respeitando o papel atual (professor = várias
// escolas possíveis; admin_escola = só uma) e trava se pedido
function marcarEscolas(escolaIdsMarcados, travar){

    const tipo = papelProfessor.value === "admin_escola" ? "radio" : "checkbox";

    renderizarListaEscolas(tipo, escolaIdsMarcados);

    document.querySelectorAll(".checkbox-escola-professor").forEach(input=>{

        input.disabled = travar;

    });

}

// Quando o papel muda pra admin_escola e o professor tinha mais de uma
// escola marcada, NÃO escolhe uma sozinho — limpa e obriga quem está
// editando a escolher explicitamente qual escola esse admin coordena.
function aoTrocarPapel(){

    const marcadosAtuais = obterEscolasMarcadas();

    if(papelProfessor.value === "admin_escola" && marcadosAtuais.length > 1){

        mostrarToast("Esse avaliador atende mais de uma escola — escolha qual delas ele vai coordenar como coordenador.", "erro");

        marcarEscolas([], false);

    }else{

        marcarEscolas(marcadosAtuais, false);

    }

}

//=====================================================
// CARREGAR PROFESSORES
//=====================================================

async function carregarProfessores(){

    abrirLoader();

    try{

        let consulta;

        if(souSuperAdmin()){

            // super_admin vê todo mundo (regra já permite sem filtro)
            consulta = query(collection(db,"usuarios"));

        }else{

            // admin_escola só consegue listar usuarios da própria escola
            // (a regra exige esse filtro explícito na consulta)
            consulta = query(

                collection(db,"usuarios"),

                where("escolaIds","array-contains",contexto.escolaId)

            );

        }

        const snapshot = await getDocs(consulta);

        professores = [];

        snapshot.forEach(d=>{

            const dados = { uid: d.id, ...d.data() };

            if(dados.papel === "professor" || dados.papel === "admin_escola"){

                professores.push(dados);

            }

        });

        professores.sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

        renderizarTabela(professores);

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao carregar avaliadores.", "erro");

    }finally{

        fecharLoader();

    }

}

//=====================================================
// FILTRAR (pesquisa)
//=====================================================

function filtrarProfessores(){

    const termo = pesquisaProfessor.value.trim().toLowerCase();

    if(!termo){

        return professores;

    }

    return professores.filter(p =>

        (p.nome || "").toLowerCase().includes(termo) ||
        (p.email || "").toLowerCase().includes(termo)

    );

}

//=====================================================
// RENDERIZAR TABELA
//=====================================================

function renderizarTabela(lista){

    listaProfessores.innerHTML = "";

    if(lista.length === 0){

        listaProfessores.innerHTML = `

            <tr>
                <td colspan="6" style="text-align:center">Nenhum avaliador cadastrado.</td>
            </tr>

        `;

        return;

    }

    lista.forEach(p=>{

        const papelTexto = p.papel === "admin_escola" ? "Coordenador" : "Avaliador";

        const nomesEscolas = (p.escolaIds || [])

            .map(id => escolasMapa[id] || id)

            .join(", ") || "-";

        listaProfessores.innerHTML += `

            <tr>
                <td>${p.nome || "-"}</td>
                <td>${p.email || "-"}</td>
                <td>${papelTexto}</td>
                <td>${nomesEscolas}</td>
                <td>${p.ativo === false ? "Inativo" : "Ativo"}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-edit" onclick="window.editarProfessor('${p.uid}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn-icon ${p.somenteLeitura ? "btn-delete" : "btn-edit"}" onclick="window.alternarSomenteLeituraProfessor('${p.uid}', ${!p.somenteLeitura})" title="${p.somenteLeitura ? "Tirar modo somente leitura" : "Colocar em somente leitura"}"><i class="bi ${p.somenteLeitura ? "bi-eye-slash" : "bi-eye"}"></i></button>
                        ${souSuperAdmin() ? `
                        <button class="btn-icon ${p.ativo === false ? "btn-edit" : "btn-delete"}" onclick="window.alternarAtivoProfessor('${p.uid}', ${p.ativo === false})" title="${p.ativo === false ? "Ativar" : "Desativar"}"><i class="bi ${p.ativo === false ? "bi-toggle-off" : "bi-toggle-on"}"></i></button>
                        <button class="btn-icon btn-delete" onclick="window.excluirProfessor('${p.uid}')" title="Excluir definitivamente"><i class="bi bi-trash"></i></button>
                        ` : ""}
                    </div>
                </td>
            </tr>

        `;

    });

}

//=====================================================
// MODAL — NOVO
//=====================================================

function abrirModalNovo(){

    uidEditando = null;

    tituloModalProfessor.textContent = "Novo Avaliador";

    professorUidInput.value = "";

    nomeProfessor.value = "";

    emailProfessor.value = "";

    senhaProfessor.value = "";

    ativoProfessor.value = "true";

    // email/senha só fazem sentido na criação (mudar depois exige
    // Admin SDK, que não temos no plano atual — edição só mexe em
    // nome/papel/escola/status)
    grupoEmail.style.display = "block";

    grupoSenha.style.display = "block";


    if(souSuperAdmin()){

        grupoPapel.style.display = "block";

        papelProfessor.value = "professor";

        marcarEscolas([], false);

    }else{

        // admin_escola só pode criar professor, na própria escola
        // (a regra do Firestore já bloqueia qualquer outra combinação)
        grupoPapel.style.display = "none";

        papelProfessor.value = "professor";

        marcarEscolas([contexto.escolaId], true);

    }

    modalProfessor.classList.add("show");

}

//=====================================================
// MODAL — EDITAR
//=====================================================

window.editarProfessor = function(uid){

    const p = professores.find(x => x.uid === uid);

    if(!p){

        return;

    }

    uidEditando = uid;

    tituloModalProfessor.textContent = "Editar Avaliador";

    professorUidInput.value = uid;

    nomeProfessor.value = p.nome || "";

    ativoProfessor.value = p.ativo === false ? "false" : "true";

    // Email/senha não dá pra editar aqui (limitação já explicada)
    grupoEmail.style.display = "none";

    grupoSenha.style.display = "none";

    if(souSuperAdmin()){

        grupoPapel.style.display = "block";

        papelProfessor.value = p.papel;

        marcarEscolas(p.escolaIds || [], false);

    }else{

        // admin_escola não pode mudar papel nem escola de ninguém
        // (a regra do Firestore bloqueia essa alteração de qualquer forma)
        grupoPapel.style.display = "none";

        marcarEscolas(p.escolaIds || [], true);

    }

    modalProfessor.classList.add("show");

};

function fecharModal(){

    modalProfessor.classList.remove("show");

}

//=====================================================
// SALVAR (criar ou editar)
//=====================================================

async function salvarProfessor(){

    const nome = nomeProfessor.value.trim();

    if(nome === ""){

        mostrarToast("Informe o nome.", "erro");

        nomeProfessor.focus();

        return;

    }

    abrirLoader();

    salvarProfessorBtn.disabled = true;

    try{

        if(uidEditando){

            // -------- EDITAR --------
            const dados = { nome, ativo: ativoProfessor.value === "true" };

            if(souSuperAdmin()){

                dados.papel = papelProfessor.value;

                dados.escolaIds = obterEscolasMarcadas();

                if(dados.escolaIds.length === 0){

                    mostrarToast("Marque pelo menos uma escola.", "erro");

                    return;

                }

                if(dados.papel === "admin_escola" && dados.escolaIds.length !== 1){

                    mostrarToast("Coordenador só pode atender uma única escola.", "erro");

                    return;

                }

            }

            await updateDoc(doc(db,"usuarios",uidEditando), dados);

            mostrarToast("Avaliador atualizado com sucesso.");

        }else{

            // -------- CRIAR --------
            const email = emailProfessor.value.trim();

            const senha = senhaProfessor.value;

            const papel = papelProfessor.value;

            const escolaIds = obterEscolasMarcadas();

            if(email === "" || senha.length < 6){

                mostrarToast("Informe um e-mail e uma senha com pelo menos 6 caracteres.", "erro");

                return;

            }

            if(escolaIds.length === 0){

                mostrarToast("Marque pelo menos uma escola.", "erro");

                return;

            }

            if(papel === "admin_escola" && escolaIds.length !== 1){

                mostrarToast("Coordenador só pode atender uma única escola.", "erro");

                return;

            }

            // Cria o usuário numa instância secundária do Firebase, pra
            // não trocar a sessão logada (o SDK do cliente loga
            // automaticamente como o usuário recém-criado).
            const appSecundario = obterAppSecundario();

            const authSecundario = getAuth(appSecundario);

            const credencial = await createUserWithEmailAndPassword(authSecundario, email, senha);

            const uid = credencial.user.uid;

            await signOutSecundario(authSecundario);

            await setDoc(doc(db,"usuarios",uid), {

                nome,

                email,

                papel,

                escolaIds,

                ativo: true,

                criadoEm: serverTimestamp()

            });

            mostrarToast("Avaliador cadastrado com sucesso.");

        }

        fecharModal();

        await carregarProfessores();

    }catch(erro){

        console.error(erro);

        mostrarToast(traduzErro(erro.code), "erro");

    }finally{

        salvarProfessorBtn.disabled = false;

        fecharLoader();

    }

}

function traduzErro(codigo){

    const mensagens = {

        "auth/email-already-in-use": "Esse e-mail já está cadastrado.",
        "auth/invalid-email": "E-mail inválido.",
        "auth/weak-password": "Senha muito fraca (mínimo 6 caracteres)."

    };

    return mensagens[codigo] || "Erro ao salvar. Tente novamente.";

}

//=====================================================
// APP SECUNDÁRIO (evita trocar a sessão do admin logado)
//=====================================================

function obterAppSecundario(){

    const nome = "SecundarioCadastroProfessor";

    const existente = getApps().find(a => a.name === nome);

    if(existente){

        return existente;

    }

    return initializeApp(firebaseConfig, nome);

}

//=====================================================
// EXCLUIR
//=====================================================

// ======================================================
// ATIVAR / DESATIVAR
// Alternativa recomendada ao excluir: bloqueia o login sem
// mexer na conta de autenticação, então não corre risco de
// conflito de e-mail se um dia reativar essa pessoa.
// ======================================================

// ======================================================
// SOMENTE LEITURA
// Restrição que admin_escola também pode aplicar (diferente
// de Ativar/Desativar e Excluir, que agora são só do super_admin).
// ======================================================

window.alternarSomenteLeituraProfessor = async function(uid, ligarSomenteLeitura){

    const acao = ligarSomenteLeitura

        ? "colocar em modo somente leitura (não vai conseguir criar/editar/excluir nada, mas continua acessando)"

        : "tirar do modo somente leitura (volta a poder editar normalmente)";

    if(!confirm(`Confirma ${acao}?`)){

        return;

    }

    abrirLoader();

    try{

        await updateDoc(doc(db,"usuarios",uid), { somenteLeitura: ligarSomenteLeitura });

        mostrarToast(ligarSomenteLeitura ? "Avaliador em modo somente leitura." : "Restrição removida.");

        await carregarProfessores();

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao atualizar status.", "erro");

    }finally{

        fecharLoader();

    }

};

window.alternarAtivoProfessor = async function(uid, ativarDeNovo){

    const acao = ativarDeNovo ? "reativar o acesso" : "desativar (bloquear o acesso)";

    if(!confirm(`Confirma ${acao} desse avaliador?`)){

        return;

    }

    abrirLoader();

    try{

        await updateDoc(doc(db,"usuarios",uid), { ativo: ativarDeNovo });

        mostrarToast(ativarDeNovo ? "Avaliador reativado." : "Avaliador desativado.");

        await carregarProfessores();

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao atualizar status.", "erro");

    }finally{

        fecharLoader();

    }

};

window.excluirProfessor = async function(uid){

    if(!confirm("Excluir DEFINITIVAMENTE este avaliador?\n\nATENÇÃO: a conta de autenticação (e-mail/senha) NÃO é apagada — só o cadastro aqui. Se um dia você tentar recriar um avaliador com esse MESMO e-mail, vai dar erro de \"e-mail já cadastrado\", porque a conta antiga ainda existe no Firebase. Pra reaproveitar o e-mail, você precisaria apagar a conta manualmente em Authentication, no console do Firebase.\n\nSe é só pra tirar o acesso dele por enquanto (podendo reativar depois sem esse problema), cancele e use o botão de Desativar em vez deste.")){

        return;

    }

    abrirLoader();

    try{

        await deleteDoc(doc(db,"usuarios",uid));

        mostrarToast("Avaliador excluído.");

        await carregarProfessores();

    }catch(erro){

        console.error(erro);

        mostrarToast("Erro ao excluir avaliador.", "erro");

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